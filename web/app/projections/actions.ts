"use server";

export type RefreshResult = {
  started?: boolean;
  alreadyRunning?: boolean;
  error?: string;
};

export type RefreshStatus = {
  running: boolean;
  seasonsDone: number;
  weeksDone: number;
  finishedAt: string | null;
  error: string | null;
};

const apiUrl = () => process.env.API_URL ?? "http://localhost:4001";

// Kick off the backfill (ingest all seasons + project every week). The api runs
// it in the background and returns immediately; the client then polls
// refreshStatus() for progress. Never throws — a failure surfaces inline.
export async function refreshAll(): Promise<RefreshResult> {
  try {
    const res = await fetch(`${apiUrl()}/jobs/refresh-all`, {
      method: "POST",
      cache: "no-store",
    });
    if (res.status === 409) return { alreadyRunning: true };
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
    return { started: true };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Could not reach the api.",
    };
  }
}

// Progress of the running/last backfill. An unreachable api reads as "not
// running" so the client's poll loop stops gracefully.
export async function refreshStatus(): Promise<RefreshStatus> {
  try {
    const res = await fetch(`${apiUrl()}/jobs/refresh-status`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error(String(res.status));
    const s = await res.json();
    return {
      running: Boolean(s.running),
      seasonsDone: Number(s.seasons_done ?? 0),
      weeksDone: Number(s.weeks_done ?? 0),
      finishedAt: s.finished_at ?? null,
      error: s.error ?? null,
    };
  } catch {
    return {
      running: false,
      seasonsDone: 0,
      weeksDone: 0,
      finishedAt: null,
      error: null,
    };
  }
}
