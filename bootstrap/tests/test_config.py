"""Offline tests for the settings parser + sport adapter."""

from pathlib import Path

from importer import config
from sports import nfl

FIXTURE = (Path(__file__).parent / "fixtures" / "settings_sample.html").read_text()


def test_parse_settings():
    s = config.parse_settings(FIXTURE)
    assert s.league_id == "93367"
    assert s.name == "PeopleCanEat"
    assert s.num_teams == 12
    assert s.playoff_start_week == 15
    assert s.num_playoff_teams == 6
    assert s.waiver_type == "FAAB"
    assert s.trade_deadline == "2024-11-16"


def test_scoring_yards_per_point_and_flat():
    s = config.parse_settings(FIXTURE)
    assert s.scoring["pass_yd"] == 0.04  # 1/25
    assert s.scoring["rush_yd"] == 0.1  # 1/10
    assert s.scoring["rec"] == 0.5
    assert s.scoring["pass_int"] == -2.0  # league value, not the -1 default
    assert s.scoring["fum_lost"] == -2.0


def test_roster_positions_counted():
    s = config.parse_settings(FIXTURE)
    assert s.roster_positions == {
        "QB": 1, "WR": 2, "RB": 2, "TE": 1, "W/R/T": 1,
        "K": 1, "DEF": 1, "BN": 6, "IR": 1,
    }


def test_scoring_json_flags():
    s = config.parse_settings(FIXTURE)
    sj = config.scoring_json(s)
    assert sj["fractional_points"] is True
    assert sj["negative_points"] is True
    assert sj["stat_modifiers"]["rec_td"] == 6.0


def test_league_key_uses_game_key():
    assert nfl.league_key(2024, "93367") == "449.l.93367"
    assert nfl.league_key(2025, "735658") == "461.l.735658"
