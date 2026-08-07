"""Held-out backtest — does each layer beat the one below it?

The model spec's rule is that every layer must beat the one below on held-out
data, or it doesn't ship (§0). This compares, over historical player-weeks with
>= MIN_GAMES prior games (so every method produces a prediction on the same
population):

- last_week     — predict this week = the most recent prior game's points
- trailing_mean — unweighted mean of the lookback window (no decay)
- layer0        — the recency-weighted EWMA of points
- layer1        — volume × efficiency (EWMA opportunities × shrunk efficiency)
- layer2        — layer1 × the opponent matchup multiplier

Each is compared to the player's ACTUAL league-scored points that week; reports
MAE + RMSE per method, and the verdicts that matter (layer0 vs the flat mean,
layer1 vs layer0, layer2 vs layer1). Reuses the projection math + league scoring
so the backtest can't drift from the model.
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
from app.projection.layer1 import OPP_SQL, layer1_projection
from app.projection.layer2 import dvp_weeks, multiplier_for
from app.storage import duck


def _player_weeks(seasons: list[int]) -> list[dict]:
    """(gsis_id, position, opponent, season, week, pts, opp) for regular-season
    games, each season scored with its OWN league scoring — the ground truth, the
    volume, and the defense faced."""
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
                SELECT player_id AS gsis_id, position, opponent_team AS opponent,
                       season, week, ({pts})::double AS pts, ({OPP_SQL})::double AS opp
                FROM read_parquet('{g}')
                WHERE position IN {FANTASY_POS} AND week <= {REG_SEASON_MAX_WEEK}
                """
            ).fetchall()
        out += [
            {
                "gsis_id": r[0],
                "position": r[1],
                "opponent": r[2],
                "season": r[3],
                "week": r[4],
                "pts": float(r[5] or 0.0),
                "opp": float(r[6] or 0.0),
            }
            for r in rows
        ]
    return out


def positional_efficiency(rows: list[dict]) -> dict[str, float]:
    """Mean league-points-per-opportunity per position (pooled). A minor leak —
    it's a global constant, not player-specific — acceptable for a baseline."""
    agg: dict[str, list[float]] = defaultdict(lambda: [0.0, 0.0])
    for r in rows:
        a = agg[r["position"]]
        a[0] += r["pts"]
        a[1] += r["opp"]
    return {pos: (pt / opp if opp > 0 else 0.0) for pos, (pt, opp) in agg.items()}


def score(
    games_by_player: dict[str, dict], pos_eff: dict[str, float], dvp: dict
) -> dict:
    """Pure scoring loop (no I/O) so it's unit-testable. Each player's games are
    walked as targets; a target needs >= MIN_GAMES prior games in the window."""
    sums = {  # method -> [abs_error_sum, sq_error_sum]
        "layer0": [0.0, 0.0],
        "layer1": [0.0, 0.0],
        "layer2": [0.0, 0.0],
        "last_week": [0.0, 0.0],
        "trailing_mean": [0.0, 0.0],
    }
    n = 0
    for info in games_by_player.values():
        position = info["position"]
        ordered = sorted(info["games"], key=lambda g: (g["season"], g["week"]))
        for i in range(len(ordered)):
            window = ordered[max(0, i - LOOKBACK) : i]
            if len(window) < MIN_GAMES:
                continue
            target = ordered[i]
            actual = target["pts"]
            proj0 = weighted_projection(window, target["season"])
            if proj0 is None:
                continue
            proj1 = layer1_projection(window, target["season"], position, pos_eff)
            l1 = proj1[0] if proj1 is not None else proj0[0]
            mult = multiplier_for(
                dvp, position, target["opponent"], target["season"], target["week"]
            )
            preds = {
                "layer0": proj0[0],
                "layer1": l1,
                "layer2": l1 * mult,
                "last_week": window[-1]["pts"],
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
    result["layer1_beats"] = {
        "layer0": result["layer1"]["mae"] < result["layer0"]["mae"],
        "trailing_mean": result["layer1"]["mae"] < result["trailing_mean"]["mae"],
    }
    result["layer2_beats"] = {
        "layer1": result["layer2"]["mae"] < result["layer1"]["mae"],
        "layer0": result["layer2"]["mae"] < result["layer0"]["mae"],
    }
    return result


def backtest(seasons: list[int] | None = None) -> dict:
    """Run the backtest over the given seasons (default: all league seasons with
    data). Synchronous — a few seconds over the cold tier."""
    seasons = seasons or _league_seasons()
    rows = _player_weeks(seasons)
    pos_eff = positional_efficiency(rows)
    dvp = dvp_weeks(rows)
    by_player: dict[str, dict] = {}
    for r in rows:
        info = by_player.setdefault(
            r["gsis_id"], {"position": r["position"], "games": []}
        )
        info["games"].append(r)
    return {**score(by_player, pos_eff, dvp), "seasons": sorted(seasons)}
