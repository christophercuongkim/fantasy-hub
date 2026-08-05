Renders one Phosphor glyph; use it anywhere an icon is needed instead of inline SVG.

```jsx
<Icon name="map-pin" size={16} />
<Icon name="heart" weight="fill" size={20} />
```

Weights: `regular` (default, all UI), `fill` (active/selected), `bold` (14px and below), `duotone` (empty states, slides only). Thin and Light are intentionally unavailable. Never pass `color` — let it inherit.
