"""NFL (Yahoo fantasy football) sport adapter.

Everything sport-specific lives here: the Yahoo URL scheme, the scoring
label->key map (matching api STAT_ID_MAP so bootstrap == API), the roster
position vocabulary, and the per-season game keys used to build league keys.
Adding another sport = another module with the same shape (see sports/base).
"""

from __future__ import annotations

CODE = "nfl"
SLUG_LABEL = "football"  # the /?sport= value on the profile page

FBALL = "https://football.fantasysports.yahoo.com"

# Yahoo NFL game key per season -> {game_key}.l.{league_id}. Best-effort; the
# loader only needs a stable-unique key, so unknown years fall back below.
GAME_KEYS: dict[int, str] = {
    2014: "331", 2015: "348", 2016: "359", 2017: "371", 2018: "380",
    2019: "390", 2020: "399", 2021: "406", 2022: "414", 2023: "423",
    2024: "449", 2025: "461",
}


def league_key(season: int, league_id: str) -> str:
    gk = GAME_KEYS.get(season, f"nfl{season}")
    return f"{gk}.l.{league_id}"


# --- URL scheme (football) ---------------------------------------------------
def slug_landing(slug: str, season: int) -> str:
    """Stable per-season landing page; links to the real archived league URL."""
    return f"{FBALL}/league/{slug}/{season}"


def draft_url(base: str) -> str:
    return f"{base}/draftresults?drafttab=picks"


def teams_url(base: str) -> str:
    return f"{base}/teams"


def settings_url(base: str) -> str:
    return f"{base}/settings"


# --- scoring: Yahoo settings label -> our canonical key ----------------------
# "yards per point" labels become 1/N. Keys match api STAT_ID_MAP exactly.
SCORING_YPP = {
    "Passing Yards": "pass_yd",
    "Rushing Yards": "rush_yd",
    "Receiving Yards": "rec_yd",
}
SCORING_FLAT = {
    "Passing Touchdowns": "pass_td",
    "Interceptions": "pass_int",
    "Rushing Touchdowns": "rush_td",
    "Receptions": "rec",
    "Receiving Touchdowns": "rec_td",
    "Return Touchdowns": "ret_td",
    "2-Point Conversions": "two_pt",
    "Fumbles Lost": "fum_lost",
}

# Roster slots we expect (for light validation of the scraped roster string).
ROSTER_SLOTS = {"QB", "RB", "WR", "TE", "W/R/T", "K", "DEF", "BN", "IR"}
