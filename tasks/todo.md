# Integration: seakim design system — "bench" theme

> **✅ COMPLETE 2026-08-07.** All four PRs merged — PR A landing (#45), PR B
> `/hall_of_records` (#47), PR C `/admin/crosswalk` (#53), PR D `/login` +
> **Tailwind removed entirely** (#54) — plus a full DS-conformance audit pass
> (#55: `--type-*` roles, `--tracking-tight`, DS `Button` for sign-out, tooltip
> `pointer-events` regression). No page uses Tailwind; DS v3.1.0 vendored with
> governance docs. Next: **draft superlatives** (see `resume-point` memory). The
> original plan is preserved below.


Adopt `@seakim/design-system` v3.0.1 (the **bench** fantasy-sport theme,
`data-app="bench"`, turf hue 145) as fantasy-hub's UI. Next 15 App Router /
React 19 / pnpm — the DS's supported target.

## Decisions (locked with Chris)
1. **Vendor**, don't install. Copy the published surface into `web/vendor/seakim`,
   alias `@seakim/design-system` → it. Zero private-repo auth in CI/Docker/Dokploy
   (sidesteps the unverified Dokploy build-secret question). Re-vendor on version
   bumps via a script. ✅
2. **Remove Tailwind** (phased). Coexist with `preflight:false` during rollout;
   convert pages PR-by-PR; delete Tailwind in the last PR. Pure DS components +
   `var(--…)` for layout — **no Tailwind token bridge.** ✅
3. **Dark** default theme; no-flash localStorage script wired regardless. ✅

## PR sequence (each QA-verifiable via deploy-qa before merge)
- **PR A — plumbing + proof** (this branch, `feat/design-system-bench`)
  - `web/scripts/vendor-seakim.sh` — copies the DS surface from the sibling repo
    into `web/vendor/seakim`; strips the Google-fonts `@import` from the vendored
    `tokens/fonts.css` (we self-host via `next/font`, so no double-fetch).
  - Vendor the surface: `index.js`, `index.d.ts`, `styles.css`, `components/`,
    `tokens/`, `ui_kits/shared/`.
  - `tsconfig.json` path alias `@seakim/design-system` (+ `/*`) → vendor; exclude
    vendor from our typecheck (upstream, conformance-tested there — Next still
    compiles it when imported).
  - eslint/prettier ignore `vendor/`.
  - `pnpm add @phosphor-icons/web` (public npm, no auth).
  - `app/fonts.ts` (next/font: Outfit / Plus Jakarta Sans / IBM Plex Mono → the
    CSS vars the DS reads).
  - `app/layout.tsx`: DS token CSS + phosphor CSS + font vars + `data-app="bench"`
    + `data-theme="dark"` + no-flash script + `suppressHydrationWarning`.
  - `tailwind.config.ts`: `corePlugins: { preflight: false }` so the DS base wins
    while Tailwind still works during migration.
  - Convert **landing (`app/page.tsx`)** to DS components — the proof it renders.
  - Verify: `pnpm build` + `typecheck` + `lint`, then QA deploy.
- **PR B — `/hall_of_records`** → `Stat`/`Card`/`Table`; restyle the d3 charts to
  read DS tokens (keep d3, recolor via `var(--…)`).
- **PR C — `/admin/crosswalk`** → `Table` (client wrapper for its function props),
  `Field`/`Button`/`Badge`.
- **PR D — `/login` + sign-out** → DS; then **remove Tailwind** entirely
  (`tailwind`, `autoprefixer`, `postcss` config, `globals.css`).

## Gotchas handled
- **Font double-fetch:** strip the `@import` in the vendored `tokens/fonts.css`;
  `next/font` self-hosts to the same CSS vars.
- **Client boundary:** import from the barrel (`@seakim/design-system`) — one
  `"use client"` covers all. Function-prop components (`Table`, `Slider`,
  `DatePicker`) need a `"use client"` wrapper (PR C).
- **Vendored code isn't ours:** excluded from lint/format/typecheck; Next compiles
  it on import.

## Review — PR A implemented
Branch `feat/design-system-bench`:
- `web/scripts/vendor-seakim.sh` + vendored surface `web/vendor/seakim` (v3.0.1,
  524 KB); Google-fonts `@import` stripped from the vendored `fonts.css`.
- `tsconfig` alias `@seakim/design-system` (+`/*`) → vendor, vendor excluded from
  typecheck; eslint + prettier ignore `vendor/`.
- `@phosphor-icons/web` added; `app/fonts.ts` (next/font).
- `app/layout.tsx`: DS styles + phosphor + fonts + `data-app="bench"` +
  `data-theme="dark"` + no-flash script; sign-out button re-styled with DS tokens.
- `tailwind.config.ts`: `corePlugins.preflight = false` (coexist).
- `app/page.tsx` landing → DS `Card`s in `Link`s.

**Verified:** `typecheck` ✓, `build` ✓ (Next compiles the vendored `.jsx`; `/`
= 4.51 kB), `lint` ✓ (vendor ignored), `format` ✓. Dev-server render shows
`data-app="bench"`, `data-theme="dark"`, the no-flash script, the DS `Card`; built
CSS contains DS tokens (`--surface-card`, `--space-5`) and the `[data-app=bench]`
accent block. QA deploy is the visual confirmation.
