"""Offline tests for the backtest scoring math (no cold tier / Postgres)."""

import pytest

from app.projection import backtest


def test_score_empty():
    assert backtest.score({}, {}, {})["n"] == 0


def test_positional_efficiency():
    rows = [
        {"position": "WR", "pts": 10.0, "opp": 5.0},
        {"position": "WR", "pts": 5.0, "opp": 5.0},  # WR: 15 pts / 10 opp = 1.5
        {"position": "RB", "pts": 8.0, "opp": 0.0},  # opp 0 → 0.0, no div-by-zero
    ]
    eff = backtest.positional_efficiency(rows)
    assert eff["WR"] == pytest.approx(1.5)
    assert eff["RB"] == 0.0


def test_score_gate_and_metrics():
    pos_eff = {"WR": 1.5}
    games_by_player = {
        # three prior games before the wk4 target → exactly one scored target.
        # window (wks 1-3): pts [0, 0, 20], opp [5, 5, 10]; actual (wk4) = 8.
        "A": {
            "position": "WR",
            "games": [
                {"season": 2024, "week": 1, "pts": 0.0, "opp": 5.0, "opponent": "X"},
                {"season": 2024, "week": 2, "pts": 0.0, "opp": 5.0, "opponent": "X"},
                {"season": 2024, "week": 3, "pts": 20.0, "opp": 10.0, "opponent": "X"},
                {"season": 2024, "week": 4, "pts": 8.0, "opp": 6.0, "opponent": "X"},
            ],
        },
        # only two games → never MIN_GAMES prior → contributes nothing.
        "B": {
            "position": "WR",
            "games": [
                {"season": 2024, "week": 1, "pts": 15.0, "opp": 8.0, "opponent": "X"},
                {"season": 2024, "week": 2, "pts": 15.0, "opp": 8.0, "opponent": "X"},
            ],
        },
    }
    # empty dvp → matchup multiplier is 1.0, so layer2 == layer1 (passthrough).
    r = backtest.score(games_by_player, pos_eff, {})

    assert r["n"] == 1  # B is gated out; A has one scorable target
    # points-based methods, unchanged from Layer 0's harness:
    assert r["layer0"]["mae"] == pytest.approx(0.226, abs=0.01)
    assert r["trailing_mean"]["mae"] == pytest.approx(1.333, abs=0.01)
    assert r["last_week"]["mae"] == pytest.approx(12.0, abs=0.01)
    # layer1: opp EWMA ≈ 6.944, eff = (20·1.0 + 30·1.5)/50 = 1.3 → ~9.03 vs 8
    assert r["layer1"]["mae"] == pytest.approx(1.027, abs=0.02)
    assert r["layer1_beats"] == {"layer0": False, "trailing_mean": True}
    assert r["layer2"]["mae"] == r["layer1"]["mae"]  # no matchup data → passthrough
    assert r["layer2_beats"] == {"layer1": False, "layer0": False}
    # layer3: the one scorable target (mu ~9.03 >= floor) yields one fitted sample.
    assert r["layer3"]["n"] == 1
    assert "WR" in r["layer3"]["ratios"]
