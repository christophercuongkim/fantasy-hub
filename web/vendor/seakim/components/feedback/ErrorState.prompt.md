# ErrorState

A region or route that failed — says what broke, what it means, and the one way forward.
Per [0029](../../decisions/0029-error-state.md).

```jsx
<ErrorState
  title="Couldn't load places"
  description="Check your connection and try again."
  onRetry={refetch}
/>

// Terminal error (a 403) — retrying can't help, so escape instead of retry:
<ErrorState
  title="You don't have access to this trip"
  description="Ask the owner to invite you."
  action={<Button variant="secondary" iconLeft="arrow-left" onClick={goBack}>Go back</Button>}
/>
```

Reuses the centred frame of `EmptyState`/`LoadingState` but is its own treatment: **no
dashed border** (that is empty's alone), an **error-toned glyph** (`--text-danger`), and
`role="alert"` + `aria-live="assertive"` so the failure is announced the instant it
renders.

- **Copy:** cause → consequence → next step, one sentence each. *"Couldn't load places.
  Check your connection and try again."*
- **Action is the point.** `onRetry` gives the default `Try again`. For a **terminal**
  error (403, not-found) where retrying will fail identically, pass `action` with a
  **navigational escape** instead — never leave a dead retry.
- **Not a Toast.** A toast fades; a failed region needs a persistent state to return to.
  Toast keeps a failed incidental action; `ErrorState` owns the region/route failure.
- **Not an `EmptyState`.** Empty says "nothing here, create it"; error says "it broke,
  recover." Opposite promises, opposite a11y roles.
