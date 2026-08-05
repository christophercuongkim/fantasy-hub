Coarse adjustment along a range. Contract in [`spec/Slider.md`](../../spec/Slider.md),
rationale in [`decisions/0006`](../../decisions/0006-slider.md).

```jsx
<Slider
  label="Price range" range
  min={200} max={800} step={10}
  value={price} onChange={setPrice}
  format={v => '$' + v}
/>

<Slider label="Max stops" min={0} max={3} step={1} ticks value={stops} onChange={setStops} />
```

The value is always text in the label row — never a tooltip on the thumb, which is hidden
by the finger on touch and animates a number at the moment it matters most.

Ticks only render when `step` is set and there are under 12 steps. For an exact figure
that matters (a budget, a cap), pair with a mono `Input` or skip the slider.

Keyboard: arrows step, Page Up/Down move a tenth, Home/End jump to the ends.
