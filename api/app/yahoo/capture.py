"""Capture real Yahoo responses into contracts/fixtures/yahoo/.

Run once with a valid stored token (from the web OAuth flow):

    python -m app.yahoo.capture

Discovers your NFL league + team, fetches the key endpoints, scrubs the GUID,
and overwrites the cookbook-derived fixtures with real ones. Review the diff
before committing (team/manager names are left intact). Real captures beat
hand-written fixtures — they encode reality, not our assumptions.
"""

import json
import re
import sys
from pathlib import Path
from typing import Any

from app.yahoo import parse
from app.yahoo.client import YahooClient

FIXTURES = Path(__file__).parents[3] / "contracts" / "fixtures" / "yahoo"


def _scrub(obj: Any) -> Any:
    text = json.dumps(obj)
    text = re.sub(r'("guid":\s*")[^"]*(")', r"\1SCRUBBED_GUID\2", text)
    return json.loads(text)


def _write(name: str, obj: Any) -> None:
    FIXTURES.mkdir(parents=True, exist_ok=True)
    (FIXTURES / name).write_text(json.dumps(_scrub(obj), indent=2) + "\n")
    print(f"wrote {name}")


def _find_team_key(raw: Any, league_key: str) -> str | None:
    for match in re.findall(r'"team_key":\s*"([^"]+)"', json.dumps(raw)):
        if match.startswith(league_key + ".t."):
            return match
    return None


def main() -> int:
    client = YahooClient()

    _write("game_nfl.json", client.get("/game/nfl"))

    leagues_raw = client.get("/users;use_login=1/games;game_keys=nfl/leagues")
    _write("users_leagues.json", leagues_raw)
    leagues = parse.parse_leagues(leagues_raw)
    if not leagues:
        print("No NFL leagues found for this account.", file=sys.stderr)
        return 1
    league = leagues[0]
    lk = league.league_key
    week = league.current_week or 1
    print(f"Using league {lk} (week {week})")

    _write("league_settings.json", client.get(f"/league/{lk}/settings"))
    _write("league_draftresults.json", client.get(f"/league/{lk}/draftresults"))
    _write(
        "league_players_fa.json",
        client.get(f"/league/{lk}/players;status=FA;sort=AR;count=5;start=0"),
    )

    teams_raw = client.get("/users;use_login=1/games;game_keys=nfl/teams")
    team_key = _find_team_key(teams_raw, lk)
    if team_key is None:
        print(
            "Could not find your team key; skipping roster/matchups.", file=sys.stderr
        )
        return 0

    _write("team_roster_week7.json", client.get(f"/team/{team_key}/roster;week={week}"))
    _write(
        "team_matchups_week7.json",
        client.get(f"/team/{team_key}/matchups;weeks={week}"),
    )
    print(
        "Done. Review the diff (team/manager names are not scrubbed) before committing."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
