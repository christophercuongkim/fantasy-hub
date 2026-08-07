"use client";

import { useActionState } from "react";
import { Button, Input } from "@seakim/design-system";
import { refreshWeek, type RefreshState } from "./actions";

// Admin control on /projections: pick a season + week and run ingest → project
// on the api. useActionState surfaces the outcome inline (a bad input or api
// error never crashes the page); the inputs are `required` so an empty submit is
// blocked before it reaches the server.
export function RefreshForm({
  defaultSeason,
  defaultWeek,
}: {
  defaultSeason?: number;
  defaultWeek?: number;
}) {
  const [state, action, pending] = useActionState<RefreshState, FormData>(
    refreshWeek,
    {},
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-1)",
        alignItems: "flex-end",
      }}
    >
      <form
        action={action}
        style={{
          display: "flex",
          gap: "var(--space-2)",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div style={{ width: "6rem" }}>
          <Input
            name="season"
            type="number"
            size="sm"
            fullWidth
            required
            min={2019}
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
            required
            min={1}
            defaultValue={defaultWeek}
            placeholder="Week"
            aria-label="Week"
          />
        </div>
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
      </form>
      {state.error ? (
        <span
          style={{ font: "var(--type-caption)", color: "var(--text-danger)" }}
        >
          {state.error}
        </span>
      ) : state.ok ? (
        <span
          style={{ font: "var(--type-caption)", color: "var(--text-tertiary)" }}
        >
          Refreshed.
        </span>
      ) : null}
    </div>
  );
}
