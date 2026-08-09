"""Offline tests for the pbp pick-six aggregate + its scoring mapping."""

import pandas as pd

from app.ingest.nflverse import _aggregate_pass_pbp
from app.projection.baseline import points_expr


def _play(**kw):
    base = {
        "passer_player_id": "00-QB",
        "season": 2024,
        "week": 1,
        "interception": 0,
        "touchdown": 0,
        "td_team": None,
        "defteam": "BUF",
        "posteam": "MIA",
    }
    base.update(kw)
    return base


def test_aggregate_pass_pbp_counts_pick_sixes():
    df = pd.DataFrame(
        [
            # a pick-six: INT returned for a defensive TD, charged to the passer
            _play(interception=1, touchdown=1, td_team="BUF"),
            # a plain INT (no TD) — not a pick-six
            _play(interception=1, touchdown=0),
            # a passing TD (offense scored) — not a pick-six
            _play(touchdown=1, td_team="MIA"),
            # a second pick-six, different week
            _play(week=2, interception=1, touchdown=1, td_team="BUF"),
            # an INT return TD with no identified passer — dropped
            _play(passer_player_id=None, interception=1, touchdown=1, td_team="BUF"),
        ]
    )
    out = _aggregate_pass_pbp(df)
    assert set(out.columns) == {"player_id", "season", "week", "pick_six"}
    by_week = {(r.player_id, r.week): r.pick_six for r in out.itertuples()}
    assert by_week == {("00-QB", 1): 1, ("00-QB", 2): 1}  # one each week, no dupes


def test_pick_six_scores_from_joined_column():
    # pick_six maps to the LEFT JOINed pass_pbp column (alias px), coalesced to 0
    e = points_expr({"pass_td": 4.0, "pick_six": -2.0})
    assert "(passing_tds * 4.0)" in e
    assert "(coalesce(px.pick_six,0) * -2.0)" in e
