Rows under a heading, with the lines between them drawn once.

```jsx
<ListGroup heading="Yesterday">…ListRows…</ListGroup>
<ListGroup heading="Submitted" divider="none">…ListRows styled as cards…</ListGroup>
```

The group owns the dividers so a row never draws its own edge (0037). Use `divider="none"`
only when the rows are already separated by a fill and a gap. One heading per group; a
list with no sections needs no group at all, just stacked rows.
