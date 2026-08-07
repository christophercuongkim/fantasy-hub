// Weekly projection reads for the app. Raw SQL via drizzle's sql``, joining the
// hot-tier `projections` table (written by the api project job) to `players`.
// One league today, so no league filter yet; add one when a second league lands.
import { sql } from "drizzle-orm";
import { getDb } from "@/db";

export type ProjectionRow = {
  player: string;
  pos: string;
  team: string | null;
  mean: number;
  isPlaying: boolean;
};

export type ProjectionSet = {
  season: number;
  week: number;
  rows: ProjectionRow[];
};

// The most recently projected (season, week), players ordered by projected mean.
// null when nothing has been projected yet.
export async function latestProjections(): Promise<ProjectionSet | null> {
  const db = getDb();
  const head = (await db.execute(sql`
    select season, week from projections
    where week <= 18
    order by season desc, week desc limit 1
  `)) as unknown as { season: number; week: number }[];
  if (!head.length) return null;
  const season = Number(head[0].season);
  const week = Number(head[0].week);

  const rows = (await db.execute(sql`
    select pl.full_name as player, pl.position as pos, pl.team,
           p.mean::float as mean, p.is_playing as is_playing
    from projections p
    join players pl on pl.id = p.player_id
    where p.season = ${season} and p.week = ${week}
    order by p.mean desc
  `)) as unknown as Record<string, unknown>[];

  return {
    season,
    week,
    rows: rows.map((r) => ({
      player: String(r.player),
      pos: String(r.pos),
      team: (r.team as string | null) ?? null,
      mean: Number(r.mean),
      isPlaying: Boolean(r.is_playing),
    })),
  };
}
