A few actions, one tap away, where the thumb is.

```jsx
<Sheet open={open} onClose={() => setOpen(false)}>
  <ListRow leading={<Icon name="arrow-right" />} title="Move to Applied" onClick={move} />
  <ListRow leading={<Icon name="prohibit" />} title="Skip" onClick={skip} />
  <ListRow leading={<Icon name="trash" />} title="Delete" onClick={del} />
</Sheet>
```

Use it for a status change, an overflow menu, a short picker: things a `Popover` does on
a desktop and the thumb cannot reach there on a phone. The component already becomes a
centred panel from `md`, so one `Sheet` serves both; use a `Popover` instead only when
the menu must stay anchored to its trigger. Leave `title` off unless the rows do not
explain themselves. A sheet that holds a form, a confirmation or a long scroll is a
`Dialog` or a page.
