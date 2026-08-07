import { Badge, Card, EmptyState, Icon } from "@seakim/design-system";
import { auth, isAdmin } from "@/auth";
import {
  draftSeasons,
  earliestKicker,
  positionByRound,
  valueBoard,
} from "@/lib/draft-superlatives";
import { PositionalHeatmap, ScatterCard, ValueHistogram } from "./charts";
import { YearFilter } from "./YearFilter";
import {
  ReachTable,
  TendencyTable,
  ValuesTable,
  type TendencyRow,
} from "./tables";

export const dynamic = "force-dynamic"; // reads live DB

const POS_ORDER = ["QB", "RB", "WR", "TE", "K", "DEF", "DST"];
const TOP = 10;
const MIN_PICKS = 15; // enough matched picks for a stable per-manager average

// value is one signed scale: + = steal (fell past ADP), − = reach (taken early).
const signed = (n: number) => (n > 0 ? "+" : "") + n.toFixed(1);

const sectionLabel: React.CSSProperties = {
  font: "var(--type-heading)",
  color: "var(--text-primary)",
};

// A superlative: uppercase kicker (eyebrow), who/what (title), a big mono figure,
// a context line. The figure carries emphasis through size + mono — ink by
// default; accent only for the section hero, to keep the accent scarce.
function AwardCard({
  label,
  headline,
  figure,
  detail,
  icon,
  hero = false,
}: {
  label: string;
  headline: string;
  figure: string;
  detail: string;
  icon: string;
  hero?: boolean;
}) {
  const emphasis = hero ? "var(--text-accent)" : "var(--text-primary)";
  return (
    <Card eyebrow={label} title={headline}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-1)",
          marginTop: "var(--space-2)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
          }}
        >
          <span
            style={{
              display: "flex",
              color: hero ? "var(--text-accent)" : "var(--text-tertiary)",
            }}
          >
            <Icon name={icon} size={24} />
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontVariantNumeric: "tabular-nums",
              fontSize: "var(--text-2xl)",
              fontWeight: 600,
              lineHeight: 1,
              color: emphasis,
            }}
          >
            {figure}
          </span>
        </div>
        <span
          style={{ font: "var(--type-caption)", color: "var(--text-tertiary)" }}
        >
          {detail}
        </span>
      </div>
    </Card>
  );
}

export default async function Draft({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const session = await auth();
  const admin = isAdmin(session?.user?.email);

  const sp = await searchParams;
  const season =
    sp.season && /^\d{4}$/.test(sp.season) ? Number(sp.season) : undefined;

  const [board, posRows, kicker, seasons] = await Promise.all([
    valueBoard(season),
    positionByRound(season),
    earliestKicker(season),
    draftSeasons(),
  ]);
  // A single season is one draft per manager (~15 picks), so the all-time
  // MIN_PICKS gate would empty the tendency table — relax it when filtered.
  const minPicks = season != null ? 5 : MIN_PICKS;

  // board is desc by value: head = biggest steals, tail = biggest reaches.
  const values = board.filter((r) => r.value > 0).slice(0, TOP);
  const reaches = [...board]
    .reverse()
    .filter((r) => r.value < 0)
    .slice(0, TOP);
  const byBook = board.length
    ? board.reduce((a, b) => (Math.abs(b.value) < Math.abs(a.value) ? b : a))
    : null;
  const r1 = board.filter((r) => r.round === 1);
  const round1Steal = r1.length
    ? r1.reduce((a, b) => (b.value > a.value ? b : a))
    : null;

  // Public award cards, all single-pick. Figures are signed value (+ steal,
  // − reach) on the one scale. The biggest value is the section hero (accent).
  const awards: {
    label: string;
    headline: string;
    figure: string;
    detail: string;
    icon: string;
    hero?: boolean;
  }[] = [];
  if (values[0])
    awards.push({
      label: "Biggest steal",
      headline: values[0].player,
      figure: signed(values[0].value),
      detail: `${values[0].who} · pick ${values[0].overall} · ${values[0].season}`,
      icon: "tag",
      hero: true,
    });
  if (reaches[0])
    awards.push({
      label: "Biggest reach",
      headline: reaches[0].player,
      figure: signed(reaches[0].value),
      detail: `${reaches[0].who} · pick ${reaches[0].overall} · ${reaches[0].season}`,
      icon: "arrow-fat-up",
    });
  if (round1Steal)
    awards.push({
      label: "Round 1 steal",
      headline: round1Steal.player,
      figure: signed(round1Steal.value),
      detail: `${round1Steal.who} · pick ${round1Steal.overall} · ${round1Steal.season}`,
      icon: "medal",
    });
  if (byBook)
    awards.push({
      label: "By the book",
      headline: byBook.player,
      figure: signed(byBook.value),
      detail: `drafted right on ADP · ${byBook.who} · ${byBook.season}`,
      icon: "book-open",
    });
  if (kicker)
    awards.push({
      label: "First kicker off the board",
      headline: kicker.player,
      figure: `#${kicker.overall}`,
      detail: `${kicker.who} · ${kicker.season}`,
      icon: "football-helmet",
    });

  // Per-manager mean value (admin): steals positive, reaches negative.
  const acc = new Map<string, { sum: number; n: number }>();
  for (const r of board) {
    const a = acc.get(r.who) ?? { sum: 0, n: 0 };
    a.sum += r.value;
    a.n += 1;
    acc.set(r.who, a);
  }
  const tendency: TendencyRow[] = [...acc]
    .map(([who, { sum, n }]) => ({ who, avg: sum / n, picks: n }))
    .filter((t) => t.picks >= minPicks)
    .sort((a, b) => b.avg - a.avg);

  const adminAwards: {
    label: string;
    headline: string;
    figure: string;
    detail: string;
    icon: string;
  }[] = [];
  if (tendency.length) {
    const sharp = tendency[0]; // highest mean value
    const gambler = tendency[tendency.length - 1]; // lowest (most negative)
    const onScript = tendency.reduce((a, b) =>
      Math.abs(b.avg) < Math.abs(a.avg) ? b : a,
    );
    adminAwards.push(
      {
        label: "Sharpest value",
        headline: sharp.who,
        figure: signed(sharp.avg),
        detail: `mean value · ${sharp.picks} picks`,
        icon: "scales",
      },
      {
        label: "Biggest gambler",
        headline: gambler.who,
        figure: signed(gambler.avg),
        detail: `mean value · ${gambler.picks} picks`,
        icon: "dice-five",
      },
      {
        label: "Most on-script",
        headline: onScript.who,
        figure: signed(onScript.avg),
        detail: `closest to ADP · ${onScript.picks} picks`,
        icon: "target",
      },
    );
  }

  // Positional heatmap: canonical position order first, any extras appended.
  const present = new Set(posRows.map((r) => r.pos));
  const positions = [
    ...POS_ORDER.filter((p) => present.has(p)),
    ...[...present].filter((p) => !POS_ORDER.includes(p)).sort(),
  ];

  const awardGrid: React.CSSProperties = {
    display: "grid",
    gap: "var(--space-4)",
    gridTemplateColumns: "repeat(auto-fit, minmax(15rem, 1fr))",
  };

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
      <header
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "var(--space-4)",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1
            style={{ font: "var(--type-title)", color: "var(--text-primary)" }}
          >
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
        </div>
        <YearFilter seasons={seasons} value={season} />
      </header>

      {board.length === 0 ? (
        <EmptyState
          icon="list-numbers"
          title="No draft ADP yet"
          description="Reaches and values appear once the draft board is loaded with consensus ADP."
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
            <h2 style={sectionLabel}>Awards</h2>
            <div style={awardGrid}>
              {awards.map((a) => (
                <AwardCard key={a.label} {...a} />
              ))}
            </div>
          </section>

          <section
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-4)",
            }}
          >
            <h2 style={sectionLabel}>The board</h2>
            <div
              style={{
                display: "grid",
                gap: "var(--space-4)",
                gridTemplateColumns: "repeat(auto-fit, minmax(22rem, 1fr))",
              }}
            >
              <ScatterCard picks={board} />
              <Card
                title="Value distribution"
                meta="how the league drafts vs the board"
              >
                <ValueHistogram picks={board} />
              </Card>
            </div>
          </section>

          <section
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-4)",
            }}
          >
            <h2 style={sectionLabel}>Reaches &amp; values</h2>
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
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2)",
                }}
              >
                <h2 style={sectionLabel}>Manager tendency</h2>
                <Badge tone="neutral">Admin only</Badge>
              </div>
              <div style={awardGrid}>
                {adminAwards.map((a) => (
                  <AwardCard key={a.label} {...a} />
                ))}
              </div>
              <Card
                title="Draft discipline"
                meta="mean reach vs ADP per manager"
              >
                <TendencyTable rows={tendency} />
              </Card>
              <Card
                title="Positional profile"
                meta="picks by position in each round"
              >
                <PositionalHeatmap data={posRows} positions={positions} />
              </Card>
            </section>
          )}
        </>
      )}
    </main>
  );
}
