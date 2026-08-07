"""Load scraped league history into Postgres — multi-league, idempotent, batched.

Per family in config/import.yaml, per season with scraped data:
  managers (deduped by GUID, upserted once) -> league_families -> leagues
  (one row/season) -> league_teams (manager_id, NULL = unclaimed) -> draft_picks.

Draft picks join to teams by raw team name within the season. Writes are batched
with executemany (psycopg3 pipelines them) so a remote Neon load isn't thousands
of serial round-trips.

Run: DATABASE_URL=... python -m loader.load [config/import.yaml] [--only 2025,2024]
"""

from __future__ import annotations

import argparse
import csv
import re
import time
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


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip().lower()


def _display(name: str) -> str:
    return re.sub(r"\s*Commissioner\s*$", "", name).strip()


def _int_or_none(v):
    v = (v or "").strip()
    return int(v) if v.isdigit() else None


# --------------------------------------------------------------------------- #
# managers — deduped across every league + season, upserted in one pass
# --------------------------------------------------------------------------- #
def _manager_registry(families: list[dict]) -> dict[str, tuple[str, str]]:
    """guid -> (display_name, email). display_name follows latest-season-wins;
    email is the most recent non-empty one. One entry per person, globally."""
    latest: dict[str, tuple[int, str]] = {}  # guid -> (season, display)
    email: dict[str, tuple[int, str]] = {}  # guid -> (season, email)
    for fam in families:
        data_dir = ROOT / "data" / fam["slug"]
        for season in fam["seasons"]:
            for t in _read_csv(data_dir / f"teams-{season}.csv"):
                guid = t.get("guid")
                if not guid:
                    continue
                s = int(t["season"])
                if guid not in latest or s > latest[guid][0]:
                    latest[guid] = (s, _display(t["manager"]))
                if t.get("email") and (guid not in email or s > email[guid][0]):
                    email[guid] = (s, t["email"])
    return {g: (disp, email.get(g, (0, ""))[1]) for g, (_, disp) in latest.items()}


def _upsert_managers(cur: psycopg.Cursor, registry: dict[str, tuple[str, str]]) -> dict[str, str]:
    if not registry:
        return {}
    cur.executemany(
        """
        INSERT INTO managers (yahoo_guid, display_name, email, updated_at)
        VALUES (%s, %s, %s, now())
        ON CONFLICT (yahoo_guid) DO UPDATE SET display_name = EXCLUDED.display_name,
            email = COALESCE(NULLIF(EXCLUDED.email, ''), managers.email),
            updated_at = now()
        """,
        [(g, disp, mail or None) for g, (disp, mail) in registry.items()],
    )
    cur.execute(
        "SELECT yahoo_guid, id FROM managers WHERE yahoo_guid = ANY(%s)",
        (list(registry),),
    )
    return {g: mid for g, mid in cur.fetchall()}


# --------------------------------------------------------------------------- #
# league / teams / picks
# --------------------------------------------------------------------------- #
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


def _upsert_league(cur, family_id, s: cfg.LeagueSettings, season: int, key: str) -> str:
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


def _load_season(cur, family_id, slug, season, owner_guid, guid_to_mid, s, data_dir) -> dict:
    teams = _read_csv(data_dir / f"teams-{season}.csv")
    draft = _read_csv(data_dir / f"draft-{season}.csv")
    if not teams or not draft:
        return {"season": season, "skipped": "no teams/draft csv"}

    s.num_teams = len(teams)  # authoritative per season (league size changed)
    key = nfl.league_key(season, s.league_id or f"{slug}-{season}")
    league_id = _upsert_league(cur, family_id, s, season, key)

    # batch-upsert teams; COALESCE keeps a claim-set manager_id when the scrape
    # has none (hidden era).
    cur.executemany(
        """
        INSERT INTO league_teams (league_id, manager_id, name, is_mine)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (league_id, name) DO UPDATE SET
            manager_id = COALESCE(EXCLUDED.manager_id, league_teams.manager_id),
            is_mine = EXCLUDED.is_mine
        """,
        [(league_id, guid_to_mid.get(t["guid"]) if t.get("guid") else None,
          t["team_name"], bool(owner_guid) and t.get("guid") == owner_guid)
         for t in teams],
    )
    cur.execute("SELECT id, name FROM league_teams WHERE league_id = %s", (league_id,))
    team_to_id = {_norm(name): tid for tid, name in cur.fetchall()}

    missing = sorted({d["manager"] for d in draft if _norm(d["manager"]) not in team_to_id})
    if missing:
        raise ValueError(f"{season}: draft teams not in teams.csv: {missing}")

    # Consensus ADP (make adp) → adp_at_time + reach_delta. Matched on the same
    # normalized name; unmatched picks (defenses, deep sleepers below the ~top-200
    # board) keep NULL adp. reach = adp - overall; positive = drafted early.
    adp_by_name = {
        _norm(a["name"]): float(a["adp"])
        for a in _read_csv(data_dir / f"adp-{season}.csv")
        if (a.get("adp") or "").strip()
    }

    def _adp_reach(d):
        adp = adp_by_name.get(_norm(d.get("player_name") or ""))
        return (None, None) if adp is None else (adp, round(adp - int(d["overall"]), 1))

    picks, matched = [], 0
    for d in draft:
        adp, reach = _adp_reach(d)
        matched += adp is not None
        picks.append((league_id, season, int(d["overall"]), int(d["round"]),
                      int(d["pick_in_round"]), team_to_id[_norm(d["manager"])],
                      d["player_name"], d.get("player_key") or None,
                      _int_or_none(d.get("cost")), adp, reach))

    cur.executemany(
        """
        INSERT INTO draft_picks (league_id, season, overall, round, pick_in_round,
            league_team_id, player_name, player_key, cost, adp_at_time, reach_delta)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (league_id, season, overall) DO UPDATE SET
            round = EXCLUDED.round, pick_in_round = EXCLUDED.pick_in_round,
            league_team_id = EXCLUDED.league_team_id,
            player_name = EXCLUDED.player_name, cost = EXCLUDED.cost,
            adp_at_time = EXCLUDED.adp_at_time, reach_delta = EXCLUDED.reach_delta
        """,
        picks,
    )
    counts = {"season": season, "teams": len(teams),
              "claimed": sum(1 for t in teams if t.get("guid")), "picks": len(draft),
              "adp": f"{matched}/{len(draft)}"}
    _load_standings(cur, league_id, team_to_id, data_dir, season, counts)
    _load_matchups(cur, league_id, team_to_id, data_dir, season,
                   s.playoff_start_week, counts)
    return counts


def _load_standings(cur, league_id, team_to_id, data_dir, season, counts) -> None:
    """final_rank only (1 = champion, final placement). W-L-T / PF / PA come from
    matchups so they're all on the same game set (regular season)."""
    rows = _read_csv(data_dir / f"standings-{season}.csv")
    if not rows:
        return
    updates = [
        (_int_or_none(r.get("final_rank")), team_to_id[_norm(r["team_name"])])
        for r in rows if _norm(r["team_name"]) in team_to_id
    ]
    cur.executemany(
        "UPDATE league_teams SET final_rank = %s WHERE id = %s", updates
    )
    counts["standings"] = len(updates)


def _load_matchups(cur, league_id, team_to_id, data_dir, season, playoff_week, counts) -> None:
    rows = _read_csv(data_dir / f"matchups-{season}.csv")
    if not rows:
        return
    cur.execute("DELETE FROM matchups WHERE league_id = %s", (league_id,))  # clean replace
    rec: dict[str, list] = {}  # team_id -> [w, l, t, pf, pa]
    inserts = []
    for r in rows:
        a = team_to_id.get(_norm(r["team_a"]))
        b = team_to_id.get(_norm(r["team_b"]))
        if a is None or b is None:
            continue
        sa, sb, week = float(r["score_a"]), float(r["score_b"]), int(r["week"])
        is_playoff = bool(playoff_week) and week >= playoff_week
        # store every matchup once with canonical ordering (lower UUID as team_a)
        if str(a) <= str(b):
            inserts.append((league_id, week, a, b, sa, sb, is_playoff))
        else:
            inserts.append((league_id, week, b, a, sb, sa, is_playoff))
        # records/PF/PA from REGULAR SEASON only (matches how standings work);
        # playoff games live in `matchups` for separate queries.
        if is_playoff:
            continue
        for tid, own, opp in ((a, sa, sb), (b, sb, sa)):
            w = rec.setdefault(tid, [0, 0, 0, 0.0, 0.0])
            w[3] += own
            w[4] += opp
            w[0 if own > opp else 1 if own < opp else 2] += 1
    cur.executemany(
        """
        INSERT INTO matchups (league_id, week, team_a_id, team_b_id,
            team_a_score, team_b_score, is_playoff)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        """,
        inserts,
    )
    cur.executemany(
        """
        UPDATE league_teams SET wins = %s, losses = %s, ties = %s,
            points_for = %s, points_against = %s WHERE id = %s
        """,
        [(w[0], w[1], w[2], round(w[3], 2), round(w[4], 2), tid) for tid, w in rec.items()],
    )
    counts["matchups"] = len(inserts)


def _settings_for(seasons, data_dir, slug) -> dict[int, cfg.LeagueSettings]:
    """Parse each season's settings page; borrow the nearest year's config for
    seasons scraped without one. Borrowed seasons get a synthetic league_id so
    their yahoo_league_key stays unique."""
    import dataclasses

    parsed = {
        season: cfg.parse_settings((data_dir / f"settings-{season}.html").read_text())
        for season in seasons
        if (data_dir / f"settings-{season}.html").exists()
    }
    if not parsed:
        raise SystemExit(f"{slug}: no settings-*.html at all; scrape settings first")
    out = {}
    for season in seasons:
        if season in parsed:
            out[season] = parsed[season]
        else:
            nearest = min(parsed, key=lambda y: abs(y - season))
            out[season] = dataclasses.replace(
                parsed[nearest], league_id=f"{slug}-{season}", name=slug
            )
    return out


def load(config_path: Path, only: set[int] | None = None) -> list[dict]:
    doc = yaml.safe_load(config_path.read_text())
    families = doc["leagues"]
    t0 = time.monotonic()

    registry = _manager_registry(families)
    results: list[dict] = []
    with db.connect() as conn, conn.cursor() as cur:
        guid_to_mid = _upsert_managers(cur, registry)
        print(f"managers: {len(guid_to_mid)} upserted (by GUID)", flush=True)
        for fam in families:
            family_id = _upsert_family(cur, fam["sport"], fam["slug"], fam["name"])
            data_dir = ROOT / "data" / fam["slug"]
            owner_guid = fam.get("owner_guid")
            seasons = sorted(int(s) for s in fam["seasons"] if not only or int(s) in only)
            settings = _settings_for(seasons, data_dir, fam["slug"])
            for season in seasons:
                print(f"  [{fam['slug']} {season}] loading…", end="", flush=True)
                r = _load_season(cur, family_id, fam["slug"], season, owner_guid,
                                 guid_to_mid, settings[season], data_dir)
                results.append(r)
                if "skipped" in r:
                    print(f"\r  [{fam['slug']} {season}] skipped: {r['skipped']}   ", flush=True)
                else:
                    extra = f" matchups={r['matchups']}" if "matchups" in r else ""
                    print(f"\r  [{fam['slug']} {season}] teams={r['teams']} "
                          f"claimed={r['claimed']} picks={r['picks']}{extra}      ", flush=True)
        conn.commit()

    dt = time.monotonic() - t0
    picks = sum(r.get("picks", 0) for r in results)
    print(f"done: {len(results)} seasons, {picks} picks, {len(registry)} managers "
          f"in {dt:.1f}s", flush=True)
    return results


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("config", nargs="?", default=str(ROOT / "config" / "import.yaml"))
    ap.add_argument("--only", help="comma seasons to load, e.g. 2025,2024")
    args = ap.parse_args()
    only = {int(s) for s in args.only.split(",")} if args.only else None
    load(Path(args.config), only)


if __name__ == "__main__":
    main()
