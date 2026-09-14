"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@seakim/design-system";
import { refreshAll, refreshStatus, type RefreshStatus } from "./actions";

// How long to keep polling a job that reports no progress before giving up on it.
// A healthy backfill keeps advancing weeksDone/seasonsDone even when slow, so
// this only trips on a job that has actually stopped reporting — at which point
// polling forever just holds the Neon compute awake for nothing.
const STALL_MS = 15 * 60 * 1000;

// One click starts the api backfill (ingest all seasons + project every week).
// The api runs it in the background; this polls for progress, shows
// "Processing… N weeks", and calls router.refresh() to reload the page data
// once the job finishes — no manual reload.
export function RefreshAll() {
  const router = useRouter();
  const [starting, start] = useTransition();
  const [running, setRunning] = useState(false);
  // Which button kicked off the current run, so only it shows "Processing…"
  // (the other is disabled but keeps its label). null = not us / picked up on
  // mount, in which case the caption carries the running state.
  const [activeMode, setActiveMode] = useState<"refresh" | "rebuild" | null>(
    null,
  );
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
  // A hidden tab doesn't poll (nobody is reading the progress caption, and every
  // poll wakes the Neon compute), and a job that stops reporting progress is
  // eventually abandoned rather than polled forever.
  const lastProgress = useRef("");
  const progressAt = useRef(0);
  useEffect(() => {
    if (!running) return;
    let active = true;
    lastProgress.current = "";
    progressAt.current = Date.now();
    const tick = async () => {
      if (document.hidden) {
        progressAt.current = Date.now();
        return;
      }
      const s = await refreshStatus();
      if (!active) return;
      setStatus(s);
      const progress = `${s.seasonsDone}/${s.weeksDone}`;
      if (progress !== lastProgress.current) {
        lastProgress.current = progress;
        progressAt.current = Date.now();
      } else if (s.running && Date.now() - progressAt.current > STALL_MS) {
        setRunning(false);
        setActiveMode(null);
        setError(
          "Lost track of this job — no progress for 15 minutes. It may still be running; reload to pick it up again.",
        );
        return;
      }
      if (!s.running) {
        setRunning(false);
        setActiveMode(null);
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
        } else {
          // Seasons processed but nothing new — the steady state on a re-run
          // (all weeks already done; a not-yet-published season 404s). Neutral,
          // not an alarm.
          setNote(
            s.errors.length
              ? `Up to date — no new weeks. Skipped: ${s.errors[0]}`
              : "Up to date — no new weeks to project.",
          );
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

  const run = (forceIngestAll: boolean) => {
    setActiveMode(forceIngestAll ? "rebuild" : "refresh");
    start(async () => {
      setError(null);
      setNote(null);
      const r = await refreshAll(forceIngestAll);
      if (r.error) {
        setError(r.error);
        setActiveMode(null);
        return;
      }
      setRunning(true); // started (or already running) → enter the poll loop
    });
  };

  const busy = starting || running; // disables both buttons

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
      <div style={{ display: "flex", gap: "var(--space-2)" }}>
        {/* Refresh: re-score stored data (fast, the normal case). */}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          iconLeft="arrows-clockwise"
          loading={busy && activeMode === "refresh"}
          loadingLabel={loadingLabel}
          disabled={busy}
          onClick={() => run(false)}
        >
          Refresh
        </Button>
        {/* Full rebuild: re-fetch every season's source data first, then re-score
            — for an nflverse schema change / a new dataset. Slower. Same
            (secondary) weight as Refresh — ghost read as a link, not a button. */}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          iconLeft="database"
          loading={busy && activeMode === "rebuild"}
          loadingLabel={loadingLabel}
          disabled={busy}
          onClick={() => run(true)}
        >
          Full rebuild
        </Button>
      </div>
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
      ) : (
        <span
          style={{
            font: "var(--type-caption)",
            color: "var(--text-tertiary)",
            textAlign: "right",
          }}
        >
          Refresh re-scores stored data · Full rebuild refreshes the registry +
          all data, then re-projects every week
        </span>
      )}
    </div>
  );
}
