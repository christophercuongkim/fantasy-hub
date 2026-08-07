// Draft superlatives, off the ADP columns the bootstrap ADP ingest fills
// (draft_picks.adp_at_time / reach_delta). Raw SQL via drizzle's sql``, same as
// hall-of-records. Picks are labelled by manager if known, else team name (the
// pre-2022 unclaimed era) — so records span every season.
import { sql } from "drizzle-orm";
import { getDb } from "@/db";

// One drafted pick that matched a consensus ADP. value = overall - adp, one
// signed axis: positive = fell past ADP (a steal), negative = taken early (a
// reach). Powers reaches, values, tendency.
export type ValuePick = {
  who: string;
  season: number;
  overall: number;
  round: number;
  player: string;
  pos: string | null;
  adp: number;
  value: number;
};

export type PosCount = { round: number; pos: string; n: number };

// Every pick with a matched ADP, ordered by value desc (biggest steals first,
// biggest reaches last). The page slices the head (values) and tail (reaches)
// and groups by manager for the tendency table — all from this one pass.
export async function valueBoard(season?: number): Promise<ValuePick[]> {
  const db = getDb();
  const seasonCond = season != null ? sql`and dp.season = ${season}` : sql``;
  const rows = await db.execute(sql`
    select coalesce(mgr.display_name, lt.name) as who,
           l.season, dp.overall, dp.round,
           coalesce(p.full_name, dp.player_name) as player,
           p.position as pos,
           dp.adp_at_time::float as adp,
           (-dp.reach_delta)::float as value
    from draft_picks dp
    join leagues l on l.id = dp.league_id
    join league_teams lt on lt.id = dp.league_team_id
    left join managers mgr on mgr.id = lt.manager_id
    left join players p on p.id = dp.player_id
    where dp.reach_delta is not null ${seasonCond}
    order by value desc
  `);
  return (rows as unknown as Record<string, unknown>[]).map((r) => ({
    who: String(r.who),
    season: Number(r.season),
    overall: Number(r.overall),
    round: Number(r.round),
    player: String(r.player),
    pos: (r.pos as string | null) ?? null,
    adp: Number(r.adp),
    value: Number(r.value),
  }));
}

export type NamedPick = {
  who: string;
  season: number;
  overall: number;
  player: string;
};

// Earliest-drafted kicker in scope (all seasons, or the filtered one) — the
// "who reached for a kicker" award. Not ADP-gated (kickers fall below the
// board); 'K' is a valid enum member so the comparison is safe. null if none.
export async function earliestKicker(
  season?: number,
): Promise<NamedPick | null> {
  const db = getDb();
  const seasonCond = season != null ? sql`and dp.season = ${season}` : sql``;
  const rows = (await db.execute(sql`
    select coalesce(mgr.display_name, lt.name) as who,
           l.season, dp.overall,
           coalesce(p.full_name, dp.player_name) as player
    from draft_picks dp
    join leagues l on l.id = dp.league_id
    join league_teams lt on lt.id = dp.league_team_id
    left join managers mgr on mgr.id = lt.manager_id
    join players p on p.id = dp.player_id
    where p.position = 'K' ${seasonCond}
    order by dp.overall asc
    limit 1
  `)) as unknown as Record<string, unknown>[];
  if (!rows.length) return null;
  const r = rows[0];
  return {
    who: String(r.who),
    season: Number(r.season),
    overall: Number(r.overall),
    player: String(r.player),
  };
}

// Pick counts by round × position (resolved picks only), for the positional
// draft profile. Not gated on ADP — position comes from the crosswalk.
export async function positionByRound(season?: number): Promise<PosCount[]> {
  const db = getDb();
  const seasonCond = season != null ? sql`where dp.season = ${season}` : sql``;
  const rows = await db.execute(sql`
    select dp.round, p.position as pos, count(*)::int as n
    from draft_picks dp
    join players p on p.id = dp.player_id
    ${seasonCond}
    group by dp.round, p.position
    order by dp.round, p.position
  `);
  return (rows as unknown as Record<string, unknown>[]).map((r) => ({
    round: Number(r.round),
    pos: String(r.pos),
    n: Number(r.n),
  }));
}

// Distinct seasons that have draft data, newest first — the year-filter options.
export async function draftSeasons(): Promise<number[]> {
  const db = getDb();
  const rows = (await db.execute(sql`
    select distinct season from draft_picks order by season desc
  `)) as unknown as Record<string, unknown>[];
  return rows.map((r) => Number(r.season));
}
