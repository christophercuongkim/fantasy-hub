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

## Tooling (this stack)

### pnpm 11: build-script approvals live in `pnpm-workspace.yaml`, and the Dockerfile deps stage must COPY it
pnpm 11 no longer reads the `pnpm` field in `package.json` (`[WARN] The "pnpm" field in package.json is no longer read`). Native postinstall builds (e.g. `sharp`, `unrs-resolver`) are blocked by default and `pnpm install` **exits non-zero** (`ERR_PNPM_IGNORED_BUILDS`) until you approve them — which fails CI and the Docker build. Approvals go in `pnpm-workspace.yaml` under `allowBuilds:` (pnpm scaffolds this exact file/shape for you). The Docker deps stage that runs `pnpm install --frozen-lockfile` must `COPY pnpm-workspace.yaml` alongside `package.json`/`pnpm-lock.yaml`, or the container install re-hits the exit-1.

**Why:** Hit both halves building the skeleton — first the ignored `pnpm` field, then a green local install but a failing `docker build` because the deps stage didn't copy the workspace file.

**How to apply:** Put `allowBuilds:` (or `onlyBuiltDependencies`) in `pnpm-workspace.yaml`, pin pnpm via `packageManager` so corepack matches, and COPY the workspace file in every Docker stage that installs. Verify with an actual `docker compose build`, not just a local `pnpm install`.

### `pnpm/action-setup` reads `packageManager` from the repo-root package.json — point it at the subdir in a monorepo
In CI, `pnpm/action-setup@v4` gets its version from `packageManager` in `package.json`, defaulting to the **repo root**. With the web app under `web/`, there's no root package.json, so it fails: `Error: No pnpm version is specified`. `defaults.run.working-directory` does **not** apply to `uses:` steps.

**Why:** PR #4's first CI run failed here — api passed, web died at the setup step before ever installing.

**How to apply:** Pass `with: package_json_file: web/package.json` to `pnpm/action-setup` (or set `with: version:` explicitly). Same trap for any `uses:` action that needs a path — set its input, don't rely on `working-directory`.

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
