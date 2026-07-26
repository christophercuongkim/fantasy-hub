# Fantasy Football Analytics App — Implementation Plan

**Scope:** NFL first. Personal-use web app for draft assistance, start/sit decisions, and supporting analytics.
**Stack:** Next.js (App Router) + TypeScript, PostgreSQL, Python projection service, Recharts.
**League data:** Yahoo Fantasy Sports API.

---

## 1. Architecture

```
                    ╔═══════════ VPS (100 GB) ═══════════╗
                    ║                                    ║
┌───────────────────╫──────────────────────┐             ║
│  Next.js app (App Router, TS)            │             ║
│  - Draft board / start-sit / analytics   │             ║
│  - Server Actions + Route Handlers       │             ║
└────────────────┬──╫──────────────────────┘             ║
                 │  ║                                    ║
      ┌──────────┘  ║       ┌────────────────────────┐   ║
      │             ║       │ Python service (FastAPI)│  ║
      │             ║       │ - projections           │  ║
      │             ║       │ - Monte Carlo sim       │  ║
      │             ║       │ - usage models          │  ║
      │             ║       └───────┬─────────────────┘  ║
      │             ║               │                    ║
      │  (batched   ║       ┌───────▼─────────────────┐  ║
      │   COPY)     ║       │ DuckDB → Parquet        │  ║
      │             ║       │ /srv/fantasy/           │  ║
      │             ║       │ - raw pbp (~3 GB)       │  ║
      │             ║       │ - weekly aggregates     │  ║
      │             ║       │ - projection archive    │  ║
      │             ║       │ - api response archive  │  ║
      │             ║       └───────┬─────────────────┘  ║
      │             ╚═══════════════╪════════════════════╝
      │                             │
┌─────▼──────────────┐    ┌─────────▼────────────┐
│ Neon Postgres      │    │ nfl_data_py          │
│ (free, ~0.5 GB)    │    │ (pbp, snaps, targets)│
│ HOT TIER           │    └──────────────────────┘
│ - league state     │
│ - current proj.    │    ┌──────────────────────┐
│ - players/crosswalk│    │ Yahoo Fantasy API    │
│ - manager profiles │    │ (OAuth2)             │
└────────────────────┘    │ league state         │
                          └──────────────────────┘
                          ┌──────────────────────┐
                          │ ESPN live endpoints  │
                          │ (unofficial, no auth)│
                          └──────────────────────┘
```

**Why split Python out:** `nfl_data_py`, `pandas`, `numpy`, `scikit-learn`, and simulation code all live naturally in Python. Fighting to do this in TypeScript costs more than running a second process. Next.js and the Python service ship as one Dokploy Compose application and talk over the internal Docker network by service name.

**Why the database is remote:** the VPS runs other workloads, so keeping Postgres managed at Neon isolates the app's data from anything else on the box. The cost is cross-network write latency — see §5.5 for the batching this requires.

**Deployment:** Dokploy on the VPS — one Compose application containing Next.js + FastAPI, with Traefik handling TLS. Neon for Postgres. Parquet bind-mounted from `/srv/fantasy` on the host. See §14.

---

## 2. Data sources

Three sources, three distinct jobs. No single API does all of this well.

| Source | Provides | Auth | Notes |
|---|---|---|---|
| **Yahoo Fantasy API** | League settings, rosters, matchups, transactions, draft results, Yahoo ADP/ranks | OAuth2 | Rate limits undocumented; be conservative |
| **`nfl_data_py`** | Play-by-play, weekly stats, snap counts, target share, roster, injuries, depth charts | None | Wraps `nflverse` data; the analytical backbone |
| **`nfl_data_py.import_schedules`** | Schedule, Vegas lines, game totals | None | Vegas lines drive game-script modeling |
| **ESPN live endpoints** | In-game scoring, live box scores, drive data, inactives | None | Unofficial; ~15–30s latency |
| **FantasyPros** (optional) | Consensus ECR, ADP | Scrape or paid API | Useful as a projection baseline to beat |

**Division of labor:**

- **Yahoo** — league state of record. Scoring settings, rosters, matchups, free agents, draft history. No substitute exists.
- **`nfl_data_py`** — the analytical backbone. Every projection is built on this. Refreshes once daily (Tuesday mornings for the completed week), which is fine because none of it needs to be live.
- **ESPN** — in-game scoring and Sunday-morning inactives only.

### 2.1 On real-time data

**Live data does not improve projections.** Once a game kicks off, the start/sit decision is already locked. A live feed is a *display* feature — a scoreboard, plus catching inactive news before the 1pm lock. Useful, but not a modeling input. If scope needs cutting, cut this first.

ESPN's undocumented endpoints are the pragmatic choice:

```
https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard
https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event={id}
```

Free, no key, no auth, ~15–30 second latency, live box scores and player stats. Being unofficial, it can change without notice — wrap it behind an interface and degrade gracefully when it breaks. It has been stable for years in practice.

**Alternatives considered:**

| Option | Verdict |
|---|---|
| **SportsDataIO** | Proper docs and SLA, but live NFL tier runs into the hundreds per month. Overkill for personal use. |
| **Sportradar** | Enterprise-grade and excellent; trial keys are heavily throttled and pricing is enterprise. No. |
| **nflverse live PBP** | Exists, but lags several minutes and gets flaky under Sunday load. Fine for Tuesday refresh, not for live. |

Yahoo's own player status handles inactives reasonably well, so ESPN is a nice-to-have rather than a requirement.

---

## 3. Yahoo API integration

### 3.1 One-time setup

1. Register an app at `developer.yahoo.com/apps/create`
2. Set redirect URI to `https://localhost:3000/api/auth/yahoo/callback` (Yahoo requires HTTPS; use `mkcert` for a local cert)
3. Request **Fantasy Sports read** permission
4. Store `YAHOO_CLIENT_ID` / `YAHOO_CLIENT_SECRET` in `.env.local`

### 3.2 Token flow

```
Browser consent (once)
    → authorization code
    → exchange for access_token (1hr) + refresh_token (long-lived)
    → store refresh_token encrypted in DB
    → server refreshes access_token on demand
```

Write a small `YahooClient` class that transparently refreshes on 401 and retries once. Do not let token handling leak into feature code.

### 3.3 Endpoint reference

Base: `https://fantasysports.yahooapis.com/fantasy/v2`
**Always append `?format=json`.**

| Purpose | Endpoint |
|---|---|
| Your leagues | `/users;use_login=1/games;game_keys=nfl/leagues` |
| League settings (scoring!) | `/league/{league_key}/settings` |
| Your roster | `/team/{team_key}/roster;week={n}` |
| Weekly matchup | `/team/{team_key}/matchups;weeks={n}` |
| Free agents | `/league/{league_key}/players;status=FA;count=50;start={n}` |
| Draft results | `/league/{league_key}/draftresults` |
| Player stats | `/league/{league_key}/players;player_keys={k}/stats;type=week;week={n}` |

`league_key` = `{game_key}.l.{league_id}` — e.g. `461.l.123456`. Fetch the current NFL game key dynamically from `/game/nfl` rather than hardcoding it.

### 3.4 The JSON is hostile

Yahoo returns objects keyed by stringified integers with a sibling `count` field, and interleaves metadata arrays with data arrays. Example shape:

```json
{"fantasy_content": {"league": [{...meta...}, {"players": {
  "0": {"player": [[{...name...},{...team...}], {...stats...}]},
  "1": {"player": [...]},
  "count": 2
}}]}}
```

**Write a normalization module early.** One function per resource type that flattens Yahoo's shape into clean TypeScript interfaces. Test it against saved fixture JSON so scoring changes don't silently break parsing.

### 3.5 Scoring settings matter enormously

Pull `/league/{key}/settings` and persist the full stat-category → point-value map. Every projection must be computed against *your* league's scoring, not generic PPR. Half-PPR vs. full-PPR reorders the entire RB/WR board. TE premium changes it again.

---

## 4. Database schema

Tables are split across two stores — see §5 for the storage architecture and why. `[NEON]` means it lives in Postgres; `[VPS]` means Parquet on disk, queried with DuckDB.

```sql
-- Identity  [NEON] — small, joined on every request
players            (id, gsis_id, pfr_id, yahoo_id, sleeper_id, full_name,
                    position, team, birthdate, draft_year)
id_crosswalk_log   (source, source_id, player_id, method, confidence, verified_at)

-- League state  [NEON] — hot, changes weekly, always queried live
leagues            (id, yahoo_league_key, name, season, scoring_json,
                    roster_positions_json)
league_teams       (id, league_id, yahoo_team_key, name, is_mine)
rosters            (league_team_id, week, player_id, slot)
matchups           (league_id, week, team_a, team_b)

-- Opponent modeling  [NEON] — tiny (one league, a few seasons)
draft_picks        (league_id, season, round, pick, overall,
                    league_team_id, player_id, adp_at_time, reach_delta)
manager_profiles   (league_team_id, season, metric, value, sample_size)
trade_history      (league_id, season, week, team_a, team_b, players_json)

-- Projections  [NEON, current season only] — archived to VPS after each week
projections        (player_id, season, week, mean, p20, p50, p80, sd,
                    model_version, generated_at)
proj_components    (projection_id, component, value)  -- for explainability

-- Current-week context  [NEON] — needed per-request by the start/sit UI
schedule           (season, week, home, away, spread, total, roof, surface)
injuries           (player_id, season, week, status, practice_status)

-- Historical stats  [VPS/Parquet] — bulk analytical data, never queried per-request
stats_weekly       (player_id, season, week, snaps, snap_pct, targets,
                    target_share, air_yards, adot, carries, rz_touches,
                    routes_run, tprr, fantasy_points_ppr, ...)
team_weekly        (team, season, week, plays, pace, proe, pass_rate,
                    points_for, points_against)
defense_vs_pos     (team, season, week, position, points_allowed,
                    points_allowed_rank, targets_allowed, ...)
pbp_raw            -- full nflverse play-by-play, partitioned by season
api_archive        -- raw Yahoo/ESPN responses, for replay and debugging

-- Live (ESPN)  [NEON, ephemeral] — truncated after each week finalizes
live_player_stats  (player_id, season, week, stat_json, fetched_at)
```

**Note the `proj_components` table.** Storing the decomposition of every projection is what makes the "why" explanations possible later. Add it now; retrofitting is painful.

**The split rule:** if the Next.js app queries it to render a page, it's in Postgres. If only the Python service reads it, during projection runs or backtests, it's Parquet on the VPS.

---

## 5. Storage architecture

Two stores, split by access pattern rather than by data type.

| Tier | Where | Contents | Size |
|---|---|---|---|
| **Hot** | Neon Postgres (free) | League state, current-season projections, crosswalk, manager profiles | ~60–100 MB |
| **Warm/Cold** | VPS — Parquet + DuckDB | Historical weekly stats, raw PBP, backtest inputs, API archive | ~3–5 GB |

### 5.1 Why not put everything in Postgres

Raw nflverse play-by-play is ~50k plays × ~380 columns per season — 200–400 MB uncompressed *per season*. Six seasons would exceed Neon's free tier several times over.

It also doesn't belong there. PBP is scanned in bulk during aggregation and backtests, never queried per-request. That's a columnar workload, and Postgres is row-oriented.

### 5.2 Why DuckDB rather than SQLite

SQLite is the reflexive choice for a local second store, but it's row-oriented too — computing a target-share trend means reading every column you don't need. DuckDB is columnar, embedded (no server process), and queries Parquet files directly with no import step:

```sql
SELECT receiver_player_id, week, count(*) AS targets
FROM 'pbp/season=2024/*.parquet'
WHERE pass_attempt = 1
GROUP BY 1, 2;
```

Expect roughly 10–100× SQLite's speed on this query shape. Your aggregation pipeline becomes DuckDB SQL over Parquet instead of pandas load-and-groupby — faster and far less memory-hungry.

### 5.3 Layout on the VPS

```
/srv/fantasy/
  pbp/season=2019/…  …  season=2025/     # raw play-by-play
  weekly/season=2019/…                    # derived player-week aggregates
  team/season=2019/…                      # team-week context
  projections_archive/season=2025/week=03/
  api_archive/yahoo/  api_archive/espn/
```

Partition by season (and week where it helps). Hive-style partitioning lets DuckDB prune whole directories rather than scanning everything. Snappy compression is the sensible default — zstd if you want smaller files and don't mind slower writes.

### 5.4 Keeping Postgres under 0.5 GB

Storage isn't the binding constraint if you enforce these:

- **Current season only.** Archive `projections` and `proj_components` to Parquet once a week finalizes. `proj_components` is the largest table by row count — ~1,800 players × 10 components × 18 weeks — and you only need explanations for the live week.
- **Truncate `live_player_stats`** after each week goes final. Raw JSON accumulates fast and has zero analytical value once results are settled.
- **Cap `api_archive` in Postgres at zero** — it goes straight to the VPS. Useful for replay and debugging, useless to the app.
- **No raw PBP in Postgres, ever.** Aggregate in DuckDB, write only the results.

Steady-state lands around 60–100 MB, leaving real margin.

### 5.5 The two constraints that actually bite

**Compute-hours, not storage.** Neon's free tier gives ~190 compute-hours/month with autosuspend after 5 minutes idle. Casual browsing is fine, but ingestion jobs, backtest runs, and live-draft polling every 10 seconds for three hours all wake the compute. Draft day alone might burn 3–4 hours. Probably fine — but instrument it in month one rather than discovering the ceiling in October.

Mitigations if it gets tight: run backtests entirely in DuckDB (no Postgres connection at all), and batch ingestion into a single connection per job rather than one per table.

**Cross-network write latency.** DuckDB on the VPS and Postgres at Neon means every projection run writes over the internet. Fine for ~30k rows written weekly *as a batch*; painful if you write row-by-row.

Use `COPY` from a CSV/binary buffer rather than per-row `INSERT`:

```python
buf = io.StringIO()
df.to_csv(buf, index=False, header=False)
buf.seek(0)
cur.copy_expert("COPY projections (...) FROM STDIN WITH CSV", buf)
```

Design for this now — retrofitting batched writes after building a row-at-a-time pipeline is an unpleasant afternoon.

### 5.6 If you later change your mind

Nothing here locks you in. If Neon's compute cap becomes annoying, adding a Postgres service to the Dokploy Compose file (or using Dokploy's one-click Postgres) is a `pg_dump`/`pg_restore` and a connection-string change. Keep all DB access behind Drizzle and a single connection module so the switch stays one-line.

---

## 6. The ID crosswalk (do this first)

This is the single biggest time sink in the project. Yahoo uses its own player IDs; `nfl_data_py` uses GSIS and PFR IDs.

**Approach:**

1. `nfl_data_py.import_ids()` gives a ready-made crosswalk across GSIS/PFR/ESPN/Sleeper/Yahoo. **Start here** — it covers most of the work for free.
2. For gaps, fuzzy-match on normalized name + position + team:
   - Strip suffixes (Jr., III), punctuation, casing
   - `rapidfuzz.token_sort_ratio` ≥ 90 → auto-accept
   - 80–90 → queue for manual review
3. Build a tiny admin page listing unmatched players with candidate suggestions and a one-click confirm.
4. Persist every match with method and confidence in `id_crosswalk_log` so you can audit later.

**Expect ~95% automatic coverage.** The failures cluster in rookies, practice-squad callups, and duplicate names. Manual overrides for maybe 20–30 players per season is normal.

---

## 7. Projection model

Build in layers. Ship each before starting the next, and backtest to confirm each layer actually improves on the last.

### Layer 0 — Baseline
Exponentially weighted average of prior fantasy points, λ ≈ 0.85, minimum 3 games. Rookies fall back to positional average by draft capital. **This is your benchmark; a fancy model that loses to this is a fancy model you should delete.**

### Layer 1 — Volume model
Fantasy production is mostly volume. Model volume directly, not points:

- **RB:** carries + targets, driven by snap share and game script
- **WR/TE:** routes run × targets-per-route-run (TPRR is stickier than raw target share)
- **QB:** pass attempts + designed rushes

Predict volume first, then points-per-opportunity separately. PPO is noisier and regresses harder toward positional means.

### Layer 2 — Context adjustment

| Factor | Signal | Effect |
|---|---|---|
| Opponent | Defense vs. position, pace-adjusted | ±10–15% |
| Game script | Vegas spread + total | Big for RB rush/receive split |
| Pace | Team plays/game, PROE | Volume multiplier |
| Injuries | Teammate absences | Vacated targets/carries redistribute |
| Home/away, weather | Schedule + roof/surface | Small, mostly for kickers and deep passing |

**Vacated opportunity is the highest-leverage signal in the whole model.** When a team's WR1 is ruled out, the WR2's target share jumps predictably. Model this explicitly.

### Layer 3 — Distributions

Point estimates are nearly useless for start/sit. Produce a full distribution per player:

- Fit a gamma or lognormal to historical residuals by position and projected volume tier
- Output p20 / p50 / p80 alongside the mean
- WRs have far fatter tails than RBs — a boom/bust WR and a steady RB with identical means are completely different plays

### Layer 4 — Monte Carlo matchup sim

The real payoff:

1. Sample each player's score from their distribution
2. Sum your lineup, sum the opponent's projected lineup
3. Repeat 10,000×
4. Report **win probability**, not projected points

Then evaluate each start/sit choice by its marginal effect on win probability. This is what makes correct-but-counterintuitive advice possible: when you're a heavy underdog, the right play is the high-variance one even though it has a lower mean.

**Correlation matters.** QB and his WR1 are positively correlated (stack effect); RB and opposing defense negatively. Use a copula or simply add a shared game-level factor to each player's draw. Ignoring correlation systematically understates variance.

---

## 8. Draft assistant

### Value model

1. Project full-season points for every player under **your league's scoring**
2. Compute replacement level per position from your league's roster requirements
   - 12-team, 1QB/2RB/2WR/1TE/1FLEX → replacement RB is roughly RB30
3. **VORP** = projected points − replacement baseline
4. Convert to auction dollars: `$ = (VORP / total_VORP) × total_budget`

### Live draft mode

- Sync drafted players from `/league/{key}/draftresults`, polling every ~10s during the draft
- Recompute best-available VORP after each pick
- Show **positional run detection** — "4 RBs gone in the last 6 picks"
- Flag **ADP value** — players falling well past their ADP
- **Roster construction warnings** — "you have 5 WRs and no TE, and only 3 startable TEs remain"

### Tier-based board

Cluster players into tiers by projection gaps (k-means on projected points within position, or just a gap-detection threshold). Drafting by tier beats drafting by rank — the decision that matters is "is this the last player in this tier?"

---

## 9. Opponent modeling

Yahoo's `/league/{key}/draftresults` returns every pick from every season your league has existed. Pull all available history — this is the raw material for both draft strategy and trade targeting.

### 8.1 Manager tendency metrics

Per manager, per season and pooled:

| Metric | Computation | Use |
|---|---|---|
| **Positional timing** | Mean round of first QB/RB/WR/TE/K/DST | Predict when they'll take the position you want |
| **Reach delta** | Mean (ADP − pick number), positive = reaches | Calibrate whether you can wait on a player |
| **Positional lean** | Share of picks by position vs. league mean | Drives trade targeting |
| **Team bias** | Overrepresentation of a single NFL team | Homer detection |
| **Rookie appetite** | Share of picks spent on rookies | Predicts draft-day surprises |
| **Bye-week negligence** | Count of stacked byes at a position | Weak-manager signal |
| **Late-round K/DST** | Round of first K/DST | Proxy for general sophistication |

### 8.2 Sample size honesty

12 managers × ~15 rounds × 3 seasons ≈ **45 picks per manager.** That is enough to see a strong tendency and nowhere near enough for confidence intervals worth printing.

**Rules:**
- Always display sample size next to every metric
- Label these *descriptive tendencies*, never predictions
- Suppress any metric with n < 10
- Show the spread, not just the mean — a manager who took QB in rounds 2, 9, and 11 has no "tendency" despite a mean of 7.3

### 8.3 Live draft application

This is where tendencies pay off. During the draft, for each manager picking between now and your next pick, show their positional lean and reach delta:

> **Next 4 picks before yours:**
> Manager C — takes RB in round 3 in 3 of 4 past drafts (n=4)
> Manager F — reaches +6.2 spots vs ADP on average (n=51)

That changes whether you reach for a player or wait a round. Wire it into the live draft board from §8, not a separate page.

---

## 10. Trades and waivers

Both run on the same machinery as start/sit: rest-of-season projections plus the Monte Carlo sim, evaluated by **change in playoff odds** rather than change in projected points.

### 9.1 Waiver pickups (build this first — it's the easy one)

No counterparty, so no valuation problem:

1. For each free agent, simulate replacing your weakest startable player at that position
2. Rank by marginal playoff-odds gain over the remaining season
3. Weight by schedule lookahead — a streaming DST with three soft matchups beats a better DST with three brutal ones
4. Flag handcuffs and contingent value separately (a backup RB's value is conditional, not additive)

### 9.2 Trade finder

The mechanics are straightforward:

1. Enumerate plausible 1-for-1 and 2-for-1 packages against each opponent's roster
2. Simulate rest-of-season playoff odds for **both** teams, before and after
3. Keep only trades where both sides gain — the mutual-gain set
4. Rank by your gain; display their gain alongside

Mutual gains genuinely exist, and they come from roster construction imbalance. If you have four startable RBs and two WRs while an opponent has the reverse, a swap raises both teams' expected wins. That's not a trick; it's the whole basis of trading.

### 9.3 The valuation problem — be honest about this

**The model cannot see how the other manager values his players.** A mathematically win-win trade still gets rejected if he thinks his RB2 is a league-winner. No amount of simulation fixes this.

Partial mitigation via §9 tendencies: a manager who consistently overdrafts WRs probably overvalues them in trades, so target his RBs and offer WRs. Crude, but better than assuming uniform valuations. Also weight by positional lean — offering someone their favorite position at a slight mathematical discount to you is often the trade that actually gets accepted.

**Frame the output accordingly.** Not "make this trade" but a ranked list of conversation starters:

> **Target: Manager D** — RB surplus (4 startable), WR need (2)
> Offer your WR2 for his RB3
> Your playoff odds: 58% → 64% (+6)
> His playoff odds: 41% → 45% (+4)
> Note: Manager D drafts WR ~1.5 rounds ahead of ADP (n=47) — likely receptive

### 9.4 Guardrails

- Cap suggestions at ~10 per week or it becomes noise
- Exclude trades involving players on bye in the next two weeks
- Exclude injured players from *both* sides unless explicitly included
- Never suggest a trade with the same manager twice in one week
- Show the swing in both directions — if your gain is +8 and theirs is +0.5, that's a trade they'll reject and you should know before sending it

---

## 11. Start/sit engine

**Inputs:** your roster, opponent's projected lineup, current week, league scoring, roster slot rules.

**Output, in priority order:**

1. **Optimal lineup** by win probability, not by projected points
2. **Marginal win probability** for each swap under consideration
3. **Explanation** for each recommendation
4. **Confidence** — flag when two options are within noise of each other

### Explanations

Every recommendation surfaces its drivers from `proj_components`:

> **Start Player A over Player B** (+4.2% win probability)
> - A projects 14.8 pts (p20 8.1 / p80 22.4) vs B's 13.9 (p20 10.2 / p80 18.1)
> - A faces a defense allowing the 3rd-most points to WRs
> - A's target share up to 27% over the last 3 weeks (from 19%)
> - You're a 6-point underdog this week → the higher-ceiling play is correct

That last line is the differentiator. Generic sites give you projections; the underdog/favorite variance adjustment is what makes this yours.

### Waiver / streaming

Same engine pointed at free agents. For DST and K, schedule lookahead over the next 3 weeks matters more than current-week projection.

---

## 12. Analytics pages

**Player page**
- Rolling snap %, target share, TPRR, air yards, aDOT (5/10-game windows)
- Change-point detection to flag genuine role changes vs. noise
- Game log with opponent adjustment applied
- Projection vs. actual, historically — is the model right about *this* player?

**Team context**
- Pace, pass rate over expected, red-zone tendencies
- Target/carry distribution over time (stacked area chart)

**League page**
- Your roster's positional strengths vs. league average
- Playoff odds via full season-remainder simulation
- Trade evaluator: simulate rest-of-season win totals before/after a proposed trade

**Model diagnostics**
- MAE / RMSE vs. baseline, by position and by week
- Calibration plot — when you say 60%, does it happen 60% of the time?
- Keep this honest and visible. It's how you know whether to trust the app.

---

## 13. Build order

**Phase 1 — Foundations (week 1–2)**
1. Repo, Dokploy Compose application, Neon project, Drizzle schema
2. `/srv/fantasy` Parquet layout + DuckDB query helpers + batched `COPY` writer
3. Yahoo OAuth flow + token refresh + `YahooClient`
4. Yahoo JSON normalization layer with fixture tests
5. `nfl_data_py` ingestion for historical seasons (2019+) → Parquet
6. Aggregation pipeline: DuckDB over raw PBP → weekly player/team tables
7. ID crosswalk + admin review page
8. Snapshot all past `draftresults` (see §15 — do this before it disappears)

*Milestone: you can query your actual roster joined to real snap-count data, with raw PBP on disk and Postgres under 100 MB.*

**Phase 2 — Projections (week 3–4)**
9. Layer 0 baseline + backtest harness (runs entirely in DuckDB — no Postgres)
10. Layer 1 volume model
11. Layer 2 context adjustments
12. Layer 3 distributions
13. Weekly archive job: projections → Parquet, truncate old rows in Postgres
14. Diagnostics page

*Milestone: projections that beat the naive baseline, and you can prove it.*

**Phase 3 — Start/sit (week 5)**
15. Monte Carlo sim with correlation
16. Lineup optimizer
17. Start/sit UI with explanations

*Milestone: the app answers the actual weekly question.*

**Phase 4 — Roster management (week 6)**
18. Playoff odds simulation (season-remainder)
19. Waiver recommendations
20. Trade finder + valuation heuristics

*Milestone: the app tells you what to do between games, not just on Sunday.*

**Phase 5 — Draft (before your draft)**
21. Season-long projections
22. VORP + auction values + tiers
23. Manager tendency metrics (from the Phase 1 draft snapshot)
24. Live draft board with Yahoo polling + opponent tendency panel

**Phase 6 — Nice to have**
25. ESPN live scoring client + in-game scoreboard
26. Inactive alerts before Sunday lock

**Order rationale:**

- **Start/sit before draft** — 17 weeks of use versus one afternoon. If your draft is imminent, swap Phases 3/4 with 5.
- **Playoff odds before waivers and trades** — both are evaluated in playoff-odds terms, so it's a shared dependency. Build it once.
- **Waivers before trades** — same engine, no counterparty valuation problem. Get the ranking machinery right where it's easy.
- **Draft history snapshotted in Phase 1, analyzed in Phase 5** — the *ingestion* is urgent (Yahoo history can vanish), the *analysis* isn't needed until draft season.
- **Storage split in Phase 1, step 2** — before any ingestion. Writing the pipeline against Postgres and migrating to Parquet later means rewriting every ingestion job.
- **Archive job in Phase 2, not Phase 6** — if it isn't built when projections start accumulating, you'll hit the Neon ceiling mid-season and be doing emergency cleanup during your playoff push.
- **Deploy in week 1, not at the end.** Get a "hello world" Compose app live on Dokploy with TLS and the real domain before writing features. The Yahoo OAuth callback must point at that domain, and discovering a Traefik or bind-mount problem in week 6 is worse than discovering it in week 1.
- **ESPN last** — it's a display feature that improves no decision. First thing to cut.

---

## 14. Deployment (Dokploy)

Dokploy is Docker Compose with a control plane, so the architecture maps over unchanged. What follows is the Dokploy-specific detail.

### 14.1 One Compose application, not two apps

Create a single **Docker Compose** application in Dokploy pointed at your repo. Two separate Dokploy "Applications" would land on different networks and force you to route the Python service over the public internet.

```yaml
# docker-compose.yml
services:
  web:
    build: ./web
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - API_URL=http://api:8000
      - YAHOO_CLIENT_ID=${YAHOO_CLIENT_ID}
      - YAHOO_CLIENT_SECRET=${YAHOO_CLIENT_SECRET}
    labels:
      - traefik.enable=true
    networks: [dokploy-network]

  api:
    build: ./api
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - PARQUET_ROOT=/data
    volumes:
      - /srv/fantasy:/data          # bind mount, see 14.2
    networks: [dokploy-network]
    # no traefik labels — internal only

networks:
  dokploy-network:
    external: true
```

`web` reaches the Python service at `http://api:8000` by service name. Only `web` gets a domain; `api` stays unreachable from outside, which is the correct security posture for a service with no auth.

### 14.2 Bind-mount the Parquet volume

Use an absolute host path (`/srv/fantasy:/data`), not a named Docker volume.

**Why:** if you ever delete and recreate the application in Dokploy, named volumes can go with it. Re-downloading six seasons of play-by-play is a slow afternoon. A host path survives anything you do in the Dokploy UI.

Create it before first deploy:

```bash
mkdir -p /srv/fantasy/{pbp,weekly,team,projections_archive,api_archive,backups}
chown -R 1000:1000 /srv/fantasy    # match the container's user
```

The `chown` matters — permission errors on first write are the most common way this bites.

### 14.3 Traefik handles TLS

Dokploy runs Traefik as ingress. Assign a domain to the `web` service in the UI and Let's Encrypt provisions automatically. No Caddy, no nginx, no certbot.

**Set your real domain before the Yahoo OAuth flow.** The callback URL registered at Yahoo must match exactly, so register `https://fantasy.yourdomain.com/api/auth/yahoo/callback` from the start rather than a localhost URL you'll have to redo.

### 14.4 Environment variables

Secrets go in Dokploy's Environment tab, not `.env` files in the repo:

```
DATABASE_URL=postgresql://…@…neon.tech/…?sslmode=require
YAHOO_CLIENT_ID=…
YAHOO_CLIENT_SECRET=…
PARQUET_ROOT=/data
```

The Yahoo **refresh token** is obtained at runtime, so store it in Postgres rather than an env var — it needs to survive redeploys and be rotatable without one.

### 14.5 Scheduled jobs

Use Dokploy's built-in Schedules rather than host cron or systemd timers. They run inside the container and survive redeploys.

| Job | Schedule | Command |
|---|---|---|
| Weekly nflverse ingestion | Tue 08:00 | `curl -X POST http://api:8000/jobs/ingest-week` |
| Projection run | Tue 09:00, Thu 12:00, Sun 09:00 | `curl -X POST http://api:8000/jobs/project` |
| Archive to Parquet | Tue 10:00 | `curl -X POST http://api:8000/jobs/archive` |
| Yahoo roster sync | Daily 06:00 | `curl -X POST http://api:8000/jobs/sync-league` |
| Postgres backup | Sun 03:00 | `pg_dump $DATABASE_URL > /data/backups/$(date +%F).sql` |

Stagger these. Three jobs waking Neon's compute simultaneously burns more compute-hours than running them sequentially.

### 14.6 Turn off auto-deploy during draft season

Dokploy's git-push auto-deploy restarts containers. If that fires mid-draft while the board is polling Yahoo every 10 seconds, you lose the live view at the one moment it matters.

**Before your draft:** disable auto-deploy, or point the production app at a `stable` branch and develop on `main`. Re-enable afterward.

### 14.7 Resource limits

The VPS runs other workloads, so constrain this stack. Monte Carlo simulations will happily consume every core:

```yaml
  api:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
```

Sim runs are the memory-hungry step — 10,000 iterations across a full roster. If you hit the limit, reduce iterations or batch by position rather than raising the ceiling and starving your other services.

---

## 15. Practical notes

**Caching.** `nflverse` data updates once daily in-season (Tuesday mornings for the completed week). Yahoo roster data changes more often but not by the minute. Cache aggressively — Next.js `unstable_cache` with tag-based revalidation, plus a raw-response cache in Postgres so you can replay and debug without re-hitting Yahoo.

**Backtesting is not optional.** Before trusting any model, run it on 2023–2024 and compare against actual results and against FantasyPros consensus. If you don't beat consensus, use consensus — and be honest with yourself about it.

**Injury data is the weak link.** `nfl_data_py` injury reports lag. Yahoo's player status is more current. Prefer Yahoo status for game-day decisions, and always show the timestamp of the last update.

**Timezone bugs will bite you.** NFL weeks roll over at odd times, and Thursday/Sunday/Monday games mean "this week" is ambiguous for three days. Store everything UTC; define week boundaries explicitly from the schedule table rather than by date arithmetic.

**Bye weeks.** Trivially easy to forget in the projection pipeline and produce a nonzero projection for a player who isn't playing. Add an explicit guard and a test.

**ESPN endpoints will break eventually.** They're unofficial and undocumented. Put them behind a single client interface, cache the last good response, and make every live feature degrade to "last updated 4 minutes ago" rather than erroring out. Never let a live-feed failure take down a page that also shows projections.

**Pull draft history once, early.** Yahoo keeps past seasons available, but league history can vanish if the commissioner recreates the league rather than renewing it. Snapshot every past `draftresults` into your own DB during Phase 1 even though you won't use it until Phase 5.

**Don't over-model.** The gap between a naive baseline and a good model is much smaller than intuition suggests, and most of it comes from volume prediction and opponent adjustment. Layers 0–2 get you most of the value. Layers 3–4 are where the *decision quality* improves, which is different from projection accuracy — and is the actual point of the app.

---

## 16. Stack detail

```
Frontend    Next.js 15 (App Router), TypeScript, Tailwind, shadcn/ui
Charts      Recharts (composable) + visx where you need custom
Tables      TanStack Table (sorting/filtering/virtualization for the draft board)
State       React Server Components + TanStack Query for live draft polling
Hot DB      Neon Postgres (free tier) + Drizzle ORM
Analytics   DuckDB over Parquet on the VPS (pyarrow for writes)
Python      FastAPI, pandas, numpy, scikit-learn, nfl_data_py, rapidfuzz, duckdb
Jobs        Dokploy scheduled jobs (cron) hitting FastAPI endpoints
Hosting     Dokploy on the VPS; Traefik handles TLS + routing
Auth        None needed — single user. Tailscale, or Traefik basic-auth middleware.
```

**Skip:** Redis (Postgres is fine at this scale), Kubernetes, a message queue, and any auth system. Single-user personal apps should stay boring.

**Backups:** Neon's free tier includes limited point-in-time recovery, but don't rely on it. A weekly `pg_dump` to `/srv/fantasy/backups/` costs nothing and the hot tier is small enough that dumps are seconds. The Parquet tier is reproducible from nflverse, so back up only the API archive and anything hand-curated — chiefly your manual crosswalk overrides, which represent real irrecoverable effort.
