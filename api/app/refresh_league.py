"""In-season league sync, runnable as `python -m app.refresh_league`.

A daily Dokploy scheduled task: for every current-season league it refreshes the
current NFL week's rosters and matchups, all transactions, and the injury
designations — hands-off, over the auto-refreshing OAuth token. Run in-process
for the same reasons as refresh_current (the slim api image has no curl, and the
/jobs endpoints have no auth). It does what POST /jobs/sync-rosters,
sync-matchups, sync-transactions and sync-player-status do, but resolves the week
server-side (from the schedule table, never Yahoo's current_week) and loops every
league of the season rather than taking one league + week in the request.
"""

import json
import sys

from app.projection import baseline
from app.yahoo import oauth_api, sync


def _sync_league(league_key: str, week: int) -> dict:
    """Run the four in-season legs for one league. A leg's ValueError (a data
    problem — an unmatched name, a missing league row) is recorded and the run is
    marked degraded, so one bad leg or league doesn't sink the rest. An auth or
    upstream failure raises a YahooError instead, which propagates out and fails
    the whole cron loudly rather than logging the same auth error per league."""
    legs = {
        "rosters": lambda: sync.sync_rosters(league_key, oauth_api.roster, week),
        "matchups": lambda: sync.sync_matchups(oauth_api.scoreboard(league_key, week)),
        "transactions": lambda: sync.sync_all_transactions(
            league_key, oauth_api.transactions
        ),
        "injuries": lambda: sync.sync_player_status(league_key, oauth_api.players),
    }
    out: dict = {"league_key": league_key}
    for name, fn in legs.items():
        try:
            out[name] = fn()
        except ValueError as e:
            out[name] = {"error": str(e)}
    return out


def _degraded(leagues: list[dict]) -> bool:
    return any(
        "error" in leg for lg in leagues for leg in lg.values() if isinstance(leg, dict)
    )


def run() -> dict:
    """Resolve the current season + week, then sync every league of that season.
    No-ops (exit 0) in the offseason or before any league/schedule exists."""
    season = baseline.current_season()
    if season is None:
        return {"status": "no_league_seasons"}
    week = baseline.current_week(season)
    if week is None:
        return {"status": "offseason", "season": season}
    keys = sync.season_league_keys(season)
    if not keys:
        return {"status": "no_leagues", "season": season}
    leagues = [_sync_league(k, week) for k in keys]
    return {
        "status": "degraded" if _degraded(leagues) else "synced",
        "season": season,
        "week": week,
        "leagues": leagues,
    }


def main() -> int:
    result = run()
    print(json.dumps(result, default=str))
    # Degraded = a leg hit a data error; exit non-zero so the scheduler flags it.
    return 1 if result.get("status") == "degraded" else 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:  # noqa: BLE001 — auth/upstream failure -> non-zero exit
        print(f"refresh-league failed: {e}", file=sys.stderr)
        sys.exit(1)
