The one page shape that has no sidebar: brand on top, one card, nothing else.

```jsx
<GateLayout brand="Voyage" footer={<>By continuing you agree to the <a href="/terms">terms</a>.</>}>
  <h1 style={{ font: 'var(--type-title)' }}>Sign in</h1>
  <Button fullWidth>Continue with Google</Button>
  <Button variant="secondary" fullWidth>Continue with email</Button>
</GateLayout>

<GateLayout brand="Voyage" width="36rem" align="top">…a wizard screen…</GateLayout>
```

Use it for sign-in, the not-invited page, a paywall, and a wizard's screens; leave the
app shell for everything after. The page's `h1` goes in the column, not in `brand`. The
defaults are the gate: a 24rem card centred in the height. A wizard takes the wider column
and `align="top"` so its screens do not jump as their length changes; pass `card={false}`
only when the content is a single statement with nothing to fill in.
