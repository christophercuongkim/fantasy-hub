# ListRow and ListGroup

The row a list is made of, and the group that carries its heading and dividers. Decided
2026-10-12 from the Mobbin references the job-search inbox, review-queue, contacts and
account spikes collected; promoted under [0038](../decisions/0038-promote-on-a-spike.md).

## Anatomy

Five slots, left to right: **leading** (an avatar, logo, icon or checkbox), a stacked
**eyebrow / title / meta**, and **trailing** (a value, a time, a chevron, a kebab, a toggle,
a tag). Title at `--type-body`, meta at `--type-body-sm` secondary, eyebrow at
`--type-eyebrow` tertiary. Padding `--space-4` by `--space-5`; the row's height is its
content with a floor of `--control-h-lg`, raised to `--control-h-touch` on a coarse pointer
([0023](../decisions/0023-sub-floor-chrome-hit-area.md)).

Two families fall out of that with no prop: a **one-line row** (icon, title, chevron,
about `--control-h-touch` tall: settings, a More page) and a **two-to-three-line row**
(avatar, eyebrow, title, meta, a trailing value: an inbox, a queue, a contacts list). The
references show those two and nothing between.

## Behaviour

- A row with a destination is a link; a row that selects in place is a button; a row
  that does neither is a static block. The binding picks the element from what it is
  given, never from a prop.
- **Selected** is the current row of a split view. It is a `--surface-selected` fill and
  `aria-current`; never a left bar (Plain's bar lost to Notion Mail's and Lemni's fill,
  per [0037](../decisions/0037-fills-define.md)). A row chosen in a multi-select is a
  checkbox in `leading`, not `selected`.
- Hover is `--surface-hover`; press is `--surface-active` (0034). Nothing moves.
- A chevron pointing right in `trailing` says the row navigates. A row that selects does
  not get one.

## ListGroup

A group is a heading plus a list. The heading is an eyebrow ("Account", "Yesterday").
The group draws the dividers: a `--border-subtle` hairline between rows by default, the
one place a hairline belongs (0037), or none when the rows are fills with a gap. Rows
never draw their own edge, so a lone row and a grouped row look the same.

## What it is not

Not a table row: a `Table` has columns that align across rows; a list row has slots that
align within itself. Not a card: no radius, no fill except selection and hover. Not a
menu item: a `Popover`'s rows are shorter and carry no meta.

## Responsive

The row is the same at every width; what changes is the container. Long titles and meta
wrap (`overflow-wrap: anywhere`); trailing never wraps.

## Accessibility

A link row is reachable by Tab; a button row by Tab and activated by Space or Enter.
`selected` sets `aria-current="true"` (`Semantics(selected:)` in Flutter). The group is
a list labelled by its heading, so the count is announced.

## Bindings

React `ListRow` and `ListGroup`; Flutter `SkListRow` (`onPressed` in place of `href`
and `onClick`) and `SkListGroup`.
