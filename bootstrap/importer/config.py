"""Parse a Yahoo settings page into a per-season league config.

Pure (html string -> dataclass), so it's unit-testable offline. Scoring keys
come from the sport adapter and match the api STAT_ID_MAP, so a bootstrapped
league and an API-synced league produce identical scoring_json.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime

from bs4 import BeautifulSoup

from sports import nfl


@dataclass
class LeagueSettings:
    league_id: str
    name: str
    num_teams: int
    scoring: dict[str, float]
    roster_positions: dict[str, int]
    playoff_start_week: int | None
    num_playoff_teams: int | None
    waiver_type: str | None
    trade_deadline: str | None  # ISO date or None
    fractional_points: bool = field(default=False)
    negative_points: bool = field(default=False)


def _clean(s: str) -> str:
    return re.sub(r"\s+", " ", s.replace("\xa0", " ")).strip()


def _tables(html: str) -> tuple[dict[str, str], list[list[str]]]:
    soup = BeautifulSoup(html, "lxml")
    general: dict[str, str] = {}
    scoring: list[list[str]] = []
    for tbl in soup.select("table"):
        rows = []
        for tr in tbl.select("tr"):
            cells = [_clean(td.get_text(" ")) for td in tr.find_all(["td", "th"])]
            cells = [c for c in cells if c]
            if cells:
                rows.append(cells)
        if not rows:
            continue
        if rows[0][:2] == ["Setting", "Value"]:
            for r in rows[1:]:
                if len(r) >= 2:
                    general[r[0].rstrip(":")] = r[1]
        elif rows[0][0] in ("Offense", "Kickers", "Defense/Special Teams"):
            scoring += rows
    return general, scoring


def _scoring(rows: list[list[str]]) -> dict[str, float]:
    out: dict[str, float] = {}
    for r in rows:
        if len(r) < 2:
            continue
        label = re.sub(r"\s*Yahoo Default\s*$", "", r[0]).strip()
        raw = r[1]
        if label in nfl.SCORING_YPP:
            m = re.search(r"(\d+)\s*yards per point", raw)
            if m:
                out[nfl.SCORING_YPP[label]] = round(1 / int(m.group(1)), 4)
        elif label in nfl.SCORING_FLAT:
            try:
                out[nfl.SCORING_FLAT[label]] = float(raw)
            except ValueError:
                pass
    return out


def _roster(general: dict[str, str]) -> dict[str, int]:
    val = next((v for k, v in general.items() if k.startswith("Roster")), "")
    counts: dict[str, int] = {}
    for pos in [p.strip() for p in val.split(",") if p.strip()]:
        counts[pos] = counts.get(pos, 0) + 1
    return counts


def _trade_deadline(general: dict[str, str]) -> str | None:
    val = general.get("Trade End Date", "")
    for fmt in ("%B %d, %Y", "%b %d, %Y"):
        try:
            return datetime.strptime(val, fmt).date().isoformat()
        except ValueError:
            continue
    return None


def parse_settings(html: str) -> LeagueSettings:
    general, scoring_rows = _tables(html)
    playoffs = general.get("Playoffs", "")
    n_playoff = re.search(r"(\d+)\s*teams", playoffs)
    p_week = re.search(r"Week\s*(\d+)", playoffs)
    max_teams = re.search(r"\d+", general.get("Max Teams", "0"))
    return LeagueSettings(
        league_id=general.get("League ID#", ""),
        name=general.get("League Name", ""),
        num_teams=int(max_teams.group()) if max_teams else 0,
        scoring=_scoring(scoring_rows),
        roster_positions=_roster(general),
        playoff_start_week=int(p_week.group(1)) if p_week else None,
        num_playoff_teams=int(n_playoff.group(1)) if n_playoff else None,
        waiver_type="FAAB" if "FAB" in general.get("Waiver Type", "") else None,
        trade_deadline=_trade_deadline(general),
        fractional_points=general.get("Fractional Points", "").lower().startswith("y"),
        negative_points=general.get("Negative Points", "").lower().startswith("y"),
    )


def scoring_json(s: LeagueSettings) -> dict:
    """Match web ScoringJson: stat_modifiers + fractional/negative flags."""
    return {
        "stat_modifiers": s.scoring,
        "fractional_points": s.fractional_points
        or any(float(v) != int(v) for v in s.scoring.values()),
        "negative_points": s.negative_points
        or any(float(v) < 0 for v in s.scoring.values()),
    }
