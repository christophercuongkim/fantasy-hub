"""Smoke tests for the storage layer. No external services required."""

import duckdb
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app
from app.storage import duck, parquet


def test_parquet_layout(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "parquet_root", str(tmp_path))
    parquet.ensure_layout()
    assert parquet.is_ready()
    for dataset in parquet.DATASETS:
        assert (tmp_path / dataset).is_dir()


def test_dataset_dir_hive_partitioning(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "parquet_root", str(tmp_path))
    path = parquet.dataset_dir("weekly", season=2025, week=7)
    assert path == tmp_path / "weekly" / "season=2025" / "week=07"


def test_dataset_dir_rejects_unknown():
    import pytest

    with pytest.raises(ValueError):
        parquet.dataset_dir("not_a_dataset")


def test_duck_roundtrip(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "parquet_root", str(tmp_path))
    out = parquet.dataset_dir("weekly", season=2025, week=7)
    out.mkdir(parents=True, exist_ok=True)
    target = out / "part-0.parquet"
    with duck.connect() as con:
        con.execute(
            f"COPY (SELECT 1 AS player_id, 7 AS week) TO '{target}' (FORMAT PARQUET)"
        )
        rows = con.execute(
            f"SELECT count(*) FROM '{parquet.glob('weekly')}'"
        ).fetchone()
    assert rows is not None and rows[0] == 1


def test_duck_ping():
    assert duck.ping()


def test_duckdb_importable():
    assert duckdb.__version__


def test_health_ok_without_database_url(tmp_path, monkeypatch):
    # Postgres unconfigured -> 'not_configured', still healthy (200).
    monkeypatch.setattr(settings, "parquet_root", str(tmp_path))
    monkeypatch.setattr(settings, "database_url", None)
    parquet.ensure_layout()
    client = TestClient(app)
    res = client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["postgres"] == "not_configured"
    assert body["duckdb"] == "ok"
    assert body["parquet_root"] == "ok"
