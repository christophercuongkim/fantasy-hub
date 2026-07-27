"""Parse hand-authored league config + draft CSVs into structured objects.

Pure functions (no DB, no filesystem) so they're unit-testable offline. See
bootstrap/*.example.* for the input format. Lets us preserve league rules and
draft history without the Yahoo API — which matters most for draft history,
since Yahoo loses it if the league is recreated.
"""

from dataclasses import dataclass, field
from typing import Any


@dataclass
class Team:
    yahoo_team_key: str | None
    name: str
    manager_name: str | None
    is_mine: bool
    draft_position: int | None


@dataclass
class LeagueConfig:
    yahoo_league_key: str
    name: str
    season: int
    num_teams: int
    scoring: dict[str, float]
    roster_positions: dict[str, int]
    playoff_start_week: int | None
    num_playoff_teams: int | None
    waiver_type: str | None
    trade_deadline: str | None
    teams: list[Team] = field(default_factory=list)


@dataclass
class DraftPickRow:
    season: int
    overall: int
    round: int
    pick_in_round: int
    manager: str  # matches a team's manager_name
    player_name: str
    player_key: str | None
    cost: int | None


def scoring_json(scoring: dict[str, float]) -> dict[str, Any]:
    """Wrap the flat scoring map into the stored jsonb shape (matches
    web/db/schema ScoringJson)."""
    return {
        "stat_modifiers": scoring,
        "fractional_points": any(float(v) != int(v) for v in scoring.values()),
        "negative_points": any(float(v) < 0 for v in scoring.values()),
    }


def parse_league(doc: dict[str, Any]) -> LeagueConfig:
    league = doc["league"]
    teams = [
        Team(
            yahoo_team_key=t.get("yahoo_team_key"),
            name=t["name"],
            manager_name=t.get("manager_name"),
            is_mine=bool(t.get("is_mine", False)),
            draft_position=t.get("draft_position"),
        )
        for t in doc.get("teams", [])
    ]
    if sum(t.is_mine for t in teams) > 1:
        raise ValueError("more than one team marked is_mine")
    return LeagueConfig(
        yahoo_league_key=league["yahoo_league_key"],
        name=league["name"],
        season=int(league["season"]),
        num_teams=int(league["num_teams"]),
        scoring={k: float(v) for k, v in league["scoring"].items()},
        roster_positions={k: int(v) for k, v in league["roster_positions"].items()},
        playoff_start_week=league.get("playoff_start_week"),
        num_playoff_teams=league.get("num_playoff_teams"),
        waiver_type=league.get("waiver_type"),
        trade_deadline=str(league["trade_deadline"])
        if league.get("trade_deadline")
        else None,
        teams=teams,
    )


def _int_or_none(value: Any) -> int | None:
    value = (value or "").strip() if isinstance(value, str) else value
    return int(value) if value not in (None, "") else None


def parse_draft(rows: list[dict[str, Any]], season: int) -> list[DraftPickRow]:
    out: list[DraftPickRow] = []
    for row in rows:
        out.append(
            DraftPickRow(
                season=season,
                overall=int(row["overall"]),
                round=int(row["round"]),
                pick_in_round=int(row["pick_in_round"]),
                manager=row["manager"].strip(),
                player_name=row["player_name"].strip(),
                player_key=(row.get("player_key") or "").strip() or None,
                cost=_int_or_none(row.get("cost")),
            )
        )
    return out
