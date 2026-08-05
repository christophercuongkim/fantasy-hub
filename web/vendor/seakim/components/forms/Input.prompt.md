Single-line text entry. Always wrapped in a `Field` so it has a label.

```jsx
<Field label="Where to" htmlFor="dest">
  <Input id="dest" iconLeft="magnifying-glass" placeholder="City or airport" />
</Field>
<Input mono suffix="USD" defaultValue="412.00" size="sm" />
```

Placeholders are examples, never restatements of the label. `mono` for codes, prices,
and dates. `invalid` turns the border red — pair it with `Field error`.
