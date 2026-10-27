# Sheet

A short list of actions or a picker, reached from one tap. Decided 2026-10-12 from the
one Mobbin sheet the job-search spikes collected (LinkedIn) and Flutter's existing
`showSkSheet`; promoted under [0038](../decisions/0038-promote-on-a-spike.md) and the
first React-side catch-up under [0039](../decisions/0039-flutter-parity.md).

## Anatomy

Under `md`: a panel anchored to the bottom edge with the top corners at `--radius-xl`, a
grabber (`--space-9` by `--space-2`, `--border-strong`) centred at its top, the rows,
content-sized up to 82% of the viewport, over the scrim. From `md`: the same panel centred
at `--overlay-w-sheet` (460px) with all four corners rounded, like a `Dialog`. The species
swap is the one [0022](../decisions/0022-anchored-popover-species.md) names and the one
`showSkSheet` already does: on a phone a sheet is thumb-reachable; on a desktop a bottom
sheet is a long way from the pointer.

No title by default and no close control: the reference has neither, and a list of rows
explains itself. A `title` is allowed when it does not. The scrim and Escape dismiss.

## Behaviour

Measured against the window, not a container: an overlay is not in one. No enter motion
beyond the scrim appearing, the same as `Dialog` ([0034](../decisions/0034-press-is-a-tint.md):
overlays fade, nothing grows). Focus moves into the panel on open and returns to the
opener on close. Rows are `ListRow`s with `onClick`; the app closes the sheet after an
action.

## What it is not

Not a `Dialog`: no form, no confirmation, no footer of buttons. Not a `Popover`: it is not
anchored to its trigger; use the popover on a desktop when the anchor matters. Not a
page: a sheet that needs to scroll a long way is a route.

## Accessibility

`role="dialog"` with `aria-modal`, labelled by the title or "Sheet". Escape calls
`onClose`. The grabber is decorative; there is no drag-to-dismiss gesture.

## Bindings

React `Sheet` (`open`, `onClose`, `title`, `width`); Flutter `showSkSheet` (a function
that pushes the route, the Flutter idiom), mapped in `flutter/README.md`.
