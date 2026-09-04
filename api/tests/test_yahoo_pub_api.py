"""Offline tests for the cookie-auth pub-api-rw client + sync-teams endpoint."""

import pytest

from app.yahoo import pub_api


class _FakeResp:
    def __init__(self, status=200, data=None):
        self.status_code = status
        self._data = data if data is not None else {"ok": True}

    def json(self):
        return self._data

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")


def test_get_json_f_sends_cookie_and_format(monkeypatch):
    seen = {}

    def fake_get(url, params, headers, timeout):
        seen.update(url=url, params=params, headers=headers)
        return _FakeResp(200, {"fantasy_content": {"league": {}}})

    monkeypatch.setattr(pub_api.cookies, "load", lambda: "SID=abc; T=xyz")
    monkeypatch.setattr(pub_api.httpx, "get", fake_get)

    out = pub_api.get_json_f("league/449.l.93367/teams;out=standings")
    assert out == {"fantasy_content": {"league": {}}}
    assert seen["params"] == {"format": "json_f"}
    assert seen["headers"]["Cookie"] == "SID=abc; T=xyz"
    assert seen["url"] == (
        "https://pub-api-rw.fantasysports.yahoo.com/fantasy/v2"
        "/league/449.l.93367/teams;out=standings"
    )


def test_no_cookie_raises(monkeypatch):
    monkeypatch.setattr(pub_api.cookies, "load", lambda: None)
    with pytest.raises(pub_api.NoCookie):
        pub_api.get_json_f("x")


def test_expired_cookie_raises(monkeypatch):
    monkeypatch.setattr(pub_api.cookies, "load", lambda: "SID=abc")
    monkeypatch.setattr(pub_api.httpx, "get", lambda *a, **k: _FakeResp(401))
    with pytest.raises(pub_api.CookieExpired):
        pub_api.get_json_f("x")


def test_sync_teams_endpoint_cookie_source(monkeypatch):
    from fastapi.testclient import TestClient

    from app.main import app
    from app.yahoo import pub_api as pa
    from app.yahoo import sync

    monkeypatch.setattr(pa, "teams", lambda lk: {"fantasy_content": {"league": {}}})
    monkeypatch.setattr(sync, "sync_teams", lambda payload: {"teams_updated": 3})

    res = TestClient(app).post(
        "/jobs/sync-teams",
        json={"league_key": "449.l.93367", "source": "cookie"},
    )
    assert res.status_code == 200
    assert res.json()["teams_updated"] == 3


def test_sync_teams_endpoint_oauth_source(monkeypatch):
    """Default source is oauth → the endpoint fetches via oauth_api, not pub_api."""
    from fastapi.testclient import TestClient

    from app.main import app
    from app.yahoo import oauth_api, sync

    monkeypatch.setattr(
        oauth_api, "teams", lambda lk: {"fantasy_content": {"league": {}}}
    )
    monkeypatch.setattr(sync, "sync_teams", lambda payload: {"teams_updated": 7})

    res = TestClient(app).post("/jobs/sync-teams", json={"league_key": "449.l.93367"})
    assert res.status_code == 200
    assert res.json()["teams_updated"] == 7


def test_sync_teams_endpoint_no_cookie(monkeypatch):
    from fastapi.testclient import TestClient

    from app.main import app
    from app.yahoo import pub_api as pa

    def _raise(lk):
        raise pa.NoCookie("no cookie")

    monkeypatch.setattr(pa, "teams", _raise)
    res = TestClient(app).post(
        "/jobs/sync-teams", json={"league_key": "x", "source": "cookie"}
    )
    assert res.status_code == 422


def test_sync_teams_endpoint_not_connected(monkeypatch):
    """oauth source with no token stored → 422 (YahooNotConnected)."""
    from fastapi.testclient import TestClient

    from app.main import app
    from app.yahoo import client, oauth_api

    def _raise(lk):
        raise client.YahooNotConnected("not connected")

    monkeypatch.setattr(oauth_api, "teams", _raise)
    res = TestClient(app).post("/jobs/sync-teams", json={"league_key": "x"})
    assert res.status_code == 422


def test_discover_leagues_endpoint(monkeypatch):
    """discover-leagues is OAuth-only: enumerates via oauth_api, creates missing."""
    from fastapi.testclient import TestClient

    from app.main import app
    from app.yahoo import oauth_api, sync

    payload = {
        "fantasy_content": {
            "users": [
                {
                    "user": {
                        "games": [
                            {
                                "game": {
                                    "code": "nfl",
                                    "leagues": [
                                        {
                                            "league": {
                                                "league_key": "470.l.735658",
                                                "name": "PCE",
                                                "season": "2026",
                                                "num_teams": 12,
                                            }
                                        }
                                    ],
                                }
                            }
                        ]
                    }
                }
            ]
        }
    }
    monkeypatch.setattr(oauth_api, "user_leagues", lambda gk="nfl": payload)
    monkeypatch.setattr(sync, "_known_league_keys", lambda: set())
    monkeypatch.setattr(oauth_api, "settings", lambda lk: {"s": lk})
    monkeypatch.setattr(oauth_api, "teams", lambda lk: {"t": lk})
    monkeypatch.setattr(sync, "sync_league", lambda s, t: {"season": 2026})

    res = TestClient(app).post("/jobs/discover-leagues", json={"game_keys": "nfl"})
    assert res.status_code == 200
    body = res.json()
    assert len(body["discovered"]) == 1
    assert body["created"][0]["league_key"] == "470.l.735658"
    assert body["existing"] == []
