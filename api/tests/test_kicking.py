"""Offline tests for the pbp->kicking aggregate + kicking scoring expression."""

import pandas as pd

from app.ingest.nflverse import _aggregate_kicking
from app.projection.baseline import KICKING_SCORING_COLUMNS, points_expr


def _row(**kw):
    base = {
        "kicker_player_id": None,
        "kicker_player_name": None,
        "posteam": None,
        "season": 2024,
        "week": 1,
        "field_goal_result": None,
        "kick_distance": None,
        "extra_point_result": None,
    }
    base.update(kw)
    return base


def test_aggregate_kicking_buckets_and_pats():
    df = pd.DataFrame(
        [
            # Kicker A, wk1: made 25 (20-29) + made 45 (40-49) + MISSED 55, 2 XP good
            _row(
                kicker_player_id="00-A",
                kicker_player_name="A.Kick",
                posteam="BUF",
                field_goal_result="made",
                kick_distance=25.0,
            ),
            _row(
                kicker_player_id="00-A",
                kicker_player_name="A.Kick",
                posteam="BUF",
                field_goal_result="made",
                kick_distance=45.0,
            ),
            _row(
                kicker_player_id="00-A",
                kicker_player_name="A.Kick",
                posteam="BUF",
                field_goal_result="missed",
                kick_distance=55.0,
            ),
            _row(kicker_player_id="00-A", posteam="BUF", extra_point_result="good"),
            _row(kicker_player_id="00-A", posteam="BUF", extra_point_result="good"),
            # Kicker B, wk1: PATs only (1 good, 1 failed), no FGs
            _row(
                kicker_player_id="00-B",
                kicker_player_name="B.Boot",
                posteam="KC",
                extra_point_result="good",
            ),
            _row(kicker_player_id="00-B", posteam="KC", extra_point_result="failed"),
            # a non-kicking play — ignored
            _row(kicker_player_id=None),
        ]
    )
    out = _aggregate_kicking(df).set_index("player_id")

    a = out.loc["00-A"]
    assert a["fgm_20_29"] == 1 and a["fgm_40_49"] == 1
    assert a["fgm_50"] == 0  # the 55-yarder was missed, not made
    assert a["fg_yds"] == 70.0  # 25 + 45 (misses don't count toward yards)
    assert a["pat_made"] == 2 and a["pat_miss"] == 0
    assert a["position"] == "K" and a["recent_team"] == "BUF"

    b = out.loc["00-B"]
    assert b["pat_made"] == 1 and b["pat_miss"] == 1
    assert b["fgm_20_29"] == 0 and b["fg_yds"] == 0

    assert None not in out.index  # the non-kicking play produced no row


def test_kicking_points_expr_uses_kicking_columns():
    expr = points_expr(
        {"fg_yds": 0.1, "fgm_40_49": -1.0, "pat_made": 1.0, "rush_td": 6.0},
        KICKING_SCORING_COLUMNS,
    )
    assert "(fg_yds * 0.1)" in expr
    assert "(fgm_40_49 * -1.0)" in expr
    assert "(pat_made * 1.0)" in expr
    assert "rush_td" not in expr  # offense keys aren't in the kicking map


def test_points_expr_empty_is_zero():
    assert points_expr({"pat_made": 0.0}, KICKING_SCORING_COLUMNS) == "0"
