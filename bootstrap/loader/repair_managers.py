"""Undo the hidden-GUID manager (CHR-571) — one transaction, dry run by default.

A sync once minted a managers row whose yahoo_guid was Yahoo's "--hidden--"
placeholder, linked every hidden team to it, and so overwrote the real links the
bootstrap had made from the scraped CSVs. Renames in the current season had
also stacked up as duplicate league_teams rows, one per name.

Steps, in order:
  1. relink every team the CSVs know by GUID, where the row is unclaimed or
     points at a fake manager (same rule as the loader: CSV GUID wins);
  2. merge duplicate rows per (league, yahoo_team_key) into one keeper, moving
     rosters, picks, matchups, transactions and claims onto it;
  3. unlink whatever still points at a fake manager, then delete the fakes.

Run: cd bootstrap && DATABASE_URL=... uv run python -m loader.repair_managers [--apply]
Without --apply everything runs and is rolled back, so the counts are real.
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path

import psycopg
import yaml

from loader import db
from loader.load import ROOT, _manager_registry, _read_csv, _upsert_managers

GUID = re.compile(r"^[A-Z0-9]{26}$")

# (table, column) pairs that point at a league_teams row.
CHILD_REFS = [
    ("rosters", "league_team_id"),
    ("draft_picks", "league_team_id"),
    ("matchups", "team_a_id"),
    ("matchups", "team_b_id"),
    ("transactions", "source_team_id"),
    ("transactions", "destination_team_id"),
    ("team_claims", "league_team_id"),
]


def keeper(rows: list[dict], fake: set) -> dict:
    """Among duplicate rows for one team key, keep the one with a real manager,
    then the most draft picks, then the one flagged mine."""
    return max(
        rows,
        key=lambda r: (
            r["manager_id"] is not None and r["manager_id"] not in fake,
            r["picks"],
            r["is_mine"],
        ),
    )


def _fake_managers(cur: psycopg.Cursor) -> set:
    cur.execute("SELECT id FROM managers WHERE yahoo_guid !~ %s", (GUID.pattern,))
    return {r[0] for r in cur.fetchall()}


def _relink_from_csv(cur: psycopg.Cursor, families: list[dict], fake: set) -> int:
    guid_to_mid = _upsert_managers(cur, _manager_registry(families))
    relinked = 0
    for fam in families:
        data_dir = ROOT / "data" / fam["slug"]
        owner = fam.get("owner_guid")
        cur.execute(
            "SELECT id FROM league_families WHERE sport = %s AND yahoo_slug = %s",
            (fam["sport"], fam["slug"]),
        )
        family = cur.fetchone()
        if not family:
            continue
        for season in fam["seasons"]:
            cur.execute(
                "SELECT id FROM leagues WHERE family_id = %s AND season = %s",
                (family[0], season),
            )
            league = cur.fetchone()
            if not league:
                continue
            for t in _read_csv(data_dir / f"teams-{season}.csv"):
                guid = t.get("guid") or ""
                if not GUID.match(guid):
                    continue
                cur.execute(
                    """
                    UPDATE league_teams SET manager_id = %s, is_mine = %s
                    WHERE league_id = %s AND name = %s
                      AND (manager_id IS NULL OR manager_id = ANY(%s))
                    """,
                    (guid_to_mid[guid], guid == owner, league[0], t["team_name"], list(fake)),
                )
                relinked += cur.rowcount
    return relinked


def _merge_duplicates(cur: psycopg.Cursor, fake: set) -> list[str]:
    cur.execute(
        """
        SELECT lt.league_id, lt.yahoo_team_key, lt.id, lt.name, lt.manager_id, lt.is_mine,
               (SELECT count(*) FROM draft_picks d WHERE d.league_team_id = lt.id) AS picks
        FROM league_teams lt
        WHERE lt.yahoo_team_key IS NOT NULL
        ORDER BY lt.league_id, lt.yahoo_team_key, lt.name
        """
    )
    groups: dict[tuple, list[dict]] = {}
    for league_id, key, tid, name, mid, mine, picks in cur.fetchall():
        groups.setdefault((league_id, key), []).append(
            {"id": tid, "name": name, "manager_id": mid, "is_mine": mine, "picks": picks}
        )
    log = []
    for (_, key), rows in groups.items():
        if len(rows) < 2:
            continue
        keep = keeper(rows, fake)
        for r in rows:
            if r is keep:
                continue
            for table, col in CHILD_REFS:
                cur.execute(
                    f"UPDATE {table} SET {col} = %s WHERE {col} = %s",  # noqa: S608 — fixed names
                    (keep["id"], r["id"]),
                )
            if r["is_mine"]:
                cur.execute("UPDATE league_teams SET is_mine = true WHERE id = %s", (keep["id"],))
            cur.execute("DELETE FROM league_teams WHERE id = %s", (r["id"],))
            log.append(f"{key}: merged {r['name']!r} into {keep['name']!r}")
    return log


def repair(cur: psycopg.Cursor, config_path: Path) -> dict:
    fake = _fake_managers(cur)
    families = yaml.safe_load(config_path.read_text())["leagues"]
    relinked = _relink_from_csv(cur, families, fake)
    merged = _merge_duplicates(cur, fake)
    cur.execute("UPDATE league_teams SET manager_id = NULL WHERE manager_id = ANY(%s)", (list(fake),))
    unlinked = cur.rowcount
    cur.execute("DELETE FROM team_claims WHERE claimant_manager_id = ANY(%s)", (list(fake),))
    cur.execute("DELETE FROM managers WHERE id = ANY(%s)", (list(fake),))
    return {
        "fake_managers": len(fake),
        "relinked_from_csv": relinked,
        "merged": merged,
        "unlinked_still_hidden": unlinked,
        "deleted_managers": cur.rowcount,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("config", nargs="?", default=str(ROOT / "config" / "import.yaml"))
    ap.add_argument("--apply", action="store_true", help="commit; default is dry run")
    args = ap.parse_args()
    with db.connect() as conn, conn.cursor() as cur:
        out = repair(cur, Path(args.config))
        for line in out.pop("merged"):
            print("  " + line)
        print(out)
        if args.apply:
            conn.commit()
            print("committed")
        else:
            conn.rollback()
            print("dry run: rolled back (add --apply to commit)")


if __name__ == "__main__":
    main()
