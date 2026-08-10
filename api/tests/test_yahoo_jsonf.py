"""Offline tests for the Yahoo json_f parsers (no network / DB)."""

import json
from pathlib import Path

from app.yahoo.parse_jsonf import (
    parse_draftresults,
    parse_league,
    parse_matchups,
    parse_roster,
    parse_settings,
    parse_teams,
    parse_transactions,
)

_FIX = Path(__file__).parent / "fixtures"
FIXTURE = json.loads((_FIX / "teams_standings.json").read_text())
SETTINGS = json.loads((_FIX / "settings.json").read_text())
ROSTER = json.loads((_FIX / "roster.json").read_text())
SCOREBOARD = json.loads((_FIX / "scoreboard.json").read_text())
TRANSACTIONS = json.loads((_FIX / "transactions.json").read_text())


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
    assert mods["dst_ret_td"] == 6.0  # stat_id 49 (DST return TD) is now captured
    assert len(mods) == 10  # 9 offense + the DST return-TD key
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
    assert by_id["100012"].slot == "DEF"  # DST parses; links to a synthesized DST


def test_parse_draftresults():
    payload = {
        "fantasy_content": {
            "league": {
                "league_key": "470.l.735658",
                "draft_results": [
                    {
                        "draft_result": {
                            "pick": 1,
                            "round": 1,
                            "team_key": "470.l.735658.t.3",
                            "player_key": "470.p.100",
                            "cost": None,
                        }
                    },
                    {
                        "draft_result": {
                            "pick": 13,
                            "round": 2,
                            "team_key": "470.l.735658.t.7",
                            "player_key": "470.p.200",
                        }
                    },
                    # an unfilled slot in a predraft/partial board — skipped
                    {"draft_result": {"pick": "", "player_key": None}},
                ],
            }
        }
    }
    lk, picks = parse_draftresults(payload)
    assert lk == "470.l.735658"
    assert len(picks) == 2
    assert picks[0].pick == 1 and picks[0].player_key == "470.p.100"
    assert picks[1].round == 2 and picks[1].cost is None


def test_parse_draftresults_empty_predraft():
    payload = {"fantasy_content": {"league": {"league_key": "x", "draft_results": []}}}
    lk, picks = parse_draftresults(payload)
    assert lk == "x" and picks == []


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


def test_parse_transactions():
    league_key, moves = parse_transactions(TRANSACTIONS)
    assert league_key == "449.l.93367"
    assert len(moves) == 2  # an add/drop = two movements
    add = next(m for m in moves if m.destination_type == "team")
    assert add.yahoo_player_id == "40890"  # Legette, added off free agents
    assert add.type == "add_drop"  # "add/drop" normalized
    assert add.destination_team_key == "449.l.93367.t.6"
    assert add.source_type == "freeagents"
    assert add.executed_at == 1735431545
    drop = next(m for m in moves if m.destination_type == "waivers")
    assert drop.yahoo_player_id == "34088"  # Doubs, dropped to waivers
    assert drop.source_team_key == "449.l.93367.t.6"
