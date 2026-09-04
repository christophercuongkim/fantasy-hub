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
  drafted: boolean; // already picked in the live draft
  mine: boolean; // picked by my team
  status: string | null; // Yahoo injury code (Q/O/IR/…); null when healthy
  statusFull: string | null; // human label, e.g. "Questionable"
};

export type RosterPick = { player: string; pos: string };

export type DraftBoardSet = {
  leagueKey: string;
  season: number;
  rows: DraftBoardRow[];
  myRoster: RosterPick[]; // what I've drafted, in pick order
  draftedCount: number; // total picks made league-wide
  rosterSlots: Record<string, number>; // starter/bench requirements
  numTeams: number;
  myDraftPosition: number | null; // snake slot; null until Yahoo draws the order
  myPickOveralls: number[]; // overall numbers of my picks (for the pick clock)
};

// The newest league (the current predraft season) + its board, if built. Returns
// the league even when the board is empty, so the page can offer "Rebuild board".
// null only when no league exists at all.
export async function latestDraftBoard(): Promise<DraftBoardSet | null> {
  const db = getDb();
  const head = (await db.execute(sql`
    select id, season, yahoo_league_key as key, num_teams,
           roster_positions_json as slots
    from leagues order by season desc limit 1
  `)) as unknown as {
    id: string;
    season: number;
    key: string;
    num_teams: number;
    slots: Record<string, number>;
  }[];
  if (!head.length) return null;
  const { id, season, key, num_teams, slots } = head[0];

  // My draft slot (null until Yahoo draws the order) + my pick overalls.
  const meRows = (await db.execute(sql`
    select draft_position from league_teams
    where league_id = ${id} and is_mine = true limit 1
  `)) as unknown as { draft_position: number | null }[];
  const myPickRows = (await db.execute(sql`
    select dp.overall from draft_picks dp
    join league_teams lt on lt.id = dp.league_team_id
    where dp.league_id = ${id} and dp.season = ${season} and lt.is_mine = true
    order by dp.overall
  `)) as unknown as { overall: number }[];

  // Live draft state: which board players are gone, and which are mine.
  const picks = (await db.execute(sql`
    select dp.player_id, lt.is_mine
    from draft_picks dp
    join league_teams lt on lt.id = dp.league_team_id
    where dp.league_id = ${id} and dp.season = ${season}
      and dp.player_id is not null
  `)) as unknown as { player_id: string; is_mine: boolean }[];
  const draftedBy = new Map(picks.map((p) => [String(p.player_id), p.is_mine]));

  // My roster in pick order (a direct join, so it includes anyone I drafted even
  // if they're off the value board).
  const roster = (await db.execute(sql`
    select pl.full_name as player, pl.position as pos
    from draft_picks dp
    join league_teams lt on lt.id = dp.league_team_id
    join players pl on pl.id = dp.player_id
    where dp.league_id = ${id} and dp.season = ${season} and lt.is_mine = true
    order by dp.overall
  `)) as unknown as { player: string; pos: string }[];

  const rows = (await db.execute(sql`
    select db.player_id, db.overall_rank, pl.full_name as player,
           pl.position as pos, db.pos_rank, pl.team, db.season_pts::float as season_pts,
           db.vor::float as vor, db.adp::float as adp, db.tier,
           ps.status, ps.status_full
    from draft_board db
    join players pl on pl.id = db.player_id
    left join player_injury_status ps
      on ps.player_id = db.player_id and ps.season = db.season
    where db.league_id = ${id} and db.season = ${season}
    order by db.overall_rank
  `)) as unknown as Record<string, unknown>[];

  return {
    leagueKey: String(key),
    season: Number(season),
    draftedCount: picks.length,
    rosterSlots: slots ?? {},
    numTeams: Number(num_teams),
    myDraftPosition: meRows[0]?.draft_position ?? null,
    myPickOveralls: myPickRows.map((r) => Number(r.overall)),
    myRoster: roster.map((r) => ({
      player: String(r.player),
      pos: String(r.pos),
    })),
    rows: rows.map((r) => {
      const overallRank = Number(r.overall_rank);
      const adp = r.adp == null ? null : Number(r.adp);
      const pid = String(r.player_id);
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
        drafted: draftedBy.has(pid),
        mine: draftedBy.get(pid) === true,
        status: (r.status as string | null) ?? null,
        statusFull: (r.status_full as string | null) ?? null,
      };
    }),
  };
}
