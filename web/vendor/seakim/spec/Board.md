# Board

Kanban columns. Decided 2026-10-12 from the Mobbin references the job-search board spike
collected (ClickUp, Wrike, Asana, Programa, Slack, Trello; Jira, Asana and Notion on a
phone); promoted under [0038](../decisions/0038-promote-on-a-spike.md).

## Anatomy

A row of **columns**, each a `--surface-sunken` fill at `--radius-xl`, 22rem wide with a
`--space-4` gap (the references cluster at 330 to 390px with 16 to 24px gaps). A column
has a **header** (the label as an eyebrow, the count in mono, an optional status dot, a
menu on the right), its **cards** stacked with `--space-3`, and a **footer** for the add
row, which every reference has.

Cards are the app's. The recommended shape is a `Card` with an eyebrow, a title and one
chip or one date; the record is a click away.

## Empty columns

Collapsed by default: a narrow vertical header with the label and count, a button that
expands it. That is the job-search board pick (spike 7); with "to decide" gone from the
board, the whole pipeline then fits a 1280px screen. ClickUp has the same as a toggle.
Wrike, Asana, Programa and Trello keep "0" columns at full width, which `collapseEmpty`
set to false gives you.

## Responsive

Measured on the container. Under `md` the row is a scroll-snap strip: each column at 85%
of the width so the next peeks, swipe to move, page dots beneath (Jira). A `Tabs` row of
the stages with their counts sits above the strip and jumps it (the pick's phone option);
Jira, Asana and Notion rely on the peek alone, and the peek is kept.

## What it is not

Not drag and drop: moving a card is the card's own menu (a `Popover` on a desktop, a
`Sheet` on a phone), which is what the state machine allows and what works on a phone.
Not a table: columns here are states, not fields. Not the place for triage: a queue that
is not a stage ("to decide") belongs in a list, not a column.

## Accessibility

Each column is a `section` labelled by its header; the cards are a `list` of `listitem`s
so the count is announced. A collapsed column is a button with `aria-expanded="false"`.
The page dots are decorative.

## Bindings

React `Board` and `BoardColumn`; Flutter `SkBoard` and `SkBoardColumn`, the phone strip a
`PageView` at 0.85.
