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

**Shared (project/environment level)** — vars that must be *identical* in both
apps. Define once at the QA project/environment level:

```
DATABASE_URL  = ‹qa-DATABASE_URL›     # both apps, same Postgres — byte-identical
TOKEN_ENC_KEY = ‹its own value›       # web encrypts the Yahoo token, api decrypts;
                                      # mismatch silently breaks Yahoo
APP_BASE_URL  = https://qa.chriskim.cloud
```

> ⚠️ **Dokploy does not auto-inject project vars into services.** Defining them
> above is not enough — **each service must reference each one** in its own env
> tab: `DATABASE_URL=${{project.DATABASE_URL}}` (and the same for `TOKEN_ENC_KEY`,
> `APP_BASE_URL`). A service with no reference line gets *nothing* → web-qa boots
> with no `DATABASE_URL` and every DB page 500s while `/`/`/login` still work.
> Verify from the container logs/runtime env, not the project tab. (Solo-setup
> alternative: skip project level and set the values directly per service.)

**web-qa** — domain `qa.chriskim.cloud`, port `4000`:

```
# reference the shared vars (not auto-injected):
DATABASE_URL    = ${{project.DATABASE_URL}}
TOKEN_ENC_KEY   = ${{project.TOKEN_ENC_KEY}}
APP_BASE_URL    = ${{project.APP_BASE_URL}}
# service-scoped:
API_URL         = http://fantasyhub-api-qvnkhx:4001   # qa-api's Dokploy service name, NOT a domain
AUTH_URL        = https://qa.chriskim.cloud   # REQUIRED — see note; per-env, prod needs its own
AUTH_SECRET     = ‹its own value, may differ from prod›
AUTH_GOOGLE_ID  = ‹same prod client›
AUTH_GOOGLE_SECRET = ‹same prod client›
ADMIN_EMAILS    = christopher.cuong.kim@gmail.com
```

> **`AUTH_URL` is required behind Traefik.** Auth.js only reads `AUTH_URL`; without
> it, it builds the Google `redirect_uri` from the internal container host
> (`https://<container-id>:4000/...`) and sign-in dies at
> `/api/auth/error?error=Configuration`. It must be a real env var (next-auth
> reads it at import — can't be set from code), and it's **per-deployment** (prod
> needs `https://fantasy.chriskim.cloud` on merge). `auth.ts` also sets
> `trustHost: true` (accepts the proxied host); the two work together. Confirm
> with `curl .../api/auth/providers` → Google `callbackUrl` is the public host.

> `API_URL` uses qa-api's Dokploy service name (`fantasyhub-api-qvnkhx`), taken
> from the **qa** api app's General tab — **not** prod-api (`fantasyhub-api-ovkt8f`).
> Both apps share the `dokploy-network` overlay and resolve network-wide, so the
> unique suffix is the only thing keeping qa-web off prod-api. The suffix is fixed
> for the app's life; it changes only if you delete + recreate the qa-api app, in
> which case update this one (service-scoped) value.

**api-qa** — **no domain**, port `4001`. No api-only service-scoped vars, but it
still must **reference** the shared vars (same not-auto-injected trap):

```
DATABASE_URL  = ${{project.DATABASE_URL}}
TOKEN_ENC_KEY = ${{project.TOKEN_ENC_KEY}}
APP_BASE_URL  = ${{project.APP_BASE_URL}}
```

Don't hoist web's `AUTH_*` / `ADMIN_EMAILS` to the shared layer — api has no auth
(least privilege). Service-level env overrides project-level on a name clash.

### 2.5 Parquet mount — deferred to Phase 2 (not needed now)
**Skip this for now — prod runs mountless and so should QA.**

`PARQUET_ROOT` is left **unset** in both prod and QA, so it falls back to the
`config.py` default `/data` — an empty, ephemeral in-container dir. That's fine
today because **nothing reads the parquet cache yet**: the api exposes only
`/health`, `/yahoo/game`, and the `/jobs/*` compute endpoints — no read endpoint
serves weekly/team/dvp to the web app. `ensure_layout()` mkdirs empty dirs on
boot, so `/health` reports `parquet_root: ok` with zero data, and every current
feature (hall-of-records from Postgres, crosswalk admin) works without parquet.

**When Phase 2 (projections/analytics) lands** and a read endpoint actually
serves parquet, **both prod and QA** will need a persistent mount + a real
ingest — otherwise the cache vanishes on every redeploy (and QA redeploys
constantly). At that point:

- api → Advanced → Mounts → Add **Bind Mount**: Host `/srv/fantasy-qa` → container
  `/srv/fantasy-qa` (QA); prod gets its own `/srv/fantasy`. `sudo mkdir -p` the
  host dir first.
- Set `PARQUET_ROOT` to that path.
- Seed it (§3).

Until then, none of this is required.

---

## 3. Seeding parquet — deferred to Phase 2

Not needed until the mount exists (§2.5) and a read endpoint consumes parquet.
When that time comes, seed from **inside the api container** (no public URL) via
the Dokploy per-app terminal:

```bash
for s in $(seq 2014 2025); do
  curl -fsS -X POST http://localhost:4001/jobs/ingest-season \
    -H 'Content-Type: application/json' -d "{\"season\": $s}"
  curl -fsS -X POST http://localhost:4001/jobs/aggregate \
    -H 'Content-Type: application/json' -d "{\"season\": $s}"
done
```

`ingest-season` downloads pbp/schedules/player_stats; `aggregate` DuckDB-derives
weekly/team/dvp. Both idempotent. Alternatively copy prod's dir once it exists:
`sudo cp -a /srv/fantasy/. /srv/fantasy-qa/`.

---

## 4. Deploying a branch to QA

QA apps build from a fixed branch `qa`. To put branch X on QA, `qa` is
force-updated to X, then the QA webhooks fire. `.github/workflows/deploy-qa.yml`
does this on two triggers:

- **Auto — on a PR.** Opening or pushing to a PR that touches `web/**` or `api/**`
  deploys that PR's branch to QA (`pull_request`: opened/synchronize/reopened).
  Doc-only PRs don't trigger it.
- **Manual — `workflow_dispatch`.** Inputs `branch` (default `main`) + `service`
  (`both|web|api`). The override for deploying `main`, a branch with no open PR,
  or forcing a redeploy. Runnable from **GitHub mobile** → Actions → deploy-qa.

Steps: checkout the branch → `drizzle-kit migrate` against QA DB (schema forward
first) → force-push it to `qa` → join tailnet → curl the QA webhook(s).

**QA is a single shared slot** (one `qa` pointer + one DB). The `deploy-qa`
concurrency group serialises deploys, newest wins — so with two PRs open at once,
whichever deployed last is what's live. Fine for serial, one-PR-at-a-time work;
if you need two live previews at once, that's a per-PR-subdomain design, not this.

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
