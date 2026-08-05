Wraps any control with its label, hint, and error line. Use it always — never a bare input.

```jsx
<Field label="Confirmation code" hint="Six characters, from your email" htmlFor="conf">
  <Input id="conf" placeholder="XG4K2P" />
</Field>
```

`error` replaces `hint` rather than stacking. Error copy follows the three-facts rule:
cause, consequence, next step.
