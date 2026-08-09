"""Offline tests for the Yahoo json_f parsers (no network / DB)."""

import json
from pathlib import Path

from app.yahoo.parse_jsonf import (
    parse_league,
    parse_matchups,
    parse_roster,
    parse_settings,
    parse_teams,
)

_FIX = Path(__file__).parent / "fixtures"
FIXTURE = json.loads((_FIX / "teams_standings.json").read_text())
SETTINGS = json.loads((_FIX / "settings.json").read_text())
ROSTER = json.loads((_FIX / "roster.json").read_text())
SCOREBOARD = json.loads((_FIX / "scoreboard.json").read_text())


def test_parse_league():
    lg = parse_league(FIXTURE)
    assert lg.league_key == "449.l.93367"
    assert lg.name == "PeopleCanEat"
    assert lg.season == 2024  # coerced from the string "2024"
    assert lg.num_teams == 12


def test_parse_teams_records_and_is_mine():
    teams = {t.team_id: t for t in parse_teams(FIXTURE)}
    assert set(teams) == {"1", "10", "3"}

    mine = teams["10"]
    assert mine.is_mine is True  # is_owned_by_current_login + is_current_login
    assert mine.name == "Samuel L. Jackson"
    assert mine.team_key == "449.l.93367.t.10"
    assert mine.manager_guid == "OJP3ANS4PWZCN2H4IV5PZ6PAT4"
    assert (mine.wins, mine.losses, mine.ties) == (9, 5, 0)  # coerced from strings
    assert mine.points_for == 1438.22
    assert mine.rank == 2

    other = teams["1"]
    assert other.is_mine is False
    assert (other.wins, other.losses) == (8, 6)


def test_parse_teams_handles_missing_standings():
    # a predraft/no-standings team → record fields stay None, no crash.
    kill_bill = next(t for t in parse_teams(FIXTURE) if t.team_id == "3")
    assert kill_bill.is_mine is False
    assert kill_bill.wins is None
    assert kill_bill.rank is None
    assert kill_bill.points_for is None
    assert kill_bill.manager_nickname == "Michael"


def test_parse_settings_scoring_and_roster():
    s = parse_settings(SETTINGS)
    assert s.league_key == "470.l.735658"
    assert s.season == 2026
    assert s.num_teams == 12
    assert s.slug == "people_can_eat"  # from persistent_url

    mods = s.scoring["stat_modifiers"]
    assert mods["rec"] == 0.5  # half-PPR
    assert mods["pass_yd"] == 0.04
    assert mods["pass_td"] == 4.0
    assert mods["pass_int"] == -2.0
    assert len(mods) == 9  # the 9 mapped stats; the K/DEF stat_id 49 is dropped
    assert s.scoring["fractional_points"] is True
    assert s.scoring["negative_points"] is True

    assert s.roster_positions["WR"] == 2
    assert s.roster_positions["BN"] == 6
    assert s.playoff_start_week == 15
    assert s.num_playoff_teams == 6
    assert s.waiver_type == "FAAB"  # uses_faab overrides the ordering type
    assert s.trade_deadline == "2026-11-28"


def test_parse_roster_slots_and_starters():
    r = parse_roster(ROSTER)
    assert r.team_key == "461.l.328209.t.10"
    assert r.week == 1
    by_id = {p.yahoo_player_id: p for p in r.players}
    # a real starter, a real flex start, a real bench, a real DST
    assert by_id["31002"].slot == "QB" and by_id["31002"].is_starter is True
    assert by_id["33398"].slot == "W/R/T" and by_id["33398"].is_starter is True
    assert by_id["28534"].slot == "BN" and by_id["28534"].is_starter is False
    assert by_id["100012"].slot == "DEF"  # DST parses; the crosswalk skips it later


def test_parse_matchups():
    sb = parse_matchups(SCOREBOARD)
    assert sb.league_key == "449.l.93367"
    assert sb.week == 1
    assert len(sb.matchups) == 2
    m = sb.matchups[0]
    assert m.team_a_key == "449.l.93367.t.1"
    assert m.team_a_points == 109.52
    assert m.team_b_key == "449.l.93367.t.11"
    assert m.team_b_points == 101.46
    assert m.is_playoff is False
