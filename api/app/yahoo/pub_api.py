"""Cookie-authenticated client for Yahoo's pub-api-rw fantasy API (format=json_f).

The Yahoo fantasy web app calls this host with the logged-in session cookies; the
public OAuth host (fantasysports.yahooapis.com) refuses them. We replay the stored
cookie header and request the clean json_f shape (see parse_jsonf). On a 401/999
the cookie has expired or been rate-limited — re-paste it in the admin.
"""

from __future__ import annotations

import httpx

from app.yahoo import cookies

BASE = "https://pub-api-rw.fantasysports.yahoo.com/fantasy/v2"
# Look like the web app, not a bot — the whole point is that this host serves the
# first-party SPA. A plain httpx UA is an obvious tell.
_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
)


class NoCookie(Exception):
    """No Yahoo cookie has been stored yet."""


class CookieExpired(Exception):
    """Yahoo rejected the cookie (401) or rate-limited (999) — re-paste it."""


def get_json_f(path: str) -> dict:
    cookie = cookies.load()
    if not cookie:
        raise NoCookie("no Yahoo cookie stored — paste one in the admin")
    resp = httpx.get(
        f"{BASE}/{path.lstrip('/')}",
        params={"format": "json_f"},
        headers={"Cookie": cookie, "User-Agent": _UA},
        timeout=30.0,
    )
    if resp.status_code in (401, 999):
        raise CookieExpired(
            f"Yahoo returned {resp.status_code} — the session cookie is expired or "
            "rate-limited; re-paste it in the admin"
        )
    resp.raise_for_status()
    return resp.json()


def teams(league_key: str) -> dict:
    """The league's teams + standings record."""
    return get_json_f(f"league/{league_key}/teams;out=standings")


def settings(league_key: str) -> dict:
    """The league's settings — scoring, roster positions, playoff/waiver/trade."""
    return get_json_f(f"league/{league_key}/settings")


def roster(team_key: str, week: int) -> dict:
    """A team's roster for a week (players + the slot each was started in)."""
    return get_json_f(f"team/{team_key}/roster;week={week}")


def scoreboard(league_key: str, week: int) -> dict:
    """A week's matchups + scores for the whole league (one call)."""
    return get_json_f(f"league/{league_key}/scoreboard;week={week}")


def transactions(league_key: str, start: int = 0, count: int = 25) -> dict:
    """A page of the league's adds/drops/trades (paginate with start)."""
    return get_json_f(
        f"league/{league_key}/transactions;types=add,drop,trade,commish;"
        f"start={start};count={count}"
    )
