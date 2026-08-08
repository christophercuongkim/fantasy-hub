# Runbook

Operating the app once it's built. Weekly rhythm, health checks, and what to do when things break.

**Audience: you, in October, at 11pm, when something isn't right.**

---

## 1. Weekly rhythm

### Tuesday — data day

nflverse publishes the completed week Tuesday morning US time. Everything downstream follows.

| Time (UTC) | Job | Duration | Purpose |
|---|---|---|---|
| 08:00 | `ingest-week` | 3–6 min | Pull PBP, write Parquet, re-derive aggregates |
| 09:00 | `project` | 1–3 min | Generate week N+1 projections |
| 10:00 | `archive` | 20–40 s | Move old projections to Parquet, truncate live stats |
| 06:00 | `sync-league` | 5–15 s | Yahoo rosters, matchups, transactions |

**Tuesday check (5 minutes):**

1. `/admin/jobs` — all four green?
2. `/admin/diagnostics` — did last week's MAE hold?
3. `/` — do the roster alerts look sane?

If ingest fails, projections run on stale data and everything downstream is quietly wrong. **Check Tuesday, not Sunday.**

### Wednesday — waivers

1. `/waivers` — review recommendations
2. Cross-check against `/players/[id]` for anyone surprising
3. Submit claims in Yahoo
4. Re-run `sync-league` after claims process

### Thursday — pre-TNF

`project` runs again at 12:00 UTC, picking up injury news and line movement.

- `/lineup` — any TNF players in your lineup?
- Confirm no one has been ruled out

### Sunday — game day

**09:00 UTC (~5am ET):** final projection run with the latest injury reports.

**Before 17:00 UTC (1pm ET lock):**

1. `/lineup` — check the projection timestamp is today
2. Resolve anything flagged questionable
3. Review close calls
4. Set lineup in Yahoo

**During games:** `/live` if you enabled it.

### Monday

Nothing scheduled. Data isn't final until Tuesday.

---

## 2. Health checks

### Daily glance

```bash
curl -s https://fantasy.yourdomain.com/api/health | jq
```

```json
{"status":"ok","postgres":"ok","parquet_root":"ok","duckdb":"ok","version":"v2.1.0"}
```

### Weekly (Tuesday)

| Check | Where | Healthy |
|---|---|---|
| Job success | `/admin/jobs` | All green, durations normal |
| Neon storage | `/admin/jobs` | < 300 MB |
| Neon compute | `/admin/jobs` | On pace for < 190h |
| Model MAE | `/admin/diagnostics` | Beating baseline |
| Calibration | `/admin/diagnostics` | Within ±5% |
| Unmatched IDs | `/admin/crosswalk` | < 10 pending |
| Parquet size | `du -sh /srv/fantasy` | Growing ~200 MB/season |

### Monthly

- `pg_dump` restores cleanly into a scratch database
- Yahoo refresh token still valid
- Disk headroom on the VPS

---

## 3. Failure playbooks

### Yahoo token expired or revoked

**Symptoms:** `sync-league` fails 401; `/api/auth/yahoo/status` reports invalid.

**Cause:** password change, revoked app permission, or a refresh token unused for months.

**Fix:**

1. Visit `/api/auth/yahoo/start`
2. Complete consent
3. New refresh token is stored automatically
4. Re-run `sync-league`

**Prevention:** the daily `sync-league` keeps the token warm. If you pause jobs in the offseason, expect to re-consent in August.

---

### Yahoo returns HTTP 999

**Symptoms:** intermittent failures, especially during draft polling.

**Cause:** rate limiting. Undocumented and non-obvious — it's not a 429.

**Fix:**

1. Stop polling for 10–15 minutes
2. Increase the poll interval (10s → 20s)
3. Verify the server-side cache on `/api/draft/poll` is actually working

**During a live draft:** fall back to manual entry of picks. The board still works if you tell it who's gone; it just can't discover picks itself.

---

### nflverse data missing or stale

**Symptoms:** `ingest-week` succeeds but weekly aggregates are empty; projections fall back to baseline.

**Cause:** nflverse publishes on their own schedule and occasionally slips a day.

**Fix:**

1. Check whether the season/week partition exists:
   ```bash
   ls /srv/fantasy/pbp/season=2025/
   ```
2. If missing, wait 12h and re-run — don't fight it
3. If it persists >24h, check the nflverse GitHub for an outage notice
4. Meanwhile projections still run on prior weeks; they're just one week stale. **Say so in the UI rather than silently serving old numbers.**

---

### Projections look obviously wrong

**Symptoms:** a starter projected at 0.4, everyone at the positional mean, wild values.

**Diagnosis, in order:**

1. **Bye week guard.** Is `is_playing` false with a nonzero mean? That's a bug — the application-logic assert before write should have caught it.
2. **Crosswalk break.** Did `player_id` fail to match? `/admin/crosswalk` will show it. Unmatched players fall back to priors.
3. **Scoring settings.** Did the league scoring change? Re-run `sync-league` and check `scoring_json`.
4. **Stale aggregates.** Did `ingest-week` actually write? Check row counts:
   ```sql
   SELECT season, week, count(*) FROM 'weekly/season=2025/*.parquet' GROUP BY 1,2;
   ```
5. **Unit inversion.** Is `target_share` reading as 27 rather than 0.27? See the data dictionary's convention table.

**Fastest triage:** open `/players/[id]` for the wrong-looking player. The breakdown shows arithmetic line by line, so the broken factor is usually visible immediately.

---

### Neon compute-hours running out

**Symptoms:** `/admin/jobs` shows compute on pace to exceed 190h.

**Fix, in order of preference:**

1. **Move backtests fully into DuckDB.** They shouldn't touch Postgres at all.
2. **Batch job connections.** One connection per job, not one per table.
3. **Increase the polling cache TTL** on draft and live endpoints.
4. **Reduce autosuspend sensitivity** — fewer, longer sessions beat many short ones.
5. **Pause the live scoreboard.** It's the least valuable consumer.

**Draft day costs 3–4 hours.** Budget for it in September rather than discovering it in October.

---

### Neon storage approaching 0.5 GB

**Symptoms:** storage > 400 MB on `/admin/jobs`.

**Fix:**

1. Run `archive` manually with an aggressive `before_week`
2. Confirm `live_player_stats` is actually being truncated:
   ```sql
   SELECT count(*) FROM live_player_stats;
   ```
   Anything over ~2,000 rows means the truncate isn't running.
3. Check for orphaned `proj_components` — the largest table by row count:
   ```sql
   SELECT count(*) FROM proj_components pc
   LEFT JOIN projections p ON p.id = pc.projection_id
   WHERE p.id IS NULL;
   ```
4. Verify old `model_version` rows are archived, not accumulating

**Root cause is almost always the archive job not running.** Check `/admin/jobs` first.

---

### ESPN live feed broken

**Symptoms:** `/live` shows stale data or errors.

**Cause:** ESPN changed their undocumented endpoint. This will happen eventually.

**Fix:**

1. Confirm the UI is degrading properly — showing "last updated" rather than erroring
2. Fetch the endpoint manually and diff against your saved fixture
3. Update the parser
4. If it's a large change, **disable the live feature and move on.** It improves no decision.

**This is why ESPN is Phase 6.** Nothing depends on it.

---

### Dokploy redeploy during draft

**Symptoms:** draft board goes blank mid-draft.

**Fix:** wait ~60 seconds for containers to come back, then reload. Drafted players are recovered from Yahoo on the next poll.

**Prevention:** disable auto-deploy before draft day. This is in the deployment section for a reason.

---

### Postgres connection failures

**Symptoms:** 500s across the app; health check reports `postgres: fail`.

**Diagnosis:**

1. Neon status page — is there an incident?
2. Cold start? First query after autosuspend takes ~500ms; timeouts under that are misconfigured.
3. Connection pool exhausted? Check for leaked connections in long-running jobs.

**Fix:** if Neon is down, the app is down. Nothing to do but wait. This is the cost of the managed-DB choice, and it's usually the right trade.

---

## 4. Seasonal operations

### Preseason (July–August)

1. **Update the game key.** Should be automatic, but verify `/game/nfl` returns the new season.
2. **Re-consent Yahoo** if jobs were paused over the offseason.
3. **Backfill last season** into Parquet if you haven't.
4. **Re-run the crosswalk** — rookies need matching.
5. **Retune model parameters** on the completed season.
6. **Snapshot last year's draft results** before anything changes.
7. **Verify league settings** — scoring changes between seasons are common and silently invalidate projections.

### Draft week

1. **Disable Dokploy auto-deploy.**
2. Test `/draft` on your phone.
3. Verify draft polling works against a mock draft.
4. Pre-compute season projections and confirm VORP looks sane.
5. Have a manual pick-entry fallback ready.

### In-season week 1

- Expect high projection error. Nothing has stabilized.
- Opponent adjustments are shrunk to near-zero by design — don't "fix" this.
- Verify the first `archive` run works. It's the one most likely to have a bug, since it never ran in testing.

### Postseason (December)

- Playoff odds become the primary screen
- Trade suggestions stop after the deadline
- Consider pausing waiver recommendations if your league locks rosters

### Offseason (February–June)

1. **Pause all jobs** — saves compute-hours.
2. Final archive of the season.
3. `pg_dump` to `/srv/fantasy/backups/`.
4. Optional: retrospective on model accuracy for the full season.

**Don't delete anything.** Historical data is the training set.

---

## 5. Manual operations

```bash
# Force re-ingest a week
curl -X POST http://api:8000/jobs/ingest-week \
  -d '{"season":2025,"week":7,"force":true}'

# Re-project after a late injury
curl -X POST http://api:8000/projections/run \
  -d '{"league_id":"…","season":2025,"week":7}'

# Emergency archive
curl -X POST http://api:8000/jobs/archive \
  -d '{"season":2025,"before_week":5}'

# Rebuild crosswalk
curl -X POST http://api:8000/jobs/rebuild-crosswalk

# Manual backup
pg_dump $DATABASE_URL > /srv/fantasy/backups/manual-$(date +%F).sql
```

```sql
-- Verify Parquet completeness
SELECT season, week, count(*) AS players
FROM '/srv/fantasy/weekly/season=*/*.parquet'
GROUP BY 1, 2 ORDER BY 1, 2;

-- Postgres table sizes
SELECT relname, pg_size_pretty(pg_total_relation_size(relid))
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC LIMIT 10;

-- Projection sanity: anyone projected while not playing?
SELECT * FROM projections WHERE is_playing = false AND mean > 0;
```

That last query should always return zero rows. If it doesn't, the bye-week guard is broken.

---

## 6. Weekly refresh cron

The projections are kept current by a **Dokploy scheduled task**, not GitHub
Actions — the api is Swarm-internal (not host-published), so nothing outside the
overlay network can reach it, but a schedule *inside* the api service can run the
job in-process.

**The job.** `python -m app.refresh_current` resolves the current NFL week from
the ingested schedule (the earliest regular-season week with a game today or
later, via the DB's `current_date`), force-ingests that season's `player_stats` +
`schedules`, and projects the week. It self-advances week to week and **no-ops in
the offseason** (prints `{"status": "offseason"}` when there's no upcoming week),
so it is safe to leave running year-round. The identical work is also exposed as
`POST /jobs/refresh-current` for a manual HTTP trigger.

**Why the module, not `curl`:** the api image is a slim Python base — **it has no
`curl`** (nor `wget`). Running the module in-process needs no HTTP client and no
network round-trip, and its exit code drives the scheduler's success/failure.

**The schedule (configure in Dokploy → the api service → Schedules):**

| Field | Value |
|---|---|
| Cron | `0 13 * * 3` — Wednesday 13:00 UTC (~8–9am ET) |
| Command | `uv run --no-dev python -m app.refresh_current` |
| Runs in | the api service container (WORKDIR `/app`, same env as the `uv run` CMD) |

Wednesday, because nflverse publishes the completed week Tuesday US morning;
running Wednesday means the projection for the upcoming week is built on complete
prior-week data. It is idempotent — re-running overwrites the same (season, week)
slice — so a missed run is fixed by the next one, or by the **Refresh all** button
on `/projections` (which re-projects every week).

**If projections look stale on a game week:** check the schedule ran (Dokploy
task history), then run it by hand from the api container —
`docker exec <api-container> uv run --no-dev python -m app.refresh_current`.

---

## 6. What "normal" looks like

Reference values so you can recognize abnormal.

| Metric | Normal | Investigate if |
|---|---|---|
| `ingest-week` duration | 3–6 min | > 15 min |
| `project` duration | 1–3 min | > 10 min |
| `archive` duration | 20–40 s | > 3 min |
| `sync-league` duration | 5–15 s | > 60 s |
| Postgres size | 60–150 MB | > 300 MB |
| Parquet size | ~200 MB/season | — |
| Unmatched IDs | 0–10 | > 25 |
| Weekly MAE (RB) | 4.5–5.5 | > 7 |
| Weekly MAE (WR) | 5.0–6.5 | > 8 |
| Sim duration (10k) | 200–800 ms | > 3 s |
| Neon compute/month | 20–40 h | > 60 h in September |

**MAE spikes in weeks 1–3 are normal.** The model has no current-season data. Don't retune based on early-season error.

---

## 7. When to stop trusting the model

Honest failure conditions. If any of these hold, use consensus rankings instead:

1. **MAE worse than baseline for 3+ consecutive weeks.** Something is broken, not just noisy.
2. **Calibration off by >10%.** Predicting 70% and observing 55% means the sim is misleading you.
3. **Losing to FantasyPros consensus over a full season.** Use consensus. This is not a failure — it's the correct response to evidence.
4. **Unmatched crosswalk > 50 players.** Projections are being generated for the wrong people.
5. **Systematic position bias.** If every TE is over-projected by 20%, don't work around it manually — fix the model.

**The diagnostics page exists to tell you the model is bad.** Look at it honestly. A model you've stopped checking is worse than no model, because you'll trust it anyway.
