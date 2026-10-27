Where something is in a sequence everyone knows the end of.

```jsx
<Stepper
  current="phone"
  steps={[
    { key: 'pursuing', label: 'Pursuing' },
    { key: 'applied', label: 'Applied', description: 'Oct 3' },
    { key: 'recruiter', label: 'Recruiter screen' },
    { key: 'phone', label: 'Phone screen', description: 'Thu 2pm' },
    { key: 'onsite', label: 'Onsite' },
    { key: 'offer', label: 'Offer' },
  ]}
/>
```

Leave `orientation` on `auto`: it reads the container and goes vertical under `md`, which
is the only pipeline shape any phone reference showed. Use it for a pipeline, an order's
journey, an application's stages. A wizard's "4 of 13" is a `Progress`; a list of done
tasks is a `Checkbox` list. Do not pass `onSelect` to make it look clickable: pass it when
the app will act on the step, and only offer the steps it allows.
