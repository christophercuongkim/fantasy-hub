"""Layer 4 — Monte Carlo matchup win probability.

Samples each starter's score from its Layer 3 distribution (the per-position
residual-ratio shape scaled by the player's projected mean), sums a lineup, and
races two lineups N times to get P(win) + the margin distribution.

Sampling draws from the SAME shape L3 fit: a position's r20/r50/r80 ratios define
an inverse-CDF, so a draw is `ratio × mean` and the boom/bust skew is preserved.
Starters are sampled independently — real lineups have QB-WR stack + game-script
correlation that widens the spread; that's a known follow-up. Only projected
(skill) starters enter the sum; K/DST aren't modelled, so they're excluded (both
lineups equally), which lowers the absolute totals but barely moves the margin.
"""

from __future__ import annotations

import random

from app.projection.layer3 import RATIOS


def _ratio(r: dict[str, float], u: float) -> float:
    """Inverse-CDF of a position's residual ratio at quantile u, from its
    r20/r50/r80 anchors (piecewise-linear, tails extrapolated, floored at 0)."""
    r20, r50, r80 = r["r20"], r["r50"], r["r80"]
    if u <= 0.2:  # lower tail: extrapolate the 0.2→0.5 slope down, floor at 0
        return max(0.0, r20 - (r50 - r20) / 0.3 * (0.2 - u))
    if u < 0.5:
        return r20 + (r50 - r20) * (u - 0.2) / 0.3
    if u < 0.8:
        return r50 + (r80 - r50) * (u - 0.5) / 0.3
    return r80 + (r80 - r50) / 0.3 * (u - 0.8)  # upper tail: extrapolate up


def _sample(mean: float, position: str, rng: random.Random) -> float:
    """One score draw for a player. Unmodelled positions (no ratio curve) fall
    back to their deterministic mean."""
    r = RATIOS.get(position)
    if r is None:
        return mean
    return mean * _ratio(r, rng.random())


def _pct(sorted_vals: list[float], q: float) -> float:
    if not sorted_vals:
        return 0.0
    i = min(len(sorted_vals) - 1, int(q * len(sorted_vals)))
    return round(sorted_vals[i], 2)


def simulate_matchup(
    lineup_a: list[tuple[float, str]],
    lineup_b: list[tuple[float, str]],
    n: int = 10000,
    seed: int | None = None,
) -> dict:
    """lineup = [(mean, position), ...] for the STARTERS. Returns team A's win
    probability, each side's total distribution, and the margin (A − B)."""
    rng = random.Random(seed)
    a_tot, b_tot, margins, a_wins = [], [], [], 0
    for _ in range(n):
        a = sum(_sample(m, p, rng) for m, p in lineup_a)
        b = sum(_sample(m, p, rng) for m, p in lineup_b)
        a_tot.append(a)
        b_tot.append(b)
        margins.append(a - b)
        if a > b:
            a_wins += 1
    a_tot.sort()
    b_tot.sort()
    margins.sort()
    return {
        "win_prob": round(a_wins / n, 3),
        "a": {
            "p10": _pct(a_tot, 0.1),
            "median": _pct(a_tot, 0.5),
            "p90": _pct(a_tot, 0.9),
        },
        "b": {
            "p10": _pct(b_tot, 0.1),
            "median": _pct(b_tot, 0.5),
            "p90": _pct(b_tot, 0.9),
        },
        "margin": {
            "p10": _pct(margins, 0.1),
            "p50": _pct(margins, 0.5),
            "p90": _pct(margins, 0.9),
        },
    }


# --- data assembly (I/O): pull the real lineups + project the week's matchups ---


def _lineup(cur, league_id, season, week, league_team_id) -> list[tuple[float, str]]:
    """(mean, position) for a team's projected starters this week — rosters ⋈
    players ⋈ projections. K/DST starters have no projection row, so they drop
    out (the model doesn't score them)."""
    cur.execute(
        """
        SELECT pl.position, pr.mean::float
        FROM rosters r
        JOIN players pl ON pl.id = r.player_id
        JOIN projections pr ON pr.league_id = %s AND pr.player_id = r.player_id
             AND pr.season = %s AND pr.week = %s
        WHERE r.league_team_id = %s AND r.week = %s AND r.is_starter = true
        """,
        (league_id, season, week, league_team_id, week),
    )
    return [(float(m), pos) for pos, m in cur.fetchall()]


def sim_week(league_key: str, week: int, n: int = 10000) -> dict:
    """Win probability for every matchup in a league-week, from the real starting
    lineups + their projections. Includes the actual scores when the week's been
    played, for eyeballing."""
    from app.storage import postgres

    with postgres.connect() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT id, season FROM leagues WHERE yahoo_league_key = %s", (league_key,)
        )
        row = cur.fetchone()
        if not row:
            raise ValueError(f"no league for {league_key}")
        league_id, season = row
        cur.execute(
            """
            SELECT m.team_a_id, ta.name, ta.is_mine, m.team_b_id, tb.name, tb.is_mine,
                   m.team_a_score, m.team_b_score
            FROM matchups m
            JOIN league_teams ta ON ta.id = m.team_a_id
            JOIN league_teams tb ON tb.id = m.team_b_id
            WHERE m.league_id = %s AND m.week = %s
            """,
            (league_id, week),
        )
        rows = cur.fetchall()
        out: list[dict] = []
        for a_id, a_name, a_mine, b_id, b_name, b_mine, a_sc, b_sc in rows:
            la = _lineup(cur, league_id, season, week, a_id)
            lb = _lineup(cur, league_id, season, week, b_id)
            if not la or not lb:
                out.append(
                    {
                        "team_a": a_name,
                        "team_b": b_name,
                        "note": "no lineup/projections",
                    }
                )
                continue
            sim = simulate_matchup(la, lb, n=n, seed=week * 1000 + len(out))
            out.append(
                {
                    "team_a": a_name,
                    "team_b": b_name,
                    "is_mine": bool(a_mine or b_mine),
                    "starters_a": len(la),
                    "starters_b": len(lb),
                    "win_prob_a": sim["win_prob"],
                    "totals_a": sim["a"],
                    "totals_b": sim["b"],
                    "margin": sim["margin"],
                    "actual_a": float(a_sc) if a_sc is not None else None,
                    "actual_b": float(b_sc) if b_sc is not None else None,
                }
            )
    return {"league_key": league_key, "season": season, "week": week, "matchups": out}
