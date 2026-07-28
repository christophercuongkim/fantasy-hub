"""Scrape Yahoo league history into data/<slug>/ for the loader.

Per league in config/import.yaml, per season: resolve the archived league URL
off the stable slug landing page, then scrape the draft grid, the teams/identity
table, and the settings page.

Run (NixOS): nix shell nixpkgs#chromedriver nixpkgs#chromium -c \
  uv run python -m importer.scrape [--attach 127.0.0.1:9222] [--only 2025,2024]
"""

from __future__ import annotations

import argparse
import re
import time
from pathlib import Path

import pandas as pd
import yaml
from bs4 import BeautifulSoup
from selenium.webdriver.common.by import By

from importer import browser
from sports import nfl

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "config" / "import.yaml"


def _norm(s: str) -> str:
    return re.sub(r"[^\x20-\x7e]", "", re.sub(r"\s*\([^)]*\)", "", s)).strip()


def resolve_base(driver, slug: str, season: int) -> str:
    """slug landing page -> the real /<year>/f1/<id> base (each season its own id)."""
    browser.goto(driver, nfl.slug_landing(slug, season))
    soup = BeautifulSoup(driver.page_source, "lxml")
    a = soup.find("a", href=re.compile(rf"/{season}/f1/\d+/draftresults")) or soup.find(
        "a", href=re.compile(rf"/{season}/f1/\d+")
    )
    if not a:
        raise RuntimeError(f"{season}: no /{season}/f1/<id> link on landing page")
    return f"{nfl.FBALL}" + re.search(rf"(/{season}/f1/\d+)", a["href"]).group(1)


def scrape_draft(driver, base: str, season: int) -> pd.DataFrame:
    """drafttab=picks grid: one table.Table per team; rows are round/(overall)/player.
    Player cells hydrate via JS (undrafted stay .emptyplayer)."""
    browser.goto(driver, nfl.draft_url(base))
    for _ in range(20):
        if driver.find_elements(By.CSS_SELECTOR, "td.player a"):
            break
        time.sleep(0.5)
    soup = BeautifulSoup(driver.page_source, "lxml")
    tables = [t for t in soup.select("table.Table") if t.find("th")]
    rows = []
    for tbl in tables:
        team = tbl.find("th").get_text(strip=True)
        for tr in tbl.select("tbody tr"):
            first, pick, player = (tr.select_one(f"td.{c}") for c in ("first", "pick", "player"))
            if not (first and pick and player) or player.select_one(".emptyplayer"):
                continue
            link = player.find("a")
            rows.append({
                "overall": int(re.sub(r"\D", "", pick.get_text())),
                "round": int(re.sub(r"\D", "", first.get_text())),
                "manager": team,  # raw team name; loader joins to teams.csv
                "player_name": _norm((link or player).get_text(" ", strip=True)),
            })
    if not rows:
        raise RuntimeError(f"{season}: no filled draft picks (draft done for this id?)")
    df = pd.DataFrame(rows)
    n = len(tables)
    df["pick_in_round"] = df["overall"].map(lambda o: ((o - 1) % n) + 1)
    df["player_key"] = ""
    df["cost"] = ""
    return df.sort_values("overall")[
        ["overall", "round", "pick_in_round", "manager", "player_name", "player_key", "cost"]
    ]


def scrape_teams(driver, base: str, season: int) -> pd.DataFrame:
    """/teams: Team Name | Manager | Email; Manager links to /user/<GUID> (stable key)."""
    browser.goto(driver, nfl.teams_url(base))
    soup = BeautifulSoup(driver.page_source, "lxml")
    for tbl in soup.select("table"):
        heads = [th.get_text(strip=True) for th in tbl.select("th")]
        if "Team Name" not in heads or "Manager" not in heads:
            continue
        rows = []
        for tr in tbl.select("tbody tr"):
            tds = tr.find_all("td")
            if len(tds) < 3 or not tds[0].get_text(strip=True):
                continue
            profile = tds[1].find("a", href=re.compile(r"/user/"))
            guid = re.search(r"/user/([^/]+)", profile["href"]).group(1) if profile else ""
            email = tds[2].get_text(" ", strip=True)
            rows.append({
                "season": season,
                "team_name": tds[0].get_text(" ", strip=True),
                "manager": tds[1].get_text(" ", strip=True),
                "guid": guid,
                "email": "" if email in ("--hidden--", "") else email,
            })
        if rows:
            return pd.DataFrame(rows)
    raise RuntimeError(f"{season}: Team Name/Manager table not found")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--attach", metavar="HOST:PORT", help="attach to your own Chrome")
    ap.add_argument("--only", help="comma seasons to limit to, e.g. 2025,2024")
    ap.add_argument("--user-data-dir", default=str(ROOT / ".chrome-profile"))
    args = ap.parse_args()

    doc = yaml.safe_load(CONFIG.read_text())
    driver = browser.build_driver(Path(args.user_data_dir), args.attach)
    try:
        if not args.attach:
            browser.manual_login_gate(driver)
        for fam in doc["leagues"]:
            out = ROOT / "data" / fam["slug"]
            out.mkdir(parents=True, exist_ok=True)
            seasons = [int(s) for s in fam["seasons"]]
            if args.only:
                keep = {int(s) for s in args.only.split(",")}
                seasons = [s for s in seasons if s in keep]
            for season in seasons:
                print(f"[{fam['slug']} {season}]", flush=True)
                try:
                    base = resolve_base(driver, fam["slug"], season)
                    scrape_draft(driver, base, season).to_csv(out / f"draft-{season}.csv", index=False)
                    tdf = scrape_teams(driver, base, season)
                    tdf.to_csv(out / f"teams-{season}.csv", index=False)
                    browser.goto(driver, nfl.settings_url(base))
                    (out / f"settings-{season}.html").write_text(driver.page_source, encoding="utf-8")
                    print(f"  ok: {tdf['guid'].astype(bool).sum()}/{len(tdf)} guids", flush=True)
                except Exception as e:  # noqa: BLE001 - report, keep going
                    print(f"  FAILED: {e}", flush=True)
    finally:
        if args.attach:
            driver.stop_client()
        else:
            driver.quit()


if __name__ == "__main__":
    main()
