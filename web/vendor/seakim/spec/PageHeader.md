# PageHeader

The one header every page shares. Decided 2026-10-12 from the Mobbin references the
job-search shell spike collected (Linear, Asana, Airtable, Notion, Todoist, Whop); promoted
under [0038](../decisions/0038-promote-on-a-spike.md).

## Anatomy

1. **Title row.** The page's name at `--type-title`, the page's one level-one heading, the
   `count` in secondary text beside it, and a `badge` chip after that for a status or a
   plan. Right of the row, the `actions`: the view controls and the primary action, at most
   three; a fourth is an overflow.
2. **Description.** One line at `--type-body-sm`, secondary colour, optional. A list page
   rarely has one; a settings page often does.
3. **Toolbar.** The second row: the filters, tabs and sort. Five of six references have
   this row. The view toggle sits in `actions` by the shell pick (spike 1, option A); the
   references split on it (Airtable row two, Linear a popover), so either reads.

## What it is not

- Not sticky. A page that wants its header pinned is scrolling the wrong element; scroll
  the list, not the page.
- Not a place for a status as text. The count is secondary text beside the title (the
  shell pick); a status or a plan is a chip in `badge`, which is what the references show
  beside a title.
- Not a breadcrumb bar and not a search slot. Search is a toolbar child.

## Responsive

At `sm` the title wraps and the actions stay on the title row; the toolbar wraps. The
header never collapses its actions into a menu by itself: that is the page's call.

## Themes

No structural difference. The header is type and whitespace; it carries no fill and no
hairline ([0037](../decisions/0037-fills-define.md)).

## Accessibility

The title is the page's `h1` (`Semantics(header: true)` in Flutter); the component owns
it so a page cannot end up with two. Actions and toolbar children are ordinary controls
and keep their own labels.

## Bindings

React `PageHeader`; Flutter `SkPageHeader` with `actions` and `toolbar` as widget lists.
