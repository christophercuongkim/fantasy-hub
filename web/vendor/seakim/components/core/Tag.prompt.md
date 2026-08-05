Chip the user can toggle or dismiss — filter rows, applied search criteria, position slots.

```jsx
<Tag icon="airplane-tilt" selected onClick={toggle}>Nonstop</Tag>
<Tag onRemove={() => clear('bags')}>2 bags</Tag>
```

This is the one place `--radius-xs` (2px) is used at control size. Lay tags out in a flex row with `gap: var(--space-3)`.
