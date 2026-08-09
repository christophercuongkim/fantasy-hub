"""Offline tests for the Monte Carlo matchup engine (no DB)."""

from app.projection import sim


def test_ratio_monotonic_and_floored():
    r = {"r20": 0.32, "r50": 0.79, "r80": 1.54}
    assert sim._ratio(r, 0.1) < sim._ratio(r, 0.5) < sim._ratio(r, 0.9)
    assert sim._ratio(r, 0.0) >= 0.0  # lower tail floored at 0


def test_identical_lineups_is_a_coinflip():
    lineup = [(15.0, "WR"), (18.0, "RB"), (22.0, "QB"), (12.0, "TE")]
    r = sim.simulate_matchup(lineup, list(lineup), n=4000, seed=1)
    assert 0.42 <= r["win_prob"] <= 0.58  # symmetric → ~50/50


def test_dominant_lineup_wins():
    strong = [(26.0, "QB"), (22.0, "RB"), (20.0, "WR"), (14.0, "TE")]
    weak = [(9.0, "QB"), (6.0, "RB"), (5.0, "WR"), (4.0, "TE")]
    r = sim.simulate_matchup(strong, weak, n=4000, seed=1)
    assert r["win_prob"] > 0.95
    assert r["a"]["median"] > r["b"]["median"]
    assert r["margin"]["p50"] > 0


def test_output_shape():
    r = sim.simulate_matchup([(15.0, "WR")], [(15.0, "WR")], n=1000, seed=2)
    assert set(r) == {"win_prob", "a", "b", "margin"}
    assert set(r["a"]) == {"p10", "median", "p90"}
    assert set(r["margin"]) == {"p10", "p50", "p90"}


def test_reproducible_with_seed():
    a, b = [(20.0, "RB")], [(18.0, "WR")]
    assert sim.simulate_matchup(a, b, n=2000, seed=7) == sim.simulate_matchup(
        a, b, n=2000, seed=7
    )
