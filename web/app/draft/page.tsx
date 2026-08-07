import { Card } from "@seakim/design-system";
import { auth, isAdmin } from "@/auth";
import { positionByRound, valueBoard } from "@/lib/draft-superlatives";
import {
  PositionalTable,
  ReachTable,
  TendencyTable,
  ValuesTable,
  type PositionalRow,
  type TendencyRow,
} from "./tables";

export const dynamic = "force-dynamic"; // reads live DB

const POS_ORDER = ["QB", "RB", "WR", "TE", "K", "DEF", "DST"];
const TOP = 10;
const MIN_PICKS = 15; // enough matched picks for a stable per-manager average

const sectionLabel: React.CSSProperties = {
  font: "var(--type-heading)",
  color: "var(--text-primary)",
};

export default async function Draft() {
  const session = await auth();
  const admin = isAdmin(session?.user?.email);

  const [board, posRows] = await Promise.all([valueBoard(), positionByRound()]);

  // board is desc by reach: head = biggest reaches, tail = biggest values.
  const reaches = board.filter((r) => r.reach > 0).slice(0, TOP);
  const values = [...board]
    .reverse()
    .filter((r) => r.reach < 0)
    .slice(0, TOP);

  // Mean reach per manager (admin): reaches high, waits-for-value low.
  const acc = new Map<string, { sum: number; n: number }>();
  for (const r of board) {
    const a = acc.get(r.who) ?? { sum: 0, n: 0 };
    a.sum += r.reach;
    a.n += 1;
    acc.set(r.who, a);
  }
  const tendency: TendencyRow[] = [...acc]
    .map(([who, { sum, n }]) => ({ who, avg: sum / n, picks: n }))
    .filter((t) => t.picks >= MIN_PICKS)
    .sort((a, b) => b.avg - a.avg);

  // Positional matrix (admin): rounds as rows, present positions (canonical
  // order first, any extras appended) as columns.
  const present = new Set(posRows.map((r) => r.pos));
  const positions = [
    ...POS_ORDER.filter((p) => present.has(p)),
    ...[...present].filter((p) => !POS_ORDER.includes(p)).sort(),
  ];
  const byRound = new Map<number, Record<string, number>>();
  for (const r of posRows) {
    const m = byRound.get(r.round) ?? {};
    m[r.pos] = r.n;
    byRound.set(r.round, m);
  }
  const positional: PositionalRow[] = [...byRound.keys()]
    .sort((a, b) => a - b)
    .map((round) => ({ round, counts: byRound.get(round)! }));

  return (
    <main
      style={{
        maxWidth: "72rem",
        margin: "0 auto",
        padding: "var(--space-8) var(--space-5)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-8)",
      }}
    >
      <header>
        <h1 style={{ font: "var(--type-title)", color: "var(--text-primary)" }}>
          Draft
        </h1>
        <p
          style={{
            marginTop: "var(--space-1)",
            font: "var(--type-body-sm)",
            color: "var(--text-secondary)",
          }}
        >
          Every pick measured against consensus ADP — reach = drafted earlier
          than the board.
        </p>
      </header>

      {board.length === 0 ? (
        <Card
          title="No ADP data yet"
          meta="Run `make adp` then reload the league to fill reaches and values."
        />
      ) : (
        <>
          <section
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-4)",
            }}
          >
            <h2 style={sectionLabel}>Reaches &amp; values</h2>
            {/* Full-width, stacked — a narrow column would collapse the DS Table
                to compact list-rows and drop the pick/ADP/season evidence. */}
            <Card title="Biggest reaches" meta="drafted earlier than ADP">
              <ReachTable rows={reaches} />
            </Card>
            <Card title="Biggest values" meta="fell past ADP">
              <ValuesTable rows={values} />
            </Card>
          </section>

          {admin && (
            <section
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-4)",
              }}
            >
              <h2 style={sectionLabel}>
                Manager tendency{" "}
                <span
                  style={{
                    font: "var(--type-caption)",
                    color: "var(--text-tertiary)",
                  }}
                >
                  · admin only
                </span>
              </h2>
              <Card
                title="Draft discipline"
                meta="mean reach vs ADP per manager"
              >
                <TendencyTable rows={tendency} />
              </Card>
              <Card
                title="Positional profile"
                meta="where each position comes off the board"
              >
                <PositionalTable rows={positional} positions={positions} />
              </Card>
            </section>
          )}
        </>
      )}
    </main>
  );
}
