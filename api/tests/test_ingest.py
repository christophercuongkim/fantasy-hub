"""Ingestion tests — nfl_data_py is mocked so CI runs offline and fast.

A real pull is verified manually (see the PR); here we test the write/idempotency
logic + the job endpoints against small fake frames.
"""

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.ingest import nflverse
from app.main import app
from app.storage import duck, parquet


@pytest.fixture(autouse=True)
def tmp_root(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "parquet_root", str(tmp_path))


@pytest.fixture
def fake_nfl(monkeypatch):
    monkeypatch.setattr(
        nflverse.nfl,
        "import_pbp_data",
        lambda seasons, **kw: pd.DataFrame({"play_id": [1, 2], "week": [1, 1]}),
    )
    monkeypatch.setattr(
        nflverse.nfl,
        "import_schedules",
        lambda seasons: pd.DataFrame(
            {"game_id": ["2024_01_KC_BAL"], "spread_line": [-3.5]}
        ),
    )


def test_ingest_season_writes_readable_parquet(fake_nfl):
    res = nflverse.ingest_season(2024)
    assert res["datasets"]["pbp"] == {"status": "ingested", "rows": 2}
    assert res["datasets"]["schedules"]["rows"] == 1
    with duck.connect() as con:
        rows = con.execute(f"SELECT count(*) FROM '{parquet.glob('pbp')}'").fetchone()
    assert rows[0] == 2


def test_idempotent_skip_then_force(fake_nfl):
    nflverse.ingest_season(2024)
    skipped = nflverse.ingest_season(2024)
    assert skipped["datasets"]["pbp"]["status"] == "skipped"
    forced = nflverse.ingest_season(2024, force=True)
    assert forced["datasets"]["pbp"]["status"] == "ingested"


def test_season_floor_rejected():
    with pytest.raises(ValueError):
        nflverse.ingest_season(2018)


def test_unknown_dataset_rejected(fake_nfl):
    with pytest.raises(ValueError):
        nflverse.ingest_season(2024, ["bogus"])


def test_ingest_week_forces_repull(fake_nfl):
    nflverse.ingest_season(2024)
    res = nflverse.ingest_week(2024, 5)
    assert res["week"] == 5
    assert res["datasets"]["pbp"]["status"] == "ingested"


def test_endpoint_ingest_season_ok(fake_nfl):
    client = TestClient(app)
    r = client.post("/jobs/ingest-season", json={"season": 2024})
    assert r.status_code == 200
    assert r.json()["datasets"]["pbp"]["rows"] == 2


def test_endpoint_season_floor_422(fake_nfl):
    client = TestClient(app)
    r = client.post("/jobs/ingest-season", json={"season": 2018})
    assert r.status_code == 422
