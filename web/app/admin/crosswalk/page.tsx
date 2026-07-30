import { inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { draftPicks, players as playersTable } from "@/db/schema";
import { confirmMatch, dismiss, runCrosswalk } from "./actions";
import { RunButton } from "./RunButton";

// Personal app, no multi-user auth yet — this route just isn't linked publicly.
export const dynamic = "force-dynamic";

type Cand = { player_id: string; name: string; score: number };
type QueueRow = { source_id: string; candidates_json: Cand[] | null };
type Player = {
  id: string;
  full_name: string;
  position: string;
  team: string | null;
  draft_year: number | null;
  status: string | null;
};

export default async function CrosswalkAdmin() {
  const db = getDb();
  const queue = (await db.execute(sql`
    select source_id, candidates_json
    from id_crosswalk_log
    where source = 'yahoo' and verified_at is null
    order by source_id
  `)) as unknown as QueueRow[];

  const candIds = [
    ...new Set(
      queue.flatMap((r) => (r.candidates_json ?? []).map((c) => c.player_id)),
    ),
  ];
  const players: Player[] = candIds.length
    ? await db
        .select({
          id: playersTable.id,
          full_name: playersTable.fullName,
          position: playersTable.position,
          team: playersTable.team,
          draft_year: playersTable.draftYear,
          status: playersTable.status,
        })
        .from(playersTable)
        .where(inArray(playersTable.id, candIds))
    : [];
  const pById = new Map(players.map((p) => [p.id, p]));

  // Which league seasons each name was drafted in — dates the pick to help
  // disambiguate same-name players.
  const names = queue.map((r) => r.source_id);
  const ctxRows = names.length
    ? await db
        .select({
          name: draftPicks.playerName,
          season: draftPicks.season,
          round: draftPicks.round,
        })
        .from(draftPicks)
        .where(inArray(draftPicks.playerName, names))
    : [];
  const draftedBy = new Map<string, { season: number; round: number }[]>();
  for (const c of ctxRows) {
    if (!c.name) continue;
    const list = draftedBy.get(c.name) ?? [];
    list.push({ season: c.season, round: c.round });
    draftedBy.set(c.name, list);
  }

  const [counts] = (await db.execute(sql`
    select count(*) filter (where player_id is not null) as resolved,
           count(*) as total
    from draft_picks
  `)) as unknown as { resolved: number; total: number }[];

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Crosswalk review
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            {Number(counts.resolved).toLocaleString()} /{" "}
            {Number(counts.total).toLocaleString()} draft picks linked to a
            player · {queue.length} name
            {queue.length === 1 ? "" : "s"} need a decision
          </p>
        </div>
        <form action={runCrosswalk} className="shrink-0">
          <RunButton />
        </form>
      </header>

      {queue.length === 0 ? (
        <p className="rounded-lg border border-neutral-200 bg-white p-6 text-center text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900">
          Nothing to review — every resolvable name is matched. 🎉
        </p>
      ) : (
        <ul className="space-y-3">
          {queue.map((r) => (
            <li
              key={r.source_id}
              className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
            >
              <div className="mb-2 flex items-start justify-between">
                <div>
                  <span className="font-semibold">{r.source_id}</span>
                  {(() => {
                    const picks = draftedBy.get(r.source_id) ?? [];
                    const seasons = [
                      ...new Set(picks.map((p) => p.season)),
                    ].sort();
                    const rounds = [...new Set(picks.map((p) => p.round))].sort(
                      (a, b) => a - b,
                    );
                    if (!seasons.length) return null;
                    const rd =
                      rounds.length > 1
                        ? `R${rounds[0]}–${rounds[rounds.length - 1]}`
                        : `R${rounds[0]}`;
                    return (
                      <span className="ml-2 text-xs text-neutral-400">
                        drafted {seasons.join(", ")} · {rd}
                      </span>
                    );
                  })()}
                </div>
                <form action={dismiss.bind(null, r.source_id)}>
                  <button className="text-xs text-neutral-400 hover:text-neutral-600 hover:underline">
                    no match
                  </button>
                </form>
              </div>
              <div className="flex flex-wrap gap-2">
                {(r.candidates_json ?? []).length === 0 && (
                  <span className="text-sm text-neutral-400">
                    no candidates — dismiss
                  </span>
                )}
                {(r.candidates_json ?? []).map((c) => {
                  const p = pById.get(c.player_id);
                  return (
                    <form
                      key={c.player_id}
                      action={confirmMatch.bind(null, r.source_id, c.player_id)}
                    >
                      <button className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:border-blue-500 hover:bg-blue-50 dark:border-neutral-700 dark:hover:border-blue-400 dark:hover:bg-blue-950">
                        <span className="font-medium">
                          {p?.full_name ?? c.name}
                        </span>{" "}
                        <span className="text-neutral-500">
                          {p
                            ? [
                                p.position,
                                p.team ?? undefined,
                                p.draft_year
                                  ? `NFL '${String(p.draft_year).slice(2)}`
                                  : undefined,
                                p.status && p.status !== "ACT"
                                  ? p.status
                                  : undefined,
                              ]
                                .filter(Boolean)
                                .join(" · ")
                            : ""}{" "}
                          · {c.score}%
                        </span>
                      </button>
                    </form>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
