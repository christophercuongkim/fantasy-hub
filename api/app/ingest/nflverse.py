"""Ingest raw nflverse data into the Parquet cold tier.

nfl_data_py is the analytical backbone — free, no auth. Play-by-play is the
source of truth that PR G aggregates into weekly/team/dvp tables; schedules
carry the Vegas lines the game-script model needs. Data is season-granular
(a season file grows as weeks complete), so a weekly refresh re-pulls the
current season. See implementation plan §5 and the runbook.
"""

from collections.abc import Callable

import nfl_data_py as nfl
import pandas as pd

from app.storage import parquet

# nfl_data_py 0.3.3 reads the OLD `player_stats/player_stats_{year}` files, which
# nflverse froze at 2024. Current weekly player stats live in the `stats_player`
# release (all seasons 2019+), so read that directly and normalize the two
# renamed columns so the rest of the pipeline is unchanged.
_PLAYER_STATS_URL = (
    "https://github.com/nflverse/nflverse-data/releases/download/"
    "stats_player/stats_player_week_{}.parquet"
)
_PLAYER_STATS_RENAMES = {
    "team": "recent_team",
    "passing_interceptions": "interceptions",
}

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
    df = pd.read_parquet(_PLAYER_STATS_URL.format(season))
    df = df.rename(columns=_PLAYER_STATS_RENAMES)
    return _write("player_stats", season, df)


# Made-FG distance buckets → Yahoo's kicking scoring keys (parse.STAT_ID_MAP).
_FG_BUCKETS = (
    ("fgm_0_19", 0, 19),
    ("fgm_20_29", 20, 29),
    ("fgm_30_39", 30, 39),
    ("fgm_40_49", 40, 49),
    ("fgm_50", 50, 999),
)
_KICKING_COLUMNS = (
    "player_id",
    "player_display_name",
    "position",
    "recent_team",
    "season",
    "week",
    *(b[0] for b in _FG_BUCKETS),
    "fg_yds",
    "pat_made",
    "pat_miss",
)


def _aggregate_kicking(df: pd.DataFrame) -> pd.DataFrame:
    """pbp -> one row per kicker-week with the Yahoo kicking stat columns. Pure
    (no I/O) so the bucketing is unit-testable against a synthetic frame."""
    keys = ["kicker_player_id", "season", "week"]

    fg = df[df["field_goal_result"].notna() & df["kicker_player_id"].notna()].copy()
    made = fg[fg["field_goal_result"] == "made"].copy()
    dist = made["kick_distance"]
    for name, lo, hi in _FG_BUCKETS:
        made[name] = ((dist >= lo) & (dist <= hi)).astype("int64")
    made["fg_yds"] = dist.fillna(0)
    fg_agg = made.groupby(keys, as_index=False).agg(
        {**{b[0]: "sum" for b in _FG_BUCKETS}, "fg_yds": "sum"}
    )

    xp = df[df["extra_point_result"].notna() & df["kicker_player_id"].notna()].copy()
    xp["pat_made"] = (xp["extra_point_result"] == "good").astype("int64")
    xp["pat_miss"] = (
        xp["extra_point_result"].isin(["failed", "blocked"]).astype("int64")
    )
    xp_agg = xp.groupby(keys, as_index=False).agg(
        {"pat_made": "sum", "pat_miss": "sum"}
    )

    # A kicker-week with only FGs or only PATs still needs a row → outer merge.
    out = fg_agg.merge(xp_agg, on=keys, how="outer")
    # Identity (name/team) from whichever kicking play we saw — first non-null.
    ident = (
        pd.concat(
            [
                fg[keys + ["kicker_player_name", "posteam"]],
                xp[keys + ["kicker_player_name", "posteam"]],
            ]
        )
        .dropna(subset=["kicker_player_id"])
        .groupby(keys, as_index=False)
        .first()
    )
    out = out.merge(ident, on=keys, how="left")
    for b in _FG_BUCKETS:
        out[b[0]] = out[b[0]].fillna(0).astype("int64")
    for c in ("fg_yds", "pat_made", "pat_miss"):
        out[c] = out[c].fillna(0)
    out = out.rename(
        columns={
            "kicker_player_id": "player_id",
            "kicker_player_name": "player_display_name",
            "posteam": "recent_team",
        }
    )
    out["position"] = "K"
    return out[list(_KICKING_COLUMNS)]


def _ingest_kicking(season: int) -> int:
    """Kicker box score from play-by-play — nflverse ships no kicking weekly
    table, so aggregate FGs (by distance) + PATs per kicker-week ourselves. The
    columns match the Yahoo kicking scoring keys so the projection scores them
    with the league's own modifiers, exactly like the offense box score. Keyed on
    kicker_player_id, which is a gsis id (joins straight to players)."""
    df = nfl.import_pbp_data([season], downcast=True, cache=False)
    return _write("kicking", season, _aggregate_kicking(df))


_TEAM_DEF_STATS = (
    "dst_sack",
    "dst_int",
    "dst_fum_rec",
    "dst_td",
    "dst_ret_td",
    "dst_safety",
    "dst_blk",
    "dst_xpr",
)
_TEAM_DEF_COLUMNS = (
    "player_id",
    "player_display_name",
    "position",
    "recent_team",
    "season",
    "week",
    *_TEAM_DEF_STATS,
    "pts_allowed",
)


def _points_allowed(df: pd.DataFrame) -> pd.DataFrame:
    """[defteam, season, week, pts_allowed] — the points a team's defense gave up,
    i.e. the opponent's final score, one row per team per game."""
    g = df.dropna(subset=["home_team", "away_team"]).groupby(
        ["game_id", "season", "week", "home_team", "away_team"], as_index=False
    )
    finals = g.agg(home=("total_home_score", "max"), away=("total_away_score", "max"))
    home = finals[["home_team", "season", "week", "away"]].rename(
        columns={"home_team": "defteam", "away": "pts_allowed"}
    )
    away = finals[["away_team", "season", "week", "home"]].rename(
        columns={"away_team": "defteam", "home": "pts_allowed"}
    )
    return pd.concat([home, away], ignore_index=True)


def _aggregate_team_defense(df: pd.DataFrame) -> pd.DataFrame:
    """pbp -> one row per team-defense per week with the Yahoo DST stat columns.
    Categories are credited to the defending team (defteam); defensive vs return
    TDs are split by play_type. Keyed on a synthetic gsis 'DST-{ABBR}' matching
    the synthesized DST players. Pure (no I/O) so it's unit-testable."""
    d = df[df["defteam"].notna()].copy()
    keys = ["defteam", "season", "week"]
    d["dst_sack"] = d["sack"].fillna(0)
    d["dst_int"] = d["interception"].fillna(0)
    d["dst_fum_rec"] = (d["fumble_recovery_1_team"] == d["defteam"]).astype("int64")
    d["dst_safety"] = d["safety"].fillna(0)
    scored = (d["touchdown"] == 1) & (d["td_team"] == d["defteam"])
    d["dst_td"] = (scored & d["play_type"].isin(["pass", "run"])).astype("int64")
    d["dst_ret_td"] = (scored & d["play_type"].isin(["punt", "kickoff"])).astype(
        "int64"
    )
    d["dst_blk"] = (
        (d["punt_blocked"] == 1)
        | (d["field_goal_result"] == "blocked")
        | (d["extra_point_result"] == "blocked")
    ).astype("int64")
    d["dst_xpr"] = (d["defensive_two_point_conv"] == 1).astype("int64")

    agg = d.groupby(keys, as_index=False)[list(_TEAM_DEF_STATS)].sum()
    agg = agg.merge(_points_allowed(df), on=keys, how="left")
    agg["pts_allowed"] = agg["pts_allowed"].fillna(0)
    agg["player_id"] = "DST-" + agg["defteam"]
    agg["player_display_name"] = agg["defteam"] + " DST"
    agg["position"] = "DST"
    agg["recent_team"] = agg["defteam"]
    return agg[list(_TEAM_DEF_COLUMNS)]


def _ingest_team_defense(season: int) -> int:
    """Team-defense (DST) box score from play-by-play — the counterpart to the
    kicking aggregate. Scored with the league's DST modifiers (additive cats +
    points-allowed brackets) and projected like a Layer-0 player."""
    df = nfl.import_pbp_data([season], downcast=True, cache=False)
    return _write("team_defense", season, _aggregate_team_defense(df))


_PASS_PBP_COLUMNS = ("player_id", "season", "week", "pick_six")


def _aggregate_pass_pbp(df: pd.DataFrame) -> pd.DataFrame:
    """pbp -> per-passer-week passing stats the nflverse box score omits. Today
    just pick_six (an interception thrown that was returned for a defensive TD),
    which has no box-score column but is a scored event (Yahoo stat 58). Keyed on
    passer_player_id (a gsis id) so it LEFT JOINs the offense projection read.
    Pure (no I/O) for unit-testing."""
    px = df[
        (df["interception"] == 1)
        & (df["touchdown"] == 1)
        & (df["td_team"] == df["defteam"])
        & df["passer_player_id"].notna()
    ].copy()
    px["pick_six"] = 1
    agg = px.groupby(["passer_player_id", "season", "week"], as_index=False)[
        "pick_six"
    ].sum()
    agg = agg.rename(columns={"passer_player_id": "player_id"})
    return agg[list(_PASS_PBP_COLUMNS)]


def _ingest_pass_pbp(season: int) -> int:
    df = nfl.import_pbp_data([season], downcast=True, cache=False)
    return _write("pass_pbp", season, _aggregate_pass_pbp(df))


_INGESTORS: dict[str, Callable[[int], int]] = {
    "pbp": _ingest_pbp,
    "schedules": _ingest_schedules,
    "player_stats": _ingest_player_stats,
    "kicking": _ingest_kicking,
    "team_defense": _ingest_team_defense,
    "pass_pbp": _ingest_pass_pbp,
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
