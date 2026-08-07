"use server";

export type RefreshState = { started?: boolean; error?: string };

// One-click, fire-and-forget: kick off the api backfill (ingest every season +
// project every week) and return immediately. The api runs it in the background
// (minutes), so there's no live progress — reload later to see the fresh data.
// Returns a state object (never throws) so a failure shows inline, not a 500.
export async function refreshAll(): Promise<RefreshState> {
  const apiUrl = process.env.API_URL ?? "http://localhost:4001";
  try {
    const res = await fetch(`${apiUrl}/jobs/refresh-all`, {
      method: "POST",
      cache: "no-store",
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return {
        error:
          `Couldn't start the refresh (HTTP ${res.status}). ${detail}`.slice(
            0,
            240,
          ),
      };
    }
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Could not reach the api.",
    };
  }
  return { started: true };
}
