# 0031 — One text family, and a display slot kept open

- **Status** Accepted
- **Date** 2026-09-10
- **Affects** `tokens/fonts.css`, `tokens/typography.css`, `flutter/` (`SkFonts`,
  `SkText`, bundled font assets), `next/app/fonts.ts`, the wordmark rule in `readme.md`;
  every binding

## Context

SeaKim shipped three text families: Outfit for display and headings, Plus Jakarta Sans for
UI and body, IBM Plex Mono for data and eyebrows. That split came from the founding brief
("Type: geometric sans, clean and wide") and was never tested against a product, because
no product exists.

A second system, authored independently, argued the opposite: **one text face across web,
Flutter and decks**, with a mono utility face for code and tabular identifiers, on the
grounds that a per-product display face leaves every shared surface with no principled
answer about whose face it wears, and every deck carrying three font payloads.

The two were set side by side at real sizes in real Voyage and Bench copy. Instrument Sans
read clearer and sharper than the Outfit/Plus Jakarta pairing at every step, and the
hierarchy survived being carried by size and weight alone.

One thing complicated it. `--font-display` is not only a heading face — it is the **brand
mark**. `readme.md` records that no logo was supplied and none was invented, so wherever a
mark would sit the system sets the product name in the display face; that wordmark is the
whole of SeaKim's visual identity, and it renders in the nav rail of both demo apps and on
every deck slide. Collapsing display into body sets the product name in the same face as a
paragraph.

That was weighed and accepted, because the wordmark is a placeholder in placeholder apps —
the readme's own words are "Supply real marks and they drop in with no other change." No
product ships. Defending a mark that does not exist yet is not a reason to keep three
families.

## Decision

**Instrument Sans is the only text family.** Display, headings, UI, body — every word in
the system. Hierarchy is carried by size and weight, never by a change of face.
**JetBrains Mono** stays as the data face: prices, times, codes, stat lines, and the
uppercase eyebrow.

**`--font-display` remains a named token**, pointing at Instrument Sans. It is not deleted
and not aliased away. It is the slot the wordmark, every `h1`–`h5`, the nav rail and the
deck chrome all read, so a future display face — or a real logotype — is one edit here
rather than a rewrite of four type roles in two bindings. `SkFonts.display` mirrors it.

The **twelve-step size scale is unchanged**. The face decision and the scale are separate,
and only the faces move here.

Flutter bundles each family as a single **variable** `.ttf`. Every `SkText` style therefore
carries `fontVariations` alongside `fontWeight`, because the `wght` axis is what actually
moves on a variable font and `fontWeight` alone risks a synthesised bold instead of the
real cut.

## Consequences

- **The wordmark loses its distinct letterform.** "SeaKim", "Voyage" and "Bench" now set in
  the same face as body copy. Identity rests on hue until a real mark exists. This is the
  reversible half of the decision, and the slot is what keeps it reversible.
- **Two font payloads instead of three**, and on Flutter two variable files (381 KB)
  instead of ten static cuts (~1.1 MB).
- **The founding brief line is superseded.** `readme.md`'s "Type: geometric sans, clean and
  wide" recorded a preference for a wide face; Instrument Sans is narrower with a taller
  x-height. The line now records that this decision replaced it.
- **`--type-data` and `--type-eyebrow` keep the mono face.** The source system restricts
  mono to "code, token names, and tabular identifiers", which would have moved the eyebrow
  to sans. That restriction is **not** adopted; the eyebrow stays mono until it looks
  wrong.
- Versioning (0019): **Major**. `--font-display` keeps its name but loses its contract — a
  binding reading it for a distinct display face now silently gets the body face, which is
  what 0011 means by a removal that no rename makes visible.

## Enforceability

Nothing here is machine-checkable today, and this ADR does not pretend otherwise. There is
no conformance rule naming a typeface at any tier — icons are pinned at Tier 1 but type
never was. A binding could ship any face and pass every gate. Adding a Tier 1 type row
(fixed intent: the family set; free to differ: webfont or bundled binary, exactly the shape
the icon row already uses) is the obvious follow-up and is deliberately not bundled here.

What *is* checked: `flutter/test/licenses_test.dart` fails if a bundled face's OFL notice
is missing, renamed, or not registered for `showLicensePage()`. That test caught this
change and had to be updated with it.

## Rejected alternatives

- **Keep Outfit on the four display roles, swap only body and mono.** Smaller diff, and it
  would have preserved the wordmark's letterform — but it does not deliver the single-face
  system, which is the thing being bought.
- **Carve the wordmark out onto a display face now.** Premature. There is no real mark to
  hang it on, and the slot makes it a one-line change whenever there is.
- **Delete `--font-display` and point the four roles at `--font-sans`.** Honest about
  today's state, but it discards the seam that makes this reversible and turns a future
  display face into a four-role rewrite in both bindings.
- **A serif display face on named entities**, sans on everything functional — serif marking
  the thing being *named*, as seen on a reference product. Genuinely distinctive, and
  conflicts with nothing else in the system. Rejected here because it is the opposite of a
  single-face system; it cannot coexist with this decision, and this decision was the one
  wanted. If it returns, it supersedes this record.
- **Adopting the eight-step 13→61 type scale** that came with the source system's type
  clause. The two share only 13px and 20px, so it would have re-set almost every size in
  the repo. Faces only.
