The action primitive — use for every clickable action; use a link for navigation to a URL.

```jsx
<Button variant="primary" iconLeft="plus">Add to trip</Button>
<Button variant="secondary">Not now</Button>
<Button variant="ghost" size="sm" iconRight="arrow-right">See all</Button>
<Button variant="danger">Leave league</Button>
<Button loading loadingLabel="Booking…">Review and pay</Button>
```

Variants: primary (one per view), secondary (bordered), ghost (toolbars, low-stakes), danger (destructive only). Sizes sm 28 / md 34 / lg 42 — use `lg` on mobile so the target clears 44px with surrounding padding. Labels are sentence case with no terminal period.
