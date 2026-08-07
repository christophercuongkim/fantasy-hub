"""Layer 2 — matchup context.

Layer 1 projects a player from his own volume + efficiency; it's blind to *who
he plays this week*. Layer 2 scales that projection by how much the upcoming
opponent gives up to his position, relative to a league-average defense:

    layer2_points = layer1_points × matchup_multiplier

The multiplier is the opponent defense's points-allowed-to-position rate over its
prior weeks divided by the league-average rate, shrunk toward 1.0 by DVP_K
defense-weeks so a small-sample defense can't swing a projection. No prior data
(e.g. week 1) → multiplier 1.0, i.e. Layer 1 passes through untouched.

The rate is aggregate points a defense allows to a whole position group per week;
it's used only as a *ratio* (opponent vs. league), so it's scale-free — the
league's scoring system cancels, and Layer 1's absolute points carry the units.

STATUS — SHELVED, NOT SHIPPED (backtest 2026-08-07, n=33,561, 2019-2025).
Layer 2 scored MAE 4.521 / RMSE 6.122 vs Layer 1's 4.505 / 6.096 — it beats
Layer 0 but LOSES to Layer 1, so per model-spec §0 it does not ship. Tuning
DVP_K can't rescue it: more shrinkage only pulls the multiplier toward 1.0, i.e.
toward *being* Layer 1, so no k makes it beat Layer 1, only converge to it. The
real defect is the signal, not the knob: raw DvP is confounded by schedule (a
defense looks "generous to WRs" partly because it FACED good WRs), so the ratio
carries more schedule noise than matchup signal. A matchup layer that clears the
bar needs a de-confounded signal — opponent-adjusted DvP, points-allowed *per
opportunity*, or a defense rating regressed against expectation — future work.
The math + the backtest's layer2 scoring are kept as scaffolding for that.
"""

from __future__ import annotations

from collections import defaultdict

DVP_K = 4  # defense-weeks of shrinkage toward the league-average defense


def matchup_multiplier(
    def_weeks: list[float], league_weeks: list[float], k: float = DVP_K
) -> float:
    """def_weeks = the opponent's per-week points allowed to the position (prior
    to the target week); league_weeks = every defense's per-week points allowed
    to that position over the same span. Returns the shrunk matchup factor, or
    1.0 when there's no league signal yet."""
    if not league_weeks:
        return 1.0
    league_avg = sum(league_weeks) / len(league_weeks)
    if league_avg <= 0:
        return 1.0
    n_d = len(def_weeks)
    d_opp = sum(def_weeks) / n_d if n_d else league_avg
    d_adj = (n_d * d_opp + k * league_avg) / (n_d + k)
    return d_adj / league_avg


def dvp_weeks(rows: list[dict]) -> dict[str, dict[str, dict[tuple[int, int], float]]]:
    """rows: [{position, opponent, season, week, pts}]. Returns
    {position: {defense: {(season, week): points_allowed}}} — the fantasy points a
    defense allowed to a position in a week, summed over that position's players.
    Rows with no opponent are skipped."""
    agg: dict[str, dict[str, dict[tuple[int, int], float]]] = defaultdict(
        lambda: defaultdict(lambda: defaultdict(float))
    )
    for r in rows:
        opp = r.get("opponent")
        if not opp:
            continue
        agg[r["position"]][opp][(r["season"], r["week"])] += r["pts"]
    return agg


def multiplier_for(
    dvp: dict,
    position: str,
    defense: str | None,
    season: int,
    before_week: int,
    k: float = DVP_K,
) -> float:
    """Matchup factor for a player of `position` facing `defense` in (season,
    before_week), from prior weeks of the SAME season only (no leak). 1.0 when
    the defense is unknown or there's no prior data."""
    pos = dvp.get(position)
    if not pos or not defense:
        return 1.0

    def prior(weeks_map: dict[tuple[int, int], float]) -> list[float]:
        return [v for (s, w), v in weeks_map.items() if s == season and w < before_week]

    league_weeks = [v for wm in pos.values() for v in prior(wm)]
    def_weeks = prior(pos.get(defense, {}))
    return matchup_multiplier(def_weeks, league_weeks, k)
