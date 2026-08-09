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
