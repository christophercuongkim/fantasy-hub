"""Layer-0 baseline projection tests. Pure math is unit-tested; the end-to-end
runs against small fake Parquet (no nflverse / Postgres)."""

import duckdb
import pandas as pd
import pytest

from app.config import settings
from app.projection import baseline
from app.storage import parquet


def test_points_expr_maps_known_and_skips_unknown():
    e = baseline.points_expr({"rec": 0.5, "rec_yd": 0.1, "pass_td": 4.0, "weird": 9.0})
    assert "(receptions * 0.5)" in e
    assert "(receiving_yards * 0.1)" in e
    assert "(passing_tds * 4.0)" in e
    assert "weird" not in e  # unmapped scoring key is dropped


def test_points_expr_empty_is_zero():
    assert baseline.points_expr({}) == "0"


def test_weighted_projection_requires_min_games():
    one = [{"season": 2024, "week": 1, "pts": 10.0}]
    assert baseline.weighted_projection(one, 2024) is None
    two = one + [{"season": 2024, "week": 2, "pts": 10.0}]
    assert baseline.weighted_projection(two, 2024) is None


def test_weighted_projection_is_recency_weighted():
    games = [
        {"season": 2024, "week": 1, "pts": 0.0},
        {"season": 2024, "week": 2, "pts": 0.0},
        {"season": 2024, "week": 3, "pts": 30.0},  # most recent, high
    ]
    mean, n = baseline.weighted_projection(games, 2024)
    assert n == 3
    assert mean > 10.0  # the recent 30 outweighs the simple avg of 10


@pytest.fixture
def tmp_root(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "parquet_root", str(tmp_path))
    return tmp_path


def _write_season(dataset: str, season: int, df: pd.DataFrame) -> None:
    d = parquet.dataset_dir(dataset, season=season)
    d.mkdir(parents=True, exist_ok=True)
    df.to_parquet(d / "part-0.parquet")


def test_project_week_end_to_end(tmp_root, monkeypatch):
    # half-PPR-ish scoring; only the mapped columns need to exist in the fixture.
    # Postgres write is stubbed so the e2e stays offline (Parquet only).
    from app.projection import priors

    monkeypatch.setattr(
        baseline,
        "league",
        lambda season: ("L1", {"rec": 0.5, "rec_yd": 0.1, "rush_yd": 0.1}),
    )
    monkeypatch.setattr(baseline, "_write_postgres", lambda *a, **k: 0)
    monkeypatch.setattr(priors, "draft_population", lambda *a, **k: [])
    stats = pd.DataFrame(
        {
            "player_id": ["00-1"] * 3,
            "player_display_name": ["A B"] * 3,
            "position": ["WR"] * 3,
            "recent_team": ["NE"] * 3,
            "season": [2024] * 3,
            "week": [1, 2, 3],
            "receptions": [5, 5, 5],
            "receiving_yards": [50, 50, 50],
            "rushing_yards": [0, 0, 0],
            # Layer 1 opportunity columns (OPP_SQL CASE binds all three).
            "attempts": [0, 0, 0],
            "carries": [0, 0, 0],
            "targets": [8, 8, 8],
        }
    )
    _write_season("player_stats", 2024, stats)
    _write_season(
        "schedules",
        2024,
        pd.DataFrame(
            {"season": [2024], "week": [4], "home_team": ["NE"], "away_team": ["BUF"]}
        ),
    )

    out = baseline.project_week(2024, 4)
    assert out["players"] == 1
    assert out["byes_zeroed"] == 0

    mean, p20, p50, p80, is_playing = duckdb.sql(
        f"select mean, p20, p50, p80, is_playing from read_parquet('{out['path']}')"
    ).fetchone()
    # 5*0.5 + 50*0.1 = 7.5 each week; equal games => EWMA is 7.5
    assert mean == pytest.approx(7.5, abs=0.01)
    assert is_playing is True
    # Layer 3: WR distribution around the mean (r50=0.788 → p50 = 7.5*0.788)
    assert p50 == pytest.approx(5.91, abs=0.01)
    assert p20 < mean < p80  # floor below, ceiling above the mean


def test_project_week_zeroes_a_bye(tmp_root, monkeypatch):
    from app.projection import priors

    monkeypatch.setattr(baseline, "league", lambda season: ("L1", {"rec": 0.5}))
    monkeypatch.setattr(baseline, "_write_postgres", lambda *a, **k: 0)
    monkeypatch.setattr(priors, "draft_population", lambda *a, **k: [])
    _write_season(
        "player_stats",
        2024,
        pd.DataFrame(
            {
                "player_id": ["00-2"] * 3,
                "player_display_name": ["C D"] * 3,
                "position": ["WR"] * 3,
                "recent_team": ["KC"] * 3,  # not in the wk4 schedule => bye
                "season": [2024] * 3,
                "week": [1, 2, 3],
                "receptions": [10, 10, 10],
                # Layer 1 opportunity columns (OPP_SQL CASE binds all three).
                "attempts": [0, 0, 0],
                "carries": [0, 0, 0],
                "targets": [10, 10, 10],
            }
        ),
    )
    _write_season(
        "schedules",
        2024,
        pd.DataFrame(
            {"season": [2024], "week": [4], "home_team": ["NE"], "away_team": ["BUF"]}
        ),
    )

    out = baseline.project_week(2024, 4)
    assert out["byes_zeroed"] == 1
    mean, p20, p50, p80, sd = duckdb.sql(
        f"select mean, p20, p50, p80, sd from read_parquet('{out['path']}')"
    ).fetchone()
    assert mean == 0.0  # bye-guard
    assert (p20, p50, p80, sd) == (0.0, 0.0, 0.0, 0.0)  # distribution collapses too


def test_project_week_writes_a_prior(tmp_root, monkeypatch):
    """A drafted rookie with no game rows gets a pure-prior projection."""
    import math

    from app.projection import priors

    monkeypatch.setattr(baseline, "league", lambda season: ("L1", {"rec": 0.5}))
    monkeypatch.setattr(baseline, "_write_postgres", lambda *a, **k: 0)
    # a real player with 3 games (gets a Layer 1 projection) …
    _write_season(
        "player_stats",
        2024,
        pd.DataFrame(
            {
                "player_id": ["00-1"] * 3,
                "player_display_name": ["Vet"] * 3,
                "position": ["WR"] * 3,
                "recent_team": ["NE"] * 3,
                "opponent_team": ["BUF"] * 3,
                "season": [2024] * 3,
                "week": [1, 2, 3],
                "receptions": [10, 10, 10],
                "attempts": [0, 0, 0],
                "carries": [0, 0, 0],
                "targets": [12, 12, 12],
            }
        ),
    )
    _write_season(
        "schedules",
        2024,
        pd.DataFrame(
            {"season": [2024], "week": [4], "home_team": ["NE"], "away_team": ["BUF"]}
        ),
    )
    # … plus a drafted rookie who has never played (no player_stats rows).
    monkeypatch.setattr(
        priors,
        "draft_population",
        lambda league_id, season: [
            {"gsis_id": "00-ROOKIE", "position": "WR", "name": "Rook", "adp": 10.0}
        ],
    )

    baseline.project_week(2024, 4)
    path = str(
        parquet.dataset_dir("projections_archive", season=2024, week=4)
        / "part-0.parquet"
    )
    mean, n = duckdb.sql(
        f"select mean, n_games from read_parquet('{path}') where gsis_id = '00-ROOKIE'"
    ).fetchone()
    c = priors.DRAFT_CURVE["WR"]
    expected = max(c["a"] + c["b"] * math.log(10.0), c["replacement"])
    assert n == 0  # pure prior, no games
    assert mean == pytest.approx(round(expected, 2), abs=0.01)


def _schedule(season, weeks, gamedays):
    return pd.DataFrame(
        {
            "season": [season] * len(weeks),
            "week": weeks,
            "home_team": ["NE"] * len(weeks),
            "away_team": ["BUF"] * len(weeks),
            "gameday": gamedays,
        }
    )


def test_current_week_picks_earliest_upcoming(tmp_root):
    # week 1 played (past), weeks 2-3 upcoming → next week to project is 2.
    _write_season(
        "schedules",
        2024,
        _schedule(2024, [1, 2, 3], ["2000-09-08", "2999-09-15", "2999-09-22"]),
    )
    assert baseline.current_week(2024) == 2


def test_current_week_offseason_is_none(tmp_root):
    # every game in the past → regular season complete → no current week.
    past = _schedule(2023, [1, 2], ["2000-09-08", "2000-09-15"])
    _write_season("schedules", 2023, past)
    assert baseline.current_week(2023) is None


def test_current_week_no_schedule_is_none(tmp_root):
    assert baseline.current_week(2099) is None


def test_refresh_current_endpoint(monkeypatch):
    """Resolves the current week from the schedule, then ingests + projects it."""
    from fastapi.testclient import TestClient

    from app.ingest import nflverse
    from app.main import app

    monkeypatch.setattr(baseline, "current_season", lambda: 2024)
    monkeypatch.setattr(
        nflverse,
        "ingest_season",
        lambda season, datasets, force: {"season": season, "datasets": datasets},
    )
    monkeypatch.setattr(baseline, "current_week", lambda season: 5)
    monkeypatch.setattr(
        baseline, "project_week", lambda season, week: {"players": 30, "week": week}
    )

    res = TestClient(app).post("/jobs/refresh-current")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "projected"
    assert body["week"] == 5
    assert body["projected"]["players"] == 30


def test_refresh_current_offseason(monkeypatch):
    """No current week (offseason) → no-op, still 200."""
    from fastapi.testclient import TestClient

    from app.ingest import nflverse
    from app.main import app

    monkeypatch.setattr(baseline, "current_season", lambda: 2024)
    monkeypatch.setattr(
        nflverse, "ingest_season", lambda season, datasets, force: {"ok": True}
    )
    monkeypatch.setattr(baseline, "current_week", lambda season: None)

    res = TestClient(app).post("/jobs/refresh-current")
    assert res.status_code == 200
    assert res.json()["status"] == "offseason"


def test_refresh_current_module_main(monkeypatch, capsys):
    """`python -m app.refresh_current` prints the result and exits 0."""
    import app.refresh_current as mod

    monkeypatch.setattr(
        baseline, "refresh_current", lambda: {"status": "projected", "week": 5}
    )
    assert mod.main() == 0
    assert '"week": 5' in capsys.readouterr().out


def test_refresh_week_endpoint(monkeypatch):
    """The one-click endpoint chains ingest → project and returns both."""
    from fastapi.testclient import TestClient

    from app.ingest import nflverse
    from app.main import app

    monkeypatch.setattr(
        nflverse,
        "ingest_season",
        lambda season, datasets, force: {"season": season, "datasets": datasets},
    )
    monkeypatch.setattr(
        baseline, "project_week", lambda season, week: {"players": 42, "week": week}
    )

    res = TestClient(app).post("/jobs/refresh-week", json={"season": 2024, "week": 5})
    assert res.status_code == 200
    body = res.json()
    assert body["ingested"]["datasets"] == ["player_stats", "schedules"]
    assert body["projected"]["players"] == 42


def test_refresh_all_endpoint(monkeypatch):
    """Fire-and-forget: 202 immediately, backfill runs as a background task."""
    from fastapi.testclient import TestClient

    from app.main import app

    calls = {"n": 0}

    def fake_backfill():
        calls["n"] += 1
        return {}

    monkeypatch.setattr(baseline, "backfill_all", fake_backfill)

    res = TestClient(app).post("/jobs/refresh-all")
    assert res.status_code == 202
    assert res.json()["status"] == "started"
    assert calls["n"] == 1  # TestClient runs background tasks after the response
