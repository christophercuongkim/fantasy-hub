// Superlatives queries for the league hall of records. Raw SQL (via drizzle's
// sql``) — the aggregations are gnarlier than the query builder earns.
//
// Scope note: cross-season *person* stats use manager_id (only 2022+ seasons are
// GUID-attributed). All-time single-record stats span every season, labelled by
// team name for the unclaimed (pre-2022) era.
import { sql } from "drizzle-orm";
import { getDb } from "@/db";

export type CareerRow = {
  manager: string;
  seasons: number;
  titles: number;
  sackos: number;
  playoffs: number;
  wins: number;
  losses: number;
  ties: number;
  winPct: number;
  pointsFor: number;
};

export type SeasonRow = {
  season: number;
  team: string;
  manager: string | null;
  finalRank: number;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
};

export type WeekScore = {
  season: number;
  week: number;
  team: string;
  score: number;
  oppScore: number;
  margin: number;
  won: boolean;
};

export type ManagerSeason = {
  manager: string;
  season: number;
  finalRank: number;
};
export type H2HCell = { a: string; b: string; wins: number; games: number };
export type ScatterPoint = {
  label: string;
  manager: string | null;
  season: number;
  pointsFor: number;
  wins: number;
};

// Per-team-per-week long form (both sides of every matchup), with a display
// label (manager if known, else team name) — the backbone for record queries.
const WEEK_SCORES = sql`
  select l.season, m.week, m.is_playoff,
         coalesce(nullif(mgr.display_name, '--hidden--'), lt.name) as team,
         side.score::float as score, side.opp::float as opp
  from matchups m
  join leagues l on l.id = m.league_id
  cross join lateral (values
    (m.team_a_id, m.team_a_score, m.team_b_score),
    (m.team_b_id, m.team_b_score, m.team_a_score)
  ) as side(team_id, score, opp)
  join league_teams lt on lt.id = side.team_id
  left join managers mgr on mgr.id = lt.manager_id
  where side.score is not null
`;

export async function careerLeaderboard(): Promise<CareerRow[]> {
  const db = getDb();
  const rows = await db.execute(sql`
    select mgr.display_name as manager,
           count(*) as seasons,
           count(*) filter (where lt.final_rank = 1) as titles,
           count(*) filter (where lt.final_rank = l.num_teams) as sackos,
           count(*) filter (where lt.final_rank <= l.num_playoff_teams) as playoffs,
           coalesce(sum(lt.wins), 0) as wins,
           coalesce(sum(lt.losses), 0) as losses,
           coalesce(sum(lt.ties), 0) as ties,
           coalesce(sum(lt.points_for), 0)::float as points_for
    from league_teams lt
    join managers mgr on mgr.id = lt.manager_id
    join leagues l on l.id = lt.league_id
    group by mgr.display_name
    order by titles desc, wins desc
  `);
  return (rows as unknown as Record<string, string>[]).map((r) => {
    const wins = Number(r.wins),
      losses = Number(r.losses),
      ties = Number(r.ties);
    const gp = wins + losses + ties;
    return {
      manager: r.manager,
      seasons: Number(r.seasons),
      titles: Number(r.titles),
      sackos: Number(r.sackos),
      playoffs: Number(r.playoffs),
      wins,
      losses,
      ties,
      winPct: gp ? (wins + ties / 2) / gp : 0,
      pointsFor: Number(r.points_for),
    };
  });
}

// Every team-season (all 12 years) for season-record awards + the scatter.
export async function teamSeasons(): Promise<SeasonRow[]> {
  const db = getDb();
  const rows = await db.execute(sql`
    select l.season, lt.name as team, mgr.display_name as manager,
           lt.final_rank, lt.wins, lt.losses, lt.ties, lt.points_for::float as pf
    from league_teams lt
    join leagues l on l.id = lt.league_id
    left join managers mgr on mgr.id = lt.manager_id
    where lt.wins is not null
    order by l.season
  `);
  return (rows as unknown as Record<string, string>[]).map((r) => ({
    season: Number(r.season),
    team: r.team,
    manager: r.manager ?? null,
    finalRank: Number(r.final_rank),
    wins: Number(r.wins),
    losses: Number(r.losses),
    ties: Number(r.ties),
    pointsFor: Number(r.pf),
  }));
}

export async function weekScores(): Promise<WeekScore[]> {
  const db = getDb();
  const rows = await db.execute(sql`
    select season, week, team, score, opp from (${WEEK_SCORES}) w order by score desc
  `);
  return (rows as unknown as Record<string, string>[]).map((r) => {
    const score = Number(r.score),
      opp = Number(r.opp);
    return {
      season: Number(r.season),
      week: Number(r.week),
      team: r.team,
      score,
      oppScore: opp,
      margin: score - opp,
      won: score > opp,
    };
  });
}

// final_rank per manager per season → bump chart + finish heatmap.
export async function managerSeasons(): Promise<ManagerSeason[]> {
  const db = getDb();
  const rows = await db.execute(sql`
    select mgr.display_name as manager, l.season, lt.final_rank
    from league_teams lt
    join managers mgr on mgr.id = lt.manager_id
    join leagues l on l.id = lt.league_id
    where lt.final_rank is not null
    order by l.season, lt.final_rank
  `);
  return (rows as unknown as Record<string, string>[]).map((r) => ({
    manager: r.manager,
    season: Number(r.season),
    finalRank: Number(r.final_rank),
  }));
}

// Head-to-head wins between managers (regular season, GUID era).
export async function headToHead(): Promise<H2HCell[]> {
  const db = getDb();
  const rows = await db.execute(sql`
    with games as (
      select ma.display_name as a, mb.display_name as b,
             (m.team_a_score > m.team_b_score) as a_won
      from matchups m
      join league_teams la on la.id = m.team_a_id
      join league_teams lb on lb.id = m.team_b_id
      join managers ma on ma.id = la.manager_id
      join managers mb on mb.id = lb.manager_id
      where not m.is_playoff and m.team_a_score is not null
    ),
    dir as (
      select a, b, count(*) filter (where a_won) as wins, count(*) as games from games group by a, b
      union all
      select b, a, count(*) filter (where not a_won) as wins, count(*) as games from games group by b, a
    )
    select a, b, sum(wins) as wins, sum(games) as games from dir group by a, b
  `);
  return (rows as unknown as Record<string, string>[]).map((r) => ({
    a: r.a,
    b: r.b,
    wins: Number(r.wins),
    games: Number(r.games),
  }));
}

export async function scatterPoints(): Promise<ScatterPoint[]> {
  const rows = await teamSeasons();
  return rows.map((r) => ({
    label: r.manager ?? r.team,
    manager: r.manager,
    season: r.season,
    pointsFor: r.pointsFor,
    wins: r.wins,
  }));
}
