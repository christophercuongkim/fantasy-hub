"use client";

import { type RefObject, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Select,
  Table,
  useMeasuredBreakpoint,
} from "@seakim/design-system";
import type { DraftBoardRow } from "@/lib/draft-board";
import { rebuildBoard } from "./actions";

const POSITIONS = ["All", "QB", "RB", "WR", "TE", "K", "DST"];
const one = (n: number) => n.toFixed(1);
const signed = (n: number) => (n > 0 ? "+" : "") + n.toFixed(0);

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
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const shown = pos === "All" ? rows : rows.filter((r) => r.pos === pos);

  const rebuild = () =>
    start(async () => {
      setMsg(null);
      const r = await rebuildBoard(leagueKey);
      if (r.error) {
        setMsg(`Error: ${r.error}`);
        return;
      }
      setMsg(
        `Built ${r.result?.board_size} players (${r.result?.unmatched} unmatched).`,
      );
      router.refresh();
    });

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
              style={{
                font: "var(--type-caption)",
                color: "var(--text-tertiary)",
              }}
            >
              {msg}
            </span>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <p
          style={{
            font: "var(--type-body-sm)",
            color: "var(--text-secondary)",
          }}
        >
          No board yet for {season}. Hit “Rebuild board” to compute it from the
          projections + current ADP.
        </p>
      ) : (
        <div ref={ref as RefObject<HTMLDivElement | null>}>
          <Table<DraftBoardRow>
            bp={bp}
            rowKey={(r) => r.overallRank}
            caption={`${season} draft value board — ranked by value over replacement`}
            columns={[
              { key: "overallRank", label: "#", identifying: true },
              { key: "player", label: "Player", secondary: true },
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
                // ADP − our rank: value (we like more than the market) reads in
                // ink, a reach stays muted. Achromatic — the board is a calm grid.
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
      )}
    </div>
  );
}
