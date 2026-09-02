# Draft board — age + durability adjustments (#2 + #3)

Branch: `feat/draft-age-durability` off main. Code PR → stops for review.

## Design (signed off 2026-09-02)
- **Durability (#3):** replace flat GAMES=17 with per-player expected games =
  clamp(Σ w·(games_s/possible_s), 10, 17), weights last-2 seasons {0.65, 0.35},
  possible=17 (16 pre-2021). Established-guard: only apply if a recent season had
  games ≥ 10; else stay 17 (no backup confound). Floor 10.
- **Age (#2):** ppg multiplier, piecewise-linear from a per-pos knee, floored.
  RB knee 27 / −4%/yr / floor .80; WR 28 / −3 / .82; TE 29 / −3 / .85;
  QB 35 / −3 / .85; K/DST none. Age at Sep 1 kickoff from players.birthdate.
- Both multiply into season_pts = base_ppg · age_mult · expected_games.
- **Gate:** backtest 2025 board (2024 obs + 2025 ADP) four ways
  (flat / +dur / +age / +both) vs actual 2025 pts. Ship only variants that beat
  flat. Metrics: Spearman, top-24/36 hit rate, points captured by top-N.

## Tasks
- [x] Branch off main
- [x] birthdate through build_players (import_ids carries it; upsert by gsis) + backfill prod+QA
- [x] board.py: `_age_at`, `_age_mult`; age multiplier folded into build_draft_board
- [x] Backtest script (scratchpad): 4 combos × 3 seasons, scored vs actual pts
- [x] Unit tests for the age helpers
- [ ] Rebuild real 2026 board (prod+QA) — POST-MERGE (needs deployed code)
- [ ] PR with backtest numbers; self-review; STOP for review

## Review
Backtest (2023–25, one fixed ruleset, VOR vs actual season pts):

    season  flat→+age spearman   +dur
    2025    0.418 → 0.433        0.394  ✗
    2024    0.422 → 0.442        0.399  ✗
    2023    0.448 → 0.452        0.457  (helps once)

Age beats flat on rank-corr all 3 yrs + captures more deep value (vor@36 up
every year). Durability regressed 2024/25 (past availability doesn't predict
next-year games) → **cut per the pre-agreed gate**. Shipped: age only.

birthdate backfill: 3347/3354 (prod), 3348/3355 (QA) skill-pos covered (the
handful missing are DST sentinels). Age preview on the live 2026 board: CMC
0.88, Henry 0.80 (floor), Saquon 0.92, Jacobs 0.96; young studs + QBs 1.00.

Decisions: age curve/knees per the signed-off table; durability code removed
rather than left flag-off (backtest rejected it — revisit only with real
injury-report data). birthdate rides the existing registry build (import_ids
carries it), so no separate ingest job or migration (column already existed).

Note: build_draft_board changes rankings but the live board won't reflect age
until this merges + deploys and the board is rebuilt (birthdate data is already
backfilled and survives old-code registry runs).
