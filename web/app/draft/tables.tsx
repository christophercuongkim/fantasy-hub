"use client";

import type { RefObject } from "react";
import { Table, useMeasuredBreakpoint } from "@seakim/design-system";
import type { ValuePick } from "@/lib/draft-superlatives";

// DS Table takes function props + a measured breakpoint, so it can't be driven
// straight from the server page — these thin client wrappers own the columns and
// the container measurement. The page passes plain, already-sorted rows.

function useBp() {
  const { ref, bp } = useMeasuredBreakpoint();
  return { ref: ref as RefObject<HTMLDivElement | null>, bp };
}

const signed = (n: number) => (n > 0 ? "+" : "") + n.toFixed(1);
const one = (n: number) => n.toFixed(1);

// Reaches and values share a shape; only the sort + caption + the surviving
// figure's meaning differ, so one component covers both.
function ValueTable({ rows, caption }: { rows: ValuePick[]; caption: string }) {
  const { ref, bp } = useBp();
  return (
    <div ref={ref}>
      <Table<ValuePick>
        bp={bp}
        rowKey={(r) => `${r.season}-${r.overall}`}
        caption={caption}
        columns={[
          // player is the row identity; who drafted them is the sm subtitle.
          { key: "player", label: "Player", identifying: true },
          { key: "who", label: "Manager", secondary: true },
          {
            key: "pos",
            label: "Pos",
            priority: 3,
            render: (r) => r.pos ?? "—",
          },
          { key: "season", label: "Season", numeric: true, priority: 2 },
          { key: "overall", label: "Pick", numeric: true },
          {
            key: "adp",
            label: "ADP",
            numeric: true,
            secondary: true,
            render: (r) => one(r.adp),
          },
          {
            // reach is the whole point → the surviving sm figure.
            key: "reach",
            label: "Reach",
            numeric: true,
            survives: true,
            render: (r) => signed(r.reach),
            subLabel: () => "vs ADP",
          },
        ]}
        rows={rows}
      />
    </div>
  );
}

export function ReachTable({ rows }: { rows: ValuePick[] }) {
  return (
    <ValueTable
      rows={rows}
      caption="Biggest reaches — drafted earlier than consensus"
    />
  );
}

export function ValuesTable({ rows }: { rows: ValuePick[] }) {
  return (
    <ValueTable
      rows={rows}
      caption="Biggest values — fell past consensus ADP"
    />
  );
}

export type TendencyRow = { who: string; avg: number; picks: number };

export function TendencyTable({ rows }: { rows: TendencyRow[] }) {
  const { ref, bp } = useBp();
  return (
    <div ref={ref}>
      <Table<TendencyRow>
        bp={bp}
        rowKey={(r) => r.who}
        caption="Average reach vs ADP per manager (+ reaches, − waits for value)"
        columns={[
          { key: "who", label: "Manager", identifying: true },
          {
            key: "avg",
            label: "Avg reach",
            numeric: true,
            survives: true,
            render: (r) => signed(r.avg),
          },
          {
            key: "picks",
            label: "Picks",
            numeric: true,
            secondary: true,
            render: (r) => `${r.picks}`,
          },
        ]}
        rows={rows}
      />
    </div>
  );
}

export type PositionalRow = { round: number; counts: Record<string, number> };

export function PositionalTable({
  rows,
  positions,
}: {
  rows: PositionalRow[];
  positions: string[];
}) {
  const { ref, bp } = useBp();
  return (
    <div ref={ref}>
      <Table<PositionalRow>
        bp={bp}
        rowKey={(r) => r.round}
        caption="Picks by position in each round (all seasons)"
        columns={[
          {
            key: "round",
            label: "Round",
            identifying: true,
            render: (r) => `R${r.round}`,
          },
          ...positions.map((pos) => ({
            key: pos,
            label: pos,
            numeric: true,
            render: (r: PositionalRow) => r.counts[pos] || "—",
          })),
        ]}
        rows={rows}
      />
    </div>
  );
}
