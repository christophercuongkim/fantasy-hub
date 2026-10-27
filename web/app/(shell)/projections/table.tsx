"use client";

import type { RefObject } from "react";
import { useState } from "react";
import {
  Range,
  Select,
  Table,
  useMeasuredBreakpoint,
} from "@seakim/design-system";
import type { ProjectionRow } from "@/lib/projections";

// Positions + "All"; 5 options → a Select (SegmentedControl is for 2–4).
const POSITIONS = ["All", "QB", "RB", "WR", "TE"];
const POSITION_ORDER = ["QB", "RB", "WR", "TE"];
const POSITION_LABEL: Record<string, string> = {
  QB: "Quarterbacks",
  RB: "Running Backs",
  WR: "Wide Receivers",
  TE: "Tight Ends",
};

const f1 = (n: number) => n.toFixed(1);
// A floor/ceiling range, or "—" when Layer 3 hasn't been run for this row.
const rangeText = (r: ProjectionRow) =>
  r.p20 != null && r.p80 != null ? `${f1(r.p20)}–${f1(r.p80)}` : "—";

type Ranked = ProjectionRow & { rank: number };

// One section per position (DS: one accent hero per section — the leader's Range
// is promoted, everything else stays achromatic). Each section scales its own
// domain, so a bar reads against its positional peers, not across positions.
function PositionSection({
  position,
  rows,
  bp,
}: {
  position: string;
  rows: ProjectionRow[];
  bp: "sm" | "md" | "lg";
}) {
  if (rows.length === 0) return null;

  // rows arrive already sorted by mean desc, so filtering preserves the ranking.
  const ranked: Ranked[] = rows.map((r, i) => ({ ...r, rank: i + 1 }));
  const ceilings = ranked
    .map((r) => r.p80)
    .filter((v): v is number => v != null);
  const maxCeil = ceilings.length ? Math.max(...ceilings) : 0;

  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
      }}
    >
      <h2
        style={{
          font: "var(--type-eyebrow)",
          textTransform: "uppercase",
          letterSpacing: "var(--tracking-caps)",
          color: "var(--text-secondary)",
        }}
      >
        {POSITION_LABEL[position] ?? position}
      </h2>
      <Table<Ranked>
        bp={bp}
        rowKey={(r) => `${r.pos}-${r.player}-${r.rank}`}
        caption={`Projected fantasy points this week — ${POSITION_LABEL[position] ?? position}, floor to ceiling`}
        columns={[
          { key: "rank", label: "#", identifying: true },
          { key: "player", label: "Player", secondary: true },
          {
            key: "team",
            label: "Team",
            priority: 2,
            render: (r) => r.team ?? "—",
          },
          {
            key: "p20",
            label: "Floor",
            numeric: true,
            render: (r) => (r.p20 != null ? f1(r.p20) : "—"),
          },
          {
            key: "mean",
            label: "Proj",
            numeric: true,
            survives: true, // the one figure that stays at sm…
            subLabel: (r) => `range ${rangeText(r)}`, // …with the range under it
            render: (r) => f1(r.mean),
          },
          {
            key: "p80",
            label: "Ceiling",
            numeric: true,
            render: (r) => (r.p80 != null ? f1(r.p80) : "—"),
          },
          {
            // Floor→ceiling band, marker at the projection, on this section's
            // shared domain. The section leader's bar is the one accent (rank 1);
            // the rest stay grey. Drops at sm — numbers survive via Proj subLabel.
            key: "range",
            label: "Range",
            width: 160,
            render: (r) =>
              r.p20 != null && r.p80 != null && maxCeil > 0 ? (
                <Range
                  low={r.p20}
                  mid={r.mean}
                  high={r.p80}
                  domain={[0, maxCeil]}
                  size="sm"
                  accent={r.rank === 1}
                  label={`${r.player}: floor ${f1(r.p20)}, projected ${f1(
                    r.mean,
                  )}, ceiling ${f1(r.p80)}`}
                />
              ) : (
                "—"
              ),
          },
        ]}
        rows={ranked}
      />
    </section>
  );
}

export function ProjectionsTable({ rows }: { rows: ProjectionRow[] }) {
  const { ref, bp } = useMeasuredBreakpoint();
  const [pos, setPos] = useState("All");

  // "All" shows every position as its own section; a filter narrows to one.
  const shown = pos === "All" ? POSITION_ORDER : [pos];

  return (
    <div>
      <div style={{ maxWidth: "9rem", marginBottom: "var(--space-4)" }}>
        <Select
          size="sm"
          value={pos}
          options={POSITIONS}
          aria-label="Filter by position"
          onChange={(e) => setPos(e.target.value)}
        />
      </div>
      <div
        ref={ref as RefObject<HTMLDivElement | null>}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-7)",
        }}
      >
        {shown.map((p) => (
          <PositionSection
            key={p}
            position={p}
            rows={rows.filter((r) => r.pos === p)}
            bp={bp}
          />
        ))}
      </div>
    </div>
  );
}
