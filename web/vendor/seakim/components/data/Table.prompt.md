Rows of records with shared columns, where the point is comparison. Contract in
[`spec/Table.md`](../../spec/Table.md), rationale in
[`decisions/0003`](../../decisions/0003-tables.md).

```jsx
const columns = [
  { key: 'slot', label: 'Slot', width: 48 },
  { key: 'name', label: 'Player', identifying: true },
  { key: 'matchup', label: 'Matchup', secondary: true, priority: 3 },
  { key: 'live', label: 'Live', numeric: true, survives: true,
    subLabel: r => `proj ${r.proj}` },
  { key: 'proj', label: 'Proj', numeric: true, priority: 3 },
];

<Table
  columns={columns}
  rows={starters}
  bp={bp}
  sort={sort}
  onSort={key => setSort(s => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }))}
  onSelectRow={openPlayer}
  actions={r => <IconButton icon="arrows-left-right" label={`Swap ${r.name}`} size="sm" />}
  caption="Starting lineup for week 14"
/>
```

The three responsive props are the design work and cannot be derived:
`identifying` (primary line at `sm`), `survives` (the one figure that stays), and
`secondary` (joined with `·` into the second line). `priority: 3` drops a column at `md`.

`density="compact"` only for numeric matrices with no in-row controls — a 34px row cannot
hold a 34px control. `matrix` lets a table scroll at `sm` instead of restacking, and is
only legitimate when every scrolling column shares a unit.
