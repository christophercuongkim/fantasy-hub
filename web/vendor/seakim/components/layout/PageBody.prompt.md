The body of every page in the shell: page padding outside, a width ceiling inside.

```jsx
<main style={{ overflow: 'auto' }}>
  <PageBody width="list">
    <PageHeader title="Trips" count={12} />
    <ListGroup>{rows}</ListGroup>
  </PageBody>
</main>
```

Pick the ceiling by what the page holds: `list` (48rem) for a single column of rows or a
feed, `form` for a form, `prose` for reading, `full` for tables, boards, split panes, maps
and dashboards. Wrap the loading and error states in the same `PageBody` as the loaded
page so nothing jumps. `pagePad(bp)` is exported for a layout that needs the padding
without the ceiling.
