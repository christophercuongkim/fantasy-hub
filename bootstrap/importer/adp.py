"""Fetch consensus ADP per season → data/<slug>/adp-{season}.csv.

Source: FantasyFootballCalculator's public JSON API — clean {name, position,
adp}, historical, no auth, no browser. The loader joins it by player name to
fill draft_picks.adp_at_time / reach_delta (reach = adp - overall; positive =
drafted earlier than consensus).

The board format (standard / half-PPR / PPR) is chosen per season from the
league's OWN reception setting, so a season's ADP matches how it scored. FFC
has no half-PPR board before 2018, so older half-PPR seasons fall through to
PPR (the closest full-coverage board) — the format actually used is printed
per season. The board is the canonical 12-team draft. Run via `make adp`.
"""

from __future__ import annotations

import argparse
import csv
import json
import time
import urllib.request
from pathlib import Path

import yaml

from importer import config as cfg

ROOT = Path(__file__).resolve().parents[1]  # bootstrap/
API = "https://fantasyfootballcalculator.com/api/v1/adp"
TEAMS = 12  # canonical 12-team board (FFC's richest data); the league is 12-team
UA = "Mozilla/5.0 (compatible; fantasy-hub/1.0)"


def adp_format(rec: float) -> str:
    """FFC board matching the league's per-reception scoring."""
    if rec >= 0.75:
        return "ppr"
    if rec >= 0.25:
        return "half-ppr"
    return "standard"


def format_order(rec: float) -> list[str]:
    """League format first, then full-coverage fallbacks (for pre-2018 half-PPR,
    which FFC doesn't carry). De-duped, order preserved."""
    seen: set[str] = set()
    return [f for f in (adp_format(rec), "ppr", "standard") if not (f in seen or seen.add(f))]


def _rows(players: list[dict]) -> list[dict]:
    return [
        {"name": p["name"], "pos": p.get("position", ""), "adp": float(p["adp"])}
        for p in players
        if p.get("name") and p.get("adp")
    ]


def _get(fmt: str, year: int) -> list[dict]:
    url = f"{API}/{fmt}?teams={TEAMS}&year={year}"
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:  # fixed https host
        return json.loads(r.read()).get("players", [])


def fetch(year: int, rec: float) -> tuple[str, list[dict]]:
    """(format_used, rows). Falls through formats until one has data."""
    for fmt in format_order(rec):
        rows = _rows(_get(fmt, year))
        if rows:
            return fmt, rows
    return adp_format(rec), []


def _write(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["name", "pos", "adp"])
        w.writeheader()
        w.writerows(rows)


def main() -> None:
    ap = argparse.ArgumentParser(description="Fetch consensus ADP per season.")
    ap.add_argument("config", nargs="?", default="config/import.yaml")
    ap.add_argument("--only", help="comma-separated seasons, e.g. 2025,2024")
    args = ap.parse_args()
    only = {int(x) for x in args.only.split(",")} if args.only else None

    doc = yaml.safe_load((ROOT / args.config).read_text())
    for fam in doc["leagues"]:
        data_dir = ROOT / "data" / fam["slug"]
        for season in sorted(int(s) for s in fam["seasons"]):
            if only and season not in only:
                continue
            sf = data_dir / f"settings-{season}.html"
            if not sf.exists():
                print(f"{season}: no settings-{season}.html — skipping")
                continue
            rec = cfg.parse_settings(sf.read_text()).scoring.get("rec", 0.0)
            used, rows = fetch(season, rec)
            _write(data_dir / f"adp-{season}.csv", rows)
            want = adp_format(rec)
            note = "" if used == want else f"  (no {want} board — used {used})"
            print(f"{season}: {len(rows):>3} players  (rec={rec} → {used}){note}")
            time.sleep(0.5)  # be polite


if __name__ == "__main__":
    main()
