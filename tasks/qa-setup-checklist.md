# QA Environment — Setup Checklist

Manual prereqs to stand up the QA stack. Full reference + rationale:
`docs/11-qa-environment.md`. Tick these off, then Claude writes `deploy-qa.yml`.

Domain: `qa.chriskim.cloud` (web only; api-qa has **no** domain).

---

## Blocks writing `deploy-qa.yml`

Only these two actually gate the workflow code:

- [ ] **3 GitHub secrets exist** (values not needed by Claude, just set them):
  - [ ] `DOKPLOY_WEB_QA_WEBHOOK`
  - [ ] `DOKPLOY_API_QA_WEBHOOK`
  - [ ] `DATABASE_URL_QA`
  - (already have `TS_OAUTH_CLIENT_ID` / `TS_OAUTH_SECRET` — reused)
- [ ] **Confirm api-qa's service name** on the Dokploy network (assumed `api-qa`).
      If different, tell Claude — web-qa's `API_URL` must match.

## Git

- [ ] Create the `qa` branch so Dokploy apps can select it:
      `git push origin main:qa`
      (throwaway deploy pointer — the workflow force-pushes it; never merge/PR it)

## DNS

- [ ] A-record `qa.chriskim.cloud` → VPS IP (plain, no wildcard)
- [ ] api-qa: **no DNS** (internal-only)

## Neon

- [ ] Branch `qa` off `main` (Console → Branches → New, parent `main`)
- [ ] Copy its connection string → use as `DATABASE_URL_QA` + both apps' `DATABASE_URL`

## Google OAuth (existing prod client)

- [ ] Add redirect URI: `https://qa.chriskim.cloud/api/auth/callback/google`

---

## Dokploy — shared (project/environment) env

Put vars that must be **identical** in both apps at the QA **project or
environment level** (pick one level, not both), then reference per service with
`${{project.VAR}}`. Single source of truth → no drift. Service-level env
overrides project on a name clash.

- [ ] `DATABASE_URL` = ‹qa branch› — both apps hit the same Postgres
- [ ] `TOKEN_ENC_KEY` = ‹its own value› — web encrypts the Yahoo token, api
      decrypts it; **mismatch silently breaks Yahoo**
- [ ] `APP_BASE_URL` = `https://qa.chriskim.cloud`

> ⚠️ **Dokploy does NOT auto-inject project vars.** Defining them here is not
> enough — **each service must reference each one** in its own env tab (below),
> e.g. `DATABASE_URL=${{project.DATABASE_URL}}`. A service with no reference line
> gets *nothing* → e.g. web-qa boots with no `DATABASE_URL` and every DB page
> 500s while `/` and `/login` still work. For a solo setup, setting the values
> directly per-service is a fine, simpler alternative. Verify from the container
> logs/runtime env, not this project tab.

Everything below stays **service-scoped**. Don't hoist web's `AUTH_*` /
`ADMIN_EMAILS` secrets to the shared layer (api has no auth — least privilege).

## Dokploy — web-qa app

**Build tab** (clone prod-web; do NOT set a custom base dir — default = repo root):

- [ ] Build Type: **Dockerfile**
- [ ] Dockerfile Path: `web/Dockerfile`
- [ ] Build Context / Base Dir: **leave default (repo root)** ← Dockerfile COPYs are `web/…`-prefixed; a subdir context breaks the build
- [ ] Branch: `qa`
- [ ] Port: `4000`
- [ ] Domain: `qa.chriskim.cloud`

**Env — reference the shared vars** (not auto-injected):

- [ ] `DATABASE_URL` = `${{project.DATABASE_URL}}`
- [ ] `TOKEN_ENC_KEY` = `${{project.TOKEN_ENC_KEY}}`
- [ ] `APP_BASE_URL` = `${{project.APP_BASE_URL}}`

**Env — service-scoped:**

- [ ] `API_URL` = `http://fantasyhub-api-qvnkhx:4001` ← qa-api's Dokploy service
      name, NOT a domain. (prod-api is a *different* suffix, `-ovkt8f` — do not
      use prod's here or qa-web writes hit prod.) Suffix is fixed for the app's
      life; only changes if you delete + recreate the qa-api app.
- [ ] `AUTH_URL` = `https://qa.chriskim.cloud` ← **required.** Auth.js only reads
      `AUTH_URL`; without it, behind Traefik it builds the Google `redirect_uri`
      from the internal container host and sign-in dies at
      `/api/auth/error?error=Configuration`. Per-env (prod needs its own on
      merge). Can't be set from code — next-auth reads it at import.
- [ ] `AUTH_SECRET` = ‹its own value›
- [ ] `AUTH_GOOGLE_ID` = ‹same prod client›
- [ ] `AUTH_GOOGLE_SECRET` = ‹same prod client›
- [ ] `ADMIN_EMAILS` = `christopher.cuong.kim@gmail.com`

- [ ] Copy its deploy webhook → GitHub secret `DOKPLOY_WEB_QA_WEBHOOK`

---

## Dokploy — api-qa app

Same Dokploy **project/network** as web-qa. **No domain.**

**Build tab** (clone prod-api; same context rule as above):

- [ ] Build Type: **Dockerfile**
- [ ] Dockerfile Path: `api/Dockerfile`
- [ ] Build Context / Base Dir: **leave default (repo root)** ← COPYs are `api/…`-prefixed
- [ ] Branch: `qa`
- [ ] Port: `4001`
- [ ] Domain: **none**

**Env — reference the shared vars** (same trap: not auto-injected). No api-only
service-scoped vars; leave `PARQUET_ROOT` **unset** (defaults to `/data`).

- [ ] `DATABASE_URL` = `${{project.DATABASE_URL}}`
- [ ] `TOKEN_ENC_KEY` = `${{project.TOKEN_ENC_KEY}}`
- [ ] `APP_BASE_URL` = `${{project.APP_BASE_URL}}`

- [ ] Copy its deploy webhook → GitHub secret `DOKPLOY_API_QA_WEBHOOK`

> **No bind mount, no parquet seeding — deferred to Phase 2.** Prod runs mountless
> and nothing reads the parquet cache yet (`ensure_layout()` makes empty dirs →
> `/health` ok; current features are all Postgres-backed). Add a persistent mount
> (`/srv/fantasy-qa`) + ingest for **both prod and QA** when the
> projections/analytics read-path lands. Detail in `docs/11-qa-environment.md`
> §2.5/§3.

---

## Verify

- [ ] `https://qa.chriskim.cloud` loads (public, no DB)
- [ ] `/hall_of_records` **signed-out → 302 → /login** (gated)
- [ ] `curl .../api/auth/providers` → Google `callbackUrl` is
      `https://qa.chriskim.cloud/...`, **not** `https://<container-id>:4000/...`
      (confirms `AUTH_URL` took)
- [ ] Google sign-in works
- [ ] **signed-in DB smoke check:** `/hall_of_records` → **200 with data**. A 500
      = web-qa has no runtime `DATABASE_URL` (shared var not referenced); a
      200-but-empty = the `qa` Neon branch was cut from a parent without the
      loaded data (reset it from the loaded parent).
- [ ] `/admin/crosswalk` loads signed-in, 302→login signed-out
- [ ] `api-qa` not publicly reachable (no domain)

> Note: only `/`, `/login`, `/api/auth` are public — `/hall_of_records` and
> `/api/health` both 302→login signed-out. So the DB smoke check must be run
> **signed in**; there's no public DB-backed page to curl. (Whether `/api/health`
> should be public is a separate call — see the PR #34 review note.)
