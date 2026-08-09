"use client";

import { useState, useTransition } from "react";
import { Badge, Button, Card, Range, Select } from "@seakim/design-system";
import type { League, SimMatchup, SimWeek } from "@/lib/matchups";
import { simMatchup } from "./actions";

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

const f1 = (n: number) => n.toFixed(1);
const pct = (p: number) => `${Math.round(p * 100)}%`;

// A played matchup is a skip only when it carries `note`.
function isSim(
  m: SimMatchup,
): m is Extract<SimMatchup, { win_prob_a: number }> {
  return "win_prob_a" in m;
}

// Win-probability split: the favoured side is filled, the underdog muted. Only
// the hero (my matchup) spends the accent — everyone else reads in the neutral
// text hue, keeping one accent per section (DS 0015).
function WinBar({ probA, hero }: { probA: number; hero: boolean }) {
  const aLeads = probA >= 0.5;
  const strong = hero ? "var(--fill-accent)" : "var(--text-secondary)";
  const muted = "var(--border-subtle)";
  return (
    <div
      style={{
        display: "flex",
        height: "0.5rem",
        borderRadius: "var(--radius-full)",
        overflow: "hidden",
        background: muted,
      }}
      role="img"
      aria-label={`Win probability ${pct(probA)} to ${pct(1 - probA)}`}
    >
      <div style={{ width: pct(probA), background: aLeads ? strong : muted }} />
      <div
        style={{ width: pct(1 - probA), background: aLeads ? muted : strong }}
      />
    </div>
  );
}

function TeamSide({
  name,
  prob,
  totals,
  starters,
  domain,
  align,
}: {
  name: string;
  prob: number;
  totals: { p10: number; median: number; p90: number };
  starters: number;
  domain: [number, number];
  align: "left" | "right";
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
        alignItems: align === "right" ? "flex-end" : "flex-start",
        textAlign: align,
      }}
    >
      <span
        style={{
          font: "var(--type-body)",
          color: "var(--text-primary)",
          fontWeight: 600,
        }}
      >
        {name}
      </span>
      <span
        style={{ font: "var(--type-body-sm)", color: "var(--text-secondary)" }}
      >
        {pct(prob)} · {f1(totals.median)} proj
      </span>
      <Range
        low={totals.p10}
        mid={totals.median}
        high={totals.p90}
        domain={domain}
        size="sm"
        label={`${name}: floor ${f1(totals.p10)}, projected ${f1(
          totals.median,
        )}, ceiling ${f1(totals.p90)}`}
      />
      <span style={labelStyle}>{starters} starters</span>
    </div>
  );
}

function MatchupCard({ m }: { m: SimMatchup }) {
  if (!isSim(m)) {
    return (
      <Card eyebrow="No projection" title={`${m.team_a} vs ${m.team_b}`}>
        <span
          style={{ font: "var(--type-body-sm)", color: "var(--text-tertiary)" }}
        >
          {m.note}
        </span>
      </Card>
    );
  }

  const hero = m.is_mine;
  const domain: [number, number] = [
    0,
    Math.max(m.totals_a.p90, m.totals_b.p90) || 1,
  ];

  // Did the favourite win? Only meaningful once the week's been played.
  const played = m.actual_a != null && m.actual_b != null;
  let footer: React.ReactNode = null;
  if (played) {
    const favA = m.win_prob_a >= 0.5;
    const actualAWon = (m.actual_a as number) > (m.actual_b as number);
    const tie = m.actual_a === m.actual_b;
    const called = !tie && favA === actualAWon;
    footer = (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--space-3)",
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            font: "var(--type-body-sm)",
            fontFamily: "var(--font-mono)",
            color: "var(--text-secondary)",
          }}
        >
          Final {f1(m.actual_a as number)} – {f1(m.actual_b as number)}
        </span>
        {tie ? (
          <Badge tone="neutral">Tie</Badge>
        ) : (
          <Badge tone={called ? "success" : "warning"} variant="subtle">
            {called ? "Model called it" : "Upset"}
          </Badge>
        )}
      </div>
    );
  }

  return (
    <Card
      eyebrow={hero ? "Your matchup" : undefined}
      footer={footer}
      style={hero ? { borderColor: "var(--border-accent)" } : undefined}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-4)",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "var(--space-5)",
          }}
        >
          <TeamSide
            name={m.team_a}
            prob={m.win_prob_a}
            totals={m.totals_a}
            starters={m.starters_a}
            domain={domain}
            align="left"
          />
          <TeamSide
            name={m.team_b}
            prob={1 - m.win_prob_a}
            totals={m.totals_b}
            starters={m.starters_b}
            domain={domain}
            align="right"
          />
        </div>
        <WinBar probA={m.win_prob_a} hero={hero} />
        <p
          style={{
            font: "var(--type-body-sm)",
            fontFamily: "var(--font-mono)",
            color: "var(--text-tertiary)",
            textAlign: "center",
          }}
        >
          Margin {m.margin.p50 >= 0 ? "+" : ""}
          {f1(m.margin.p50)} ({m.team_a}) · range {f1(m.margin.p10)} to{" "}
          {f1(m.margin.p90)}
        </p>
      </div>
    </Card>
  );
}

export function MatchupBoard({
  leagues,
  initialKey,
  initialWeek,
  initialResult,
  initialError,
}: {
  leagues: League[];
  initialKey: string;
  initialWeek: number;
  initialResult?: SimWeek;
  initialError?: string;
}) {
  const [leagueKey, setLeagueKey] = useState(initialKey);
  const [week, setWeek] = useState(String(initialWeek));
  const [result, setResult] = useState<SimWeek | undefined>(initialResult);
  const [error, setError] = useState<string | undefined>(initialError);
  const [pending, start] = useTransition();

  const run = () =>
    start(async () => {
      const r = await simMatchup(leagueKey, Number(week));
      setResult(r.result);
      setError(r.error);
    });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-6)",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: "var(--space-3)",
          alignItems: "flex-end",
          flexWrap: "wrap",
        }}
      >
        <label
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-2)",
            minWidth: "7rem",
          }}
        >
          <span style={labelStyle}>Season</span>
          <Select
            value={leagueKey}
            options={leagues.map((l) => ({
              value: l.key,
              label: String(l.season),
            }))}
            aria-label="Season"
            onChange={(e) => setLeagueKey(e.target.value)}
          />
        </label>
        <label
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-2)",
            maxWidth: "5rem",
          }}
        >
          <span style={labelStyle}>Week</span>
          <input
            value={week}
            onChange={(e) => setWeek(e.target.value)}
            inputMode="numeric"
            style={inputStyle}
          />
        </label>
        <Button
          disabled={pending || !leagueKey.trim() || !week.trim()}
          onClick={run}
        >
          {pending ? "Simulating…" : "Simulate"}
        </Button>
      </div>

      {error && (
        <p
          style={{
            font: "var(--type-body-sm)",
            fontFamily: "var(--font-mono)",
            color: "var(--text-danger)",
          }}
        >
          {error}
        </p>
      )}

      {result && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-4)",
          }}
        >
          <span style={labelStyle}>
            {result.season} · Week {result.week} · {result.matchups.length}{" "}
            matchups
          </span>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(20rem, 1fr))",
              gap: "var(--space-4)",
            }}
          >
            {result.matchups.map((m, i) => (
              <MatchupCard key={`${m.team_a}-${m.team_b}-${i}`} m={m} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
