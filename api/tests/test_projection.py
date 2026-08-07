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
    monkeypatch.setattr(
        baseline,
        "league",
        lambda season: ("L1", {"rec": 0.5, "rec_yd": 0.1, "rush_yd": 0.1}),
    )
    monkeypatch.setattr(baseline, "_write_postgres", lambda *a, **k: 0)
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

    mean, is_playing = duckdb.sql(
        f"select mean, is_playing from read_parquet('{out['path']}')"
    ).fetchone()
    # 5*0.5 + 50*0.1 = 7.5 each week; equal games => EWMA is 7.5
    assert mean == pytest.approx(7.5, abs=0.01)
    assert is_playing is True


def test_project_week_zeroes_a_bye(tmp_root, monkeypatch):
    monkeypatch.setattr(baseline, "league", lambda season: ("L1", {"rec": 0.5}))
    monkeypatch.setattr(baseline, "_write_postgres", lambda *a, **k: 0)
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
    mean = duckdb.sql(f"select mean from read_parquet('{out['path']}')").fetchone()[0]
    assert mean == 0.0  # bye-guard
