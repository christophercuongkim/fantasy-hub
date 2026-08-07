"use server";

import { revalidatePath } from "next/cache";

// One-click refresh: fire the api pipeline (ingest player_stats + schedules →
// project) for a week, then revalidate so the page shows the fresh numbers.
// Admin-only by virtue of the page being admin-gated (middleware).
export async function refreshWeek(formData: FormData) {
  const season = Number(formData.get("season"));
  const week = Number(formData.get("week"));
  if (!Number.isInteger(season) || !Number.isInteger(week) || week < 1) {
    throw new Error("Season and week are required.");
  }

  const apiUrl = process.env.API_URL ?? "http://localhost:4001";
  const res = await fetch(`${apiUrl}/jobs/refresh-week`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ season, week }),
    cache: "no-store",
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Refresh failed (HTTP ${res.status}). ${detail}`);
  }
  revalidatePath("/projections");
}
