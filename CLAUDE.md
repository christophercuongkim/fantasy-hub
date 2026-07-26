# fantasy-hub — Working Agreement

Repo-specific rules. Layers on top of the global `~/CLAUDE.md`.

## Delivery: commit → PR → wait for review

**The standard for every non-trivial change:**

1. **Surface design decisions in chat first.** Numbered list of the calls (data model, endpoint surface, error semantics, transactional boundaries, defaults). Wait for explicit yes/no *before* writing code. Auto mode licenses trivial calls, not architectural ones.
2. **Branch** `feat/<name>` (or `fix/`, `chore/`, `docs/`) from `origin/main`. Never work on `main`. Sync by **rebase**, never merge.
3. **Implement + commit.** No `Co-Authored-By` or Claude Code trailer in commit messages — Chris does not want them.
4. **Open the PR** with `gh pr create`. No Claude Code trailer in the PR body either.
5. **Post a self-review pass** on the PR — line-anchored comments on the non-obvious bits (design choices, workarounds, sentinels, "why not the obvious approach"), plus a light top-level summary with skim order. Comments live on the PR, **not** in source.
6. **STOP and wait.** Chris reviews manually. Do not merge. Do not start the next PR's code until review comes back. While waiting, planning/research/scaffolding notes are fine; new committed code is not.
7. **Address review** in follow-up commits on the same branch, then re-request.

**Merge speed exception:** docs/metadata-only chore (touches only `docs/**`, `README.md`, `*.md`, `.gitignore`, `CLAUDE.md`, memory) → open and merge immediately, no CI wait. Anything touching code/migrations/infra/CI → full flow above.

**Done bar:** a PR isn't done until `git log` shows the commit. Verify with `git status` / `git log`, not memory. Tooling changes: run the thing end-to-end, not just static checks.

## Conventions (best-practice from day 1, not solo-dev shortcuts)

- **Migrations:** timestamp filenames `YYYYMMDDHHMMSS_name.sql`, never sequence numbers.
- **DB is dumb storage, app holds logic.** Declarative constraints only (`NOT NULL`, `UNIQUE`, `CHECK`, `FK`, `DEFAULT <literal|now()|gen_random_uuid()>`). No triggers/procs/functions. `updated_at` bumped by the app. (The projections bye-guard `CHECK` is declarative → allowed.)
- **CORS from day 1** on any browser-facing API, even before a browser client exists.
- **Config + its CI enforcer land in the same PR.** Don't disable a tool default unless the replacement ships in the same PR.
- **GitHub Actions writing to PRs** need explicit `permissions: pull-requests: write`.

## Deploy (see `docs/` + carried tailscale runbook)

Dokploy on VPS, Tailscale-gated webhook, CI joins tailnet and `curl`s the deploy hook. Autodeploy toggle = a *gate* (keep On). Webhook needs both `X-GitHub-Event: push` header and `{"ref":"refs/heads/main"}` body. Concurrency group includes `event_name`.

## Lessons

After any correction, append the pattern to `tasks/lessons.md` (why + how-to-apply). Review it at session start.
