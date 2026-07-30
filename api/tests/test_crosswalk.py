"""Crosswalk name-normalization + match-decision tests (pure, no DB/network)."""

from app.crosswalk import build


def test_normalize_strips_punctuation_and_suffixes():
    assert build.normalize("Ja'Marr Chase") == "jamarr chase"
    assert build.normalize("Amon-Ra St. Brown") == "amon ra st brown"
    assert build.normalize("Patrick Mahomes II") == "patrick mahomes"
    assert build.normalize("Michael Pittman Jr.") == "michael pittman"


BY_NORM = {
    "jamarr chase": ["p1"],
    "patrick mahomes": ["p2"],
    "mike williams": ["a", "b"],  # two distinct players share the name
}
NORMS = list(BY_NORM)


def test_exact_unique_auto_resolves():
    m = build.classify("Ja'Marr Chase", BY_NORM, NORMS)
    assert m["action"] == "resolved"
    assert m["player_id"] == "p1"
    assert m["method"] == "exact_name"
    assert m["confidence"] == 1.0


def test_team_defense_skipped():
    assert build.classify("Seahawks", BY_NORM, NORMS)["action"] == "defense"
    assert build.classify("49ers", BY_NORM, NORMS)["action"] == "defense"


def test_ambiguous_exact_name_goes_to_review():
    m = build.classify("Mike Williams", BY_NORM, NORMS)
    assert m["action"] == "review"  # two players -> a human must choose


def test_strong_fuzzy_auto_resolves():
    m = build.classify("Patric Mahomes", BY_NORM, NORMS)  # typo
    assert m["action"] == "resolved"
    assert m["player_id"] == "p2"
    assert m["method"] == "fuzzy"
    assert m["confidence"] >= 0.9


def test_no_candidate_is_unmatched():
    assert build.classify("Zzq Nobody", BY_NORM, NORMS)["action"] == "unmatched"
