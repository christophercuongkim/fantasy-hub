A modal for a decision that must happen now. Not for information — that is a `Toast`.

```jsx
<Dialog
  open={open}
  title="Delete this trip"
  description="Lisbon, 14–21 Mar. Bookings already paid for are not cancelled by this."
  onClose={close}
  footer={<>
    <Button variant="ghost" onClick={close}>Keep trip</Button>
    <Button variant="danger" onClick={del}>Delete trip</Button>
  </>}
/>
```

Gets `--shadow-dialog` because it floats. Scrim is `--surface-scrim`. The cancel
button says what keeping means, never "Cancel".
