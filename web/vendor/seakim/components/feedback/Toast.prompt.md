Transient confirmation of something that already happened.

```jsx
<Toast message="Trip saved" tone="success" onDismiss={hide} />
<Toast message="Okafor moved to bench" actionLabel="Undo" action={undo} onDismiss={hide} />
```

Past tense, no exclamation mark, no emoji. One toast at a time, bottom-trailing.
Fades in and out on `--ease-out`; nothing overshoots (0034).
