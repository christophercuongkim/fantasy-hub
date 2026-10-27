A section that folds, with what is inside it named on the closed row.

```jsx
<Disclosure summary="Fare breakdown" meta="4 items">
  <p>Base fare $312 · Taxes $86 · Seat $14 · Bag $0</p>
</Disclosure>
<Disclosure summary="How the 79 breaks down" defaultOpen>
  …
</Disclosure>
```

Stack several and let more than one stay open; it is not an accordion and never closes a
sibling. Put the count or the headline figure in `meta` so the closed row still answers
the first question. Open by default where the content is the point of the page, closed
where it is the supporting detail (the score bars in a pane, the operator tools on a
record). It is a fold, not a navigation: a row that opens another screen is a `ListRow`
with a chevron pointing right.
