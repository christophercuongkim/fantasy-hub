"use server";

import { revalidatePath } from "next/cache";

export type RefreshState = { error?: string; ok?: boolean };

// One-click refresh: fire the api pipeline (ingest player_stats + schedules →
// project) for a week, then revalidate so the page shows the fresh numbers.
// Returns a state object — never throws — so a bad input or api error shows an
// inline message instead of 500-ing the page. Admin-only via the page gate.
export async function refreshWeek(
  _prev: RefreshState,
  formData: FormData,
): Promise<RefreshState> {
  const season = Number(formData.get("season"));
  const week = Number(formData.get("week"));
  if (
    !Number.isInteger(season) ||
    season < 2019 ||
    !Number.isInteger(week) ||
    week < 1
  ) {
    return { error: "Enter a season (2019+) and a week." };
  }

  const apiUrl = process.env.API_URL ?? "http://localhost:4001";
  try {
    const res = await fetch(`${apiUrl}/jobs/refresh-week`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ season, week }),
      cache: "no-store",
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return {
        error: `Refresh failed (HTTP ${res.status}). ${detail}`.slice(0, 240),
      };
    }
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Could not reach the api.",
    };
  }

  revalidatePath("/projections");
  return { ok: true };
}
