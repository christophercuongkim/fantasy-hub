"""Offline tests for the ADP fetcher's format choice + row shaping."""

from importer import adp


def test_adp_format_matches_scoring():
    assert adp.adp_format(0.0) == "standard"
    assert adp.adp_format(0.5) == "half-ppr"
    assert adp.adp_format(1.0) == "ppr"
    # quarter rounds to half, three-quarter to full
    assert adp.adp_format(0.25) == "half-ppr"
    assert adp.adp_format(0.75) == "ppr"


def test_format_order_dedups_and_falls_back():
    # half-PPR league: try half-ppr, then the full-coverage fallbacks
    assert adp.format_order(0.5) == ["half-ppr", "ppr", "standard"]
    # PPR league: ppr first, no duplicate ppr in the fallbacks
    assert adp.format_order(1.0) == ["ppr", "standard"]
    # standard league: standard first
    assert adp.format_order(0.0) == ["standard", "ppr"]


def test_rows_shapes_and_filters():
    players = [
        {"name": "Christian McCaffrey", "position": "RB", "adp": 1.3},
        {"name": "Tyreek Hill", "position": "WR", "adp": "2.6"},  # numeric string
        {"name": "No ADP", "position": "K"},  # dropped: no adp
        {"position": "DEF", "adp": 99},  # dropped: no name
    ]
    assert adp._rows(players) == [
        {"name": "Christian McCaffrey", "pos": "RB", "adp": 1.3},
        {"name": "Tyreek Hill", "pos": "WR", "adp": 2.6},
    ]
