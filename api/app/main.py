from collections.abc import Callable
from contextlib import asynccontextmanager
from typing import Any, Literal

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


# The weekly cron target: resolve the current NFL week from the schedule, then
# refresh it like /jobs/refresh-week but with no body to fill in. Synchronous +
# idempotent. No-ops cleanly in the offseason. Shares baseline.refresh_current()
# with the `python -m app.refresh_current` entrypoint the Dokploy schedule runs.
@app.post("/jobs/refresh-current")
def refresh_current() -> JSONResponse:
    from app.projection import baseline

    try:
        result = baseline.refresh_current()
        if result.get("status") == "no_league_seasons":
            return JSONResponse(status_code=422, content={"error": "no league seasons"})
        return JSONResponse(result)
    except (FileNotFoundError, ValueError) as e:
        return JSONResponse(status_code=422, content={"error": str(e)})
    except Exception as e:  # noqa: BLE001 — nflverse / DuckDB / Postgres failure
        return JSONResponse(status_code=424, content={"error": str(e)})


class BacktestRequest(BaseModel):
    seasons: list[int] | None = None


class CalibratePriorsRequest(BaseModel):
    seasons: list[int] | None = None


# Fit the draft-informed prior curve (expected ppg vs ADP, per position) from
# history and report it + per-season coverage. Read-only — produces the constants
# for slice 2b to bake into priors.DRAFT_CURVE. Synchronous (a few seconds).
@app.post("/jobs/calibrate-priors")
def calibrate_priors(body: CalibratePriorsRequest) -> JSONResponse:
    from app.projection import priors

    try:
        return JSONResponse(priors.calibrate(body.seasons))
    except (FileNotFoundError, ValueError) as e:
        return JSONResponse(status_code=422, content={"error": str(e)})
    except Exception as e:  # noqa: BLE001 — DuckDB / Postgres / parquet failure
        return JSONResponse(status_code=424, content={"error": str(e)})


# Held-out backtest: MAE/RMSE of each model layer (0/1/2/2b) vs the naive
# baselines (last-week, trailing-mean) over historical player-weeks, plus the
# layer-beats-layer verdicts. Synchronous (a few seconds).
@app.post("/jobs/backtest")
def run_backtest(body: BacktestRequest) -> JSONResponse:
    from app.projection import backtest

    try:
        return JSONResponse(backtest.backtest(body.seasons))
    except (FileNotFoundError, ValueError) as e:
        return JSONResponse(status_code=422, content={"error": str(e)})
    except Exception as e:  # noqa: BLE001 — DuckDB / Postgres / parquet failure
        return JSONResponse(status_code=424, content={"error": str(e)})


def _run_backfill_all(force_ingest_all: bool = False) -> None:
    import logging

    from app.projection import baseline

    try:
        baseline.backfill_all(force_ingest_all=force_ingest_all)
    except Exception:  # noqa: BLE001 — background task; log and move on
        logging.getLogger("uvicorn.error").exception("refresh-all failed")


class RefreshAllRequest(BaseModel):
    # Force a re-pull of every season's datasets (not just the latest) before
    # projecting — for an nflverse schema change. Optional; defaults to the
    # normal latest-only refresh.
    force_ingest_all: bool = False


# Fire-and-forget full backfill: ingest every league season + project every week
# with data, in the background. Returns 202 immediately (the job runs minutes).
# The one-click "Refresh all" button on /projections calls this.
@app.post("/jobs/refresh-all")
def refresh_all(
    background: BackgroundTasks, body: RefreshAllRequest | None = None
) -> JSONResponse:
    from app.projection import baseline

    if baseline.backfill_status()["running"]:
        return JSONResponse(status_code=409, content={"status": "already_running"})
    background.add_task(_run_backfill_all, bool(body and body.force_ingest_all))
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


class SetCookieRequest(BaseModel):
    cookie: str


# Store the logged-in Yahoo session Cookie header (encrypted) for pub-api-rw.
# The admin pastes it from a browser request; re-pasted when Yahoo expires it.
@app.post("/yahoo/cookies")
def set_yahoo_cookie(body: SetCookieRequest) -> JSONResponse:
    from app.yahoo import cookies

    if not body.cookie.strip():
        return JSONResponse(status_code=422, content={"error": "empty cookie"})
    cookies.save(body.cookie.strip())
    return JSONResponse({"status": "stored"})


# Yahoo sync has two interchangeable fetch sources behind one function surface:
# "oauth" (official API, refreshing bearer token — no cookie to re-paste) and
# "cookie" (pub-api-rw, hand-pasted session cookie, the original path / fallback).
# Both return the same json_f payloads, so the writers don't care which is used.
SyncSource = Literal["oauth", "cookie"]


def _fetch_source(source: SyncSource):
    from app.yahoo import oauth_api, pub_api

    return oauth_api if source == "oauth" else pub_api


def _run_yahoo_job(fn: Callable[[], Any]) -> JSONResponse:
    """Run a sync job, mapping either source's auth/rate errors to a status.
    401 = re-auth needed (re-connect / re-paste); 422 = not connected or bad
    input; 424 = upstream Yahoo / DB failure."""
    from app.yahoo import client, pub_api

    try:
        return JSONResponse(fn())
    except (pub_api.CookieExpired, client.YahooRateLimited) as e:
        return JSONResponse(status_code=401, content={"error": str(e)})
    except (pub_api.NoCookie, client.YahooNotConnected, ValueError) as e:
        return JSONResponse(status_code=422, content={"error": str(e)})
    except Exception as e:  # noqa: BLE001 — Yahoo / DB failure
        return JSONResponse(status_code=424, content={"error": str(e)})


class SyncTeamsRequest(BaseModel):
    league_key: str
    source: SyncSource = "oauth"


# Pull the league's teams + standings from Yahoo (cookie-auth pub-api-rw) and
# backfill league_teams. The league must already exist (bootstrap loads it).
@app.post("/jobs/sync-teams")
def sync_teams_job(body: SyncTeamsRequest) -> JSONResponse:
    from app.yahoo import sync

    src = _fetch_source(body.source)
    return _run_yahoo_job(lambda: sync.sync_teams(src.teams(body.league_key)))


class SyncLeagueRequest(BaseModel):
    league_key: str
    source: SyncSource = "oauth"


# Create-or-update a league from its Yahoo /settings (scoring, roster) + teams.
# This is how the current season is created — it isn't bootstrapped. Idempotent:
# re-run after the league's rules finalise to refresh scoring in place.
@app.post("/jobs/sync-league")
def sync_league_job(body: SyncLeagueRequest) -> JSONResponse:
    from app.yahoo import sync

    src = _fetch_source(body.source)
    return _run_yahoo_job(
        lambda: sync.sync_league(
            src.settings(body.league_key), src.teams(body.league_key)
        )
    )


class SyncRostersRequest(BaseModel):
    league_key: str
    week: int
    source: SyncSource = "oauth"


class SyncTransactionsRequest(BaseModel):
    league_key: str
    source: SyncSource = "oauth"


# All of a league's adds/drops/trades → the transactions table (paginated).
@app.post("/jobs/sync-transactions")
def sync_transactions_job(body: SyncTransactionsRequest) -> JSONResponse:
    from app.yahoo import sync

    src = _fetch_source(body.source)
    return _run_yahoo_job(
        lambda: sync.sync_all_transactions(body.league_key, src.transactions)
    )


class SyncMatchupsRequest(BaseModel):
    league_key: str
    week: int
    source: SyncSource = "oauth"


# A week's matchups + scores → the matchups table (one call for the whole league).
@app.post("/jobs/sync-matchups")
def sync_matchups_job(body: SyncMatchupsRequest) -> JSONResponse:
    from app.yahoo import sync

    src = _fetch_source(body.source)
    return _run_yahoo_job(
        lambda: sync.sync_matchups(src.scoreboard(body.league_key, body.week))
    )


# Every team's weekly roster (players + slots) → the rosters table. Post-draft.
@app.post("/jobs/sync-rosters")
def sync_rosters_job(body: SyncRostersRequest) -> JSONResponse:
    from app.yahoo import sync

    src = _fetch_source(body.source)
    return _run_yahoo_job(
        lambda: sync.sync_rosters(body.league_key, src.roster, body.week)
    )


class SyncAllTeamsRequest(BaseModel):
    source: SyncSource = "oauth"


# Sync teams for every league we hold a Yahoo key for — one auth, all seasons,
# no league_key to type.
@app.post("/jobs/sync-all-teams")
def sync_all_teams_job(body: SyncAllTeamsRequest | None = None) -> JSONResponse:
    from app.yahoo import sync

    src = _fetch_source(body.source if body else "oauth")
    return _run_yahoo_job(lambda: sync.sync_all_teams(src.teams))


class SimMatchupRequest(BaseModel):
    league_key: str
    week: int


# Layer 4: Monte Carlo win probability for every matchup in a league-week, from
# the real starting lineups + their projections. Synchronous (a couple seconds).
@app.post("/jobs/sim-matchup")
def sim_matchup_job(body: SimMatchupRequest) -> JSONResponse:
    from app.projection import sim

    try:
        return JSONResponse(sim.sim_week(body.league_key, body.week))
    except ValueError as e:
        return JSONResponse(status_code=422, content={"error": str(e)})
    except Exception as e:  # noqa: BLE001 — DuckDB / Postgres failure
        return JSONResponse(status_code=424, content={"error": str(e)})


class SyncDraftRequest(BaseModel):
    league_key: str
    source: SyncSource = "oauth"


# Draft assistant Slice 3: poll Yahoo draft-results into draft_picks. Idempotent
# per overall pick — the live board calls this on a timer during the draft.
@app.post("/jobs/sync-draft")
def sync_draft_job(body: SyncDraftRequest) -> JSONResponse:
    from app.yahoo import sync

    src = _fetch_source(body.source)
    return _run_yahoo_job(lambda: sync.sync_draft(body.league_key, src.draftresults))


class BuildDraftBoardRequest(BaseModel):
    league_key: str


# Draft assistant Slice 1: compute the preseason value board (VOR from projections
# + the draft-prior curve, with market ADP) into draft_board. Synchronous.
@app.post("/jobs/build-draft-board")
def build_draft_board_job(body: BuildDraftBoardRequest) -> JSONResponse:
    from app.draft import board

    try:
        return JSONResponse(board.build_draft_board(body.league_key))
    except ValueError as e:
        return JSONResponse(status_code=422, content={"error": str(e)})
    except Exception as e:  # noqa: BLE001 — FFC / DuckDB / Postgres failure
        return JSONResponse(status_code=424, content={"error": str(e)})
