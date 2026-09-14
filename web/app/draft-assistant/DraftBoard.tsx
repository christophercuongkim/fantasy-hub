"use client";

import {
  type RefObject,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import {
  Badge,
  Button,
  EmptyState,
  Select,
  Switch,
  Table,
  useMeasuredBreakpoint,
} from "@seakim/design-system";
import type { DraftBoardRow, RosterPick } from "@/lib/draft-board";
import {
  bestAvailable,
  computeNeeds,
  isTierCliff,
  type Needs,
  pickClock,
  type PickClock,
} from "@/lib/draft-recs";
import { rebuildBoard, syncDraft } from "./actions";

const POSITIONS = ["All", "QB", "RB", "WR", "TE", "K", "DST"];

// How long Live keeps polling with no new picks before switching itself off.
// Long enough to outlast the gap between your picks in a slow league; short
// enough that a tab left open overnight costs ~20 minutes of compute, not eight
// hours.
const LIVE_IDLE_MS = 20 * 60 * 1000;
const one = (n: number) => n.toFixed(1);
const signed = (n: number) => (n > 0 ? "+" : "") + n.toFixed(0);

// The "will actually miss games" designations. Preseason, ~a quarter of the
// draftable pool is day-to-day "Questionable" — noise on a draft board — so only
// this tier gets a badge here. Q/D are still stored in player_status and surface
// in-season for start/sit; they just don't clutter the draft board.
const OUT_STATUSES = new Set(["O", "IR", "IR-R", "PUP", "PUP-R", "SUSP", "NA"]);

// The injury badge beside a player's name, or null when healthy / merely Q/D.
function StatusBadge({ row }: { row: DraftBoardRow }) {
  if (!row.status || !OUT_STATUSES.has(row.status.toUpperCase())) return null;
  const title = [row.statusFull, row.status].filter(Boolean).join(" · ");
  return (
    <Badge tone="danger" variant="subtle" mono title={title}>
      {row.status}
    </Badge>
  );
}

type Msg = { text: string; error: boolean } | null;

export function DraftBoard({
  leagueKey,
  rows,
  season,
  myRoster,
  draftedCount,
  rosterSlots,
  numTeams,
  myDraftPosition,
  myPickOveralls,
}: {
  leagueKey: string;
  rows: DraftBoardRow[];
  season: number;
  myRoster: RosterPick[];
  draftedCount: number;
  rosterSlots: Record<string, number>;
  numTeams: number;
  myDraftPosition: number | null;
  myPickOveralls: number[];
}) {
  const router = useRouter();
  const { ref, bp } = useMeasuredBreakpoint();
  const [pos, setPos] = useState("All");
  const [live, setLive] = useState(false);
  const [hideDrafted, setHideDrafted] = useState(true);
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();

  // While Live, poll Yahoo draft-results every 10s and re-read the page. A ref
  // guards against overlapping polls if one call runs long.
  //
  // Each poll wakes the Neon compute, which bills by uptime and only suspends
  // once nothing is connected — so a Live switch left on is a database left
  // running. Two brakes: a hidden tab doesn't poll at all, and Live turns itself
  // off once the draft stops moving. Neither can fire during a real draft, where
  // picks keep arriving and the tab is the thing you're looking at.
  const inFlight = useRef(false);
  const lastPicks = useRef(-1);
  const idleSince = useRef(0);
  useEffect(() => {
    if (!live) return;
    let active = true;
    lastPicks.current = -1;
    idleSince.current = Date.now();
    const tick = async () => {
      // Backgrounded: nobody is watching, so don't poll — and don't let the idle
      // clock age either, since a hidden tab isn't burning anything. Coming back
      // to the tab therefore starts the 20 minutes over.
      if (document.hidden) {
        idleSince.current = Date.now();
        return;
      }
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        const r = await syncDraft(leagueKey);
        if (!active) return;
        if (r.error) {
          setMsg({ text: `Live sync: ${r.error}`, error: true });
          return;
        }
        // `picks` is the draft's running pick count. Unchanged = nothing has
        // happened since the last poll. If the api ever stops returning it we
        // refresh every poll as before, rather than silently never refreshing.
        const picks =
          typeof r.result?.picks === "number" ? r.result.picks : null;
        if (picks === null || picks > lastPicks.current) {
          if (picks !== null) lastPicks.current = picks;
          idleSince.current = Date.now();
          router.refresh();
        } else if (Date.now() - idleSince.current > LIVE_IDLE_MS) {
          setLive(false);
          setMsg({
            text: "Live sync paused — no new picks for 20 minutes. Flip Live back on to resume.",
            error: false,
          });
        }
      } finally {
        inFlight.current = false;
      }
    };
    const id = setInterval(tick, 10000);
    tick();
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [live, leagueKey, router]);

  const byPos = pos === "All" ? rows : rows.filter((r) => r.pos === pos);
  const shown = hideDrafted ? byPos.filter((r) => !r.drafted) : byPos;
  // Best available in view = the accent hero (first undrafted row).
  const heroRank = shown.find((r) => !r.drafted)?.overallRank ?? null;

  // Recommendations: what to take now, given my roster + the draft state.
  const needs = computeNeeds(rosterSlots, myRoster);
  const recs = bestAvailable(rows, needs, 5);
  const clock = pickClock(
    numTeams,
    draftedCount,
    myDraftPosition,
    myPickOveralls,
  );

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
          gap: "var(--space-4)",
          alignItems: "flex-end",
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "var(--space-4)",
            alignItems: "center",
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
          <Switch
            size="sm"
            checked={live}
            onChange={setLive}
            label="Live"
            hint={live ? `Synced · ${draftedCount} drafted` : undefined}
          />
          <Switch
            size="sm"
            checked={hideDrafted}
            onChange={setHideDrafted}
            label="Hide drafted"
          />
        </div>
        {rebuildControl}
      </div>

      <Recommendations
        recs={recs}
        needs={needs}
        clock={clock}
        rows={rows}
        draftedCount={draftedCount}
      />

      {myRoster.length > 0 && <MyRoster picks={myRoster} />}

      <div ref={ref as RefObject<HTMLDivElement | null>}>
        <Table<DraftBoardRow>
          bp={bp}
          rowKey={(r) => r.overallRank}
          caption={`${season} draft value board — ranked by value over replacement`}
          columns={[
            { key: "overallRank", label: "#", identifying: true },
            {
              key: "player",
              label: "Player",
              secondary: true,
              render: (r) => (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "var(--space-2)",
                  }}
                >
                  {r.player}
                  <StatusBadge row={r} />
                </span>
              ),
            },
            { key: "pos", label: "Pos", render: (r) => `${r.pos}${r.posRank}` },
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
              // The ranking figure — survives to sm. Drafted players dim (taken);
              // otherwise the best-available top row is the one accent hero.
              key: "vor",
              label: "VOR",
              numeric: true,
              survives: true,
              subLabel: (r) => `${r.pos}${r.posRank} · T${r.tier}`,
              render: (r) => {
                const color = r.drafted
                  ? "var(--text-tertiary)"
                  : r.overallRank === heroRank
                    ? "var(--text-accent)"
                    : undefined;
                return color ? (
                  <span style={{ color }}>{one(r.vor)}</span>
                ) : (
                  one(r.vor)
                );
              },
            },
            {
              key: "adp",
              label: "ADP",
              numeric: true,
              secondary: true,
              render: (r) => (r.adp == null ? "—" : one(r.adp)),
            },
            {
              // ADP − our rank: a value reads in ink, a reach stays muted.
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
              priority: 2,
              render: (r) => `T${r.tier}`,
            },
          ]}
          rows={shown}
        />
      </div>
    </div>
  );
}

const NEED_ORDER = ["QB", "RB", "WR", "TE", "K", "DST"];

// "What to take now": the pick clock, my open needs, and the best available for
// them (with tier-cliff flags). The one actionable panel during a live draft.
function Recommendations({
  recs,
  needs,
  clock,
  rows,
  draftedCount,
}: {
  recs: DraftBoardRow[];
  needs: Needs;
  clock: PickClock | null;
  rows: DraftBoardRow[];
  draftedCount: number;
}) {
  const needLabels = NEED_ORDER.filter((p) => needs.base[p] > 0).map((p) =>
    needs.base[p] > 1 ? `${p}×${needs.base[p]}` : p,
  );
  if (needs.flexOpen > 0) needLabels.push("FLEX");

  const clockLine = clock
    ? clock.onClock
      ? "You're on the clock"
      : `Pick ${clock.nextPick} — you're up in ${clock.picksUntil}`
    : `${draftedCount} drafted`;

  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
        padding: "var(--space-4)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "var(--space-3)",
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            font: "var(--type-eyebrow)",
            textTransform: "uppercase",
            letterSpacing: "var(--tracking-caps)",
            color: "var(--text-tertiary)",
          }}
        >
          {clockLine}
        </span>
        <span
          style={{
            font: "var(--type-body-sm)",
            color: "var(--text-secondary)",
          }}
        >
          {needLabels.length
            ? `Need ${needLabels.join(" · ")}`
            : "Starters full"}
        </span>
      </div>

      <ol
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-1)",
          listStyle: "none",
        }}
      >
        {recs.map((r) => {
          const cliff = isTierCliff(rows, r);
          return (
            <li
              key={r.overallRank}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-2)",
                font: "var(--type-body-sm)",
                color: "var(--text-primary)",
              }}
            >
              <span style={{ color: "var(--text-tertiary)" }}>
                {r.pos}
                {r.posRank}
              </span>
              <span>{r.player}</span>
              <StatusBadge row={r} />
              <span style={{ color: "var(--text-tertiary)" }}>
                VOR {r.vor.toFixed(0)} · T{r.tier}
              </span>
              {cliff && (
                <Badge tone="warning" variant="subtle">
                  last in tier
                </Badge>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

// My drafted players, grouped by position — a compact "what I have so far".
function MyRoster({ picks }: { picks: RosterPick[] }) {
  const order = ["QB", "RB", "WR", "TE", "K", "DST"];
  const byPos = order
    .map((p) => ({ pos: p, names: picks.filter((x) => x.pos === p) }))
    .filter((g) => g.names.length > 0);
  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
        padding: "var(--space-4)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      <span
        style={{
          font: "var(--type-eyebrow)",
          textTransform: "uppercase",
          letterSpacing: "var(--tracking-caps)",
          color: "var(--text-tertiary)",
        }}
      >
        Your team · {picks.length}
      </span>
      <div style={{ display: "flex", gap: "var(--space-5)", flexWrap: "wrap" }}>
        {byPos.map((g) => (
          <div
            key={g.pos}
            style={{
              font: "var(--type-body-sm)",
              color: "var(--text-secondary)",
            }}
          >
            <span style={{ color: "var(--text-tertiary)" }}>{g.pos} </span>
            {g.names.map((n) => n.player).join(", ")}
          </div>
        ))}
      </div>
    </section>
  );
}
