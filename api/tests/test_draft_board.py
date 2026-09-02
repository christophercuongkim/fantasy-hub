"""Offline tests for the draft value-board pure helpers (no DB / network)."""

from datetime import date

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


def test_age_at_uses_sep1_kickoff():
    # Born Jun 7 1996 → already 30 by the Sep 1 2026 kickoff.
    assert board._age_at(date(1996, 6, 7), 2026) == 30
    # Born Oct 1 → hasn't had the birthday yet at Sep 1.
    assert board._age_at(date(1996, 10, 1), 2026) == 29
    assert board._age_at(None, 2026) is None


def test_age_mult_plateau_slope_and_floor():
    # In the plateau (age <= knee) → no haircut.
    assert board._age_mult("RB", 27) == 1.0
    assert board._age_mult("WR", 25) == 1.0
    # Past the knee → linear decline (RB: 4%/yr past 27).
    assert board._age_mult("RB", 30) == 1.0 - 0.04 * 3  # 0.88
    # Floored (RB floor 0.80 reached at age 32).
    assert board._age_mult("RB", 32) == 0.80
    assert board._age_mult("RB", 40) == 0.80
    # QB plateau runs to 35, so a 30-yo QB is untouched.
    assert board._age_mult("QB", 30) == 1.0
    # No curve for K/DST, and unknown age is a no-op.
    assert board._age_mult("K", 40) == 1.0
    assert board._age_mult("RB", None) == 1.0
