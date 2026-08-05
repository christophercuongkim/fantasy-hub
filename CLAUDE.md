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

**Doc-only PRs self-merge — no waiting for review.** If a PR touches only docs/metadata (`docs/**`, `README.md`, `*.md`, `.gitignore`, `CLAUDE.md`, `tasks/**`, memory), open it, post the self-review for the record, and **merge it yourself immediately** (`gh pr merge --squash --delete-branch`). Do not sit in step 6. Anything touching code/migrations/infra/CI → full flow above, including the wait.

**Done bar:** a PR isn't done until `git log` shows the commit. Verify with `git status` / `git log`, not memory. Tooling changes: run the thing end-to-end, not just static checks.

## Conventions (best-practice from day 1, not solo-dev shortcuts)

- **Migrations:** timestamp filenames `YYYYMMDDHHMMSS_name.sql`, never sequence numbers.
- **DB is dumb storage, app holds logic.** Declarative constraints only (`NOT NULL`, `UNIQUE`, `CHECK`, `FK`, `DEFAULT <literal|now()|gen_random_uuid()>`). No triggers/procs/functions. `updated_at` bumped by the app. The projections bye-guard (`is_playing = false → mean = 0`) is enforced in **application logic** — assert it before every write — not as a DB `CHECK`. Keeps all business rules in one place.
- **CORS from day 1** on any browser-facing API, even before a browser client exists.
- **Config + its CI enforcer land in the same PR.** Don't disable a tool default unless the replacement ships in the same PR.
- **GitHub Actions writing to PRs** need explicit `permissions: pull-requests: write`.

## Design system (binding)

The UI is the **seakim design system**, vendored at `web/vendor/seakim` (bench
theme, `data-app="bench"`). Its rules are **Law** for colour/component/layout
decisions — not taste. Read the vendored source before overriding a default.

- **`web/vendor/seakim/conformance.md` is binding.** One accent hue live at a
  time; the shared layer is achromatic; **semantic tokens only** — never read raw
  ramp steps (`--brand-*`).
- **Charts** follow `web/vendor/seakim/guidelines/data-visualisation.md` *and* the
  dataviz skill: 1–2 series = accent + `--text-tertiary`; 3–6 = the fixed
  `--chart-1..6` categorical ramp (never the app accent); **6 is the ceiling**;
  status colours are never series colours. No sequential ramp exists yet, so
  magnitude reads as accent-at-opacity (see DS ADR `decisions/0015`, proposed).
- Component contracts live in `spec/`; the *why* in `decisions/` (ADRs).
- Import from the barrel `@seakim/design-system`; `var(--…)` tokens for layout.
  Function-prop components (`Table`/`Slider`/`DatePicker`) need a `"use client"`
  wrapper. Tailwind is being removed page-by-page (`preflight:false` meanwhile).
- Re-vendor on a DS version bump with `web/scripts/vendor-seakim.sh` (pulls the
  governance docs too). Never hand-edit `web/vendor/`.

## Deploy (see `docs/` + carried tailscale runbook)

Dokploy on VPS, Tailscale-gated webhook, CI joins tailnet and `curl`s the deploy hook. Autodeploy toggle = a *gate* (keep On). Webhook needs both `X-GitHub-Event: push` header and `{"ref":"refs/heads/main"}` body. Concurrency group includes `event_name`.

## Lessons

After any correction, append the pattern to `tasks/lessons.md` (why + how-to-apply). Review it at session start.
