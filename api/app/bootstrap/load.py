"""Load a hand-authored league config + draft CSVs into Postgres.

One-time bootstrap that fills the leagues / league_teams / draft_picks tables
without the Yahoo API. Idempotent (re-runnable). Superseded automatically by the
Yahoo sync jobs once the app is approved. Draft picks store the raw player name
now; player_id is resolved later by the crosswalk.
"""

import csv
import re
from datetime import date
from pathlib import Path

import psycopg
import yaml
from psycopg.types.json import Json

from app.bootstrap import parse
from app.storage import postgres

_DRAFT_RE = re.compile(r"draft-(\d{4})\.csv$")


def _upsert_league(cur: psycopg.Cursor, cfg: parse.LeagueConfig) -> str:
    deadline = date.fromisoformat(cfg.trade_deadline) if cfg.trade_deadline else None
    cur.execute(
        """
        INSERT INTO leagues (yahoo_league_key, name, season, num_teams,
            scoring_json, roster_positions_json, playoff_start_week,
            num_playoff_teams, waiver_type, trade_deadline, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, now())
        ON CONFLICT (yahoo_league_key) DO UPDATE SET
            name = EXCLUDED.name, season = EXCLUDED.season,
            num_teams = EXCLUDED.num_teams, scoring_json = EXCLUDED.scoring_json,
            roster_positions_json = EXCLUDED.roster_positions_json,
            playoff_start_week = EXCLUDED.playoff_start_week,
            num_playoff_teams = EXCLUDED.num_playoff_teams,
            waiver_type = EXCLUDED.waiver_type,
            trade_deadline = EXCLUDED.trade_deadline, updated_at = now()
        RETURNING id
        """,
        (
            cfg.yahoo_league_key,
            cfg.name,
            cfg.season,
            cfg.num_teams,
            Json(parse.scoring_json(cfg.scoring)),
            Json(cfg.roster_positions),
            cfg.playoff_start_week,
            cfg.num_playoff_teams,
            cfg.waiver_type,
            deadline,
        ),
    )
    return cur.fetchone()[0]


def _upsert_team(cur: psycopg.Cursor, league_id: str, team: parse.Team) -> str:
    """Upsert in app logic, keyed on (league_id, manager_name) — manager names are
    stable across seasons, unlike team keys."""
    cur.execute(
        "SELECT id FROM league_teams WHERE league_id = %s AND manager_name = %s",
        (league_id, team.manager_name),
    )
    row = cur.fetchone()
    if row is not None:
        cur.execute(
            "UPDATE league_teams SET yahoo_team_key = %s, name = %s, "
            "is_mine = %s, draft_position = %s WHERE id = %s",
            (team.yahoo_team_key, team.name, team.is_mine, team.draft_position, row[0]),
        )
        return row[0]
    cur.execute(
        "INSERT INTO league_teams (league_id, yahoo_team_key, name, manager_name, "
        "is_mine, draft_position) VALUES (%s, %s, %s, %s, %s, %s) RETURNING id",
        (
            league_id,
            team.yahoo_team_key,
            team.name,
            team.manager_name,
            team.is_mine,
            team.draft_position,
        ),
    )
    return cur.fetchone()[0]


def _upsert_pick(
    cur: psycopg.Cursor, league_id: str, team_id: str, pick: parse.DraftPickRow
) -> None:
    cur.execute(
        """
        INSERT INTO draft_picks (league_id, season, overall, round, pick_in_round,
            league_team_id, player_name, player_key, cost)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (league_id, season, overall) DO UPDATE SET
            round = EXCLUDED.round, pick_in_round = EXCLUDED.pick_in_round,
            league_team_id = EXCLUDED.league_team_id,
            player_name = EXCLUDED.player_name, player_key = EXCLUDED.player_key,
            cost = EXCLUDED.cost
        """,
        (
            league_id,
            pick.season,
            pick.overall,
            pick.round,
            pick.pick_in_round,
            team_id,
            pick.player_name,
            pick.player_key,
            pick.cost,
        ),
    )


def load(config_dir: Path) -> dict:
    """Load league.yaml + draft-*.csv from config_dir into Postgres."""
    cfg = parse.parse_league(yaml.safe_load((config_dir / "league.yaml").read_text()))

    counts = {"teams": 0, "picks": 0, "seasons": []}
    with postgres.connect() as conn, conn.cursor() as cur:
        league_id = _upsert_league(cur, cfg)

        manager_to_team: dict[str, str] = {}
        for team in cfg.teams:
            manager_to_team[team.manager_name] = _upsert_team(cur, league_id, team)
            counts["teams"] += 1

        for csv_path in sorted(config_dir.glob("draft-*.csv")):
            match = _DRAFT_RE.search(csv_path.name)
            if match is None:
                continue
            season = int(match.group(1))
            rows = list(csv.DictReader(csv_path.read_text().splitlines()))
            for pick in parse.parse_draft(rows, season):
                team_id = manager_to_team.get(pick.manager)
                if team_id is None:
                    raise ValueError(
                        f"draft {season} pick {pick.overall}: manager "
                        f"{pick.manager!r} not found in league.yaml teams"
                    )
                _upsert_pick(cur, league_id, team_id, pick)
                counts["picks"] += 1
            counts["seasons"].append(season)

        conn.commit()

    return {"league_id": str(league_id), **counts}
