"use server";

// Rebuild the draft value board via the api (re-fetches ADP + recomputes VOR).
// Synchronous (a few seconds). Never throws — failures surface inline.
const apiUrl = () => process.env.API_URL ?? "http://localhost:4001";

export async function rebuildBoard(
  leagueKey: string,
): Promise<{ result?: Record<string, unknown>; error?: string }> {
  return post("build-draft-board", leagueKey);
}

// Poll Yahoo draft-results into draft_picks — called on a timer during the draft.
export async function syncDraft(
  leagueKey: string,
): Promise<{ result?: Record<string, unknown>; error?: string }> {
  return post("sync-draft", leagueKey);
}

async function post(
  job: string,
  leagueKey: string,
): Promise<{ result?: Record<string, unknown>; error?: string }> {
  try {
    const res = await fetch(`${apiUrl()}/jobs/${job}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ league_key: leagueKey }),
      cache: "no-store",
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { error: String(body.error ?? `HTTP ${res.status}`) };
    return { result: body };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Could not reach the api.",
    };
  }
}
