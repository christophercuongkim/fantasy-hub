"""Held-out backtest — does Layer 0 actually beat a dumber baseline?

The model spec's rule is that every layer must beat the one below it on
held-out data, or it doesn't ship (§0). Layer 0 (the recency-weighted EWMA) is
only worth keeping if it beats naive baselines, so this measures it against two:

- last_week    — predict this week = the most recent prior game's points
- trailing_mean — the unweighted mean of the same lookback window (no decay)

Beating trailing_mean is the real test: same games, same window — it isolates
whether the EWMA *weighting* helps at all.

For each player-week that has >= MIN_GAMES prior games (so all methods produce a
prediction) it compares each prediction to the player's ACTUAL league-scored
points that week, and reports MAE + RMSE per method. Reuses the projection
math + the league scoring so the backtest and the live model can't drift.
"""

from __future__ import annotations

from collections import defaultdict

from app.projection.baseline import (
    FANTASY_POS,
    LOOKBACK,
    MIN_GAMES,
    REG_SEASON_MAX_WEEK,
    _league_seasons,
    _season_glob,
    league,
    points_expr,
    weighted_projection,
)
from app.storage import duck


def _league_points(seasons: list[int]) -> list[dict]:
    """(gsis_id, season, week, pts) for regular-season games, each season scored
    with its OWN league scoring — the ground truth to score predictions against."""
    out: list[dict] = []
    for s in seasons:
        g = _season_glob(s)
        if not g:
            continue
        _, scoring = league(s)
        pts = points_expr(scoring)
        with duck.connect() as con:
            rows = con.execute(
                f"""
                SELECT player_id AS gsis_id, season, week, ({pts})::double AS pts
                FROM read_parquet('{g}')
                WHERE position IN {FANTASY_POS} AND week <= {REG_SEASON_MAX_WEEK}
                """
            ).fetchall()
        out += [
            {"gsis_id": r[0], "season": r[1], "week": r[2], "pts": float(r[3] or 0.0)}
            for r in rows
        ]
    return out


def score(games_by_player: dict[str, list[dict]]) -> dict:
    """Pure scoring loop (no I/O) so it's unit-testable. Each player's games are
    walked as targets; a target needs >= MIN_GAMES prior games in the lookback
    window, and its actual points are compared to each method's prediction."""
    sums = {  # method -> [abs_error_sum, sq_error_sum]
        "layer0": [0.0, 0.0],
        "last_week": [0.0, 0.0],
        "trailing_mean": [0.0, 0.0],
    }
    n = 0
    for games in games_by_player.values():
        ordered = sorted(games, key=lambda g: (g["season"], g["week"]))
        for i in range(len(ordered)):
            window = ordered[max(0, i - LOOKBACK) : i]
            if len(window) < MIN_GAMES:
                continue
            target = ordered[i]
            actual = target["pts"]
            proj = weighted_projection(window, target["season"])
            if proj is None:
                continue
            preds = {
                "layer0": proj[0],
                "last_week": window[-1]["pts"],  # most recent prior game
                "trailing_mean": sum(g["pts"] for g in window) / len(window),
            }
            for name, pred in preds.items():
                e = pred - actual
                sums[name][0] += abs(e)
                sums[name][1] += e * e
            n += 1

    if n == 0:
        return {"n": 0}
    result: dict = {"n": n}
    for name, (abs_sum, sq_sum) in sums.items():
        result[name] = {
            "mae": round(abs_sum / n, 3),
            "rmse": round((sq_sum / n) ** 0.5, 3),
        }
    result["layer0_beats"] = {
        "last_week": result["layer0"]["mae"] < result["last_week"]["mae"],
        "trailing_mean": result["layer0"]["mae"] < result["trailing_mean"]["mae"],
    }
    return result


def backtest(seasons: list[int] | None = None) -> dict:
    """Run the backtest over the given seasons (default: all league seasons with
    data). Synchronous — a few seconds over the cold tier."""
    seasons = seasons or _league_seasons()
    by_player: dict[str, list[dict]] = defaultdict(list)
    for r in _league_points(seasons):
        by_player[r["gsis_id"]].append(r)
    return {**score(by_player), "seasons": sorted(seasons)}
