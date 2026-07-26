# Fantasy Football Analytics App — Documentation

Complete specification for a personal NFL fantasy app: draft assistance, start/sit decisions, waivers, trades, and supporting analytics.

**Stack:** Next.js + TypeScript · FastAPI + Python · Neon Postgres · DuckDB/Parquet · Yahoo Fantasy API · Dokploy on a VPS

---

## Documents

| # | Document | What it's for |
|---|---|---|
| — | **[Implementation plan](../fantasy-nfl-implementation-plan.md)** | The master document. Architecture, phases, build order. **Start here.** |
| 01 | [Data dictionary](01-data-dictionary.md) | Every field, type, unit, and source. The one you'll open most. |
| 02 | [API contract](02-api-contract.md) | Every endpoint's request/response shape. The seam between services. |
| 03 | [Model specification](03-model-spec.md) | Projection math: formulas, parameters, backtest protocol. |
| 04 | [Screens & wireframes](04-screens-and-wireframes.md) | Every page, its data needs, and its interactions. |
| 05 | [Yahoo API cookbook](05-yahoo-api-cookbook.md) | Real request/response shapes and normalization targets. |
| 06 | [Runbook](06-runbook.md) | Weekly operations and failure playbooks. For after it's built. |
| 07 | [Testing & validation](07-testing-and-validation.md) | What "correct" means and how to verify it. |
| 08 | [Glossary](08-glossary.md) | TPRR, PROE, VORP, copula, and the rest. |
| 09 | [Decision log](09-decision-log.md) | Why each choice was made and when to revisit it. |

---

## Reading paths

**Building it:** implementation plan → data dictionary → Yahoo cookbook → API contract → model spec → screens

**Understanding the design:** implementation plan → decision log → model spec

**Operating it:** runbook → data dictionary (for the manual SQL)

**Debugging:** runbook §3 → data dictionary → testing plan §10

**Coming back after months away:** decision log → runbook

---

## The core ideas

Four decisions distinguish this from a generic fantasy tool.

**1. Win probability, not projected points.** Every recommendation is evaluated by how it changes your chance of winning the matchup. These diverge exactly when it matters — as a heavy underdog the correct play is the high-variance one even with a lower mean. See ADR-008.

**2. Distributions, not point estimates.** Two players projected for 11.0 points can be completely different plays. Storing p10 through p90 and simulating from them is what makes the win-probability framing possible. See model spec §4.

**3. Volume over efficiency.** Snap share autocorrelates at 0.85 week to week; touchdown rate at 0.09. Model what's predictable and regress the rest to positional means. See model spec §2.

**4. Honest uncertainty.** Sample sizes on every tendency. Close calls flagged rather than resolved arbitrarily. A diagnostics page that can tell you the model is bad. A pre-committed rule to use consensus rankings if the model loses to them. See ADR-015.

---

## Build sequence

| Phase | Focus | Milestone |
|---|---|---|
| 1 | Foundations, ingestion, crosswalk | Your roster joined to real snap-count data |
| 2 | Projection layers 0–3 | Projections that beat baseline, provably |
| 3 | Simulation, start/sit | The app answers the weekly question |
| 4 | Playoff odds, waivers, trades | Advice between games, not just Sunday |
| 5 | Draft board, opponent tendencies | Ready before your draft |
| 6 | Live scoring | Nice to have |

Full detail in the implementation plan, §13.

---

## Do these first

Ordered by how expensive they are to retrofit.

1. **Snapshot your Yahoo draft history.** Before anything else. If your commissioner recreates the league rather than renewing it, that history is gone — and it's the entire basis of the opponent modeling.

2. **Set up the storage split before writing ingestion.** Writing the pipeline against Postgres and migrating to Parquet later means rewriting every job. Implementation plan §5.

3. **Deploy a hello-world in week 1.** Your Yahoo OAuth callback must point at the real domain. Discovering a Traefik or bind-mount problem in week 6 is much worse than in week 1.

4. **Use batched `COPY`, never row-by-row inserts.** With Postgres across the network, a per-row pipeline works fine on 50 test rows and collapses on 30,000 real ones.

5. **Write the six Tier 1 invariant tests.** Spread sign, bye guard, unit conventions, defense rank direction, reach delta sign, scoring parse. These catch the bugs that produce plausible-looking wrong answers. Testing plan §2.

6. **Build the archive job in Phase 2, not later.** Without it you hit the Neon storage ceiling around week 10 — exactly when you don't want to be doing emergency cleanup.

---

## Conventions

These recur everywhere and inverting one silently corrupts everything downstream:

| Concept | Convention |
|---|---|
| Rates and shares | Fraction in [0,1], never percentage |
| Adjustments | Multiplier centered on 1.0 |
| Spread | Home perspective; negative = home favored |
| Defense rank | 1 = allows most points = best matchup |
| `reach_delta` | Positive = drafted earlier than ADP |
| Timestamps | `timestamptz`, UTC |
| Fantasy points | `numeric(6,2)`, never float |

Full table in the data dictionary, Part 3.

---

## Known limitations

Written down so they don't get rediscovered in October:

- **Touchdown regression is unmodeled.** TD rate is near-noise week to week.
- **Coaching changes are invisible** for 4–6 weeks.
- **Rookie projections are weak** through roughly week 6.
- **DST projections are barely better than random** (R² ≈ 0.05). Stream on schedule.
- **Redistribution weights are league-average**, not team-specific.
- **Vegas lines move.** Tuesday projections use Tuesday's line; re-run Sunday.

Model spec §10 has the full list.

---

## When to stop trusting the model

Pre-committed failure conditions, recorded now so they're harder to rationalize away later:

1. MAE worse than baseline for 3+ consecutive weeks
2. Win-probability calibration off by more than 10%
3. Losing to FantasyPros consensus over a full season
4. More than 50 unmatched players in the crosswalk
5. Systematic position bias above 20%

Response to #3 is to use consensus. That's not failure — it's the correct response to evidence. Runbook §7.
