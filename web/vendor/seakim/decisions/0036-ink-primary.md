# 0036 — The primary action is ink; the accent moves to links, focus, selection and identity

- **Status** Accepted
- **Date** 2026-09-18
- **Affects** Tier 0 §0.3 in `conformance.md` (rewritten, number kept); `tokens/`
  (`--fill-primary`, `--fill-primary-hover`, `--fill-primary-active`, `--on-primary`);
  `SkColors`; Button and SkButton; the Material theme's `ColorScheme.primary`;
  `tool/conformance-check.mjs` (per 0012). Executes decision 3 of [0033](0033-quiet.md).
  0026 is unchanged.

## Context

SeaKim's accent has done two jobs: it is the app's identity (brick for SeaKim, sea for
Voyage, turf for Bench, plum for Reserve) and it is the colour of the primary action. §0.3
kept that honest by allowing one accent hue live at a time, and 0026 clarified that
identity fills (own-message bubbles, selected rows) may repeat because they are not
actions.

Every reference 0033 reversed separates the two jobs. Notion, Cal.com, shadcn/ui, Resend,
Attio and Flighty all render the primary button in ink (black on light, white on dark) and
keep hue for links, focus, selection and status. It is the single largest lever in how
quiet those products read: with the loudest control achromatic, the accent is rare enough
to mean something when it appears.

The owner held brick and sea side by side under both treatments (round three, Q14) and
chose ink, knowing the cost: with ink primaries the apps differ at a glance only by their
links, focus rings, selection washes and identity fills.

The contrast pass (CHR-190) measured ink on every surface in both themes at 9.5:1 or
better, and every hue's link and focus colour at or above their floors on the new fills.

## Decision

**The primary action is ink. The accent lives in links, the focus ring, selection, active
navigation, and identity fills. One accent hue is still live at a time.**

1. Four semantic tokens are added and every primary button reads them:
   `--fill-primary` (light `stone-900`, dark `stone-100`), `--fill-primary-hover`,
   `--fill-primary-active`, and `--on-primary` (light `stone-50`, dark `stone-950`).
   `SkColors` gains `fillPrimary`, `fillPrimaryHover`, `fillPrimaryActive`, `onPrimary`.
2. `--fill-accent`, `--fill-accent-hover`, `--fill-accent-active` and `--on-accent` stay,
   and keep every consumer that is not a primary action: checked checkboxes and radios,
   the switch track, the slider fill, the tab indicator, the side-nav active bar, the date
   picker's endpoints, solid accent badges, own-message bubbles. Those are identity and
   selection, per 0026.
3. §0.3 keeps its number. Its intent (one hue, no competing actions) survives; what changes
   is where the hue lives. The clause now states both halves.
4. The ink half is machine-checked: the `ink-primary` gate resolves `--fill-primary` in
   both themes and fails if the value carries hue (channel spread above a warm-stone
   tolerance), reads `SkColors` for the same mapping, and `--on-primary` on
   `--fill-primary` joins the contrast floors at 4.5:1. The one-hue half stays judgement.
5. Material bindings map `ColorScheme.primary` to `fillPrimary` so themed
   `ElevatedButton`s follow; Material's selection controls keep `fillAccent` explicitly.

## Consequences

- **Per-app identity is quieter.** Accepted with the comparison in front of the owner.
  Whether the chart ramps (0015, 0016, 0017) still read right beside an ink primary is
  fog on the map, revisited after M1.
- **Rules 8.0 (already in flight).** Four tokens added; no token removed by this ADR.
  A 7.x consumer keeps working because `--fill-accent` still exists, but its primary
  buttons will stay accent until it adopts the new tokens.
- **The `--accent` alias** that feeds native `accent-color` keeps pointing at
  `--fill-accent`: native checkboxes and radios are selection controls, not actions.
- **`readme.md` and the states guideline** are updated where they describe the primary
  action; the readme rewrite ticket does the rest.

## Rejected alternatives

- **Keep accent on the primary button and quiet everything else.** Every reference puts
  ink there; it is the lever that makes the rest read quiet.
- **Point `--fill-accent` at ink and add a new identity token.** Inverts the meaning of a
  token forty consumers already read; a 7.x consumer would get ink where it asked for
  identity. Adding `--fill-primary` leaves every existing reading intact.
- **Retire §0.3 and renumber.** The rule is still "one hue, no competing actions". A
  reader citing §0.3 from an old review still means the same thing.
- **Make ink primary the Material `ColorScheme.primary` only, without new tokens.** Ties
  the rule to one binding's theme object; React would have had nothing to read.
