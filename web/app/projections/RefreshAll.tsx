"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@seakim/design-system";
import { refreshAll, refreshStatus, type RefreshStatus } from "./actions";

// One click starts the api backfill (ingest all seasons + project every week).
// The api runs it in the background; this polls for progress, shows
// "Processing… N weeks", and calls router.refresh() to reload the page data
// once the job finishes — no manual reload.
export function RefreshAll() {
  const router = useRouter();
  const [starting, start] = useTransition();
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<RefreshStatus | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // If a backfill is already running when the page opens, pick up its progress.
  useEffect(() => {
    let active = true;
    refreshStatus().then((s) => {
      if (active && s.running) {
        setStatus(s);
        setRunning(true);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  // Poll while running; when it stops, refresh the page data + report done.
  useEffect(() => {
    if (!running) return;
    let active = true;
    const tick = async () => {
      const s = await refreshStatus();
      if (!active) return;
      setStatus(s);
      if (!s.running) {
        setRunning(false);
        if (s.error) {
          setError(s.error);
        } else if (s.weeksDone > 0) {
          setNote(
            `Done — projected ${s.weeksDone} weeks` +
              (s.errors.length ? `, ${s.errors.length}+ skipped.` : "."),
          );
          router.refresh(); // data changed → reload the page
        } else if (s.seasonsDone === 0) {
          setError(
            "Nothing to project — no leagues loaded in this environment.",
          );
        } else if (s.errors.length) {
          setError(`Projected 0 weeks. First error: ${s.errors[0]}`);
        } else {
          setNote("Done — no new weeks to project.");
        }
      }
    };
    const id = setInterval(tick, 4000);
    tick();
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [running, router]);

  const onClick = () =>
    start(async () => {
      setError(null);
      setNote(null);
      const r = await refreshAll();
      if (r.error) {
        setError(r.error);
        return;
      }
      setRunning(true); // started (or already running) → enter the poll loop
    });

  const loadingLabel = running
    ? status
      ? `Processing… ${status.weeksDone} wk`
      : "Processing…"
    : "Starting…";

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
        loading={starting || running}
        loadingLabel={loadingLabel}
        disabled={starting || running}
        onClick={onClick}
      >
        Refresh all
      </Button>
      {error ? (
        <span
          style={{ font: "var(--type-caption)", color: "var(--text-danger)" }}
        >
          {error}
        </span>
      ) : running ? (
        <span
          style={{ font: "var(--type-caption)", color: "var(--text-tertiary)" }}
        >
          Processing in the background — this can take a few minutes.
        </span>
      ) : note ? (
        <span
          style={{ font: "var(--type-caption)", color: "var(--text-tertiary)" }}
        >
          {note}
        </span>
      ) : null}
    </div>
  );
}
