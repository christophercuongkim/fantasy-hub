# SplitPane

A list beside its detail, with an optional properties column. Decided 2026-10-12 from
the Mobbin references the job-search inbox and postings spikes collected (Notion Mail,
Plain, Lemni, Intercom, Glassdoor, Attio, Twenty); promoted under
[0038](../decisions/0038-promote-on-a-spike.md).

## Anatomy

Three columns, left to right: the **list** (a fixed width, `24rem` by default), the
**detail** (flexes), and an optional **aside** (`20rem`) for properties of the open item.
A `--border-subtle` hairline separates them, the one place
[0037](../decisions/0037-fills-define.md) allows an edge between panels. Each column
scrolls on its own; the component needs a height and never scrolls the page.

The detail starts with a **header**: a back control (narrow) or a close control (wide),
the title, a counter ("3 of 12"), previous and next, and the pane's actions. It is sticky
to the top of the scrolling detail. Every reference with a pane had one.

## Responsive

Measured on the container, not the window.

- `sm`: one column. The list, or the detail when the app says it is open. The header
  shows back instead of close. This is the push-with-a-back-arrow every phone reference
  used; none stayed split and none used a sheet.
- `md`: list and detail.
- `lg`: list, detail and aside.

The aside never shows on its own; a property that matters on a phone belongs in the
detail body.

## What it is not

Not navigation: the URL, the selection and what "next" means are the app's. The
component takes `detailOpen` and reports `onBack`, nothing more. Not a resizable
workspace: the widths are props, not handles. Not a place for a third list; the aside
holds facts, not rows.

## Accessibility

The detail is a `region` labelled "Detail". Back, close, previous and next are labelled
icon buttons. Escape inside the detail calls the header's `onClose` when there is one.
Focus is the app's: when it opens an item it should move focus to the header's title.

## Bindings

React `SplitPane` with `SplitPane.Header`; Flutter `SkSplitPane` with
`SkSplitPaneHeader`, the header reading the pane's scope for back-versus-close.
