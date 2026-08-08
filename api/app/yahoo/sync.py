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
