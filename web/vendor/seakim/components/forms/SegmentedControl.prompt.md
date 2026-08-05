2–4 short exclusive options, all visible. The default choice for view and filter switches.

```jsx
<SegmentedControl options={['One way', 'Round trip', 'Multi-city']} />
<SegmentedControl
  options={[{ value: 'list', label: 'List', icon: 'rows' }, { value: 'map', label: 'Map', icon: 'map-trifold' }]}
  size="sm"
/>
```

Selected segment gets `--surface-selected` and accent text — no sliding pill. For
changing *page*, use `Tabs`. For 5+ options, `Select`.
