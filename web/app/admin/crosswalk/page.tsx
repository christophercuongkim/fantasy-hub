import { inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { players as playersTable } from "@/db/schema";
import { confirmMatch, dismiss } from "./actions";

// Personal app, no multi-user auth yet — this route just isn't linked publicly.
export const dynamic = "force-dynamic";

type Cand = { player_id: string; name: string; score: number };
type QueueRow = { source_id: string; candidates_json: Cand[] | null };
type Player = {
  id: string;
  full_name: string;
  position: string;
  team: string | null;
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
        })
        .from(playersTable)
        .where(inArray(playersTable.id, candIds))
    : [];
  const pById = new Map(players.map((p) => [p.id, p]));

  const [counts] = (await db.execute(sql`
    select count(*) filter (where player_id is not null) as resolved,
           count(*) as total
    from draft_picks
  `)) as unknown as { resolved: number; total: number }[];

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Crosswalk review</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {Number(counts.resolved).toLocaleString()} /{" "}
          {Number(counts.total).toLocaleString()} draft picks linked to a player
          · {queue.length} name
          {queue.length === 1 ? "" : "s"} need a decision
        </p>
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
              <div className="mb-2 flex items-center justify-between">
                <span className="font-semibold">{r.source_id}</span>
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
                            ? `${p.position}${p.team ? ` · ${p.team}` : ""}`
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
