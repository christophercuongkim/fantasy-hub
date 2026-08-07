"""Layer-0 baseline projection — recency-weighted mean of league-scored points.

The benchmark every richer layer must beat (model spec §1). For a target
(season, week) it reads raw player_stats (cold tier) via DuckDB, applies the
league's OWN scoring (leagues.scoring_json in Postgres) to each prior
player-week, then takes an EWMA over the most recent games:

    weight_j = lambda**j     (j = 1 is the most recent game)
    weight_j *= gamma        for a prior-season game
    mean = sum(weight * pts) / sum(weight)

lambda=0.85 (half-life ~4.3 games), <=8 games of lookback, >=3 required (fewer =>
no projection this slice; priors are a later layer), prior-season games
discounted by gamma=0.7. Byes/inactives are simply absent player_stats rows, so
they're excluded from the average rather than counted as zeros. A player whose
team is on bye in the TARGET week is zeroed (the is_playing=false => mean=0
bye-guard, asserted before write).

Writes projections_archive/season=/week=/part-0.parquet (cold tier; no Postgres
migration in this slice). Idempotent per (season, week).
"""

from __future__ import annotations

from datetime import UTC, datetime

import pandas as pd

from app.storage import duck, parquet, postgres

LAMBDA = 0.85
LOOKBACK = 8
MIN_GAMES = 3
PRIOR_SEASON_DISCOUNT = 0.7
MODEL_VERSION = "baseline-ewma-1"
FANTASY_POS = ("QB", "RB", "WR", "TE")

# league scoring_json key -> raw player_stats column expression (nflverse weekly).
# The `weekly` derived table drops fumbles/2pt, so we score the raw box score.
SCORING_COLUMNS: dict[str, str] = {
    "pass_yd": "passing_yards",
    "pass_td": "passing_tds",
    "pass_int": "interceptions",
    "rush_yd": "rushing_yards",
    "rush_td": "rushing_tds",
    "rec": "receptions",
    "rec_yd": "receiving_yards",
    "rec_td": "receiving_tds",
    "fum_lost": (
        "(coalesce(sack_fumbles_lost,0)+coalesce(rushing_fumbles_lost,0)"
        "+coalesce(receiving_fumbles_lost,0))"
    ),
    "two_pt": (
        "(coalesce(passing_2pt_conversions,0)+coalesce(rushing_2pt_conversions,0)"
        "+coalesce(receiving_2pt_conversions,0))"
    ),
    "ret_td": "coalesce(special_teams_tds,0)",
}


def league_scoring(season: int) -> dict[str, float]:
    """The league's stat_modifiers for a season (Postgres leagues.scoring_json)."""
    with postgres.connect() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT scoring_json FROM leagues WHERE season = %s "
            "ORDER BY created_at DESC LIMIT 1",
            (season,),
        )
        row = cur.fetchone()
    if not row:
        raise ValueError(f"no league scoring for season {season}")
    mods = (row[0] or {}).get("stat_modifiers") or {}
    return {k: float(v) for k, v in mods.items()}


def points_expr(scoring: dict[str, float]) -> str:
    """SQL expression for league fantasy points from player_stats columns.

    Scoring keys with no column mapping are skipped — a Layer-0 baseline over the
    mapped stats is close enough; the unmapped tail (e.g. return TDs on a
    non-ST player) is rare.
    """
    terms = [
        f"({SCORING_COLUMNS[k]} * {m})"
        for k, m in scoring.items()
        if k in SCORING_COLUMNS and m
    ]
    return " + ".join(terms) if terms else "0"


def weighted_projection(
    games: list[dict], target_season: int
) -> tuple[float, int] | None:
    """Recency-weighted mean of a player's prior league points.

    `games` is that player's history [{season, week, pts}, ...] in any order;
    sorting is handled here. Returns (mean, n_used) over the most recent LOOKBACK
    games, or None if fewer than MIN_GAMES are available.
    """
    recent = sorted(games, key=lambda g: (g["season"], g["week"]), reverse=True)[
        :LOOKBACK
    ]
    if len(recent) < MIN_GAMES:
        return None
    num = den = 0.0
    for j, g in enumerate(recent, start=1):
        w = LAMBDA**j
        if g["season"] < target_season:
            w *= PRIOR_SEASON_DISCOUNT
        num += w * g["pts"]
        den += w
    return num / den, len(recent)


def _season_glob(season: int) -> str | None:
    d = parquet.dataset_dir("player_stats", season=season)
    return f"{d}/*.parquet" if d.is_dir() and any(d.glob("*.parquet")) else None


def _teams_playing(con, season: int, week: int) -> set[str] | None:
    """Teams with a game in the target week (bye detection), or None if the
    schedule isn't ingested yet — then byes can't be zeroed."""
    d = parquet.dataset_dir("schedules", season=season)
    if not (d.is_dir() and any(d.glob("*.parquet"))):
        return None
    rows = con.execute(
        f"""
        SELECT home_team FROM read_parquet('{d}/*.parquet') WHERE week = {week}
        UNION
        SELECT away_team FROM read_parquet('{d}/*.parquet') WHERE week = {week}
        """
    ).fetchall()
    return {r[0] for r in rows if r[0]}


def project_week(season: int, week: int) -> dict:
    """Compute + persist Layer-0 projections for (season, week). Idempotent."""
    scoring = league_scoring(season)
    pts = points_expr(scoring)

    globs = [g for s in (season - 1, season) if (g := _season_glob(s))]
    if not globs:
        raise FileNotFoundError(
            f"player_stats not ingested for {season - 1}-{season} (run ingest first)"
        )
    srcs = "[" + ", ".join(f"'{g}'" for g in globs) + "]"

    with duck.connect() as con:
        rows = con.execute(
            f"""
            SELECT player_id AS gsis_id, player_display_name AS name, position,
                   recent_team AS team, season, week, ({pts})::double AS pts
            FROM read_parquet({srcs})
            WHERE position IN {FANTASY_POS}
              AND (season < {season} OR (season = {season} AND week < {week}))
            """
        ).fetchall()
        playing = _teams_playing(con, season, week)

        # group each player's prior games + track their most-recent team
        hist: dict[str, dict] = {}
        for gsis, name, position, team, s, w, p in rows:
            h = hist.setdefault(
                gsis,
                {"name": name, "position": position, "games": [], "last": (0, 0, None)},
            )
            h["games"].append({"season": s, "week": w, "pts": float(p or 0.0)})
            if (s, w) > (h["last"][0], h["last"][1]):
                h["last"] = (s, w, team)

        now = datetime.now(UTC).isoformat()
        records: list[dict] = []
        byes = 0
        for gsis, h in hist.items():
            proj = weighted_projection(h["games"], season)
            if proj is None:
                continue
            mean, n = proj
            team = h["last"][2]
            is_playing = playing is None or team in playing
            if not is_playing:
                mean = 0.0  # bye-guard
                byes += 1
            # bye-guard invariant, asserted before write (app logic, not a CHECK)
            assert is_playing or mean == 0.0
            records.append(
                {
                    "gsis_id": gsis,
                    "player_name": h["name"],
                    "position": h["position"],
                    "team": team,
                    "season": season,
                    "week": week,
                    "mean": round(mean, 2),
                    "n_games": n,
                    "is_playing": is_playing,
                    "model_version": MODEL_VERSION,
                    "generated_at": now,
                }
            )

        if not records:
            raise ValueError(f"no players with >= {MIN_GAMES} prior games")

        out = parquet.dataset_dir("projections_archive", season=season, week=week)
        out.mkdir(parents=True, exist_ok=True)
        for existing in out.glob("*.parquet"):  # overwrite (idempotent)
            existing.unlink()
        dst = out / "part-0.parquet"
        con.register("proj", pd.DataFrame(records))
        con.execute(f"COPY (SELECT * FROM proj) TO '{dst}' (FORMAT PARQUET)")

    return {
        "season": season,
        "week": week,
        "players": len(records),
        "byes_zeroed": byes,
        "model_version": MODEL_VERSION,
        "path": str(dst),
    }
