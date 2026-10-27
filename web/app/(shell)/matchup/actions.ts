"use server";

// Server action wrapper so the client board can re-run the sim on selector
// change. Thin — the fetch + typing live in lib/matchups.
import { simMatchupWeek, type SimWeek } from "@/lib/matchups";

export async function simMatchup(
  leagueKey: string,
  week: number,
): Promise<{ result?: SimWeek; error?: string }> {
  return simMatchupWeek(leagueKey, week);
}
