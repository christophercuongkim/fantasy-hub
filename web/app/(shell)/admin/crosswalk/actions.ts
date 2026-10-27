"use server";

import { ilike, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { players as playersTable } from "@/db/schema";

export type PlayerHit = {
  id: string;
  full_name: string;
  position: string;
  team: string | null;
  draft_year: number | null;
};

// Free-text player search for the manual assign box (when suggestions are wrong
// or absent). Matches on full name.
export async function searchPlayers(q: string): Promise<PlayerHit[]> {
  const query = q.trim();
  if (query.length < 2) return [];
  const db = getDb();
  return db
    .select({
      id: playersTable.id,
      full_name: playersTable.fullName,
      position: playersTable.position,
      team: playersTable.team,
      draft_year: playersTable.draftYear,
    })
    .from(playersTable)
    .where(ilike(playersTable.fullName, `%${query}%`))
    .limit(8);
}

// Confirm a candidate: link every draft pick with this name to the player and
// mark the crosswalk entry human-verified (method=manual, preserved on re-runs).
export async function confirmMatch(sourceId: string, playerId: string) {
  const db = getDb();
  await db.execute(sql`
    update draft_picks set player_id = ${playerId}
    where player_name = ${sourceId} and player_id is null
  `);
  await db.execute(sql`
    update id_crosswalk_log set player_id = ${playerId}, method = 'manual',
        verified_at = now()
    where source = 'yahoo' and source_id = ${sourceId} and verified_at is null
  `);
  revalidatePath("/admin/crosswalk");
}

// Fire the api crosswalk job (rebuild players + re-resolve) and refresh the page.
export async function runCrosswalk() {
  const apiUrl = process.env.API_URL ?? "http://localhost:4001";
  const res = await fetch(`${apiUrl}/jobs/crosswalk`, {
    method: "POST",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`crosswalk job failed (HTTP ${res.status})`);
  revalidatePath("/admin/crosswalk");
}

// Dismiss: mark reviewed with no player (e.g. a DST or a player not in nflverse).
export async function dismiss(sourceId: string) {
  const db = getDb();
  await db.execute(sql`
    update id_crosswalk_log set method = 'manual', verified_at = now()
    where source = 'yahoo' and source_id = ${sourceId} and verified_at is null
  `);
  revalidatePath("/admin/crosswalk");
}
