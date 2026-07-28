"""Load scraped league history into Postgres — multi-league, idempotent.

Per family in config/import.yaml, per season with scraped data:
  league_families -> leagues (one row/season) -> managers (by GUID, global)
  -> league_teams (manager_id, NULL = unclaimed) -> draft_picks.

Draft picks join to teams by raw team name within the season; teams carry the
GUID that resolves the canonical manager. Hidden (pre-membership) seasons have
no GUID, so those teams load unclaimed and get linked later via team_claims.

Run: DATABASE_URL=... python -m bootstrap.loader.load [config/import.yaml]
"""

from __future__ import annotations

import csv
import sys
from pathlib import Path

import psycopg
import yaml
from psycopg.types.json import Json

from importer import config as cfg
from loader import db
from sports import nfl

ROOT = Path(__file__).resolve().parents[1]  # bootstrap/


def _read_csv(path: Path) -> list[dict]:
    return list(csv.DictReader(path.read_text().splitlines())) if path.exists() else []


def _upsert_family(cur: psycopg.Cursor, sport: str, slug: str, name: str) -> str:
    cur.execute(
        """
        INSERT INTO league_families (sport, yahoo_slug, name, updated_at)
        VALUES (%s, %s, %s, now())
        ON CONFLICT (sport, yahoo_slug) DO UPDATE SET name = EXCLUDED.name,
            updated_at = now()
        RETURNING id
        """,
        (sport, slug, name),
    )
    return cur.fetchone()[0]


def _upsert_manager(cur: psycopg.Cursor, guid: str, display: str, email: str) -> str:
    cur.execute(
        """
        INSERT INTO managers (yahoo_guid, display_name, email, updated_at)
        VALUES (%s, %s, %s, now())
        ON CONFLICT (yahoo_guid) DO UPDATE SET display_name = EXCLUDED.display_name,
            email = COALESCE(NULLIF(EXCLUDED.email, ''), managers.email),
            updated_at = now()
        RETURNING id
        """,
        (guid, display, email or None),
    )
    return cur.fetchone()[0]


def _upsert_league(cur: psycopg.Cursor, family_id: str, s: cfg.LeagueSettings,
                   season: int, key: str) -> str:
    cur.execute(
        """
        INSERT INTO leagues (family_id, sport, yahoo_league_key, name, season,
            num_teams, scoring_json, roster_positions_json, playoff_start_week,
            num_playoff_teams, waiver_type, trade_deadline, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, now())
        ON CONFLICT (yahoo_league_key) DO UPDATE SET name = EXCLUDED.name,
            num_teams = EXCLUDED.num_teams, scoring_json = EXCLUDED.scoring_json,
            roster_positions_json = EXCLUDED.roster_positions_json,
            playoff_start_week = EXCLUDED.playoff_start_week,
            num_playoff_teams = EXCLUDED.num_playoff_teams,
            waiver_type = EXCLUDED.waiver_type,
            trade_deadline = EXCLUDED.trade_deadline, updated_at = now()
        RETURNING id
        """,
        (family_id, nfl.CODE, key, s.name or "", season, s.num_teams,
         Json(cfg.scoring_json(s)), Json(s.roster_positions), s.playoff_start_week,
         s.num_playoff_teams, s.waiver_type, s.trade_deadline),
    )
    return cur.fetchone()[0]


def _load_season(cur, family_id, slug, season, owner_guid, data_dir) -> dict:
    settings_html = data_dir / f"settings-{season}.html"
    teams = _read_csv(data_dir / f"teams-{season}.csv")
    draft = _read_csv(data_dir / f"draft-{season}.csv")
    if not teams or not draft:
        return {"season": season, "skipped": "no teams/draft csv"}

    if settings_html.exists():
        s = cfg.parse_settings(settings_html.read_text())
    else:
        # No settings page scraped for this season: fall back to a minimal config
        # (num_teams from the roster we do have). Scoring/roster left empty — rerun
        # the scraper with --settings to fill these in.
        s = cfg.LeagueSettings(
            league_id=f"{slug}-{season}", name=slug, num_teams=len(teams),
            scoring={}, roster_positions={}, playoff_start_week=None,
            num_playoff_teams=None, waiver_type=None, trade_deadline=None,
        )
    key = nfl.league_key(season, s.league_id or f"{slug}-{season}")
    league_id = _upsert_league(cur, family_id, s, season, key)

    # teams: upsert manager by GUID, create league_team, map team_name -> id
    team_to_id: dict[str, str] = {}
    n_claimed = 0
    for t in teams:
        manager_id = None
        if t.get("guid"):
            manager_id = _upsert_manager(
                cur, t["guid"], _display(t["manager"]), t.get("email", "")
            )
            n_claimed += 1
        cur.execute(
            """
            INSERT INTO league_teams (league_id, manager_id, name, is_mine)
            VALUES (%s, %s, %s, %s) RETURNING id
            """,
            (league_id, manager_id, t["team_name"], t.get("guid") == owner_guid),
        )
        team_to_id[_norm(t["team_name"])] = cur.fetchone()[0]

    # draft picks -> league_team by raw team name
    picks = 0
    for d in draft:
        ltid = team_to_id.get(_norm(d["manager"]))
        if ltid is None:
            raise ValueError(f"{season}: draft team {d['manager']!r} not in teams csv")
        cur.execute(
            """
            INSERT INTO draft_picks (league_id, season, overall, round,
                pick_in_round, league_team_id, player_name, player_key, cost)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (league_id, season, overall) DO UPDATE SET
                round = EXCLUDED.round, pick_in_round = EXCLUDED.pick_in_round,
                league_team_id = EXCLUDED.league_team_id,
                player_name = EXCLUDED.player_name, cost = EXCLUDED.cost
            """,
            (league_id, season, int(d["overall"]), int(d["round"]),
             int(d["pick_in_round"]), ltid, d["player_name"],
             d.get("player_key") or None, _int_or_none(d.get("cost"))),
        )
        picks += 1
    return {"season": season, "teams": len(teams), "claimed": n_claimed, "picks": picks}


def _display(name: str) -> str:
    import re
    return re.sub(r"\s*Commissioner\s*$", "", name).strip()


def _norm(s: str) -> str:
    import re
    return re.sub(r"\s+", " ", s).strip().lower()


def _int_or_none(v):
    v = (v or "").strip()
    return int(v) if v.isdigit() else None


def load(config_path: Path) -> list[dict]:
    doc = yaml.safe_load(config_path.read_text())
    results = []
    with db.connect() as conn, conn.cursor() as cur:
        for fam in doc["leagues"]:
            family_id = _upsert_family(cur, fam["sport"], fam["slug"], fam["name"])
            data_dir = ROOT / "data" / fam["slug"]
            owner_guid = fam.get("owner_guid")
            # ascending so managers.display_name ends on the latest season's name
            for season in sorted(int(s) for s in fam["seasons"]):
                results.append(
                    _load_season(cur, family_id, fam["slug"], season, owner_guid, data_dir)
                )
        conn.commit()
    return results


def main() -> None:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "config" / "import.yaml"
    for r in load(path):
        print(r)


if __name__ == "__main__":
    main()
