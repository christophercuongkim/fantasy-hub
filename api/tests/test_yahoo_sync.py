"""Offline tests for the sync orchestration (sync_teams is monkeypatched — the
DB write itself is exercised via the endpoint/integration, not here)."""

from types import SimpleNamespace

from app.crosswalk.names import normalize
from app.yahoo import sync


def _player(pid, name, pos):
    return SimpleNamespace(yahoo_player_id=pid, name=name, primary_position=pos)


class _FakeCursor:
    """Records execute() calls; the one SELECT returns the seeded registry rows."""

    def __init__(self, registry):
        # registry: list of (name, position, players_id, yahoo_id)
        self._rows = [(normalize(n), p, i, y) for n, p, i, y in registry]
        self.calls: list[tuple[str, tuple]] = []
        self._armed: list = []

    def execute(self, sql, params=()):
        self.calls.append((sql, params))
        if sql.lstrip().startswith("SELECT"):
            self._armed = self._rows

    def fetchall(self):
        return self._armed

    def updates(self):
        return [c for c in self.calls if c[0].lstrip().startswith("UPDATE players")]


def test_resolve_by_name_unique_match_backfills_yahoo_id():
    cur = _FakeCursor([("Justin Jefferson", "WR", "uuid-jj", None)])
    resolved, ids = sync._resolve_by_name(
        cur, [_player("999", "Justin Jefferson", "WR")]
    )
    assert resolved == {"999": "uuid-jj"}
    assert ids == {"999"}
    # self-heal: the null yahoo_id gets backfilled with the Yahoo id
    ups = cur.updates()
    assert len(ups) == 1 and ups[0][1] == ("999", "uuid-jj")


def test_resolve_by_name_ambiguous_and_missing_are_unresolved():
    cur = _FakeCursor(
        [
            ("Mike Williams", "WR", "uuid-a", None),  # two WRs, same name…
            ("Mike Williams", "WR", "uuid-b", None),
        ]
    )
    resolved, _ = sync._resolve_by_name(
        cur,
        [
            _player("1", "Mike Williams", "WR"),  # ambiguous → skip
            _player("2", "Nobody Here", "RB"),  # no registry row → skip
        ],
    )
    assert resolved == {}
    assert cur.updates() == []  # nothing guessed, nothing backfilled


def test_resolve_by_name_keeps_existing_different_id():
    # registry row already carries a yahoo_id — resolve for the roster insert but
    # never clobber the stored id.
    cur = _FakeCursor([("Puka Nacua", "WR", "uuid-pn", "111")])
    resolved, _ = sync._resolve_by_name(cur, [_player("222", "Puka Nacua", "WR")])
    assert resolved == {"222": "uuid-pn"}
    assert cur.updates() == []


def test_resolve_by_name_position_must_match():
    cur = _FakeCursor([("Taysom Hill", "TE", "uuid-th", None)])
    # same name, different Yahoo primary position → not a confident match
    resolved, _ = sync._resolve_by_name(cur, [_player("333", "Taysom Hill", "QB")])
    assert resolved == {}


def test_usable_manager_skips_hidden_and_junk():
    # a real guid + a real nickname is a person…
    assert sync._usable_manager("OJP3ANS4PWZCN2H4IV5PZ6PAT4", "Chris") is True
    # …but Yahoo's "--hidden--" nickname (visible only as a guid) is not, and
    # neither is a junk guid or a missing nickname.
    assert sync._usable_manager("W3GRV2ATIOO2JZAKNWQ7RSJZUY", "--hidden--") is False
    assert sync._usable_manager("--", "--hidden--") is False
    assert sync._usable_manager(None, "Someone") is False
    assert sync._usable_manager("W3GRV2ATIOO2JZAKNWQ7RSJZUY", None) is False


def test_sync_all_teams_loops_all_keys(monkeypatch):
    monkeypatch.setattr(
        sync, "sync_teams", lambda payload: {"league_key": payload, "teams_updated": 12}
    )
    out = sync.sync_all_teams(fetch=lambda k: k, keys=["449.l.93367", "461.l.328209"])
    assert out["leagues"] == 2
    assert out["synced"] == 2
    assert out["results"][0]["league_key"] == "449.l.93367"


def test_sync_all_teams_records_per_league_error(monkeypatch):
    def fake(payload):
        if payload == "bad":
            raise ValueError("no league row for bad")
        return {"league_key": payload}

    monkeypatch.setattr(sync, "sync_teams", fake)
    out = sync.sync_all_teams(fetch=lambda k: k, keys=["good", "bad"])
    assert out["synced"] == 1  # one succeeded, one recorded its error and continued
    assert out["results"][1]["error"] == "no league row for bad"


class _DraftCursor:
    """Returns canned rows per SELECT and records draft_picks inserts."""

    def __init__(self, league, teams, players):
        self._league, self._teams, self._players = league, teams, players
        self.inserts: list[tuple] = []
        self._armed: list = []

    def execute(self, sql, params=()):
        s = sql.lstrip()
        if s.startswith("SELECT id, season, num_teams"):
            self._armed = [self._league]
        elif s.startswith("SELECT yahoo_team_key"):
            self._armed = self._teams
        elif s.startswith("SELECT yahoo_id"):
            self._armed = self._players
        elif s.startswith("INSERT INTO draft_picks"):
            self.inserts.append(params)

    def fetchone(self):
        return self._armed[0] if self._armed else None

    def fetchall(self):
        return self._armed


class _DraftConn:
    def __init__(self, cur):
        self._cur = cur

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def cursor(self):
        cur = self._cur

        class _CM:
            def __enter__(self):
                return cur

            def __exit__(self, *a):
                return False

        return _CM()

    def commit(self):
        pass


def test_sync_draft_maps_and_computes_pick_in_round(monkeypatch):
    payload = {
        "fantasy_content": {
            "league": {
                "league_key": "470.l.735658",
                "draft_results": [
                    {
                        "draft_result": {
                            "pick": 1,
                            "round": 1,
                            "team_key": "470.l.735658.t.3",
                            "player_key": "470.p.100",
                        }
                    },
                    {
                        "draft_result": {
                            "pick": 13,
                            "round": 2,
                            "team_key": "470.l.735658.t.7",
                            "player_key": "470.p.200",
                        }
                    },
                ],
            }
        }
    }
    cur = _DraftCursor(
        league=("L1", 2026, 12),
        teams=[("470.l.735658.t.3", "team-3"), ("470.l.735658.t.7", "team-7")],
        players=[("100", "player-100")],  # 200 is an unresolved rookie
    )
    monkeypatch.setattr(sync.postgres, "connect", lambda: _DraftConn(cur))
    out = sync.sync_draft("470.l.735658", lambda lk: payload)

    assert out["picks"] == 2 and out["written"] == 2
    assert out["unresolved"] == 1  # player 200 had no yahoo_id match
    # (league_id, season, overall, round, pick_in_round, team_id, player_id, key, cost)
    first, second = cur.inserts
    assert first[2] == 1 and first[4] == 1 and first[6] == "player-100"
    # overall 13, round 2, 12 teams → pick_in_round 13 - 12 = 1; player unresolved
    assert second[2] == 13 and second[4] == 1 and second[6] is None


_DISCOVERY_PAYLOAD = {
    "fantasy_content": {
        "users": [
            {
                "user": {
                    "games": [
                        {
                            "game": {
                                "code": "nfl",
                                "leagues": [
                                    {
                                        "league": {
                                            "league_key": "470.l.735658",
                                            "name": "PeopleCanEat",
                                            "season": "2026",
                                            "num_teams": 12,
                                        }
                                    },
                                    {
                                        "league": {
                                            "league_key": "470.l.999999",
                                            "name": "New One",
                                            "season": "2026",
                                            "num_teams": 10,
                                        }
                                    },
                                ],
                            }
                        }
                    ]
                }
            }
        ]
    }
}


def test_discover_leagues_creates_missing_skips_existing(monkeypatch):
    monkeypatch.setattr(sync, "_known_league_keys", lambda: {"470.l.735658"})
    made = []

    def create(lk):
        made.append(lk)
        return {"season": 2026}

    out = sync.discover_leagues(_DISCOVERY_PAYLOAD, create)
    assert made == ["470.l.999999"]  # only the unknown one is created
    assert out["existing"] == ["470.l.735658"]
    assert [c["league_key"] for c in out["created"]] == ["470.l.999999"]
    assert len(out["discovered"]) == 2


def test_discover_leagues_records_create_error(monkeypatch):
    monkeypatch.setattr(sync, "_known_league_keys", lambda: set())

    def create(lk):
        if lk == "470.l.999999":
            raise ValueError("couldn't resolve a family")
        return {"season": 2026}

    out = sync.discover_leagues(_DISCOVERY_PAYLOAD, create)
    ok = next(c for c in out["created"] if c["league_key"] == "470.l.735658")
    bad = next(c for c in out["created"] if c["league_key"] == "470.l.999999")
    assert "error" not in ok  # one league failing doesn't abort the others
    assert bad["error"] == "couldn't resolve a family"


class _StatusCursor:
    """Canned SELECTs; records the DELETE + player_status INSERTs."""

    def __init__(self, season, players):
        self._season = season
        self._players = players  # [(yahoo_id, players_id), ...]
        self.inserts: list[tuple] = []
        self.deletes: list[tuple] = []
        self._armed: list = []

    def execute(self, sql, params=()):
        s = sql.lstrip()
        if s.startswith("SELECT season FROM leagues"):
            self._armed = [(self._season,)]
        elif s.startswith("SELECT yahoo_id, id FROM players"):
            self._armed = self._players
        elif s.startswith("DELETE FROM player_injury_status"):
            self.deletes.append(params)
        elif s.startswith("INSERT INTO player_injury_status"):
            self.inserts.append(params)

    def fetchone(self):
        return self._armed[0] if self._armed else None

    def fetchall(self):
        return self._armed


def _status_page(rows):
    return {"fantasy_content": {"league": {"players": rows}}}


def test_sync_player_status_keeps_injured_and_crosswalks(monkeypatch):
    page0 = _status_page(
        [
            {
                "player": {
                    "player_id": "100",
                    "name": {"full": "A"},
                    "status": "Q",
                    "status_full": "Questionable",
                    "injury_note": "Hamstring",
                }
            },
            {
                "player": {
                    "player_id": "200",
                    "name": {"full": "B"},
                    "status": "IR",
                    "status_full": "Injured Reserve",
                    "injury_note": "Knee",
                }
            },
            {"player": {"player_id": "300", "name": {"full": "C"}, "status": None}},
        ]
    )

    # Only the first page has players; later pages are empty (short pool).
    def fetch(lk, start, count):
        return page0 if start == 0 else _status_page([])

    cur = _StatusCursor(season=2026, players=[("100", "pid-100")])  # 200 unmatched
    monkeypatch.setattr(sync.postgres, "connect", lambda: _DraftConn(cur))

    out = sync.sync_player_status("470.l.735658", fetch, max_players=50, page=25)
    assert out["injured"] == 2  # C (healthy) skipped by the parser
    assert out["written"] == 1  # only the crosswalked player 100
    assert out["unmatched"] == 1  # player 200 had no players.yahoo_id
    assert cur.deletes == [(2026,)]  # season fully refreshed before insert
    assert len(cur.inserts) == 1
    ins = cur.inserts[0]  # (player_id, season, status, status_full, injury_note)
    assert ins[0] == "pid-100" and ins[1] == 2026 and ins[2] == "Q"
    assert ins[3] == "Questionable" and ins[4] == "Hamstring"


def test_sync_player_status_no_league_row(monkeypatch):
    class _NoLeague(_StatusCursor):
        def execute(self, sql, params=()):
            pass  # every SELECT returns nothing → the season lookup fails

    cur = _NoLeague(season=None, players=[])
    monkeypatch.setattr(sync.postgres, "connect", lambda: _DraftConn(cur))
    try:
        sync.sync_player_status("x", lambda *a: _status_page([]))
        raise AssertionError("expected ValueError")
    except ValueError:
        pass
