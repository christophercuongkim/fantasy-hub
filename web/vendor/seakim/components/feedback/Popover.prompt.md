An overlay anchored to its trigger — a menu under a button, an autocomplete list
under a field, a reaction bar. Not for a screen-anchored modal (that is a
`Dialog`) or a bottom sheet.

```jsx
const [open, setOpen] = useState(false);

<Popover
  open={open}
  onDismiss={() => setOpen(false)}
  trigger={<Button variant="secondary" onClick={() => setOpen(o => !o)}>Actions</Button>}
>
  <div style={{ padding: 'var(--space-4)' }}>Rename · Duplicate · Delete</div>
</Popover>
```

Default is **non-modal**: no scrim, focus stays on the trigger, dismisses on
Escape, outside-press, or trigger blur. Pass `modal` for a reaction bar — it adds
a scrim, moves focus into the panel, and dismisses on scrim-click or Escape. Gets
`--shadow-popover` and a hairline border because it floats. It flips above the
trigger when `bottom` would run off-screen.

The panel is fixed to the window, placed from the trigger, so it is never clipped
by a scrolling or `overflow: hidden` parent: a sidebar, a table, a board column.
`align="start"` (default) lines it up with the trigger's left edge, `align="end"`
with its right edge, for a `⋯` at the end of a row. Don't pass `left`/`right` in
`style` to align it.
