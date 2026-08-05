# 0015 — A sequential (magnitude) chart ramp

- **Status** Proposed
- **Date** 2026-08-05
- **Affects** every binding; `guidelines/data-visualisation.md`; `tokens/src/color.tokens.json`

## Context

`guidelines/data-visualisation.md` decides colour for two chart jobs: **identity**
(1–2 series → accent + grey; 3–6 → the fixed `--chart-1..6` categorical ramp) and
leaves **magnitude** undefined. But magnitude is a real, recurring job — a finish-
rank grid, a head-to-head win-rate matrix, any heatmap or choropleth — and it is
exactly the case the categorical ramp is wrong for (six discrete hues cannot show
"more vs less").

With nothing specified, a binding improvises, and the two obvious improvisations
both break a system rule:

- **App-accent ramp** (`--brand-100..900` as a light→dark scale) reads raw ramp
  steps — which `conformance.md` forbids — and makes the same chart look different
  in Bench (turf) vs Voyage (sea), which contradicts the categorical ramp's own
  rationale ("a chart must read the same whichever product it is in").
- **Accent-at-opacity** (`--fill-accent` at a varying alpha) keeps to one accent
  hue and is a clean extension of the sanctioned "area fill = line colour at 12%",
  but it is still per-app and undocumented, so every consumer picks its own floor
  and stop count.

The first real consumer hit this already: fantasy-hub's Hall of Records has a
finish-rank grid and a win-rate matrix. It ships **accent-at-opacity** as an
interim (14%→100%), explicitly pending this decision.

## Decision (proposed)

Add a **single-hue sequential ramp**, fixed and product-independent, to
`tokens/src/color.tokens.json` under `chart.seq`, generated to every binding like
`--chart-1..6`:

- **Fixed, not app-accent.** Same rationale as the categorical ramp: a magnitude
  chart reads identically in every product. This is the main call to ratify.
- **One hue, light→dark**, 5 steps, `--chart-seq-1..5`, at monotonic lightness so
  order is legible in greyscale (sequential single-hue is CVD-safe by
  construction — no adjacent-pair check needed).
- **Its own dark-mode steps**, selected against `--surface-card` / `--surface-page`
  and validated, not an automatic flip (per the light-mode-is-first-class rule).
- **A documented text-on-cell rule**: label ink flips to `--text-inverse` above a
  named step; the floor step stays distinguishable from an empty cell.

Then `data-visualisation.md` gains a "Magnitude" section pointing at it, and
`conformance.md` can name accent-at-opacity as the **only** sanctioned fallback
where a fixed ramp is deliberately not wanted (e.g. a one-off tint tied to the
screen's accent).

## Open question for sign-off

Fixed hue vs app-accent for *sequential* specifically. The categorical ramp chose
fixed for cross-product consistency; a magnitude ramp arguably wants the same. The
counter-argument is that a lone heatmap on an otherwise-accent screen may want to
belong to that screen — which is the accent-at-opacity case, and why it survives as
the documented exception rather than being banned.
