"""Layer 3 — distributions.

Layers 0-2 give a single number. Layer 3 turns Layer 1's point estimate (the
mean, mu) into a floor/median/ceiling — p20/p50/p80 + sd — which is what actually
drives start/sit and floor/ceiling calls.

Weekly fantasy scores are hard right-skewed (a floor near 0, a long TD-driven
upside tail), so rather than assume a parametric shape we take the per-position
EMPIRICAL quantiles of the residual ratio actual / layer1_projection and apply
them multiplicatively:

    p20 = mu * r20_pos     p50 = mu * r50_pos     p80 = mu * r80_pos
    sd  = mu * cv_pos

Multiplicative because a 20-point player has more absolute spread than a 5-point
one. Note p50 = mu * r50 is BELOW mu (the median of a right-skewed score sits
under the mean) — mu stays the mean, p50 is the median.

The ratios are fit only on player-weeks with mu >= MU_FLOOR (below that
actual/mu explodes into noise). This module holds the pure math; the fitted
per-position constants live in RATIOS once regenerated from `/jobs/backtest`
(the backtest fits + reports them, and reports calibration — coverage + pinball
loss — as the gate, since a distribution can't be judged by MAE).

Fit and evaluation here are IN-SAMPLE — three ratios per position is a tiny,
low-variance fit, so the optimism is negligible; the honest out-of-sample story
is a later refinement if the numbers warrant it.
"""

from __future__ import annotations

from collections import defaultdict
from statistics import pstdev

MU_FLOOR = 4.0  # don't fit ratios where the denominator (mu) is tiny
TAUS = (0.2, 0.5, 0.8)

# Per-position residual-ratio constants {pos: {r20, r50, r80, cv}}, fit from the
# `/jobs/backtest` layer3.ratios output (QA cold tier, seasons 2019-2025, fit
# n=24,093). Regenerate + re-commit these whenever MODEL_VERSION's point estimate
# changes. The backtest fits fresh ratios each run regardless; these are what the
# live project_week reads. QBs are tight (median ~0.95x mean); skill positions are
# boom/bust (median ~0.79x, ceiling ~1.5x, TE widest).
RATIOS: dict[str, dict[str, float]] = {
    "QB": {"r20": 0.498, "r50": 0.952, "r80": 1.434, "cv": 0.641},
    "RB": {"r20": 0.349, "r50": 0.798, "r80": 1.515, "cv": 0.799},
    "WR": {"r20": 0.316, "r50": 0.788, "r80": 1.535, "cv": 0.801},
    "TE": {"r20": 0.317, "r50": 0.778, "r80": 1.543, "cv": 0.823},
    # Kickers: Layer-0 EWMA mean vs actual, fit on the QA cold tier (kick-1,
    # 3,607 kicker-weeks). Boom/bust like skill positions — this league's
    # yardage-based FG scoring spikes on long-FG games.
    "K": {"r20": 0.4572, "r50": 0.889, "r80": 1.5002, "cv": 0.6636},
}


def _quantile(xs_sorted: list[float], q: float) -> float:
    """Linear-interpolated quantile of a pre-sorted list (numpy 'linear' method)."""
    if not xs_sorted:
        return 0.0
    if len(xs_sorted) == 1:
        return xs_sorted[0]
    pos = q * (len(xs_sorted) - 1)
    lo = int(pos)
    if lo + 1 >= len(xs_sorted):
        return xs_sorted[-1]
    return xs_sorted[lo] + (pos - lo) * (xs_sorted[lo + 1] - xs_sorted[lo])


def fit_ratios(samples: list[tuple[str, float, float]]) -> dict[str, dict[str, float]]:
    """samples = [(position, mu, actual)]. Returns {position: {r20, r50, r80, cv}}
    from the empirical distribution of actual/mu, over mu >= MU_FLOOR."""
    by_pos: dict[str, list[float]] = defaultdict(list)
    for pos, mu, actual in samples:
        if mu >= MU_FLOOR:
            by_pos[pos].append(actual / mu)
    out: dict[str, dict[str, float]] = {}
    for pos, ratios in by_pos.items():
        ratios.sort()
        out[pos] = {
            "r20": round(_quantile(ratios, 0.2), 4),
            "r50": round(_quantile(ratios, 0.5), 4),
            "r80": round(_quantile(ratios, 0.8), 4),
            "cv": round(pstdev(ratios), 4) if len(ratios) > 1 else 0.0,
        }
    return out


def distribution(mu: float, r: dict[str, float]) -> dict[str, float]:
    """Point estimate mu + a position's fitted ratios -> p20/p50/p80/sd."""
    return {
        "p20": round(mu * r["r20"], 2),
        "p50": round(mu * r["r50"], 2),
        "p80": round(mu * r["r80"], 2),
        "sd": round(mu * r["cv"], 2),
    }


def pinball(actual: float, q_pred: float, tau: float) -> float:
    """Quantile (pinball) loss — the proper scoring rule for a quantile forecast."""
    d = actual - q_pred
    return tau * d if d >= 0 else (tau - 1) * d


def evaluate(
    samples: list[tuple[str, float, float]], ratios: dict[str, dict[str, float]]
) -> dict:
    """Calibration of the fitted intervals over the samples: coverage (share of
    actuals inside [p20, p80], and in each tail) + mean pinball loss per tau."""
    within = below = above = 0
    pin = {t: 0.0 for t in TAUS}
    n = 0
    for pos, mu, actual in samples:
        r = ratios.get(pos)
        if r is None or mu < MU_FLOOR:
            continue
        d = distribution(mu, r)
        n += 1
        if actual < d["p20"]:
            below += 1
        elif actual > d["p80"]:
            above += 1
        else:
            within += 1
        pin[0.2] += pinball(actual, d["p20"], 0.2)
        pin[0.5] += pinball(actual, d["p50"], 0.5)
        pin[0.8] += pinball(actual, d["p80"], 0.8)
    if n == 0:
        return {"n": 0}
    return {
        "n": n,
        "coverage": {
            "within_20_80": round(within / n, 3),  # target ~0.60
            "below_p20": round(below / n, 3),  # target ~0.20
            "above_p80": round(above / n, 3),  # target ~0.20
        },
        "pinball": {str(t): round(pin[t] / n, 3) for t in TAUS},
        "pinball_avg": round(sum(pin.values()) / (len(TAUS) * n), 3),
    }
