"""Offline tests for the draft value-board pure helpers (no DB / network)."""

from app.draft import board


def test_replacement_ranks_split_the_flex():
    # This league: 12 teams, QB1/RB2/WR2/TE1/FLEX1/K1/DEF1.
    roster = {"QB": 1, "RB": 2, "WR": 2, "TE": 1, "W/R/T": 1, "K": 1, "DEF": 1}
    r = board._replacement_ranks(roster, num_teams=12)
    assert r["QB"] == 12  # 12 × 1, no flex
    assert r["TE"] == 13  # 12 + round(12 × 0.1)
    assert r["RB"] == 30  # 24 + round(12 × 0.5)
    assert r["WR"] == 29  # 24 + round(12 × 0.4)
    assert r["K"] == 12 and r["DST"] == 12


def test_tiers_break_on_vor_gaps():
    # VOR descending; a drop > 12 opens a new tier.
    vor = [90.0, 85.0, 60.0, 58.0, 40.0]
    #        t1    t1    t2    t2   t3   (gaps 5, 25, 2, 18)
    assert board._tiers(vor, gap=12.0) == [1, 1, 2, 2, 3]


def test_tiers_single_and_empty():
    assert board._tiers([]) == []
    assert board._tiers([10.0]) == [1]
