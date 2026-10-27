One file, dropped or picked, with where it stands shown in the zone.

```jsx
<Field label="Résumé">
  <FileDrop
    accept=".pdf"
    hint="One PDF, up to 10 MB"
    file={resume}
    onFile={upload}
    onRemove={() => setResume(null)}
    uploading={saving}
    uploadingLabel="Reading your résumé…"
    error={failure}
    onRetry={() => setFailure(null)}
  />
</Field>
```

Put it in a `Field` for the label. Choosing a file submits at once; there is no separate
upload button, so pass `uploading` while it saves and the zone says what it is doing.
Put the failure in `error` with the cause the server gave and an `onRetry`; the zone
becomes the error state until the user tries again. Pass `file` back once you have it (a
`File` or `{ name, size }` from the server) so the row shows under the zone. Multiple files
are several `FileDrop`s or a different control.
