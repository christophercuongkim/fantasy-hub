"use client";

import { type RefObject, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  EmptyState,
  Select,
  Table,
  useMeasuredBreakpoint,
} from "@seakim/design-system";
import type { DraftBoardRow } from "@/lib/draft-board";
import { rebuildBoard } from "./actions";

const POSITIONS = ["All", "QB", "RB", "WR", "TE", "K", "DST"];
const one = (n: number) => n.toFixed(1);
const signed = (n: number) => (n > 0 ? "+" : "") + n.toFixed(0);

type Msg = { text: string; error: boolean } | null;

export function DraftBoard({
  leagueKey,
  rows,
  season,
}: {
  leagueKey: string;
  rows: DraftBoardRow[];
  season: number;
}) {
  const router = useRouter();
  const { ref, bp } = useMeasuredBreakpoint();
  const [pos, setPos] = useState("All");
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();

  const shown = pos === "All" ? rows : rows.filter((r) => r.pos === pos);

  // Best available in the current view (top of the board / the filtered position)
  // = the one accent hero. It's always the first row, so the accent is visible at
  // the top rather than hidden somewhere down a long list (one accent per section).
  const heroRank = shown[0]?.overallRank ?? null;

  const rebuild = () =>
    start(async () => {
      setMsg(null);
      const r = await rebuildBoard(leagueKey);
      if (r.error) {
        setMsg({ text: `Couldn’t build the board: ${r.error}`, error: true });
        return;
      }
      setMsg({
        text: `Built ${r.result?.board_size} players (${r.result?.unmatched} unmatched).`,
        error: false,
      });
      router.refresh();
    });

  // Button + its async outcome. The outcome is a live region so a keyboard/SR
  // user hears the rebuild result; an error reads in the danger ink, not muted.
  const rebuildControl = (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: "var(--space-1)",
      }}
    >
      <Button
        variant="secondary"
        size="sm"
        iconLeft="arrows-clockwise"
        loading={pending}
        loadingLabel="Building…"
        disabled={pending}
        onClick={rebuild}
      >
        Rebuild board
      </Button>
      {msg && (
        <span
          role="status"
          aria-live="polite"
          style={{
            font: "var(--type-caption)",
            color: msg.error ? "var(--text-danger)" : "var(--text-tertiary)",
          }}
        >
          {msg.text}
        </span>
      )}
    </div>
  );

  if (rows.length === 0) {
    return (
      <EmptyState
        icon="list-numbers"
        title={`No ${season} board yet`}
        description="Build it from the projections and current ADP."
        action={rebuildControl}
      />
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-4)",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: "var(--space-3)",
          alignItems: "flex-end",
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <div style={{ maxWidth: "9rem" }}>
          <Select
            size="sm"
            value={pos}
            options={POSITIONS}
            aria-label="Filter by position"
            onChange={(e) => setPos(e.target.value)}
          />
        </div>
        {rebuildControl}
      </div>

      <div ref={ref as RefObject<HTMLDivElement | null>}>
        <Table<DraftBoardRow>
          bp={bp}
          rowKey={(r) => r.overallRank}
          caption={`${season} draft value board — ranked by value over replacement`}
          columns={[
            { key: "overallRank", label: "#", identifying: true },
            {
              // Best available in view is the one accent hero (top row).
              key: "player",
              label: "Player",
              secondary: true,
              render: (r) =>
                r.overallRank === heroRank ? (
                  <span style={{ color: "var(--text-accent)" }}>
                    {r.player}
                  </span>
                ) : (
                  r.player
                ),
            },
            {
              key: "pos",
              label: "Pos",
              render: (r) => `${r.pos}${r.posRank}`,
            },
            {
              key: "team",
              label: "Team",
              priority: 3,
              render: (r) => r.team ?? "—",
            },
            {
              key: "seasonPts",
              label: "Proj",
              numeric: true,
              priority: 2,
              render: (r) => one(r.seasonPts),
            },
            {
              key: "vor",
              label: "VOR",
              numeric: true,
              survives: true, // the ranking figure — stays at sm
              subLabel: (r) => `${r.pos}${r.posRank} · T${r.tier}`,
              render: (r) => one(r.vor),
            },
            {
              key: "adp",
              label: "ADP",
              numeric: true,
              secondary: true,
              render: (r) => (r.adp == null ? "—" : one(r.adp)),
            },
            {
              // ADP − our rank: a value (we rate higher than the market) reads
              // in ink, a reach stays muted. Sign glyph carries it when colour
              // can't. Achromatic — the accent hero is the top row's name.
              key: "value",
              label: "Value",
              numeric: true,
              priority: 2,
              render: (r) =>
                r.value == null ? (
                  "—"
                ) : (
                  <span
                    style={{
                      color:
                        r.value > 0
                          ? "var(--text-primary)"
                          : "var(--text-tertiary)",
                    }}
                  >
                    {signed(r.value)}
                  </span>
                ),
            },
            {
              key: "tier",
              label: "Tier",
              numeric: true,
              priority: 3,
              render: (r) => `T${r.tier}`,
            },
          ]}
          rows={shown}
        />
      </div>
    </div>
  );
}
