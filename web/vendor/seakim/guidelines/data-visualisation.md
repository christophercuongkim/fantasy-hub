# Data visualisation

Both products are data products. Bench shows a scoring chart across a matchup; Voyage
shows fare movement over time. Neither could be built, because nothing said what a chart
looks like — which is why Bench's chart tab is currently an empty state.

This is the shortest useful answer, not a charting library. Anatomy, colour, and the
rules that keep a chart recognisably SeaKim.

---

## The problem this has to solve

Every rule in the system pushes one direction: **one accent hue live at a time**, and the
shared layer is achromatic. A chart wants the opposite — a series needs to be told apart
from another series, and that usually means several colours at once.

The resolution is to treat a series count as a design decision rather than a data
property.

## One or two series: no new colour

This covers almost everything either app needs.

| Role | Treatment |
| --- | --- |
| Primary series | `--fill-accent` |
| Comparison series | `--text-tertiary` |
| Area fill under a line | The line colour at 12% |
| Reference or projection | `--border-strong`, 1px dashed |

A head-to-head matchup is you in accent, them in grey. A fare over time is the fare in
accent and its 30-day average dashed. **Nothing new enters the palette**, and the accent
still means "the thing this screen is about".

This is the default. Reach for the categorical ramp only when the data genuinely has more
than two peers.

## Three or more series: the categorical ramp

Six hues, evenly spaced, at fixed lightness and chroma so no series shouts louder than
another. Generated from `tokens/src/color.tokens.json` alongside everything else, and
deliberately **not** derived from the app accent — a chart must read the same whichever
product it is in.

| Step | oklch | Reads as |
| --- | --- | --- |
| `--chart-1` | `oklch(0.70 0.13 245)` | blue |
| `--chart-2` | `oklch(0.70 0.13 145)` | green |
| `--chart-3` | `oklch(0.70 0.13 55)` | amber |
| `--chart-4` | `oklch(0.70 0.13 320)` | plum |
| `--chart-5` | `oklch(0.70 0.13 195)` | teal |
| `--chart-6` | `oklch(0.70 0.13 25)` | red-orange |

Assign **in order, and stably**. Series 1 is always `--chart-1`, in every view, on every
refresh — a colour that moves between renders is worse than no colour. Never sort the
palette by value.

**Six is the ceiling.** A seventh series is not a colour problem, it is a chart problem:
group the tail into "other", split into small multiples, or use a table.

Status colours are **not** available as series colours. Green and red mean success and
danger everywhere else in the system, and a chart is not exempt from that.

## Anatomy

```
  120 |                                    <- axis label, --type-data --text-tertiary
      |            ...........
   80 |- - - - -.-´- - - - - - -           <- gridline, 1px --border-subtle
      |     ..-´
   40 |..-´                                <- series, 2px --fill-accent
      |
    0 +----+----+----+----+----+
       Q1   Q2   Q3   Q4                   <- axis, 1px --border-default
```

| Part | Treatment |
| --- | --- |
| Plot area | No fill, no border. It sits in the page, so it gets neither. |
| Axis line | 1px `--border-default`. Baseline only — no box around the plot. |
| Gridlines | 1px `--border-subtle`, horizontal only, 3–5 of them. Never both directions. |
| Axis labels | `--type-data`, `--text-tertiary`, tabular figures |
| Line series | 2px, square caps and joins, no smoothing |
| Bar series | Square corners. Gap is 25% of bar width. |
| Point marker | 6px square, shown at data points only when there are fewer than 20 |
| Legend | Only with 3+ series. Otherwise label the series inline at its end. |

**No smoothing on lines.** A monotone curve invents values between the points you
measured. Straight segments are honest about sampling.

**Square corners on bars, square caps on lines** — the radius rule does not stop at the
plot area.

**No shadows, no gradients, no 3D, no pie charts.** A pie is a bar chart that is harder to
read; if the parts sum to a whole and there are more than three, use a stacked bar.

## Axes and honesty

- **Bar charts start at zero.** Always. A truncated bar axis misrepresents the ratio,
  which is the only thing a bar chart is for.
- **Line charts may truncate**, because they show change rather than magnitude — but the
  axis must be labelled so the truncation is visible.
- **Label the unit once**, on the axis, not on every tick.
- **State the source and cadence** near any live chart, the same way the matchup screen
  says scores update every 30 seconds. A number without provenance is decoration.

## Interaction

| State | Treatment |
| --- | --- |
| Hover a point | 1px `--border-strong` vertical crosshair, plus a readout |
| Readout | A popover, `--shadow-popover`, positioned near the cursor but never under it |
| Selected range | `--surface-selected` band behind the plot |
| Touch | No hover. Values live in a caption or a table below the chart. |

**Never animate a value the user is reading** — the readout number cuts, it does not
count up. The line may draw in on first render at `--dur-slow`; it does not re-animate on
data change.

## At `sm`

A chart is one of the few things that genuinely cannot restack, so it adapts instead:

- Drop to 2–3 gridlines.
- Label the first and last tick only.
- Move the legend below the plot, or delete it and label series inline.
- Below roughly 240px wide, **replace the chart with the table it summarises.** A chart
  too small to read is worse than the numbers it came from.

## Accessibility

A chart is the easiest place to fail the colour-alone rule, and the most common.

- **Never colour alone.** Lines get distinct dash patterns or end labels; bars get direct
  labels or a pattern. Check it in greyscale.
- **Every chart has a text equivalent.** Either a caption stating the takeaway ("Bench
  Warmers lead by 1.0 with two players still to play") or a linked data table. This is the
  one that gets skipped.
- Chart colours are only guaranteed against `--surface-page` and `--surface-card`.
- The chart element carries a label and a description; individual points are not
  separately focusable unless they are interactive.

## What exists today

**The tokens, and nothing else.** `--chart-1` through `--chart-6` are emitted to CSS, and
to Dart as `SkChartPalette.series1`–`series6` with `SkChartPalette.ordered` for assignment
order. There is still no chart *component* in either binding, and nothing consumes the
tokens yet.

This page is the spec that unblocks writing one, and the next data screen either app needs
is the demand that should trigger it — per
[0001](../decisions/0001-platform-neutral-spec-layer.md), specs are written on demand and
so is the code.

When it is built: the tokens belong in `tokens/src/color.tokens.json` under a `chart` key,
so they generate to every binding like everything else.
