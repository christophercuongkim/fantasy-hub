// Draft value-board reads for the assistant. The board is computed by the api's
// build-draft-board job into draft_board (VOR from projections + the draft-prior
// curve, with market ADP); this joins it to players for display.
import { sql } from "drizzle-orm";
import { getDb } from "@/db";

export type DraftBoardRow = {
  overallRank: number;
  player: string;
  pos: string;
  posRank: number;
  team: string | null;
  seasonPts: number;
  vor: number;
  adp: number | null;
  tier: number;
  // ADP − our overall rank: positive = we rate the player higher than the market
  // (a value/sleeper), negative = the market is higher (a reach). null if no ADP.
  value: number | null;
};

export type DraftBoardSet = {
  leagueKey: string;
  season: number;
  rows: DraftBoardRow[];
};

// The newest league (the current predraft season) + its board, if built. Returns
// the league even when the board is empty, so the page can offer "Rebuild board".
// null only when no league exists at all.
export async function latestDraftBoard(): Promise<DraftBoardSet | null> {
  const db = getDb();
  const head = (await db.execute(sql`
    select id, season, yahoo_league_key as key
    from leagues order by season desc limit 1
  `)) as unknown as { id: string; season: number; key: string }[];
  if (!head.length) return null;
  const { id, season, key } = head[0];

  const rows = (await db.execute(sql`
    select db.overall_rank, pl.full_name as player, pl.position as pos,
           db.pos_rank, pl.team, db.season_pts::float as season_pts,
           db.vor::float as vor, db.adp::float as adp, db.tier
    from draft_board db
    join players pl on pl.id = db.player_id
    where db.league_id = ${id} and db.season = ${season}
    order by db.overall_rank
  `)) as unknown as Record<string, unknown>[];

  return {
    leagueKey: String(key),
    season: Number(season),
    rows: rows.map((r) => {
      const overallRank = Number(r.overall_rank);
      const adp = r.adp == null ? null : Number(r.adp);
      return {
        overallRank,
        player: String(r.player),
        pos: String(r.pos),
        posRank: Number(r.pos_rank),
        team: (r.team as string | null) ?? null,
        seasonPts: Number(r.season_pts),
        vor: Number(r.vor),
        adp,
        tier: Number(r.tier),
        value: adp == null ? null : Math.round((adp - overallRank) * 10) / 10,
      };
    }),
  };
}
