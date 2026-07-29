import {
  careerLeaderboard,
  teamSeasons,
  weekScores,
  headToHead,
  managerSeasons,
  scatterPoints,
} from "@/lib/hall-of-records";
import { Charts } from "./charts";

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

  const championsByYear = [...champs].sort((a, b) => b.season - a.season);
  const topWeeks = weeks.slice(0, 10);

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <header className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight">Hall of Records</h1>
        <p className="mt-2 text-neutral-500">
          PeopleCanEat · 12 seasons (2014–2025). Career &amp; head-to-head stats
          cover the GUID-identified era (2022–25); single-game records span all
          12 years.
        </p>
      </header>

      {/* charts */}
      <Charts
        managerSeasons={mSeasons}
        headToHead={h2h}
        scatter={scatter}
        career={career}
      />

      {/* award cards */}
      <h2 className="mb-4 mt-12 text-2xl font-semibold">Awards</h2>
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {awards.map((a) => (
          <div
            key={a.title}
            className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
          >
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium text-neutral-500">
                {a.title}
              </span>
              <span className="text-2xl">{a.emoji}</span>
            </div>
            <div className="mt-1 text-lg font-semibold">{a.who}</div>
            <div className="text-sm text-neutral-600 dark:text-neutral-400">
              {a.detail}
            </div>
            {a.note && (
              <div className="mt-1 text-xs text-neutral-400">{a.note}</div>
            )}
          </div>
        ))}
      </section>

      {/* tables */}
      <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-2xl font-semibold">Career leaderboard</h2>
          <p className="mb-2 text-xs text-neutral-400">2022–25 (GUID era)</p>
          <Table
            head={["Manager", "Titles", "Playoffs", "Record", "Win%", "Points"]}
            rows={[...career]
              .sort((a, b) => b.titles - a.titles || b.winPct - a.winPct)
              .map((r) => [
                r.manager,
                r.titles || "—",
                r.playoffs,
                `${r.wins}-${r.losses}${r.ties ? `-${r.ties}` : ""}`,
                `${(r.winPct * 100).toFixed(0)}%`,
                fmt(r.pointsFor, 0),
              ])}
          />
        </div>
        <div>
          <h2 className="mb-3 text-2xl font-semibold">Champions</h2>
          <p className="mb-2 text-xs text-neutral-400">
            final placement each season
          </p>
          <Table
            head={["Season", "Champion", "Record", "Points"]}
            rows={championsByYear.map((c) => [
              c.season,
              c.manager ?? `${c.team}`,
              `${c.wins}-${c.losses}`,
              fmt(c.pointsFor, 0),
            ])}
          />
        </div>
      </div>

      <div className="mt-10">
        <h2 className="mb-3 text-2xl font-semibold">Top single-week scores</h2>
        <Table
          head={["#", "Season", "Week", "Team", "Score"]}
          rows={topWeeks.map((w, i) => [
            i + 1,
            w.season,
            w.week,
            w.team,
            fmt(w.score),
          ])}
        />
      </div>
    </main>
  );
}

function Table({
  head,
  rows,
}: {
  head: string[];
  rows: (string | number)[][];
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
      <table className="w-full text-sm">
        <thead className="bg-neutral-50 text-left text-neutral-500 dark:bg-neutral-900">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={i}
              className="border-t border-neutral-100 dark:border-neutral-800"
            >
              {r.map((c, j) => (
                <td
                  key={j}
                  className={`px-3 py-2 ${j === 0 ? "font-medium" : ""}`}
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
