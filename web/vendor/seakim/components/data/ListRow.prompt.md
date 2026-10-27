The row every list is made of; what it holds decides how tall it is.

```jsx
<ListGroup heading="Account">
  <ListRow leading={<Icon name="bell" />} title="Notifications" trailing={<Icon name="caret-right" />} href="/settings/notifications" />
  <ListRow leading={<Icon name="moon" />} title="Appearance" trailing="System" href="/settings/appearance" />
</ListGroup>

<ListGroup heading="Today">
  <ListRow
    leading={<Avatar name="Northwind Labs" size="sm" />}
    eyebrow="Northwind Labs" title="Senior frontend engineer" meta="Remote · $180k–$210k"
    trailing={<><span>2h</span><Badge tone="accent" mono>91</Badge></>}
    selected onClick={() => open(1)}
  />
</ListGroup>
```

Give it `href` for a row that goes somewhere, `onClick` for one that selects in place, and
neither for a static line. A chevron pointing right is the only hint a row navigates; do
not add one to a row that selects. Put the one value the user scans for in `trailing`
(the time, the score, the amount) and everything else in `meta`. `selected` marks the
current row of a split view and nothing else; a chosen item in a multi-select is a
`Checkbox` in `leading`.
