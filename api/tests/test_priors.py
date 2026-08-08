"""Offline tests for the draft-prior math (no Postgres / cold tier)."""

import math

import pytest

from app.projection import priors


def test_blend_fades_prior_as_games_arrive():
    # 0 games → pure prior; then a weighted mix; no prior → trust the observation.
    assert priors.blend(10.0, 0, 5.0) == 5.0
    assert priors.blend(10.0, 3, 4.0, k=3) == pytest.approx(7.0)  # (3·10+3·4)/6
    assert priors.blend(10.0, 2, None) == 10.0


def test_prior_ppg_decreasing_floored_and_unmapped():
    curve = {"WR": {"a": 20.0, "b": -3.0, "replacement": 5.0}}
    # decreasing in ADP…
    assert priors.prior_ppg("WR", 10, curve) > priors.prior_ppg("WR", 100, curve)
    # …floored at replacement for a deep pick…
    assert priors.prior_ppg("WR", 100_000, curve) == 5.0
    # …replacement when there's no ADP (undrafted)…
    assert priors.prior_ppg("WR", None, curve) == 5.0
    # …None for a position with no fitted curve.
    assert priors.prior_ppg("QB", 10, curve) is None


def test_fit_draft_curve_recovers_log_linear():
    # ppg = 20 - 2·ln(adp) exactly → OLS should recover a≈20, b≈-2.
    adps = [1, math.e, math.e**2, math.e**3]
    samples = [("WR", a, 20 - 2 * math.log(a)) for a in adps]
    c = priors.fit_draft_curve(samples)["WR"]
    assert c["a"] == pytest.approx(20.0, abs=0.01)
    assert c["b"] == pytest.approx(-2.0, abs=0.01)
    # replacement = 20th-percentile ppg of [14,16,18,20] = 15.2
    assert c["replacement"] == pytest.approx(15.2, abs=0.01)


def test_fit_single_sample_is_flat():
    c = priors.fit_draft_curve([("TE", 50, 8.0)])["TE"]
    assert c == {"a": 8.0, "b": 0.0, "replacement": 8.0}
