The bar at the top of a screen: back, the title, one or two icon actions.

```jsx
const [menu, setMenu] = useState(false);
<TopBar
  title="Lisbon"
  onBack={() => router.back()}
  onTitleClick={() => setMenu(m => !m)}
  titleMenu={<TripSwitcher onPick={() => setMenu(false)} />}
  titleMenuOpen={menu}
  onTitleMenuDismiss={() => setMenu(false)}
  actions={<IconButton icon="gear" label="Settings" />}
  scrolledUnder={scrollTop > 0}
/>
```

Put it first in the scroll container so it sticks. Pass `scrolledUnder` from the scroll
offset; the shadow is the sticky rule in layout.md and is wrong on a bar with nothing
under it. Back for a pushed screen, close for a modal one, never both. Two actions at
most; a third goes in a menu. The menu's content is yours: the bar only anchors it.
