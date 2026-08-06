"use client";

import { useEffect, useState } from "react";
import { line, scaleLinear, scalePoint } from "d3";
import { Card } from "@seakim/design-system";
import type {
  CareerRow,
  H2HCell,
  ManagerSeason,
  ScatterPoint,
} from "@/lib/hall-of-records";

// Colours follow guidelines/data-visualisation.md. The shared layer is
// achromatic; the one accent hue carries "the primary thing"; a comparison peer
// is grey (--text-tertiary). We never use the app-accent RAMP for chart data and
// never exceed the intent of the categorical rules.
const INK = "var(--text-primary)"; // category (manager) labels
const INVERSE = "var(--text-inverse)"; // label over a dark seq cell
const LABEL = "var(--text-tertiary)"; // axis + tick labels + comparison series
const GRID = "var(--border-subtle)"; // gridlines (horizontal only)
const HAIRLINE = "var(--border-subtle)"; // required border on every seq cell
const REF = "var(--border-strong)"; // neutral reference / projection line
const ACCENT = "var(--fill-accent)"; // the accent — primary series + emphasis

// Numeric SVG labels are figures → mono + tabular (type-data rule). Applied via
// style so it composes with per-text fill/anchor. Non-numeric labels (names,
// axis titles) stay in the inherited sans.
const FIG = {
  fontFamily: "var(--font-mono)",
  fontVariantNumeric: "tabular-nums",
} as const;

// Magnitude uses the DS sequential ramp (decision 0015): fixed indigo
// --chart-seq-1..4, theme-aware (the tokens invert per theme, so no JS theme
// read for the fill) and never the app accent — a scale must read the same in
// every product. Cells REQUIRE a hairline border: --chart-seq-1 sits ~1.2:1 from
// the card, so the grid is what tells a floor cell from an empty one. Label ink
// flips at --chart-seq-ink-flip (step 4 light / 3 dark), read from the token.
const SEQ_N = 4;
const seqStep = (t: number) =>
  Math.min(SEQ_N, Math.max(1, Math.ceil(Math.max(0, Math.min(1, t)) * SEQ_N)));
const seqFill = (t: number) => `var(--chart-seq-${seqStep(t)})`;
const cellInk = (t: number, flip: number) =>
  seqStep(t) >= flip ? INVERSE : INK;

/** Theme-dependent label-flip step, read from the --chart-seq-ink-flip token. */
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

type Tip = { x: number; y: number; lines: string[] } | null;
type Ctx = {
  active: string | null;
  hover: (m: string | null) => void;
  clearHover: () => void;
  toggle: (m: string) => void;
  show: (e: React.MouseEvent, lines: string[], m?: string) => void;
  hide: () => void;
};

export function Charts({
  managerSeasons,
  headToHead,
  scatter,
  career,
}: {
  managerSeasons: ManagerSeason[];
  headToHead: H2HCell[];
  scatter: ScatterPoint[];
  career: CareerRow[];
}) {
  // A manager is highlighted by hover, or *pinned* by click. Hover alone clears
  // on mouse-out, so on desktop there was no persistent filter (it only looked
  // like one on touch, where no mouseleave fires). A pin wins over hover;
  // clicking the pinned manager clears it, clicking another switches.
  const [hover, setHover] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const [tip, setTip] = useState<Tip>(null);
  // Hover previews; when nothing is hovered it falls back to the pinned filter.
  const active = hover ?? pinned;
  const ctx: Ctx = {
    active,
    hover: setHover,
    clearHover: () => setHover(null),
    toggle: (m) => setPinned((p) => (p === m ? null : m)),
    show: (e, lines, m) => {
      setTip({ x: e.clientX, y: e.clientY, lines });
      if (m !== undefined) setHover(m);
    },
    hide: () => setTip(null),
  };

  return (
    <section
      style={{
        position: "relative",
        display: "grid",
        gap: "var(--space-4)",
        // Cap at 2 columns — a 28rem floor keeps a wide laptop from packing 3
        // narrow charts (which shrank the bump chart). Drops to 1 on mobile.
        gridTemplateColumns: "repeat(auto-fit, minmax(28rem, 1fr))",
      }}
    >
      {/* Grouped by shape: the two wide plots share the top row (shorter), the
          two near-square heatmaps share the bottom row (taller, fill the card).
          Even row heights, and the bump chart stays directly above its finish
          heatmap — the mandatory adjacent grid (ADR 0016). title = primary ink
          heading; meta = secondary description. */}
      <Card
        title="Finish over time"
        meta="final placement each season — hover a line"
      >
        <BumpChart data={managerSeasons} ctx={ctx} />
      </Card>
      <Card
        title="Luck vs. skill"
        meta="points-for vs wins · line = expected wins"
      >
        <LuckSkill data={scatter} career={career} ctx={ctx} />
      </Card>
      <Card title="Wall of history" meta="final rank per season · ring = title">
        <FinishHeatmap data={managerSeasons} ctx={ctx} />
      </Card>
      <Card
        title="Head-to-head"
        meta="regular-season win rate vs each opponent"
      >
        <H2HHeatmap data={headToHead} ctx={ctx} />
      </Card>

      {tip && (
        <div
          className="pointer-events-none"
          style={{
            position: "fixed",
            zIndex: 50,
            left: tip.x + 14,
            top: tip.y + 14,
            background: "var(--surface-raised)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-md)",
            padding: "var(--space-2) var(--space-3)",
            font: "var(--text-xs) var(--font-sans)",
            boxShadow: "var(--shadow-popover)",
          }}
        >
          {tip.lines.map((l, i) => (
            <div
              key={i}
              style={{
                fontWeight: i === 0 ? 600 : 400,
                color: i === 0 ? INK : LABEL,
              }}
            >
              {l}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// dim opacity for a mark not belonging to the highlighted manager
const dim = (hi: string | null, m: string) => (hi && hi !== m ? 0.15 : 1);

// ---------------------------------------------------------------- bump chart
function BumpChart({ data, ctx }: { data: ManagerSeason[]; ctx: Ctx }) {
  const W = 520,
    H = 300,
    m = { t: 16, r: 96, b: 28, l: 28 };
  const seasons = [...new Set(data.map((d) => d.season))].sort((a, b) => a - b);
  const managers = [...new Set(data.map((d) => d.manager))];
  const maxRank = Math.max(...data.map((d) => d.finalRank));
  const x = scalePoint<number>()
    .domain(seasons)
    .range([m.l, W - m.r])
    .padding(0.5);
  const y = scaleLinear()
    .domain([1, maxRank])
    .range([m.t, H - m.b]);
  const path = line<ManagerSeason>()
    .x((d) => x(d.season)!)
    .y((d) => y(d.finalRank));
  const byMgr = managers.map((mgr) => ({
    mgr,
    pts: data
      .filter((d) => d.manager === mgr)
      .sort((a, b) => a.season - b.season),
  }));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", display: "block" }}
      role="img"
      aria-label="Finish over time"
    >
      {y.ticks(Math.min(maxRank, 6)).map((t) => (
        <text
          key={t}
          x={m.l - 6}
          y={y(t) + 4}
          fontSize="10"
          fill={LABEL}
          textAnchor="end"
          style={FIG}
        >
          {t}
        </text>
      ))}
      {seasons.map((s) => (
        <text
          key={s}
          x={x(s)}
          y={H - 10}
          fontSize="10"
          fill={LABEL}
          textAnchor="middle"
          style={FIG}
        >
          {s}
        </text>
      ))}
      {byMgr.map(({ mgr, pts }, i) => {
        const active = ctx.active === mgr;
        return (
          <g
            key={mgr}
            // 0016: identity on hover OR keyboard focus — pointer-only is
            // non-conformant. Focus promotes the line + end-label; the tooltip
            // (needs cursor coords) is the hover extra.
            tabIndex={0}
            role="button"
            aria-label={`${mgr}, finished #${pts[pts.length - 1].finalRank} in ${pts[pts.length - 1].season}`}
            onMouseMove={(e) =>
              ctx.show(
                e,
                [
                  mgr,
                  `finished #${pts[pts.length - 1].finalRank} in ${pts[pts.length - 1].season}`,
                ],
                mgr,
              )
            }
            onMouseLeave={() => {
              ctx.clearHover();
              ctx.hide();
            }}
            onFocus={() => ctx.hover(mgr)}
            onBlur={() => ctx.clearHover()}
            onClick={() => ctx.toggle(mgr)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                ctx.toggle(mgr);
              }
            }}
            style={{ cursor: "pointer" }}
          >
            <path
              className="sl-line"
              style={{
                ["--sl-len" as string]: 1400,
                animationDelay: `${i * 55}ms`,
              }}
              d={path(pts)!}
              fill="none"
              stroke={active ? ACCENT : LABEL}
              strokeWidth={active ? 2.5 : 1.5}
              strokeLinecap="square"
              strokeLinejoin="miter"
              opacity={active ? 1 : ctx.active ? 0.15 : 0.65}
            />
            {pts.map((p) => (
              <circle
                key={p.season}
                cx={x(p.season)}
                cy={y(p.finalRank)}
                r={active ? 4 : 2.5}
                fill={active ? ACCENT : LABEL}
                opacity={active ? 1 : ctx.active ? 0.15 : 0.65}
              />
            ))}
            <text
              x={x(pts[pts.length - 1].season)! + 8}
              y={y(pts[pts.length - 1].finalRank) + 3}
              fontSize="10"
              fill={active ? INK : LABEL}
              fontWeight={active ? 600 : 400}
              opacity={dim(ctx.active, mgr)}
            >
              {mgr}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ------------------------------------------------------------ finish heatmap
function FinishHeatmap({ data, ctx }: { data: ManagerSeason[]; ctx: Ctx }) {
  const flip = useInkFlip();
  const seasons = [...new Set(data.map((d) => d.season))].sort((a, b) => a - b);
  const managers = [...new Set(data.map((d) => d.manager))].sort();
  const maxRank = Math.max(...data.map((d) => d.finalRank));
  const cell = 26,
    labelW = 96,
    top = 20;
  const W = labelW + seasons.length * cell,
    H = top + managers.length * cell;
  const at = (mgr: string, s: number) =>
    data.find((d) => d.manager === mgr && d.season === s);
  // rank 1 (best) = strongest turf, rank maxRank = faintest.
  const mag = (rank: number) => (maxRank - rank) / (maxRank - 1);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", height: "24rem", display: "block" }}
      role="img"
      aria-label="Finish rank per season"
    >
      {seasons.map((s, ci) => (
        <text
          key={s}
          x={labelW + ci * cell + cell / 2}
          y={13}
          fontSize="10"
          fill={LABEL}
          textAnchor="middle"
          style={FIG}
        >
          {`'${String(s).slice(2)}`}
        </text>
      ))}
      {managers.map((mgr, r) => (
        // Row is the keyboard unit (one tab stop per manager, like a bump line):
        // focus highlights + Enter/Space pins. Cell values are visible text.
        <g
          key={mgr}
          tabIndex={0}
          role="button"
          aria-label={`${mgr} — finish rank by season`}
          opacity={dim(ctx.active, mgr)}
          onMouseLeave={() => {
            ctx.clearHover();
            ctx.hide();
          }}
          onFocus={() => ctx.hover(mgr)}
          onBlur={() => ctx.clearHover()}
          onClick={() => ctx.toggle(mgr)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              ctx.toggle(mgr);
            }
          }}
          style={{ cursor: "pointer" }}
        >
          <text
            x={labelW - 6}
            y={top + r * cell + cell / 2 + 3}
            fontSize="10"
            fill={INK}
            textAnchor="end"
          >
            {mgr}
          </text>
          {seasons.map((s, ci) => {
            const d = at(mgr, s);
            const champ = d?.finalRank === 1;
            const t = d ? mag(d.finalRank) : 0;
            return (
              <g key={s}>
                <rect
                  className="sl-pop"
                  style={{ animationDelay: `${(r + ci) * 25}ms` }}
                  x={labelW + ci * cell + 1}
                  y={top + r * cell + 1}
                  width={cell - 2}
                  height={cell - 2}
                  rx={0}
                  fill={d ? seqFill(t) : "transparent"}
                  // Champion = the one thing to pick out → the accent (turf).
                  // "One accent hue live at a time"; the indigo seq cells aren't
                  // the accent, so this is the single accent on the chart. Grey
                  // --border-strong is for neutral reference lines, not emphasis.
                  stroke={champ ? ACCENT : d ? HAIRLINE : "none"}
                  strokeWidth={champ ? 2 : d ? 1 : 0}
                  onMouseMove={(e) =>
                    d &&
                    ctx.show(e, [mgr, `${s}: finished #${d.finalRank}`], mgr)
                  }
                />
                {d && (
                  <text
                    x={labelW + ci * cell + cell / 2}
                    y={top + r * cell + cell / 2 + 3}
                    fontSize="10"
                    fill={cellInk(t, flip)}
                    textAnchor="middle"
                    style={{ ...FIG, pointerEvents: "none" }}
                  >
                    {d.finalRank}
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

// --------------------------------------------------------------- h2h heatmap
function H2HHeatmap({ data, ctx }: { data: H2HCell[]; ctx: Ctx }) {
  const flip = useInkFlip();
  const managers = [...new Set(data.map((d) => d.a))].sort();
  const cell = 26,
    labelW = 96,
    top = 66;
  const W = labelW + managers.length * cell,
    H = top + managers.length * cell;
  const get = (a: string, b: string) =>
    data.find((d) => d.a === a && d.b === b);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", height: "24rem", display: "block" }}
      role="img"
      aria-label="Head-to-head win rate"
    >
      {managers.map((b, ci) => (
        <text
          key={b}
          x={labelW + ci * cell + cell / 2}
          y={top - 6}
          fontSize="10"
          fill={LABEL}
          textAnchor="start"
          opacity={dim(ctx.active, b)}
          transform={`rotate(-45 ${labelW + ci * cell + cell / 2} ${top - 6})`}
        >
          {b}
        </text>
      ))}
      {managers.map((a, r) => (
        // Row is the keyboard unit: focus highlights, Enter/Space pins. Win-rate
        // is rendered in-cell (not tooltip-only), so the value is reachable
        // without a pointer.
        <g
          key={a}
          tabIndex={0}
          role="button"
          aria-label={`${a} — head-to-head win rate vs each opponent`}
          onFocus={() => ctx.hover(a)}
          onBlur={() => ctx.clearHover()}
          onClick={() => ctx.toggle(a)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              ctx.toggle(a);
            }
          }}
          style={{ cursor: "pointer" }}
        >
          <text
            x={labelW - 6}
            y={top + r * cell + cell / 2 + 3}
            fontSize="10"
            fill={INK}
            textAnchor="end"
            opacity={dim(ctx.active, a)}
          >
            {a}
          </text>
          {managers.map((b, ci) => {
            const highlighted =
              !ctx.active || ctx.active === a || ctx.active === b;
            if (a === b)
              return (
                <rect
                  key={b}
                  x={labelW + ci * cell + 1}
                  y={top + r * cell + 1}
                  width={cell - 2}
                  height={cell - 2}
                  rx={0}
                  fill="var(--surface-inset)"
                  stroke={HAIRLINE}
                  strokeWidth={1}
                />
              );
            const g = get(a, b);
            const rate = g && g.games ? g.wins / g.games : null;
            const pct = rate == null ? null : Math.round(rate * 100);
            return (
              <g key={b}>
                <rect
                  className="sl-fade"
                  style={{ animationDelay: `${(r + ci) * 20}ms` }}
                  x={labelW + ci * cell + 1}
                  y={top + r * cell + 1}
                  width={cell - 2}
                  height={cell - 2}
                  rx={0}
                  fill={rate == null ? "transparent" : seqFill(rate)}
                  stroke={rate == null ? "none" : HAIRLINE}
                  strokeWidth={rate == null ? 0 : 1}
                  opacity={highlighted ? 1 : 0.15}
                  onMouseMove={(e) =>
                    g &&
                    ctx.show(
                      e,
                      [
                        `${a} vs ${b}`,
                        `${g.wins}-${g.games - g.wins} (${pct}%)`,
                      ],
                      a,
                    )
                  }
                  onMouseLeave={() => {
                    ctx.clearHover();
                    ctx.hide();
                  }}
                />
                {pct != null && (
                  <text
                    x={labelW + ci * cell + cell / 2}
                    y={top + r * cell + cell / 2 + 3}
                    fontSize="10"
                    fill={cellInk(rate!, flip)}
                    textAnchor="middle"
                    opacity={highlighted ? 1 : 0.15}
                    style={{ ...FIG, pointerEvents: "none" }}
                  >
                    {pct}
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

// ------------------------------------------------------------ luck vs skill
function LuckSkill({
  data,
  career,
  ctx,
}: {
  data: ScatterPoint[];
  career: CareerRow[];
  ctx: Ctx;
}) {
  const W = 520,
    H = 300,
    m = { t: 16, r: 16, b: 36, l: 40 };
  const managers = new Set(career.map((c) => c.manager));
  const pts = data.filter((d) => d.manager && managers.has(d.manager));
  const xs = pts.map((d) => d.pointsFor),
    ys = pts.map((d) => d.wins);
  const x = scaleLinear()
    .domain([Math.min(...xs) * 0.98, Math.max(...xs) * 1.02])
    .range([m.l, W - m.r]);
  const y = scaleLinear()
    .domain([Math.min(...ys) - 1, Math.max(...ys) + 1])
    .range([H - m.b, m.t]);
  const n = pts.length,
    sx = xs.reduce((a, b) => a + b, 0),
    sy = ys.reduce((a, b) => a + b, 0);
  const sxy = pts.reduce((a, d) => a + d.pointsFor * d.wins, 0);
  const sxx = xs.reduce((a, b) => a + b * b, 0);
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
  const intc = (sy - slope * sx) / n;
  const fit = (px: number) => slope * px + intc;
  const [x0, x1] = x.domain();

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", display: "block" }}
      role="img"
      aria-label="Luck vs skill"
    >
      {y.ticks(5).map((t) => (
        <g key={t}>
          <line
            x1={m.l}
            x2={W - m.r}
            y1={y(t)}
            y2={y(t)}
            stroke={GRID}
            strokeWidth={1}
          />
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
      <text
        x={(m.l + W - m.r) / 2}
        y={H - 6}
        fontSize="10"
        fill={LABEL}
        textAnchor="middle"
      >
        points for →
      </text>
      <text
        x={12}
        y={(m.t + H - m.b) / 2}
        fontSize="10"
        fill={LABEL}
        textAnchor="middle"
        transform={`rotate(-90 12 ${(m.t + H - m.b) / 2})`}
      >
        wins →
      </text>
      <line
        x1={x(x0)}
        y1={y(fit(x0))}
        x2={x(x1)}
        y2={y(fit(x1))}
        stroke={REF}
        strokeWidth={1}
        strokeDasharray="4 3"
      />
      {pts.map((d, i) => {
        const lucky = d.wins > fit(d.pointsFor);
        return (
          <circle
            key={i}
            className="sl-pop"
            style={{ animationDelay: `${i * 20}ms`, cursor: "pointer" }}
            cx={x(d.pointsFor)}
            cy={y(d.wins)}
            r={ctx.active === d.manager ? 6 : 4}
            fill={lucky ? ACCENT : LABEL}
            stroke="var(--surface-card)"
            strokeWidth={1}
            opacity={dim(ctx.active, d.manager!)}
            tabIndex={0}
            role="button"
            aria-label={`${d.manager}, ${d.season}: ${d.wins} wins, ${d.pointsFor.toFixed(0)} points — ${lucky ? "lucky" : "unlucky"}`}
            onMouseMove={(e) =>
              ctx.show(
                e,
                [
                  `${d.manager} · ${d.season}`,
                  `${d.wins} wins, ${d.pointsFor.toFixed(0)} pts — ${lucky ? "lucky" : "unlucky"}`,
                ],
                d.manager!,
              )
            }
            onMouseLeave={() => {
              ctx.clearHover();
              ctx.hide();
            }}
            onFocus={() => d.manager && ctx.hover(d.manager)}
            onBlur={() => ctx.clearHover()}
            onClick={() => d.manager && ctx.toggle(d.manager)}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === " ") && d.manager) {
                e.preventDefault();
                ctx.toggle(d.manager);
              }
            }}
          />
        );
      })}
    </svg>
  );
}
