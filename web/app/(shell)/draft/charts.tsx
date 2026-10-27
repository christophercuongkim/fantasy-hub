"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  scaleLinear,
  select,
  zoom,
  zoomIdentity,
  type D3ZoomEvent,
  type ZoomBehavior,
} from "d3";
import { Card, IconButton } from "@seakim/design-system";
import type { PosCount, ValuePick } from "@/lib/draft-superlatives";

// Colours follow guidelines/data-visualisation.md: the shared layer is
// achromatic; with two groups it's the one accent hue + --text-tertiary (never
// the app-accent ramp). Values/steals carry the accent (the "notable" side);
// reaches are the tertiary comparison. Neutral reference lines are --border-strong.
const INK = "var(--text-primary)";
const LABEL = "var(--text-tertiary)";
const GRID = "var(--border-subtle)";
const REF = "var(--border-strong)";
const ACCENT = "var(--fill-accent)";

// Numeric SVG labels are figures → mono + tabular (type-data rule).
const FIG: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontVariantNumeric: "tabular-nums",
};

// ---------------------------------------------------------- ADP vs actual pick
// Each dot is a pick: x = consensus ADP, y = where it actually went. The 45°
// line is "drafted exactly at ADP"; above it = reached (taken earlier), below =
// fell (a value). Reaches accent, values tertiary — the one-accent + comparison
// pairing, not a two-hue scheme.
export function ADPScatter({ picks }: { picks: ValuePick[] }) {
  const W = 560,
    H = 360,
    m = { t: 16, r: 16, b: 40, l: 44 };
  const max =
    Math.ceil(
      Math.max(1, ...picks.map((p) => Math.max(p.adp, p.overall))) / 10,
    ) * 10;
  const x = scaleLinear()
    .domain([0, max])
    .range([m.l, W - m.r]);
  const y = scaleLinear()
    .domain([0, max])
    .range([m.t, H - m.b]); // pick 1 near the top
  const ticks = x.ticks(6);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", height: "auto", display: "block" }}
      role="img"
      aria-label="Every pick — consensus ADP versus where it was actually drafted. Points above the diagonal were reaches; below were values."
    >
      {/* gridlines + axis ticks */}
      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={x(t)}
            x2={x(t)}
            y1={m.t}
            y2={H - m.b}
            stroke={GRID}
            strokeWidth={1}
          />
          <line
            x1={m.l}
            x2={W - m.r}
            y1={y(t)}
            y2={y(t)}
            stroke={GRID}
            strokeWidth={1}
          />
          <text
            x={x(t)}
            y={H - m.b + 16}
            fontSize="10"
            fill={LABEL}
            textAnchor="middle"
            style={FIG}
          >
            {t}
          </text>
          <text
            x={m.l - 6}
            y={y(t) + 3}
            fontSize="10"
            fill={LABEL}
            textAnchor="end"
            style={FIG}
          >
            {t}
          </text>
        </g>
      ))}
      {/* drafted-at-ADP reference (neutral) */}
      <line
        x1={x(0)}
        y1={y(0)}
        x2={x(max)}
        y2={y(max)}
        stroke={REF}
        strokeWidth={1}
        strokeDasharray="4 4"
      />
      {/* points: values (steals) accent, reaches tertiary */}
      {picks.map((p) => (
        <circle
          key={`${p.season}-${p.overall}`}
          cx={x(p.adp)}
          cy={y(p.overall)}
          r={2.5}
          fill={p.value > 0 ? ACCENT : LABEL}
          opacity={p.value > 0 ? 0.75 : 0.5}
        >
          <title>{`${p.player} — ADP ${p.adp.toFixed(1)}, pick ${p.overall} (${p.value > 0 ? "+" : ""}${p.value.toFixed(1)})`}</title>
        </circle>
      ))}
      {/* axis titles */}
      <text
        x={(m.l + W - m.r) / 2}
        y={H - 4}
        fontSize="10"
        fill={LABEL}
        textAnchor="middle"
      >
        consensus ADP →
      </text>
      <text
        x={12}
        y={(m.t + H - m.b) / 2}
        fontSize="10"
        fill={LABEL}
        textAnchor="middle"
        transform={`rotate(-90 12 ${(m.t + H - m.b) / 2})`}
      >
        actual pick →
      </text>
    </svg>
  );
}

// ------------------------------------------------------------ value histogram
// How the whole league drafts vs ADP: counts of value in fixed-width bins.
// One series → accent bars, square corners, hairline baseline.
export function ValueHistogram({ picks }: { picks: ValuePick[] }) {
  const BIN = 10;
  const vals = picks.map((p) => p.value);
  const lo = Math.floor(Math.min(...vals) / BIN) * BIN;
  const hi = Math.ceil(Math.max(...vals) / BIN) * BIN;
  const bins: { x0: number; n: number }[] = [];
  for (let b = lo; b < hi; b += BIN) {
    bins.push({
      x0: b,
      n: vals.filter((v) => v >= b && v < b + BIN).length,
    });
  }
  const W = 560,
    H = 260,
    m = { t: 12, r: 16, b: 36, l: 36 };
  const maxN = Math.max(1, ...bins.map((b) => b.n));
  const bw = (W - m.l - m.r) / bins.length;
  const y = scaleLinear()
    .domain([0, maxN])
    .range([H - m.b, m.t]);
  const xz = scaleLinear()
    .domain([lo, hi])
    .range([m.l, W - m.r]);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", height: "auto", display: "block" }}
      role="img"
      aria-label="Distribution of value vs ADP across every pick. Bars left of zero are reaches; right of zero are values (steals)."
    >
      {bins.map((b) => {
        const h = H - m.b - y(b.n);
        return (
          <rect
            key={b.x0}
            x={xz(b.x0) + 1}
            y={y(b.n)}
            width={bw - 2}
            height={Math.max(0, h)}
            rx={0}
            fill={ACCENT}
            opacity={0.85}
          >
            <title>{`${b.x0} to ${b.x0 + BIN}: ${b.n} picks`}</title>
          </rect>
        );
      })}
      {/* zero line (drafted at ADP) */}
      <line
        x1={xz(0)}
        x2={xz(0)}
        y1={m.t}
        y2={H - m.b}
        stroke={REF}
        strokeWidth={1}
      />
      <text
        x={xz(0)}
        y={H - m.b + 16}
        fontSize="10"
        fill={INK}
        textAnchor="middle"
        style={FIG}
      >
        0
      </text>
      {/* baseline + end labels */}
      <line
        x1={m.l}
        x2={W - m.r}
        y1={H - m.b}
        y2={H - m.b}
        stroke={GRID}
        strokeWidth={1}
      />
      <text
        x={m.l}
        y={H - m.b + 16}
        fontSize="10"
        fill={LABEL}
        textAnchor="start"
      >
        ← reaches
      </text>
      <text
        x={W - m.r}
        y={H - m.b + 16}
        fontSize="10"
        fill={LABEL}
        textAnchor="end"
      >
        values →
      </text>
    </svg>
  );
}

// ----------------------------------------------------------- positional heatmap
// Round × position draft-capital, coloured by the DS sequential ramp (decision
// 0015): fixed indigo --chart-seq-1..4, theme-aware, never the app accent — a
// magnitude scale must read the same in every product. Cells REQUIRE a hairline
// (--chart-seq-1 is ~1.2:1 from the card). Label ink flips at the theme-dependent
// --chart-seq-ink-flip token. An SVG that scales to width — no responsive
// column-dropping like a table.
const INVERSE = "var(--text-inverse)";
const HAIRLINE = "var(--border-subtle)";
const SEQ_N = 4;
const seqStep = (t: number) =>
  Math.min(SEQ_N, Math.max(1, Math.ceil(Math.max(0, Math.min(1, t)) * SEQ_N)));
const seqFill = (t: number) => `var(--chart-seq-${seqStep(t)})`;

function useInkFlip() {
  const [flip, setFlip] = useState(3);
  useEffect(() => {
    const read = () => {
      const v = getComputedStyle(document.documentElement)
        .getPropertyValue("--chart-seq-ink-flip")
        .trim();
      const n = parseInt(v, 10);
      if (!Number.isNaN(n)) setFlip(n);
    };
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => obs.disconnect();
  }, []);
  return flip;
}

export function PositionalHeatmap({
  data,
  positions,
}: {
  data: PosCount[];
  positions: string[];
}) {
  const flip = useInkFlip();
  const rounds = [...new Set(data.map((d) => d.round))].sort((a, b) => a - b);
  const max = Math.max(1, ...data.map((d) => d.n));
  const at = (round: number, pos: string) =>
    data.find((d) => d.round === round && d.pos === pos)?.n ?? 0;

  const cell = 34,
    labelW = 32,
    top = 22;
  const W = labelW + positions.length * cell,
    H = top + rounds.length * cell;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", height: "auto", display: "block" }}
      role="img"
      aria-label="Picks by position in each round, all seasons. Darker = more picks."
    >
      {positions.map((pos, ci) => (
        <text
          key={pos}
          x={labelW + ci * cell + cell / 2}
          y={top - 7}
          fontSize="11"
          fill={LABEL}
          textAnchor="middle"
        >
          {pos}
        </text>
      ))}
      {rounds.map((round, r) => (
        <g key={round}>
          <text
            x={labelW - 6}
            y={top + r * cell + cell / 2 + 4}
            fontSize="11"
            fill={INK}
            textAnchor="end"
            style={FIG}
          >
            {`R${round}`}
          </text>
          {positions.map((pos, ci) => {
            const n = at(round, pos);
            const t = n / max;
            return (
              <g key={pos}>
                <rect
                  x={labelW + ci * cell + 1}
                  y={top + r * cell + 1}
                  width={cell - 2}
                  height={cell - 2}
                  rx={0}
                  fill={n === 0 ? "var(--surface-inset)" : seqFill(t)}
                  stroke={HAIRLINE}
                  strokeWidth={1}
                >
                  <title>{`R${round} ${pos}: ${n} picks`}</title>
                </rect>
                {n > 0 && (
                  <text
                    x={labelW + ci * cell + cell / 2}
                    y={top + r * cell + cell / 2 + 4}
                    fontSize="11"
                    fill={seqStep(t) >= flip ? INVERSE : INK}
                    textAnchor="middle"
                    style={FIG}
                  >
                    {n}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      ))}
    </svg>
  );
}

// -------------------------------------------------- ADP scatter, zoom-to-explore
// Click to enlarge IN PLACE (not a Dialog — the DS reserves those for decisions,
// never information). Expanded: d3-zoom pan/drag + wheel/pinch, +/−/reset for
// non-pointer users, and player labels appear once you zoom in.
export function ScatterCard({ picks }: { picks: ValuePick[] }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card
      title="ADP vs actual pick"
      meta="above the line = reach · below = value"
      style={expanded ? { gridColumn: "1 / -1" } : undefined}
    >
      <div style={{ position: "relative" }}>
        <div style={{ position: "absolute", top: 0, right: 0, zIndex: 1 }}>
          <IconButton
            icon={expanded ? "arrows-in" : "arrows-out"}
            label={expanded ? "Collapse" : "Enlarge"}
            variant="ghost"
            size="sm"
            onClick={() => setExpanded((v) => !v)}
          />
        </div>
        {expanded ? (
          <ScatterZoom picks={picks} />
        ) : (
          <ADPScatter picks={picks} />
        )}
      </div>
    </Card>
  );
}

function ScatterZoom({ picks }: { picks: ValuePick[] }) {
  const W = 720,
    H = 520,
    m = { t: 20, r: 20, b: 44, l: 52 };
  const max =
    Math.ceil(
      Math.max(1, ...picks.map((p) => Math.max(p.adp, p.overall))) / 10,
    ) * 10;
  const x0 = scaleLinear()
    .domain([0, max])
    .range([m.l, W - m.r]);
  const y0 = scaleLinear()
    .domain([0, max])
    .range([m.t, H - m.b]);
  const svgRef = useRef<SVGSVGElement>(null);
  const zbRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [tr, setTr] = useState(zoomIdentity);
  const clip = "clip" + useId().replace(/:/g, "");

  useEffect(() => {
    const node = svgRef.current;
    if (!node) return;
    const zb = zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 8])
      .translateExtent([
        [0, 0],
        [W, H],
      ])
      .extent([
        [0, 0],
        [W, H],
      ])
      .on("zoom", (e: D3ZoomEvent<SVGSVGElement, unknown>) =>
        setTr(e.transform),
      );
    zbRef.current = zb;
    select(node).call(zb);
    return () => {
      select(node).on(".zoom", null);
    };
  }, []);

  const x = tr.rescaleX(x0);
  const y = tr.rescaleY(y0);
  const xt = x.ticks(7);
  const yt = y.ticks(7);

  const nudge = (k: number) => {
    const node = svgRef.current;
    if (node && zbRef.current)
      select(node).transition().duration(200).call(zbRef.current.scaleBy, k);
  };
  const reset = () => {
    const node = svgRef.current;
    if (node && zbRef.current)
      select(node)
        .transition()
        .duration(200)
        .call(zbRef.current.transform, zoomIdentity);
  };

  const inView = (p: ValuePick) => {
    const cx = x(p.adp),
      cy = y(p.overall);
    return cx >= m.l && cx <= W - m.r && cy >= m.t && cy <= H - m.b;
  };
  const visible = picks.filter(inView);
  const showLabels = tr.k >= 2.5 && visible.length <= 28;

  return (
    <div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        style={{
          width: "100%",
          height: "auto",
          display: "block",
          touchAction: "none",
          cursor: "grab",
        }}
        role="img"
        aria-label="ADP versus actual pick — drag to pan, scroll or pinch to zoom."
      >
        <defs>
          <clipPath id={clip}>
            <rect
              x={m.l}
              y={m.t}
              width={W - m.l - m.r}
              height={H - m.t - m.b}
            />
          </clipPath>
        </defs>
        {xt.map((t) => (
          <g key={`x${t}`}>
            <line
              x1={x(t)}
              x2={x(t)}
              y1={m.t}
              y2={H - m.b}
              stroke={GRID}
              strokeWidth={1}
            />
            <text
              x={x(t)}
              y={H - m.b + 16}
              fontSize="11"
              fill={LABEL}
              textAnchor="middle"
              style={FIG}
            >
              {t}
            </text>
          </g>
        ))}
        {yt.map((t) => (
          <g key={`y${t}`}>
            <line
              x1={m.l}
              x2={W - m.r}
              y1={y(t)}
              y2={y(t)}
              stroke={GRID}
              strokeWidth={1}
            />
            <text
              x={m.l - 8}
              y={y(t) + 4}
              fontSize="11"
              fill={LABEL}
              textAnchor="end"
              style={FIG}
            >
              {t}
            </text>
          </g>
        ))}
        <g clipPath={`url(#${clip})`}>
          <line
            x1={x(0)}
            y1={y(0)}
            x2={x(max)}
            y2={y(max)}
            stroke={REF}
            strokeWidth={1}
            strokeDasharray="4 4"
          />
          {picks.map((p) => (
            <circle
              key={`${p.season}-${p.overall}`}
              cx={x(p.adp)}
              cy={y(p.overall)}
              r={3}
              fill={p.value > 0 ? ACCENT : LABEL}
              opacity={p.value > 0 ? 0.8 : 0.5}
            >
              <title>{`${p.player} — ADP ${p.adp.toFixed(1)}, pick ${p.overall} (${p.value > 0 ? "+" : ""}${p.value.toFixed(1)})`}</title>
            </circle>
          ))}
          {showLabels &&
            visible.map((p) => (
              <text
                key={`l${p.season}-${p.overall}`}
                x={x(p.adp) + 6}
                y={y(p.overall) - 5}
                fontSize="10"
                fill={INK}
              >
                {p.player}
              </text>
            ))}
        </g>
        <text
          x={(m.l + W - m.r) / 2}
          y={H - 6}
          fontSize="11"
          fill={LABEL}
          textAnchor="middle"
        >
          consensus ADP →
        </text>
        <text
          x={14}
          y={(m.t + H - m.b) / 2}
          fontSize="11"
          fill={LABEL}
          textAnchor="middle"
          transform={`rotate(-90 14 ${(m.t + H - m.b) / 2})`}
        >
          actual pick →
        </text>
      </svg>
      <div
        style={{
          display: "flex",
          gap: "var(--space-2)",
          justifyContent: "flex-end",
          alignItems: "center",
          marginTop: "var(--space-2)",
        }}
      >
        <span
          style={{
            font: "var(--type-caption)",
            color: "var(--text-tertiary)",
            marginRight: "auto",
          }}
        >
          Drag to pan · scroll or pinch to zoom · zoom in for names
        </span>
        <IconButton
          icon="minus"
          label="Zoom out"
          variant="secondary"
          size="sm"
          onClick={() => nudge(1 / 1.5)}
        />
        <IconButton
          icon="plus"
          label="Zoom in"
          variant="secondary"
          size="sm"
          onClick={() => nudge(1.5)}
        />
        <IconButton
          icon="arrow-counter-clockwise"
          label="Reset zoom"
          variant="ghost"
          size="sm"
          onClick={reset}
        />
      </div>
    </div>
  );
}
