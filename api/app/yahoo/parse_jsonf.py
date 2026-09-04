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


@dataclass
class LeagueSettings:
    league_key: str
    name: str
    season: int | None
    num_teams: int | None
    slug: str | None  # family key, from persistent_url .../league/<slug> (current only)
    renew: str | None  # "<game>_<league_id>" of the prior season's league
    scoring: dict  # {stat_modifiers, fractional_points, negative_points}
    roster_positions: dict  # {position: count}
    playoff_start_week: int | None
    num_playoff_teams: int | None
    waiver_type: str | None  # our enum: FAAB / rolling / reverse
    trade_deadline: str | None  # ISO date string


def _waiver_type(settings: dict) -> str | None:
    """Map Yahoo's waiver fields to our enum. FAAB overrides the ordering type."""
    if str(settings.get("uses_faab") or "") == "1":
        return "FAAB"
    wt = settings.get("waiver_type")
    if wt == "R":
        return "reverse"
    return "rolling" if wt else None


def parse_settings(payload: dict) -> LeagueSettings:
    """League metadata + scoring (mapped to our stat keys) + roster from a
    `/settings` payload. Only the stats our model scores (STAT_ID_MAP) enter
    scoring_json — K/DST/special-teams ids are dropped, matching the bootstrap."""
    from app.yahoo.parse import STAT_ID_MAP

    lg = payload["fantasy_content"]["league"]
    s = lg.get("settings") or {}

    mods: dict[str, float] = {}
    for entry in (s.get("stat_modifiers") or {}).get("stats", []):
        st = entry["stat"]
        key = STAT_ID_MAP.get(str(st["stat_id"]))
        if key is not None:
            mods[key] = float(st["value"])
    scoring = {
        "stat_modifiers": mods,
        "fractional_points": any(v != int(v) for v in mods.values()),
        "negative_points": any(v < 0 for v in mods.values()),
    }

    roster: dict[str, int] = {}
    for entry in s.get("roster_positions", []):
        rp = entry["roster_position"]
        roster[rp["position"]] = _to_int(rp.get("count")) or 0

    purl = s.get("persistent_url") or ""
    slug = purl.rsplit("/", 1)[-1] if "/league/" in purl else None

    return LeagueSettings(
        league_key=lg["league_key"],
        name=lg["name"],
        season=_to_int(lg.get("season")),
        num_teams=_to_int(lg.get("num_teams")),
        slug=slug,
        renew=lg.get("renew") or None,
        scoring=scoring,
        roster_positions=roster,
        playoff_start_week=_to_int(s.get("playoff_start_week")),
        num_playoff_teams=_to_int(s.get("num_playoff_teams")),
        waiver_type=_waiver_type(s),
        trade_deadline=s.get("trade_end_date") or None,
    )


def parse_league(payload: dict) -> LeagueRow:
    lg = payload["fantasy_content"]["league"]
    return LeagueRow(
        league_key=lg["league_key"],
        league_id=str(lg["league_id"]),
        name=lg["name"],
        season=_to_int(lg.get("season")),
        num_teams=_to_int(lg.get("num_teams")),
    )


@dataclass
class DiscoveredLeague:
    league_key: str
    name: str
    season: int | None
    num_teams: int | None
    renew: str | None  # prior season's "<game>_<league_id>" (renew chain)
    game_code: str  # "nfl" / "nba" / "nhl" — the sport, for cross-sport grouping


def parse_user_leagues(payload: dict) -> list[DiscoveredLeague]:
    """The logged-in user's leagues from a `users;use_login=1/games/leagues`
    payload: user -> games[] -> game.leagues[] -> league. Identity only (no
    scoring/roster — that needs a per-league /settings call). A game with no
    `leagues` sub-node (none for that sport/season) is simply skipped."""
    users = payload.get("fantasy_content", {}).get("users") or []
    out: list[DiscoveredLeague] = []
    for u in users:
        user = u.get("user") or {}
        for g in user.get("games") or []:
            game = g.get("game") or {}
            code = game.get("code") or ""
            for entry in game.get("leagues") or []:
                lg = entry.get("league") or {}
                out.append(
                    DiscoveredLeague(
                        league_key=lg["league_key"],
                        name=lg["name"],
                        season=_to_int(lg.get("season")),
                        num_teams=_to_int(lg.get("num_teams")),
                        renew=lg.get("renew") or None,
                        game_code=code,
                    )
                )
    return out


BENCH_SLOTS = {"BN", "IR"}


@dataclass
class RosterSlot:
    yahoo_player_id: str
    name: str
    primary_position: str | None
    slot: str  # QB/RB/WR/TE/W/R/T/K/DEF/BN/IR — already our rosterSlotEnum values
    is_starter: bool
    team_abbr: str | None = (
        None  # NFL team (Yahoo editorial_team_abbr); DST links by it
    )


@dataclass
class TeamRoster:
    team_key: str
    week: int
    players: list[RosterSlot]


def parse_roster(payload: dict) -> TeamRoster:
    """A team's players for a week, with the slot each was started in. Yahoo's
    selected_position.position IS our roster-slot vocabulary, so no mapping."""
    team = payload["fantasy_content"]["team"]
    roster = team.get("roster") or {}
    players: list[RosterSlot] = []
    for entry in roster.get("players", []):
        p = entry["player"]
        slot = (p.get("selected_position") or {}).get("position")
        if not slot:
            continue
        players.append(
            RosterSlot(
                yahoo_player_id=str(p["player_id"]),
                name=(p.get("name") or {}).get("full") or "",
                primary_position=p.get("primary_position"),
                slot=slot,
                is_starter=slot not in BENCH_SLOTS,
                team_abbr=p.get("editorial_team_abbr"),
            )
        )
    return TeamRoster(
        team_key=team["team_key"],
        week=_to_int(roster.get("week")) or 0,
        players=players,
    )


@dataclass
class TxnMovement:
    transaction_key: str
    type: str  # add / drop / add_drop / trade / commish
    status: str | None
    executed_at: int | None  # unix timestamp
    yahoo_player_id: str
    source_team_key: str | None
    source_type: str | None
    destination_team_key: str | None
    destination_type: str | None
    faab_bid: int | None


def parse_transactions(payload: dict) -> tuple[str, list[TxnMovement]]:
    """(league_key, movements). One movement per player in each transaction — an
    add/drop yields two, a trade several. Yahoo's transaction 'type' "add/drop" is
    normalised to add_drop."""
    lg = payload["fantasy_content"]["league"]
    out: list[TxnMovement] = []
    for entry in lg.get("transactions", []):
        tr = entry["transaction"]
        ttype = (tr.get("type") or "").replace("/", "_")
        status = tr.get("status")
        ts = _to_int(tr.get("timestamp"))
        for pe in tr.get("players", []):
            p = pe["player"]
            td = p.get("transaction_data") or {}
            out.append(
                TxnMovement(
                    transaction_key=tr["transaction_key"],
                    type=ttype,
                    status=status,
                    executed_at=ts,
                    yahoo_player_id=str(p["player_id"]),
                    source_team_key=td.get("source_team_key"),
                    source_type=td.get("source_type"),
                    destination_team_key=td.get("destination_team_key"),
                    destination_type=td.get("destination_type"),
                    faab_bid=_to_int(td.get("faab_bid") or tr.get("faab_bid")),
                )
            )
    return lg["league_key"], out


@dataclass
class MatchupRow:
    team_a_key: str
    team_a_points: float | None
    team_b_key: str
    team_b_points: float | None
    is_playoff: bool


@dataclass
class Scoreboard:
    league_key: str
    week: int
    matchups: list[MatchupRow]


def parse_matchups(payload: dict) -> Scoreboard:
    """A week's matchups — the two teams + their scores, and the playoff flag."""
    lg = payload["fantasy_content"]["league"]
    sb = lg.get("scoreboard") or {}
    out: list[MatchupRow] = []
    for entry in sb.get("matchups", []):
        m = entry["matchup"]
        teams = m.get("teams") or []
        if len(teams) < 2:
            continue
        ta, tb = teams[0]["team"], teams[1]["team"]
        out.append(
            MatchupRow(
                team_a_key=ta["team_key"],
                team_a_points=_to_float((ta.get("team_points") or {}).get("total")),
                team_b_key=tb["team_key"],
                team_b_points=_to_float((tb.get("team_points") or {}).get("total")),
                is_playoff=str(m.get("is_playoffs") or "0") == "1",
            )
        )
    return Scoreboard(
        league_key=lg["league_key"], week=_to_int(sb.get("week")) or 0, matchups=out
    )


@dataclass
class DraftPickRow:
    pick: int  # overall
    round: int
    team_key: str
    player_key: str  # {game}.p.{yahoo_id}
    cost: int | None  # auction dollars; None in a snake draft


def parse_draftresults(payload: dict) -> tuple[str, list[DraftPickRow]]:
    """(league_key, picks) from a live/completed draft. Empty predraft. Each
    pick carries the overall number, the team that made it, and the player."""
    lg = payload["fantasy_content"]["league"]
    out: list[DraftPickRow] = []
    for entry in lg.get("draft_results") or []:
        d = entry.get("draft_result") or {}
        pick = _to_int(d.get("pick"))
        if pick is None or not d.get("player_key"):
            continue  # an empty slot (predraft placeholder) — skip
        out.append(
            DraftPickRow(
                pick=pick,
                round=_to_int(d.get("round")) or 0,
                team_key=d.get("team_key"),
                player_key=d["player_key"],
                cost=_to_int(d.get("cost")),
            )
        )
    return lg["league_key"], out


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
