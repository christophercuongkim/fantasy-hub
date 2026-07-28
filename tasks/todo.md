# PR: multi-league Yahoo importer + bootstrap consolidation

Reshapes the open PR #23 (single-league loader) into a reusable, multi-league
Yahoo importer. One PR (same in-flight work). Claims **UI** deferred; claims
**table** lands now so unclaimed teams are representable.

## Decisions (locked with Chris)
1. `managers` table keyed on Yahoo **GUID** (global across leagues + sports). ✅
2. `league_families` grouping = auto `(sport, slug)`. ✅
3. Positions/roster = **pg enums, one migration per sport** (NFL now; NBA/etc add their own later). ✅
4. **Redirect PR #23** into this (not merged yet). ✅
5. **One PR.** ✅
6. **Consolidate** all bootstrap into a top-level tool (out of `api/app/`). ✅

## Target layout (top-level, self-contained local tool)
```
bootstrap/
  pyproject.toml            own uv env (selenium, bs4, pandas, psycopg, pyyaml)
  config/import.yaml        leagues to import: [{sport, slug, name, seasons}]
  sports/nfl.py             sport abstraction: URL scheme, scoring label->key, positions
  importer/
    scrape.py               browser -> normalized files (draft, teams, settings)  [from scratch/league_scrape.py]
    identity.py             GUID managers, latest-season display name, remap
    build_config.py         settings page -> league config  [from scratch/build_league_yaml.py]
  loader/
    db.py                   thin psycopg connect (DATABASE_URL)
    load.py                 files -> Postgres (multi-league, raw SQL)
  data/                     gitignored scraped output: <slug>/<season>/{draft,teams}.csv
  tests/
```
- DELETE `api/app/bootstrap/` (move loader here; it uses raw SQL, no api coupling).
- Data files stay gitignored (personal data: emails, GUIDs).

## Schema (web/db/schema, drizzle migrations — timestamp filenames)
- `league_families`: id, sport (enum), yahoo_slug, name, unique(sport, yahoo_slug).
- `managers`: id, yahoo_guid unique, display_name, email. Canonical person (global).
- `leagues`: add family_id FK, sport. One row per (family, season). yahoo_league_key unique stays.
- `league_teams`: add manager_id FK -> managers (NULL = unclaimed). Keep name (vanity). Drop/keep manager_name (superseded by manager_id).
- `team_claims`: id, league_team_id FK, claimant_manager_id FK, status enum(pending|approved|rejected), reviewed_by, reviewed_at. (UI later.)
- Per-sport enums: keep existing NFL position/roster enums as the "NFL migration"; future sports add their own.

## Loader behavior (multi-league)
- For each league in import.yaml: upsert league_family; per season -> upsert leagues row (yahoo_league_key + season).
- Upsert managers by GUID (display_name = latest season). league_teams.manager_id set when GUID known; NULL for hidden-era (claimable).
- draft_picks per (league row, overall) -> league_team.
- Idempotent / re-runnable (annual refresh).

## Build order (commits on feat/league-bootstrap)
1. Schema + migrations (families, managers, team_claims, leagues/league_teams cols).
2. `bootstrap/` scaffold + pyproject + sports/nfl.py abstraction.
3. Move + productionize scraper (scratch -> importer/scrape.py).
4. Identity + build_config modules.
5. Multi-league loader + db.py.
6. Delete api/app/bootstrap/; move/adapt its tests.
7. Wire import.yaml for people_can_eat; end-to-end load of scraped data.
8. Tests; self-review on PR.

## Deferred (not this PR)
- Claims member UI + admin approve action.
- Multi-sport (NBA etc.) — layer 3; add sport migration + sports/<sport>.py when needed.

## Review — implemented
Commits on feat/league-bootstrap (reshapes PR #23):
- e0fff2f schema: league_families, managers (GUID), team_claims, leagues/league_teams cols
- dbf20c0 bootstrap tool: sports/nfl, importer/config, loader, packaging + data reorg
- c52633b remove api/app/bootstrap (35 api tests still pass)
- dcdccae productionize scraper (browser + scrape) + config tests (5 pass)
- (idempotency) league_teams unique(league_id,name) + COALESCE upsert; borrow-nearest settings

**Verified end-to-end on ephemeral local Postgres** (all 5→6 migrations apply clean):
- 1 family / 12 managers / 12 leagues / 136 teams / 2040 picks; 88 unclaimed (hidden era)
- idempotent: 2nd run identical
- claim preservation: a simulated approved claim survives a re-scrape (COALESCE)
- cross-season superlative query works via manager join

### Not browser-verified / follow-ups
- importer/scrape.py is a faithful port of the working scratch scraper but not
  re-run against a live browser. Chris should re-scrape (the new scraper dumps
  settings for EVERY season) to replace borrow-nearest with each season's real
  scoring/roster for 2014-2021.
- Deferred: team-claims member UI + admin approve; multi-sport (layer 3).
