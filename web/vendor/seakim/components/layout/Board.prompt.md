The pipeline as columns; a card opens the record.

```jsx
<Board>
  <BoardColumn label="Pursuing" count={3} footer={<Button variant="ghost" size="sm" iconLeft="plus">Add</Button>}>
    {postings.map(p => (
      <Card key={p.id} interactive onClick={() => open(p)} eyebrow={p.company} title={p.title} padding="var(--space-5)">
        <Tag>{p.verdict}</Tag>
      </Card>
    ))}
  </BoardColumn>
  <BoardColumn label="Applied" count={0} />
</Board>
```

Give the board a height if the page should scroll columns rather than the page. Keep a
card to a title, one chip and one date; the record is a click away. Empty columns collapse
to a narrow header by default so the whole pipeline fits; pass `collapseEmpty={false}` when
every column should stay open. Moving a card is the card's own menu (a `Popover` on a
desktop, a `Sheet` on a phone), not a drag. Under `md` the board shows one column at a
time: the `Tabs` row above it jumps between stages and a swipe moves one.
