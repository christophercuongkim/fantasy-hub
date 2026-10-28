from loader.repair_managers import GUID, keeper


def test_keeper_prefers_real_manager_then_picks_then_mine():
    fake = {"fake"}
    shell = {"id": "a", "manager_id": "fake", "picks": 0, "is_mine": True}
    real = {"id": "b", "manager_id": "chris", "picks": 15, "is_mine": False}
    unclaimed = {"id": "c", "manager_id": None, "picks": 15, "is_mine": False}
    assert keeper([shell, real, unclaimed], fake) is real
    # No real manager: the row that holds the draft wins over an empty shell.
    assert keeper([shell, unclaimed], fake) is unclaimed
    # Equal otherwise: the one flagged mine.
    assert keeper([shell, {"id": "d", "manager_id": "fake", "picks": 0, "is_mine": False}], fake) is shell


def test_guid_shape():
    assert GUID.match("OJP3ANS4PWZCN2H4IV5PZ6PAT4")
    assert not GUID.match("--hidden--")
    assert not GUID.match("")
