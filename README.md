# fantasy-hub

Personal NFL fantasy analytics app — draft assistance, start/sit, waivers, trades. Full design in [`docs/`](docs/) (start with the [implementation plan](docs/fantasy-nfl-implementation-plan.md)). Working agreement in [`CLAUDE.md`](CLAUDE.md).

**Stack:** Next.js 15 + TypeScript (`web/`) · FastAPI + Python (`api/`) · Neon Postgres · DuckDB/Parquet · Yahoo Fantasy API · Dokploy on a VPS.

## Layout

```
web/    Next.js 15 (App Router) — UI + thin route handlers
api/    FastAPI — projections, simulation, ingestion
docs/   Design specification
tasks/  Working plan + lessons
```

## Develop

Tooling is pinned with a Nix flake (Node 22, pnpm, Python 3.12, uv). With direnv:

```sh
direnv allow      # loads the flake dev shell automatically
```

Or without direnv:

```sh
nix develop
```

Then, per service:

```sh
cd web && pnpm install && pnpm dev      # http://localhost:4000
cd api && uv sync && uv run uvicorn app.main:app --reload --port 4001
```

Both at once via Docker:

```sh
docker compose up --build
# web  → http://localhost:4000
# api  → http://localhost:4001/health
```

## Health

- `GET http://localhost:4001/health` → FastAPI status
- `GET http://localhost:4000/api/health` → web status (proxies the API check)

Subsystem checks (Postgres, DuckDB, Parquet) are added as those layers land.

## Deploy

Two Dokploy applications (`web`, `api`), each built from its own Dockerfile. CI joins the tailnet and triggers each app's deploy webhook — see [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

- **Container ports** (set in each app's Domain settings): web `4000`, api `4001`. Chosen to avoid the VPS's in-use ports (80, 3000, 8000, 8080). Traefik routes by domain to these; no host ports are published in prod.
- **Required GitHub secrets:** `TS_OAUTH_CLIENT_ID`, `TS_OAUTH_SECRET`, `DOKPLOY_WEB_WEBHOOK`, `DOKPLOY_API_WEBHOOK`.
