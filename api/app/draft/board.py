"""Preseason draft value board — Slice 1 of the draft assistant.

Ranks draftable players by expected SEASON value for a league's own scoring +
roster, so a snake draft can be run off one cross-position board. The value is:

    expected_ppg = blend(prior-season per-game, games, ADP-prior ppg)   # per game
    season_pts   = expected_ppg × GAMES
    vor          = season_pts − replacement_pts(position)               # the rank key

Per-game production is the prior season scored with THIS league's rules (offense
box score + the kicking / team_defense / pass_pbp aggregates), blended toward the
draft-prior curve (ppg vs ADP) so team/age changes pull a stale number and rookies
with no history fall back to the market. Current ADP is carried as a side column.
Replacement level comes from the league's own starter demand (teams × slots, with
the FLEX split across RB/WR/TE). Written to the `draft_board` table, rebuilt
idempotently by POST /jobs/build-draft-board.
"""

from __future__ import annotations

import json
import urllib.request

from app.crosswalk.names import normalize
from app.projection import baseline, priors
from app.storage import duck, postgres

GAMES = 17  # a full season; durability is not modelled yet (ADP flags the risky)
DRAFT_BLEND_K = 6  # games of shrink toward the ADP prior (~30% over a full season)
REG_WEEK_MAX = 18
FFC_API = "https://fantasyfootballcalculator.com/api/v1/adp/{fmt}?teams=12&year={year}"
_UA = "fantasy-hub/1.0"
# FLEX (W/R/T) slots split across the three eligible positions — typical usage.
_FLEX_SPLIT = {"RB": 0.5, "WR": 0.4, "TE": 0.1}
_POOL_POS = ("QB", "RB", "WR", "TE", "K", "DST")


def _league(cur, league_key: str) -> tuple[str, int, dict, dict, int]:
    cur.execute(
        "SELECT id, season, scoring_json, roster_positions_json, num_teams "
        "FROM leagues WHERE yahoo_league_key = %s",
        (league_key,),
    )
    row = cur.fetchone()
    if not row:
        raise ValueError(f"no league for {league_key}")
    lid, season, sj, rp, num_teams = row
    scoring = {k: float(v) for k, v in ((sj or {}).get("stat_modifiers") or {}).items()}
    return str(lid), int(season), scoring, (rp or {}), int(num_teams)


def _offense_ppg(con, scoring: dict, season: int) -> dict[str, tuple[str, float, int]]:
    """{gsis: (position, total_pts, games)} for QB/RB/WR/TE over `season`, scored
    with the league rules (incl. the pass_pbp pick-six join when present)."""
    g = baseline._season_glob(season)
    if not g:
        return {}
    sc = dict(scoring)
    px = baseline._pass_pbp_glob(season)
    join = ""
    if px:
        join = (
            f"LEFT JOIN read_parquet('{px}') px ON px.player_id = ps.player_id "
            "AND px.season = ps.season AND px.week = ps.week"
        )
    else:
        sc.pop("pick_six", None)
    pts = baseline.points_expr(sc)
    rows = con.execute(
        f"""
        SELECT ps.player_id, ps.position, sum(({pts})::double), count(*)
        FROM read_parquet('{g}') ps {join}
        WHERE ps.position IN {baseline.FANTASY_POS} AND ps.week <= {REG_WEEK_MAX}
        GROUP BY 1, 2
        """
    ).fetchall()
    return {r[0]: (r[1], float(r[2] or 0), int(r[3])) for r in rows}


def _dataset_ppg(
    con, glob: str | None, pts: str, position: str
) -> dict[str, tuple[str, float, int]]:
    """{gsis: (position, total_pts, games)} for a single-position pbp dataset
    (kicking or team_defense) scored with `pts`."""
    if not glob or pts == "0":
        return {}
    rows = con.execute(
        f"""
        SELECT player_id, sum(({pts})::double), count(*)
        FROM read_parquet('{glob}') WHERE week <= {REG_WEEK_MAX} GROUP BY 1
        """
    ).fetchall()
    return {r[0]: (position, float(r[1] or 0), int(r[2])) for r in rows}


def _observed_ppg(scoring: dict, season: int) -> dict[str, tuple[str, float, int]]:
    """Prior-season per-game production across every position, one map."""
    with duck.connect() as con:
        out = _offense_ppg(con, scoring, season)
        out.update(
            _dataset_ppg(
                con,
                baseline._kicking_glob(season),
                baseline.points_expr(scoring, baseline.KICKING_SCORING_COLUMNS),
                "K",
            )
        )
        out.update(
            _dataset_ppg(
                con,
                baseline._team_defense_glob(season),
                baseline.dst_points_expr(scoring),
                "DST",
            )
        )
    return out


def _fetch_adp(year: int, rec: float) -> list[tuple[str, str, float]]:
    """(name, position, adp) from FantasyFootballCalculator, in the league's
    reception format. DEF rows are normalised to our DST position."""
    fmt = "ppr" if rec >= 1 else "half-ppr" if rec > 0 else "standard"
    url = FFC_API.format(fmt=fmt, year=year)
    req = urllib.request.Request(url, headers={"User-Agent": _UA})
    with urllib.request.urlopen(req, timeout=30) as r:  # noqa: S310 — fixed host
        data = json.load(r)
    out = []
    for p in data.get("players", []):
        pos = "DST" if p.get("position") == "DEF" else p.get("position")
        if pos in _POOL_POS and p.get("adp") is not None:
            out.append((p["name"], pos, float(p["adp"])))
    return out


def _replacement_ranks(roster: dict, num_teams: int) -> dict[str, int]:
    """Last-started rank per position = teams × slots, with the FLEX slots split
    across RB/WR/TE. This is the replacement level VOR is measured against."""
    base = {
        p: num_teams * int(roster.get(slot, 0))
        for p, slot in (
            ("QB", "QB"),
            ("RB", "RB"),
            ("WR", "WR"),
            ("TE", "TE"),
            ("K", "K"),
            ("DST", "DEF"),
        )
    }
    flex = num_teams * int(roster.get("W/R/T", 0))
    for pos, share in _FLEX_SPLIT.items():
        base[pos] += round(flex * share)
    return {p: max(1, n) for p, n in base.items()}


def _tiers(sorted_vor: list[float], gap: float = 12.0) -> list[int]:
    """Positional tiers from VOR gaps: a new tier when the drop from the previous
    player exceeds `gap` (season points). Input is VOR sorted descending."""
    tiers, t = [], 1
    for i, v in enumerate(sorted_vor):
        if i and sorted_vor[i - 1] - v > gap:
            t += 1
        tiers.append(t)
    return tiers


def build_draft_board(league_key: str) -> dict:
    """Compute + persist the value board for a league's draft season. Idempotent:
    replaces the (league, season) slice."""
    with postgres.connect() as conn, conn.cursor() as cur:
        league_id, season, scoring, roster, num_teams = _league(cur, league_key)
        prior_season = season - 1
        observed = _observed_ppg(scoring, prior_season)
        adp = _fetch_adp(season, scoring.get("rec", 0.0))

        # Resolve each ADP player to our registry by normalized name + position.
        cur.execute(
            "SELECT name_normalized, position, id, gsis_id FROM players "
            "WHERE position = ANY(%s)",
            (list(_POOL_POS),),
        )
        by_key: dict[tuple[str, str], tuple[str, str]] = {}
        for nn, pos, pid, gsis in cur.fetchall():
            by_key.setdefault((nn, pos), (pid, gsis))

        players: list[dict] = []
        for name, pos, a in adp:
            hit = by_key.get((normalize(name), pos))
            if not hit:
                continue  # unmatched (rare) — surfaced in the result count
            pid, gsis = hit
            obs = observed.get(gsis)
            prior = priors.prior_ppg(pos, a)
            if obs:
                ppg = (
                    priors.blend(obs[1] / obs[2], obs[2], prior, k=DRAFT_BLEND_K)
                    if prior is not None
                    else obs[1] / obs[2]
                )
            elif prior is not None:
                ppg = prior  # rookie / no prior-season rows → pure ADP prior
            else:
                continue  # K/DST with no history and no curve — can't value
            players.append(
                {
                    "pid": pid,
                    "pos": pos,
                    "ppg": ppg,
                    "season_pts": ppg * GAMES,
                    "adp": a,
                }
            )

        # Replacement level per position, then VOR + ranks + tiers.
        repl_rank = _replacement_ranks(roster, num_teams)
        by_pos: dict[str, list[dict]] = {}
        for p in players:
            by_pos.setdefault(p["pos"], []).append(p)
        for pos, group in by_pos.items():
            group.sort(key=lambda p: p["season_pts"], reverse=True)
            idx = min(repl_rank.get(pos, len(group)), len(group)) - 1
            repl = group[idx]["season_pts"]
            for rank, p in enumerate(group, start=1):
                p["vor"] = p["season_pts"] - repl
                p["pos_rank"] = rank
            for p, t in zip(group, _tiers([p["vor"] for p in group]), strict=True):
                p["tier"] = t

        players.sort(key=lambda p: p["vor"], reverse=True)
        rows = [
            (
                league_id,
                season,
                p["pid"],
                round(p["ppg"], 2),
                round(p["season_pts"], 1),
                round(p["vor"], 1),
                p["pos_rank"],
                overall,
                p["tier"],
                round(p["adp"], 1),
            )
            for overall, p in enumerate(players, start=1)
        ]
        cur.execute(
            "DELETE FROM draft_board WHERE league_id = %s AND season = %s",
            (league_id, season),
        )
        cur.executemany(
            "INSERT INTO draft_board (league_id, season, player_id, expected_ppg, "
            "season_pts, vor, pos_rank, overall_rank, tier, adp, updated_at) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s, now())",
            rows,
        )
        conn.commit()
    return {
        "league_key": league_key,
        "season": season,
        "prior_season": prior_season,
        "adp_players": len(adp),
        "board_size": len(players),
        "unmatched": len(adp) - len(players),
    }
