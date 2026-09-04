"""OAuth-authenticated client for Yahoo's official Fantasy API (format=json_f).

A drop-in alternative to pub_api: same function surface, same clean json_f
payloads, so parse_jsonf and the sync writers are unchanged. The difference is
the auth + host — the official OAuth host (fantasysports.yahooapis.com) with a
refreshing bearer token instead of a hand-pasted session cookie. That means no
cookie to re-paste on 401: YahooClient refreshes the access token itself.

The spike confirmed the OAuth host serves ?format=json_f in the same array shape
pub-api-rw returns, so the two sources are interchangeable behind these
functions.
"""

from __future__ import annotations

from app.yahoo.client import YahooClient

# One client per process is enough — it caches + refreshes the token in memory.
_client: YahooClient | None = None


def _get(path: str) -> dict:
    global _client
    if _client is None:
        _client = YahooClient()
    return _client.get(f"/{path.lstrip('/')}", fmt="json_f")


def teams(league_key: str) -> dict:
    """The league's teams + standings record."""
    return _get(f"league/{league_key}/teams;out=standings")


def settings(league_key: str) -> dict:
    """The league's settings — scoring, roster positions, playoff/waiver/trade."""
    return _get(f"league/{league_key}/settings")


def roster(team_key: str, week: int) -> dict:
    """A team's roster for a week (players + the slot each was started in)."""
    return _get(f"team/{team_key}/roster;week={week}")


def scoreboard(league_key: str, week: int) -> dict:
    """A week's matchups + scores for the whole league (one call)."""
    return _get(f"league/{league_key}/scoreboard;week={week}")


def draftresults(league_key: str) -> dict:
    """Every pick made so far — polled live during the draft, empty predraft."""
    return _get(f"league/{league_key}/draftresults")


def transactions(league_key: str, start: int = 0, count: int = 25) -> dict:
    """A page of the league's adds/drops/trades (paginate with start)."""
    return _get(
        f"league/{league_key}/transactions;types=add,drop,trade,commish;"
        f"start={start};count={count}"
    )


def players(league_key: str, start: int = 0, count: int = 25, sort: str = "OR") -> dict:
    """A page of the league's players, ranked (sort=OR = overall rank) so the
    first pages are the draftable pool. Each player carries `status` /
    `status_full` / `injury_note` (null when healthy). Paginate with `start`."""
    return _get(f"league/{league_key}/players;sort={sort};start={start};count={count}")


def user_leagues(game_keys: str = "nfl") -> dict:
    """Every league the token's owner is in for the given game(s). `use_login=1`
    means "whoever the token belongs to" — no guid needed. `game_keys` filters by
    sport ("nfl", "nba", "nhl", or a comma list); default nfl. OAuth-only: the
    cookie source has no equivalent self-scoped call."""
    return _get(f"users;use_login=1/games;game_keys={game_keys}/leagues")
