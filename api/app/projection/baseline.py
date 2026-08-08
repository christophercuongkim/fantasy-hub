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

Writes both the Parquet archive (projections_archive/season=/week=/, keyed on
gsis_id — model-version history) and the live Postgres `projections` table the
web reads (keyed on players.id). Idempotent per (league, season, week).
"""

from __future__ import annotations

from datetime import UTC, datetime

import pandas as pd

from app.storage import duck, parquet, postgres

LAMBDA = 0.85
LOOKBACK = 8
MIN_GAMES = 3
PRIOR_SEASON_DISCOUNT = 0.7
MODEL_VERSION = "layer3-dist-1"
FANTASY_POS = ("QB", "RB", "WR", "TE")
SEASON_FLOOR = 2019  # nflverse data floor (mirrors ingest.nflverse.MIN_SEASON)

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


def league(season: int) -> tuple[str, dict[str, float]]:
    """The league (id + stat_modifiers) for a season, from Postgres. One league
    today; a second one is distinguished by this id once it lands, since a
    projection is scoring-specific."""
    with postgres.connect() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT id, scoring_json FROM leagues WHERE season = %s "
            "ORDER BY updated_at DESC LIMIT 1",
            (season,),
        )
        row = cur.fetchone()
    if not row:
        raise ValueError(f"no league for season {season}")
    league_id, sj = row
    mods = (sj or {}).get("stat_modifiers") or {}
    return str(league_id), {k: float(v) for k, v in mods.items()}


_PG_COLUMNS = (
    "league_id",
    "player_id",
    "season",
    "week",
    "mean",
    "p20",
    "p50",
    "p80",
    "sd",
    "is_playing",
    "model_version",
    "generated_at",
)


def _player_map(cur, gsis_ids: list[str]) -> dict[str, str]:
    """gsis_id -> players.id (UUID). Unmatched ids are simply absent."""
    if not gsis_ids:
        return {}
    cur.execute("SELECT gsis_id, id FROM players WHERE gsis_id = ANY(%s)", (gsis_ids,))
    return {g: str(i) for g, i in cur.fetchall()}


def _write_postgres(records: list[dict], league_id: str, season: int, week: int) -> int:
    """Upsert the live projections into Postgres: delete the (league, season,
    week) slice, then batch-COPY. Rows whose gsis_id has no players row are
    skipped (nflverse players not in our registry). Returns the rows written."""
    with postgres.connect() as conn, conn.cursor() as cur:
        ids = _player_map(cur, [r["gsis_id"] for r in records])
        rows = [
            (
                league_id,
                ids[r["gsis_id"]],
                season,
                week,
                r["mean"],
                r["p20"],
                r["p50"],
                r["p80"],
                r["sd"],
                r["is_playing"],
                r["model_version"],
                r["generated_at"],
            )
            for r in records
            if r["gsis_id"] in ids
        ]
        cur.execute(
            "DELETE FROM projections "
            "WHERE league_id = %s AND season = %s AND week = %s",
            (league_id, season, week),
        )
        postgres.copy_rows(conn, "projections", _PG_COLUMNS, rows)
    return len(rows)


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
    """Compute + persist projections for (season, week). Idempotent.

    Runs the current model stack — Layer 1 volume×efficiency mean, wrapped in the
    Layer 3 fitted distribution (p20/p50/p80/sd). Writes both the Parquet archive
    (keyed on gsis_id; model-version history) and the live Postgres `projections`
    table the web reads (keyed on players.id)."""
    # Local import breaks the baseline<->layer1 cycle (layer1 imports the EWMA
    # from this module); by call time both modules are fully loaded.
    from app.projection import layer3
    from app.projection.layer1 import OPP_SQL, layer1_projection

    league_id, scoring = league(season)
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
                   recent_team AS team, season, week, ({pts})::double AS pts,
                   ({OPP_SQL})::double AS opp
            FROM read_parquet({srcs})
            WHERE position IN {FANTASY_POS}
              AND (season < {season} OR (season = {season} AND week < {week}))
            """
        ).fetchall()
        playing = _teams_playing(con, season, week)

        # group each player's prior games + track their most-recent team;
        # accumulate pooled per-position opportunity + points for the shrink
        # target (all rows here are strictly prior to the target week → no leak).
        hist: dict[str, dict] = {}
        pos_pts: dict[str, float] = {}
        pos_opp: dict[str, float] = {}
        for gsis, name, position, team, s, w, p, o in rows:
            h = hist.setdefault(
                gsis,
                {"name": name, "position": position, "games": [], "last": (0, 0, None)},
            )
            pf, of = float(p or 0.0), float(o or 0.0)
            h["games"].append({"season": s, "week": w, "pts": pf, "opp": of})
            if (s, w) > (h["last"][0], h["last"][1]):
                h["last"] = (s, w, team)
            pos_pts[position] = pos_pts.get(position, 0.0) + pf
            pos_opp[position] = pos_opp.get(position, 0.0) + of

        pos_eff = {
            pos: (pos_pts[pos] / opp if opp > 0 else 0.0)
            for pos, opp in pos_opp.items()
        }

        now = datetime.now(UTC).isoformat()
        records: list[dict] = []
        byes = 0
        for gsis, h in hist.items():
            proj = layer1_projection(h["games"], season, h["position"], pos_eff)
            if proj is None:
                continue
            mean, n = proj
            team = h["last"][2]
            is_playing = playing is None or team in playing
            # Layer 3: fitted floor/median/ceiling around the mean. On a bye the
            # whole distribution collapses to 0 alongside the mean bye-guard.
            ratios = layer3.RATIOS.get(h["position"])
            if not is_playing:
                mean = 0.0  # bye-guard
                byes += 1
                dist = {"p20": 0.0, "p50": 0.0, "p80": 0.0, "sd": 0.0}
            elif ratios:
                dist = layer3.distribution(mean, ratios)
            else:  # unmapped position → mean only, intervals left null
                dist = {"p20": None, "p50": None, "p80": None, "sd": None}
            # bye-guard invariant, asserted before write (app logic, not a CHECK)
            assert is_playing or mean == 0.0
            records.append(
                {
                    "league_id": league_id,
                    "gsis_id": gsis,
                    "player_name": h["name"],
                    "position": h["position"],
                    "team": team,
                    "season": season,
                    "week": week,
                    "mean": round(mean, 2),
                    "p20": dist["p20"],
                    "p50": dist["p50"],
                    "p80": dist["p80"],
                    "sd": dist["sd"],
                    "n_games": n,
                    "is_playing": is_playing,
                    "model_version": MODEL_VERSION,
                    "generated_at": now,
                }
            )

        if not records:
            # Legitimately nothing to project (e.g. early weeks of the floor
            # season — no prior games). Not an error; a 0-player result.
            return {
                "season": season,
                "week": week,
                "league_id": league_id,
                "players": 0,
                "byes_zeroed": 0,
                "postgres_rows": 0,
                "model_version": MODEL_VERSION,
                "path": None,
            }

        out = parquet.dataset_dir("projections_archive", season=season, week=week)
        out.mkdir(parents=True, exist_ok=True)
        for existing in out.glob("*.parquet"):  # overwrite (idempotent)
            existing.unlink()
        dst = out / "part-0.parquet"
        con.register("proj", pd.DataFrame(records))
        con.execute(f"COPY (SELECT * FROM proj) TO '{dst}' (FORMAT PARQUET)")

    written = _write_postgres(records, league_id, season, week)

    return {
        "season": season,
        "week": week,
        "league_id": league_id,
        "players": len(records),
        "byes_zeroed": byes,
        "postgres_rows": written,
        "model_version": MODEL_VERSION,
        "path": str(dst),
    }


def _league_seasons() -> list[int]:
    """Distinct league seasons we can project (>= the nflverse data floor)."""
    with postgres.connect() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT DISTINCT season FROM leagues WHERE season >= %s ORDER BY season",
            (SEASON_FLOOR,),
        )
        return [int(r[0]) for r in cur.fetchall()]


# Regular season only — fantasy doesn't project the NFL playoffs (weeks 19-22),
# and projecting them makes the "latest week" default the Super Bowl.
REG_SEASON_MAX_WEEK = 18


def _weeks_with_data(season: int) -> list[int]:
    g = _season_glob(season)
    if not g:
        return []
    with duck.connect() as con:
        rows = con.execute(
            f"SELECT DISTINCT week FROM read_parquet('{g}') "
            f"WHERE week <= {REG_SEASON_MAX_WEEK} ORDER BY week"
        ).fetchall()
    return [int(r[0]) for r in rows]


def current_season() -> int | None:
    """The latest league season — the one a weekly refresh targets."""
    seasons = _league_seasons()
    return seasons[-1] if seasons else None


def current_week(season: int) -> int | None:
    """The next regular-season week to project: the earliest week (<= 18) with a
    game today or later, from the ingested schedule. None once the regular season
    is complete (the offseason) or the schedule isn't ingested — a weekly cron
    then simply no-ops. Uses the DB's current_date so it self-advances."""
    d = parquet.dataset_dir("schedules", season=season)
    if not (d.is_dir() and any(d.glob("*.parquet"))):
        return None
    with duck.connect() as con:
        row = con.execute(
            f"""
            SELECT min(week) FROM read_parquet('{d}/*.parquet')
            WHERE week <= {REG_SEASON_MAX_WEEK}
              AND CAST(gameday AS DATE) >= current_date
            """
        ).fetchone()
    return int(row[0]) if row and row[0] is not None else None


def refresh_current() -> dict:
    """Resolve the current NFL week and project it — the weekly cron's work in one
    call, shared by the HTTP endpoint and `python -m app.refresh_current`.
    Force-ingests the season's inputs first so the schedule + stats are fresh."""
    from app.ingest import nflverse

    season = current_season()
    if season is None:
        return {"status": "no_league_seasons"}
    ingested = nflverse.ingest_season(season, ["player_stats", "schedules"], force=True)
    week = current_week(season)
    if week is None:
        return {"status": "offseason", "season": season, "ingested": ingested}
    projected = project_week(season, week)
    return {
        "status": "projected",
        "season": season,
        "week": week,
        "ingested": ingested,
        "projected": projected,
    }


def _projected_weeks(league_id: str, season: int) -> set[int]:
    """Weeks already stored for the CURRENT model — skipped on re-runs. A model
    bump changes MODEL_VERSION, so nothing matches and everything re-projects."""
    with postgres.connect() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT DISTINCT week FROM projections "
            "WHERE league_id = %s AND season = %s AND model_version = %s",
            (league_id, season, MODEL_VERSION),
        )
        return {int(r[0]) for r in cur.fetchall()}


# Live status for the fire-and-forget backfill so the UI can show progress +
# auto-refresh when it finishes. Module-level = one uvicorn worker (the deploy
# runs a single worker); across workers this would need shared state.
_STATUS: dict = {
    "running": False,
    "started_at": None,
    "finished_at": None,
    "seasons_done": 0,
    "weeks_done": 0,
    "errors": [],  # per-week failures (capped) — makes a 0-week run diagnosable
    "error": None,  # a top-level failure that aborted the whole run
}
_ERROR_CAP = 10


def backfill_status() -> dict:
    return {**_STATUS, "errors": list(_STATUS["errors"])}


def backfill_all() -> dict:
    """Ingest every league season (player_stats + schedules) then project every
    week that has data. Long-running — intended to run in the background. A
    failing week is recorded and skipped so one bad week can't abort the run.
    Updates _STATUS as it goes for the progress poll."""
    import logging

    from app.ingest import nflverse

    log = logging.getLogger("uvicorn.error")
    _STATUS.update(
        running=True,
        started_at=datetime.now(UTC).isoformat(),
        finished_at=None,
        seasons_done=0,
        weeks_done=0,
        error=None,
    )
    _STATUS["errors"] = []
    try:
        seasons = _league_seasons()
        # Only the latest season still gains weeks → force-re-pull it; older
        # seasons skip ingest if their Parquet is already present. And skip any
        # week already projected for this model, so completed seasons fall
        # through and the current season only projects its new week.
        latest = max(seasons) if seasons else None
        for s in seasons:
            try:
                nflverse.ingest_season(
                    s, ["player_stats", "schedules"], force=(s == latest)
                )
                league_id, _ = league(s)
                done = _projected_weeks(league_id, s)
                for w in _weeks_with_data(s):
                    if w in done:
                        continue
                    try:
                        if project_week(s, w)["players"] > 0:
                            _STATUS["weeks_done"] += 1
                    except Exception as e:  # noqa: BLE001 — skip a bad week
                        log.warning("project %sw%s failed: %s", s, w, e)
                        if len(_STATUS["errors"]) < _ERROR_CAP:
                            _STATUS["errors"].append(f"{s}w{w}: {e}")
                _STATUS["seasons_done"] += 1
            except Exception as e:  # noqa: BLE001 — skip a season (e.g. no nflverse data yet)
                log.warning("season %s failed: %s", s, e)
                if len(_STATUS["errors"]) < _ERROR_CAP:
                    _STATUS["errors"].append(f"season {s}: {e}")
    except Exception as e:  # noqa: BLE001 — league lookup / unexpected
        log.exception("backfill aborted")
        _STATUS["error"] = str(e)
    finally:
        _STATUS.update(running=False, finished_at=datetime.now(UTC).isoformat())
    return backfill_status()
