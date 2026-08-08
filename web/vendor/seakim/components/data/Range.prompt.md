A floor–mid–ceiling interval on a shared scale — a projection's range, a confidence band.

```jsx
// one interval
<Range low={5.8} mid={12.4} high={18.2} domain={[0, 30]} />

// a column that compares: pass every row the SAME domain
{rows.map((r) => (
  <Range
    key={r.id}
    low={r.p20}
    mid={r.mean}
    high={r.p80}
    domain={[0, max]}
    label={`${r.name}: floor ${r.p20}, projected ${r.mean}, ceiling ${r.p80}`}
  />
))}
```

Pass every sibling the same `domain` or the bars lie — a wider band has to mean more
spread, not a different scale. Achromatic on purpose: a whole column in accent is a column
that isn't about anything, so reach for `accent` only on the one row you're highlighting,
never all of them. The exact numbers still belong in adjacent cells — the bar is for
scanning floor-vs-ceiling at a glance, not for reading a value off.
