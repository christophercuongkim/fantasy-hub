"use client";

import { useState, useTransition } from "react";
import { Button, Field, Input, Select, Textarea } from "@seakim/design-system";
import {
  discoverLeagues,
  saveCookie,
  syncAll,
  syncLeague,
  syncMatchups,
  syncPlayerStatus,
  syncRosters,
  syncTeams,
  syncTransactions,
} from "./actions";

type League = { season: number; key: string };

export function YahooSync({ leagues }: { leagues: League[] }) {
  const [cookie, setCookie] = useState("");
  const [leagueKey, setLeagueKey] = useState(leagues[0]?.key ?? "");
  const [week, setWeek] = useState("1");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // The selected season, for result messages — so "wk 1" isn't ambiguous.
  const season = leagues.find((l) => l.key === leagueKey)?.season ?? "?";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-6)",
      }}
    >
      <Field label="Yahoo cookie header">
        <Textarea
          value={cookie}
          onChange={(e) => setCookie(e.target.value)}
          rows={4}
          placeholder="A1=…; A3=…; T=…; Y=…"
          aria-label="Yahoo cookie header"
          style={{ fontFamily: "var(--font-mono)" }}
        />
        <Button
          size="sm"
          disabled={pending || !cookie.trim()}
          onClick={() =>
            start(async () => {
              const r = await saveCookie(cookie);
              setMsg(r.ok ? "Cookie stored." : `Error: ${r.error}`);
              if (r.ok) setCookie("");
            })
          }
        >
          Save cookie
        </Button>
      </Field>

      <div
        style={{
          display: "flex",
          gap: "var(--space-3)",
          alignItems: "flex-end",
          flexWrap: "wrap",
        }}
      >
        <Field label="Season" style={{ minWidth: "7rem" }}>
          <Select
            value={leagueKey}
            options={leagues.map((l) => ({
              value: l.key,
              label: String(l.season),
            }))}
            aria-label="Season"
            onChange={(e) => setLeagueKey(e.target.value)}
          />
        </Field>
        <Button
          variant="secondary"
          disabled={pending || !leagueKey.trim()}
          onClick={() =>
            start(async () => {
              const r = await syncTeams(leagueKey);
              setMsg(
                r.error
                  ? `Error: ${r.error}`
                  : `Teams ${season}: ${r.result?.teams_written} written, ${r.result?.managers_linked} linked`,
              );
            })
          }
        >
          Sync teams
        </Button>
        <Button
          variant="secondary"
          disabled={pending || !leagueKey.trim()}
          onClick={() =>
            start(async () => {
              const r = await syncLeague(leagueKey);
              setMsg(
                r.error
                  ? `Error: ${r.error}`
                  : `Created/updated ${r.result?.league_key} (${r.result?.season})`,
              );
            })
          }
        >
          Sync league (settings + teams)
        </Button>
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await discoverLeagues();
              const created = Array.isArray(r.result?.created)
                ? r.result.created.length
                : 0;
              const discovered = Array.isArray(r.result?.discovered)
                ? r.result.discovered.length
                : 0;
              const existing = Array.isArray(r.result?.existing)
                ? r.result.existing.length
                : 0;
              setMsg(
                r.error
                  ? `Error: ${r.error}`
                  : `Discovered ${discovered} league(s): ${created} new, ${existing} existing`,
              );
            })
          }
        >
          Discover my leagues
        </Button>
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await syncAll();
              setMsg(
                r.error
                  ? `Error: ${r.error}`
                  : `Synced ${r.result?.synced}/${r.result?.leagues} leagues`,
              );
            })
          }
        >
          Sync all seasons
        </Button>
        <Button
          variant="secondary"
          disabled={pending || !leagueKey.trim()}
          onClick={() =>
            start(async () => {
              const r = await syncTransactions(leagueKey);
              setMsg(
                r.error
                  ? `Error: ${r.error}`
                  : `Transactions ${season}: ${r.result?.written} movements from ${r.result?.transactions} txns`,
              );
            })
          }
        >
          Sync transactions
        </Button>
        <Button
          variant="secondary"
          disabled={pending || !leagueKey.trim()}
          onClick={() =>
            start(async () => {
              const r = await syncPlayerStatus(leagueKey);
              setMsg(
                r.error
                  ? `Error: ${r.error}`
                  : `Injury status ${season}: ${r.result?.written} flagged of ${r.result?.injured} injured (${r.result?.unmatched} unmatched)`,
              );
            })
          }
        >
          Sync injury status
        </Button>
      </div>

      <div
        style={{
          display: "flex",
          gap: "var(--space-3)",
          alignItems: "flex-end",
          flexWrap: "wrap",
        }}
      >
        <Field label="Week" style={{ maxWidth: "5rem" }}>
          <Input
            value={week}
            onChange={(e) => setWeek(e.target.value)}
            inputMode="numeric"
            mono
            fullWidth
            aria-label="Week"
          />
        </Field>
        <Button
          variant="secondary"
          disabled={pending || !leagueKey.trim() || !week.trim()}
          onClick={() =>
            start(async () => {
              const r = await syncRosters(leagueKey, Number(week));
              const unresolved = Array.isArray(r.result?.unresolved)
                ? r.result.unresolved.length
                : 0;
              setMsg(
                r.error
                  ? `Error: ${r.error}`
                  : `Rosters ${season} · wk ${r.result?.week}: ${r.result?.written} players across ${r.result?.teams} teams (+${r.result?.matched_by_name} by name, ${unresolved} unresolved)`,
              );
            })
          }
        >
          Sync rosters
        </Button>
        <Button
          variant="secondary"
          disabled={pending || !leagueKey.trim() || !week.trim()}
          onClick={() =>
            start(async () => {
              const r = await syncMatchups(leagueKey, Number(week));
              setMsg(
                r.error
                  ? `Error: ${r.error}`
                  : `Matchups ${season} · wk ${r.result?.week}: ${r.result?.written} written`,
              );
            })
          }
        >
          Sync matchups
        </Button>
      </div>

      {msg && (
        <p
          style={{
            font: "var(--type-body-sm)",
            fontFamily: "var(--font-mono)",
            color: "var(--text-secondary)",
          }}
        >
          {msg}
        </p>
      )}
    </div>
  );
}
