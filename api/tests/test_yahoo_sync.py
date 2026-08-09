"""Offline tests for the sync orchestration (sync_teams is monkeypatched — the
DB write itself is exercised via the endpoint/integration, not here)."""

from app.yahoo import sync


def test_sync_all_teams_loops_all_keys(monkeypatch):
    monkeypatch.setattr(
        sync, "sync_teams", lambda payload: {"league_key": payload, "teams_updated": 12}
    )
    out = sync.sync_all_teams(fetch=lambda k: k, keys=["449.l.93367", "461.l.328209"])
    assert out["leagues"] == 2
    assert out["synced"] == 2
    assert out["results"][0]["league_key"] == "449.l.93367"


def test_sync_all_teams_records_per_league_error(monkeypatch):
    def fake(payload):
        if payload == "bad":
            raise ValueError("no league row for bad")
        return {"league_key": payload}

    monkeypatch.setattr(sync, "sync_teams", fake)
    out = sync.sync_all_teams(fetch=lambda k: k, keys=["good", "bad"])
    assert out["synced"] == 1  # one succeeded, one recorded its error and continued
    assert out["results"][1]["error"] == "no league row for bad"
