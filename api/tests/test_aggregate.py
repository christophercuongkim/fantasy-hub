"""Aggregation tests — DuckDB over tiny Parquet fixtures, no network."""

import duckdb
import pandas as pd

from app.aggregate import weekly
from app.config import settings
from app.storage import parquet

SEASON = 2024


def _write(dataset: str, df: pd.DataFrame) -> None:
    d = parquet.dataset_dir(dataset, season=SEASON)
    d.mkdir(parents=True, exist_ok=True)
    df.to_parquet(d / "part-0.parquet", index=False)


def _read(dataset: str) -> pd.DataFrame:
    d = parquet.dataset_dir(dataset, season=SEASON)
    return duckdb.sql(f"select * from read_parquet('{d}/*.parquet')").df()


def _player(pid, name, pos, team, opp, week, ppr, **kw):
    base = dict(
        player_id=pid,
        player_display_name=name,
        position=pos,
        recent_team=team,
        season=SEASON,
        week=week,
        opponent_team=opp,
        completions=0,
        attempts=0,
        passing_yards=0,
        passing_tds=0,
        interceptions=0,
        carries=0,
        rushing_yards=0,
        rushing_tds=0,
        targets=0,
        receptions=0,
        receiving_yards=0,
        receiving_tds=0,
        receiving_air_yards=0,
        target_share=0.0,
        air_yards_share=0.0,
        fantasy_points_ppr=ppr,
    )
    base.update(kw)
    return base


def _setup(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "parquet_root", str(tmp_path))
    # two WRs + a QB vs DAL, plus a CB that must be dropped (not a fantasy pos)
    _write(
        "player_stats",
        pd.DataFrame(
            [
                _player(
                    "A",
                    "WR One",
                    "WR",
                    "PHI",
                    "DAL",
                    1,
                    23.0,
                    targets=10,
                    receiving_air_yards=120,
                ),
                _player(
                    "B",
                    "WR Two",
                    "PHI",
                    "PHI",
                    "DAL",
                    1,
                    10.0,
                    targets=5,
                    receiving_air_yards=40,
                    position="WR",
                ),
                _player("C", "QB One", "QB", "PHI", "DAL", 1, 25.0),
                _player("D", "CB One", "CB", "DAL", "PHI", 1, 2.0),
            ]
        ),
    )
    # PHI: 6 pass plays, 4 run plays (pass_rate 0.6); xpass avg ~0.5 -> proe ~0.1
    plays = [
        dict(
            posteam="PHI",
            season=SEASON,
            week=1,
            play_type="pass",
            **{"pass": 1},
            xpass=0.5,
        )
        for _ in range(6)
    ]
    plays += [
        dict(
            posteam="PHI",
            season=SEASON,
            week=1,
            play_type="run",
            **{"pass": 0},
            xpass=0.5,
        )
        for _ in range(4)
    ]
    _write("pbp", pd.DataFrame(plays))
    _write(
        "schedules",
        pd.DataFrame(
            [
                dict(
                    season=SEASON,
                    week=1,
                    home_team="PHI",
                    away_team="DAL",
                    home_score=28,
                    away_score=17,
                ),
            ]
        ),
    )


def test_stats_weekly_drops_non_fantasy_positions(tmp_path, monkeypatch):
    _setup(tmp_path, monkeypatch)
    res = weekly.aggregate_season(SEASON)
    assert res["rows"]["weekly"] == 3  # WR, WR, QB — the CB is dropped
    df = _read("weekly")
    assert set(df["gsis_id"]) == {"A", "B", "C"}
    # adot = air_yards / targets = 120 / 10
    assert round(df.set_index("gsis_id").loc["A", "adot"], 1) == 12.0


def test_defense_vs_pos_rank_and_sum(tmp_path, monkeypatch):
    _setup(tmp_path, monkeypatch)
    weekly.aggregate_season(SEASON)
    df = _read("defense_vs_pos")
    df = df[df["position"] == "WR"]
    row = df.iloc[0]
    assert row["team"] == "DAL"  # DAL is the defense the WRs faced
    assert round(row["points_allowed"], 1) == 33.0  # 23 + 10
    assert row["points_allowed_rank"] == 1  # only defense -> rank 1


def test_team_weekly_rates_and_points(tmp_path, monkeypatch):
    _setup(tmp_path, monkeypatch)
    weekly.aggregate_season(SEASON)
    phi = _read("team").set_index("team").loc["PHI"]
    assert phi["plays"] == 10
    assert round(phi["pass_rate"], 2) == 0.6
    assert round(phi["proe"], 2) == 0.1  # avg(pass - 0.5) = 0.6 - 0.5
    assert phi["points_for"] == 28
    assert phi["points_against"] == 17
