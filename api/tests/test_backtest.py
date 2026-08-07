"""Offline tests for the backtest scoring math (no cold tier / Postgres)."""

import pytest

from app.projection import backtest


def test_score_empty():
    assert backtest.score({})["n"] == 0


def test_score_gate_and_metrics():
    games_by_player = {
        # three prior games before the wk4 target → exactly one scored target.
        # window = weeks 1-3 = [0, 0, 20]; actual (wk4) = 8.
        "A": [
            {"season": 2024, "week": 1, "pts": 0.0},
            {"season": 2024, "week": 2, "pts": 0.0},
            {"season": 2024, "week": 3, "pts": 20.0},
            {"season": 2024, "week": 4, "pts": 8.0},
        ],
        # only two games → never MIN_GAMES prior → contributes nothing.
        "B": [
            {"season": 2024, "week": 1, "pts": 15.0},
            {"season": 2024, "week": 2, "pts": 15.0},
        ],
    }
    r = backtest.score(games_by_player)

    assert r["n"] == 1  # B is gated out; A has one scorable target
    # layer0 weights the recent 20 (λ¹) over the two 0s → ~7.77 vs actual 8
    assert r["layer0"]["mae"] == pytest.approx(0.226, abs=0.01)
    # trailing mean = (0+0+20)/3 = 6.67
    assert r["trailing_mean"]["mae"] == pytest.approx(1.333, abs=0.01)
    # last week = the most recent prior game = 20
    assert r["last_week"]["mae"] == pytest.approx(12.0, abs=0.01)
    # here the recency weighting lands closest → it beats both naive baselines
    assert r["layer0_beats"] == {"last_week": True, "trailing_mean": True}
