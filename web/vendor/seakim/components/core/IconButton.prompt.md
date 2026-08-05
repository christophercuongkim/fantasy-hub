Icon-only button for toolbars, table row actions, and mobile nav — never for a primary action.

```jsx
<IconButton icon="heart" label="Save stay" active={saved} onClick={toggle} />
<IconButton icon="dots-three" label="More" variant="secondary" />
```

`active` flips the glyph to fill weight, which is how the system shows "on". Always pass `label`.
