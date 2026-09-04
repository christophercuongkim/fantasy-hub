"""Offline tests for the in-season cron entrypoint (no network / DB)."""

import pytest

from app import refresh_league
from app.yahoo import oauth_api, sync


def _patch_fetch(monkeypatch):
    # The fetch fns are only forwarded to the (patched) writers, so stub them cheap.
    monkeypatch.setattr(oauth_api, "roster", lambda tk, wk: {})
    monkeypatch.setattr(oauth_api, "scoreboard", lambda lk, wk: {"lk": lk, "wk": wk})
    monkeypatch.setattr(oauth_api, "transactions", lambda lk, s=0, c=25: {})
    monkeypatch.setattr(oauth_api, "players", lambda lk, s=0, c=25: {})


def _patch_writers(monkeypatch):
    monkeypatch.setattr(sync, "sync_rosters", lambda lk, f, wk: {"written": 10})
    monkeypatch.setattr(sync, "sync_matchups", lambda p: {"written": 2})
    monkeypatch.setattr(sync, "sync_all_transactions", lambda lk, f: {"written": 5})
    monkeypatch.setattr(sync, "sync_player_status", lambda lk, f: {"written": 3})


def test_run_synced(monkeypatch):
    monkeypatch.setattr(refresh_league.baseline, "current_season", lambda: 2026)
    monkeypatch.setattr(refresh_league.baseline, "current_week", lambda s: 3)
    monkeypatch.setattr(sync, "season_league_keys", lambda s: ["470.l.735658"])
    _patch_fetch(monkeypatch)
    _patch_writers(monkeypatch)

    out = refresh_league.run()
    assert out["status"] == "synced"
    assert out["season"] == 2026 and out["week"] == 3
    assert len(out["leagues"]) == 1
    lg = out["leagues"][0]
    assert lg["league_key"] == "470.l.735658"
    assert {"rosters", "matchups", "transactions", "injuries"} <= set(lg)
    assert lg["rosters"]["written"] == 10


def test_run_loops_every_league(monkeypatch):
    """A user with two teams that season → both leagues synced."""
    monkeypatch.setattr(refresh_league.baseline, "current_season", lambda: 2026)
    monkeypatch.setattr(refresh_league.baseline, "current_week", lambda s: 1)
    monkeypatch.setattr(sync, "season_league_keys", lambda s: ["470.l.1", "470.l.2"])
    _patch_fetch(monkeypatch)
    _patch_writers(monkeypatch)

    out = refresh_league.run()
    assert [lg["league_key"] for lg in out["leagues"]] == ["470.l.1", "470.l.2"]


def test_run_offseason_noops(monkeypatch):
    monkeypatch.setattr(refresh_league.baseline, "current_season", lambda: 2026)
    monkeypatch.setattr(refresh_league.baseline, "current_week", lambda s: None)
    # No writers/fetch needed — the run must not reach them.
    out = refresh_league.run()
    assert out == {"status": "offseason", "season": 2026}


def test_run_no_league_seasons(monkeypatch):
    monkeypatch.setattr(refresh_league.baseline, "current_season", lambda: None)
    assert refresh_league.run() == {"status": "no_league_seasons"}


def test_run_no_leagues_this_season(monkeypatch):
    monkeypatch.setattr(refresh_league.baseline, "current_season", lambda: 2026)
    monkeypatch.setattr(refresh_league.baseline, "current_week", lambda s: 3)
    monkeypatch.setattr(sync, "season_league_keys", lambda s: [])
    assert refresh_league.run() == {"status": "no_leagues", "season": 2026}


def test_leg_valueerror_marks_degraded(monkeypatch):
    """A data error in one leg is recorded; the run is degraded, others still run."""
    monkeypatch.setattr(refresh_league.baseline, "current_season", lambda: 2026)
    monkeypatch.setattr(refresh_league.baseline, "current_week", lambda s: 3)
    monkeypatch.setattr(sync, "season_league_keys", lambda s: ["470.l.735658"])
    _patch_fetch(monkeypatch)
    _patch_writers(monkeypatch)

    def _boom(lk, f, wk):
        raise ValueError("unmatched name")

    monkeypatch.setattr(sync, "sync_rosters", _boom)

    out = refresh_league.run()
    assert out["status"] == "degraded"
    lg = out["leagues"][0]
    assert lg["rosters"] == {"error": "unmatched name"}
    assert lg["matchups"]["written"] == 2  # other legs still ran


def test_main_degraded_exits_nonzero(monkeypatch, capsys):
    monkeypatch.setattr(refresh_league, "run", lambda: {"status": "degraded"})
    assert refresh_league.main() == 1
    assert "degraded" in capsys.readouterr().out


def test_main_synced_exits_zero(monkeypatch):
    monkeypatch.setattr(refresh_league, "run", lambda: {"status": "synced"})
    assert refresh_league.main() == 0


def test_auth_error_propagates(monkeypatch):
    """A non-ValueError (auth/upstream) aborts the run rather than being recorded."""
    monkeypatch.setattr(refresh_league.baseline, "current_season", lambda: 2026)
    monkeypatch.setattr(refresh_league.baseline, "current_week", lambda s: 3)
    monkeypatch.setattr(sync, "season_league_keys", lambda s: ["470.l.735658"])
    _patch_fetch(monkeypatch)
    _patch_writers(monkeypatch)

    def _auth(lk, f, wk):
        raise RuntimeError("token refresh failed")

    monkeypatch.setattr(sync, "sync_rosters", _auth)
    with pytest.raises(RuntimeError, match="token refresh failed"):
        refresh_league.run()
