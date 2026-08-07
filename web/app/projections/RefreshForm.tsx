"use client";

import { useFormStatus } from "react-dom";
import { Button, Input } from "@seakim/design-system";
import { refreshWeek } from "./actions";

// Submit button reflecting the running pipeline (the parent <form> action is the
// server action that POSTs to the api and revalidates). type="submit" is
// explicit — the DS Button defaults to type="button".
function RunButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="primary"
      size="sm"
      iconLeft="arrows-clockwise"
      loading={pending}
      loadingLabel="Running…"
    >
      Refresh
    </Button>
  );
}

// Admin control on /projections: pick a season + week and run
// ingest → project on the api. Defaults to the currently shown week.
export function RefreshForm({
  defaultSeason,
  defaultWeek,
}: {
  defaultSeason?: number;
  defaultWeek?: number;
}) {
  return (
    <form
      action={refreshWeek}
      style={{
        display: "flex",
        gap: "var(--space-2)",
        alignItems: "flex-end",
        flexWrap: "wrap",
      }}
    >
      <div style={{ width: "6rem" }}>
        <Input
          name="season"
          type="number"
          size="sm"
          fullWidth
          defaultValue={defaultSeason}
          placeholder="Season"
          aria-label="Season"
        />
      </div>
      <div style={{ width: "5rem" }}>
        <Input
          name="week"
          type="number"
          size="sm"
          fullWidth
          min={1}
          defaultValue={defaultWeek}
          placeholder="Week"
          aria-label="Week"
        />
      </div>
      <RunButton />
    </form>
  );
}
