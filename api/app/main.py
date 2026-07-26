from collections.abc import Callable
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import JSONResponse

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
