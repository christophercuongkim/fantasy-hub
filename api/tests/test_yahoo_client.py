from datetime import UTC, datetime, timedelta

import pytest

from app.config import settings
from app.yahoo import client as yc
from app.yahoo.tokens import StoredToken

TEST_KEY = "l8kRkg2DZbzutnmHk9okfUL12VzBhXqBfJbBag9eFxs="


class FakeResp:
    def __init__(self, status_code, json_data=None, text=""):
        self.status_code = status_code
        self._json = json_data or {}
        self.text = text

    def json(self):
        return self._json


@pytest.fixture
def cfg(monkeypatch):
    monkeypatch.setattr(settings, "yahoo_client_id", "id")
    monkeypatch.setattr(settings, "yahoo_client_secret", "secret")
    monkeypatch.setattr(settings, "token_enc_key", TEST_KEY)


def _valid_token():
    return StoredToken("acc", "ref", datetime.now(UTC) + timedelta(hours=1), None)


def test_missing_config_raises(monkeypatch):
    monkeypatch.setattr(settings, "yahoo_client_id", None)
    with pytest.raises(RuntimeError):
        yc.YahooClient()


def test_no_stored_token_raises(monkeypatch, cfg):
    monkeypatch.setattr(yc.tokens, "load", lambda: None)
    with pytest.raises(yc.YahooError):
        yc.YahooClient().get("/game/nfl")


def test_get_refreshes_on_401_then_retries(monkeypatch, cfg):
    monkeypatch.setattr(yc.tokens, "load", _valid_token)
    saved = {}
    monkeypatch.setattr(
        yc.tokens, "save_access_token", lambda a, e: saved.update(access=a)
    )

    calls = {"n": 0}

    def fake_get(url, headers=None, params=None, timeout=None):
        calls["n"] += 1
        if calls["n"] == 1:
            return FakeResp(401)
        return FakeResp(200, {"fantasy_content": {"ok": True}})

    def fake_post(url, headers=None, data=None, timeout=None):
        return FakeResp(200, {"access_token": "newacc", "expires_in": 3600})

    monkeypatch.setattr(yc.httpx, "get", fake_get)
    monkeypatch.setattr(yc.httpx, "post", fake_post)

    out = yc.YahooClient().get("/game/nfl")
    assert out["fantasy_content"]["ok"] is True
    assert saved["access"] == "newacc"
    assert calls["n"] == 2


def test_999_raises_rate_limited(monkeypatch, cfg):
    monkeypatch.setattr(yc.tokens, "load", _valid_token)
    monkeypatch.setattr(yc.httpx, "get", lambda *a, **k: FakeResp(999))
    with pytest.raises(yc.YahooRateLimited):
        yc.YahooClient().get("/x")
