"use client";

import type { RefObject } from "react";
import { Table, useMeasuredBreakpoint } from "@seakim/design-system";
import type { CareerRow } from "@/lib/hall-of-records";

// DS Table takes function props (render / rowKey) and a measured breakpoint, so
// it can't be driven straight from the server-rendered page — these thin client
// wrappers own the column definitions and the container measurement. The page
// passes plain, already-sorted rows.

function fmt(n: number, d = 1) {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}

// useMeasuredBreakpoint's ref is typed RefObject<HTMLElement>; a div ref wants
// HTMLDivElement. Narrow it once here.
function useBp() {
  const { ref, bp } = useMeasuredBreakpoint();
  return { ref: ref as RefObject<HTMLDivElement | null>, bp };
}

export function CareerTable({ rows }: { rows: CareerRow[] }) {
  const { ref, bp } = useBp();
  return (
    <div ref={ref}>
      <Table<CareerRow>
        bp={bp}
        rowKey={(r) => r.manager}
        caption="Career leaderboard, 2022–25"
        columns={[
          { key: "manager", label: "Manager", identifying: true },
          {
            // Titles is the sort key, so it's the sm surviving figure (Win% as
            // the sm figure looked unsorted). subLabel names the bare number.
            key: "titles",
            label: "Titles",
            numeric: true,
            survives: true,
            render: (r) => r.titles || "—",
            subLabel: (r) => (r.titles === 1 ? "title" : "titles"),
          },
          { key: "playoffs", label: "Playoffs", numeric: true, priority: 3 },
          {
            key: "record",
            label: "Record",
            priority: 2,
            render: (r) => `${r.wins}-${r.losses}${r.ties ? `-${r.ties}` : ""}`,
          },
          {
            key: "winPct",
            label: "Win%",
            numeric: true,
            secondary: true,
            render: (r) => `${(r.winPct * 100).toFixed(0)}%`,
          },
          {
            key: "pointsFor",
            label: "Points",
            numeric: true,
            render: (r) => fmt(r.pointsFor, 0),
          },
        ]}
        rows={rows}
      />
    </div>
  );
}

export type ChampionRow = {
  season: number;
  who: string;
  record: string;
  pointsFor: number;
};

export function ChampionsTable({ rows }: { rows: ChampionRow[] }) {
  const { ref, bp } = useBp();
  return (
    <div ref={ref}>
      <Table<ChampionRow>
        bp={bp}
        rowKey={(r) => r.season}
        caption="League champion each season"
        columns={[
          { key: "season", label: "Season", identifying: true },
          // secondary → the champion's name is the sm subtitle under the season.
          { key: "who", label: "Champion", secondary: true },
          { key: "record", label: "Record" },
          {
            key: "pointsFor",
            label: "Points",
            numeric: true,
            survives: true,
            render: (r) => fmt(r.pointsFor, 0),
          },
        ]}
        rows={rows}
      />
    </div>
  );
}

export type TopWeekRow = {
  rank: number;
  season: number;
  week: number;
  team: string;
  score: number;
};

export function TopWeeksTable({ rows }: { rows: TopWeekRow[] }) {
  const { ref, bp } = useBp();
  return (
    <div ref={ref}>
      <Table<TopWeekRow>
        bp={bp}
        rowKey={(r) => r.rank}
        caption="Top single-week scores, all seasons"
        columns={[
          { key: "rank", label: "#", identifying: true },
          // secondary → who scored is the sm subtitle; season/week stay columns
          // at md+ but drop off the phone (the score + who is what matters there).
          { key: "team", label: "Team", secondary: true },
          { key: "season", label: "Season", numeric: true },
          { key: "week", label: "Week", numeric: true },
          {
            key: "score",
            label: "Score",
            numeric: true,
            survives: true,
            render: (r) => fmt(r.score),
          },
        ]}
        rows={rows}
      />
    </div>
  );
}

export type StandingRow = {
  rank: number;
  team: string;
  record: string;
  pointsFor: number;
};

// Final standings for a single season (season-in-review view).
export function StandingsTable({ rows }: { rows: StandingRow[] }) {
  const { ref, bp } = useBp();
  return (
    <div ref={ref}>
      <Table<StandingRow>
        bp={bp}
        rowKey={(r) => r.rank}
        caption="Final standings"
        columns={[
          { key: "rank", label: "#", identifying: true },
          { key: "team", label: "Team", secondary: true },
          { key: "record", label: "Record" },
          {
            key: "pointsFor",
            label: "Points",
            numeric: true,
            survives: true,
            render: (r) => fmt(r.pointsFor, 0),
          },
        ]}
        rows={rows}
      />
    </div>
  );
}
