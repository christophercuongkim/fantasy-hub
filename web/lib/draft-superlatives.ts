// Draft superlatives, off the ADP columns the bootstrap ADP ingest fills
// (draft_picks.adp_at_time / reach_delta). Raw SQL via drizzle's sql``, same as
// hall-of-records. Picks are labelled by manager if known, else team name (the
// pre-2022 unclaimed era) — so records span every season.
import { sql } from "drizzle-orm";
import { getDb } from "@/db";

// One drafted pick that matched a consensus ADP (reach = adp - overall;
// positive = drafted earlier than consensus). Powers reaches, values, tendency.
export type ValuePick = {
  who: string;
  season: number;
  overall: number;
  round: number;
  player: string;
  pos: string | null;
  adp: number;
  reach: number;
};

export type PosCount = { round: number; pos: string; n: number };

// Every pick with a matched ADP, ordered by reach (reaches first). The page
// slices the head (biggest reaches) and tail (biggest values) and groups by
// manager for the tendency table — all from this one pass.
export async function valueBoard(): Promise<ValuePick[]> {
  const db = getDb();
  const rows = await db.execute(sql`
    select coalesce(mgr.display_name, lt.name) as who,
           l.season, dp.overall, dp.round,
           coalesce(p.full_name, dp.player_name) as player,
           p.position as pos,
           dp.adp_at_time::float as adp,
           dp.reach_delta::float as reach
    from draft_picks dp
    join leagues l on l.id = dp.league_id
    join league_teams lt on lt.id = dp.league_team_id
    left join managers mgr on mgr.id = lt.manager_id
    left join players p on p.id = dp.player_id
    where dp.reach_delta is not null
    order by dp.reach_delta desc
  `);
  return (rows as unknown as Record<string, unknown>[]).map((r) => ({
    who: String(r.who),
    season: Number(r.season),
    overall: Number(r.overall),
    round: Number(r.round),
    player: String(r.player),
    pos: (r.pos as string | null) ?? null,
    adp: Number(r.adp),
    reach: Number(r.reach),
  }));
}

// Pick counts by round × position (resolved picks only), for the positional
// draft profile. Not gated on ADP — position comes from the crosswalk.
export async function positionByRound(): Promise<PosCount[]> {
  const db = getDb();
  const rows = await db.execute(sql`
    select dp.round, p.position as pos, count(*)::int as n
    from draft_picks dp
    join players p on p.id = dp.player_id
    group by dp.round, p.position
    order by dp.round, p.position
  `);
  return (rows as unknown as Record<string, unknown>[]).map((r) => ({
    round: Number(r.round),
    pos: String(r.pos),
    n: Number(r.n),
  }));
}
