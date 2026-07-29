"""Aggregate raw nflverse Parquet into the derived weekly tables (PR G).

DuckDB SQL over the cold tier, writing back to the cold tier — never Postgres
(the split rule: only the Python service reads these). Keyed on nflverse
`gsis_id`; the yahoo<->nflverse crosswalk is PR H.

Inputs   : player_stats (weekly box score), pbp, schedules  (per season)
Outputs  : weekly (stats_weekly), team (team_weekly), defense_vs_pos

Idempotent: each output season partition is overwritten.
"""

from app.storage import duck, parquet

# Fantasy-relevant offensive positions. Defensive/ST rows in player_stats are
# dropped — they'd pollute defense_vs_pos and aren't projected.
FANTASY_POS = ("QB", "RB", "WR", "TE")


def _src(dataset: str, season: int) -> str:
    """A read_parquet(...) call for one season's partition (raises if missing)."""
    d = parquet.dataset_dir(dataset, season=season)
    if not (d.is_dir() and any(d.glob("*.parquet"))):
        raise FileNotFoundError(
            f"{dataset} not ingested for {season} (run ingest first)"
        )
    return f"read_parquet('{d}/*.parquet')"


def _write(con, sql: str, dataset: str, season: int) -> int:
    out = parquet.dataset_dir(dataset, season=season)
    out.mkdir(parents=True, exist_ok=True)
    for existing in out.glob("*.parquet"):  # overwrite the season (idempotent)
        existing.unlink()
    dst = out / "part-0.parquet"
    con.execute(f"COPY ({sql}) TO '{dst}' (FORMAT PARQUET)")
    return con.execute(f"SELECT count(*) FROM read_parquet('{dst}')").fetchone()[0]


def _stats_weekly_sql(season: int) -> str:
    return f"""
        SELECT player_id AS gsis_id, player_display_name AS player_name,
               position, recent_team AS team, season, week, opponent_team,
               completions, attempts, passing_yards, passing_tds, interceptions,
               carries, rushing_yards, rushing_tds,
               targets, receptions, receiving_yards, receiving_tds,
               receiving_air_yards AS air_yards, target_share, air_yards_share,
               CASE WHEN targets > 0
                    THEN round(receiving_air_yards::double / targets, 2) END AS adot,
               fantasy_points_ppr
        FROM {_src("player_stats", season)}
        WHERE position IN {FANTASY_POS}
    """


def _defense_vs_pos_sql(season: int) -> str:
    # Fantasy points a defense allows to each position, per week. rank 1 = allows
    # the MOST = the best matchup to attack (data dictionary invariant).
    return f"""
        WITH allowed AS (
            SELECT opponent_team AS team, season, week, position,
                   round(sum(fantasy_points_ppr), 2) AS points_allowed,
                   sum(targets) AS targets_allowed,
                   count(*) AS players
            FROM {_src("player_stats", season)}
            WHERE position IN {FANTASY_POS} AND opponent_team IS NOT NULL
            GROUP BY 1, 2, 3, 4
        )
        SELECT *, rank() OVER (
            PARTITION BY season, week, position ORDER BY points_allowed DESC
        ) AS points_allowed_rank
        FROM allowed
    """


def _team_weekly_sql(season: int) -> str:
    # proe = pass rate over expected (actual dropback vs xpass), on plays where
    # the model gives an expectation. pace is a plays-per-game proxy for now.
    return f"""
        WITH plays AS (
            SELECT posteam AS team, season, week,
                   count(*) AS plays,
                   sum(pass) AS passes,
                   avg(CASE WHEN xpass IS NOT NULL THEN pass - xpass END) AS proe
            FROM {_src("pbp", season)}
            WHERE posteam IS NOT NULL AND play_type IN ('pass', 'run')
            GROUP BY 1, 2, 3
        ),
        pts AS (
            SELECT season, week, home_team AS team, home_score AS pf, away_score AS pa
            FROM {_src("schedules", season)}
            UNION ALL
            SELECT season, week, away_team AS team, away_score AS pf, home_score AS pa
            FROM {_src("schedules", season)}
        )
        SELECT p.team, p.season, p.week, p.plays,
               p.plays AS pace,
               round(p.passes::double / nullif(p.plays, 0), 3) AS pass_rate,
               round(p.proe, 3) AS proe,
               pts.pf AS points_for, pts.pa AS points_against
        FROM plays p
        LEFT JOIN pts
          ON pts.team = p.team AND pts.season = p.season AND pts.week = p.week
    """


def aggregate_season(season: int) -> dict:
    """Build weekly / team / defense_vs_pos for one season from the raw tables."""
    with duck.connect() as con:
        rows = {
            "weekly": _write(con, _stats_weekly_sql(season), "weekly", season),
            "team": _write(con, _team_weekly_sql(season), "team", season),
            "defense_vs_pos": _write(
                con, _defense_vs_pos_sql(season), "defense_vs_pos", season
            ),
        }
    return {"season": season, "rows": rows}
