The default container for grouped content — search results, stays, matchups, settings groups.

```jsx
<Card eyebrow="NONSTOP · TAP AIR" title="Lisbon → Faro" meta="Thu 14 Aug · 55 min"
      interactive footer={<Button size="sm">Add to trip</Button>}>
  <span style={{font:'var(--type-data)'}}>07:45 → 08:40</span>
</Card>
```

Use `media` for full-bleed imagery (flush, 0px radius). `selected` for the chosen option in a set. Do not add shadow — depth is reserved for overlays.
