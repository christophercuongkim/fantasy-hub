Mobile bottom navigation. 3–5 destinations; if you need six, one of them is not top-level.

```jsx
<TabBar
  active="lineup"
  onChange={setTab}
  items={[
    { value: 'lineup', label: 'Lineup', icon: 'users-three' },
    { value: 'matchup', label: 'Matchup', icon: 'swords' },
    { value: 'players', label: 'Players', icon: 'magnifying-glass' },
    { value: 'league', label: 'League', icon: 'trophy' },
  ]}
/>
```

Labels are always visible — no icon-only bars. Active gets accent color and `fill` weight.
