# API Contract

Defines the seam between Next.js and the Python service so either side can be built independently.

**Two surfaces:**

1. **Internal API** — FastAPI at `http://api:8000`, reachable only inside the Docker network. No auth. Consumed by Next.js server components and Dokploy scheduled jobs.
2. **Web API** — Next.js route handlers at `/api/*`. Browser-facing. Thin — mostly proxies and mutations.

**Rule: the browser never talks to FastAPI directly.** Next.js server components query Postgres directly via Drizzle for reads; FastAPI is called only for computation (projections, sims, aggregation).

---

## Conventions

**Base URL (internal):** `http://api:8000`

**Content type:** `application/json` throughout.

**Errors** use a consistent envelope:

```json
{
  "error": {
    "code": "PLAYER_NOT_FOUND",
    "message": "No player with id 550e8400-…",
    "detail": { "player_id": "550e8400-…" }
  }
}
```

| HTTP | When |
|---|---|
| 400 | Malformed request |
| 404 | Referenced entity doesn't exist |
| 409 | Conflicting state (e.g. projection run already in progress) |
| 422 | Valid shape, invalid values (week 25, negative season) |
| 424 | Upstream dependency failed (Yahoo down, Parquet missing) |
| 500 | Unexpected |

**Long-running operations** (projection runs, backtests, sims over full seasons) return `202 Accepted` with a job handle rather than blocking:

```json
{ "job_id": "…", "status": "queued", "poll_url": "/jobs/{job_id}" }
```

Anything expected to exceed ~5 seconds uses this pattern. Start/sit sims for a single week are fast enough to be synchronous.

**Idempotency:** all `/jobs/*` endpoints are idempotent per `(season, week)`. Re-running an ingestion for a completed week overwrites rather than duplicating.

---

## Part 1 — Internal API (FastAPI)

### Health & meta

#### `GET /health`

```json
{
  "status": "ok",
  "postgres": "ok",
  "parquet_root": "ok",
  "duckdb": "ok",
  "version": "v2.1.0"
}
```

Returns 200 only if all subsystems respond. Dokploy's healthcheck hits this.

#### `GET /meta/current-week`

Resolves "what week is it" — non-trivial because NFL weeks roll over mid-week.

```json
{
  "season": 2025,
  "week": 7,
  "phase": "in_progress",
  "lock_times": {
    "thursday": "2025-10-16T00:15:00Z",
    "sunday_early": "2025-10-19T17:00:00Z",
    "sunday_late": "2025-10-19T20:05:00Z",
    "monday": "2025-10-21T00:15:00Z"
  },
  "next_transition": "2025-10-22T09:00:00Z"
}
```

`phase` is `upcoming | in_progress | complete`. **Derived from the schedule table, never from date arithmetic.**

---

### Ingestion jobs

All are `POST`, idempotent, and triggered by Dokploy schedules.

#### `POST /jobs/ingest-week`

```json
{ "season": 2025, "week": 7, "force": false }
```

Pulls nflverse PBP for the week, writes Parquet, re-derives weekly aggregates. `force: true` re-downloads even if the partition exists.

Returns `202` with a job handle.

#### `POST /jobs/ingest-season`

```json
{ "season": 2019, "datasets": ["pbp", "schedule", "rosters", "injuries"] }
```

Backfill. Used once during Phase 1 for 2019–2024.

#### `POST /jobs/sync-league`

```json
{ "league_id": "uuid", "include": ["rosters", "matchups", "transactions", "free_agents"] }
```

Pulls current state from Yahoo into Postgres. Handles token refresh internally.

#### `POST /jobs/sync-draft-history`

```json
{ "league_id": "uuid", "seasons": [2022, 2023, 2024] }
```

**Run this in Phase 1.** Yahoo history can disappear if the league is recreated.

#### `POST /jobs/archive`

```json
{ "season": 2025, "before_week": 6 }
```

Moves `projections` and `proj_components` older than `before_week` to Parquet, then deletes from Postgres. Also truncates `live_player_stats`.

Returns counts:

```json
{ "archived_projections": 28400, "archived_components": 284000, "freed_bytes_estimate": 41000000 }
```

#### `POST /jobs/rebuild-crosswalk`

Re-runs ID matching. Returns unmatched entries for the review UI.

```json
{
  "matched": 1847,
  "unmatched": 23,
  "needs_review": [
    {
      "source": "yahoo",
      "source_id": "40021",
      "name": "Marvin Harrison Jr.",
      "position": "WR",
      "team": "ARI",
      "candidates": [
        { "player_id": "…", "name": "Marvin Harrison", "score": 0.87, "note": "birthdate mismatch: 2002 vs 1972" }
      ]
    }
  ]
}
```

---

### Projections

#### `POST /projections/run`

```json
{
  "league_id": "uuid",
  "season": 2025,
  "week": 7,
  "model_version": "v2.1-volume",
  "player_ids": null
}
```

`player_ids: null` means all rostered + relevant free agents. Returns `202`.

#### `GET /projections`

Query params: `league_id`, `season`, `week`, `position?`, `player_ids?` (comma-separated), `model_version?` (defaults to latest).

```json
{
  "season": 2025,
  "week": 7,
  "model_version": "v2.1-volume",
  "generated_at": "2025-10-15T09:02:11Z",
  "projections": [
    {
      "player_id": "…",
      "name": "Player Name",
      "position": "WR",
      "team": "KC",
      "opponent": "BUF",
      "is_home": true,
      "is_playing": true,
      "mean": 14.8,
      "p10": 4.2, "p20": 8.1, "p50": 13.9, "p80": 22.4, "p90": 27.1,
      "sd": 7.3,
      "p_zero": 0.06,
      "components": {
        "base_ppg": 12.4,
        "proj_routes": 33.0,
        "proj_targets": 8.4,
        "proj_tprr": 0.254,
        "opp_adj": 1.12,
        "pace_adj": 1.03,
        "script_adj": 0.98,
        "vacated_targets": 1.8,
        "injury_discount": 1.0
      }
    }
  ]
}
```

#### `GET /projections/season`

Rest-of-season projections. Same shape, with `weeks_remaining` and `total_mean` added. Used by draft, trades, and playoff odds.

---

### Simulation

#### `POST /sim/matchup`

The core start/sit call. Synchronous — typically 200–800ms for 10k iterations.

```json
{
  "league_id": "uuid",
  "week": 7,
  "my_lineup": ["player_uuid", "…"],
  "opponent_lineup": ["player_uuid", "…"],
  "iterations": 10000,
  "correlation": true
}
```

Response:

```json
{
  "win_probability": 0.583,
  "my_score": { "mean": 118.4, "p10": 89.2, "p50": 117.1, "p90": 149.8, "sd": 23.4 },
  "opp_score": { "mean": 112.7, "p10": 84.1, "p50": 111.9, "p90": 143.2, "sd": 22.8 },
  "margin": { "mean": 5.7, "p10": -25.3, "p90": 37.4 },
  "iterations": 10000,
  "correlation_applied": true
}
```

**`correlation: true` matters.** QB–WR1 stacks are positively correlated; ignoring this understates variance by roughly 10–15%.

#### `POST /sim/optimize-lineup`

```json
{
  "league_id": "uuid",
  "week": 7,
  "available_players": ["…"],
  "opponent_lineup": ["…"],
  "objective": "win_probability"
}
```

`objective` is `win_probability | expected_points`. **Default to `win_probability`** — it's the whole point, and it produces different answers when you're a heavy favorite or underdog.

Response:

```json
{
  "optimal_lineup": [
    { "slot": "QB", "player_id": "…", "name": "…", "projected": 19.2 }
  ],
  "win_probability": 0.583,
  "alternatives": [
    {
      "swap": { "out": "player_a_uuid", "in": "player_b_uuid" },
      "win_probability": 0.541,
      "delta": -0.042,
      "reason_codes": ["lower_ceiling", "tougher_matchup"]
    }
  ],
  "close_calls": [
    {
      "slot": "FLEX",
      "candidates": ["player_a_uuid", "player_b_uuid"],
      "delta": 0.008,
      "note": "within noise — either is defensible"
    }
  ]
}
```

**`close_calls` is a first-class output**, not an afterthought. Telling the user two options are indistinguishable is more honest than manufacturing a false winner.

#### `POST /sim/playoff-odds`

```json
{ "league_id": "uuid", "from_week": 7, "iterations": 5000 }
```

Simulates the remaining season. Returns per-team playoff and title probability. Powers waivers and trades.

---

### Draft

#### `GET /draft/board`

Query: `league_id`, `drafted?` (comma-separated player IDs already gone).

```json
{
  "best_available": [
    {
      "player_id": "…",
      "name": "…",
      "position": "RB",
      "vorp": 42.1,
      "auction_value": 38,
      "tier": 3,
      "adp": 24.5,
      "adp_delta": 8.5,
      "positional_rank": 12
    }
  ],
  "tier_breaks": { "RB": [1, 4, 9, 18], "WR": [1, 6, 14] },
  "positional_scarcity": {
    "RB": { "startable_remaining": 14, "tier_remaining": 2 }
  },
  "roster_needs": ["TE", "QB"]
}
```

`adp_delta` positive means the player is available later than ADP — a value pick.

#### `GET /draft/opponent-tendencies`

Query: `league_id`, `upcoming_picks?` (how many picks ahead to profile).

```json
{
  "managers": [
    {
      "league_team_id": "…",
      "manager_name": "…",
      "picks_until_yours": 2,
      "tendencies": [
        { "metric": "first_rb_round", "value": 2.8, "sample_size": 4, "display": "Takes RB in round 3 or earlier in 3 of 4 drafts" },
        { "metric": "reach_delta_mean", "value": 6.2, "sample_size": 51, "display": "Reaches +6.2 spots vs ADP on average" }
      ]
    }
  ],
  "suppressed_count": 3
}
```

`suppressed_count` reports metrics hidden for `sample_size < 10`. **Surface it** so the user knows data was withheld rather than absent.

---

### Roster management

#### `GET /waivers/recommendations`

Query: `league_id`, `week`, `limit?` (default 10).

```json
{
  "recommendations": [
    {
      "player_id": "…",
      "name": "…",
      "position": "RB",
      "available": true,
      "replaces": { "player_id": "…", "name": "…" },
      "playoff_odds_delta": 0.031,
      "ros_projection": 128.4,
      "schedule_strength_next_3": "easy",
      "faab_suggestion": 12,
      "reason_codes": ["vacated_touches", "soft_schedule"],
      "is_handcuff": false
    }
  ]
}
```

#### `GET /trades/suggestions`

Query: `league_id`, `week`, `limit?` (default 10), `target_team_id?`.

```json
{
  "suggestions": [
    {
      "target_team_id": "…",
      "manager_name": "…",
      "give": [{ "player_id": "…", "name": "…", "position": "WR" }],
      "receive": [{ "player_id": "…", "name": "…", "position": "RB" }],
      "my_odds_before": 0.58,
      "my_odds_after": 0.64,
      "their_odds_before": 0.41,
      "their_odds_after": 0.45,
      "mutual_gain": true,
      "receptivity_note": "Drafts WR ~1.5 rounds ahead of ADP (n=47) — likely receptive",
      "reason_codes": ["positional_surplus", "roster_balance"]
    }
  ],
  "excluded": {
    "bye_conflicts": 4,
    "injured": 2,
    "past_deadline": false
  }
}
```

**Both sides' odds are always returned.** A suggestion where your gain is +8 and theirs is +0.5 is one they'll reject — the user should see that before sending.

---

### Analytics

#### `GET /analytics/player/{player_id}`

Query: `season?`, `weeks?` (rolling window, default 10).

```json
{
  "player_id": "…",
  "name": "…",
  "trends": {
    "snap_pct": [{ "week": 1, "value": 0.62 }],
    "target_share": [{ "week": 1, "value": 0.19 }],
    "tprr": [{ "week": 1, "value": 0.21 }],
    "adot": [{ "week": 1, "value": 11.2 }]
  },
  "change_points": [
    { "week": 4, "metric": "target_share", "before": 0.19, "after": 0.27, "confidence": 0.82, "note": "coincides with teammate injury" }
  ],
  "projection_accuracy": { "mae": 4.2, "bias": -0.8, "n": 6 }
}
```

`bias` negative means the model under-projects this player. Worth surfacing — per-player bias is real signal.

#### `GET /analytics/model-diagnostics`

```json
{
  "model_version": "v2.1-volume",
  "by_position": [
    { "position": "RB", "mae": 5.1, "rmse": 7.2, "baseline_mae": 5.9, "improvement": 0.136, "n": 412 }
  ],
  "calibration": [
    { "bucket": "0.5-0.6", "predicted": 0.55, "actual": 0.53, "n": 48 }
  ],
  "vs_consensus": { "our_mae": 5.1, "consensus_mae": 5.3, "beat_consensus": true }
}
```

**`vs_consensus` is the honesty check.** If false, use consensus.

---

### Live

#### `GET /live/scoreboard`

Query: `league_id`, `week`.

```json
{
  "stale": false,
  "fetched_at": "2025-10-19T18:42:03Z",
  "my_score": 64.2,
  "opp_score": 71.8,
  "win_probability_live": 0.38,
  "players": [
    { "player_id": "…", "name": "…", "points": 12.4, "game_state": "in", "yet_to_play": false }
  ]
}
```

**`stale: true`** when the ESPN fetch failed and this is cached data. The UI must show the timestamp rather than pretending it's live.

---

## Part 2 — Web API (Next.js route handlers)

Thin. Reads go directly to Postgres in server components; these handle mutations, auth, and browser-side polling.

| Route | Method | Purpose |
|---|---|---|
| `/api/auth/yahoo/start` | GET | Redirect to Yahoo consent |
| `/api/auth/yahoo/callback` | GET | Exchange code, store refresh token |
| `/api/auth/yahoo/status` | GET | Token validity + expiry |
| `/api/league/sync` | POST | Trigger `/jobs/sync-league`, revalidate cache tags |
| `/api/draft/poll` | GET | Draft state for client polling. **Cache 5s.** |
| `/api/live/poll` | GET | Live scoreboard for client polling. **Cache 20s.** |
| `/api/crosswalk/confirm` | POST | Human confirms an ID match |
| `/api/lineup/apply` | POST | Optional — push a lineup back to Yahoo |

**Polling endpoints must be cached server-side.** A draft board polling every 10 seconds across an open tab and a phone would otherwise hit Yahoo twice as often as needed, and Yahoo's rate limits are undocumented.

---

## Part 3 — Cache & revalidation

| Data | TTL | Revalidation tag |
|---|---|---|
| Player metadata | 24h | `players` |
| Weekly stats (completed) | ∞ | `stats:{season}:{week}` |
| Projections | until next run | `proj:{league}:{season}:{week}` |
| League rosters | 15 min | `roster:{league}:{week}` |
| Draft state (live) | 5 s | `draft:{league}` |
| Live scoreboard | 20 s | `live:{league}:{week}` |
| Model diagnostics | 1h | `diagnostics` |

Completed weeks are immutable — cache them forever. `nflverse` occasionally revises stats, so `force: true` on ingestion must bust `stats:{season}:{week}`.

---

## Part 4 — Contract testing

Keep JSON Schema definitions for every response in `contracts/`. Both sides validate against them:

- **Python:** Pydantic models generated from the schemas; FastAPI validates responses in dev.
- **TypeScript:** types generated via `json-schema-to-typescript`; Zod-parse at the fetch boundary.

This is what lets you build the two services independently without integration surprises. When a contract changes, both sides fail loudly at build time rather than silently at runtime.

**Fixture strategy:** save one real response per endpoint under `contracts/fixtures/`. These double as offline-development data — you can build the entire UI against fixtures with no Yahoo token and no Postgres.
