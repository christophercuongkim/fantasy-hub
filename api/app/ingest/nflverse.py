"""Ingest raw nflverse data into the Parquet cold tier.

nfl_data_py is the analytical backbone — free, no auth. Play-by-play is the
source of truth that PR G aggregates into weekly/team/dvp tables; schedules
carry the Vegas lines the game-script model needs. Data is season-granular
(a season file grows as weeks complete), so a weekly refresh re-pulls the
current season. See implementation plan §5 and the runbook.
"""

from collections.abc import Callable

import nfl_data_py as nfl

from app.storage import parquet

# Earliest season with reliable route-participation data (data dictionary Part 2).
MIN_SEASON = 2019
# player_stats = nflverse's vetted weekly player box score (fantasy points,
# targets, target_share, position, opponent) — the base for stats_weekly + dvp.
DEFAULT_DATASETS = ("pbp", "schedules", "player_stats")


def _write(dataset: str, season: int, df) -> int:
    out = parquet.dataset_dir(dataset, season=season)
    out.mkdir(parents=True, exist_ok=True)
    # Overwrite the season partition (idempotent re-ingest).
    for existing in out.glob("*.parquet"):
        existing.unlink()
    df.to_parquet(out / "part-0.parquet", engine="pyarrow", index=False)
    return len(df)


def _ingest_pbp(season: int) -> int:
    # downcast float64->float32 to keep the ~380-column frame's memory in check.
    df = nfl.import_pbp_data([season], downcast=True, cache=False)
    return _write("pbp", season, df)


def _ingest_schedules(season: int) -> int:
    df = nfl.import_schedules([season])
    return _write("schedules", season, df)


def _ingest_player_stats(season: int) -> int:
    df = nfl.import_weekly_data([season], downcast=True)
    return _write("player_stats", season, df)


_INGESTORS: dict[str, Callable[[int], int]] = {
    "pbp": _ingest_pbp,
    "schedules": _ingest_schedules,
    "player_stats": _ingest_player_stats,
}


def _has_data(dataset: str, season: int) -> bool:
    out = parquet.dataset_dir(dataset, season=season)
    return out.is_dir() and any(out.glob("*.parquet"))


def ingest_season(
    season: int,
    datasets: list[str] | None = None,
    force: bool = False,
) -> dict:
    """Pull the given datasets for one season. Skips a dataset whose partition
    already exists unless force=True."""
    if season < MIN_SEASON:
        raise ValueError(f"season {season} is before the {MIN_SEASON} floor")
    selected = datasets or list(DEFAULT_DATASETS)
    results: dict[str, dict] = {}
    for dataset in selected:
        ingest = _INGESTORS.get(dataset)
        if ingest is None:
            raise ValueError(
                f"unknown dataset {dataset!r}; expected {list(_INGESTORS)}"
            )
        if _has_data(dataset, season) and not force:
            results[dataset] = {"status": "skipped", "rows": None}
            continue
        results[dataset] = {"status": "ingested", "rows": ingest(season)}
    return {"season": season, "datasets": results}


def ingest_week(season: int, week: int) -> dict:
    """A completed week means the season files changed upstream, so re-pull the
    current season's datasets. `week` is informational (which week triggered it)."""
    result = ingest_season(season, list(DEFAULT_DATASETS), force=True)
    result["week"] = week
    return result
