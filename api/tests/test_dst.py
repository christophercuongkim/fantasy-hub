"""Offline tests for the pbp->team_defense aggregate + DST bracket scoring."""

import pandas as pd

from app.ingest.nflverse import _aggregate_team_defense
from app.projection.baseline import DST_SCORING_COLUMNS, dst_points_expr, points_expr


def _play(**kw):
    base = {
        "game_id": "G1",
        "season": 2024,
        "week": 1,
        "home_team": "BUF",
        "away_team": "MIA",
        "posteam": "MIA",
        "defteam": "BUF",
        "total_home_score": 20,
        "total_away_score": 13,
        "sack": 0,
        "interception": 0,
        "fumble_recovery_1_team": None,
        "safety": 0,
        "touchdown": 0,
        "td_team": None,
        "play_type": "pass",
        "punt_blocked": 0,
        "field_goal_result": None,
        "extra_point_result": None,
        "defensive_two_point_conv": 0,
    }
    base.update(kw)
    return base


def test_aggregate_team_defense_categories_and_points_allowed():
    df = pd.DataFrame(
        [
            _play(sack=1),
            _play(interception=1),
            _play(fumble_recovery_1_team="BUF"),  # BUF defense recovered
            _play(touchdown=1, td_team="BUF", play_type="pass"),  # pick-six (def TD)
            _play(touchdown=1, td_team="BUF", play_type="punt"),  # return TD
            _play(punt_blocked=1),
            _play(safety=1),
        ]
    )
    out = _aggregate_team_defense(df).set_index("player_id")
    buf = out.loc["DST-BUF"]
    assert buf["dst_sack"] == 1
    assert buf["dst_int"] == 1
    assert buf["dst_fum_rec"] == 1
    assert buf["dst_td"] == 1 and buf["dst_ret_td"] == 1  # split by play_type
    assert buf["dst_blk"] == 1
    assert buf["dst_safety"] == 1
    assert buf["position"] == "DST" and buf["recent_team"] == "BUF"
    # BUF is home; points allowed = MIA's (away) final score = 13
    assert buf["pts_allowed"] == 13


def test_dst_points_expr_additive_plus_bracket():
    scoring = {
        "dst_sack": 1.0,
        "dst_int": 2.0,
        "pa_0": 10.0,
        "pa_1_6": 7.0,
        "pa_7_13": 4.0,
        "pa_21_27": 0.0,  # a zero-valued middle tier must still be emitted
        "pa_35": -4.0,
    }
    expr = dst_points_expr(scoring)
    assert "(dst_sack * 1.0)" in expr
    assert "(dst_int * 2.0)" in expr
    # the bracket is a CASE, and the 0-valued 21-27 tier is present (so 24 pts
    # allowed doesn't fall through to a later tier)
    assert "CASE" in expr and "pts_allowed <= 27 THEN 0.0" in expr
    assert "ELSE -4.0 END" in expr


def test_dst_points_expr_no_brackets_is_additive_only():
    expr = dst_points_expr({"dst_sack": 1.0})
    assert expr == "(dst_sack * 1.0)"
    assert "CASE" not in expr


def test_dst_scoring_columns_are_all_additive():
    # pa_* keys are never additive columns (they drive the CASE, not a sum term)
    assert not any(k.startswith("pa_") for k in DST_SCORING_COLUMNS)
    assert points_expr({"pa_0": 10.0}, DST_SCORING_COLUMNS) == "0"
