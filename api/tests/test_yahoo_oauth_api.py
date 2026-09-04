"""Offline tests for the OAuth Fantasy API client (oauth_api).

It mirrors pub_api's surface but fetches through YahooClient with format=json_f,
so parse_jsonf and the sync writers see identical payloads. We assert the paths
and that json_f (not the hostile default json) is requested.
"""

from app.yahoo import client, oauth_api


class _FakeClient:
    def __init__(self):
        self.calls = []

    def get(self, path, params=None, fmt="json"):
        self.calls.append((path, fmt))
        return {"fantasy_content": {"league": {}}}


def _patch(monkeypatch):
    fake = _FakeClient()
    # Reset the module singleton and hand back a fake YahooClient.
    monkeypatch.setattr(oauth_api, "_client", None)
    monkeypatch.setattr(oauth_api, "YahooClient", lambda: fake)
    return fake


def test_endpoints_hit_expected_paths_with_json_f(monkeypatch):
    fake = _patch(monkeypatch)

    oauth_api.teams("449.l.93367")
    oauth_api.settings("449.l.93367")
    oauth_api.roster("449.l.93367.t.1", 3)
    oauth_api.scoreboard("449.l.93367", 5)
    oauth_api.draftresults("449.l.93367")
    oauth_api.transactions("449.l.93367", start=25, count=25)

    paths = [p for p, _ in fake.calls]
    assert paths == [
        "/league/449.l.93367/teams;out=standings",
        "/league/449.l.93367/settings",
        "/team/449.l.93367.t.1/roster;week=3",
        "/league/449.l.93367/scoreboard;week=5",
        "/league/449.l.93367/draftresults",
        "/league/449.l.93367/transactions;types=add,drop,trade,commish;"
        "start=25;count=25",
    ]
    # Every call must request the clean json_f shape, never the default json.
    assert {fmt for _, fmt in fake.calls} == {"json_f"}


def test_client_is_reused_across_calls(monkeypatch):
    fake = _patch(monkeypatch)
    oauth_api.teams("x")
    oauth_api.teams("y")
    # Two fetches, one client instance (token cached + refreshed in memory).
    assert len(fake.calls) == 2
    assert oauth_api._client is fake


def test_not_connected_raised_when_no_token(monkeypatch):
    from app.yahoo import tokens

    # Bypass __init__ (which needs creds) — we only exercise _load's no-token path.
    c = client.YahooClient.__new__(client.YahooClient)
    c._access = None
    monkeypatch.setattr(tokens, "load", lambda: None)
    try:
        c._load()
        raise AssertionError("expected YahooNotConnected")
    except client.YahooNotConnected:
        pass
