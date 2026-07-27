from collections.abc import Callable
from contextlib import asynccontextmanager

from fastapi import FastAPI
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
