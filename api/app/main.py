from collections.abc import Callable
from contextlib import asynccontextmanager

from fastapi import BackgroundTasks, FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.config import settings
from app.storage import duck, parquet, postgres


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure the Parquet dataset directories exist before any job runs.
    parquet.ensure_layout()
    yield


app = FastAPI(title="fantasy-hub-api", version="0.0.0", lifespan=lifespan)


def _check(fn: Callable[[], bool]) -> str:
    try:
        return "ok" if fn() else "error"
    except Exception:
        return "unreachable"


@app.get("/health")
def health() -> JSONResponse:
    """Health probe. Reports each subsystem; 200 only when nothing configured is
    failing. Postgres is 'not_configured' (not a failure) until DATABASE_URL is
    set, so the service stays healthy before the DB is wired. See
    docs/02-api-contract.md. Dokploy's healthcheck hits this.
    """
    parquet_root = "ok" if parquet.is_ready() else "missing"
    duckdb_status = _check(duck.ping)
    postgres_status = (
        "not_configured" if not settings.database_url else _check(postgres.ping)
    )

    ok = (
        parquet_root == "ok"
        and duckdb_status == "ok"
        and postgres_status in ("ok", "not_configured")
    )
    return JSONResponse(
        status_code=200 if ok else 503,
        content={
            "status": "ok" if ok else "degraded",
            "postgres": postgres_status,
            "parquet_root": parquet_root,
            "duckdb": duckdb_status,
            "version": app.version,
        },
    )


@app.get("/yahoo/game")
def yahoo_game() -> JSONResponse:
    """Proof that the stored Yahoo token works: fetch the current NFL game key.

    Never hardcode the game key — it changes yearly. See yahoo cookbook §3.1.
    """
    from app.yahoo.client import YahooClient, YahooError

    try:
        data = YahooClient().get("/game/nfl")
        game = data["fantasy_content"]["game"][0]
        return JSONResponse({"game_key": game["game_key"], "season": game["season"]})
    except YahooError as e:
        # Upstream dependency failed (no token, refresh failed, Yahoo down).
        return JSONResponse(status_code=424, content={"error": str(e)})
    except Exception as e:  # noqa: BLE001 — surface config errors as 500
        return JSONResponse(status_code=500, content={"error": str(e)})


class IngestSeasonRequest(BaseModel):
    season: int
    datasets: list[str] | None = None  # defaults to pbp + schedules
    force: bool = False


class IngestWeekRequest(BaseModel):
    season: int
    week: int


# Ingestion jobs are synchronous — a full-season PBP pull is minutes, and the
# only caller is a Dokploy scheduled curl that can wait. Idempotent per season.
@app.post("/jobs/ingest-season")
def ingest_season(body: IngestSeasonRequest) -> JSONResponse:
    from app.ingest import nflverse

    try:
        return JSONResponse(
            nflverse.ingest_season(body.season, body.datasets, force=body.force)
        )
    except ValueError as e:
        return JSONResponse(status_code=422, content={"error": str(e)})
    except Exception as e:  # noqa: BLE001 — nflverse download/parse failure
        return JSONResponse(status_code=424, content={"error": str(e)})


@app.post("/jobs/ingest-week")
def ingest_week(body: IngestWeekRequest) -> JSONResponse:
    from app.ingest import nflverse

    try:
        return JSONResponse(nflverse.ingest_week(body.season, body.week))
    except ValueError as e:
        return JSONResponse(status_code=422, content={"error": str(e)})
    except Exception as e:  # noqa: BLE001
        return JSONResponse(status_code=424, content={"error": str(e)})


class AggregateRequest(BaseModel):
    season: int


# DuckDB aggregation of the raw cold-tier Parquet into weekly/team/dvp tables.
# Synchronous + idempotent, same as ingestion; run after the weekly ingest.
@app.post("/jobs/aggregate")
def aggregate(body: AggregateRequest) -> JSONResponse:
    from app.aggregate import weekly

    try:
        return JSONResponse(weekly.aggregate_season(body.season))
    except FileNotFoundError as e:
        return JSONResponse(status_code=422, content={"error": str(e)})
    except Exception as e:  # noqa: BLE001 — DuckDB / parquet failure
        return JSONResponse(status_code=424, content={"error": str(e)})


class ProjectRequest(BaseModel):
    season: int
    week: int


# Layer-0 baseline projection for one (season, week): EWMA of league-scored
# points from the cold-tier player_stats → projections_archive Parquet.
# Synchronous + idempotent, run after ingest + aggregate.
@app.post("/jobs/project")
def project(body: ProjectRequest) -> JSONResponse:
    from app.projection import baseline

    try:
        return JSONResponse(baseline.project_week(body.season, body.week))
    except (FileNotFoundError, ValueError) as e:
        return JSONResponse(status_code=422, content={"error": str(e)})
    except Exception as e:  # noqa: BLE001 — DuckDB / Postgres / parquet failure
        return JSONResponse(status_code=424, content={"error": str(e)})


class RefreshWeekRequest(BaseModel):
    season: int
    week: int


# One-click "make projections current": re-pull the projection inputs
# (player_stats + schedules, forced) then project the week. Deliberately skips
# pbp + the weekly aggregate — Layer 0 reads player_stats directly, and pbp is
# the slow pull, so this stays fast enough to run synchronously from a button.
@app.post("/jobs/refresh-week")
def refresh_week(body: RefreshWeekRequest) -> JSONResponse:
    from app.ingest import nflverse
    from app.projection import baseline

    try:
        ingested = nflverse.ingest_season(
            body.season, ["player_stats", "schedules"], force=True
        )
        projected = baseline.project_week(body.season, body.week)
        return JSONResponse({"ingested": ingested, "projected": projected})
    except (FileNotFoundError, ValueError) as e:
        return JSONResponse(status_code=422, content={"error": str(e)})
    except Exception as e:  # noqa: BLE001 — nflverse / DuckDB / Postgres failure
        return JSONResponse(status_code=424, content={"error": str(e)})


class BacktestRequest(BaseModel):
    seasons: list[int] | None = None


# Held-out backtest: MAE/RMSE of each model layer (0/1/2) vs the naive baselines
# (last-week, trailing-mean) over historical player-weeks, plus the layer-beats-
# layer verdicts. Synchronous (a few seconds).
@app.post("/jobs/backtest")
def run_backtest(body: BacktestRequest) -> JSONResponse:
    from app.projection import backtest

    try:
        return JSONResponse(backtest.backtest(body.seasons))
    except (FileNotFoundError, ValueError) as e:
        return JSONResponse(status_code=422, content={"error": str(e)})
    except Exception as e:  # noqa: BLE001 — DuckDB / Postgres / parquet failure
        return JSONResponse(status_code=424, content={"error": str(e)})


def _run_backfill_all() -> None:
    import logging

    from app.projection import baseline

    try:
        baseline.backfill_all()
    except Exception:  # noqa: BLE001 — background task; log and move on
        logging.getLogger("uvicorn.error").exception("refresh-all failed")


# Fire-and-forget full backfill: ingest every league season + project every week
# with data, in the background. Returns 202 immediately (the job runs minutes).
# The one-click "Refresh all" button on /projections calls this.
@app.post("/jobs/refresh-all")
def refresh_all(background: BackgroundTasks) -> JSONResponse:
    from app.projection import baseline

    if baseline.backfill_status()["running"]:
        return JSONResponse(status_code=409, content={"status": "already_running"})
    background.add_task(_run_backfill_all)
    return JSONResponse(status_code=202, content={"status": "started"})


# Progress for the running/last backfill — the /projections button polls this to
# show progress and auto-refresh the page when it finishes.
@app.get("/jobs/refresh-status")
def refresh_status() -> JSONResponse:
    from app.projection import baseline

    return JSONResponse(baseline.backfill_status())


# Build the player registry from nflverse ids + resolve draft_picks.player_id
# by name; unresolved names land in id_crosswalk_log for the admin review page.
@app.post("/jobs/crosswalk")
def crosswalk() -> JSONResponse:
    from app.crosswalk import build

    try:
        return JSONResponse(build.run())
    except Exception as e:  # noqa: BLE001 — nflverse download / DB failure
        return JSONResponse(status_code=424, content={"error": str(e)})
