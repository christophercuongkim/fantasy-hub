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

### Auth.js v5 behind Traefik needs `trustHost: true` **and** a real `AUTH_URL` env var
Same class as the `req.url` bug, in the Auth.js/Google flow. Two distinct failures, in order:
1. **`error=Configuration`** + a redirect to `https://<container-id>:4000/api/auth/error`. Auth.js v5 defaults `trustHost: false` in production, rejects the proxied host, and falls back to the container host. Fix: `trustHost: true` in the `NextAuth({…})` config.
2. **After that, the Google `redirect_uri`/`callbackUrl` still used the container host** (`/api/auth/providers` advertised `https://<container-id>:4000/api/auth/callback/google`). `trustHost` only lets Auth.js *accept* the forwarded host; Dokploy's Traefik doesn't present the public host to the app, so it needs the origin pinned. Fix: set **`AUTH_URL=https://<public-host>`** as a real env var, per deployment (qa + prod each their own).

**Don't** try to reuse `APP_BASE_URL` by mutating `process.env.AUTH_URL` inside `auth.ts` — it doesn't work. `import NextAuth from "next-auth"` is hoisted above the module body and next-auth reads `AUTH_URL` at import, before the assignment runs. Verify the fix from outside with `curl https://<host>/api/auth/providers` and check the Google `callbackUrl` is the public host, not `<container-id>:4000`. `AUTH_URL` is per-env and web-only (the api has no auth) — a missing prod `AUTH_URL` breaks prod sign-in identically.

### Dokploy shared (project/environment) vars are NOT inherited — each service must reference `${{project.VAR}}`
Set `DATABASE_URL` at the QA **project** level, expecting web-qa + api-qa to inherit it. They didn't: web-qa booted with no `DATABASE_URL` and every DB-backed page threw `Error: DATABASE_URL is not set` (`getDb()`), while `/` and `/login` (no DB) worked — a tell-tale "only the DB pages 500" pattern. Dokploy does **not** auto-inject project vars; a service receives a shared var only if its **own** env tab contains the reference line `DATABASE_URL=${{project.DATABASE_URL}}` (env-level: `${{environment.VAR}}`). Symptoms were masked because `migrate` used the separate `DATABASE_URL_QA` *GitHub secret* (worked), and `AUTH_URL` worked because it was set *directly* on the service. **How to apply:** for every shared var, add the `${{project.VAR}}` reference line in *each* consuming service, then verify from the **container logs/runtime env**, not the project tab. For a solo setup, setting values directly per-service is one less moving part. A DB smoke check catches a missing runtime `DATABASE_URL` immediately: **signed in**, `/hall_of_records` → 200 (not 500). (Signed out it 302s to login — the hall of records is gated, so there's no public DB page to curl.)

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

### Never guard a pg ENUM column with a string check (`<> ''`) — it crashes at query time

`where p.position <> ''` on an enum column threw `invalid input value for enum "position": ""` (SQLSTATE 22P02) and 500'd the whole page — Postgres casts the `''` literal to the enum to compare, and `''` isn't a valid member. It **typechecks fine** (drizzle types the column as `string`) and only fails when the query runs against the DB, so `next build` and local typecheck stay green. **Why:** an enum's domain is its members, not "any string" — there is no empty enum value to compare against. **How to apply:** an enum column can't be `''`; if it's `NOT NULL` it needs no guard at all, and if nullable use `is not null` (never `<> ''`). More generally: a query that only touches types (no live DB in CI) is unverified until it runs — a page reading the DB needs an actual request against real rows before "done," not just a green typecheck. Same spirit as the ADP source-count lesson below — verify against the real thing.

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

## Design system (seakim DS) + UI

### Read the DS guideline BEFORE writing UI — and vendor the rules in-repo
Twice this cost a redo: recoloured the charts (turf accent-at-opacity) before reading `guidelines/data-visualisation.md`, then again before finding the accepted `--chart-seq` ramp. **Why:** the rule existed, just not *here*. **How to apply:** the DS is Law (`CLAUDE.md` "Design system (binding)"); consult `web/vendor/seakim/{conformance.md,guidelines/data-visualisation.md,decisions/}` first, and run the dataviz skill for charts. If a rule seems missing, it's probably in a doc you haven't opened.

### Vendor the governance docs too, and re-vendor with the governance-aware script
`vendor-seakim.sh` must copy `conformance.md` + `spec/` + `decisions/` + `guidelines/`, not just the runtime surface — else the rules aren't in-repo to check against (and an agent can't cite them). **Trap:** re-vendoring a branch that has an *older, runtime-only* script silently **deletes** the governance docs from the vendor dir; merging it regresses them off `main`. After any re-vendor, verify `web/vendor/seakim/` still has `conformance.md`/`guidelines/`/`decisions/`.

### DS `Table` (and `useMeasuredBreakpoint`) branch on CONTAINER width, not the viewport
A table in a 2-col grid column (~560px) reflows to the compact `sm` list-row species **on a laptop**, because it measures its container, not the window. Symptom: "everything's compact on desktop." **How to apply:** give data tables the full page width (stack them); only put things in narrow columns if you want their narrow layout. Function-prop DS components (`Table`/`Slider`/`DatePicker`: `render`/`rowKey`/`format`) also need a `"use client"` wrapper — a Server Component can't pass functions across the boundary.

### A DS `Card` with only `eyebrow` + `meta` reads all-grey — it needs a `title`
`eyebrow`=`--text-tertiary`, `meta`=`--text-secondary` (both grey); `title`=`--text-primary` is the only high-contrast element (`#f5f3f0` on dark — *not* grey). **Rule:** text is achromatic — primary (headings/values) / secondary / tertiary; `--text-accent` is for **links + highlights only**, and "one accent hue live at a time." So never colour card titles or table headers; make a card stand out via its border/surface (`Card selected`), not coloured text.

### Charts: magnitude ≠ the app accent; emphasis = the accent
Heatmaps/rank grids use the fixed indigo sequential ramp `--chart-seq-1..4` (product-independent — a scale must read the same in every app), **not** `--brand-*` and never raw ramp steps. Every seq cell needs a hairline border (`--chart-seq-1` is ~1.2:1 from the card). Label ink flips at the **theme-dependent** `--chart-seq-ink-flip` token — read it with `getComputedStyle` + a `MutationObserver` on `data-theme`; d3 can't interpolate the oklch tokens, so map to discrete `var(--chart-seq-N)` steps. Series identity: 1–2 = accent + `--text-tertiary`; 3–6 = the fixed `--chart-1..6`; >6 over time = achromatic trajectories + one highlighted. The **one accent** is emphasis (champ ring, pinned line) — grey `--border-strong` is for neutral reference lines, not "pick this out." Content corners are square (`rx={0}`).

### Hover-only highlighting fakes a filter on touch but dies on desktop
A tap fires no `mouseleave`, so a hover highlight *sticks* on mobile and looks like a click-to-filter; on desktop it clears the instant the pointer leaves. **How to apply:** for a real filter add an explicit **pinned-on-click** state (hover previews, falls back to the pin) **and keyboard focus** (`tabIndex`/`onFocus`/Enter-Space) — ADR 0016 says pointer-only is non-conformant, and touch/SR need a non-pointer equivalent (the adjacent grid, or in-cell text — not tooltip-only values).

### Chart *layout* is an app concern; propose an ADR when the DS actually lacks a rule
Arranging/sizing multiple charts (grid, grouping, relative heights) breaks no DS rule — only each chart's internal anatomy/colour is governed (keep ADR 0016's bump-chart-above-its-grid). Group charts by aspect for even rows; a fixed height + default `preserveAspectRatio="meet"` matches near-square heatmaps' heights without distorting cells. When the DS genuinely punts (no sequential ramp; the >6-series case), **write an ADR upstream** rather than improvising per-app — 0015/0016 went from proposed → accepted and shipped `--chart-seq-*`.

### Fonts: strip the Google `@import` from the vendored `fonts.css`
`next/font` self-hosts the three families to the same `--font-*` vars; leaving the token file's `@import` in double-fetches from Google. The vendor script strips it.

### Iterating UI on QA while GitHub Actions is down
Auto-deploy (a workflow) can't run, but git push can: `git push --force origin <branch>:refs/heads/qa`, then **Dokploy → web-qa → Deploy** (builds from `qa`). No migration step means nothing else the workflow would've done is skipped. Single shared QA slot, so force-pushing `qa` is how you point it at your branch fast.

### Removing a utility framework: grep EVERY `className=`, not just utility prefixes
Ripping out Tailwind, I verified "no Tailwind left" with `grep -E 'className="[^"]*(flex|grid|text-|bg-|rounded|px-|dark:)'` — a prefix whitelist. It missed `className="pointer-events-none"` (no matching prefix), which then had **no backing CSS** and silently broke a cursor-following tooltip (it started capturing pointer events). **Why:** a verification grep that enumerates the patterns you *expect* can't catch the one you didn't. **How to apply:** when removing a class-based framework, grep the *broad* signal (`className=`) and eyeball the full list, classifying each survivor (framework utility → fix; legit CSS-var/keyframe class like `fontVariables`/`sl-*` → keep). Same principle generally: verify against the wide net, then subtract the known-good — don't verify against a narrow net and assume the complement is empty.

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

## Make treats a bare `#` as a comment — escape flake/nix refs

`SCRAPE_SHELL := nix develop '..#scrape'` silently becomes `nix develop '..` because Make starts a comment at `#`, even inside quotes. Same bites `nix shell nixpkgs#chromium`. Symptom: the target runs a truncated command. Fix: escape every `#` as `\#` in Makefiles (`'..\#scrape'`, `nixpkgs\#chromium`). Verify with `make -n <target>` — dry-run prints the fully expanded command.

## De-risk a scrape source with your SHIP fetch method + a row-COUNT check, not an eyeball

Picking an ADP source, I `curl`'d a FantasyPros page, saw McCaffrey + Tyreek Hill in a `"rows":` blob, and assumed the full ~300-player board was there. It wasn't — the page inlines only a ~5-row teaser and renders the rest via bundled JS; the real `urllib` fetch (what the importer actually ships) returned **5 players**, not 300. Nearly built a whole ingest on a source that serves 2% of the data to a non-JS client. **Why:** eyeballing the first few rows confirms the data *exists*, not that your fetch *gets all of it*; and `curl` in a terminal can differ from the library call you'll ship. **How to apply:** when de-risking a source, (1) fetch with the exact method the code will use (same lib, headers, no browser), and (2) assert the **count** against what you expect (`len(rows) >= ~150`, not "McCaffrey is in there"). If the count is short, the data is JS-rendered or paginated behind an API — find that endpoint (or switch sources) before writing the parser. The switch here was to FantasyFootballCalculator's JSON API, which returns the whole board to a plain GET.

## A pinned data client silently 404s when the upstream restructures — "404" ≠ "no data"

`nfl_data_py 0.3.3` hardcodes nflverse's `player_stats/player_stats_{year}` URL, which nflverse **froze at 2024** when they moved current weekly stats to a new `stats_player` release (`stats_player_week_{year}`, all seasons). Fetching 2025 → HTTP 404, and my first read was "2025 isn't published yet" — wrong: the data existed, at a path the stale client didn't know. **Why:** a pinned/vendored client's URLs rot when the upstream reorganizes its releases; a 404 means *that path* is gone, not that the data doesn't exist — and "the season isn't out yet" is a seductive wrong answer. **How to apply:** when a client 404s on recent data, check the live source's actual layout (GitHub Releases API — `/repos/<org>/<repo>/releases/tags/<tag>`, grep the asset names) for the current file before concluding "no data." Fix by reading the current URL directly + normalizing any renamed columns (here `team→recent_team`, `passing_interceptions→interceptions`) rather than waiting on an unmaintained client. Bonus tell: this hid because the ingest test never mocked the player_stats fetch (a real network call) — mock external fetches so tests run offline and a dead URL fails loudly in CI, not silently in prod.

## Slim container images have no curl — run in-process for scheduled/exec jobs

**What happened:** The `/jobs/refresh-current` runbook told Dokploy to run
`curl -fsS -X POST http://localhost:4001/jobs/refresh-current` inside the api
container. It failed: `curl: command not found` — the api image is a slim Python
base with no curl or wget. (Ironic: I'd been reaching the same api via
`docker exec … python -c "urllib…"` all along, precisely because there's no curl,
then wrote `curl` in the runbook anyway.)

**Why it matters:** A container command can only use what's in the image. For an
app image that's the language runtime + the app — not the shell utilities you have
on a dev box.

**How to apply:** For a scheduled task or `docker exec` against an app container,
prefer running the work **in-process** — expose the job as a module
(`python -m app.<job>`, invoked through the image's runner, e.g. `uv run`) instead
of an HTTP self-call. No curl dependency, no nested-quote fragility under the
scheduler's `bash -c`, no network round-trip, and the exit code drives
success/failure. Only reach for an HTTP client in-container if you've confirmed
one is installed. Factor the endpoint's logic into a plain function so the HTTP
route and the module entrypoint share it.

## MODEL_VERSION bump requires a Refresh-all — or projections silently serve stale

**Symptom:** the matchup sim showed teams with 5–7 projected starters even after the
roster crosswalk fix filled all 12 teams to 7 real starters. The gap was 2025
rookies (Jeanty, Henderson, Hunter, McMillan…) rostered-and-started with no
projection — despite the draft-priors model (#77, `layer3-priors-1`) being merged
specifically to project no-history drafted players from their ADP.

**Root cause:** the 2025 projections on QA/prod were still `layer3-dist-1` (10,182
rows) — the priors model *never ran* against them. When #77 merged, its post-merge
"click Refresh all" step was deferred as "offseason", so the `MODEL_VERSION` bump
(`layer3-dist-1 → layer3-priors-1`) never triggered a re-projection. The code was
correct: `draft_population(league, 2025)` returns the rookies (180 picks, 158
resolved, 139 ADP), and `_projected_weeks` is MODEL_VERSION-scoped so Refresh-all
*would* re-project — it just was never run.

**Why + how to apply:** a `MODEL_VERSION` bump only takes effect after a re-projection
— the invalidation is lazy (weeks not at the current version get re-projected on the
next backfill), not eager. Bumping the constant in a PR does nothing to already-stored
rows until Refresh-all runs. **So: any PR that changes `MODEL_VERSION` is not "done"
until Refresh-all has run on every env that serves projections (QA *and* prod), not
just merged.** Treat the Refresh-all as part of the PR's deploy checklist, not an
optional follow-up. Verify with `SELECT model_version, count(*) FROM projections
GROUP BY 1` — a lingering old version means stale model output is being served.
