"""Yahoo <-> nflverse player ID crosswalk (PR H, implementation plan §6).

Two steps, run by POST /jobs/crosswalk:
  1. build_players — nfl_data_py.import_ids() -> upsert the canonical `players`
     registry (gsis_id key + every foreign id + normalized name + position).
  2. resolve_draft_picks — match scraped draft_picks.player_name (name only) to
     players; auto-set player_id on a confident match, else queue candidates in
     id_crosswalk_log for the admin review page.

Everything here is Postgres (hot tier) — the app reads players + the review queue.
"""

from __future__ import annotations

import re
from collections import defaultdict
from datetime import UTC, datetime

import nfl_data_py as nfl
import psycopg
from psycopg.types.json import Json
from rapidfuzz import fuzz, process

from app.storage import postgres

FANTASY_POS = ("QB", "RB", "WR", "TE", "K")
_SUFFIX = {"jr", "sr", "ii", "iii", "iv", "v"}
# Draft DST picks are team nicknames, not players — skip them (a team-defense
# value concept is separate). Includes historical Washington names.
TEAM_DEFENSES = {
    "cardinals",
    "falcons",
    "ravens",
    "bills",
    "panthers",
    "bears",
    "bengals",
    "browns",
    "cowboys",
    "broncos",
    "lions",
    "packers",
    "texans",
    "colts",
    "jaguars",
    "chiefs",
    "raiders",
    "chargers",
    "rams",
    "dolphins",
    "vikings",
    "patriots",
    "saints",
    "giants",
    "jets",
    "eagles",
    "steelers",
    "49ers",
    "seahawks",
    "buccaneers",
    "titans",
    "commanders",
    "redskins",
    "football team",
}
AUTO_FUZZY = 90.0  # >= this (and unambiguous) auto-matches; below -> review
REVIEW_FLOOR = 80.0  # below this we don't even surface candidates


def normalize(name: str) -> str:
    """Lowercase, drop punctuation + generational suffixes, collapse spaces.
    Applied to both sides so draft names and registry names compare on equal terms."""
    n = re.sub(r"[.'`]", "", name.lower())
    n = re.sub(r"[-]", " ", n)
    toks = [t for t in re.split(r"\s+", n) if t and t not in _SUFFIX]
    return " ".join(toks).strip()


def _s(v) -> str | None:
    """import_ids gives floats/NaN for id columns; coerce to a clean str or None."""
    if v is None or (isinstance(v, float) and v != v):  # NaN
        return None
    s = str(v).strip()
    if s.endswith(".0"):  # 12345.0 -> 12345
        s = s[:-2]
    return s or None


def build_players(conn: psycopg.Connection) -> int:
    ids = nfl.import_ids()
    ids = ids[ids["gsis_id"].notna() & ids["position"].isin(FANTASY_POS)]
    ids = ids.sort_values("db_season").drop_duplicates("gsis_id", keep="last")

    cols = (
        "gsis_id",
        "pfr_id",
        "espn_id",
        "yahoo_id",
        "sleeper_id",
        "full_name",
        "name_normalized",
        "position",
        "team",
        "draft_year",
    )
    rows = [
        (
            _s(r.gsis_id),
            _s(r.pfr_id),
            _s(r.espn_id),
            _s(r.yahoo_id),
            _s(r.sleeper_id),
            r.name,
            normalize(r.name),
            r.position,
            _s(r.team),
            _i(r.draft_year),
        )
        for r in ids.itertuples()
    ]
    with conn.cursor() as cur:
        cur.execute(
            "CREATE TEMP TABLE _px (gsis_id text, pfr_id text, espn_id text, "
            "yahoo_id text, sleeper_id text, full_name text, name_normalized text, "
            '"position" "position", team text, draft_year integer) ON COMMIT DROP'
        )
    postgres.copy_rows(conn, "_px", cols, rows)
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO players (gsis_id, pfr_id, espn_id, yahoo_id, sleeper_id,
                full_name, name_normalized, "position", team, draft_year, updated_at)
            SELECT gsis_id, pfr_id, espn_id, yahoo_id, sleeper_id, full_name,
                name_normalized, "position", team, draft_year, now() FROM _px
            ON CONFLICT (gsis_id) DO UPDATE SET
                pfr_id = EXCLUDED.pfr_id, espn_id = EXCLUDED.espn_id,
                yahoo_id = EXCLUDED.yahoo_id, sleeper_id = EXCLUDED.sleeper_id,
                full_name = EXCLUDED.full_name,
                name_normalized = EXCLUDED.name_normalized,
                "position" = EXCLUDED."position", team = EXCLUDED.team,
                draft_year = EXCLUDED.draft_year, updated_at = now()
            """
        )
    return len(rows)


def _i(v) -> int | None:
    """Coerce import_ids' float/NaN numeric to an int or None."""
    if v is None or (isinstance(v, float) and v != v):
        return None
    try:
        return int(v)
    except (ValueError, TypeError):
        return None


def _log(cur, source_id, player_id, method, confidence, candidates, verified):
    cur.execute(
        """
        INSERT INTO id_crosswalk_log (source, source_id, player_id, method,
            confidence, candidates_json, verified_at, created_at)
        VALUES ('yahoo', %s, %s, %s, %s, %s, %s, now())
        """,
        (
            source_id,
            player_id,
            method,
            confidence,
            Json(candidates) if candidates else None,
            datetime.now(UTC) if verified else None,
        ),
    )


def resolve_draft_picks(conn: psycopg.Connection) -> dict:
    with conn.cursor() as cur:
        # fresh review queue each run; human-verified matches are preserved.
        cur.execute(
            "DELETE FROM id_crosswalk_log "
            "WHERE source = 'yahoo' AND verified_at IS NULL"
        )
        cur.execute("SELECT id, name_normalized FROM players")
        by_norm: dict[str, list[str]] = defaultdict(list)
        for pid, norm in cur.fetchall():
            by_norm[norm].append(str(pid))
        norms = list(by_norm)
        cur.execute(
            "SELECT DISTINCT player_name FROM draft_picks WHERE player_id IS NULL"
        )
        names = [r[0] for r in cur.fetchall()]

    counts = {"resolved": 0, "review": 0, "unmatched": 0, "defenses": 0}
    with conn.cursor() as cur:
        for name in names:
            m = classify(name, by_norm, norms)
            if m["action"] == "resolved":
                _set(cur, name, m["player_id"])
                _log(
                    cur,
                    name,
                    m["player_id"],
                    m["method"],
                    m["confidence"],
                    m["candidates"],
                    verified=True,
                )
                counts["resolved"] += 1
            elif m["action"] == "review":
                _log(cur, name, None, "fuzzy", None, m["candidates"], verified=False)
                counts["review"] += 1
            elif m["action"] == "defense":
                counts["defenses"] += 1
            else:
                counts["unmatched"] += 1  # retired-name gaps — not logged
    return counts


def classify(name: str, by_norm: dict[str, list[str]], norms: list[str]) -> dict:
    """Pure match decision (no DB) so it's unit-testable. Returns an action of
    resolved / review / defense / unmatched with any match details."""
    norm = normalize(name)
    if norm in TEAM_DEFENSES:
        return {"action": "defense"}
    exact = by_norm.get(norm, [])
    if len(exact) == 1:
        return {
            "action": "resolved",
            "player_id": exact[0],
            "method": "exact_name",
            "confidence": 1.0,
            "candidates": None,
        }
    if len(exact) > 1:  # same name, multiple players — surface them to pick
        return {
            "action": "review",
            "candidates": [
                {"player_id": pid, "name": norm, "score": 100.0} for pid in exact
            ],
        }
    # no exact hit -> fuzzy candidates
    top = process.extract(norm, norms, scorer=fuzz.WRatio, limit=3)
    cands = [
        {"player_id": by_norm[m][0], "name": m, "score": round(s, 1)}
        for m, s, _ in top
        if s >= REVIEW_FLOOR and len(by_norm[m]) == 1
    ]
    best = top[0] if top else None
    unambiguous = bool(best) and (len(top) < 2 or best[1] - top[1][1] >= 5)
    if best and best[1] >= AUTO_FUZZY and unambiguous and len(by_norm[best[0]]) == 1:
        return {
            "action": "resolved",
            "player_id": by_norm[best[0]][0],
            "method": "fuzzy",
            "confidence": round(best[1] / 100, 3),
            "candidates": cands,
        }
    if cands:
        return {"action": "review", "candidates": cands}
    return {"action": "unmatched"}


def _set(cur, player_name: str, player_id: str) -> None:
    cur.execute(
        "UPDATE draft_picks SET player_id = %s "
        "WHERE player_name = %s AND player_id IS NULL",
        (player_id, player_name),
    )


def run() -> dict:
    with postgres.connect() as conn:
        players = build_players(conn)
        picks = resolve_draft_picks(conn)
        conn.commit()
    return {"players": players, "draft_picks": picks}
