# 0030 — Corners take a radius ladder

- **Status** Accepted
- **Date** 2026-09-10
- **Affects** the corner rule in `conformance.md` (Tier 0), `tokens/radius.css`,
  `tool/conformance-check.mjs` (per 0012), `spec/`; every binding

## Context

`tokens/radius.css` opens by calling itself **"the loudest decision in the system"**:
nothing that contains content is ever rounded, at any size, in any app, and "do not
introduce a 4px radius." Tier 0 says the same. The rule came from the founding
conversation — `readme.md` records it under Sources as a preference the system was handed
("Corners: sharp (0px)"), alongside the note that **every value here is a decision, not a
recording, so anything can be renegotiated cheaply**. Nothing ships against it: Voyage and
Bench are demo kits, not products.

An audit run against an external token proposal turned up three facts about the rule as it
actually stands, none of which are about that proposal:

**It was never enforced at the value level.** `non-zero-radius` whitelists three token
*names* — `--radius-none`, `--radius-full`, `--radius-circle` — and flags literals. It
never opens `tokens/radius.css`. Swapping a full non-zero ladder into the tokens left all
four static gates green. The loudest decision in the system was enforced as a naming
convention.

**Its own documentation already disagreed with it.** `components/core/Tag.prompt.md`
states: "This is the one place `--radius-xs` (2px) is used at control size." The token has
been `0px` the whole time. The prompt files are what an author — human or model — reads
before writing a component, and no gate reads `.md` at all; 0001 accepts that gap in
writing. So the system has shipped a written 2px corner and a rendered 0px corner side by
side, with nothing able to notice.

**It bound one binding.** React's `Tag` names `--radius-xs`; Flutter's `SkRadius` carries
only `none` and `pill`, and `sk_tag.dart` sets no radius at all. The two bindings agree on
tags **only because** `--radius-xs` currently resolves to zero. The moment it does not,
they diverge silently — lesson 6, latent, with every gate green.

A rule that is unenforced, contradicted in its own docs, and asymmetric across bindings is
not a rule holding firm. It is a rule nobody was in a position to break visibly. That
makes this the cheap moment to ask whether it is the rule we want, rather than to spend
the enforcement work defending a preference no product has ever tested. The call is to
take the ladder.

## Decision

**Every corner is a token, and every rung has one documented use.** No literal radius in
any binding — not in CSS, not in a JSX style object, not in `BorderRadius.circular`. A
component takes the rung its **role** names, not a value its author likes.

| Rung | Value | Use |
| --- | --- | --- |
| `none` | 0px | Dividers, table cells, full-bleed images, the page itself |
| `xs` | 2px | Tags, chips, inline marks |
| `sm` | 4px | Inputs, selects, checkboxes |
| `md` | 6px | Buttons, icon buttons, segmented control |
| `lg` | 8px | Cards, panels, list rows |
| `xl` | 12px | Dialogs, sheets, popovers, menus |
| `2xl` | 16px | Full-screen surfaces, media containers |
| `full` | 999px | Count badges, toggle tracks, pills |
| `circle` | 50% | Avatars, dots |

Three clauses carry the weight:

1. **The ladder is closed.** A rung that is not in this table does not exist. Adding one
   is an ADR, not a token edit.
2. **Role, not size.** A dialog takes `xl` because it is a dialog, not because 12px looked
   right at that width. Two components with the same role take the same rung in both
   bindings or the bindings have diverged.
3. **`none` is still a real answer.** Dividers, table cells and full-bleed media stay
   square. This decision widens the vocabulary; it does not make rounding a default.

## Consequences

- **The cheap question is replaced by an expensive one.** "Is it square?" was answerable
  by looking. "Which rung is this?" is a judgement every new component now has to make,
  and every reviewer has to check. That is the real price, and it is paid on every
  component forever, not once here.
- **Nine rungs is more vocabulary than the system has uses for.** `sm`, `md`, `lg`, `xl`
  and `2xl` have zero call sites in either binding today. They are being defined ahead of
  need, which invites the exact drift clause 1 exists to prevent.
- **`Tag.prompt.md` becomes true** without being edited — the first time the written
  system and the rendered system have agreed about a tag's corner.
- **Both bindings carry the ladder or neither does.** `SkRadius` gains the rungs in the
  same change that `tokens/radius.css` does. A ladder that exists only in CSS is lesson 6
  restated, which is how this rule got into trouble in the first place.
- **Per 0012, the rule and its check move together.** `non-zero-radius` becomes
  `untokenised-radius`: it stops asserting that corners are square and starts asserting
  that every corner names a rung. The check must also read `tokens/radius.css` itself —
  the enforcement gap above is not fixed by changing the values, only by making the gate
  look at them.
- **`--radius-full` does not move.** It stays `999px`, and `SkRadius.pill` stays `999`.
  Every other rung here is new vocabulary; this one already existed and already works, so
  it is the one value in the table that is unchanged.
- Versioning (0019): **Major**. A Tier 0 rule changes.

## Enforceability

Per 0012, what a check can honestly assert here, and what stays judgement:

**Checkable.** That no literal radius appears in either binding; that every radius names a
rung in the closed ladder; that an unknown rung name (`--radius-huge`) fails; that
`tokens/radius.css` and `SkRadius` both carry exactly the nine rungs at exactly these
values, pinned to each other by a `PARITY` entry as the dialog width already is.

**Not checkable.** Whether the rung is the *right* one for the role — a card wearing `xl`
passes every regex and is still wrong. Clause 2 is a review obligation, and
`conformance.md` keeps it on the manual list. A green gate here means "every corner is a
legal rung", never "every corner is the correct rung".

One blind spot to close in the same change: the current check matches kebab-case
`border-radius:` and literal-px `borderRadius:`, so the camelCase
`borderRadius: 'var(--radius-xs)'` form React actually uses is invisible to it today. The
one call site in the system sits in exactly that blind spot.

## Rejected alternatives

- **Keep 0px and just fix the enforcement.** Defensible, and cheaper — but it spends the
  work defending an untested preference and leaves `Tag.prompt.md` to be corrected
  downward. If the square rule were load-bearing for a shipped product this would win.
- **A restrained three-rung ladder (2 / 4 / 8).** Fewer rungs to police and every one of
  them earns its place today. Rejected for the fuller ladder deliberately, accepting the
  cost named in Consequences.
- **Adopt the external proposal wholesale**, including its `--sk-` prefixes and its
  neutral rename. That is 217 token renames — every one Major under 0011 — to acquire a
  vocabulary this repo already has under different names.
- **Take the external proposal's `9999px` for `full`.** It renders identically — both
  values are past the point where the corner is already a semicircle, and CSS and Flutter
  both scale radii down to fit, so a 32px switch track resolves to 16px either way. The
  two diverge only above ~1998px of height, which no badge or toggle track reaches. Its
  only argument was sitting in the same table as the rungs being adopted; that is
  inheriting a value, not choosing one.
- **Leave the rungs undefined and let each component pick a pixel value.** The status quo
  ante with extra steps; it is what the unenforced rule was already permitting in
  practice.
