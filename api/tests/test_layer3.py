"""Offline tests for the Layer 3 distribution math (no cold tier)."""

import pytest

from app.projection import layer3


def test_quantile_linear_interpolation():
    xs = [0.0, 10.0]
    assert layer3._quantile(xs, 0.0) == 0.0
    assert layer3._quantile(xs, 1.0) == 10.0
    assert layer3._quantile(xs, 0.5) == pytest.approx(5.0)
    assert layer3._quantile([7.0], 0.2) == 7.0  # single value → itself
    assert layer3._quantile([], 0.5) == 0.0


def test_fit_ratios_drops_low_mu_and_computes_quantiles():
    # WR: mu=10, actuals 5/10/15 → ratios 0.5/1.0/1.5. A mu below the floor is
    # dropped (its wild ratio must not pollute the fit).
    samples = [
        ("WR", 10.0, 5.0),
        ("WR", 10.0, 10.0),
        ("WR", 10.0, 15.0),
        ("WR", 1.0, 100.0),  # mu < MU_FLOOR → excluded
    ]
    r = layer3.fit_ratios(samples)["WR"]
    assert r["r50"] == pytest.approx(1.0)
    assert r["r20"] == pytest.approx(0.7)  # linear q20 of [0.5,1.0,1.5]
    assert r["r80"] == pytest.approx(1.3)


def test_distribution_scales_mu_and_is_right_skewed():
    r = {"r20": 0.5, "r50": 0.9, "r80": 1.6, "cv": 0.4}
    d = layer3.distribution(10.0, r)
    assert d == {"p20": 5.0, "p50": 9.0, "p80": 16.0, "sd": 4.0}
    assert d["p50"] < 10.0 < d["p80"]  # median under the mean; ceiling above


def test_pinball_asymmetry():
    # τ=0.8 penalises under-prediction (actual above forecast) more than over.
    assert layer3.pinball(10.0, 8.0, 0.8) == pytest.approx(1.6)  # 0.8 * 2
    assert layer3.pinball(6.0, 8.0, 0.8) == pytest.approx(0.4)  # 0.2 * 2


def test_evaluate_coverage_and_perfect_pinball():
    # Two samples landing exactly on their p50 → within band, zero p50 pinball.
    r = {"r20": 0.5, "r50": 1.0, "r80": 1.5, "cv": 0.3}
    samples = [("WR", 10.0, 10.0), ("WR", 8.0, 8.0)]
    out = layer3.evaluate(samples, {"WR": r})
    assert out["n"] == 2
    assert out["coverage"]["within_20_80"] == 1.0
    assert out["pinball"]["0.5"] == 0.0

    # An actual above p80 lands in the upper tail.
    out2 = layer3.evaluate([("WR", 10.0, 99.0)], {"WR": r})
    assert out2["coverage"]["above_p80"] == 1.0
