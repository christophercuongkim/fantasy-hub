A detail screen's main pane beside a rail of secondary panels.

```jsx
<div style={{ height: '100%' }}>
  <ContentRail
    content={<PageBody width="list"><Feed /></PageBody>}
    rail={<><YourBalance /><SettlePlan /><Balances /></>}
  />
</div>

<ContentRail railBelow={false} content={<Thread />} rail={<><People /><Links /></>} />
```

Give it a height: each column scrolls inside it at `lg`. Below `lg` the panels follow the
content in order, which is layout.md's rule; a rail never becomes a drawer or a tab. Use
`railBelow={false}` only when the main pane cannot have anything under it, such as a chat
thread whose bottom edge is its composer; then anything a phone needs belongs in the
content itself. Not for a list beside its detail: that is `SplitPane`.
