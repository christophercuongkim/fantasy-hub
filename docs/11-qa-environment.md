# QA Environment

A stable, always-on second stack parallel to prod. Deploy any branch to it and
test end-to-end — real Google auth, real data — from anywhere, including your
phone. Replaces the idea of per-PR preview deployments (dynamic subdomains
fought Google OAuth and didn't hand a per-PR DB into Dokploy; a fixed QA env is
simpler and safe for write flows).

**Audience: you, away from the laptop, wanting to click through a branch before merging.**

---

## 1. Topology

Two Dokploy apps, one Neon branch, one scratch parquet volume. The api mirrors
prod's posture: **no public domain, no auth** — it is reachable only inside the
Docker network by service name. web-qa is the only thing with a domain.

```
qa.chriskim.cloud  → web-qa (:4000) ──http://api-qa:4001──▶ api-qa (:4001, NO domain)
        │                                                        │
        └──────────── DATABASE_URL → Neon "qa" branch ──────────┘
                                     api-qa ── volume → /srv/fantasy-qa
```

Why api-qa gets no domain: the FastAPI service is unauthenticated by design
(`docs/02-api-contract.md` — "reachable only inside the Docker network. No
auth"). Its `/jobs/*` endpoints (ingest, aggregate, crosswalk) must never be
internet-facing. Prod does the same; QA follows.

Stable domains mean **real Google sign-in with one redirect URI** — no
`AUTH_REDIRECT_PROXY_URL`, no shared-secret dance that dynamic previews needed.

---

## 2. One-time setup

### 2.1 DNS
Plain A-record (no wildcard): `qa.chriskim.cloud → <VPS IP>`.
api-qa needs **no** DNS — it is internal-only.

### 2.2 Neon
Console → Branches → New, parent `main`, name `qa`. Copy its connection string
→ this is `‹qa-DATABASE_URL›` below. Being a branch of `main`, it already
contains all league/draft/crosswalk **rows** — you do not re-run `/jobs/crosswalk`.
Reset from parent when it drifts from prod.

### 2.3 Google OAuth
Add one redirect URI to the **existing prod** OAuth client:
`https://qa.chriskim.cloud/api/auth/callback/google`. Nothing else.

### 2.4 Dokploy apps
Create two apps, **both building from branch `qa`** (the deploy workflow keeps
that branch pointed at whatever you're testing — see §4), in the **same Dokploy
project/network** so the internal hostname resolves.

**web-qa** — domain `qa.chriskim.cloud`, port `4000`:

```
DATABASE_URL    = ‹qa-DATABASE_URL›
API_URL         = http://api-qa:4001          # internal service name, NOT a domain
AUTH_SECRET     = ‹its own value, may differ from prod›
AUTH_GOOGLE_ID  = ‹same prod client›
AUTH_GOOGLE_SECRET = ‹same prod client›
ADMIN_EMAILS    = christopher.cuong.kim@gmail.com
AUTH_TRUST_HOST = true
APP_BASE_URL    = https://qa.chriskim.cloud
```

> `api-qa` in `API_URL` must match api-qa's actual service name on the Dokploy
> network — confirm it in the api-qa app settings and adjust if Dokploy names it
> differently.

**api-qa** — **no domain**, port `4001`, volume (§2.5):

```
DATABASE_URL  = ‹qa-DATABASE_URL›             # same branch as web-qa
PARQUET_ROOT  = /srv/fantasy-qa
TOKEN_ENC_KEY = ‹its own value›
APP_BASE_URL  = https://qa.chriskim.cloud
```

### 2.5 Parquet volume
api-qa → Advanced → Volumes → Add:
- Type **Volume** (named, persists across redeploys), name `fantasy-qa`
- Mount path `/srv/fantasy-qa`

Starts empty; `ensure_layout()` mkdirs the dataset dirs on boot so `/health`
goes green before ingest. Fill it in §3.

---

## 3. Seeding parquet

Parquet is a **re-derivable cache** of nflverse (public, free), not precious
data — so regenerate it rather than copy. The `qa` Neon branch already holds the
warm DB rows; only the cold parquet cache on the volume needs filling.

Because api-qa has **no public URL**, run the seed from **inside the api-qa
container** (Dokploy per-app web terminal):

```bash
for s in $(seq 2014 2025); do
  curl -fsS -X POST http://localhost:4001/jobs/ingest-season \
    -H 'Content-Type: application/json' -d "{\"season\": $s}"
  curl -fsS -X POST http://localhost:4001/jobs/aggregate \
    -H 'Content-Type: application/json' -d "{\"season\": $s}"
done
```

`ingest-season` downloads pbp/schedules/player_stats into
`/srv/fantasy-qa/{dataset}/season=$s/`; `aggregate` DuckDB-derives weekly/team/dvp
parquet from it. Both idempotent — safe to re-run. ~a few min/season.

**Alternative — copy prod's volume** (only if a fresh ingest is too slow). SSH
the VPS; both are Docker named volumes:

```bash
docker volume ls | grep fantasy        # confirm prod's volume name first
sudo cp -a /var/lib/docker/volumes/<prod-fantasy-vol>/_data/. \
           /var/lib/docker/volumes/fantasy-qa/_data/
```

Re-ingest is preferred: self-contained, touches nothing prod, and exercises the
api's own ingest path (which is what QA is for).

---

## 4. Deploying a branch to QA

QA apps build from a fixed branch `qa`. To put branch X on QA, `qa` is
force-updated to X, then the QA webhooks fire. This is automated by
`.github/workflows/deploy-qa.yml` (`workflow_dispatch`):

- Inputs: `branch` (default `main`), `service` (`both|web|api`, default `both`).
- Runnable from **GitHub mobile** → Actions → deploy-qa → Run workflow → pick a
  branch → Run. Minutes later, test on your phone.
- Steps: checkout → `drizzle-kit migrate` against QA DB (schema forward first) →
  force-push chosen branch to `qa` → join tailnet → curl the QA deploy
  webhook(s).

The `qa` branch is a throwaway deploy pointer — force-pushed, never merged,
never reviewed.

### Secrets (GitHub repo settings)
- `DOKPLOY_WEB_QA_WEBHOOK`, `DOKPLOY_API_QA_WEBHOOK` — the two QA app deploy webhooks.
- `DATABASE_URL_QA` — the `qa` Neon branch connection string (for auto-migrate).
- Reuses existing `TS_OAUTH_CLIENT_ID` / `TS_OAUTH_SECRET`.

---

## 5. Gotchas

- **`API_URL` is internal.** `http://api-qa:4001`, never a public domain — the
  api has no auth and must not be exposed.
- **Migrations auto-run** before deploy (§4). No manual `drizzle-kit migrate`
  needed for QA.
- **`qa` branch is disposable.** Don't commit to it or open PRs from it; the
  workflow overwrites it every run.
- **Neon `qa` drifts** from `main` over time (it's a point-in-time branch). Reset
  it from parent in the Neon console when you want prod-fresh data.
- **Seed jobs run in-container** (§3) — they are not reachable from your laptop
  by design.
