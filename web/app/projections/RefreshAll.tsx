"use client";

import { useState, useTransition } from "react";
import { Button } from "@seakim/design-system";
import { refreshAll, type RefreshState } from "./actions";

// Admin control on /projections: one click kicks off the api backfill (ingest
// all seasons + project every week) in the background. Fire-and-forget — the
// button reports that it started; reload later to see the fresh numbers.
export function RefreshAll() {
  const [pending, start] = useTransition();
  const [state, setState] = useState<RefreshState>({});

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-1)",
        alignItems: "flex-end",
      }}
    >
      <Button
        type="button"
        variant="secondary"
        size="sm"
        iconLeft="arrows-clockwise"
        loading={pending}
        loadingLabel="Starting…"
        onClick={() => start(async () => setState(await refreshAll()))}
      >
        Refresh all
      </Button>
      {state.started ? (
        <span
          style={{ font: "var(--type-caption)", color: "var(--text-tertiary)" }}
        >
          Started — projections fill in over a few minutes. Reload to check.
        </span>
      ) : state.error ? (
        <span
          style={{ font: "var(--type-caption)", color: "var(--text-danger)" }}
        >
          {state.error}
        </span>
      ) : null}
    </div>
  );
}
