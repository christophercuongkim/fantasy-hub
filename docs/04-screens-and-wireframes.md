# Screens & Wireframes

Every page: what's on it, what data it needs, what the user can do. **Layout and information hierarchy, not visual design.**

Purpose is to prevent building projections you never surface, and to catch missing endpoints before you write them.

---

## Route map

```
/                          Dashboard — this week at a glance
/lineup                    Start/sit — the primary weekly screen
/players                   Player table — sort, filter, compare
/players/[id]              Player detail — trends and diagnostics
/waivers                   Waiver recommendations
/trades                    Trade finder
/draft                     Draft board (live mode)
/draft/tendencies          Opponent draft profiles
/league                    League overview, standings, playoff odds
/live                      Live scoreboard (game days)
/admin/crosswalk           ID matching review queue
/admin/diagnostics         Model performance
/admin/jobs                Job status and manual triggers
```

**Priority order for building:** `/lineup` → `/players/[id]` → `/waivers` → `/league` → `/trades` → `/draft` → everything else. The lineup screen is the one you'll open weekly.

---

## 1. `/lineup` — Start/sit

**The most important screen in the app.** Build it first.

```
┌──────────────────────────────────────────────────────────────┐
│  Week 7  ·  vs. Manager D          Projections: Tue 9:02am ↻ │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   WIN PROBABILITY          58.3%                             │
│   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░                  │
│   You 118.4  (89–150)      Them 112.7  (84–143)              │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  OPTIMAL LINEUP                          [Apply to Yahoo]    │
│                                                              │
│  QB   Player Name        KC vs BUF   19.2  ▁▃▅▇▅▃▁          │
│  RB   Player Name        SF @ SEA    14.1  ▁▂▄▇▄▂▁          │
│  RB   Player Name        DAL vs PHI  11.8  ▁▄▆▅▃▁▁          │
│  WR   Player Name        MIA vs NYJ  16.4  ▁▂▃▅▇▅▂  ⚠       │
│  WR   Player Name        LAR @ ARI   12.9  ▁▃▅▆▄▂▁          │
│  TE   Player Name        BAL vs CIN   9.2  ▁▄▇▅▂▁▁          │
│  FLX  Player Name        GB @ MIN    10.7  ▁▃▆▆▃▁▁  ●       │
│  K    Player Name        HOU vs IND   8.1                    │
│  DEF  Team Defense       PIT vs CLE   7.9                    │
│                                                              │
│  ⚠ questionable   ● close call                               │
├──────────────────────────────────────────────────────────────┤
│  DECISIONS TO MAKE                                           │
│                                                              │
│  ● FLEX: Player G  vs  Player H          +0.8% — too close   │
│    Player G: 10.7 (p20 5.1 / p80 17.2)                       │
│    Player H: 10.4 (p20 7.8 / p80 13.9)                       │
│    You're favored → the safer floor is marginally better      │
│    [Start G]  [Start H]                                      │
│                                                              │
│  ▼ WR2: Player E over Player F           +4.2%               │
│    · E projects 12.9 vs F's 11.4                             │
│    · E faces the 3rd-softest WR defense                      │
│    · E's target share up to 27% (from 19%) over 3 weeks      │
│    · You're favored → floor matters more than ceiling         │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  BENCH                                                       │
│  WR   Player Name        NE @ NYG     9.8                    │
│  RB   Player Name        TEN vs JAX    7.2   OUT             │
│  ...                                                         │
└──────────────────────────────────────────────────────────────┘
```

**Data:** `POST /sim/optimize-lineup`, `GET /projections`, `GET /meta/current-week`

**Interactions:** swap any starter/bench pair (re-runs sim), expand an explanation, apply lineup to Yahoo, force a re-projection.

**Design notes:**

- **Win probability is the headline number**, not projected points. This is the single most important framing decision in the app.
- Sparklines show the outcome *distribution*, not a trend — the shape communicates boom/bust at a glance.
- Close calls are surfaced as their own category. Manufacturing a winner between two indistinguishable options is dishonest.
- Every recommendation carries its reasons inline. No hidden model.
- The projection timestamp is always visible; staleness matters on Sunday morning.

---

## 2. `/` — Dashboard

```
┌──────────────────────────────────────────────────────────────┐
│  Week 7                                    Wed Oct 15         │
├───────────────────────────┬──────────────────────────────────┤
│  THIS WEEK                │  ACTION ITEMS                    │
│                           │                                  │
│  vs. Manager D            │  ⚠ 2 lineup decisions pending    │
│  Win prob    58.3%        │  ⚠ Player X questionable          │
│  Proj        118.4        │  ↑ 3 waiver targets available    │
│  Their proj  112.7        │  ⇄ 1 trade worth proposing        │
│                           │  ⓘ Player Y on bye next week      │
│  [Set lineup →]           │                                  │
├───────────────────────────┴──────────────────────────────────┤
│  SEASON                                                      │
│  Record 4–2   ·  3rd of 12  ·  Playoff odds 71% (▲4)         │
│  ▁▂▃▅▄▆▇  playoff odds by week                               │
├──────────────────────────────────────────────────────────────┤
│  ROSTER ALERTS                                               │
│  Player A   target share 19% → 27% over 3 weeks       ▲      │
│  Player B   snap share 71% → 52% over 2 weeks         ▼      │
│  Player C   returns from IR this week                  ⓘ      │
└──────────────────────────────────────────────────────────────┘
```

**Data:** `POST /sim/matchup`, `POST /sim/playoff-odds`, `GET /analytics/player/{id}` (change points), `GET /waivers/recommendations`, `GET /trades/suggestions`

**Design note:** this screen exists to answer "what needs my attention?" Every item links to the screen where you act on it. If nothing needs attention, it should say so rather than inventing work.

---

## 3. `/players` — Player table

```
┌──────────────────────────────────────────────────────────────┐
│  [All ▾] [Pos ▾] [Team ▾] [Available ▾]    Search ______     │
├──────────────────────────────────────────────────────────────┤
│  Player          Pos Tm  Opp   Proj  p20  p80  Snap% Tgt%  ▲ │
│  ─────────────────────────────────────────────────────────── │
│  Player Name     WR  KC  BUF   16.4  9.2 24.1   84%  27%  ▲2 │
│  Player Name     RB  SF  @SEA  14.1  8.8 19.4   62%   9%  ─  │
│  Player Name     WR  MIA NYJ   13.9  6.1 22.8   91%  31%  ▲5 │
│  ...                                                         │
│                                                              │
│  Showing 1–50 of 412                        [Compare (2) →]  │
└──────────────────────────────────────────────────────────────┘
```

**Data:** `GET /projections`, weekly aggregates from DuckDB

**Interactions:** sort any column, multi-filter, select 2–4 players to compare, click through to detail.

**Design notes:**

- Virtualized table (TanStack Table) — 400+ rows must scroll smoothly.
- p20/p80 always adjacent to the mean. The whole point is that the mean alone misleads.
- The trend arrow is a change-point flag, not a naive week-over-week delta.

---

## 4. `/players/[id]` — Player detail

```
┌──────────────────────────────────────────────────────────────┐
│  Player Name   WR · KC · #10          Week 7 proj: 16.4      │
├──────────────────────────────────────────────────────────────┤
│  PROJECTION BREAKDOWN                                        │
│                                                              │
│  Base (last 8 wks, decayed)                    12.4          │
│  × routes 33.0 × TPRR 0.254 → 8.4 targets                    │
│  × opponent (BUF, 3rd-softest vs WR)          ×1.12          │
│  × pace                                       ×1.03          │
│  × game script (favored by 3)                 ×0.98          │
│  + vacated targets (Player Z out)              +1.8          │
│  ─────────────────────────────────────────────────           │
│  Projection                                    16.4          │
│  Range (p20–p80)                          9.2 – 24.1         │
├──────────────────────────────────────────────────────────────┤
│  USAGE TRENDS                          [5wk] [10wk] [season] │
│                                                              │
│  Target share    ▁▂▂▃▅▆▇   19% → 27%    ⚑ change wk 4        │
│  Snap %          ▆▆▇▇▇▇▇   84%          stable               │
│  Routes/game     ▄▅▅▆▆▇▇   33.0         ▲                    │
│  aDOT            ▅▄▄▃▃▄▄   11.2         stable               │
│  TPRR            ▃▄▄▅▆▆▇   0.254        ▲                    │
├──────────────────────────────────────────────────────────────┤
│  GAME LOG                                                    │
│  Wk  Opp   Snap  Tgt  Rec  Yds  TD   Pts   Proj   Δ          │
│  6   @LV   88%    9    7   94   1   19.4  14.2  +5.2         │
│  5   DEN   81%    7    5   61   0   11.1  13.8  −2.7         │
│  ...                                                         │
│                                                              │
│  Model accuracy on this player: MAE 4.2, bias −0.8           │
└──────────────────────────────────────────────────────────────┘
```

**Data:** `GET /analytics/player/{id}`, `GET /projections`

**Design notes:**

- The breakdown reads top-to-bottom as arithmetic. A user should be able to check the math.
- Change-point flags (⚑) mark statistically detected role changes, distinct from noise.
- Per-player model bias is shown. If the model consistently under-projects someone, you should know.

---

## 5. `/waivers`

```
┌──────────────────────────────────────────────────────────────┐
│  Waiver targets — Week 7            FAAB remaining: $47      │
├──────────────────────────────────────────────────────────────┤
│  1. Player Name   RB · TEN                       +3.1% odds  │
│     ROS proj 128.4 · schedule next 3: EASY                   │
│     Replaces: Player Q (bench RB)                            │
│     Why: Starter out 4–6 wks, took 71% of snaps after injury │
│     Suggested bid: $12                                       │
│     [Claim]                                                  │
│                                                              │
│  2. Player Name   WR · CAR                       +1.8% odds  │
│     ROS proj 94.2 · schedule next 3: MEDIUM                  │
│     Why: Target share 24% over last 2 weeks (was 11%)        │
│     Suggested bid: $6                                        │
│     [Claim]                                                  │
│                                                              │
│  ─ Handcuffs ─────────────────────────────────────────────   │
│  3. Player Name   RB · BAL              contingent value     │
│     Would be RB1 if starter misses time. No standalone value.│
│     Suggested bid: $2                                        │
└──────────────────────────────────────────────────────────────┘
```

**Data:** `GET /waivers/recommendations`

**Design note:** handcuffs are separated because their value is conditional, not additive. Mixing them into the main ranking overstates their worth.

---

## 6. `/trades`

```
┌──────────────────────────────────────────────────────────────┐
│  Trade suggestions — Week 7        Deadline: Nov 19 (4 wks)  │
│                                                              │
│  These are conversation starters, not evaluations of what    │
│  another manager will accept.                                │
├──────────────────────────────────────────────────────────────┤
│  1. Manager D — RB surplus (4 startable), WR need (2)        │
│                                                              │
│     You give     Player E   WR · MIA   ROS 118.4             │
│     You get      Player F   RB · TEN   ROS 131.2             │
│                                                              │
│     Your odds     58% → 64%   ▲6                             │
│     Their odds    41% → 45%   ▲4                             │
│                                                              │
│     Receptivity: drafts WR ~1.5 rounds ahead of ADP (n=47)   │
│                                                              │
│     [Draft message]  [Dismiss]                               │
│                                                              │
│  2. Manager G — TE surplus, RB need                          │
│     ...                                                      │
└──────────────────────────────────────────────────────────────┘
```

**Data:** `GET /trades/suggestions`, `GET /draft/opponent-tendencies`

**Design notes:**

- **Both sides' odds always shown.** A lopsided trade is one they'll reject; the user should see that before sending.
- The framing disclaimer at the top is deliberate. The model cannot see how another manager values his players, and the UI should not imply otherwise.
- "Draft message" generates a proposal message — the actual hard part is the conversation, not the math.

---

## 7. `/draft` — Live draft board

**Highest information density in the app.** Built for speed under a 60-second clock.

```
┌──────────────────────────────────────────────────────────────┐
│  Round 3 · Pick 28 · YOUR PICK IN 2      ⏱ 0:47              │
├────────────────────────────────┬─────────────────────────────┤
│  BEST AVAILABLE                │  UPCOMING PICKS             │
│                                │                             │
│  ★ Player A  RB  VORP 42.1 T3  │  27 Manager C               │
│    ADP 24.5  (+3.5 value)      │     RB in rd 3 in 3 of 4    │
│                                │     drafts (n=4)            │
│    Player B  WR  VORP 38.9 T2  │                             │
│    ADP 26.1  (+1.9)            │  28 ► YOU                   │
│                                │                             │
│    Player C  RB  VORP 37.2 T3  │  29 Manager F               │
│    ADP 31.0  (−3.0)            │     Reaches +6.2 vs ADP     │
│                                │     (n=51)                  │
│    Player D  TE  VORP 35.8 T1  │                             │
│    ADP 22.4  (+5.6) ★★         │  30 Manager A               │
│                                │     No strong tendency      │
├────────────────────────────────┴─────────────────────────────┤
│  YOUR ROSTER          SCARCITY                               │
│  QB  —                RB  T3: 2 left  ·  14 startable        │
│  RB  Player X         WR  T2: 5 left  ·  31 startable        │
│  RB  —                TE  T1: 1 left  ·  ⚠ 8 startable       │
│  WR  Player Y                                                │
│  WR  —                ⚠ TE tier 1 nearly gone                │
│  TE  —                ⚠ You have no QB (12 startable left)   │
├──────────────────────────────────────────────────────────────┤
│  RECENT   26 Player M (RB) · 25 Player N (WR) · 24 …          │
│  ⚠ 4 RBs taken in the last 6 picks — run in progress          │
└──────────────────────────────────────────────────────────────┘
```

**Data:** `GET /draft/board`, `GET /draft/opponent-tendencies`, `/api/draft/poll` every 5–10s

**Design notes:**

- Opponent tendencies sit **next to** the available list, not on a separate page. The whole value is knowing whether the guy picking before you takes your target.
- Sample sizes are shown on every tendency. `n=4` and `n=51` deserve very different confidence.
- Positional run detection is prominent — it's the most actionable live signal.
- Tier remaining matters more than raw rank.
- **Must work on a phone.** Drafts happen away from desks.

---

## 8. `/draft/tendencies` — Opponent profiles

```
┌──────────────────────────────────────────────────────────────┐
│  Manager profiles          Based on 3 drafts (2022–2024)     │
│                                                              │
│  ⓘ ~45 picks per manager. Enough to spot strong tendencies,  │
│    not enough for confident prediction. Sample sizes shown.  │
├──────────────────────────────────────────────────────────────┤
│  Manager C                                          n = 45   │
│                                                              │
│  First QB      rd 9.3  ▁▁▁▁▁▁▁▁█▁▁▁▁▁     late      n=3     │
│  First RB      rd 2.8  ▁█▁▁▁▁▁▁▁▁▁▁▁▁     early     n=3     │
│  First TE      rd 7.0  ▁▁▁▁▁▁█▁▁▁▁▁▁▁     average   n=3     │
│  First K       rd 13.7 ▁▁▁▁▁▁▁▁▁▁▁▁█▁     normal    n=3     │
│                                                              │
│  Reach delta   +1.2 picks                            n=45    │
│  RB lean       +8% vs league                         n=45    │
│  Rookie share  4%                                    n=45    │
│                                                              │
│  ⓘ 2 metrics hidden (n < 10)                                 │
└──────────────────────────────────────────────────────────────┘
```

**Design note:** the epistemics are the feature here. A histogram of *when* they took QB is far more honest than a mean — a manager who took QB in rounds 2, 9, and 11 has no tendency despite a mean of 7.3.

---

## 9. `/league`

```
┌──────────────────────────────────────────────────────────────┐
│  STANDINGS                          PLAYOFF ODDS             │
│  1  Manager A   5–1   712 pts       94%  ▓▓▓▓▓▓▓▓▓░          │
│  2  Manager B   5–1   688 pts       89%  ▓▓▓▓▓▓▓▓▓░          │
│  3  YOU         4–2   701 pts       71%  ▓▓▓▓▓▓▓░░░          │
│  ...                                                         │
├──────────────────────────────────────────────────────────────┤
│  YOUR ODDS BY WEEK    ▁▂▃▅▄▆▇                                │
│                                                              │
│  POSITIONAL STRENGTH (vs league average)                     │
│  QB  ▓▓▓▓▓▓▓░░░  +12%                                        │
│  RB  ▓▓▓▓░░░░░░  −18%   ← weakest                            │
│  WR  ▓▓▓▓▓▓▓▓▓░  +24%   ← strongest                          │
│  TE  ▓▓▓▓▓░░░░░   −4%                                        │
│                                                              │
│  ⓘ RB weakness + WR surplus → see trade suggestions          │
├──────────────────────────────────────────────────────────────┤
│  REMAINING SCHEDULE   Wk7 D(58%) · Wk8 A(41%) · Wk9 G(67%)…  │
└──────────────────────────────────────────────────────────────┘
```

**Data:** `POST /sim/playoff-odds`, `GET /projections/season`

---

## 10. `/live`

```
┌──────────────────────────────────────────────────────────────┐
│  Week 7 live                     Updated 18:42 UTC  ● live   │
├──────────────────────────────────────────────────────────────┤
│  YOU 64.2          Win prob 38%  ▼         THEM 71.8         │
│  ▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░                        │
│  4 yet to play                              2 yet to play    │
├──────────────────────────────────────────────────────────────┤
│  QB   Player Name    19.4   FINAL                            │
│  RB   Player Name     8.2   Q3 4:21                          │
│  RB   Player Name     0.0   4:25pm                           │
│  WR   Player Name    14.1   FINAL                            │
│  ...                                                         │
└──────────────────────────────────────────────────────────────┘
```

**Data:** `GET /live/scoreboard`, `/api/live/poll` every 20s

**Design note:** when the ESPN fetch fails, show the last-good timestamp and a stale indicator rather than an error. A slightly stale scoreboard is far more useful than a broken page.

---

## 11. `/admin/crosswalk`

```
┌──────────────────────────────────────────────────────────────┐
│  Unmatched players                              23 pending   │
├──────────────────────────────────────────────────────────────┤
│  Yahoo #40021  "Marvin Harrison Jr."  WR · ARI               │
│                                                              │
│  Candidates:                                                 │
│  ○ Marvin Harrison      WR  retired   0.87  ⚠ born 1972      │
│  ○ Marvin Harrison Jr.  WR  ARI       0.94  ✓ born 2002      │
│  ○ None of these — create new                                │
│                                                              │
│  [Confirm]  [Skip]                                           │
└──────────────────────────────────────────────────────────────┘
```

**Design note:** show the *disambiguating* attribute (birthdate here), not just a similarity score. Junior/Senior pairs are the most common failure and name similarity alone can't resolve them.

---

## 12. `/admin/diagnostics`

```
┌──────────────────────────────────────────────────────────────┐
│  Model v2.1-volume            Weeks 1–6, 2025                │
├──────────────────────────────────────────────────────────────┤
│  vs BASELINE          vs CONSENSUS                           │
│  MAE  5.1 / 5.9       Ours 5.1 · FP 5.3   ✓ beating          │
│  −13.6% ✓                                                    │
│                                                              │
│  BY POSITION      MAE   Base   Δ        n                    │
│  QB               4.2   4.8   −12.5%   72                    │
│  RB               5.1   5.9   −13.6%   412                   │
│  WR               5.8   6.4    −9.4%   588                   │
│  TE               4.4   4.9   −10.2%   204                   │
│  DST              5.9   5.8    +1.7%   ⚠ worse               │
│                                                              │
│  CALIBRATION (win probability)                               │
│  0.5–0.6  pred .55  obs .53  n=48   ✓                        │
│  0.6–0.7  pred .64  obs .61  n=31   ✓                        │
│  0.7–0.8  pred .74  obs .66  n=19   ⚠ overconfident          │
└──────────────────────────────────────────────────────────────┘
```

**Design note:** this screen should be able to tell you the model is bad. If DST projections are worse than baseline, that must be visible — the temptation to hide unflattering diagnostics is exactly what makes people trust broken models.

---

## 13. `/admin/jobs`

```
┌──────────────────────────────────────────────────────────────┐
│  Job          Last run        Status    Next                 │
│  ingest-week  Tue 08:00 UTC   ✓ 4m12s   Tue Oct 22           │
│  project      Tue 09:02 UTC   ✓ 1m48s   Thu Oct 17 12:00     │
│  archive      Tue 10:00 UTC   ✓ 22s     Tue Oct 22           │
│  sync-league  Today 06:00     ✓ 8s      Tomorrow 06:00       │
│  espn-live    —               ⚠ paused  (in-season only)     │
│                                                              │
│  Neon usage   Storage 84 MB / 512 MB   Compute 38h / 190h    │
│                                                              │
│  [Run ingest-week]  [Run projections]  [Run archive]         │
└──────────────────────────────────────────────────────────────┘
```

**Design note:** the Neon usage line is deliberate. Compute-hours are the constraint most likely to surprise you, and seeing 38/190 in October tells you whether draft-day polling is affordable.

---

## Cross-cutting patterns

**Staleness.** Every screen with model output shows when it was generated. Sunday morning decisions made on Tuesday projections are a real failure mode.

**Sample size.** Any statistic derived from fewer than 10 observations shows its `n` or doesn't render.

**Distributions over points.** Wherever a projection appears, its range appears too. This is the app's core thesis.

**Explanations attached to recommendations.** Never a bare number where a decision is implied.

**Mobile.** `/lineup`, `/draft`, and `/live` must work on a phone. The others can assume desktop.

**Empty states.** Pre-season, mid-week with no games, no trades worth suggesting — each screen needs a sensible empty state. "No trades currently worth proposing" is a valid and useful answer.
