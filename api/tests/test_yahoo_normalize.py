"""Normalizer tests against fixtures — run with no network. See cookbook §6."""

import json
from datetime import UTC
from pathlib import Path

from app.yahoo import normalize as nz
from app.yahoo import parse

FIXTURES = Path(__file__).parents[2] / "contracts" / "fixtures" / "yahoo"


def fixture(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text())


# --- generic helpers / coercion (cookbook §6 targets) --------------------- #
def test_iter_collection_skips_count_and_handles_empty():
    assert list(nz.iter_collection({"count": 0})) == []
    assert list(nz.iter_collection({})) == []
    assert list(nz.iter_collection(None)) == []
    assert list(nz.iter_collection({"0": "a", "1": "b", "count": 2})) == ["a", "b"]


def test_flatten_meta():
    assert nz.flatten_meta([{"a": 1}, {"b": 2}]) == {"a": 1, "b": 2}
    assert nz.flatten_meta({"a": 1}) == {"a": 1}


def test_coercions():
    assert nz.coerce_int("12") == 12
    assert nz.coerce_int("") is None
    assert nz.coerce_float("0.04") == 0.04
    assert nz.normalize_status(None) is None
    assert nz.normalize_status("Q") == "Q"
    assert nz.split_positions("WR,RB") == ["WR", "RB"]
    assert nz.split_positions("") == []


def test_eastern_to_utc():
    dt = nz.eastern_to_utc("2025-10-19T13:00:00")  # 1pm ET
    assert dt.tzinfo is UTC
    assert dt.hour == 17  # EDT -> UTC


# --- resource parsers ----------------------------------------------------- #
def test_parse_game():
    out = parse.parse_game(fixture("game_nfl.json"))
    assert out == {"game_key": "461", "season": 2025}


def test_parse_leagues():
    leagues = parse.parse_leagues(fixture("users_leagues.json"))
    assert len(leagues) == 1
    lg = leagues[0]
    assert lg.league_key == "461.l.123456"
    assert lg.num_teams == 12  # coerced from "12"
    assert lg.current_week == 7
    assert lg.is_finished is False


def test_parse_settings_scoring_and_roster():
    s = parse.parse_settings(fixture("league_settings.json"))
    assert s.league_key == "461.l.123456"
    # half-PPR must parse to 0.5 — reorders the whole board if wrong
    assert s.scoring["rec"] == 0.5
    assert s.scoring["pass_yd"] == 0.04
    assert s.scoring["pass_int"] == -1
    assert s.roster_positions["RB"] == 2
    assert s.roster_positions["W/R/T"] == 1
    assert s.playoff_start_week == 15
    assert s.num_playoff_teams == 6
    assert s.waiver_type == "FAAB"  # uses_faab=1
    assert s.trade_deadline == "2025-11-19"


def test_parse_roster():
    players = parse.parse_roster(fixture("team_roster_week7.json"))
    assert len(players) == 2
    qb = players[0]
    assert qb.yahoo_player_id == "31883"
    assert qb.name == "Patrick Mahomes"
    assert qb.team == "KC"
    assert qb.slot == "QB"
    assert qb.is_starter is True
    assert qb.status == "Q"
    bench = players[1]
    assert bench.slot == "BN"
    assert bench.is_starter is False
    assert bench.status is None  # null -> healthy


def test_parse_matchups():
    matchups = parse.parse_matchups(fixture("team_matchups_week7.json"))
    assert len(matchups) == 1
    m = matchups[0]
    assert m.week == 7
    assert m.is_playoffs is False
    assert len(m.teams) == 2
    assert m.teams[0].projected_points == 118.4
    assert m.teams[1].team_key == "461.l.123456.t.8"


def test_parse_free_agents_multiposition():
    fas = parse.parse_free_agents(fixture("league_players_fa.json"))
    assert len(fas) == 2
    assert fas[0].eligible_positions == ["WR", "RB"]
    assert fas[0].position == "WR"
    assert fas[0].slot is None
    assert fas[0].is_starter is False


def test_parse_draft_results():
    picks = parse.parse_draft_results(fixture("league_draftresults.json"))
    assert len(picks) == 2
    assert picks[0].pick == 1
    assert picks[0].round == 1
    assert picks[0].cost is None  # snake draft -> null, not 0
    assert picks[1].player_key == "461.p.31883"


def test_parse_player_stats():
    stats = parse.parse_player_stats(fixture("player_stats_week7.json"))
    assert len(stats) == 1
    st = stats[0]
    assert st.yahoo_player_id == "31883"
    assert st.stats["pass_yd"] == 312
    assert st.stats["pass_td"] == 3
    assert st.stats["pass_int"] == 1


def test_empty_and_missing_collections():
    # {"count": 0} and a missing collection both normalize to []
    empty_roster = {
        "fantasy_content": {"team": [[], {"roster": {"0": {"players": {"count": 0}}}}]}
    }
    assert parse.parse_roster(empty_roster) == []
    missing = {"fantasy_content": {"team": [[], {"roster": {"0": {}}}]}}
    assert parse.parse_roster(missing) == []
