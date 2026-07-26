# Glossary

Terms used across these documents. Grouped by domain.

---

## Volume & usage metrics

**Snap share** — Fraction of team offensive snaps a player is on the field for. The most stable week-to-week usage metric (lag-1 autocorrelation ≈ 0.85). A player's snap share falling is usually the earliest signal of a role change.

**Routes run** — Number of pass plays on which a receiver ran a route. More informative than snaps for pass-catchers, since a WR who blocks on run plays gets snap credit without opportunity. Reliably available from 2019 onward.

**Route participation** — Routes run divided by team pass plays. The receiver equivalent of snap share.

**Target share** — Fraction of a team's targets going to a player. Fantasy's most-cited usage stat. Stable (≈0.71) but confounded by game script — a team trailing all game inflates everyone's raw target counts.

**TPRR (Targets Per Route Run)** — Targets divided by routes run. Superior to target share because it isolates *earned* opportunity from volume of team passing. A WR with 20% target share on 40 routes is being used differently than one with 20% on 25 routes.

**aDOT (average Depth of Target)** — Mean distance downfield of a player's targets. Separates possession receivers (aDOT ~7) from deep threats (aDOT ~15). High aDOT means higher variance.

**Air yards** — Sum of intended downfield yardage on all targets, counted whether or not the pass is caught. Measures opportunity independent of completion.

**Air yards share** — Fraction of team air yards directed at a player.

**WOPR (Weighted Opportunity Rating)** — `1.5 × target_share + 0.7 × air_yards_share`. A standard composite of volume and downfield usage. Above 0.7 indicates a genuine WR1 role.

**RACR (Receiver Air Conversion Ratio)** — Receiving yards divided by air yards. Efficiency measure. Unstable at low volume; treat with suspicion under ~30 targets.

**Red zone touches** — Carries plus targets inside the opponent's 20. Primary TD opportunity metric.

**Green zone touches** — Same, inside the 5. Better TD predictor than red zone, since goal-line work is more concentrated.

---

## Team context

**Pace** — Speed of offensive play, usually seconds per play. Faster pace means more plays and more fantasy opportunity for everyone.

**PROE (Pass Rate Over Expected)** — A team's actual pass rate minus the rate expected given down, distance, score, and time. Isolates coaching philosophy from game script. A team trailing all season passes more, but PROE tells you whether they'd pass more in neutral situations. Typically −0.10 to +0.10.

**Neutral game script** — Situations where score differential is small enough not to distort play-calling, conventionally within one score in the first three quarters.

**Implied team total** — Points a team is expected to score, from the Vegas line: `total/2 − spread/2` (home). The best single-number predictor of team-level fantasy production.

**Game script** — How a game's score progression shapes play-calling. Leading teams run; trailing teams pass. Predicting script from the spread is a large part of the context adjustment.

**Vacated opportunity** — Targets or carries freed by an injured or departed teammate, redistributed among remaining players. The highest-leverage in-season signal.

---

## Defense

**DvP (Defense versus Position)** — Fantasy points allowed to a specific position. The standard matchup metric. **Should always be pace-adjusted** — a fast-paced defense faces more plays and looks worse than it is.

**Pace-adjusted DvP** — DvP normalized per play rather than per game. Removes the pace confound. Use this for modeling; keep raw DvP for display since that's what other sites show.

**Shadow coverage** — When a defense's top corner follows a specific receiver rather than playing a side. Meaningfully suppresses that receiver. Not captured by position-level DvP.

---

## Projection & modeling

**EWMA (Exponentially Weighted Moving Average)** — Average weighting recent observations more heavily, controlled by decay factor λ. λ=0.85 gives a half-life of about 4.3 games.

**Regression to the mean** — Tendency of extreme observations to move toward average. Applied by blending a player's rate with a positional prior, weighted by sample size.

**Shrinkage** — The formal version: `(n × observed + k × prior) / (n + k)`, where k controls how much evidence is needed to trust the player over the prior.

**Replacement level** — Production available from a freely-available player at that position. The baseline VORP measures against.

**VORP (Value Over Replacement Player)** — Projected points minus replacement-level points. The correct way to compare across positions, since a QB scoring 300 points may be worth less than an RB scoring 200 if QBs are plentiful.

**Positional scarcity** — How quickly production drops off within a position. Steep dropoff (TE) means the top players carry more value; flat dropoff (QB) means waiting is cheap.

**Tier** — Group of players with similar projections, separated from the next group by a meaningful gap. More actionable than rank: the real question is "is this the last player in this tier?"

**ADP (Average Draft Position)** — Consensus average pick number. Deviation from ADP identifies value.

**Reach** — Drafting a player earlier than their ADP. Positive `reach_delta` in this system.

---

## Distributions & simulation

**Point estimate** — A single predicted number. Insufficient for start/sit, since two players with identical means can have entirely different risk profiles.

**Percentile (p20, p80)** — Values below which that fraction of outcomes fall. p20 is a realistic floor; p80 a realistic ceiling.

**Floor / ceiling** — Informal terms for low and high percentile outcomes. Floor matters when you're favored; ceiling when you're an underdog.

**Boom/bust** — High-variance player. Low p20, high p80. Correct play when you need a large score.

**Gamma distribution** — Right-skewed, non-negative distribution used here to model fantasy outcomes. Shape parameter k controls skew; lower k means a fatter right tail.

**Zero-inflation** — Modeling the probability of scoring nothing (inactive, injured early) separately from the distribution of positive outcomes.

**Monte Carlo simulation** — Repeatedly sampling from outcome distributions to estimate probabilities that are hard to compute analytically. Here: sampling every player's score 10,000 times to get win probability.

**Correlation (in lineups)** — Players whose outcomes move together. QB and his WR1 are positively correlated (same passing game); two RBs on one team negatively (splitting carries). Ignoring correlation understates variance by 10–15%.

**Copula** — Method for imposing a dependence structure on variables while preserving their individual distributions. Used here to correlate player outcomes within a game.

**Calibration** — Whether stated probabilities match observed frequencies. If you say 70% and it happens 55% of the time, you're overconfident and the model is misleading you.

**Walk-forward backtesting** — Testing by training only on data available before each prediction point, mimicking real conditions. The alternative — random train/test splits — leaks future information and produces impressive, meaningless results.

**Leakage** — Accidentally training on information unavailable at prediction time. The most common cause of models that look excellent in testing and fail in production.

**MAE (Mean Absolute Error)** — Average absolute difference between projected and actual. Primary accuracy metric here; less sensitive to outliers than RMSE, which matters because fantasy has genuine extreme outcomes.

**Change-point detection** — Statistical identification of when a time series shifts regime. Used to distinguish a real role change from week-to-week noise.

---

## Fantasy league mechanics

**PPR (Points Per Reception)** — Scoring where each catch is worth a point. **Half-PPR** (0.5) and **standard** (0) are the other common formats. This single setting substantially reorders RB and WR rankings.

**FLEX** — Roster slot accepting multiple positions, usually RB/WR/TE. Complicates replacement-level calculation since it draws from several position pools.

**FAAB (Free Agent Acquisition Budget)** — Blind-bid waiver system with a fixed seasonal budget.

**Handcuff** — Backup to a starting RB, valuable primarily if the starter is injured. Contingent rather than additive value.

**Streaming** — Rotating a roster spot weekly based on matchup, common for DST and K.

**Snake draft** — Draft order reverses each round. **Auction draft** — managers bid on players with a fixed budget.

**Keeper / dynasty** — Formats retaining players across seasons. Not addressed by this system.

---

## Technical

**Parquet** — Columnar file format. Efficient for analytical queries that read few columns from many rows.

**DuckDB** — Embedded columnar database that queries Parquet directly. No server process. Roughly 10–100× SQLite for analytical workloads.

**Hive partitioning** — Directory naming that encodes partition keys (`season=2024/week=07/`), letting query engines skip irrelevant directories entirely.

**Crosswalk** — Mapping table linking IDs for the same entity across systems. The Yahoo↔nflverse crosswalk is the highest-effort piece of the ingestion layer.

**GSIS ID** — The NFL's official player identifier, e.g. `00-0034796`. The canonical join key for nflverse data.

**Idempotent** — An operation producing the same result whether run once or many times. Required for scheduled jobs that may retry.

**Cold start** — Latency when a suspended service resumes. Neon's free tier autosuspends after 5 minutes idle, adding ~500ms to the next query.

**Compute-hours** — Neon's billing unit: time the database is actively running. The binding constraint on the free tier, more so than storage.
