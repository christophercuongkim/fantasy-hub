# Token source

**Hand-edit files in here. Everything they generate is disposable.**

Per [decision 0007](../../decisions/0007-token-source-format.md). CSS used to be the
source, which privileged the web: every other binding had to either parse
`oklch()` inside nested `[data-app]` selectors, or keep a hand copy. Flutter kept a hand
copy — eleven lightness/chroma pairs and four hues, duplicated and unchecked — and it
drifted silently for months. That is the failure mode this folder removes.

## Build

```bash
node tool/build-tokens.mjs           # write outputs
node tool/build-tokens.mjs --check   # fail if outputs are stale (CI)
```

## What generates what

| Source | Outputs |
| --- | --- |
| `color.tokens.json` | `tokens/colors.css`, `tokens/theme-light.css`, `tokens/apps.css`, `flutter/lib/src/tokens/palette.g.dart`, `tokens/generated/colors.ts` |

Outputs are **committed**, not built on install — so a binding author can read the CSS
without a toolchain, and so diffs stay reviewable.

## Why colour stays in oklch here

The source stores `oklch(L C H)`, not hex. Each emitter resolves it for its platform: CSS
writes the `oklch()` function and lets the browser do the work at full gamut; Dart and
Swift get sRGB baked with **chroma-reduction gamut mapping**.

That mapping is the real prize. Clipping out-of-gamut linear RGB shifts hue, which would
break the promise that every app’s ramp differs only in H — so contrast ratios would stop
holding across products. Reducing chroma until the colour fits preserves hue and lightness
instead. Three bindings independently getting that right was never going to happen; now it
is one function.

## Adding an app

1. Verify the hue: `oklch(0.72 0.13 H)` clears 4.5:1 on `--stone-950`, and
   `oklch(0.56 0.14 H)` clears 4.5:1 on `--stone-50`.
2. Add it to `hue` in `color.tokens.json`.
3. Add the `[data-app]` alias list in `tool/build-tokens.mjs` (`aliases`).
4. Add the case to `SkAppBrand` in `flutter/lib/src/tokens/sk_colors.dart`.
5. Run the build.

## Phases still to do

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Colour + app hues | **Done** |
| 2 | Dimension — space, control heights, chrome | Not started |
| 3 | Typography, motion | Not started |

Phases 2 and 3 are lower value: those files are stable and rarely touched, and no binding
has duplicated them yet. Do them when something forces the issue, not on principle.
