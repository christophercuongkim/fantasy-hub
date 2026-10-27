Switches sections within one screen. Not for switching *pages*.

```jsx
<Tabs
  tabs={[
    { value: 'flights', label: 'Flights', icon: 'airplane-tilt', count: 4 },
    { value: 'stays', label: 'Stays', icon: 'bed' },
    { value: 'cars', label: 'Cars', icon: 'car' },
  ]}
  onChange={setTab}
/>
```

On a full-width page, pass `fill`: the row and its track span the container, the tabs share
the width when they fit, and a row that does not fit scrolls at natural widths with the
active tab kept in view. That makes it right for a scroll-spy (days of an itinerary): set
`value` from the scroll position and the row follows, with no ref to wire.

```jsx
<Tabs fill value={day} onChange={jumpToDay} tabs={days} />
```

For 2–4 short options that filter rather than navigate, use `SegmentedControl`.
Counts are omitted at zero, never shown as 0.
