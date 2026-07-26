# Testing & Validation Plan

What "correct" means for each component, and how to check it.

**Framing:** this is a single-user app, so exhaustive unit coverage is a poor use of time. The tests that earn their keep are the ones catching **silent wrongness** — a projection that's plausible but wrong is far more dangerous than a crash.

---

## 1. Priorities

| Tier | What | Why |
|---|---|---|
| **1** | Unit conventions, bye guards, scoring parse | Silent, systematic, affects everything |
| **2** | Yahoo normalization, crosswalk | Breaks loudly but often mid-season |
| **3** | Model backtests, calibration | The whole value proposition |
| **4** | API contracts | Prevents integration surprises |
| **5** | UI | Least valuable — you'll notice visually |

**Skip:** snapshot tests of React components, exhaustive endpoint permutations, mocking Postgres. Not worth it here.

---

## 2. Tier 1 — Invariants

These are the bugs that produce plausible-looking wrong answers. **Assert them in code, not just tests.**

### 2.1 Unit conventions

```python
def test_shares_are_fractions():
    df = load_weekly(2024)
    assert df.target_share.between(0, 1).all()
    assert df.snap_pct.between(0, 1).all()
    assert df.tprr.dropna().between(0, 1).all()

def test_adjustments_centered_on_one():
    for c in ["opp_adj", "pace_adj", "script_adj", "injury_discount"]:
        vals = components[c]
        assert 0.5 < vals.mean() < 1.5, f"{c} not centered on 1.0"
        assert vals.between(0.3, 2.5).all(), f"{c} has implausible outliers"
```

### 2.2 Spread sign convention

The single most invertible thing in the codebase.

```python
def test_spread_sign():
    """nflverse: negative spread_line = home favored."""
    sched = load_schedule(2024)
    home_favored = sched[sched.spread_line < 0]
    win_rate = (home_favored.home_score > home_favored.away_score).mean()
    assert win_rate > 0.60, "spread sign is inverted"

def test_implied_total():
    # total 48, spread -7 (home favored by 7) -> home 27.5, away 20.5
    h, a = implied_totals(total=48, spread=-7)
    assert abs(h - 27.5) < 0.01
    assert abs(a - 20.5) < 0.01
    assert h > a
```

### 2.3 Bye-week guard

```python
def test_no_projection_when_not_playing():
    projs = run_projections(season=2024, week=7)
    bad = projs[(~projs.is_playing) & (projs["mean"] > 0)]
    assert len(bad) == 0, f"{len(bad)} players projected while not playing"

def test_bye_teams_excluded():
    byes = teams_on_bye(2024, 7)
    projs = run_projections(season=2024, week=7)
    playing = projs[projs.is_playing]
    assert not playing.team.isin(byes).any()
```

Also enforce at the database level:

```sql
ALTER TABLE projections ADD CONSTRAINT bye_guard
  CHECK (is_playing OR (mean = 0 AND p50 = 0 AND p80 = 0));
```

### 2.4 Defense rank direction

```python
def test_dvp_rank_direction():
    """Rank 1 = allows MOST points = best matchup."""
    dvp = load_dvp(2024, week=10, position="WR")
    top = dvp[dvp.points_allowed_rank == 1].points_allowed.iloc[0]
    bot = dvp[dvp.points_allowed_rank == 32].points_allowed.iloc[0]
    assert top > bot, "rank direction inverted"
```

### 2.5 Reach delta sign

```python
def test_reach_delta_sign():
    """Positive = drafted EARLIER than ADP."""
    d = compute_reach_delta(adp=24.5, overall_pick=18)
    assert d > 0
```

### 2.6 Scoring parse

```python
def test_half_ppr_parsed():
    settings = normalize_settings(fixture("league_settings.json"))
    assert settings["scoring"]["rec"] == 0.5

def test_scoring_applied_correctly():
    stats = {"rec": 6, "rec_yd": 84, "rec_td": 1}
    assert score(stats, {"rec": 0.5, "rec_yd": 0.1, "rec_td": 6}) == 17.4
    assert score(stats, {"rec": 1.0, "rec_yd": 0.1, "rec_td": 6}) == 20.4
```

**These six invariants catch the majority of silent-wrongness bugs.** Write them first.

---

## 3. Tier 2 — Ingestion

### 3.1 Yahoo normalization

Run against fixtures, no network:

```python
@pytest.mark.parametrize("fixture_name,parser,expected_keys", [
    ("league_settings.json", normalize_settings, {"scoring", "roster_positions"}),
    ("team_roster_week7.json", normalize_roster, {"yahoo_player_id", "slot"}),
    ("league_draftresults.json", normalize_draft, {"overall", "player_key"}),
])
def test_normalizers(fixture_name, parser, expected_keys):
    out = parser(fixture(fixture_name))
    assert out
    first = out[0] if isinstance(out, list) else out
    assert expected_keys.issubset(first.keys())
```

Edge cases that actually occur:

```python
def test_empty_collection():
    assert normalize_roster({"fantasy_content": {"team": [[], {"roster": {"0": {"players": {"count": 0}}}}]}}) == []

def test_missing_collection_key():
    assert normalize_roster({"fantasy_content": {"team": [[], {"roster": {"0": {}}}]}}) == []

def test_string_numbers_coerced():
    out = normalize_league(fixture("users_leagues.json"))
    assert isinstance(out[0]["num_teams"], int)

def test_multi_position_split():
    p = normalize_player({"display_position": "WR,RB"})
    assert p["eligible_positions"] == ["WR", "RB"]
```

### 3.2 Crosswalk

```python
def test_known_players_match():
    """Regression suite of players that must always resolve."""
    for yahoo_id, expected_gsis in KNOWN_MAPPINGS.items():
        assert resolve_yahoo(yahoo_id).gsis_id == expected_gsis

def test_junior_disambiguation():
    """The classic failure: Jr. matched to the father."""
    m = fuzzy_match("Marvin Harrison Jr.", position="WR", team="ARI", season=2024)
    assert m.birthdate.year > 2000

def test_coverage_threshold():
    result = rebuild_crosswalk(season=2024)
    rate = result.matched / (result.matched + result.unmatched)
    assert rate > 0.93, f"coverage dropped to {rate:.1%}"

def test_no_duplicate_mappings():
    """Two Yahoo IDs must never map to one player."""
    dupes = find_duplicate_mappings()
    assert not dupes, f"duplicates: {dupes}"
```

`KNOWN_MAPPINGS` should hold 20–30 players you've manually verified — stars, common-name cases, Jr./Sr. pairs, and a DST. It's your regression net.

### 3.3 Parquet integrity

```python
def test_no_duplicate_player_weeks():
    df = load_weekly(2024)
    assert not df.duplicated(["player_id", "week"]).any()

def test_all_weeks_present():
    df = load_weekly(2024)
    assert set(df.week.unique()) == set(range(1, 19))

def test_target_share_sums_to_one():
    """Per team-week, target shares should sum to ~1."""
    df = load_weekly(2024)
    sums = df.groupby(["team", "week"]).target_share.sum()
    assert sums.between(0.97, 1.03).all()
```

That last one is a strong integrity check — if shares don't sum to 1, the denominator is wrong.

---

## 4. Tier 3 — Model validation

The most important section. **A model that passes unit tests and fails here is worthless.**

### 4.1 Backtest harness

```python
def walk_forward_backtest(seasons, start_week=4, model_version="v2.1"):
    results = []
    for season in seasons:
        for week in range(start_week, 18):
            train = load_data_before(season, week)   # STRICTLY before
            model = fit(train, version=model_version)
            preds = model.predict(season, week)
            actual = load_actuals(season, week)
            results.append(join(preds, actual))
    return pd.concat(results)
```

```python
def test_no_future_leakage():
    """Fitting on week 7 must not change week 6 predictions."""
    m1 = fit(load_data_before(2024, 7))
    p1 = m1.predict(2024, 6)
    m2 = fit(load_data_before(2024, 8))
    p2 = m2.predict(2024, 6)
    assert (p1["mean"] - p2["mean"]).abs().max() < 0.01
```

**Leakage is the most common way to build a model that looks great and performs terribly.** Test for it explicitly.

### 4.2 Layer gates

Each layer ships only if it beats the previous one:

```python
LAYER_GATES = {
    ("v0-baseline", "v1-volume"):  0.06,   # ≥6% MAE improvement
    ("v1-volume",  "v2-context"):  0.03,   # ≥3%
}

@pytest.mark.parametrize("prev,curr,min_gain", [...])
def test_layer_improves(prev, curr, min_gain):
    r_prev = walk_forward_backtest([2023, 2024], model_version=prev)
    r_curr = walk_forward_backtest([2023, 2024], model_version=curr)
    gain = 1 - mae(r_curr) / mae(r_prev)
    assert gain >= min_gain, f"{curr} gains only {gain:.1%} over {prev}"
```

**Layers 3 and 4 are exempt from MAE gates.** Distributions and simulation don't improve point accuracy — they improve decisions. Measure them differently (§4.4, §4.5).

### 4.3 Consensus comparison

```python
def test_beats_consensus():
    results = walk_forward_backtest([2023, 2024])
    ours = mae(results["mean"], results.actual)
    theirs = mae(results.fp_consensus, results.actual)
    assert ours <= theirs * 1.02, f"ours {ours:.2f} vs consensus {theirs:.2f}"
```

**If this fails persistently, use consensus.** That's the honest response, not a reason to keep tuning.

### 4.4 Distribution calibration

```python
def test_interval_coverage():
    r = walk_forward_backtest([2023, 2024])
    for lo, hi, target in [("p10","p90",0.80), ("p20","p80",0.60)]:
        cov = ((r.actual >= r[lo]) & (r.actual <= r[hi])).mean()
        assert abs(cov - target) < 0.05, f"{lo}-{hi} coverage {cov:.1%}, want {target:.0%}"

def test_coverage_by_position():
    """Coverage must hold per position, not just on average."""
    r = walk_forward_backtest([2023, 2024])
    for pos in ["QB","RB","WR","TE"]:
        sub = r[r.position == pos]
        cov = ((sub.actual >= sub.p20) & (sub.actual <= sub.p80)).mean()
        assert abs(cov - 0.60) < 0.08, f"{pos} coverage {cov:.1%}"
```

**Per-position coverage matters.** Aggregate coverage can look fine while WRs are badly miscalibrated and QBs compensate.

### 4.5 Win-probability calibration

```python
def test_win_prob_calibration():
    sims = backtest_matchups([2023, 2024])
    for lo in [0.5, 0.6, 0.7, 0.8]:
        b = sims[(sims.win_prob >= lo) & (sims.win_prob < lo + 0.1)]
        if len(b) < 20:
            continue
        assert abs(b.won.mean() - b.win_prob.mean()) < 0.08

def test_correlation_widens_distribution():
    """Ignoring correlation understates variance."""
    with_c = simulate(lineup, correlation=True)
    without = simulate(lineup, correlation=False)
    assert with_c.sd > without.sd * 1.05
```

### 4.6 Decision quality

The real measure of Layers 3–4:

```python
def test_distribution_beats_mean_for_startsit():
    """Win-prob-optimal lineups should beat mean-optimal ones."""
    hist = load_historical_matchups([2023, 2024])
    wins_mean = wins_prob = 0
    for m in hist:
        lm = optimize(m, objective="expected_points")
        lp = optimize(m, objective="win_probability")
        wins_mean += actual_score(lm, m) > m.opponent_actual
        wins_prob += actual_score(lp, m) > m.opponent_actual
    assert wins_prob >= wins_mean, "win-prob optimization not helping"
```

**If this fails, Layer 4 isn't earning its complexity.** That's worth knowing.

### 4.7 Sanity checks

```python
def test_elite_players_project_high():
    p = run_projections(2024, 8)
    for pid in ELITE_PLAYER_IDS:
        assert p.loc[pid, "mean"] > 12, "elite player projected low"

def test_backups_project_low():
    p = run_projections(2024, 8)
    for pid in CLEAR_BACKUP_IDS:
        assert p.loc[pid, "mean"] < 8

def test_projections_sum_plausibly():
    """Team weekly fantasy points should be 80-160."""
    p = run_projections(2024, 8)
    totals = p[p.is_playing].groupby("team")["mean"].sum()
    assert totals.between(80, 160).all()
```

Crude, but they catch catastrophic breakage instantly.

---

## 5. Tier 4 — API contracts

### 5.1 Schema validation

```python
def test_response_matches_schema():
    for endpoint, schema in CONTRACT_SCHEMAS.items():
        resp = client.get(endpoint).json()
        jsonschema.validate(resp, schema)
```

```typescript
// TypeScript side
const parsed = ProjectionsResponse.safeParse(await res.json());
expect(parsed.success).toBe(true);
```

### 5.2 Error envelopes

```python
@pytest.mark.parametrize("path,params,expected", [
    ("/projections", {"week": 25}, 422),
    ("/projections", {"league_id": "bogus"}, 404),
    ("/sim/matchup", {"my_lineup": []}, 400),
])
def test_error_codes(path, params, expected):
    r = client.get(path, params=params)
    assert r.status_code == expected
    assert "error" in r.json()
    assert {"code", "message"} <= r.json()["error"].keys()
```

### 5.3 Idempotency

```python
def test_ingest_idempotent():
    before = count_parquet_rows(2024, 7)
    client.post("/jobs/ingest-week", json={"season": 2024, "week": 7})
    assert count_parquet_rows(2024, 7) == before

def test_archive_idempotent():
    client.post("/jobs/archive", json={"season": 2024, "before_week": 5})
    r = client.post("/jobs/archive", json={"season": 2024, "before_week": 5})
    assert r.json()["archived_projections"] == 0
```

---

## 6. Tier 5 — UI

Minimal. You'll see visual breakage yourself.

**Worth testing:**

```typescript
test("bye-week players render as OUT, not 0.0 points", () => { /* … */ });
test("stale projections show a warning banner", () => { /* … */ });
test("close calls render both options, not a false winner", () => { /* … */ });
test("tendency metrics below n=10 are hidden", () => { /* … */ });
```

Each corresponds to a way the UI could mislead you. **Not worth testing:** layout, styling, component snapshots.

---

## 7. Fixtures

```
contracts/fixtures/
  yahoo/           # one real response per endpoint
  espn/            # scoreboard + summary
  nflverse/        # one season sample, ~500 rows
  expected/        # normalized outputs for comparison
```

**Rules:**

1. **Real responses**, captured from live APIs — hand-written fixtures encode your assumptions rather than reality.
2. **Scrub identifiers** — GUIDs, emails, team names.
3. **Keep one per shape**, not one per call.
4. **Regenerate annually** and diff. That diff is your early warning that Yahoo changed something.

---

## 8. CI

Split by cost:

**Every commit (fast, ~30s):**
- Tier 1 invariants
- Normalizer tests against fixtures
- Contract schema validation
- Type checking

**Nightly (~10 min):**
- Full backtest on 2023–2024
- Calibration checks
- Layer gates
- Crosswalk coverage

**Manual before deploy:**
- Sanity checks against live data
- Diagnostics review

Dokploy can run the fast suite as a pre-deploy step. The nightly suite runs as a scheduled job and posts results to `/admin/diagnostics`.

---

## 9. Validation checklist by phase

**Phase 1 (foundations):**
- [ ] All Tier 1 invariants pass
- [ ] Normalizers handle every fixture
- [ ] Crosswalk coverage > 93%
- [ ] Target shares sum to ~1.0 per team-week
- [ ] No duplicate player-weeks
- [ ] Draft history snapshot for all prior seasons

**Phase 2 (projections):**
- [ ] No future leakage
- [ ] Layer 1 beats Layer 0 by ≥6%
- [ ] Layer 2 beats Layer 1 by ≥3%
- [ ] p20–p80 coverage 55–65% overall and per position
- [ ] Beats or matches FantasyPros consensus
- [ ] Bye-week guard enforced in DB and code

**Phase 3 (start/sit):**
- [ ] Win-prob calibration within 8%
- [ ] Correlation increases variance
- [ ] Win-prob lineups ≥ mean-based lineups historically
- [ ] Close calls flagged when delta < 1%
- [ ] Sim completes in < 1s

**Phase 4 (roster management):**
- [ ] Playoff odds sum to `num_playoff_teams` across the league
- [ ] Trade suggestions show both sides' deltas
- [ ] No suggestions past the trade deadline
- [ ] Waiver ranks change when scoring settings change

**Phase 5 (draft):**
- [ ] VORP replacement levels match roster settings
- [ ] Auction values sum to the league budget
- [ ] Tendency metrics suppressed below n=10
- [ ] Draft board updates within 15s of a pick
- [ ] Board usable on a phone

**Phase 6 (live):**
- [ ] Feed failure degrades to stale, not error
- [ ] Timestamp always visible

---

## 10. The five tests that matter most

If you write nothing else:

1. **`test_no_projection_when_not_playing`** — the easiest catastrophic bug to ship.
2. **`test_spread_sign`** — silently inverts every game-script adjustment.
3. **`test_no_future_leakage`** — otherwise your backtest is fiction.
4. **`test_interval_coverage`** — without it, win probabilities are decoration.
5. **`test_beats_consensus`** — tells you whether any of this was worth building.

The last one is the one people skip, and it's the one that answers whether the project succeeded.
