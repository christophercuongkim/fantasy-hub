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

`brand` may be an element: a mark beside the name, or a context switcher (the name and a
caret that opens a `Popover` of the other workspaces). Pass `brandCollapsed` for what the
rail shows; without it an element brand collapses to nothing and a string to its first
letter. Flutter splits the two: `brand` (a `String`) or `brandWidget`, plus `brandCollapsed`.
