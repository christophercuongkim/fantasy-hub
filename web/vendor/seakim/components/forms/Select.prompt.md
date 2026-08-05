Single choice from a list of 4 or more. Native under the hood, so mobile gets the OS picker.

```jsx
<Field label="Cabin">
  <Select options={['Economy', 'Premium', 'Business', 'First']} defaultValue="Economy" />
</Field>
```

For 2–3 short options use `SegmentedControl` instead — it shows all the choices at once.
