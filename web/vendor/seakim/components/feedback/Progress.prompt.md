A thin bar that fills towards a known end, with the count beside it.

```jsx
<Progress value={4} max={13} label="4 of 13" />
<Progress value={62} size="md" aria-label="Uploading résumé" />
```

Use it for a wizard, an upload, a trial counter: things with a known total. A score or
a share of something is a `Meter`, which does not move; a wait with no known end is a
`Skeleton` or `LoadingState`, never a spinner (0021). Keep `sm` unless the bar is the
whole row; every reference is 2 to 4px. The label is the only text; put the step's
title in the page, not here.
