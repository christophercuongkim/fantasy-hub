An immediate on/off for a setting. No save button, no confirmation.

```jsx
<Switch label="Price alerts" hint="Email me when this fare drops" defaultChecked />
<Switch size="sm" onChange={setLive} />
```

With a `label`, the row spreads: label left, switch right. If the change needs a save
step, that is a `Checkbox`, not a Switch.
