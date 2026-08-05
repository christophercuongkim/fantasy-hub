One independent yes/no, or a list of them. Takes effect on save, not on click.

```jsx
<Checkbox label="Direct flights only" defaultChecked />
<Checkbox label="Include nearby airports" hint="Adds SJC and OAK" />
<Checkbox label="All positions" indeterminate onChange={setAll} />
```

If the change applies immediately, use `Switch`. Checkbox implies a form you submit.
