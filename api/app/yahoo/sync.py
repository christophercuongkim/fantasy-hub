"""Yahoo league sync — write parsed Yahoo data into Postgres.

Source-agnostic by design: these functions take an already-parsed `json_f`
payload (a dict) and upsert it, so the fetch layer (cookie-authenticated
pub-api-rw client) is swappable and the writer is unit-testable offline against
fixtures. See parse_jsonf for the shapes.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime

from app.crosswalk.names import normalize
from app.storage import postgres
from app.yahoo.parse_jsonf import (
    parse_matchups,
    parse_roster,
    parse_settings,
    parse_teams,
    parse_transactions,
)

# Yahoo returns a real GUID but the nickname "--hidden--" for a manager not
# visible to the logged-in user (pre-membership managers who left / private
# profiles). We can't name them, so we don't mint a person — the team falls back
# to its own name, which is the pre-2022 unclaimed-era behaviour the pages intend.
HIDDEN_NICKNAME = "--hidden--"


def _usable_manager(guid: str | None, nickname: str | None) -> bool:
    return (
        bool(guid)
        and len(guid) > 2  # a real GUID is 26 chars; skips junk like "--"
        and bool(nickname)
        and nickname != HIDDEN_NICKNAME
    )


def _upsert_manager(cur, guid: str, nickname: str | None) -> str:
    """Upsert the canonical person by Yahoo GUID → managers.id. display_name
    follows latest-season-wins: sync_all runs oldest→newest, so the newest sync's
    nickname is the one that sticks. Falls back to the GUID if no nickname."""
    cur.execute(
        """
        INSERT INTO managers (yahoo_guid, display_name, updated_at)
        VALUES (%s, %s, now())
        ON CONFLICT (yahoo_guid)
        DO UPDATE SET display_name = EXCLUDED.display_name, updated_at = now()
        RETURNING id
        """,
        (guid, nickname or guid),
    )
    return cur.fetchone()[0]


def sync_teams(payload: dict) -> dict:
    """Backfill the league's teams from a `teams;out=standings` payload: set each
    row's yahoo_team_key + is_mine + regular-season record, AND upsert the manager
    by GUID and link league_teams.manager_id — filling in the people the scrape
    couldn't (it only got a GUID where a /user/<guid> href was parseable).

    Upserts each team on (league_id, name), so it both backfills an existing
    league and creates the rows for a brand-new one. The leagues row must already
    exist — bootstrap loads the historical seasons; upsert_league creates the
    current one before this runs (see sync_league)."""
    lg = payload["fantasy_content"]["league"]
    league_key = lg["league_key"]
    teams = parse_teams(payload)

    with postgres.connect() as conn, conn.cursor() as cur:
        cur.execute("SELECT id FROM leagues WHERE yahoo_league_key = %s", (league_key,))
        row = cur.fetchone()
        if not row:
            raise ValueError(f"no league row for {league_key} — bootstrap it first")
        league_id = row[0]

        # is_mine is exactly-one-per-league, so clear then set — avoids a stale
        # second `true` if a team changed hands.
        cur.execute(
            "UPDATE league_teams SET is_mine = false WHERE league_id = %s",
            (league_id,),
        )
        linked = 0
        for t in teams:
            manager_id = (
                _upsert_manager(cur, t.manager_guid, t.manager_nickname)
                if _usable_manager(t.manager_guid, t.manager_nickname)
                else None
            )
            # Upsert on (league_id, name): updates a known team, and creates the
            # rows for a brand-new league (e.g. the current season pre-backfill).
            cur.execute(
                """
                INSERT INTO league_teams (league_id, name, is_mine, yahoo_team_key,
                    manager_id, wins, losses, ties, points_for, points_against)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (league_id, name) DO UPDATE SET
                    yahoo_team_key = EXCLUDED.yahoo_team_key,
                    is_mine = EXCLUDED.is_mine,
                    manager_id = COALESCE(EXCLUDED.manager_id, league_teams.manager_id),
                    wins = EXCLUDED.wins, losses = EXCLUDED.losses,
                    ties = EXCLUDED.ties, points_for = EXCLUDED.points_for,
                    points_against = EXCLUDED.points_against
                """,
                (
                    league_id,
                    t.name,
                    t.is_mine,
                    t.team_key,
                    manager_id,  # COALESCE keeps an existing link when None (hidden)
                    t.wins,
                    t.losses,
                    t.ties,
                    t.points_for,
                    t.points_against,
                ),
            )
            if manager_id:
                linked += 1

    return {
        "league_key": league_key,
        "teams_written": len(teams),
        "managers_linked": linked,
    }


def _resolve_family_id(cur, settings) -> str | None:
    """Find the league's family. In order: this exact league already in the DB
    (re-sync), the renewed-from prior season's league (renew chain), then the
    persistent_url slug (only the current league exposes one)."""
    cur.execute(
        "SELECT family_id FROM leagues WHERE yahoo_league_key = %s",
        (settings.league_key,),
    )
    row = cur.fetchone()
    if row:
        return row[0]
    if settings.renew:  # "461_328209" → the 461.l.328209 league
        prior = settings.renew.replace("_", ".l.")
        cur.execute(
            "SELECT family_id FROM leagues WHERE yahoo_league_key = %s", (prior,)
        )
        row = cur.fetchone()
        if row:
            return row[0]
    if settings.slug:
        cur.execute(
            "SELECT id FROM league_families WHERE yahoo_slug = %s", (settings.slug,)
        )
        row = cur.fetchone()
        if row:
            return row[0]
    return None


def upsert_league(settings) -> str:
    """Create or update the leagues row from a parsed /settings. The family is
    resolved from an existing season / the renew chain / the slug (see
    _resolve_family_id). Idempotent — re-run after the rules finalise to refresh
    scoring_json + roster in place. Returns league_id."""
    with postgres.connect() as conn, conn.cursor() as cur:
        family_id = _resolve_family_id(cur, settings)
        if family_id is None:
            raise ValueError(
                f"couldn't resolve a family for {settings.league_key} "
                "(no existing season, renew chain, or persistent_url slug)"
            )
        cur.execute("SELECT sport FROM league_families WHERE id = %s", (family_id,))
        sport = cur.fetchone()[0]
        cur.execute(
            """
            INSERT INTO leagues (family_id, sport, yahoo_league_key, name, season,
                num_teams, scoring_json, roster_positions_json,
                playoff_start_week, num_playoff_teams, waiver_type, trade_deadline,
                updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s, %s, %s, %s, now())
            ON CONFLICT (yahoo_league_key) DO UPDATE SET
                name = EXCLUDED.name, num_teams = EXCLUDED.num_teams,
                scoring_json = EXCLUDED.scoring_json,
                roster_positions_json = EXCLUDED.roster_positions_json,
                playoff_start_week = EXCLUDED.playoff_start_week,
                num_playoff_teams = EXCLUDED.num_playoff_teams,
                waiver_type = EXCLUDED.waiver_type,
                trade_deadline = EXCLUDED.trade_deadline,
                updated_at = now()
            RETURNING id
            """,
            (
                family_id,
                sport,
                settings.league_key,
                settings.name,
                settings.season,
                settings.num_teams,
                json.dumps(settings.scoring),
                json.dumps(settings.roster_positions),
                settings.playoff_start_week,
                settings.num_playoff_teams,
                settings.waiver_type,
                settings.trade_deadline,
            ),
        )
        league_id = cur.fetchone()[0]
        conn.commit()
    return str(league_id)


def sync_league(settings_payload: dict, teams_payload: dict) -> dict:
    """Create-or-update a league from its /settings, then its teams. This is how
    the current season gets created (it isn't bootstrapped); re-run after the
    rules finalise to refresh scoring."""
    settings = parse_settings(settings_payload)
    upsert_league(settings)
    teams = sync_teams(teams_payload)
    return {
        "league_key": settings.league_key,
        "season": settings.season,
        "scoring_keys": sorted(settings.scoring["stat_modifiers"]),
        "teams": teams,
    }


# Yahoo editorial_team_abbr -> nflverse `defteam` vocabulary — only the few that
# differ (Yahoo keeps legacy/alt abbrevs). Everything else matches once uppercased.
_YAHOO_TEAM_FIXUP = {"LAR": "LA", "OAK": "LV", "SD": "LAC", "STL": "LA", "WSH": "WAS"}


def _nfl_abbr(yahoo_abbr: str | None) -> str:
    a = (yahoo_abbr or "").upper()
    return _YAHOO_TEAM_FIXUP.get(a, a)


def _resolve_defense(cur, players: list) -> dict[str, str]:
    """DEF roster entries -> synthesized DST players.id, linked by NFL team abbrev.
    A DST's Yahoo player_id is season-varying and its name is a nickname, so team
    (editorial_team_abbr -> our 'DST-{ABBR}' sentinel gsis) is the stable key."""
    defs = [p for p in players if p.primary_position == "DEF" and p.team_abbr]
    if not defs:
        return {}
    want = {p.yahoo_player_id: f"DST-{_nfl_abbr(p.team_abbr)}" for p in defs}
    cur.execute(
        "SELECT gsis_id, id FROM players WHERE gsis_id = ANY(%s)",
        (list(set(want.values())),),
    )
    idmap = {g: str(i) for g, i in cur.fetchall()}
    return {yid: idmap[g] for yid, g in want.items() if g in idmap}


def _resolve_by_name(cur, misses: list) -> tuple[dict[str, str], set[str]]:
    """Second-chance crosswalk for players nflverse has no yahoo_id for: match on
    normalized name + position against the registry, accepting only a UNIQUE hit
    (rosters.player_id is a required FK — a wrong guess corrupts data, so an
    ambiguous or absent match is left unresolved, never guessed). On a confident
    match to a registry row with no yahoo_id, backfill it so the next sync is a
    direct join. Returns {yahoo_player_id: players.id} and the resolved id set."""
    named = [p for p in misses if p.name]
    if not named:
        return {}, set()
    cur.execute(
        "SELECT name_normalized, position, id, yahoo_id FROM players "
        "WHERE name_normalized = ANY(%s)",
        (list({normalize(p.name) for p in named}),),
    )
    by_key: dict[tuple[str, str], list[tuple[str, str | None]]] = {}
    for nn, pos, pid, yid in cur.fetchall():
        by_key.setdefault((nn, pos), []).append((pid, yid))

    resolved: dict[str, str] = {}
    claimed: set[str] = set()  # yahoo ids taken this sync — don't double-assign
    for p in named:
        cands = by_key.get((normalize(p.name), p.primary_position or ""))
        if not cands or len(cands) != 1:
            continue  # 0 = true rookie / not in registry; >1 = ambiguous
        pid, existing_yid = cands[0]
        resolved[p.yahoo_player_id] = pid
        # Self-heal: fill a null yahoo_id (never clobber a different id, never
        # reuse one already assigned). `AND yahoo_id IS NULL` guards a race.
        if existing_yid is None and p.yahoo_player_id not in claimed:
            cur.execute(
                "UPDATE players SET yahoo_id = %s, updated_at = now() "
                "WHERE id = %s AND yahoo_id IS NULL",
                (p.yahoo_player_id, pid),
            )
            claimed.add(p.yahoo_player_id)
    return resolved, set(resolved)


def sync_roster(payload: dict) -> dict:
    """Replace a team's weekly roster snapshot. Crosswalks each Yahoo player to
    players.id by yahoo_id, with a name+position fallback for the ~quarter of
    skill players nflverse has no yahoo_id for (see _resolve_by_name). Still
    unmatched (DST, true rookies with no registry row) are skipped — rosters.
    player_id is a required FK. Delete-then-insert so a dropped player doesn't
    linger in the week."""
    r = parse_roster(payload)
    with postgres.connect() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT id FROM league_teams WHERE yahoo_team_key = %s", (r.team_key,)
        )
        row = cur.fetchone()
        if not row:
            raise ValueError(f"no league_team for {r.team_key} — sync teams first")
        team_id = row[0]

        cur.execute(
            "SELECT yahoo_id, id FROM players WHERE yahoo_id = ANY(%s)",
            ([p.yahoo_player_id for p in r.players],),
        )
        pmap = {y: i for y, i in cur.fetchall()}
        by_def = _resolve_defense(cur, r.players)  # DEF -> synthesized DST players
        by_name, named_ids = _resolve_by_name(
            cur,
            [
                p
                for p in r.players
                if p.yahoo_player_id not in pmap and p.yahoo_player_id not in by_def
            ],
        )

        cur.execute(
            "DELETE FROM rosters WHERE league_team_id = %s AND week = %s",
            (team_id, r.week),
        )
        written = 0
        unresolved: list[dict] = []
        for p in r.players:
            pid = (
                pmap.get(p.yahoo_player_id)
                or by_def.get(p.yahoo_player_id)
                or by_name.get(p.yahoo_player_id)
            )
            if pid is None:
                unresolved.append(
                    {
                        "yahoo_id": p.yahoo_player_id,
                        "name": p.name,
                        "pos": p.primary_position,
                    }
                )
                continue
            cur.execute(
                "INSERT INTO rosters (league_team_id, week, player_id, slot, "
                "is_starter, fetched_at) VALUES (%s, %s, %s, %s, %s, now()) "
                "ON CONFLICT DO NOTHING",
                (team_id, r.week, pid, p.slot, p.is_starter),
            )
            written += cur.rowcount
        conn.commit()
    return {
        "team_key": r.team_key,
        "week": r.week,
        "players": len(r.players),
        "written": written,
        "matched_by_name": len(named_ids),
        "matched_by_def": len(by_def),
        "skipped": len(r.players) - written,
        "unresolved": unresolved,
    }


def sync_rosters(league_key: str, fetch, week: int) -> dict:
    """Every team's roster for a week — one call per team. `fetch(team_key, week)
    -> payload` (pub_api.roster live)."""
    with postgres.connect() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT lt.yahoo_team_key FROM league_teams lt "
            "JOIN leagues l ON l.id = lt.league_id "
            "WHERE l.yahoo_league_key = %s AND lt.yahoo_team_key IS NOT NULL",
            (league_key,),
        )
        team_keys = [r[0] for r in cur.fetchall()]
    results: list[dict] = []
    for tk in team_keys:
        try:
            results.append(sync_roster(fetch(tk, week)))
        except ValueError as e:
            results.append({"team_key": tk, "error": str(e)})
    # Flatten unresolved across teams so the admin sees exactly who dropped out.
    unresolved = [u for r in results for u in r.get("unresolved", [])]
    return {
        "week": week,
        "teams": len(team_keys),
        "written": sum(r.get("written", 0) for r in results),
        "matched_by_name": sum(r.get("matched_by_name", 0) for r in results),
        "matched_by_def": sum(r.get("matched_by_def", 0) for r in results),
        "unresolved": unresolved,
        "results": results,
    }


def sync_matchups(payload: dict) -> dict:
    """Upsert a week's matchups from a scoreboard payload. Stored once per pair in
    canonical order (lower league_team uuid = team_a), matching the table's
    (league_id, week, team_a_id) key. Skips a matchup whose teams aren't synced."""
    sb = parse_matchups(payload)
    with postgres.connect() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT id FROM leagues WHERE yahoo_league_key = %s", (sb.league_key,)
        )
        row = cur.fetchone()
        if not row:
            raise ValueError(f"no league for {sb.league_key} — sync teams first")
        league_id = row[0]

        keys = [k for m in sb.matchups for k in (m.team_a_key, m.team_b_key)]
        cur.execute(
            "SELECT yahoo_team_key, id FROM league_teams "
            "WHERE yahoo_team_key = ANY(%s)",
            (keys,),
        )
        tmap = {k: i for k, i in cur.fetchall()}

        written = 0
        for m in sb.matchups:
            a, b = tmap.get(m.team_a_key), tmap.get(m.team_b_key)
            if a is None or b is None:
                continue
            ap, bp = m.team_a_points, m.team_b_points
            if a > b:  # canonical: lower uuid is team_a
                a, b, ap, bp = b, a, bp, ap
            cur.execute(
                """
                INSERT INTO matchups (league_id, week, team_a_id, team_b_id,
                    team_a_score, team_b_score, is_playoff)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (league_id, week, team_a_id) DO UPDATE SET
                    team_b_id = EXCLUDED.team_b_id,
                    team_a_score = EXCLUDED.team_a_score,
                    team_b_score = EXCLUDED.team_b_score,
                    is_playoff = EXCLUDED.is_playoff
                """,
                (league_id, sb.week, a, b, ap, bp, m.is_playoff),
            )
            written += 1
        conn.commit()
    return {
        "league_key": sb.league_key,
        "week": sb.week,
        "matchups": len(sb.matchups),
        "written": written,
    }


def sync_transactions(payload: dict) -> dict:
    """Upsert one page of transactions as player-movement rows. Crosswalks players
    by yahoo_id + teams by yahoo_team_key; a movement whose player can't be matched
    is skipped (player_id is a required FK). Returns the transaction count on the
    page so the caller can paginate."""
    league_key, moves = parse_transactions(payload)
    n_txns = len(payload["fantasy_content"]["league"].get("transactions", []))
    with postgres.connect() as conn, conn.cursor() as cur:
        cur.execute("SELECT id FROM leagues WHERE yahoo_league_key = %s", (league_key,))
        row = cur.fetchone()
        if not row:
            raise ValueError(f"no league for {league_key} — sync teams first")
        league_id = row[0]

        yids = list({m.yahoo_player_id for m in moves})
        cur.execute(
            "SELECT yahoo_id, id FROM players WHERE yahoo_id = ANY(%s)", (yids,)
        )
        pmap = {y: i for y, i in cur.fetchall()}

        tkeys = list(
            {k for m in moves for k in (m.source_team_key, m.destination_team_key) if k}
        )
        cur.execute(
            "SELECT yahoo_team_key, id FROM league_teams "
            "WHERE yahoo_team_key = ANY(%s)",
            (tkeys,),
        )
        tmap = {k: i for k, i in cur.fetchall()}

        written = 0
        for m in moves:
            pid = pmap.get(m.yahoo_player_id)
            if pid is None:
                continue
            executed = (
                datetime.fromtimestamp(m.executed_at, UTC) if m.executed_at else None
            )
            cur.execute(
                """
                INSERT INTO transactions (league_id, yahoo_transaction_key, type,
                    status, executed_at, player_id, source_team_id, source_type,
                    destination_team_id, destination_type, faab_bid)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (league_id, yahoo_transaction_key, player_id)
                DO UPDATE SET type = EXCLUDED.type, status = EXCLUDED.status,
                    executed_at = EXCLUDED.executed_at,
                    source_team_id = EXCLUDED.source_team_id,
                    source_type = EXCLUDED.source_type,
                    destination_team_id = EXCLUDED.destination_team_id,
                    destination_type = EXCLUDED.destination_type,
                    faab_bid = EXCLUDED.faab_bid
                """,
                (
                    league_id,
                    m.transaction_key,
                    m.type,
                    m.status,
                    executed,
                    pid,
                    tmap.get(m.source_team_key),
                    m.source_type,
                    tmap.get(m.destination_team_key),
                    m.destination_type,
                    m.faab_bid,
                ),
            )
            written += 1
        conn.commit()
    return {"transactions": n_txns, "movements": len(moves), "written": written}


def sync_all_transactions(league_key: str, fetch, page: int = 25) -> dict:
    """All of a league's transactions, paginated — `fetch(league_key, start,
    count) -> payload`. Stops when a page returns fewer than a full count."""
    start = 0
    totals = {"transactions": 0, "movements": 0, "written": 0}
    while True:
        r = sync_transactions(fetch(league_key, start, page))
        for k in totals:
            totals[k] += r[k]
        if r["transactions"] < page:
            break
        start += page
    return {"league_key": league_key, **totals}


def _league_keys() -> list[str]:
    """Every league we hold a Yahoo key for, oldest first — all bootstrapped
    seasons of the renewed league."""
    with postgres.connect() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT yahoo_league_key FROM leagues "
            "WHERE yahoo_league_key IS NOT NULL ORDER BY season"
        )
        return [r[0] for r in cur.fetchall()]


def sync_all_teams(fetch, keys: list[str] | None = None) -> dict:
    """Sync teams for every league we know — one cookie, all seasons. `fetch` is
    the injected source `fetch(league_key) -> payload` (pub_api.teams live).
    Per-league ValueErrors (e.g. an unmatched name) are recorded and the loop
    continues; a cookie/network failure propagates so the whole run aborts
    loudly rather than logging the same error a dozen times."""
    keys = keys if keys is not None else _league_keys()
    results: list[dict] = []
    for key in keys:
        try:
            results.append(sync_teams(fetch(key)))
        except ValueError as e:
            results.append({"league_key": key, "error": str(e)})
    return {
        "leagues": len(keys),
        "synced": sum(1 for r in results if "error" not in r),
        "results": results,
    }
