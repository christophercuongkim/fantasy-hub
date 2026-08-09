"""Yahoo league sync — write parsed Yahoo data into Postgres.

Source-agnostic by design: these functions take an already-parsed `json_f`
payload (a dict) and upsert it, so the fetch layer (cookie-authenticated
pub-api-rw client) is swappable and the writer is unit-testable offline against
fixtures. See parse_jsonf for the shapes.
"""

from __future__ import annotations

import json

from app.storage import postgres
from app.yahoo.parse_jsonf import parse_settings, parse_teams

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
