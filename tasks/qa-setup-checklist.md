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

## Dokploy — web-qa app

**Build tab** (clone prod-web; do NOT set a custom base dir — default = repo root):

- [ ] Build Type: **Dockerfile**
- [ ] Dockerfile Path: `web/Dockerfile`
- [ ] Build Context / Base Dir: **leave default (repo root)** ← Dockerfile COPYs are `web/…`-prefixed; a subdir context breaks the build
- [ ] Branch: `qa`
- [ ] Port: `4000`
- [ ] Domain: `qa.chriskim.cloud`

**Env:**

- [ ] `DATABASE_URL` = ‹qa branch›
- [ ] `API_URL` = `http://api-qa:4001` ← internal name, NOT a domain
- [ ] `AUTH_SECRET` = ‹its own value›
- [ ] `AUTH_GOOGLE_ID` = ‹same prod client›
- [ ] `AUTH_GOOGLE_SECRET` = ‹same prod client›
- [ ] `ADMIN_EMAILS` = `christopher.cuong.kim@gmail.com`
- [ ] `AUTH_TRUST_HOST` = `true`
- [ ] `APP_BASE_URL` = `https://qa.chriskim.cloud`

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

**Bind mount** (Advanced → Mounts → Add Mount):

- [ ] `sudo mkdir -p /srv/fantasy-qa` on the VPS first
- [ ] Mount Type: **Bind Mount**
- [ ] Host Path: `/srv/fantasy-qa`
- [ ] Mount Path: `/srv/fantasy-qa`

**Env:**

- [ ] `DATABASE_URL` = ‹qa branch› (same as web-qa)
- [ ] `PARQUET_ROOT` = `/srv/fantasy-qa`
- [ ] `TOKEN_ENC_KEY` = ‹its own value›
- [ ] `APP_BASE_URL` = `https://qa.chriskim.cloud`

- [ ] Copy its deploy webhook → GitHub secret `DOKPLOY_API_QA_WEBHOOK`

---

## Seed parquet (after api-qa is up)

The `qa` Neon branch already holds all DB rows (it's a branch of main) — do NOT
re-run `/jobs/crosswalk`. Only the parquet cache needs filling. api-qa has no
public URL, so run from **api-qa's Dokploy web terminal**:

- [ ] Ingest + aggregate all seasons:
  ```bash
  for s in $(seq 2014 2025); do
    curl -fsS -X POST http://localhost:4001/jobs/ingest-season \
      -H 'Content-Type: application/json' -d "{\"season\": $s}"
    curl -fsS -X POST http://localhost:4001/jobs/aggregate \
      -H 'Content-Type: application/json' -d "{\"season\": $s}"
  done
  ```
- [ ] (fallback if ingest too slow) copy prod parquet: `sudo cp -a /srv/fantasy/. /srv/fantasy-qa/`

---

## Verify

- [ ] `https://qa.chriskim.cloud` loads
- [ ] `https://qa.chriskim.cloud/api/health` → all `ok` (web + api + postgres)
- [ ] Google sign-in works; admin pages gated to `ADMIN_EMAILS`
