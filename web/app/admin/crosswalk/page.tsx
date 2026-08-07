import { inArray, sql } from "drizzle-orm";
import { Button, Card, EmptyState } from "@seakim/design-system";
import { getDb } from "@/db";
import { draftPicks, players as playersTable } from "@/db/schema";
import { confirmMatch, dismiss, runCrosswalk } from "./actions";
import { AssignSearch } from "./AssignSearch";
import { RunButton } from "./RunButton";

// Admin-gated by the middleware (/admin → admins only).
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

const listStyle: React.CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: 0,
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-3)",
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
    (draftedBy.get(c.name) ?? draftedBy.set(c.name, []).get(c.name)!).push({
      season: c.season,
      round: c.round,
    });
  }

  const [counts] = (await db.execute(sql`
    select count(*) filter (where player_id is not null) as resolved,
           count(*) as total from draft_picks
  `)) as unknown as { resolved: number; total: number }[];

  const withCand = queue.filter((r) => (r.candidates_json ?? []).length > 0);
  const noCand = queue.filter((r) => (r.candidates_json ?? []).length === 0);

  const card = (r: QueueRow) => {
    const picks = draftedBy.get(r.source_id) ?? [];
    const seasons = [...new Set(picks.map((p) => p.season))].sort();
    const rounds = [...new Set(picks.map((p) => p.round))].sort(
      (a, b) => a - b,
    );
    const rd = !rounds.length
      ? ""
      : rounds.length > 1
        ? `R${rounds[0]}–${rounds[rounds.length - 1]}`
        : `R${rounds[0]}`;
    return (
      <li key={r.source_id}>
        <Card
          title={r.source_id}
          meta={
            seasons.length > 0
              ? `drafted ${seasons.join(", ")} · ${rd}`
              : undefined
          }
          footer={
            <form action={dismiss.bind(null, r.source_id)}>
              <Button variant="ghost" size="sm" type="submit">
                No match
              </Button>
            </form>
          }
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "var(--space-2)",
            }}
          >
            {(r.candidates_json ?? []).map((c) => {
              const p = pById.get(c.player_id);
              const detail = p
                ? [
                    p.position,
                    p.team ?? undefined,
                    p.draft_year
                      ? `NFL '${String(p.draft_year).slice(2)}`
                      : undefined,
                    p.status && p.status !== "ACT" ? p.status : undefined,
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : "";
              return (
                <form
                  key={c.player_id}
                  action={confirmMatch.bind(null, r.source_id, c.player_id)}
                >
                  <Button variant="secondary" size="md" type="submit">
                    <span style={{ fontWeight: 600 }}>
                      {p?.full_name ?? c.name}
                    </span>
                    <span
                      style={{
                        marginLeft: "var(--space-2)",
                        color: "var(--text-tertiary)",
                      }}
                    >
                      {detail ? `${detail} · ` : ""}
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {c.score}%
                      </span>
                    </span>
                  </Button>
                </form>
              );
            })}
          </div>
          <AssignSearch sourceId={r.source_id} />
        </Card>
      </li>
    );
  };

  return (
    <main
      style={{
        maxWidth: "48rem",
        margin: "0 auto",
        padding: "var(--space-8) var(--space-5)",
      }}
    >
      <header
        style={{
          marginBottom: "var(--space-6)",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "var(--space-4)",
        }}
      >
        <div>
          <h1
            style={{ font: "var(--type-title)", color: "var(--text-primary)" }}
          >
            Crosswalk review
          </h1>
          <p
            style={{
              marginTop: "var(--space-1)",
              font: "var(--type-body-sm)",
              color: "var(--text-secondary)",
            }}
          >
            {Number(counts.resolved).toLocaleString()} /{" "}
            {Number(counts.total).toLocaleString()} draft picks linked to a
            player · {withCand.length} to review
          </p>
        </div>
        <form action={runCrosswalk} style={{ flexShrink: 0 }}>
          <RunButton />
        </form>
      </header>

      {queue.length === 0 ? (
        <EmptyState
          icon="confetti"
          title="Nothing to review"
          description="Every resolvable name is matched."
        />
      ) : (
        <>
          {withCand.length > 0 && (
            <ul style={listStyle}>{withCand.map(card)}</ul>
          )}
          {noCand.length > 0 && (
            <details style={{ marginTop: "var(--space-8)" }}>
              <summary
                style={{
                  cursor: "pointer",
                  font: "var(--type-label)",
                  color: "var(--text-secondary)",
                }}
              >
                Unmatched — {noCand.length} name{noCand.length === 1 ? "" : "s"}{" "}
                with no suggestion (optional — search to assign)
              </summary>
              <ul style={{ ...listStyle, marginTop: "var(--space-3)" }}>
                {noCand.map(card)}
              </ul>
            </details>
          )}
        </>
      )}
    </main>
  );
}
