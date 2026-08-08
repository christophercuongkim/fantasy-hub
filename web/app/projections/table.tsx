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

const f1 = (n: number) => n.toFixed(1);
// A floor/ceiling range, or "—" when Layer 3 hasn't been run for this row.
const rangeText = (r: ProjectionRow) =>
  r.p20 != null && r.p80 != null ? `${f1(r.p20)}–${f1(r.p80)}` : "—";

type Ranked = ProjectionRow & { rank: number };

export function ProjectionsTable({ rows }: { rows: ProjectionRow[] }) {
  const { ref, bp } = useMeasuredBreakpoint();
  const [pos, setPos] = useState("All");

  // Filter client-side (small, admin-only dataset), then re-rank within the view.
  const ranked: Ranked[] = (
    pos === "All" ? rows : rows.filter((r) => r.pos === pos)
  ).map((r, i) => ({ ...r, rank: i + 1 }));

  // One shared domain across the visible rows so every Range bar compares on the
  // same scale (see DS decision 0017). Ceilings drive the max; 0 is the floor.
  const ceilings = ranked
    .map((r) => r.p80)
    .filter((v): v is number => v != null);
  const maxCeil = ceilings.length ? Math.max(...ceilings) : 0;

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
      <div ref={ref as RefObject<HTMLDivElement | null>}>
        <Table<Ranked>
          bp={bp}
          rowKey={(r) => `${r.pos}-${r.player}-${r.rank}`}
          caption="Projected fantasy points this week — floor, projection, ceiling"
          columns={[
            { key: "rank", label: "#", identifying: true },
            // player is the row identity on the phone; the rest are columns.
            { key: "player", label: "Player", secondary: true },
            { key: "pos", label: "Pos", priority: 3 },
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
              // The Range glyph: floor→ceiling band, marker at the projection, on
              // the shared domain. Drops at sm with the rest of the table's
              // columns (the numbers survive via Proj's subLabel).
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
      </div>
    </div>
  );
}
