# Architecture Decision Log

Why each significant choice was made, and what would justify revisiting it.

**Purpose:** in month four you will wonder why you did something. This is the answer. Each entry records the decision, the alternatives, the reasoning, and — most usefully — the conditions under which you should change your mind.

---

## ADR-001 — Next.js for the UI, not Flutter

**Status:** accepted

**Context:** Flutter was considered for a single codebase covering web and mobile.

**Decision:** Next.js (App Router) for the web UI.

**Reasoning:**

- Flutter web renders to canvas, so text selection, accessibility, and SEO are all weaker.
- The charting ecosystem is thinner: `fl_chart` and `syncfusion_flutter_charts` don't match Recharts/D3 for dense interactive plots.
- The draft board is a large sortable data grid — precisely Flutter web's weakest case.
- D3 and Recharts require a DOM and cannot run in Flutter. Workarounds (webview embedding, `dart:js_interop`, `CustomPainter`) all cost more than they return.

**Alternatives:** Flutter (mobile-native, weaker charts); React Native (same charting problem); plain SPA (loses server components).

**Revisit if:** a true mobile-native app becomes the priority. In that case keep the API framework-agnostic and add a Flutter client against the same endpoints — nothing in this architecture prevents that.

---

## ADR-002 — Yahoo as the league data source

**Status:** accepted (forced)

**Context:** Sleeper's API is free and unauthenticated; ESPN's is undocumented cookie auth; Yahoo uses OAuth2.

**Decision:** Yahoo, because that's where the leagues are.

**Consequences:**

- OAuth2 with hourly token refresh
- Hostile JSON requiring a dedicated normalization layer
- Yahoo-specific player IDs requiring a crosswalk
- Game keys changing yearly

**Reasoning:** not really a decision. The league data lives where the league lives.

**Revisit if:** you move leagues. Sleeper would remove maybe a week of ingestion work.

---

## ADR-003 — NFL before NBA

**Status:** accepted

**Context:** the original request covered both sports.

**Decision:** NFL first, NBA later or never.

**Reasoning:**

- The projection models share almost no code — weekly snap counts and game scripts versus daily minutes projections and rest management.
- Building both at once roughly doubles the work before anything is usable.
- Football's weekly cadence is more forgiving than basketball's daily one.

**Revisit if:** NFL is complete and stable. Reuse the ingestion, crosswalk, and simulation scaffolding; replace the projection layer entirely.

---

## ADR-004 — Split Python service rather than TypeScript-only

**Status:** accepted

**Decision:** FastAPI service for projections and simulation; Next.js for UI and league state.

**Reasoning:** `nfl_data_py`, pandas, numpy, scikit-learn, and DuckDB are all Python-native. Reimplementing in TypeScript costs more than running a second container.

**Alternatives:** all-TypeScript (loses the ecosystem); Python-only with Jinja templates (worse UI); serverless functions (cold starts on 10k-iteration sims).

**Revisit if:** never, realistically. This is the standard split for a reason.

---

## ADR-005 — Neon Postgres rather than self-hosted

**Status:** accepted

**Context:** the VPS has 100 GB and already runs Postgres-capable infrastructure.

**Decision:** Neon's free tier for the hot tier.

**Reasoning:**

- The VPS runs other workloads; isolating this app's data limits blast radius.
- No Postgres administration.
- Managed backups and point-in-time recovery.

**Costs accepted:**

- 0.5 GB storage ceiling, forcing the tiered architecture (ADR-006)
- ~190 compute-hours/month
- Cross-network write latency, requiring batched `COPY`
- ~500ms cold start after autosuspend

**Revisit if:** compute-hours become binding — most likely from draft-day polling. Migration is a `pg_dump`/`pg_restore` and a connection-string change, provided all DB access stays behind Drizzle and one connection module.

---

## ADR-006 — Two-tier storage: Postgres hot, Parquet cold

**Status:** accepted

**Context:** raw play-by-play is 200–400 MB per season uncompressed. Six seasons vastly exceeds Neon's free tier.

**Decision:** Postgres holds only what the app queries per-request. Everything analytical lives in Parquet on the VPS.

**Split rule:** if Next.js renders it, Postgres. If only Python reads it, Parquet.

**Reasoning:**

- PBP is scanned in bulk during aggregation, never queried per-request — a columnar workload.
- Keeps Postgres at 60–100 MB, well under the ceiling.
- Parquet compresses PBP roughly 3:1.

**Costs accepted:** two stores to reason about; cross-store joins must happen in application code; archive job is now load-bearing.

**Revisit if:** you self-host Postgres with disk to spare. Even then the columnar advantage for backtests is real.

---

## ADR-007 — DuckDB rather than SQLite for the cold tier

**Status:** accepted

**Context:** a local second store was wanted for analytical data.

**Decision:** DuckDB querying Parquet directly.

**Reasoning:**

- SQLite is row-oriented — computing a target-share trend reads every column you don't need.
- DuckDB reads Parquet with no import step.
- Roughly 10–100× faster for this query shape.
- The aggregation pipeline becomes SQL rather than pandas load-and-groupby: faster and far less memory-hungry.

**Alternatives:** SQLite (wrong shape); ClickHouse (server process, overkill); pandas alone (memory-bound on multi-season scans).

**Revisit if:** never expected. DuckDB is the right tool.

---

## ADR-008 — Win probability, not projected points

**Status:** accepted — **the most important decision here**

**Context:** most fantasy tools rank by projected points.

**Decision:** all start/sit and roster advice is evaluated by change in win probability.

**Reasoning:**

- The actual goal is winning the matchup, not maximizing expected points.
- These diverge exactly when it matters. As a heavy underdog, the correct play is the high-variance one even with a lower mean; as a heavy favorite, the reverse.
- This is the app's main differentiator over free tools.

**Costs accepted:** requires full distributions (Layer 3) and simulation (Layer 4), neither of which improves MAE. They improve *decisions*, which must be measured differently.

**Revisit if:** `test_distribution_beats_mean_for_startsit` fails over a full season. Then the complexity isn't earning itself.

---

## ADR-009 — Correlated simulation, not independent sampling

**Status:** accepted

**Decision:** Gaussian copula with a per-game common factor.

**Reasoning:**

- Independent sampling understates lineup variance by 10–15%.
- QB–WR1 stacks are strongly positively correlated (ρ ≈ 0.55); same-team RBs negatively (ρ ≈ −0.35).
- Miscalibrated variance means miscalibrated win probabilities, which undermines every recommendation.

**Costs accepted:** more complex sim; correlation matrix needs maintenance.

**Revisit if:** calibration tests pass without it. Unlikely — the effect is large.

---

## ADR-010 — Trade suggestions as conversation starters

**Status:** accepted

**Context:** a trade engine can compute mutual gain, but not the counterparty's valuation.

**Decision:** present ranked suggestions with both sides' odds shown, explicitly framed as conversation starters rather than evaluations.

**Reasoning:**

- The model can't see how another manager values his players. A mathematically win-win trade still gets rejected if he thinks his RB2 is a league-winner.
- Draft tendencies partially mitigate this — someone who overdrafts WRs probably overvalues them in trade — but it's crude.
- Overstating confidence here would be the app's most misleading feature.

**Costs accepted:** less satisfying than a definitive recommendation. Correct anyway.

---

## ADR-011 — Sample-size suppression on manager tendencies

**Status:** accepted

**Context:** three seasons gives roughly 45 picks per manager.

**Decision:** display `n` on every metric; suppress anything below n=10; show distributions rather than means where possible.

**Reasoning:**

- 45 picks is enough to spot a strong tendency, nowhere near enough for confidence intervals.
- A manager who took QB in rounds 2, 9, and 11 has no tendency despite a mean of 7.3. The histogram shows this; the mean hides it.
- Overstating confidence here leads to bad draft decisions.

**Revisit if:** you accumulate 6+ seasons. Even then, keep the sample sizes visible.

---

## ADR-012 — ESPN for live data, deferred to last

**Status:** accepted

**Context:** neither Yahoo nor nflverse provides good real-time in-game data.

**Decision:** ESPN's undocumented endpoints, built last, degrading gracefully.

**Reasoning:**

- Free, no auth, ~15–30s latency, stable for years in practice.
- SportsDataIO is hundreds per month; Sportradar is enterprise-priced.
- **Live data improves no decision.** Once kickoff happens, start/sit is locked. It's a display feature.
- Yahoo's player status handles inactives adequately.

**Costs accepted:** unofficial API that will break eventually. Wrapped behind an interface; failure degrades to a stale timestamp.

**Revisit if:** it breaks and isn't quickly fixable. Delete the feature; nothing depends on it.

---

## ADR-013 — Dokploy for deployment

**Status:** accepted

**Decision:** single Dokploy Compose application with Traefik ingress.

**Reasoning:**

- Docker Compose underneath, so the architecture maps directly.
- Traefik handles TLS automatically — no Caddy, nginx, or certbot.
- Built-in scheduled jobs survive redeploys, unlike host cron.
- Already running on the VPS.

**Costs accepted:** auto-deploy must be disabled during draft season, since a redeploy mid-draft kills the live board.

**Key detail:** bind-mount `/srv/fantasy` rather than using a named volume. Deleting an app in Dokploy can take named volumes with it, and re-downloading six seasons of PBP is a lost afternoon.

---

## ADR-014 — Layer gates on model complexity

**Status:** accepted

**Decision:** each projection layer ships only if it beats the previous on held-out data. Layers 3–4 are exempt from MAE gates but must improve decision quality.

**Reasoning:**

- The gap between a naive baseline and a good model is smaller than intuition suggests.
- Most of the gain comes from volume prediction and opponent adjustment (Layers 1–2).
- Without gates, complexity accretes without evidence.
- Layers 3–4 genuinely don't improve MAE — that's expected, not failure. They improve decisions, measured by start/sit accuracy and win-probability calibration.

**Gates:** Layer 0→1 ≥6%, Layer 1→2 ≥3%, Layers 3–4 measured on decision quality.

---

## ADR-015 — Consensus as the honesty benchmark

**Status:** accepted

**Decision:** continuously compare against FantasyPros consensus. If we lose over a full season, use consensus.

**Reasoning:**

- Consensus is a strong baseline aggregating many expert projections.
- Without an external benchmark it's easy to convince yourself a model works.
- Deciding the failure response *now*, before there's sunk cost, is the whole point.

**This is deliberately uncomfortable.** It's the test most likely to be quietly dropped, which is exactly why it's recorded here.

---

## ADR-016 — Build start/sit before the draft board

**Status:** accepted

**Decision:** Phase 3 is start/sit; Phase 5 is draft.

**Reasoning:**

- Start/sit is used 17 weeks a year; the draft board one afternoon.
- Start/sit machinery (distributions, simulation) is reused by waivers, trades, and playoff odds.
- The draft board depends on season-long projections, which are harder and less certain than weekly ones.

**Exception:** if the draft is imminent when you start building, swap them. Utility beats elegance.

---

## Template for new entries

```markdown
## ADR-0NN — Title

**Status:** proposed | accepted | superseded by ADR-0MM

**Context:** what situation forced a choice

**Decision:** what was chosen

**Reasoning:** why, with specifics

**Alternatives:** what else was considered and why it lost

**Costs accepted:** what this makes worse

**Revisit if:** the conditions that should change your mind
```

**The "revisit if" line is the most valuable part.** A decision without stated reversal conditions becomes dogma.
