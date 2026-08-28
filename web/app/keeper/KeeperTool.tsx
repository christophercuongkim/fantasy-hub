"use client";

import { type RefObject, useMemo, useRef, useState } from "react";
import {
  Badge,
  Button,
  Table,
  useMeasuredBreakpoint,
} from "@seakim/design-system";
import {
  analyzeKeepers,
  bestKeeper,
  type BoardRow,
  type KeeperAnalysis,
  parseKeeperCsv,
  type Verdict,
} from "@/lib/keeper";

const signed = (n: number) => (n > 0 ? "+" : "") + n.toFixed(0);
const signed1 = (n: number) => (n > 0 ? "+" : "") + n.toFixed(1);

const VERDICT: Record<
  Verdict,
  { label: string; tone: "success" | "accent" | "neutral" | "warning" }
> = {
  "strong-keep": { label: "keep", tone: "success" },
  value: { label: "value", tone: "accent" },
  reach: { label: "reach", tone: "neutral" },
  ineligible: { label: "ineligible", tone: "neutral" },
  "no-projection": { label: "no proj", tone: "warning" },
};

// Eligible + scored first (best model surplus on top), then unscored/ineligible.
function ordered(rows: KeeperAnalysis[]): KeeperAnalysis[] {
  return [...rows].sort((a, b) => {
    const av = a.vorSurplus,
      bv = b.vorSurplus;
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    return bv - av;
  });
}

export function KeeperTool({
  season,
  numTeams,
  myTeam,
  board,
}: {
  season: number;
  numTeams: number;
  myTeam: string | null;
  board: BoardRow[];
}) {
  const { ref, bp } = useMeasuredBreakpoint();
  const fileRef = useRef<HTMLInputElement>(null);
  const [csvText, setCsvText] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analysis = useMemo(() => {
    if (!csvText || !myTeam) return null;
    const csv = parseKeeperCsv(csvText, myTeam);
    if (!csv.length) return { rows: [] as KeeperAnalysis[], best: null };
    const rows = analyzeKeepers(csv, board, numTeams);
    return { rows: ordered(rows), best: bestKeeper(rows) };
  }, [csvText, myTeam, board, numTeams]);

  const onFile = (file: File) => {
    setError(null);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setCsvText(String(reader.result ?? ""));
    reader.onerror = () => setError("Couldn’t read that file.");
    reader.readAsText(file);
  };

  const recommended = analysis?.best
    ? analysis.rows.find((r) => r.rawName === analysis.best)
    : null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-4)",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: "var(--space-3)",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />
        <Button
          variant="secondary"
          size="sm"
          iconLeft="upload-simple"
          onClick={() => fileRef.current?.click()}
        >
          {fileName ? "Replace CSV" : "Upload keeper CSV"}
        </Button>
        {fileName && (
          <span
            style={{
              font: "var(--type-caption)",
              color: "var(--text-tertiary)",
            }}
          >
            {fileName}
          </span>
        )}
        {error && (
          <span
            style={{ font: "var(--type-caption)", color: "var(--text-danger)" }}
          >
            {error}
          </span>
        )}
      </div>

      {analysis && analysis.rows.length === 0 && (
        <p
          style={{
            font: "var(--type-body-sm)",
            color: "var(--text-secondary)",
          }}
        >
          No rows found for <strong>{myTeam}</strong> in that sheet — check the
          team name matches a section header.
        </p>
      )}

      {recommended && <Recommendation r={recommended} />}

      {analysis && analysis.rows.length > 0 && (
        <div ref={ref as RefObject<HTMLDivElement | null>}>
          <Table<KeeperAnalysis>
            bp={bp}
            rowKey={(r) => r.rawName}
            caption={`${season} keeper value for ${myTeam} — surplus over the pick each keeper costs`}
            columns={[
              { key: "name", label: "Player", secondary: true },
              {
                key: "pos",
                label: "Pos",
                render: (r) =>
                  r.posRank && r.pos ? `${r.pos}${r.posRank}` : (r.pos ?? "—"),
              },
              {
                key: "cost",
                label: "Cost",
                numeric: true,
                identifying: true,
                render: (r) => (r.cost == null ? "—" : `R${r.cost}`),
              },
              {
                key: "seasonPts",
                label: "Proj",
                numeric: true,
                priority: 3,
                render: (r) =>
                  r.seasonPts == null ? "—" : r.seasonPts.toFixed(0),
              },
              {
                // Model surplus — the ranking figure. Positive in ink; the
                // recommended keeper is the one accent hero.
                key: "vorSurplus",
                label: "Model",
                numeric: true,
                survives: true,
                subLabel: (r) =>
                  r.projRound ? `proj R${r.projRound}` : undefined,
                render: (r) => {
                  if (r.vorSurplus == null) return "—";
                  const isBest = r.rawName === analysis?.best;
                  const color = isBest
                    ? "var(--text-accent)"
                    : r.vorSurplus > 0
                      ? "var(--text-primary)"
                      : "var(--text-tertiary)";
                  return <span style={{ color }}>{signed1(r.vorSurplus)}</span>;
                },
              },
              {
                key: "marketSurplus",
                label: "Market",
                numeric: true,
                priority: 2,
                subLabel: (r) =>
                  r.marketRound ? `ADP R${r.marketRound}` : undefined,
                render: (r) =>
                  r.marketSurplus == null ? (
                    "—"
                  ) : (
                    <span
                      style={{
                        color:
                          r.marketSurplus > 0
                            ? "var(--text-primary)"
                            : "var(--text-tertiary)",
                      }}
                    >
                      {signed(r.marketSurplus)}
                    </span>
                  ),
              },
              {
                key: "verdict",
                label: "Verdict",
                priority: 2,
                render: (r) => {
                  const v = VERDICT[r.verdict];
                  return (
                    <Badge tone={v.tone} variant="subtle">
                      {v.label}
                    </Badge>
                  );
                },
              },
            ]}
            rows={analysis.rows}
          />
        </div>
      )}
    </div>
  );
}

// The headline call: keep this player, here's why in one line.
function Recommendation({ r }: { r: KeeperAnalysis }) {
  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
        padding: "var(--space-4)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      <span
        style={{
          font: "var(--type-eyebrow)",
          textTransform: "uppercase",
          letterSpacing: "var(--tracking-caps)",
          color: "var(--text-tertiary)",
        }}
      >
        Recommended keeper
      </span>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: "var(--space-3)",
          flexWrap: "wrap",
        }}
      >
        <span
          style={{ font: "var(--type-heading)", color: "var(--text-accent)" }}
        >
          {r.name}
        </span>
        <span
          style={{
            font: "var(--type-body-sm)",
            color: "var(--text-secondary)",
          }}
        >
          {r.pos}
          {r.posRank} · keeps at R{r.cost}
        </span>
        {!r.robust && (
          <Badge tone="warning" variant="subtle">
            model-only
          </Badge>
        )}
      </div>
      <span
        style={{ font: "var(--type-body-sm)", color: "var(--text-secondary)" }}
      >
        {r.vorSurplus != null &&
          `+${r.vorSurplus.toFixed(0)} pts over the R${r.cost} pick`}
        {r.marketSurplus != null &&
          `, ${r.marketSurplus > 0 ? "+" : ""}${r.marketSurplus} rounds vs ADP`}
        .
      </span>
    </section>
  );
}
