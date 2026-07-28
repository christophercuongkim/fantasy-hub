# Lessons Learned — fantasy-hub

Append a pattern after any correction: what happened, **why**, **how to apply**. Review at session start.

Stack: Next.js + TypeScript · FastAPI + Python · Neon Postgres · DuckDB/Parquet · Yahoo API · Dokploy/Tailscale on VPS.

---

## Workflow / process

### commit → PR → wait for manual review
Every non-trivial change ships as its own PR. Surface design calls in chat before coding; branch off `origin/main`; commit; open PR; post a line-anchored self-review; then **STOP** and wait for Chris's manual review before merging or starting the next PR's code. Full rules in root `CLAUDE.md`.

**Why:** Chris reviews cold and wants a cheap redirection window *before* the diff is baked in, plus review context anchored on the diff. Merging or racing ahead removes that window.

**How to apply:** After `gh pr create`, post the self-review, say the PR is up, and hand back. Do not merge. Planning/research while waiting is fine; new committed code is not.

**Exception — doc-only PRs self-merge.** If a PR touches only docs/metadata (`docs/**`, `*.md`, `CLAUDE.md`, `tasks/**`, memory, `.gitignore`), open it, post the self-review for the record, and merge it yourself right away (`gh pr merge --squash --delete-branch`) — no waiting for review. Only code/migrations/infra/CI PRs go through the wait.

### No AI attribution trailers in commits or PRs
Never add `Co-Authored-By: Claude ...`, `Claude-Session:`, or `🤖 Generated with Claude Code` to commit messages or PR bodies. Chris does not want them.

**Why:** Corrected mid-first-commit — the global CLAUDE.md and git-guidance default to adding these trailers; Chris overrides that for this repo (and generally).

**How to apply:** Write plain commit messages and PR bodies. If a template or instruction says to append a trailer, drop it.

---

## Web / Next.js

### Behind Traefik, `req.url` is the internal request — build absolute redirects from `APP_BASE_URL`
The Yahoo OAuth callback redirected to `https://<container-id>:4000/?yahoo=connected` because it used `new URL("/…", req.url)`. Behind Traefik (TLS terminated at the proxy) `req.url` reflects the internal request — container hostname + internal port — which the browser can't resolve. Build any external-facing absolute URL (redirects, links in emails, OAuth redirect_uri) from a configured public base (`APP_BASE_URL`), never from `req.url`/`req.headers.host`. Fall back to `req.url` only for local dev where it's already correct.

### OAuth `state` cookie mismatch is usually a retry/multi-tab artifact, not a code bug
`{"error":"state mismatch"}` on the callback means the `state` query param didn't match the cookie set at `/start`. With an httpOnly + `SameSite=Lax` + `Secure` cookie the happy path works; mismatches came from opening `/start` twice (second overwrites the cookie) then completing an older Yahoo tab, or replaying a stale callback URL after the cookie was consumed. A single clean flow works. If it ever fails on a genuinely clean flow behind a proxy/CDN, move the state to a short-lived server-side (Postgres) store instead of a cookie.

## Tooling (this stack)

### pre-commit local hooks shell out to pinned tools — commit/push from inside the dev shell
Our hooks are `repo: local`, `language: system`, calling `pnpm`/`uv` directly (so they match CI and the flake, not pre-commit's isolated envs). That means `git commit` / `git push` must run with the dev shell active — direnv loads it automatically in the project dir. A commit from a bare terminal fails with `Executable 'pnpm' not found`; that's the safety net, not a bug. When committing programmatically (or outside direnv), wrap it: `nix develop --command git commit ...`.

### ruff pre-commit hook needs `pass_filenames: true` (or an explicit path), or it reformats the whole repo
With `pass_filenames: false`, `ruff format` runs with no path argument and walks the entire tree from the repo root — it reformatted Python code blocks inside `docs/`. A `files: ^api/` filter only decides *whether* the hook fires, not *what* ruff touches. Pass the filenames so ruff only sees the files pre-commit selected. (eslint/prettier can keep `pass_filenames: false` because they invoke whole-directory scripts — `next lint` / `prettier --write .` — already scoped to `web/`.) Verify a formatter hook with `pre-commit run --all-files` then `git status` — anything outside the intended dir is a scoping bug.

### pnpm 11: build-script approvals live in `pnpm-workspace.yaml`, and the Dockerfile deps stage must COPY it
pnpm 11 no longer reads the `pnpm` field in `package.json` (`[WARN] The "pnpm" field in package.json is no longer read`). Native postinstall builds (e.g. `sharp`, `unrs-resolver`) are blocked by default and `pnpm install` **exits non-zero** (`ERR_PNPM_IGNORED_BUILDS`) until you approve them — which fails CI and the Docker build. Approvals go in `pnpm-workspace.yaml` under `allowBuilds:` (pnpm scaffolds this exact file/shape for you). The Docker deps stage that runs `pnpm install --frozen-lockfile` must `COPY pnpm-workspace.yaml` alongside `package.json`/`pnpm-lock.yaml`, or the container install re-hits the exit-1.

**Why:** Hit both halves building the skeleton — first the ignored `pnpm` field, then a green local install but a failing `docker build` because the deps stage didn't copy the workspace file.

**How to apply:** Put `allowBuilds:` (or `onlyBuiltDependencies`) in `pnpm-workspace.yaml`, pin pnpm via `packageManager` so corepack matches, and COPY the workspace file in every Docker stage that installs. Verify with an actual `docker compose build`, not just a local `pnpm install`.

### `pnpm/action-setup` reads `packageManager` from the repo-root package.json — point it at the subdir in a monorepo
In CI, `pnpm/action-setup@v4` gets its version from `packageManager` in `package.json`, defaulting to the **repo root**. With the web app under `web/`, there's no root package.json, so it fails: `Error: No pnpm version is specified`. `defaults.run.working-directory` does **not** apply to `uses:` steps.

**Why:** PR #4's first CI run failed here — api passed, web died at the setup step before ever installing.

**How to apply:** Pass `with: package_json_file: web/package.json` to `pnpm/action-setup` (or set `with: version:` explicitly). Same trap for any `uses:` action that needs a path — set its input, don't rely on `working-directory`.

---

## Database (Neon / Drizzle)

### drizzle-kit does timestamp migration filenames natively — no Flyway
`drizzle.config.ts` → `migrations: { prefix: "timestamp" }` yields `YYYYMMDDHHMMSS_name.sql` (verified: `20260726192019_init_hot_tier.sql`). Use `--name` on `db:generate` for a meaningful tag. Keep `casing: "snake_case"` in **both** the config and the runtime `drizzle()` call, or camelCase TS keys map to the wrong columns. Connection: lazy singleton (`getDb()`), never a module-level client — importing it must not require `DATABASE_URL` or `next build` (no DB) throws. `postgres(url, { prepare: false })` for Neon's pooled/pgbouncer endpoint.

### Neon branch actions: 401 = wrong/unscoped API key, not a project-id problem
`create-branch-action` failing with `AxiosError: status code 401` means `NEON_API_KEY` is rejected even though `project_id` is right. Causes: secret holds a stale value (re-save it), trailing newline when pasted, or — most common — the project lives in a Neon **organization** and the key is a *personal* key. Fix: create the API key **inside the org** that owns the project. Verify a key against a project directly: `curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $KEY" https://console.neon.tech/api/v2/projects/<id>` (200 = good).

**Action versions/inputs (verified July 2026):** `create-branch-action@v6` (inputs `project_id`, `api_key`, `branch_name`; outputs `db_url`, `db_url_pooled`), `schema-diff-action@v1` (needs `permissions: pull-requests: write` to post the comment), `delete-branch-action@v3`. `NEON_PROJECT_ID` is a repo **variable**, `NEON_API_KEY`/`PROD_DATABASE_URL` are **secrets**.

---

## Deploy (Dokploy)

### Monorepo Dockerfiles: build from the REPO ROOT context, not per-subdir
Final answer after a long fight: keep both Dockerfiles root-context (`COPY web/...`, `COPY api/...`), point compose at `context: .` with an explicit `dockerfile:`, and use one root `.dockerignore`. In each Dokploy app set **Context Path `.`** and **Dockerfile Path `web/Dockerfile` / `api/Dockerfile`**. This matches Dokploy's default and its most-tested path, and local `docker compose` and Dokploy then use the identical context.

**Why the subdir approach failed:** we first tried subdir-context Dockerfiles + Dokploy Context Path `web`/`api`. That field behaved inconsistently across redeploys — sometimes root context (`transferring context: 671kB`, `pnpm-workspace.yaml not found`), sometimes empty (`2B`, `COPY app not found`). The decisive misconfig was Context Path set to `..` (parent of the clone → empty context, `2B`). Chasing that field was the whole saga; root context removes it entirely. (Differs from triptogether only in that we made it explicit here.)

**Diagnostics that pinpoint it:**
- `#N load .dockerignore … transferring context: 2B` = Dokploy is NOT at your repo root (a real root `.dockerignore` would show its true size). Empty/2B context = wrong Context Path.
- Same BuildKit context ref (`c5019836…`) on every build = the `default` docker-driver builder; its cache/ctx can wedge. Dokploy's "Clean Cache" doesn't always clear it — host-level `docker builder prune -af` or restarting the buildkit/docker daemon does.
- **Redeploying the *same commit*** can hand buildkit a stale/empty cached context. A new commit (new SHA) always gets a fresh context — normal merges deploy fine; only same-SHA re-fires during setup hit this.

**How to apply:** root-context Dockerfiles + `context: .` in compose + Dokploy Context Path `.`. Verify with `docker compose build --no-cache` locally (mimics a clean Dokploy build) before trusting a deploy.

### Separate Dokploy apps talk over `dokploy-network` by service name — set the URL env explicitly
Two-app deploy (web + api as separate Dokploy applications): the web container reaching the api via `http://localhost:4001` hits *itself*, not the api. Set `API_URL=http://<api-service-name>:4001` on the web app's Environment (service name from `docker ps`, e.g. `fantasyhub-api-ovkt8f`); both apps share `dokploy-network` by default so name resolution works. Env changes need an app restart.

**Why:** After both built, the site rendered but showed `API status: unreachable` — the default `localhost` fallback. Setting `API_URL` to the api service name fixed it.

**How to apply:** any cross-app call in a multi-app Dokploy deploy goes to the other app's service name on `dokploy-network`, never `localhost`. Keep a `localhost` default only for local dev.

---

## Carried over from triptogether (stack-agnostic)

These held across the prior project; kept only the ones that port to Next.js + Python.

- **CORS on any browser-facing API from day 1** — wire it in the same PR as the first routes, even before a browser client. Cross-port = cross-origin; curl/unit tests hide the gap.
- **Guard clauses over nested error checks** — return early per failure; keep the happy path un-indented.
- **Best-practice conventions from day 1** — naming, migrations, config format. YAGNI applies to features, not conventions.
- **Split packages upfront when the layout is spec'd** — the docs specify the module layout; scaffold there, don't build monolithic-then-refactor.
- **Verify functional claims by running the thing** — static validation (compile, YAML parse, `docker compose config`) is necessary, not sufficient. Smoke-test each new entry point.
- **Adding a required env var → update the local run path in the same PR** so a fresh clone still boots.
- **A PR isn't done until `git log` shows the commit** — verify state with tools, not mental model.
- **GitHub Actions writing to PRs need `permissions: pull-requests: write`** (token defaults read-only).

---

## Domain invariants to assert (from docs, before they bite)

The six Tier-1 tests that catch silent-wrongness — write these first, assert in code not just tests:

1. Shares/rates are fractions [0,1], never percentages.
2. Adjustments are multipliers centered on 1.0.
3. Spread is home-perspective; negative = home favored.
4. Defense rank 1 = allows most points = best matchup.
5. `reach_delta` positive = drafted earlier than ADP.
6. Scoring parse: half-PPR `rec=0.5` vs full `rec=1.0` reorders the board.

Plus the bye-week guard: `is_playing = false → mean = 0`, enforced in **application logic** (assert before every write) plus a test — not a DB `CHECK` constraint. Business rules stay in the app; the DB is dumb storage.

## pre-commit "installed in migration mode" bug aborts commits

Symptom: `git commit` prints `bug: pre-commit's script is installed in migration mode` and exits non-zero **even though every hook passes**, so the commit silently doesn't land (check `git log`, not the hook output). Cause: the installed `.git/hooks/pre-commit` is an outdated shim.

Fix once: `nix develop --command pre-commit install -f --hook-type pre-commit`, then re-commit. How-to-apply: if a commit "passes hooks" but HEAD didn't move, reinstall the hook before assuming the commit worked.

Also: drizzle-kit `generate` prompts (needs a TTY) when a table both drops and adds a column in one diff (rename-vs-create). In a non-TTY shell it errors. Split into two generates (add first, drop next) so no table has a simultaneous add+drop; name them with `--name=`.
