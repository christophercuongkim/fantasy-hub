"""Yahoo league sync — write parsed Yahoo data into Postgres.

Source-agnostic by design: these functions take an already-parsed `json_f`
payload (a dict) and upsert it, so the fetch layer (cookie-authenticated
pub-api-rw client) is swappable and the writer is unit-testable offline against
fixtures. See parse_jsonf for the shapes.
"""

from __future__ import annotations

from app.storage import postgres
from app.yahoo.parse_jsonf import parse_teams


def sync_teams(payload: dict) -> dict:
    """Backfill the league's teams from a `teams;out=standings` payload: set each
    row's yahoo_team_key + is_mine, and the regular-season record when present.
    Matches an existing league_teams row by (league_id, name) — the league must
    already exist (bootstrap loads it); this fills in what the scrape lacked.

    Returns counts; teams_updated < teams_parsed flags a name that didn't match a
    known row (a renamed team), which is the thing to eyeball."""
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
        updated = 0
        for t in teams:
            cur.execute(
                """
                UPDATE league_teams
                SET yahoo_team_key = %s, is_mine = %s,
                    wins = %s, losses = %s, ties = %s,
                    points_for = %s, points_against = %s
                WHERE league_id = %s AND name = %s
                """,
                (
                    t.team_key,
                    t.is_mine,
                    t.wins,
                    t.losses,
                    t.ties,
                    t.points_for,
                    t.points_against,
                    league_id,
                    t.name,
                ),
            )
            updated += cur.rowcount

    return {
        "league_key": league_key,
        "teams_parsed": len(teams),
        "teams_updated": updated,
        "unmatched": len(teams) - updated,
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
