"""Layer 1 — volume × efficiency.

Layer 0 EWMAs points directly, so it inherits their noise (a 3-TD week looks
like skill). Layer 1 decomposes:

    points = opportunities × efficiency

Opportunities (targets / carries / attempts) are stable (lag-1 ~0.7-0.85) → EWMA
them. Efficiency (league points per opportunity) is noisy → regress it hard to
the positional mean so a lucky-TD week doesn't carry forward:

    eff = (n · player_eff + k · pos_eff) / (n + k)

with n = the player's opportunities in the window and k = K opportunities of
shrinkage. Not yet promoted to the live model — gated on beating Layer 0 on the
backtest.
"""

from __future__ import annotations

from app.projection.baseline import weighted_projection

K = 30  # efficiency shrinkage, in opportunities (mirrors the spec's TPRR k=40)

# position -> the opportunity count that generates its fantasy points.
# QB: pass attempts + designed/scramble carries. RB: carries + targets.
# WR/TE: targets. (DuckDB CASE over the raw player_stats columns.)
OPP_SQL = """
    CASE position
        WHEN 'QB' THEN coalesce(attempts, 0) + coalesce(carries, 0)
        WHEN 'RB' THEN coalesce(carries, 0) + coalesce(targets, 0)
        ELSE coalesce(targets, 0)
    END
"""


def layer1_projection(
    window: list[dict],
    target_season: int,
    position: str,
    pos_eff: dict[str, float],
    k: float = K,
) -> tuple[float, int] | None:
    """window = recent games [{season, week, pts, opp}]; pos_eff = {position:
    league-points-per-opportunity}. Returns (projected points, n games backing
    the volume EWMA) — mirroring weighted_projection's (mean, n) — or None if the
    volume EWMA can't be formed (too few games)."""
    vol = weighted_projection(
        [{"season": g["season"], "week": g["week"], "pts": g["opp"]} for g in window],
        target_season,
    )
    if vol is None:
        return None
    opp_proj, n_games = vol

    base = pos_eff.get(position, 0.0)
    opp = sum(g["opp"] for g in window)
    if opp > 0:
        player_eff = sum(g["pts"] for g in window) / opp
        eff = (opp * player_eff + k * base) / (opp + k)
    else:
        eff = base
    return opp_proj * eff, n_games
