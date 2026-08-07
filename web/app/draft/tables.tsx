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

// Reaches and values share a shape; they differ only in the surviving figure —
// a reach shows how many spots EARLIER than ADP (reach = adp - overall), a value
// how many spots LATER (the opposite, -reach). Both display as positive
// magnitudes; the column label carries the direction, so no minus signs.
function ValueTable({
  rows,
  caption,
  metricLabel,
  magnitude,
}: {
  rows: ValuePick[];
  caption: string;
  metricLabel: string;
  magnitude: (r: ValuePick) => number;
}) {
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
            // the metric is the whole point → the surviving sm figure. The
            // record (row 0 of the already-sorted list) is accented — the one
            // highlight per table, the rest stay ink.
            key: "metric",
            label: metricLabel,
            numeric: true,
            survives: true,
            render: (r) =>
              r.reach === rows[0]?.reach ? (
                <span style={{ color: "var(--text-accent)", fontWeight: 600 }}>
                  {magnitude(r).toFixed(1)}
                </span>
              ) : (
                magnitude(r).toFixed(1)
              ),
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
      caption="Biggest reaches — spots drafted earlier than consensus"
      metricLabel="Reach"
      magnitude={(r) => r.reach}
    />
  );
}

export function ValuesTable({ rows }: { rows: ValuePick[] }) {
  return (
    <ValueTable
      rows={rows}
      caption="Biggest values — spots a player fell past consensus ADP"
      metricLabel="Value"
      magnitude={(r) => -r.reach}
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
