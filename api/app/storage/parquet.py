"""Parquet cold-tier layout on the VPS.

Path convention: {PARQUET_ROOT}/{dataset}/season={YYYY}/[week={WW}/]part-*.parquet
Hive partitioning lets DuckDB prune directories. See data dictionary Part 2.
"""

from pathlib import Path

from app.config import settings

# Datasets stored as Parquet. `backups` is for pg_dump output, not a dataset.
DATASETS: tuple[str, ...] = (
    "pbp",
    "weekly",
    "team",
    "defense_vs_pos",
    "projections_archive",
    "api_archive",
)


def root() -> Path:
    return Path(settings.parquet_root)


def dataset_dir(
    dataset: str, season: int | None = None, week: int | None = None
) -> Path:
    """Hive-partitioned directory for a dataset, optionally down to season/week."""
    if dataset not in DATASETS:
        raise ValueError(f"unknown dataset {dataset!r}; expected one of {DATASETS}")
    path = root() / dataset
    if season is not None:
        path = path / f"season={season}"
    if week is not None:
        path = path / f"week={week:02d}"
    return path


def glob(dataset: str, pattern: str = "**/*.parquet") -> str:
    """Glob string for DuckDB to scan a dataset (e.g. weekly/**/*.parquet)."""
    return str(root() / dataset / pattern)


def ensure_layout() -> None:
    """Create the dataset directories + backups. Idempotent."""
    for dataset in DATASETS:
        (root() / dataset).mkdir(parents=True, exist_ok=True)
    (root() / "backups").mkdir(parents=True, exist_ok=True)


def is_ready() -> bool:
    """True when the Parquet root exists and is writable."""
    root_path = root()
    if not root_path.is_dir():
        return False
    probe = root_path / ".healthcheck"
    try:
        probe.touch()
        probe.unlink()
        return True
    except OSError:
        return False
