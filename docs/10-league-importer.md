# League Importer (Yahoo) + Roadmap

The `bootstrap/` tool imports Yahoo league history (draft + identity + settings)
into Postgres. Built because the Fantasy API needs Yahoo approval we don't have
yet, so we scrape the web UI. Reusable and multi-league from day one.

## What's loaded (as of 2026-07-29)
`people_can_eat` (NFL), seasons 2014–2025 — 12 leagues, 136 teams, 2040 draft
picks, 12 managers, live in prod Neon.

## How it works
- **Model:** one `leagues` row per (family, season); `league_families` groups a
  recurring league by (sport, slug); `managers` is a canonical person keyed on
  the **Yahoo GUID** (global across leagues + sports).
- **Identity:** GUID-era seasons (member years) link teams → managers by GUID.
  Pre-membership seasons load **unclaimed** (`league_teams.manager_id` NULL),
  resolved later via `team_claims`.
- **Sport seam:** `bootstrap/sports/nfl.py` holds the sport-specific bits (URL
  scheme, scoring label→key map, roster vocab, game keys). Another sport = a new
  module + its own enum migration.

## Run it
```sh
# scrape (browser + manual Yahoo login) — refreshes bootstrap/data/<slug>/
nix develop .#scrape -c bash -c 'cd bootstrap && uv run python -m importer.scrape'

# load into a DB (idempotent, re-runnable)
cd bootstrap && DATABASE_URL='<neon-url>' uv run python -m loader.load
```
Data (`bootstrap/data/`) and the Chrome profile are gitignored (personal data).

## Known gaps / follow-ups
- **Pre-2021 playoff structure** is unknown (NULL) — Yahoo's old settings pages
  don't expose it. Downstream playoff logic must handle NULL.
- Scraper settle timing is fixed sleeps; fine for a manual run.

## Next steps (deferred, come back to these)
1. **Team-claims feature** — member-facing page to claim an old unclaimed team
   ("2018 X was me"), admin (Chris) approve action that sets `manager_id`. Table
   + review-queue pattern already exist (mirrors `id_crosswalk_log`).
2. **Superlatives** — `/hall_of_records` page shipped (career/season/week/H2H,
   4 D3 charts, award cards, tables). Deferred: **draft superlatives**
   (best pick / biggest steal) — needs the player crosswalk + each drafted
   player's season fantasy points scored by the league rules (ingest player
   season stats → apply scoring → crosswalk `draft_picks.player_name` →
   value vs. draft slot). Build after the crosswalk (see #1-style review queue).
3. **Manager tendency profiles (private, Chris-only)** — a deep per-manager
   scouting report for competitive intel, gated to `is_mine`/admin (NOT the
   public hall of records). Per opponent: draft tendencies (positional priority
   by round, reach/steal habits, favorite teams/players), roster construction,
   in-season behavior (waiver aggressiveness, trade patterns), scoring/lineup
   patterns, and how they play *you* (H2H/matchup tendencies). Aligns with the
   planned `manager_profiles` (schema §Phase 5); leans on the same data +
   draft superlatives + the player crosswalk. Auth-gated route.
4. **Add league #2** — new entry in `config/import.yaml`, re-run. Cross-league
   identity links automatically via GUID.
5. **Multi-sport (layer 3)** — per-sport enum migration + `sports/<sport>.py`.
6. **Loader hardening** — error handling, per-league transactions, dry-run, reporting.
