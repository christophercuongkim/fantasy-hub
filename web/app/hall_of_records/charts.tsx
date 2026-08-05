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

// Structural ink from DS text/border tokens (theme-aware). Data magnitude uses
// the bench turf ramp (single-hue sequential) — see the ramp() helper.
const INK = "var(--text-primary)";
const INVERSE = "var(--text-inverse)";
const MUTED = "var(--text-secondary)";
const GRID = "var(--border-default)";
const ACCENT = "var(--text-accent)";

// The bench accent ramp (tokens/apps.css, --brand-*). Sequential single hue,
// dim→bright on a dark surface, light→dark on a light one, so higher magnitude
// always contrasts more with the page. Picked as discrete steps because d3 can't
// interpolate the oklch() the tokens are authored in.
const RAMP_DARK = [
  "var(--brand-900)",
  "var(--brand-800)",
  "var(--brand-600)",
  "var(--brand-500)",
  "var(--brand-400)",
  "var(--brand-300)",
];
const RAMP_LIGHT = [
  "var(--brand-100)",
  "var(--brand-200)",
  "var(--brand-300)",
  "var(--brand-500)",
  "var(--brand-700)",
  "var(--brand-800)",
];
/** t in [0,1], 1 = strongest. Returns a turf-ramp CSS var for the surface. */
function ramp(t: number, dark: boolean) {
  const r = dark ? RAMP_DARK : RAMP_LIGHT;
  const i = Math.round(Math.max(0, Math.min(1, t)) * (r.length - 1));
  return r[i];
}
/** Readable label ink over a ramp cell: dark ink on a strong (bright) cell. */
const cellInk = (t: number) => (t > 0.5 ? INVERSE : INK);

function useIsDark() {
  const [dark, setDark] = useState(true);
  useEffect(() => {
    const read = () =>
      setDark(document.documentElement.getAttribute("data-theme") !== "light");
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => obs.disconnect();
  }, []);
  return dark;
}

type Tip = { x: number; y: number; lines: string[] } | null;
type Ctx = {
  hi: string | null;
  setHi: (m: string | null) => void;
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
  const [hi, setHi] = useState<string | null>(null);
  const [tip, setTip] = useState<Tip>(null);
  const ctx: Ctx = {
    hi,
    setHi,
    show: (e, lines, m) => {
      setTip({ x: e.clientX, y: e.clientY, lines });
      if (m !== undefined) setHi(m);
    },
    hide: () => setTip(null),
  };

  return (
    <section
      style={{
        position: "relative",
        display: "grid",
        gap: "var(--space-4)",
        gridTemplateColumns: "repeat(auto-fit, minmax(20rem, 1fr))",
      }}
    >
      <Card
        eyebrow="FINISH OVER TIME"
        meta="final placement each season — hover a line"
      >
        <BumpChart data={managerSeasons} ctx={ctx} />
      </Card>
      <Card
        eyebrow="WALL OF HISTORY"
        meta="final rank per season · ring = title"
      >
        <FinishHeatmap data={managerSeasons} ctx={ctx} />
      </Card>
      <Card
        eyebrow="HEAD-TO-HEAD"
        meta="regular-season win rate vs each opponent"
      >
        <H2HHeatmap data={headToHead} ctx={ctx} />
      </Card>
      <Card
        eyebrow="LUCK VS. SKILL"
        meta="points-for vs wins · line = expected wins"
      >
        <LuckSkill data={scatter} career={career} ctx={ctx} />
      </Card>

      {tip && (
        <div
          className="pointer-events-none"
          style={{
            position: "fixed",
            zIndex: 50,
            left: tip.x + 14,
            top: tip.y + 14,
            background: "var(--surface-overlay)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-md)",
            padding: "var(--space-2) var(--space-3)",
            font: "var(--text-xs) var(--font-sans)",
            boxShadow: "var(--shadow-overlay, 0 4px 16px rgba(0,0,0,0.25))",
          }}
        >
          {tip.lines.map((l, i) => (
            <div
              key={i}
              style={{
                fontWeight: i === 0 ? 600 : 400,
                color: i === 0 ? INK : MUTED,
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
      style={{ width: "100%" }}
      role="img"
      aria-label="Finish over time"
    >
      {y.ticks(Math.min(maxRank, 6)).map((t) => (
        <text
          key={t}
          x={m.l - 6}
          y={y(t) + 4}
          fontSize="10"
          fill={MUTED}
          textAnchor="end"
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
          fill={MUTED}
          textAnchor="middle"
        >
          {s}
        </text>
      ))}
      {byMgr.map(({ mgr, pts }, i) => {
        const active = ctx.hi === mgr;
        return (
          <g
            key={mgr}
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
              ctx.setHi(null);
              ctx.hide();
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
              stroke={active ? ACCENT : MUTED}
              strokeWidth={active ? 2.5 : 1.5}
              opacity={active ? 1 : ctx.hi ? 0.15 : 0.65}
            />
            {pts.map((p) => (
              <circle
                key={p.season}
                cx={x(p.season)}
                cy={y(p.finalRank)}
                r={active ? 4 : 2.5}
                fill={active ? ACCENT : MUTED}
                opacity={active ? 1 : ctx.hi ? 0.15 : 0.65}
              />
            ))}
            <text
              x={x(pts[pts.length - 1].season)! + 8}
              y={y(pts[pts.length - 1].finalRank) + 3}
              fontSize="10"
              fill={active ? INK : MUTED}
              fontWeight={active ? 600 : 400}
              opacity={dim(ctx.hi, mgr)}
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
  const dark = useIsDark();
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
      style={{ width: "100%" }}
      role="img"
      aria-label="Finish rank per season"
    >
      {seasons.map((s, ci) => (
        <text
          key={s}
          x={labelW + ci * cell + cell / 2}
          y={13}
          fontSize="9"
          fill={MUTED}
          textAnchor="middle"
        >
          {`'${String(s).slice(2)}`}
        </text>
      ))}
      {managers.map((mgr, r) => (
        <g
          key={mgr}
          opacity={dim(ctx.hi, mgr)}
          onMouseLeave={() => {
            ctx.setHi(null);
            ctx.hide();
          }}
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
                  rx={2}
                  fill={d ? ramp(t, dark) : "transparent"}
                  stroke={champ ? ACCENT : "none"}
                  strokeWidth={champ ? 2 : 0}
                  onMouseMove={(e) =>
                    d &&
                    ctx.show(e, [mgr, `${s}: finished #${d.finalRank}`], mgr)
                  }
                />
                {d && (
                  <text
                    x={labelW + ci * cell + cell / 2}
                    y={top + r * cell + cell / 2 + 3}
                    fontSize="9"
                    fill={cellInk(t)}
                    textAnchor="middle"
                    style={{ pointerEvents: "none" }}
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
  const dark = useIsDark();
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
      style={{ width: "100%" }}
      role="img"
      aria-label="Head-to-head win rate"
    >
      {managers.map((b, ci) => (
        <text
          key={b}
          x={labelW + ci * cell + cell / 2}
          y={top - 6}
          fontSize="9"
          fill={MUTED}
          textAnchor="start"
          opacity={dim(ctx.hi, b)}
          transform={`rotate(-45 ${labelW + ci * cell + cell / 2} ${top - 6})`}
        >
          {b}
        </text>
      ))}
      {managers.map((a, r) => (
        <g key={a}>
          <text
            x={labelW - 6}
            y={top + r * cell + cell / 2 + 3}
            fontSize="10"
            fill={INK}
            textAnchor="end"
            opacity={dim(ctx.hi, a)}
          >
            {a}
          </text>
          {managers.map((b, ci) => {
            const highlighted = !ctx.hi || ctx.hi === a || ctx.hi === b;
            if (a === b)
              return (
                <rect
                  key={b}
                  x={labelW + ci * cell + 1}
                  y={top + r * cell + 1}
                  width={cell - 2}
                  height={cell - 2}
                  rx={2}
                  fill="var(--surface-inset)"
                />
              );
            const g = get(a, b);
            const rate = g && g.games ? g.wins / g.games : null;
            return (
              <rect
                key={b}
                className="sl-fade"
                style={{ animationDelay: `${(r + ci) * 20}ms` }}
                x={labelW + ci * cell + 1}
                y={top + r * cell + 1}
                width={cell - 2}
                height={cell - 2}
                rx={2}
                fill={rate == null ? "transparent" : ramp(rate, dark)}
                opacity={highlighted ? 1 : 0.15}
                onMouseMove={(e) =>
                  g &&
                  ctx.show(
                    e,
                    [
                      `${a} vs ${b}`,
                      `${g.wins}-${g.games - g.wins} (${Math.round((g.wins / g.games) * 100)}%)`,
                    ],
                    a,
                  )
                }
                onMouseLeave={() => {
                  ctx.setHi(null);
                  ctx.hide();
                }}
              />
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
      style={{ width: "100%" }}
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
            fill={MUTED}
            textAnchor="end"
          >
            {t}
          </text>
        </g>
      ))}
      <text
        x={(m.l + W - m.r) / 2}
        y={H - 6}
        fontSize="10"
        fill={MUTED}
        textAnchor="middle"
      >
        points for →
      </text>
      <text
        x={12}
        y={(m.t + H - m.b) / 2}
        fontSize="10"
        fill={MUTED}
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
        stroke={MUTED}
        strokeWidth={1.5}
        strokeDasharray="4 3"
      />
      {pts.map((d, i) => {
        const lucky = d.wins > fit(d.pointsFor);
        return (
          <circle
            key={i}
            className="sl-pop"
            style={{ animationDelay: `${i * 20}ms` }}
            cx={x(d.pointsFor)}
            cy={y(d.wins)}
            r={ctx.hi === d.manager ? 6 : 4}
            fill={lucky ? ACCENT : MUTED}
            stroke="var(--surface-card)"
            strokeWidth={1}
            opacity={dim(ctx.hi, d.manager!)}
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
              ctx.setHi(null);
              ctx.hide();
            }}
          />
        );
      })}
    </svg>
  );
}
