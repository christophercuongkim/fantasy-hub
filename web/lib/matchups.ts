// Matchup-sim reads for the app. The Monte Carlo lives in the api (Layer 4); the
// web side just picks a league-week, POSTs it, and renders. Season/scores are
// resolved api-side from the league_key, so the browser only ever holds a key.
import { sql } from "drizzle-orm";
import { getDb } from "@/db";

const apiUrl = () => process.env.API_URL ?? "http://localhost:4001";

export type SimTotals = { p10: number; median: number; p90: number };
export type SimMargin = { p10: number; p50: number; p90: number };

// A simulated pairing — or a skip (`note`) when a side has no projectable lineup
// (pre-draft week, or every starter fell out of the projections join).
export type SimMatchup =
  | { team_a: string; team_b: string; note: string }
  | {
      team_a: string;
      team_b: string;
      is_mine: boolean;
      starters_a: number;
      starters_b: number;
      win_prob_a: number;
      totals_a: SimTotals;
      totals_b: SimTotals;
      margin: SimMargin;
      actual_a: number | null;
      actual_b: number | null;
    };

export type SimWeek = {
  league_key: string;
  season: number;
  week: number;
  matchups: SimMatchup[];
};

export type League = { season: number; key: string };

// Run the sim for a league-week via the api. Never throws — errors surface inline.
export async function simMatchupWeek(
  leagueKey: string,
  week: number,
): Promise<{ result?: SimWeek; error?: string }> {
  try {
    const res = await fetch(`${apiUrl()}/jobs/sim-matchup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ league_key: leagueKey, week }),
      cache: "no-store",
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok)
      return {
        error: String(
          (body as { error?: string }).error ?? `HTTP ${res.status}`,
        ),
      };
    return { result: body as SimWeek };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Could not reach the api.",
    };
  }
}

// Every league we hold, newest first — for the season dropdown.
export async function matchupLeagues(): Promise<League[]> {
  const rows = (await getDb().execute(sql`
    select season, yahoo_league_key as key from leagues order by season desc
  `)) as unknown as { season: number; key: string }[];
  return rows.map((r) => ({ season: Number(r.season), key: String(r.key) }));
}

// Best default to land on: the newest league-week that has BOTH a matchup and
// rosters (so the sim has something to chew on). null when nothing qualifies yet
// — e.g. the 2026 league exists but its draft hasn't happened.
export async function defaultMatchupWeek(): Promise<{
  key: string;
  season: number;
  week: number;
} | null> {
  const rows = (await getDb().execute(sql`
    select l.yahoo_league_key as key, l.season, max(m.week) as week
    from matchups m
    join leagues l on l.id = m.league_id
    where exists (
      select 1 from rosters r
      join league_teams lt on lt.id = r.league_team_id
      where lt.league_id = l.id and r.week = m.week
    )
    group by l.yahoo_league_key, l.season
    order by l.season desc
    limit 1
  `)) as unknown as { key: string; season: number; week: number }[];
  if (!rows.length) return null;
  return {
    key: String(rows[0].key),
    season: Number(rows[0].season),
    week: Number(rows[0].week),
  };
}
