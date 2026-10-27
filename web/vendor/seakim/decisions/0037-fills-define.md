# 0037 — Fills and gaps define; a hairline is the exception, and it is alpha

- **Status** Accepted
- **Date** 2026-09-18
- **Affects** Tier 0 §0.2 (retired) and §0.16 (new) in `conformance.md`; `tokens/src/color.tokens.json`
  (hairline and tint alphas), the light surface layer; `SkColors`; Card and SkCard;
  `tool/conformance-check.mjs` (per 0012); every binding. Executes decision 2 of
  [0033](0033-quiet.md). 0018 (raised shadow direction) is unchanged.

## Context

§0.2 said "borders define, shadows lift": every in-flow surface carried a 1px opaque stone
hairline and no shadow. That rule did its job (no card ever floated), and it is also the
single largest reason SeaKim screens read heavier than the references 0033 reversed. All
six of those separate regions with whitespace and tinted surface fills; Notion's sidebar
is `#f7f7f5` on white, rec.us's cards are sand on off-white, Flighty has no lines at all.
Hairlines appear only where a gap cannot separate: table rows, inputs, the edge of an
overlay. And where they appear they are alpha (shadcn dark `white/10%`, Resend
`--gray-a3`), so one token works on any surface in both themes.

SeaKim's light theme did the opposite of the references: an off-white page with pure
white cards, so a card read *lighter* than the page and needed its outline to be seen. Dark
already worked by fills (page `stone-950`, card `stone-900`) and outlined everything anyway.

The contrast pass (CHR-190) measured every candidate hairline alpha from 8% to 12% at 1.2
to 1.4:1 against every surface, both themes. A hairline at these alphas is decorative;
it can never be the sole marker of an input or focus boundary. The focus ring (3.3:1
worst case) and the input's own fill and text do that job, as they already did in the
references.

The owner picked this direction with three treatments in front of them (round three,
Q13): today's outlines, faded outlines, and fills with gaps. Faded outlines looked like a
washed-out version of today; fills were the change.

## Decision

**Whitespace and surface fills define regions. A hairline is the exception: a 1px alpha
border used only where a gap cannot separate. In-flow surfaces still carry no shadow.**

1. **Light surfaces invert.** Page is `stone-0` (white); card is `stone-100`; sunken and
   inset are `stone-200`; raised and overlay stay white, which is what "lift" means now.
   Dark surfaces are unchanged: they were already fills.
2. **Hairlines are alpha, in both themes.** Light: `stone-900` at 8% (subtle), 14%
   (default), 24% (strong). Dark: `stone-50` at 10%, 16%, 26%. The values live in
   `tokens/src/color.tokens.json` under `raw` with an `alpha`, the same shape as the scrim
   (0013: an alpha variant is a token). `--border-accent`, `--border-focus` and
   `--border-disabled` are unchanged.
3. **Hover and active are alpha tints too.** Light: `stone-900` at 6% and 12%; dark:
   `stone-50` at 8% and 14%. A tint that composes on any surface is what lets one token
   serve a row on the page and a chip on a card.
4. **Where a hairline still belongs:** table rows, inputs and their triggers, dividers,
   the edge of an overlay (popover, dialog, toast, menu). **Where it does not:** cards,
   panels, navigation rails, list rows. Card and SkCard drop their outline in this ADR
   because Card is the canonical in-flow surface; the remaining components are the M2
   pass, shaped by the component audit (CHR-191).
5. **§0.2 is retired; §0.16 states the rule.** It is machine-checked: the `alpha-hairline`
   gate reads `--border-subtle`, `--border-default` and `--border-strong` in both theme
   files and fails on any resolved alpha of 1, and reads `SkColors` for the same mapping
   against `SkRawColors`. Whether a given component should carry a hairline at all stays
   judgement.

## Consequences

- **Rules 8.0 (in flight).** A Tier 0 clause changed. No token is removed by this ADR;
  three light surfaces and ten border and tint values change. A 7.x consumer that never
  read `--border-*` directly sees only the new values.
- **Contrast floors move with the surfaces.** Text on `surface-card` is now measured on
  `stone-100`; the existing gate covers it. `--text-tertiary` was chosen (lesson 18) to
  clear 4.5:1 on white and on `stone-50`; it must also clear it on `stone-100`, and the
  gate says whether it does.
- **A bordered card is now a violation of taste, not of a gate.** The gate can prove a
  hairline is alpha; it cannot prove a card should not have one. That stays with review,
  in the same sense §0.14 does.
- **`readme.md` is now wrong about surfaces and separation** in the vibe list, the
  colour section and the states table. The readme rewrite ticket covers it.
- **The Flutter `SkCard.borderless` parameter is removed.** With no outline by default
  there is nothing for it to switch off; keeping a no-op would be the dead flexibility
  0033 tells us to cut.

## Rejected alternatives

- **Keep the outline, lighten it to alpha.** The middle option in the round-three
  comparison. Every card still fenced; the page reads like today through frosted glass.
- **Solid stone borders per theme, no alpha.** Two values per role that only work on one
  surface each; a row inside a card would need a third. Alpha collapses the matrix.
- **A hairline strong enough to pass 3:1 for inputs.** That is 48% ink on light (CHR-190):
  a grey outline heavier than today's. Inputs are marked by their fill, their text and
  their focus ring, as in every reference.
- **Make card `stone-50` for a fainter tint.** 1.03:1 against white; invisible on most
  panels. `stone-100` is visible and still quiet.
