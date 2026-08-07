"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@seakim/design-system";

// Submit button that shows the job running (the parent <form> action is the
// server action that POSTs to the api and revalidates). type="submit" is
// explicit — the DS Button defaults to type="button".
export function RunButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="primary"
      iconLeft="arrows-clockwise"
      loading={pending}
      loadingLabel="Running…"
    >
      Rebuild & resolve
    </Button>
  );
}
