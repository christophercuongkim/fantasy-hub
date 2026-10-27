# 0035 — Controls take `lg`, cards take `xl`; `md` and `2xl` are pruned

- **Status** Accepted
- **Date** 2026-09-18
- **Affects** Tier 0 §0.1 in `conformance.md`, `tokens/radius.css`, `SkRadius`, the `LADDER`
  in `tool/conformance-check.mjs` (per 0012); every binding. Extends
  [0030](0030-corners-take-a-radius-ladder.md); executes decision 5 of [0033](0033-quiet.md).

## Context

0030 gave every component a rung by role: inputs `sm` (4), buttons `md` (6), cards `lg`
(8), dialogs `xl` (12), full-screen surfaces `2xl` (16). Eight days later `2xl` still had
no consumer in either binding.

The six references 0033 reversed sit at 8 to 10px on controls and 12 on cards (shadcn 10,
Cal.com 10, Attio `lg` 8 / `xl` 12, Resend `md` 6 / `lg` 8). Inputs and buttons share a
radius in every one of them; SeaKim had them two rungs apart, which reads as two systems
in one form row.

0030 was explicit that a rung is a role, not a size, and that the ladder is closed. That is
what makes this a value change and not a rule change: the roles move to different rungs,
and the rungs nobody names afterwards are removed. The owner's standing instruction for the
revamp is "keep it only if it is still needed", and the test for a rung is a consumer.

## Decision

**Controls, including text inputs, take `lg`. Cards take `xl`. `md` and `2xl` leave the
ladder.**

| Rung | Value | Use |
| --- | --- | --- |
| `none` | 0px | Dividers, table cells, full-bleed images, the page itself |
| `xs` | 2px | Tags, chips, inline marks |
| `sm` | 4px | Checkboxes, menu items |
| `lg` | 8px | Buttons, icon buttons, segmented control, inputs, selects, textareas, the combobox trigger |
| `xl` | 12px | Cards, panels, dialogs, sheets, popovers, menus |
| `full` | 999px | Count badges, toggle tracks, pills |
| `circle` | 50% | Avatars, dots |

The three clauses of 0030 stand: the ladder is closed; a component takes the rung its role
names; `none` is still a real answer. Concentric corners (0032, §0.14) were re-checked after
the move: a `lg` button inside an `xl` card, an `xl` card inside an `xl` dialog (equal is
allowed), an `sm` menu item inside an `xl` menu. Nothing is rounder than its parent.

The names keep their gap. `lg` next to `sm` with no `md` between them is odd to read and
harmless to use; renaming the survivors would break every consumer for no visual gain.

## Consequences

- **Rules 8.0 (already in flight).** Two tokens are removed, a Major under 0011; the 8.0.0
  entry carries it. `--radius-md`, `--radius-2xl`, `SkRadius.md` and `SkRadius.xxl` no
  longer exist, so a consumer that named them fails at build time. job-search finds out at
  the M3 trial.
- **The checker's `LADDER` shrinks with the tokens** (0012), and it still reads the values
  from `tokens/radius.css` and `SkRadius` rather than the names (lesson 17). The drift
  fixture loses the two rungs too.
- **Buttons and inputs now share a corner**, which is the visible point of the change.
- **`readme.md`'s Corners section is now two ADRs stale**; the readme rewrite ticket
  covers it against what shipped. `guidelines/radius.html` predates 0030 entirely and is
  flagged there as well.

## Rejected alternatives

- **Reshape the ladder to three rungs plus pill.** Rejected in 0033: it prunes before the
  evidence. This ADR prunes after counting consumers.
- **Keep `md` and `2xl` as spares.** A rung with no role is a value waiting for an author
  to like it, which is exactly the thing 0030 forbids.
- **Move dialogs up to `2xl` so it keeps a consumer.** Inventing a role to save a token.
  No reference rounds a dialog more than a card.
- **Leave inputs at `sm`.** Every reference gives inputs and buttons the same radius; a
  form row with 4px fields beside 8px buttons is the one place the old ladder looked like
  two systems.
