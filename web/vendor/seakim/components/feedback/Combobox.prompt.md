A searchable long-list picker (decision 0028) — a custom `role="combobox"` widget,
not a native `<select>`. Reach for it over `Select` when the user must *search* for
a row rather than *scan* for it: currency, timezone, country, language.

```jsx
const [currency, setCurrency] = useState('EUR');

<Combobox
  label="Currency"
  value={currency}
  onChanged={setCurrency}
  options={[
    { value: 'USD', label: 'US Dollar' },
    { value: 'EUR', label: 'Euro' },
    { value: 'GBP', label: 'British Pound' },
    { value: 'JPY', label: 'Japanese Yen' },
  ]}
/>
```

The trigger is `Select`'s closed-box chrome — hairline border, caret, and the inset
focus ring (`--focus-ring-inset`) the hand-rolled version kept dropping. Opening
anchors an overlay: a filter input pinned above a scrollable, keyboard-navigable
listbox. Rows are RANKED by the shared matcher (`skMatchScore` — exact, then prefix,
then substring, list order within a tier); pass `fuzzy` for scored-subsequence
ranking where short codes plus long names justify it. ArrowUp/Down move the active
row (wrapping), Enter picks, Escape and outside-press close. When nothing matches,
the empty row NAMES the filter and offers to clear it — never a bare empty box.
