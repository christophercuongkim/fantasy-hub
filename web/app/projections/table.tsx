"use client";

import type { RefObject } from "react";
import { useState } from "react";
import { Select, Table, useMeasuredBreakpoint } from "@seakim/design-system";
import type { ProjectionRow } from "@/lib/projections";

// Positions + "All"; 5 options → a Select (SegmentedControl is for 2–4).
const POSITIONS = ["All", "QB", "RB", "WR", "TE"];

type Ranked = ProjectionRow & { rank: number };

export function ProjectionsTable({ rows }: { rows: ProjectionRow[] }) {
  const { ref, bp } = useMeasuredBreakpoint();
  const [pos, setPos] = useState("All");

  // Filter client-side (small, admin-only dataset), then re-rank within the view.
  const ranked: Ranked[] = (
    pos === "All" ? rows : rows.filter((r) => r.pos === pos)
  ).map((r, i) => ({ ...r, rank: i + 1 }));

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
          caption="Projected fantasy points this week (baseline model)"
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
              key: "mean",
              label: "Proj",
              numeric: true,
              survives: true,
              render: (r) => r.mean.toFixed(1),
            },
          ]}
          rows={ranked}
        />
      </div>
    </div>
  );
}
