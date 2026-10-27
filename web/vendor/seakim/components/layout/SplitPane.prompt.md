A list on the left, the open item on the right, its properties further right.

```jsx
<SplitPane
  detailOpen={id != null}
  onBack={() => setId(null)}
  list={<ListGroup heading="Today">{rows}</ListGroup>}
  detail={<>
    <SplitPane.Header title={item.title} counter="3 of 12" onClose={() => setId(null)} onPrev={prev} onNext={next} />
    <div style={{ padding: 'var(--space-6)' }}>{body}</div>
  </>}
  aside={<Properties item={item} />}
/>
```

Give it a height (`100%` of a flex parent, or a fixed one): each column scrolls inside it,
and a split pane that scrolls the page is the bug the component exists to prevent. Keep
the selection in the URL or the app's state and pass `detailOpen`; the component never
decides what is selected. Start the detail with `SplitPane.Header` (or the named `SplitPaneHeader` from a Server Component) so the phone gets its
back control and the desktop its close and prev/next for free. The aside is for facts
about the open item (stage, dates, owner), never for actions.
