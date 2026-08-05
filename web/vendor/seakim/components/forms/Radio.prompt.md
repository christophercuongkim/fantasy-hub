Mutually exclusive choice with room to explain each option.

```jsx
<Radio
  name="cancellation"
  defaultValue="flex"
  options={[
    { value: 'basic', label: 'Non-refundable', hint: 'Cheapest. No changes after booking.' },
    { value: 'flex', label: 'Flexible', hint: '+$48. Change once, free.' },
  ]}
/>
```

Renders the whole group — never a single radio. `direction="row"` only for two short labels.
