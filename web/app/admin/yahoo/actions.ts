"use server";

// Admin actions for Yahoo league sync. Both proxy to the api (internal-only, so
// the browser can't reach it directly). Never throw — failures surface inline.

const apiUrl = () => process.env.API_URL ?? "http://localhost:4001";

export async function saveCookie(
  cookie: string,
): Promise<{ ok?: boolean; error?: string }> {
  try {
    const res = await fetch(`${apiUrl()}/yahoo/cookies`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cookie }),
      cache: "no-store",
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 200);
      return { error: `HTTP ${res.status}. ${detail}` };
    }
    return { ok: true };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Could not reach the api.",
    };
  }
}

export async function syncTeams(
  leagueKey: string,
): Promise<{ result?: Record<string, unknown>; error?: string }> {
  try {
    const res = await fetch(`${apiUrl()}/jobs/sync-teams`, {
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

// Create-or-update a league from its Yahoo settings (scoring + roster) + teams.
export async function syncLeague(
  leagueKey: string,
): Promise<{ result?: Record<string, unknown>; error?: string }> {
  try {
    const res = await fetch(`${apiUrl()}/jobs/sync-league`, {
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

// Every team's roster for a week → the rosters table.
export async function syncRosters(
  leagueKey: string,
  week: number,
): Promise<{ result?: Record<string, unknown>; error?: string }> {
  try {
    const res = await fetch(`${apiUrl()}/jobs/sync-rosters`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ league_key: leagueKey, week }),
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

// All of a league's adds/drops/trades → the transactions table.
export async function syncTransactions(
  leagueKey: string,
): Promise<{ result?: Record<string, unknown>; error?: string }> {
  try {
    const res = await fetch(`${apiUrl()}/jobs/sync-transactions`, {
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

// A week's matchups + scores → the matchups table.
export async function syncMatchups(
  leagueKey: string,
  week: number,
): Promise<{ result?: Record<string, unknown>; error?: string }> {
  try {
    const res = await fetch(`${apiUrl()}/jobs/sync-matchups`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ league_key: leagueKey, week }),
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

// Enumerate the connected user's own leagues and create rows for any we don't
// have yet. OAuth-only (uses the stored token's use_login scope).
export async function discoverLeagues(
  gameKeys = "nfl",
): Promise<{ result?: Record<string, unknown>; error?: string }> {
  try {
    const res = await fetch(`${apiUrl()}/jobs/discover-leagues`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ game_keys: gameKeys }),
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

// Sync every league we hold a Yahoo key for — one cookie, all seasons.
export async function syncAll(): Promise<{
  result?: Record<string, unknown>;
  error?: string;
}> {
  try {
    const res = await fetch(`${apiUrl()}/jobs/sync-all-teams`, {
      method: "POST",
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
