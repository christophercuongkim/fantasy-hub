"""Per-resource Yahoo parsers -> clean typed objects.

Index positions are NOT stable across endpoints, so everything searches by key
rather than assuming an index. See docs/05-yahoo-api-cookbook.md §3.
"""

from dataclasses import dataclass, field
from typing import Any

from app.yahoo.normalize import (
    coerce_float,
    coerce_int,
    flatten_meta,
    iter_collection,
    normalize_status,
    split_positions,
)

# stat_id -> our scoring key (NFL). Fetch the authoritative list from
# /game/nfl/stat_categories and cache it; this covers the common categories.
STAT_ID_MAP: dict[str, str] = {
    "4": "pass_yd",
    "5": "pass_td",
    "6": "pass_int",
    "9": "rush_yd",
    "10": "rush_td",
    "11": "rec",
    "12": "rec_yd",
    "13": "rec_td",
    "15": "ret_td",
    "16": "two_pt",
    "18": "fum_lost",
    # Kicking (K). Yahoo ships two interchangeable made-FG-by-distance sets —
    # 19-23 ("Field Goals X Yards") and 24-28 ("FGM X") — a league uses one; both
    # map to the same buckets. 29/30 = PAT made/missed, 84 = points-per-FG-yard.
    # Derived from pbp (field_goal_result + kick_distance, extra_point_result).
    "19": "fgm_0_19",
    "20": "fgm_20_29",
    "21": "fgm_30_39",
    "22": "fgm_40_49",
    "23": "fgm_50",
    "24": "fgm_0_19",
    "25": "fgm_20_29",
    "26": "fgm_30_39",
    "27": "fgm_40_49",
    "28": "fgm_50",
    "29": "pat_made",
    "30": "pat_miss",
    "84": "fg_yds",
}


def _content(data: dict[str, Any]) -> dict[str, Any]:
    return data["fantasy_content"]


def _find(parts: Any, key: str) -> Any:
    """From a positional array of dicts, return the value of the first `key`."""
    if isinstance(parts, dict):
        return parts.get(key)
    if isinstance(parts, list):
        for part in parts:
            if isinstance(part, dict) and key in part:
                return part[key]
    return None


# --------------------------------------------------------------------------- #
# game
# --------------------------------------------------------------------------- #
def parse_game(data: dict[str, Any]) -> dict[str, Any]:
    """/game/nfl -> current game key + season."""
    game = flatten_meta(_content(data)["game"])
    return {"game_key": game["game_key"], "season": coerce_int(game["season"])}


# --------------------------------------------------------------------------- #
# leagues
# --------------------------------------------------------------------------- #
@dataclass
class NormalizedLeague:
    league_key: str
    league_id: str
    name: str
    season: int | None
    num_teams: int | None
    scoring_type: str | None
    current_week: int | None
    start_week: int | None
    end_week: int | None
    is_finished: bool


def parse_leagues(data: dict[str, Any]) -> list[NormalizedLeague]:
    """/users;use_login=1/games/leagues -> the login user's NFL leagues."""
    out: list[NormalizedLeague] = []
    users = _content(data).get("users", {})
    for user in iter_collection(users):
        user_meta = _find(user["user"], "games") if isinstance(user, dict) else None
        games = user_meta or {}
        for game in iter_collection(games):
            leagues = (
                _find(game.get("game"), "leagues") if isinstance(game, dict) else None
            )
            for league in iter_collection(leagues or {}):
                meta = (
                    flatten_meta(league["league"]) if isinstance(league, dict) else {}
                )
                if "league_key" not in meta:
                    continue
                out.append(
                    NormalizedLeague(
                        league_key=meta["league_key"],
                        league_id=meta["league_id"],
                        name=meta["name"],
                        season=coerce_int(meta.get("season")),
                        num_teams=coerce_int(meta.get("num_teams")),
                        scoring_type=meta.get("scoring_type"),
                        current_week=coerce_int(meta.get("current_week")),
                        start_week=coerce_int(meta.get("start_week")),
                        end_week=coerce_int(meta.get("end_week")),
                        is_finished=str(meta.get("is_finished", "0")) == "1",
                    )
                )
    return out


# --------------------------------------------------------------------------- #
# settings (scoring!) — parse this before anything else
# --------------------------------------------------------------------------- #
_WAIVER_TYPE_MAP = {"FR": "FAAB", "CR": "rolling", "R": "reverse"}


@dataclass
class LeagueSettings:
    league_key: str
    scoring: dict[str, float]
    roster_positions: dict[str, int]
    playoff_start_week: int | None
    num_playoff_teams: int | None
    waiver_type: str | None
    trade_deadline: str | None


def parse_settings(data: dict[str, Any]) -> LeagueSettings:
    league = _content(data)["league"]
    league_key = _find(league, "league_key") or flatten_meta(league).get("league_key")
    settings = flatten_meta(_find(league, "settings"))

    scoring: dict[str, float] = {}
    modifiers = settings.get("stat_modifiers", {})
    for stat in modifiers.get("stats", []) if isinstance(modifiers, dict) else []:
        s = stat.get("stat", stat)
        stat_id = str(s.get("stat_id"))
        key = STAT_ID_MAP.get(stat_id)
        value = coerce_float(s.get("value"))
        if key is not None and value is not None:
            scoring[key] = value

    roster_positions: dict[str, int] = {}
    for rp in settings.get("roster_positions", []):
        pos = rp.get("roster_position", rp)
        count = coerce_int(pos.get("count"))
        if pos.get("position") and count is not None:
            roster_positions[pos["position"]] = count

    uses_faab = str(settings.get("uses_faab", "0")) == "1"
    raw_waiver = settings.get("waiver_type")
    waiver_type = "FAAB" if uses_faab else _WAIVER_TYPE_MAP.get(raw_waiver, raw_waiver)

    return LeagueSettings(
        league_key=league_key,
        scoring=scoring,
        roster_positions=roster_positions,
        playoff_start_week=coerce_int(settings.get("playoff_start_week")),
        num_playoff_teams=coerce_int(settings.get("num_playoff_teams")),
        waiver_type=waiver_type,
        trade_deadline=settings.get("trade_end_date"),
    )


# --------------------------------------------------------------------------- #
# players (shared by roster / free agents)
# --------------------------------------------------------------------------- #
@dataclass
class NormalizedPlayer:
    yahoo_player_id: str
    player_key: str
    name: str
    team: str | None
    position: str | None
    eligible_positions: list[str]
    status: str | None
    injury_note: str | None
    slot: str | None = None
    is_starter: bool = False


def _player_from_entry(entry: Any) -> NormalizedPlayer:
    meta_arr = entry[0] if isinstance(entry, list) and entry else entry
    meta = flatten_meta(meta_arr)
    name = meta.get("name", {})
    full = name.get("full") if isinstance(name, dict) else name
    position = (
        meta.get("primary_position")
        or (split_positions(meta.get("display_position")) or [None])[0]
    )

    slot = None
    if isinstance(entry, list):
        sp = _find(entry, "selected_position")
        if sp is not None:
            slot = flatten_meta(sp).get("position")

    return NormalizedPlayer(
        yahoo_player_id=str(meta.get("player_id")),
        player_key=meta.get("player_key"),
        name=full,
        team=meta.get("editorial_team_abbr"),
        position=position,
        eligible_positions=split_positions(meta.get("display_position")),
        status=normalize_status(meta.get("status")),
        injury_note=meta.get("injury_note"),
        slot=slot,
        is_starter=slot is not None and slot not in ("BN", "IR"),
    )


def _players_collection(container: Any) -> list[NormalizedPlayer]:
    out: list[NormalizedPlayer] = []
    for item in iter_collection(container or {}):
        player = item.get("player") if isinstance(item, dict) else None
        if player is not None:
            out.append(_player_from_entry(player))
    return out


def parse_roster(data: dict[str, Any]) -> list[NormalizedPlayer]:
    team = _content(data)["team"]
    roster = _find(team, "roster")
    players = _find(roster, "players") if isinstance(roster, dict) else None
    if players is None and isinstance(roster, dict):
        # roster is sometimes {"0": {"players": {...}}}
        first = roster.get("0", {})
        players = first.get("players")
    return _players_collection(players)


def parse_free_agents(data: dict[str, Any]) -> list[NormalizedPlayer]:
    league = _content(data)["league"]
    players = _find(league, "players")
    return _players_collection(players)


# --------------------------------------------------------------------------- #
# matchups
# --------------------------------------------------------------------------- #
@dataclass
class MatchupTeam:
    team_key: str
    name: str
    points: float | None
    projected_points: float | None


@dataclass
class Matchup:
    week: int | None
    is_playoffs: bool
    teams: list[MatchupTeam] = field(default_factory=list)


def _matchup_team(entry: Any) -> MatchupTeam:
    meta = flatten_meta(entry[0] if isinstance(entry, list) and entry else entry)
    points = (
        flatten_meta(_find(entry, "team_points")) if isinstance(entry, list) else {}
    )
    proj = (
        flatten_meta(_find(entry, "team_projected_points"))
        if isinstance(entry, list)
        else {}
    )
    return MatchupTeam(
        team_key=meta.get("team_key"),
        name=meta.get("name"),
        points=coerce_float(points.get("total")),
        projected_points=coerce_float(proj.get("total")),
    )


def parse_matchups(data: dict[str, Any]) -> list[Matchup]:
    team = _content(data)["team"]
    matchups = _find(team, "matchups")
    out: list[Matchup] = []
    for item in iter_collection(matchups or {}):
        m = item.get("matchup") if isinstance(item, dict) else None
        if m is None:
            continue
        meta = flatten_meta(m)
        teams_container = _find(m, "teams") if isinstance(m, list) else m.get("teams")
        teams = [
            _matchup_team(t["team"])
            for t in iter_collection(teams_container or {})
            if isinstance(t, dict) and "team" in t
        ]
        out.append(
            Matchup(
                week=coerce_int(meta.get("week")),
                is_playoffs=str(meta.get("is_playoffs", "0")) == "1",
                teams=teams,
            )
        )
    return out


# --------------------------------------------------------------------------- #
# draft results
# --------------------------------------------------------------------------- #
@dataclass
class DraftPick:
    pick: int | None
    round: int | None
    team_key: str
    player_key: str
    cost: int | None


def parse_draft_results(data: dict[str, Any]) -> list[DraftPick]:
    league = _content(data)["league"]
    results = _find(league, "draft_results")
    out: list[DraftPick] = []
    for item in iter_collection(results or {}):
        dr = item.get("draft_result") if isinstance(item, dict) else None
        if dr is None:
            continue
        meta = flatten_meta(dr)
        out.append(
            DraftPick(
                pick=coerce_int(meta.get("pick")),
                round=coerce_int(meta.get("round")),
                team_key=meta.get("team_key"),
                player_key=meta.get("player_key"),
                cost=coerce_int(meta.get("cost")),
            )
        )
    return out


# --------------------------------------------------------------------------- #
# player stats
# --------------------------------------------------------------------------- #
@dataclass
class PlayerStats:
    yahoo_player_id: str
    player_key: str
    name: str
    stats: dict[str, float]


def parse_player_stats(data: dict[str, Any]) -> list[PlayerStats]:
    league = _content(data)["league"]
    players = _find(league, "players")
    out: list[PlayerStats] = []
    for item in iter_collection(players or {}):
        player = item.get("player") if isinstance(item, dict) else None
        if player is None:
            continue
        meta = flatten_meta(player[0] if isinstance(player, list) else player)
        name = meta.get("name", {})
        stats_container = (
            _find(player, "player_stats") if isinstance(player, list) else None
        )
        stats_meta = flatten_meta(stats_container) if stats_container else {}
        stats: dict[str, float] = {}
        for s in stats_meta.get("stats", []):
            st = s.get("stat", s)
            key = STAT_ID_MAP.get(str(st.get("stat_id")), str(st.get("stat_id")))
            value = coerce_float(st.get("value"))
            if value is not None:
                stats[key] = value
        out.append(
            PlayerStats(
                yahoo_player_id=str(meta.get("player_id")),
                player_key=meta.get("player_key"),
                name=name.get("full") if isinstance(name, dict) else name,
                stats=stats,
            )
        )
    return out
