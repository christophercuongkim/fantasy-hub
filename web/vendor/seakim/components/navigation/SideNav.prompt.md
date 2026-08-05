Persistent left navigation for web app surfaces — the chassis of every desktop screen.

```jsx
<SideNav
  brand="Voyage"
  active="trips"
  groups={[
    { items: [{ value: 'trips', label: 'Trips', icon: 'suitcase-rolling' }, { value: 'search', label: 'Search', icon: 'magnifying-glass' }] },
    { label: 'Account', items: [{ value: 'billing', label: 'Billing', icon: 'credit-card' }] },
  ]}
/>
```

Active item: accent text, `--surface-selected` fill, 2px inset accent bar, `fill`-weight
icon. Only one accent-colored item in the whole nav. `collapsed` drops to 56px icons.
