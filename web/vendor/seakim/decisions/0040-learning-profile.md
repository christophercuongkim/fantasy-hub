# 0040 — A learning profile: an opt-in that puts the accent on the primary action, progress and the next step

- **Status** Accepted
- **Date** 2026-10-24
- **Affects** `tokens/profiles.css` (new, hand-written, imported after `apps.css`);
  `conformance.md` Tier 1 (one row); `tool/conformance-check.mjs` (the file joins the
  palette exemptions, per [0012](0012-conformance-checks-ship-with-rules.md));
  `tool/build-tokens.mjs` and `SkAppBrand`
  (`interview-prep` joins the plum aliases); `readme.md`. §0.3, [0036](0036-ink-primary.md)
  and [0037](0037-fills-define.md) are unchanged for the shared layer and for every app
  that sets no profile.

## Context

Quiet ([0033](0033-quiet.md)) made the primary action ink and kept the accent for links,
focus, selection and identity. For a job-search platform or a travel planner that is the
right weight: the loudest control is achromatic and hue is rare enough to mean something.

interview-prep is a learning product. Its structural pass of 2026-10-23 moved every
element to where Duolingo, Brilliant and Mimo put theirs and the owner's verdict was that
the app did not look different. It could not have: every one of those references puts
its accent on the next step and on progress, and Quiet forbids exactly that. In a
practice loop the next step *is* the product, and an achromatic Start reads as one more
row.

Three ways out were put to the owner: use Quiet more fully (fills, eyebrows, identity
fills), leave SeaKim for this app, or an opt-in profile inside SeaKim. The owner chose
the profile (interview-prep visual pass, Q1 B). The alternative of changing §0.3 for
everyone was not offered: Job Search and the house surfaces are right as they are.

## Decision

**A product whose core loop is practice may set `data-profile="learning"` on its root,
beside `data-app`. Inside that subtree the primary action, progress and the next step
take the app's accent, titles carry weight, and one in-flow object per screen may stand
up. Everything else is SeaKim as written.**

1. The profile is a hand-written token file, `tokens/profiles.css`, imported after
   `apps.css`. It re-points semantic tokens under `[data-profile="learning"]` and declares
   nothing at `:root`. An app that sets no profile resolves every token exactly as before,
   so the `ink-primary` gate, which reads the root and app slots, is unaffected and still
   guards the shared layer. A second gate, `profile-contrast`, measures the profile's own
   `--on-primary` over `--fill-primary` for every app slot in both themes at the 4.5:1
   floor. `data-theme` sits on the profile element or above it; the dark selectors do not
   reach a theme attribute set on a descendant.
2. Primary action: `--fill-primary` becomes `--brand-700` (light) and `--brand-400`
   (dark), hover and active one step further, `--on-primary` stone-50 and stone-950.
   700, not 600, in light: 600 under stone-50 clears 4.5:1 for plum (4.7) and brick but
   not for sea (4.4), turf (4.2) or azure (4.2), and the profile has to hold for every
   slot. At hue 320: 7.3:1 light and 7.4:1 dark. The accent as text (`--brand-700` on
   stone-0, `--brand-300` on stone-900) reads 7.6:1 and 9.3:1.
3. Progress and the next step: two new tokens, `--fill-progress` and `--fill-next` (both
   `--brand-500`). They are bars and rings, never a surface for text (brand-500 under
   stone-50 is 3.5:1), so no on-colour is defined. An app points its own state tokens at
   them. Verdict
   and status colours (done, due, wrong, success, danger) stay semantic and never follow
   the accent; a learning app pins them to fixed hues.
4. One raised object per screen: `--shadow-card`, softer and wider than the bar shadows of
   [0018](0018-raised-shadow-direction.md), on `--surface-raised`. Which object is the
   raised one on a screen is the app's call and is written in its own decision record.
   Nothing else in flow carries a shadow; §0.16 holds for the rest of the page.
5. Type: display, title, heading and subheading go semibold, body regular, labels stay
   medium. The face does not change; [0031](0031-one-typeface.md) holds.
6. `interview-prep` is an alias of the plum hue (320), the slot the readme reserved for
   the third product. The `reserve` aliases stay so nothing that bound them breaks.
7. This is a Tier 1 allowance with its paper trail in `conformance.md`, so it is a minor
   bump (rules 8.6.0) under [0011](0011-versioning.md). Adopting it is a per-app decision
   recorded in that app's repo.

## Consequences

- **Two looks in the family.** A Quiet app and a learning app differ at a glance, by
  design. The chassis, radius ladder, fills, type face and components are shared, so a
  component moved between them still fits.
- **The Flutter binding has no profile yet.** `SkColors` is the Dart equivalent of the
  semantic layer and does not read `data-profile`. The first learning app on Flutter adds
  `SkProfile.learning` with the same seven re-points; the parity gate of
  [0039](0039-flutter-parity.md) covers components, not tokens, so this is listed as open
  non-conformance rather than a gate failure.
- **Progress is one hue, verdict is another.** A learning app that lets its wrong-answer
  colour follow the accent breaks point 3; interview-prep pins it to brick.
