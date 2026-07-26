# Data Dictionary

Every field in every store. **Units and nullability are the point** — this document exists so you never have to re-derive whether `target_share` is `0.27` or `27.0`.

**Conventions used throughout:**

- Rates and shares are stored as **fractions in [0,1]**, never percentages. `target_share = 0.27` means 27%.
- All timestamps are `timestamptz` in **UTC**. Never store naive datetimes.
- `season` is the NFL season year (the 2025 season includes January 2026 games).
- `week` is 1–18 regular season, 19–22 postseason. Fantasy uses 1–17 typically.
- Money/points are `numeric`, never `float`, where exactness matters.
- A field marked **derived** is computed by our pipeline, not sourced directly.

---

## Part 1 — Postgres (hot tier)

### `players`

Canonical player identity. One row per human, ever. Never delete.

| Field | Type | Null | Source | Notes |
|---|---|---|---|---|
| `id` | `uuid` PK | no | derived | Our own ID. Generate once; never reuse. |
| `gsis_id` | `text` | yes | nflverse | NFL's official ID, e.g. `00-0034796`. Primary join key to stats. |
| `pfr_id` | `text` | yes | nflverse | Pro-Football-Reference ID, e.g. `MahoPa00`. |
| `espn_id` | `text` | yes | nflverse ids | For the live feed join. |
| `yahoo_id` | `text` | yes | Yahoo | Yahoo's numeric player ID as text. **Not stable across games/sports.** |
| `sleeper_id` | `text` | yes | nflverse ids | Kept for future portability. |
| `full_name` | `text` | no | nflverse | Display name as nflverse gives it. |
| `name_normalized` | `text` | no | derived | Lowercase, suffixes and punctuation stripped. Used for fuzzy matching. Indexed. |
| `position` | `text` | no | nflverse | `QB\|RB\|WR\|TE\|K\|DST\|OL\|DL\|LB\|DB`. Fantasy-relevant subset is the first six. |
| `team` | `text` | yes | nflverse | Current team abbreviation. **Mutable** — updated weekly. Null for free agents. |
| `birthdate` | `date` | yes | nflverse | Used for age curves. |
| `draft_year` | `int` | yes | nflverse | Null for UDFAs. |
| `draft_round` | `int` | yes | nflverse | Draft capital is the rookie projection prior. Null for UDFAs. |
| `draft_pick` | `int` | yes | nflverse | Overall pick number. |
| `rookie_season` | `int` | yes | derived | First season with a recorded snap. Distinct from `draft_year`. |
| `status` | `text` | yes | Yahoo | `ACT\|IR\|PUP\|SUSP\|NFI\|FA`. Yahoo is more current than nflverse here. |
| `updated_at` | `timestamptz` | no | derived | |

**Gotcha:** `team` changes mid-season on trades. If you need a player's team *as of week N*, read it from `stats_weekly`, not here.

---

### `id_crosswalk_log`

Audit trail for every ID match. Append-only.

| Field | Type | Null | Notes |
|---|---|---|---|
| `id` | `bigserial` PK | no | |
| `source` | `text` | no | `yahoo\|espn\|sleeper\|pfr` |
| `source_id` | `text` | no | The foreign ID being mapped. |
| `player_id` | `uuid` FK | yes | Null means unmatched — the review queue. |
| `method` | `text` | no | `nflverse_ids\|exact_name\|fuzzy\|manual` |
| `confidence` | `numeric(4,3)` | yes | 0–1. Null for `manual` and `nflverse_ids`. |
| `candidates_json` | `jsonb` | yes | Top-N alternatives, for the review UI. |
| `verified_at` | `timestamptz` | yes | Null until a human confirms. |
| `created_at` | `timestamptz` | no | |

**Why append-only:** when a match turns out wrong in week 9, you need to see what it was matched to and why.

---

### `leagues`

| Field | Type | Null | Source | Notes |
|---|---|---|---|---|
| `id` | `uuid` PK | no | derived | |
| `yahoo_league_key` | `text` | no | Yahoo | Format `{game_key}.l.{league_id}`, e.g. `461.l.123456`. Unique. |
| `name` | `text` | no | Yahoo | |
| `season` | `int` | no | Yahoo | |
| `num_teams` | `int` | no | Yahoo | |
| `scoring_json` | `jsonb` | no | Yahoo | Full stat-category → point-value map. **See §Scoring below.** |
| `roster_positions_json` | `jsonb` | no | Yahoo | e.g. `{"QB":1,"RB":2,"WR":2,"TE":1,"W/R/T":1,"K":1,"DEF":1,"BN":6}` |
| `playoff_start_week` | `int` | no | Yahoo | Drives the playoff-odds sim horizon. |
| `num_playoff_teams` | `int` | no | Yahoo | |
| `waiver_type` | `text` | yes | Yahoo | `FAAB\|rolling\|reverse`. Affects waiver recommendations. |
| `trade_deadline` | `date` | yes | Yahoo | Suppress trade suggestions after this. |
| `updated_at` | `timestamptz` | no | derived | |

**Scoring (`scoring_json`) shape:**

```json
{
  "stat_modifiers": {
    "pass_yd": 0.04, "pass_td": 4, "pass_int": -1,
    "rush_yd": 0.1, "rush_td": 6,
    "rec": 0.5, "rec_yd": 0.1, "rec_td": 6,
    "fum_lost": -2, "two_pt": 2
  },
  "fractional_points": true,
  "negative_points": true
}
```

**This is the most important single object in the system.** Every projection must be computed against it. Half-PPR (`rec: 0.5`) versus full-PPR reorders the entire RB/WR board.

---

### `league_teams`

| Field | Type | Null | Source | Notes |
|---|---|---|---|---|
| `id` | `uuid` PK | no | derived | |
| `league_id` | `uuid` FK | no | | |
| `yahoo_team_key` | `text` | no | Yahoo | `{league_key}.t.{team_id}` |
| `name` | `text` | no | Yahoo | Manager-chosen, changes freely. |
| `manager_name` | `text` | yes | Yahoo | More stable than team name. Use for tendency profiles. |
| `is_mine` | `boolean` | no | manual | Exactly one true per league. |
| `draft_position` | `int` | yes | Yahoo | |

**Gotcha:** team names change mid-season. Key manager profiles off `manager_name` or `yahoo_team_key`, never `name`.

---

### `rosters`

Snapshot of who was rostered, by week. One row per player per team per week.

| Field | Type | Null | Source | Notes |
|---|---|---|---|---|
| `league_team_id` | `uuid` FK | no | | PK part |
| `week` | `int` | no | | PK part |
| `player_id` | `uuid` FK | no | | PK part |
| `slot` | `text` | no | Yahoo | `QB\|RB\|WR\|TE\|W/R/T\|K\|DEF\|BN\|IR` |
| `is_starter` | `boolean` | no | derived | `slot NOT IN ('BN','IR')` |
| `acquired_via` | `text` | yes | Yahoo | `draft\|waiver\|freeagent\|trade` |
| `fetched_at` | `timestamptz` | no | derived | Rosters change until lock; this tells you how stale. |

**Gotcha:** fetch after Sunday lock for the authoritative record. Fetching Wednesday captures pre-waiver state.

---

### `matchups`

| Field | Type | Null | Notes |
|---|---|---|---|
| `league_id` | `uuid` FK | no | PK part |
| `week` | `int` | no | PK part |
| `team_a_id` | `uuid` FK | no | PK part |
| `team_b_id` | `uuid` FK | no | |
| `team_a_score` | `numeric(6,2)` | yes | Null until played. |
| `team_b_score` | `numeric(6,2)` | yes | |
| `is_playoff` | `boolean` | no | |

Store each matchup **once** with a canonical ordering (lower team UUID as `team_a`), not twice from each perspective.

---

### `draft_picks`

| Field | Type | Null | Source | Notes |
|---|---|---|---|---|
| `league_id` | `uuid` FK | no | | |
| `season` | `int` | no | | |
| `overall` | `int` | no | Yahoo | PK is `(league_id, season, overall)` |
| `round` | `int` | no | derived | |
| `pick_in_round` | `int` | no | derived | |
| `league_team_id` | `uuid` FK | no | Yahoo | |
| `player_id` | `uuid` FK | yes | crosswalk | Null if unmatched. |
| `cost` | `int` | yes | Yahoo | Auction dollars. Null in snake drafts. |
| `adp_at_time` | `numeric(5,1)` | yes | FantasyPros | Consensus ADP as of that draft date. |
| `reach_delta` | `numeric(5,1)` | yes | derived | `adp_at_time - overall`. **Positive = reached** (drafted earlier than ADP). |

**Sign convention on `reach_delta` matters.** Positive means the manager took the player earlier than consensus. Get this backwards and every tendency reads inverted.

---

### `manager_profiles`

Long-format metrics. One row per manager per metric per scope.

| Field | Type | Null | Notes |
|---|---|---|---|
| `league_team_id` | `uuid` FK | no | PK part |
| `season` | `int` | yes | PK part. **Null = pooled across all seasons.** |
| `metric` | `text` | no | PK part. See table below. |
| `value` | `numeric` | no | |
| `sample_size` | `int` | no | **Always display this.** |
| `stddev` | `numeric` | yes | Null when n < 3. |
| `computed_at` | `timestamptz` | no | |

**Metric vocabulary:**

| `metric` | Units | Interpretation |
|---|---|---|
| `first_qb_round` | rounds | Mean round of first QB taken |
| `first_rb_round` | rounds | |
| `first_wr_round` | rounds | |
| `first_te_round` | rounds | |
| `first_k_round` | rounds | Low value = unsophisticated |
| `first_dst_round` | rounds | |
| `reach_delta_mean` | picks | Positive = habitually reaches |
| `pos_lean_rb` | fraction | Share of picks on RB, minus league mean |
| `pos_lean_wr` | fraction | |
| `pos_lean_te` | fraction | |
| `pos_lean_qb` | fraction | |
| `rookie_share` | fraction | Share of picks spent on rookies |
| `team_bias_max` | fraction | Largest share of picks from one NFL team |
| `team_bias_team` | — | Stored as `value=0`, team in a companion row. Or use a separate text column. |
| `bye_stack_count` | count | Instances of ≥2 starters sharing a bye |

**Suppression rule:** do not display any metric where `sample_size < 10`.

---

### `projections`

**Current season only.** Archived to Parquet weekly.

| Field | Type | Null | Notes |
|---|---|---|---|
| `id` | `bigserial` PK | no | |
| `player_id` | `uuid` FK | no | Unique with `(season, week, model_version, league_id)` |
| `league_id` | `uuid` FK | no | **Projections are league-specific** — scoring differs. |
| `season` | `int` | no | |
| `week` | `int` | no | |
| `mean` | `numeric(6,2)` | no | Expected fantasy points under this league's scoring. |
| `p10` | `numeric(6,2)` | no | 10th percentile outcome. |
| `p20` | `numeric(6,2)` | no | |
| `p50` | `numeric(6,2)` | no | Median. **Not equal to `mean`** — distributions are right-skewed. |
| `p80` | `numeric(6,2)` | no | |
| `p90` | `numeric(6,2)` | no | |
| `sd` | `numeric(6,2)` | no | |
| `p_zero` | `numeric(4,3)` | no | P(scores ≤ 0). Captures inactive/injury risk. |
| `is_playing` | `boolean` | no | False on bye, IR, or ruled out. **Guard: if false, all values must be 0.** |
| `model_version` | `text` | no | e.g. `v2.1-volume`. Never overwrite; insert new rows. |
| `generated_at` | `timestamptz` | no | |

**Bye-week guard.** The single easiest bug to ship: a nonzero projection for a player who isn't playing. Assert `is_playing = false → mean = 0` in a check constraint.

---

### `proj_components`

Decomposition of each projection, for explanations.

| Field | Type | Null | Notes |
|---|---|---|---|
| `projection_id` | `bigint` FK | no | PK part |
| `component` | `text` | no | PK part |
| `value` | `numeric` | no | |
| `display_order` | `int` | no | Controls explanation ordering in UI |

**Component vocabulary:**

| `component` | Units | Meaning |
|---|---|---|
| `base_ppg` | points | Layer 0 baseline |
| `proj_snaps` | count | Predicted snaps |
| `proj_snap_pct` | fraction | |
| `proj_routes` | count | |
| `proj_targets` | count | |
| `proj_carries` | count | |
| `proj_tprr` | fraction | Targets per route run |
| `opp_adj` | multiplier | 1.0 = neutral. 1.12 = +12%. |
| `pace_adj` | multiplier | |
| `script_adj` | multiplier | Game-script effect from Vegas line |
| `vacated_targets` | count | Targets freed by injured teammates |
| `vacated_carries` | count | |
| `injury_discount` | multiplier | ≤1.0 |
| `weather_adj` | multiplier | |

**All `*_adj` are multipliers centered on 1.0**, so the explanation text can say "+12%" uniformly.

---

### `schedule`

Current + upcoming weeks in Postgres; full history in Parquet.

| Field | Type | Null | Source | Notes |
|---|---|---|---|---|
| `season` | `int` | no | nflverse | PK part |
| `week` | `int` | no | nflverse | PK part |
| `game_id` | `text` | no | nflverse | PK. Format `2025_01_KC_BAL`. |
| `home_team` | `text` | no | nflverse | |
| `away_team` | `text` | no | nflverse | |
| `kickoff_utc` | `timestamptz` | no | nflverse | **UTC.** Drives lock times. |
| `spread_line` | `numeric(4,1)` | yes | nflverse | **Home team perspective.** Negative = home favored. |
| `total_line` | `numeric(4,1)` | yes | nflverse | Over/under. |
| `roof` | `text` | yes | nflverse | `outdoors\|dome\|closed\|open` |
| `surface` | `text` | yes | nflverse | |
| `temp_f` | `int` | yes | nflverse | Null for domes. |
| `wind_mph` | `int` | yes | nflverse | >15 meaningfully suppresses passing. |

**Spread sign convention.** nflverse uses home perspective: `spread_line = -3.5` means home favored by 3.5. Implied team total = `total/2 - spread/2` for home, `total/2 + spread/2` for away. Get this backwards and every game-script adjustment inverts.

---

### `injuries`

| Field | Type | Null | Source | Notes |
|---|---|---|---|---|
| `player_id` | `uuid` FK | no | | PK part |
| `season`, `week` | `int` | no | | PK part |
| `report_status` | `text` | yes | nflverse | `Out\|Doubtful\|Questionable\|null` |
| `practice_status` | `text` | yes | nflverse | `DNP\|Limited\|Full` |
| `yahoo_status` | `text` | yes | Yahoo | `O\|D\|Q\|IR\|PUP\|SUSP\|null`. **More current.** |
| `body_part` | `text` | yes | nflverse | |
| `updated_at` | `timestamptz` | no | derived | Display this — staleness matters on Sunday. |

**Precedence:** for game-day decisions use `yahoo_status`; for historical modeling use `report_status`.

Historical Questionable → active rates run ~75%, Doubtful ~25%, Out ~2%. Use these as priors for `p_zero`.

---

### `live_player_stats`

Ephemeral. Truncated after each week finalizes.

| Field | Type | Null | Notes |
|---|---|---|---|
| `player_id` | `uuid` FK | no | PK part |
| `season`, `week` | `int` | no | PK part |
| `stat_json` | `jsonb` | no | Raw ESPN payload, normalized shape. |
| `fantasy_points` | `numeric(6,2)` | yes | Computed against league scoring. |
| `game_state` | `text` | yes | `pre\|in\|post` |
| `fetched_at` | `timestamptz` | no | |

---

## Part 2 — Parquet (warm/cold tier)

Path convention: `/srv/fantasy/{dataset}/season={YYYY}/[week={W}/]part-*.parquet`. Hive partitioning lets DuckDB prune directories.

### `weekly/` — player-week aggregates

The projection model's primary input. **Derived from raw PBP via DuckDB.**

| Field | Type | Null | Derivation |
|---|---|---|---|
| `player_id` | `string` | no | Our UUID as text |
| `gsis_id` | `string` | no | Join key to nflverse |
| `season`, `week` | `int32` | no | |
| `team` | `string` | no | Team **as of that week** |
| `opponent` | `string` | no | |
| `position` | `string` | no | |
| `is_home` | `bool` | no | |
| `snaps` | `int32` | yes | Offensive snaps. Null if unrecorded. |
| `snap_pct` | `float` | yes | Fraction [0,1] of team offensive snaps |
| `routes_run` | `int32` | yes | **Sparse before 2019.** |
| `targets` | `int32` | no | |
| `target_share` | `float` | no | Fraction of team targets |
| `tprr` | `float` | yes | `targets / routes_run`. Null when `routes_run` is null or 0. |
| `air_yards` | `float` | no | Sum of intended air yards |
| `air_yards_share` | `float` | no | Fraction of team air yards |
| `adot` | `float` | yes | `air_yards / targets`. Null when targets = 0. |
| `racr` | `float` | yes | Receiving yards / air yards. Unstable at low volume. |
| `wopr` | `float` | no | `1.5 × target_share + 0.7 × air_yards_share`. Standard composite. |
| `receptions` | `int32` | no | |
| `rec_yards` | `float` | no | |
| `rec_td` | `int32` | no | |
| `carries` | `int32` | no | |
| `rush_yards` | `float` | no | |
| `rush_td` | `int32` | no | |
| `rz_touches` | `int32` | no | Carries + targets inside the 20 |
| `gz_touches` | `int32` | no | Inside the 5. Best TD predictor. |
| `pass_attempts` | `int32` | no | QB only |
| `pass_yards` | `float` | no | |
| `pass_td` | `int32` | no | |
| `interceptions` | `int32` | no | |
| `sacks_taken` | `int32` | no | |
| `fumbles_lost` | `int32` | no | |
| `two_pt` | `int32` | no | |
| `fantasy_points_ppr` | `float` | no | Standard PPR. **Reference only** — real scoring is league-specific. |

**Why store PPR when scoring is league-specific:** it's the standard comparison unit for model diagnostics and cross-source sanity checks. Compute league-specific points at query time from the raw stat columns.

**`routes_run` availability:** reliable from 2019 onward. Earlier seasons are patchy — cap your training window accordingly rather than silently training on nulls.

---

### `team/` — team-week context

| Field | Type | Null | Derivation |
|---|---|---|---|
| `team`, `season`, `week` | | no | |
| `plays` | `int32` | no | Total offensive plays |
| `pass_attempts`, `rush_attempts` | `int32` | no | |
| `pass_rate` | `float` | no | Fraction |
| `proe` | `float` | no | Pass rate over expected. **Signed**, typically −0.10 to +0.10. |
| `seconds_per_play` | `float` | no | Pace. Lower = faster. |
| `plays_per_game_l4` | `float` | no | Rolling 4-week mean |
| `points_for`, `points_against` | `int32` | no | |
| `total_targets`, `total_carries` | `int32` | no | Denominators for share metrics |
| `total_air_yards` | `float` | no | |

---

### `defense_vs_pos/`

| Field | Type | Null | Derivation |
|---|---|---|---|
| `team`, `season`, `week`, `position` | | no | |
| `points_allowed` | `float` | no | PPR points allowed to that position |
| `points_allowed_l4` | `float` | no | Rolling 4-week |
| `points_allowed_rank` | `int32` | no | 1 = allows most (best matchup) |
| `targets_allowed` | `int32` | no | |
| `yards_allowed` | `float` | no | |
| `td_allowed` | `int32` | no | |
| `pace_adjusted` | `float` | no | Per-play normalized. **Use this, not raw.** |

**Raw points-allowed is confounded by pace and game script.** A defense facing many plays looks bad even when efficient per-play. Always use the pace-adjusted figure for matchup adjustment; keep the raw one for display since that's what other sites show.

---

### `pbp/` — raw play-by-play

Straight from `nfl_data_py.import_pbp_data()`. ~380 columns, ~50k rows/season. Not documented field-by-field here — see nflverse's dictionary. Stored so aggregations can be re-derived without re-downloading.

Partition by season. Snappy compression. ~400–600 MB/season uncompressed, ~150–250 MB as Parquet.

---

### `projections_archive/`

Same schema as the `projections` table, plus a flattened `components_json` column. Partitioned by `season` and `week`.

---

### `api_archive/`

Raw responses for replay and debugging.

| Field | Type | Notes |
|---|---|---|
| `source` | `string` | `yahoo\|espn` |
| `endpoint` | `string` | Path with params |
| `response_json` | `string` | Raw body |
| `status_code` | `int32` | |
| `fetched_at` | `timestamp` | |

Partition by `source` and date. This is what lets you debug "why did the projection change" three weeks later.

---

## Part 3 — Unit conventions summary

| Concept | Stored as | Not |
|---|---|---|
| Shares, rates, percentages | Fraction [0,1] | Percentage 0–100 |
| Adjustments | Multiplier centered on 1.0 | Percentage delta |
| Spread | Home perspective, negative = home favored | Away perspective |
| `reach_delta` | Positive = reached (took early) | Negative = reached |
| Timestamps | `timestamptz`, UTC | Naive local |
| Fantasy points | `numeric(6,2)` | float |
| Defense rank | 1 = allows most points | 1 = best defense |

**The four that will actually bite you:** spread sign, `reach_delta` sign, defense rank direction, and fraction-vs-percentage. Assert these in tests.
