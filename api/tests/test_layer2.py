"""Offline tests for the Layer 2 matchup math (no cold tier)."""

import pytest

from app.projection import layer2


def test_multiplier_no_signal():
    # no league data yet → neutral 1.0
    assert layer2.matchup_multiplier([], []) == 1.0
    # league average of zero (degenerate) → neutral 1.0
    assert layer2.matchup_multiplier([5.0], [0.0, 0.0]) == 1.0


def test_multiplier_shrinks_toward_league():
    # defense allows 20/wk over 2 wks vs a league that allows 10/wk; k=4.
    # d_adj = (2·20 + 4·10)/(2+4) = 13.333 → mult 1.333 (not the raw 2.0).
    m = layer2.matchup_multiplier([20.0, 20.0], [10.0, 10.0, 10.0, 10.0], k=4)
    assert m == pytest.approx(1.3333, abs=0.001)


def test_multiplier_no_defense_data_is_neutral():
    # league has data but this defense hasn't been seen → d_opp = league_avg → 1.0
    assert layer2.matchup_multiplier([], [10.0, 10.0]) == pytest.approx(1.0)


def test_multiplier_for_uses_prior_same_season_only():
    rows = [
        # target season, prior weeks: WR points allowed by D (12/wk) and E (6/wk)
        {"position": "WR", "opponent": "D", "season": 2024, "week": 1, "pts": 12.0},
        {"position": "WR", "opponent": "D", "season": 2024, "week": 2, "pts": 12.0},
        {"position": "WR", "opponent": "D", "season": 2024, "week": 3, "pts": 12.0},
        {"position": "WR", "opponent": "E", "season": 2024, "week": 1, "pts": 6.0},
        {"position": "WR", "opponent": "E", "season": 2024, "week": 2, "pts": 6.0},
        {"position": "WR", "opponent": "E", "season": 2024, "week": 3, "pts": 6.0},
        # a future week + a prior season → must be excluded from the target-wk4 calc
        {"position": "WR", "opponent": "D", "season": 2024, "week": 5, "pts": 99.0},
        {"position": "WR", "opponent": "D", "season": 2023, "week": 1, "pts": 99.0},
    ]
    dvp = layer2.dvp_weeks(rows)
    # league avg = mean([12,12,12,6,6,6]) = 9; D d_opp = 12, n=3, k=4:
    # d_adj = (3·12 + 4·9)/7 = 10.2857 → mult = 1.1429
    m = layer2.multiplier_for(dvp, "WR", "D", season=2024, before_week=4, k=4)
    assert m == pytest.approx(1.1429, abs=0.001)
    # unknown defense / position → neutral
    assert layer2.multiplier_for(dvp, "WR", "ZZ", 2024, 4) == 1.0
    assert layer2.multiplier_for(dvp, "QB", "D", 2024, 4) == 1.0


def test_dvp_weeks_skips_missing_opponent():
    rows = [
        {"position": "WR", "opponent": None, "season": 2024, "week": 1, "pts": 5.0},
        {"position": "WR", "opponent": "D", "season": 2024, "week": 1, "pts": 5.0},
    ]
    dvp = layer2.dvp_weeks(rows)
    assert list(dvp["WR"].keys()) == ["D"]
