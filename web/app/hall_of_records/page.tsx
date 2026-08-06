import { Card } from "@seakim/design-system";
import {
  careerLeaderboard,
  teamSeasons,
  weekScores,
  headToHead,
  managerSeasons,
  scatterPoints,
} from "@/lib/hall-of-records";
import { Charts } from "./charts";
import { CareerTable, ChampionsTable, TopWeeksTable } from "./tables";

export const dynamic = "force-dynamic"; // reads live DB

function fmt(n: number, d = 1) {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}

type Award = {
  emoji: string;
  title: string;
  who: string;
  detail: string;
  note?: string;
};

const sectionLabel: React.CSSProperties = {
  font: "600 var(--text-2xl) var(--font-display)",
  color: "var(--text-primary)",
  letterSpacing: "-0.01em",
};

export default async function HallOfRecords() {
  const [career, seasons, weeks, h2h, mSeasons, scatter] = await Promise.all([
    careerLeaderboard(),
    teamSeasons(),
    weekScores(),
    headToHead(),
    managerSeasons(),
    scatterPoints(),
  ]);

  // --- award computations ---
  const byTitles = [...career].sort(
    (a, b) => b.titles - a.titles || b.wins - a.wins,
  );
  const bySackos = [...career].sort((a, b) => b.sackos - a.sackos);
  const byPoints = [...career].sort((a, b) => b.pointsFor - a.pointsFor);
  const topWeek = weeks[0];
  const losses = weeks.filter((w) => !w.won);
  const highLoss = [...losses].sort((a, b) => b.score - a.score)[0];
  const played = weeks.filter((w) => w.margin > 0);
  const blowout = [...played].sort((a, b) => b.margin - a.margin)[0];
  const nailBiter = [...played].sort((a, b) => a.margin - b.margin)[0];
  const noRing = [...seasons]
    .filter((s) => s.finalRank > 1)
    .sort((a, b) => b.wins - a.wins || b.pointsFor - a.pointsFor)[0];
  const champs = seasons.filter((s) => s.finalRank === 1);
  const cinderella = [...champs].sort(
    (a, b) => a.wins - b.wins || a.pointsFor - b.pointsFor,
  )[0];
  const rivalry = [...h2h]
    .filter((r) => r.a < r.b)
    .sort((x, y) => y.games - x.games)[0];
  const rivalryBack = h2h.find((r) => r.a === rivalry?.b && r.b === rivalry?.a);

  const awards: Award[] = [
    {
      emoji: "🏆",
      title: "Most Titles",
      who: byTitles[0].manager,
      detail: `${byTitles[0].titles} championship${byTitles[0].titles === 1 ? "" : "s"}`,
      note: "2022–25",
    },
    {
      emoji: "💩",
      title: "The Sacko",
      who: bySackos[0].manager,
      detail: `${bySackos[0].sackos} last-place finish${bySackos[0].sackos === 1 ? "" : "es"}`,
      note: "2022–25",
    },
    {
      emoji: "📈",
      title: "Points King",
      who: byPoints[0].manager,
      detail: `${fmt(byPoints[0].pointsFor, 0)} career points`,
      note: "2022–25",
    },
    {
      emoji: "⚡",
      title: "Highest Week Ever",
      who: topWeek.team,
      detail: `${fmt(topWeek.score)} pts`,
      note: `${topWeek.season} · wk ${topWeek.week}`,
    },
    {
      emoji: "💥",
      title: "Biggest Blowout",
      who: blowout.team,
      detail: `won by ${fmt(blowout.margin)}`,
      note: `${blowout.season} · wk ${blowout.week}`,
    },
    {
      emoji: "😬",
      title: "Nail-Biter",
      who: nailBiter.team,
      detail: `won by ${fmt(nailBiter.margin, 2)}`,
      note: `${nailBiter.season} · wk ${nailBiter.week}`,
    },
    {
      emoji: "💔",
      title: "Best Record, No Ring",
      who: noRing.manager ?? noRing.team,
      detail: `${noRing.wins}-${noRing.losses}, finished #${noRing.finalRank}`,
      note: `${noRing.season}`,
    },
    {
      emoji: "🍀",
      title: "Cinderella Champ",
      who: cinderella.manager ?? cinderella.team,
      detail: `won it at ${cinderella.wins}-${cinderella.losses}`,
      note: `${cinderella.season}`,
    },
    {
      emoji: "😭",
      title: "Highest-Scoring Loss",
      who: highLoss.team,
      detail: `${fmt(highLoss.score)} and still lost`,
      note: `${highLoss.season} · wk ${highLoss.week}`,
    },
    ...(rivalry && rivalryBack
      ? [
          {
            emoji: "🤼",
            title: "Biggest Rivalry",
            who: `${rivalry.a} vs ${rivalry.b}`,
            detail: `${rivalry.wins}–${rivalryBack.wins} over ${rivalry.games} games`,
          } as Award,
        ]
      : []),
  ];

  const careerRows = [...career].sort(
    (a, b) => b.titles - a.titles || b.winPct - a.winPct,
  );
  const championRows = [...champs]
    .sort((a, b) => b.season - a.season)
    .map((c) => ({
      season: c.season,
      who: c.manager ?? c.team,
      record: `${c.wins}-${c.losses}`,
      pointsFor: c.pointsFor,
    }));
  const topWeekRows = weeks.slice(0, 10).map((w, i) => ({
    rank: i + 1,
    season: w.season,
    week: w.week,
    team: w.team,
    score: w.score,
  }));

  return (
    <main
      style={{
        maxWidth: "72rem",
        margin: "0 auto",
        padding: "var(--space-8) var(--space-5)",
      }}
    >
      <header style={{ marginBottom: "var(--space-8)" }}>
        <h1
          style={{
            font: "700 var(--text-4xl) var(--font-display)",
            color: "var(--text-primary)",
            letterSpacing: "-0.02em",
          }}
        >
          Hall of Records
        </h1>
        <p
          style={{
            marginTop: "var(--space-2)",
            maxWidth: "44rem",
            color: "var(--text-secondary)",
          }}
        >
          PeopleCanEat · 12 seasons (2014–2025). Career &amp; head-to-head stats
          cover the GUID-identified era (2022–25); single-game records span all
          12 years.
        </p>
      </header>

      <Charts
        managerSeasons={mSeasons}
        headToHead={h2h}
        scatter={scatter}
        career={career}
      />

      <h2
        style={{ ...sectionLabel, margin: "var(--space-11) 0 var(--space-5)" }}
      >
        Awards
      </h2>
      <section
        style={{
          display: "grid",
          gap: "var(--space-4)",
          gridTemplateColumns: "repeat(auto-fill, minmax(16rem, 1fr))",
        }}
      >
        {awards.map((a) => (
          <Card
            key={a.title}
            eyebrow={`${a.emoji} ${a.title}`}
            title={a.who}
            meta={
              <>
                {/* The figure reads as a measured stat: mono, tabular, primary
                    ink (per the DS type-data rule / Stat). The context note
                    stays secondary. */}
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontVariantNumeric: "tabular-nums",
                    color: "var(--text-primary)",
                    fontWeight: 600,
                  }}
                >
                  {a.detail}
                </span>
                {a.note ? (
                  <span style={{ color: "var(--text-secondary)" }}>
                    {" · "}
                    {a.note}
                  </span>
                ) : null}
              </>
            }
          />
        ))}
      </section>

      <div
        style={{
          display: "grid",
          gap: "var(--space-8)",
          // Stack full-width. Side-by-side (~560px each) would put both tables'
          // containers under the DS 640px threshold and force the compact
          // list-row species on a laptop; full width keeps them real tables and
          // still reflows to list rows on a phone.
          gridTemplateColumns: "1fr",
          margin: "var(--space-11) 0 0",
        }}
      >
        <section>
          <h2 style={{ ...sectionLabel, marginBottom: "var(--space-3)" }}>
            Career leaderboard
          </h2>
          <TableCaption>2022–25 (GUID era)</TableCaption>
          <CareerTable rows={careerRows} />
        </section>
        <section>
          <h2 style={{ ...sectionLabel, marginBottom: "var(--space-3)" }}>
            Champions
          </h2>
          <TableCaption>final placement each season</TableCaption>
          <ChampionsTable rows={championRows} />
        </section>
      </div>

      <section style={{ marginTop: "var(--space-10)" }}>
        <h2 style={{ ...sectionLabel, marginBottom: "var(--space-3)" }}>
          Top single-week scores
        </h2>
        <TopWeeksTable rows={topWeekRows} />
      </section>
    </main>
  );
}

function TableCaption({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        margin: "0 0 var(--space-2)",
        font: "var(--text-xs) var(--font-mono)",
        color: "var(--text-secondary)",
      }}
    >
      {children}
    </p>
  );
}
