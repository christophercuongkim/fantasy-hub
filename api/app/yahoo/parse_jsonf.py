"""Parsers for Yahoo's `format=json_f` shape (the SPA's `pub-api-rw` API).

Unlike the OAuth API's `format=json` (integer-keyed collections + positional
entity arrays, handled by parse.py), `json_f` is clean: collections are real
arrays of single-key objects, e.g. `"teams": [{"team": {...}}]`. So these parsers
are plain dict/list walks. Numbers still arrive as strings, so coerce.

This is the source we actually use — the fantasy web app authenticates to
pub-api-rw with session cookies, which the public OAuth host refuses. parse.py
stays as the OAuth-API path if that access is ever granted.
"""

from __future__ import annotations

from dataclasses import dataclass


def _to_int(v) -> int | None:
    return int(v) if v not in (None, "") else None


def _to_float(v) -> float | None:
    return float(v) if v not in (None, "") else None


@dataclass
class TeamRow:
    team_key: str
    team_id: str
    name: str
    is_mine: bool
    manager_guid: str | None
    manager_nickname: str | None
    # regular-season record from standings; all None before the season is played
    rank: int | None
    wins: int | None
    losses: int | None
    ties: int | None
    points_for: float | None
    points_against: float | None


@dataclass
class LeagueRow:
    league_key: str
    league_id: str
    name: str
    season: int | None
    num_teams: int | None


def parse_league(payload: dict) -> LeagueRow:
    lg = payload["fantasy_content"]["league"]
    return LeagueRow(
        league_key=lg["league_key"],
        league_id=str(lg["league_id"]),
        name=lg["name"],
        season=_to_int(lg.get("season")),
        num_teams=_to_int(lg.get("num_teams")),
    )


def parse_teams(payload: dict) -> list[TeamRow]:
    """The league's teams + (when present) their standings record. `is_mine` comes
    from Yahoo flagging the logged-in user's team/manager."""
    lg = payload["fantasy_content"]["league"]
    out: list[TeamRow] = []
    for entry in lg.get("teams", []):
        t = entry["team"]
        mgr = (t.get("managers") or [{}])[0].get("manager", {})
        st = t.get("team_standings") or {}
        ot = st.get("outcome_totals") or {}
        out.append(
            TeamRow(
                team_key=t["team_key"],
                team_id=str(t["team_id"]),
                name=t["name"],
                is_mine=bool(t.get("is_owned_by_current_login"))
                or str(mgr.get("is_current_login") or "") == "1",
                manager_guid=mgr.get("guid"),
                manager_nickname=mgr.get("nickname"),
                rank=_to_int(st.get("rank")),
                wins=_to_int(ot.get("wins")),
                losses=_to_int(ot.get("losses")),
                ties=_to_int(ot.get("ties")),
                points_for=_to_float(st.get("points_for")),
                points_against=_to_float(st.get("points_against")),
            )
        )
    return out
