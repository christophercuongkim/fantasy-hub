Switches sections within one screen. Not for switching *pages*.

```jsx
<Tabs
  tabs={[
    { value: 'flights', label: 'Flights', icon: 'airplane-tilt', count: 4 },
    { value: 'stays', label: 'Stays', icon: 'bed' },
    { value: 'cars', label: 'Cars', icon: 'car' },
  ]}
  onChange={setTab}
/>
```

For 2–4 short options that filter rather than navigate, use `SegmentedControl`.
Counts are omitted at zero, never shown as 0.
