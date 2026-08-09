"use client";

import { useState, useTransition } from "react";
import { Button } from "@seakim/design-system";
import { saveCookie, syncAll, syncTeams } from "./actions";

const inputStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-sm)",
  padding: "var(--space-3)",
  background: "var(--surface-inset)",
  color: "var(--text-primary)",
  border: "1px solid var(--border-subtle)",
  borderRadius: "var(--radius-none)",
};

const labelStyle: React.CSSProperties = {
  font: "var(--type-eyebrow)",
  textTransform: "uppercase",
  letterSpacing: "var(--tracking-caps)",
  color: "var(--text-tertiary)",
};

export function YahooSync() {
  const [cookie, setCookie] = useState("");
  const [leagueKey, setLeagueKey] = useState("449.l.93367");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-6)",
      }}
    >
      <label
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-2)",
        }}
      >
        <span style={labelStyle}>Yahoo cookie header</span>
        <textarea
          value={cookie}
          onChange={(e) => setCookie(e.target.value)}
          rows={4}
          placeholder="A1=…; A3=…; T=…; Y=…"
          style={{ ...inputStyle, resize: "vertical" }}
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
      </label>

      <div
        style={{
          display: "flex",
          gap: "var(--space-3)",
          alignItems: "flex-end",
        }}
      >
        <label
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-2)",
          }}
        >
          <span style={labelStyle}>League key</span>
          <input
            value={leagueKey}
            onChange={(e) => setLeagueKey(e.target.value)}
            style={inputStyle}
          />
        </label>
        <Button
          variant="secondary"
          disabled={pending || !leagueKey.trim()}
          onClick={() =>
            start(async () => {
              const r = await syncTeams(leagueKey);
              setMsg(
                r.error
                  ? `Error: ${r.error}`
                  : `Synced: ${JSON.stringify(r.result)}`,
              );
            })
          }
        >
          Sync teams
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
