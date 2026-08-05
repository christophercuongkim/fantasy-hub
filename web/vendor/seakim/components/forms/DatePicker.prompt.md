A date field with a calendar affordance. Contract in
[`spec/DatePicker.md`](../../spec/DatePicker.md), rationale in
[`decisions/0004`](../../decisions/0004-date-and-time-selection.md).

```jsx
<DatePicker label="Depart" value={depart} onChange={setDepart} bp={bp} />

<DatePicker
  range
  label="Trip dates"
  value={dates}
  onChange={setDates}
  bp={bp}
  isDisabled={d => d < new Date()}
/>
```

The field always accepts typed `YYYY-MM-DD` — the grid is an affordance, not the only
way in. At `sm` the overlay becomes a bottom sheet and cells grow to 44px.

Today is a 2px underline, not a ring or a fill: those mean focused and selected, and a
ring disappears once the date falls inside a range.

**No time picker exists.** For a time, use a mono `Input` with a format hint, or a
`Select` when the choices are real (a pickup slot, a kickoff window).
