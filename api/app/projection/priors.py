"""Draft-informed priors for players with too little history to project.

`weighted_projection` returns None under MIN_GAMES games, so rookies and thin-
history players get no projection at all. This fits, per position, an expected
per-game-points curve against draft ADP (overall, 1..N), so a drafted player's
prior is what players taken around his ADP have historically scored. The prior is
blended toward the player's own thin sample as games arrive; a positional
replacement level backs the undrafted / out-of-range case.

    ppg_hat(pos, adp) = max(a_pos + b_pos * ln(adp), replacement_pos)
    mean = (n * observed_ppg + k * ppg_hat) / (n + k)      # n = games so far

The curve is fit from history (drafted players' ADP vs the per-game points they
went on to score) and baked into DRAFT_CURVE from the /jobs/calibrate-priors run,
regenerated when scoring or the draft population changes — same posture as
layer3.RATIOS. The fit uses players with >= FIT_MIN_GAMES games so each ppg is
stable; that carries a mild survivorship bias (a high pick who busted via injury
contributes little), acceptable for a prior that fades as real games arrive.
"""

from __future__ import annotations

import math
from collections import defaultdict

BLEND_K = 3  # games of shrinkage toward the prior (mirrors MIN_GAMES)
FIT_MIN_GAMES = 4  # only fit the curve on players with a stable per-game sample

# {position: {"a": intercept, "b": ln(adp) slope, "replacement": floor ppg}}.
# Baked from /jobs/calibrate-priors; empty until slice 2b promotes it.
DRAFT_CURVE: dict[str, dict[str, float]] = {}


def _ols(pairs: list[tuple[float, float]]) -> tuple[float, float]:
    """Ordinary least squares slope + intercept for (x, y) pairs."""
    n = len(pairs)
    sx = sum(x for x, _ in pairs)
    sy = sum(y for _, y in pairs)
    sxx = sum(x * x for x, _ in pairs)
    sxy = sum(x * y for x, y in pairs)
    denom = n * sxx - sx * sx
    if denom == 0:
        return sy / n, 0.0
    b = (n * sxy - sx * sy) / denom
    a = (sy - b * sx) / n
    return a, b


def _percentile(sorted_vals: list[float], q: float) -> float:
    """Linear-interpolated quantile of a pre-sorted list."""
    if not sorted_vals:
        return 0.0
    if len(sorted_vals) == 1:
        return sorted_vals[0]
    pos = q * (len(sorted_vals) - 1)
    lo = int(pos)
    if lo + 1 >= len(sorted_vals):
        return sorted_vals[-1]
    return sorted_vals[lo] + (pos - lo) * (sorted_vals[lo + 1] - sorted_vals[lo])


def fit_draft_curve(
    samples: list[tuple[str, float, float]],
) -> dict[str, dict[str, float]]:
    """samples = [(position, adp, ppg)]. Per position: OLS of ppg on ln(adp) + a
    replacement floor (20th-percentile ppg). A position with < 2 samples gets a
    flat curve at its mean."""
    by_pos: dict[str, list[tuple[float, float]]] = defaultdict(list)
    for pos, adp, ppg in samples:
        if adp and adp > 0:
            by_pos[pos].append((math.log(adp), ppg))
    out: dict[str, dict[str, float]] = {}
    for pos, pairs in by_pos.items():
        ys = sorted(p for _, p in pairs)
        replacement = _percentile(ys, 0.20)
        if len(pairs) < 2:
            out[pos] = {
                "a": round(sum(ys) / len(ys), 4) if ys else 0.0,
                "b": 0.0,
                "replacement": round(replacement, 4),
            }
            continue
        a, b = _ols(pairs)
        out[pos] = {
            "a": round(a, 4),
            "b": round(b, 4),
            "replacement": round(replacement, 4),
        }
    return out


def prior_ppg(
    position: str, adp: float | None, curve: dict[str, dict[str, float]] | None = None
) -> float | None:
    """Expected per-game points for a `position` drafted at overall `adp`. None
    when the position has no fitted curve; the replacement floor when adp is
    missing (undrafted) or the curve would dip below it."""
    c = (curve if curve is not None else DRAFT_CURVE).get(position)
    if c is None:
        return None
    if adp and adp > 0:
        return max(c["a"] + c["b"] * math.log(adp), c["replacement"])
    return c["replacement"]


def blend(
    observed_ppg: float, n_games: int, prior: float | None, k: float = BLEND_K
) -> float:
    """Shrink a thin observed per-game sample toward the prior: 0 games → the
    prior; a few games → a weighted mix; the prior fades as games accumulate.
    Falls back to the observation when there's no prior (unmapped position)."""
    if prior is None:
        return observed_ppg
    if n_games <= 0:
        return prior
    return (n_games * observed_ppg + k * prior) / (n_games + k)


# --- calibration (I/O): fit the curve from history + report coverage ----------
# Draft picks + identity live in Postgres; per-game points in the Parquet cold
# tier — so the fit is a two-store join in Python, not one SQL statement.


def _ppg_by_player(seasons: list[int]) -> dict[tuple[int, str], tuple[int, float]]:
    """{(season, gsis_id): (games, ppg)} — games played + per-game league points,
    each season scored with its own league scoring."""
    from app.projection.baseline import (
        FANTASY_POS,
        REG_SEASON_MAX_WEEK,
        _season_glob,
        league,
        points_expr,
    )
    from app.storage import duck

    out: dict[tuple[int, str], tuple[int, float]] = {}
    for s in seasons:
        g = _season_glob(s)
        if not g:
            continue
        _, scoring = league(s)
        pts = points_expr(scoring)
        with duck.connect() as con:
            rows = con.execute(
                f"""
                SELECT player_id AS gsis_id, count(*) AS games,
                       avg(({pts})::double) AS ppg
                FROM read_parquet('{g}')
                WHERE position IN {FANTASY_POS} AND week <= {REG_SEASON_MAX_WEEK}
                GROUP BY player_id
                """
            ).fetchall()
        for gsis, games, ppg in rows:
            out[(s, gsis)] = (int(games), float(ppg or 0.0))
    return out


def _draft_adp(seasons: list[int]) -> list[tuple[int, str, str, float]]:
    """[(season, gsis_id, position, adp)] for resolved, ADP'd draft picks."""
    from app.projection.baseline import FANTASY_POS
    from app.storage import postgres

    with postgres.connect() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT dp.season, p.gsis_id, p.position, dp.adp_at_time
            FROM draft_picks dp JOIN players p ON p.id = dp.player_id
            WHERE dp.adp_at_time IS NOT NULL AND p.gsis_id IS NOT NULL
              AND dp.season = ANY(%s) AND p.position IN %s
            """,
            (list(seasons), tuple(FANTASY_POS)),
        )
        return [(int(s), g, pos, float(a)) for s, g, pos, a in cur.fetchall()]


def _fit_samples(seasons: list[int]) -> list[tuple[str, float, float]]:
    """(position, adp, ppg) for drafted players with a stable per-game sample."""
    ppg = _ppg_by_player(seasons)
    samples: list[tuple[str, float, float]] = []
    for season, gsis, pos, adp in _draft_adp(seasons):
        gp = ppg.get((season, gsis))
        if gp and gp[0] >= FIT_MIN_GAMES:
            samples.append((pos, adp, gp[1]))
    return samples


def _coverage(season: int) -> dict:
    """How many of this season's drafted players would get a prior — the point of
    the slice (players the current model projects nothing for)."""
    from app.projection.baseline import (
        FANTASY_POS,
        MIN_GAMES,
        REG_SEASON_MAX_WEEK,
        _season_glob,
        league,
    )
    from app.storage import duck, postgres

    league_id, _ = league(season)
    with postgres.connect() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT p.gsis_id, dp.adp_at_time
            FROM draft_picks dp JOIN players p ON p.id = dp.player_id
            WHERE dp.league_id = %s AND dp.season = %s AND p.gsis_id IS NOT NULL
            """,
            (league_id, season),
        )
        picks = cur.fetchall()

    games: dict[str, int] = {}
    g = _season_glob(season)
    if g:
        with duck.connect() as con:
            for gsis, n in con.execute(
                f"SELECT player_id, count(*) FROM read_parquet('{g}') "
                f"WHERE position IN {FANTASY_POS} AND week <= {REG_SEASON_MAX_WEEK} "
                f"GROUP BY player_id"
            ).fetchall():
                games[gsis] = int(n)

    under = [(gsis, adp) for gsis, adp in picks if games.get(gsis, 0) < MIN_GAMES]
    return {
        "season": season,
        "drafted_with_gsis": len(picks),
        "under_min_games": len(under),
        "with_adp": sum(1 for _, adp in under if adp is not None),
    }


def calibrate(seasons: list[int] | None = None) -> dict:
    """Fit the draft curve from history + report it, per-position sample counts,
    example priors at a few ADP anchors, and the current-season coverage. Paste
    the returned `curve` into DRAFT_CURVE to promote (slice 2b)."""
    from app.projection.baseline import _league_seasons

    seasons = seasons or _league_seasons()
    samples = _fit_samples(seasons)
    curve = fit_draft_curve(samples)

    counts: dict[str, int] = {}
    for pos, _, _ in samples:
        counts[pos] = counts.get(pos, 0) + 1
    examples = {
        pos: {
            str(a): round(prior_ppg(pos, a, curve) or 0.0, 2) for a in (5, 25, 75, 150)
        }
        for pos in curve
    }
    coverage = _coverage(seasons[-1]) if seasons else {}
    return {
        "seasons": sorted(seasons),
        "samples": len(samples),
        "samples_by_pos": counts,
        "curve": curve,
        "example_ppg": examples,
        "coverage": coverage,
    }
