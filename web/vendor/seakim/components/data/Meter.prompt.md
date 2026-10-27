A fact with a bar under it.

```jsx
<Meter label="Skills" value={0.84} valueText="84" />
<Meter label="Seniority" value={0.62} valueText="62" />
<Meter label="Storage" value={12.4} max={20} valueText="12.4 of 20 GB" size="md" />
```

Use it for a score dimension, a share, a quota: something measured, not something
happening. If the bar should move while the user watches, it is a `Progress`. Stack
several with the same `max` so the bars compare; give each a `valueText` in the unit the
user thinks in rather than letting the percentage show. Keep the accent fill: a red bar
for a low score is a verdict, and verdicts belong in words next to the number.
