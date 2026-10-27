Several avatars in one place — overlapped, capped at `max`, with the rest as a "+k" pill.

```jsx
<AvatarStack items={readers} max={3} size="sm" />
<AvatarStack items={members} max={5} size="xs" frontToBack={false} />
```

`items` is an array of `{ name, src, status }` — the same shape `Avatar` takes. The stack
shows up to `max` avatars, then collapses the rest into a non-interactive "+k" count pill;
a remainder of exactly one shows the avatar instead, because a pill that saves no space is
noise. `frontToBack` picks which end sits on top — it defaults to first-in-front and is not
a reading-order cue. For a single person use `Avatar`; the stack is for two or more. Overlap
is the shared `--avatar-overlap` token, so every facepile in the system slides the same
amount. See `spec/AvatarStack.md`.
