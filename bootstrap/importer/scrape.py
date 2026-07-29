"""Scrape Yahoo league history into data/<slug>/ for the loader.

Per league in config/import.yaml, per season: resolve the archived league URL
off the stable slug landing page, then scrape the draft grid, the teams/identity
table, and the settings page.

Run (from repo root): nix develop .#scrape -c bash -c \
  'cd bootstrap && uv run python -m importer.scrape [--attach 127.0.0.1:9222] [--only 2025]'
(the .#scrape dev shell provides version-matched chromedriver + chromium)
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


def scrape_standings(driver, base: str, season: int) -> pd.DataFrame:
    """/standings is server-rendered: a points table where col 0 is the FINAL
    rank (1 = champion; not points order), col 1 the team, and the last numeric
    cell the season points-for total."""
    browser.goto(driver, nfl.standings_url(base))
    soup = BeautifulSoup(driver.page_source, "lxml")
    rows = []
    seen = set()
    for tbl in soup.select("table"):
        for tr in tbl.select("tr"):
            cells = [td.get_text(" ", strip=True) for td in tr.find_all(["td", "th"])]
            if not cells or not re.match(r"^\d+\.$", cells[0]):
                continue
            team = cells[1]
            if team in seen:
                continue
            nums = [c for c in cells if re.match(r"^\d+\.\d\d$", c)]
            rows.append({
                "season": season,
                "team_name": team,
                "final_rank": int(cells[0].rstrip(".")),
                "points_for": float(nums[-1]) if nums else "",
            })
            seen.add(team)
    if not rows:
        raise RuntimeError(f"{season}: no standings rows")
    return pd.DataFrame(rows).sort_values("final_rank")


def scrape_week(driver, base: str, week: int) -> list[dict]:
    """One matchup week. Each matchup <li> has two a.F-link team names and two
    .Fz-lg actual scores (the winner's also carries .Fw-b). JS-hydrated, so wait
    for the links. Returns [] when the week has no matchups (past the schedule)."""
    browser.goto(driver, nfl.matchup_url(base, week), settle=3)
    # the full-week scoreboard lazy-loads on scroll. Fixed generous wait (mirrors
    # the capture that got all 6 matchups) — no early break, since partial
    # hydration renders my own matchup first and misses the rest.
    for _ in range(5):
        driver.execute_script("window.scrollTo(0, document.body.scrollHeight)")
        time.sleep(1.5)
    soup = BeautifulSoup(driver.page_source, "lxml")

    def parse(soup):
        out, seen = [], set()
        for li in soup.select("li"):
            names = [a.get_text(strip=True) for a in li.select("a.F-link")]
            scores = li.select('[class~="Fz-lg"]')
            if len(names) < 2 or len(scores) < 2:
                continue
            a, b = names[0], names[1]
            try:
                sa = float(scores[0].get_text(strip=True))
                sb = float(scores[1].get_text(strip=True))
            except ValueError:
                continue
            key = frozenset((a, b))
            if key in seen:
                continue
            seen.add(key)
            out.append({"week": week, "team_a": a, "score_a": sa, "team_b": b, "score_b": sb})
        return out

    return parse(soup)


def scrape_matchups(driver, base: str, season: int, max_week: int = 18) -> pd.DataFrame:
    rows = []
    for week in range(1, max_week + 1):
        wk = scrape_week(driver, base, week)
        if not wk:
            if rows:
                break  # natural end of the season's schedule
            # week 1 empty = a real failure (hydration/structure); dump to inspect
            dbg = ROOT / "data" / "_dumps" / f"matchup-EMPTY-{season}-w{week}.html"
            dbg.parent.mkdir(parents=True, exist_ok=True)
            dbg.write_text(driver.page_source, encoding="utf-8")
            raise RuntimeError(f"{season} week {week}: no matchups; dumped {dbg.name}")
        for r in wk:
            r["season"] = season
        rows += wk
    cols = ["season", "week", "team_a", "score_a", "team_b", "score_b"]
    return pd.DataFrame(rows)[cols]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--attach", metavar="HOST:PORT", help="attach to your own Chrome")
    ap.add_argument("--only", help="comma seasons to limit to, e.g. 2025,2024")
    ap.add_argument("--user-data-dir", default=str(ROOT / ".chrome-profile"))
    ap.add_argument("--dump-url", help="save this URL's html to data/_dumps/, then exit")
    ap.add_argument("--settle", type=float, default=3.0, help="dump: seconds to wait for JS")
    ap.add_argument("--login-gate", action="store_true",
                    help="prompt for login even in --attach mode (for the all-in-one flow)")
    args = ap.parse_args()

    doc = yaml.safe_load(CONFIG.read_text())
    driver = browser.build_driver(Path(args.user_data_dir), args.attach)
    try:
        if not args.attach or args.login_gate:
            browser.manual_login_gate(driver)
        if args.dump_url:
            browser.goto(driver, args.dump_url, settle=args.settle)
            # scroll to trigger any lazy-loaded matchup/standings modules
            driver.execute_script("window.scrollTo(0, document.body.scrollHeight)")
            time.sleep(args.settle)
            dumps = ROOT / "data" / "_dumps"
            dumps.mkdir(parents=True, exist_ok=True)
            name = re.sub(r"[^\w.-]", "_", args.dump_url.split("//", 1)[-1])[:120]
            (dumps / f"{name}.html").write_text(driver.page_source, encoding="utf-8")
            print(f"dumped data/_dumps/{name}.html", flush=True)
            return
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
                    sdf = scrape_standings(driver, base, season)
                    sdf.to_csv(out / f"standings-{season}.csv", index=False)
                    mdf = scrape_matchups(driver, base, season)
                    mdf.to_csv(out / f"matchups-{season}.csv", index=False)
                    print(f"  ok: {tdf['guid'].astype(bool).sum()}/{len(tdf)} guids, "
                          f"{len(mdf)} matchups over {mdf['week'].nunique()} weeks", flush=True)
                except Exception as e:  # noqa: BLE001 - report, keep going
                    print(f"  FAILED: {e}", flush=True)
    finally:
        if args.attach:
            driver.stop_client()
        else:
            driver.quit()


if __name__ == "__main__":
    main()
