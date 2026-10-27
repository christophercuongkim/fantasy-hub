Every page starts with one of these, and nothing else renders an `h1`.

```jsx
<PageHeader
  title="Trips"
  count={12}
  actions={<>
    <SegmentedControl options={['List', 'Board']} defaultValue="List" size="sm" />
    <Button iconLeft="plus">New trip</Button>
  </>}
  toolbar={<Select size="sm" options={['All', 'Upcoming', 'Past']} />}
/>
```

The count goes in `count`, never in the title string; a status or a plan is a `badge`.
The view controls and the primary action go in `actions`, the filters in `toolbar`, which
is the shell pick. Three actions at most; the fourth is an overflow `IconButton` with a
`Popover`. Search is a toolbar child, not a slot. It is not sticky: a page that needs its
header pinned is scrolling the wrong element.
