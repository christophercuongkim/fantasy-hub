"use client";

import { useEffect, useState } from "react";
import { line, scaleLinear, scalePoint } from "d3";
import type {
  CareerRow,
  H2HCell,
  ManagerSeason,
  ScatterPoint,
} from "@/lib/superlatives";

// Structural colors from CSS vars (theme-aware). Data-color *scales* need the
// actual surface, so we read the theme for those.
function useIsDark() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-color-scheme: dark)");
    const set = () => setDark(m.matches);
    set();
    m.addEventListener("change", set);
    return () => m.removeEventListener("change", set);
  }, []);
  return dark;
}

const INK = "var(--sl-ink)";
const MUTED = "var(--sl-muted)";
const GRID = "var(--sl-grid)";
const ACCENT = "var(--sl-accent)";

// Shared interaction context: one highlighted manager across every chart + one
// cursor-following tooltip.
type Tip = { x: number; y: number; lines: string[] } | null;
type Ctx = {
  hi: string | null;
  setHi: (m: string | null) => void;
  show: (e: React.MouseEvent, lines: string[], m?: string) => void;
  hide: () => void;
};

function Panel({
  title,
  sub,
  children,
}: {
  title: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mb-3 text-xs text-neutral-400">{sub}</p>
      {children}
    </div>
  );
}

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
    <section className="relative grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Panel
        title="Finish over time"
        sub="final placement each season — hover a line"
      >
        <BumpChart data={managerSeasons} ctx={ctx} />
      </Panel>
      <Panel title="Wall of history" sub="final rank per season · gold = title">
        <FinishHeatmap data={managerSeasons} ctx={ctx} />
      </Panel>
      <Panel
        title="Head-to-head"
        sub="regular-season win rate vs each opponent"
      >
        <H2HHeatmap data={headToHead} ctx={ctx} />
      </Panel>
      <Panel
        title="Luck vs. skill"
        sub="points-for vs wins · line = expected wins"
      >
        <LuckSkill data={scatter} career={career} ctx={ctx} />
      </Panel>

      {tip && (
        <div
          className="pointer-events-none fixed z-50 rounded-md border border-neutral-200 bg-white/95 px-2.5 py-1.5 text-xs shadow-lg backdrop-blur dark:border-neutral-700 dark:bg-neutral-900/95"
          style={{ left: tip.x + 14, top: tip.y + 14 }}
        >
          {tip.lines.map((l, i) => (
            <div
              key={i}
              className={i === 0 ? "font-semibold" : "text-neutral-500"}
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
      className="w-full"
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
  const c = scaleLinear<string>()
    .domain([1, maxRank])
    .range(dark ? ["#3987e5", "#12233a"] : ["#0d366b", "#cde2fb"]);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
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
                  fill={d ? c(d.finalRank) : "transparent"}
                  stroke={champ ? "#eda100" : "none"}
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
                    fill={d.finalRank <= maxRank / 2 ? "#fff" : INK}
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
  const managers = [...new Set(data.map((d) => d.a))].sort();
  const cell = 26,
    labelW = 96,
    top = 66;
  const W = labelW + managers.length * cell,
    H = top + managers.length * cell;
  const get = (a: string, b: string) =>
    data.find((d) => d.a === a && d.b === b);
  const c = scaleLinear<string>()
    .domain([0, 0.5, 1])
    .range(["#d03b3b", "#f0efec", "#2a78d6"]);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
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
                  fill={GRID}
                  opacity={0.3}
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
                fill={rate == null ? "transparent" : c(rate)}
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
      className="w-full"
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
            fill={lucky ? "#2a78d6" : "#d03b3b"}
            stroke="var(--sl-surface)"
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
