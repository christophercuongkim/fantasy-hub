// Server read for the keeper tool: the newest league's persisted draft board
// (with the normalized name for CSV matching), my team's name, and team count.
// The CSV supplies cost + eligibility; this supplies the projection to value it.
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import type { BoardRow } from "@/lib/keeper";

export type KeeperContext = {
  season: number;
  numTeams: number;
  myTeam: string | null; // is_mine team name — the section we read from the CSV
  board: BoardRow[];
};

export async function keeperContext(): Promise<KeeperContext | null> {
  const db = getDb();
  const head = (await db.execute(sql`
    select id, season, num_teams from leagues order by season desc limit 1
  `)) as unknown as { id: string; season: number; num_teams: number }[];
  if (!head.length) return null;
  const { id, season, num_teams } = head[0];

  const me = (await db.execute(sql`
    select name from league_teams where league_id = ${id} and is_mine = true limit 1
  `)) as unknown as { name: string }[];

  const rows = (await db.execute(sql`
    select pl.name_normalized, pl.full_name, pl.position, db.overall_rank,
           db.pos_rank, db.vor::float as vor, db.season_pts::float as season_pts,
           db.adp::float as adp, db.tier
    from draft_board db
    join players pl on pl.id = db.player_id
    where db.league_id = ${id} and db.season = ${season}
    order by db.overall_rank
  `)) as unknown as Record<string, unknown>[];

  return {
    season: Number(season),
    numTeams: Number(num_teams),
    myTeam: me[0]?.name ?? null,
    board: rows.map((r) => ({
      nameNormalized: String(r.name_normalized),
      fullName: String(r.full_name),
      pos: String(r.position),
      overallRank: Number(r.overall_rank),
      posRank: Number(r.pos_rank),
      vor: Number(r.vor),
      seasonPts: Number(r.season_pts),
      adp: r.adp == null ? null : Number(r.adp),
      tier: Number(r.tier),
    })),
  };
}
