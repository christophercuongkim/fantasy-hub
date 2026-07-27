"""Bootstrap parse tests — offline (no DB). The DB load is verified manually."""

import csv
from pathlib import Path

import pytest
import yaml

from app.bootstrap import parse

BOOTSTRAP = Path(__file__).parents[2] / "bootstrap"


def test_parse_league_example():
    doc = yaml.safe_load((BOOTSTRAP / "league.example.yaml").read_text())
    cfg = parse.parse_league(doc)
    assert cfg.yahoo_league_key == "461.l.123456"
    assert cfg.season == 2025
    assert cfg.scoring["rec"] == 0.5
    assert cfg.roster_positions["W/R/T"] == 1
    assert cfg.waiver_type == "FAAB"
    assert cfg.trade_deadline == "2025-11-19"
    assert sum(t.is_mine for t in cfg.teams) == 1


def test_scoring_json_flags():
    sj = parse.scoring_json({"rec": 0.5, "pass_int": -1.0, "pass_td": 4})
    assert sj["stat_modifiers"]["rec"] == 0.5
    assert sj["fractional_points"] is True  # 0.5 is fractional
    assert sj["negative_points"] is True  # -1 is negative


def test_scoring_json_standard_no_fraction_no_negative():
    sj = parse.scoring_json({"pass_td": 4, "rec_td": 6})
    assert sj["fractional_points"] is False
    assert sj["negative_points"] is False


def test_parse_draft_example():
    rows = list(
        csv.DictReader((BOOTSTRAP / "draft-2024.example.csv").read_text().splitlines())
    )
    picks = parse.parse_draft(rows, 2024)
    assert len(picks) == 4
    first = picks[0]
    assert first.overall == 1
    assert first.round == 1
    assert first.manager == "Alice"
    assert first.player_name == "Christian McCaffrey"
    assert first.cost is None  # empty -> None, not 0
    assert first.player_key is None
    assert picks[3].round == 2


def test_multiple_is_mine_rejected():
    doc = {
        "league": {
            "yahoo_league_key": "1.l.1",
            "name": "x",
            "season": 2025,
            "num_teams": 2,
            "scoring": {"rec": 1},
            "roster_positions": {"QB": 1},
        },
        "teams": [
            {"name": "a", "manager_name": "A", "is_mine": True},
            {"name": "b", "manager_name": "B", "is_mine": True},
        ],
    }
    with pytest.raises(ValueError):
        parse.parse_league(doc)
