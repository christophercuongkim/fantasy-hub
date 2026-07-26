# Model Specification

The projection math, written out to be implementable without re-deriving. Expands §7 of the implementation plan.

**Design principle:** every layer must beat the one below it on held-out data, or it doesn't ship. Complexity is earned, not assumed.

---

## 0. Notation

| Symbol | Meaning |
|---|---|
| $i$ | player index |
| $w$ | week |
| $t$ | team |
| $Y_{iw}$ | fantasy points scored by player $i$ in week $w$ |
| $\hat{Y}_{iw}$ | projected points |
| $V_{iw}$ | volume (targets, carries, attempts) |
| $E_{iw}$ | efficiency (points per opportunity) |
| $\lambda$ | exponential decay factor |
| $\mathcal{D}_{iw}$ | outcome distribution |

**Core decomposition:**

$$\hat{Y}_{iw} = \hat{V}_{iw} \times \hat{E}_{iw} \times \prod_k A_k$$

Volume × efficiency × context adjustments. Volume is predictable; efficiency is noisy and regresses hard; adjustments are multiplicative and centered on 1.0.

---

## 1. Layer 0 — Baseline

The benchmark everything else must beat.

$$\hat{Y}^{(0)}_{iw} = \frac{\sum_{j=1}^{n} \lambda^{j} \, Y_{i,w-j}}{\sum_{j=1}^{n} \lambda^{j}}$$

**Parameters:**

| Parameter | Value | Rationale |
|---|---|---|
| $\lambda$ | 0.85 | Half-life ≈ 4.3 games. Tune on held-out data; 0.80–0.90 is the plausible range. |
| $n$ | 8 | Games of lookback |
| min games | 3 | Below this, fall back to the prior |

**Cross-season handling:** apply an extra discount $\gamma = 0.7$ to games from the prior season. Offseason changes — scheme, personnel, role — make last year's weeks meaningfully less informative than recent ones.

**Priors for insufficient history:**

| Case | Prior |
|---|---|
| Rookie, drafted | Positional mean by draft-capital bucket (R1, R2–3, R4–7, UDFA) |
| Rookie, undrafted | Positional replacement level |
| Veteran, <3 games this season | Blend prior-season mean with positional mean, weighted by games played |
| Returning from injury | Pre-injury baseline × 0.85 for the first two weeks |

**Bye weeks and inactives are excluded from the average**, not counted as zeros. A player who missed three weeks should not have a depressed baseline; the missed time is handled by `is_playing` and `p_zero`.

---

## 2. Layer 1 — Volume model

Fantasy production is mostly volume. Model it directly.

### 2.1 Why volume, not points

Week-to-week autocorrelation, typical values:

| Metric | $r$ (lag-1) | Stability |
|---|---|---|
| Snap share | 0.85 | Very high |
| Route participation | 0.82 | Very high |
| Target share | 0.71 | High |
| Carries | 0.68 | High |
| TPRR | 0.55 | Moderate |
| Yards per target | 0.18 | Low |
| TD rate | 0.09 | Essentially noise |

**Implication:** predicting snaps and targets is tractable; predicting touchdowns is not. Model the stable parts, regress the unstable ones to positional means.

### 2.2 Position-specific volume

**WR / TE:**

$$\hat{V}^{\text{tgt}}_{iw} = \widehat{\text{routes}}_{iw} \times \widehat{\text{TPRR}}_{iw}$$

where

$$\widehat{\text{routes}}_{iw} = \widehat{\text{plays}}_{tw} \times \widehat{\text{pass rate}}_{tw} \times \widehat{\text{route participation}}_{iw}$$

Route participation is the EWMA of `routes_run / team_pass_plays`, $\lambda = 0.85$.

TPRR is regressed toward the positional mean:

$$\widehat{\text{TPRR}}_{iw} = \frac{n_i \cdot \overline{\text{TPRR}}_i + k \cdot \mu_{\text{pos}}}{n_i + k}$$

with $k = 40$ routes. Below ~40 routes of history, trust the positional mean more than the player.

**RB:**

$$\hat{V}^{\text{car}}_{iw} = \widehat{\text{plays}}_{tw} \times (1 - \widehat{\text{pass rate}}_{tw}) \times \widehat{\text{carry share}}_{iw} \times S_{iw}$$

$S_{iw}$ is the game-script multiplier (§3.3). Receiving work uses the WR formula with RB-specific priors.

**QB:**

$$\hat{V}^{\text{att}}_{iw} = \widehat{\text{plays}}_{tw} \times \widehat{\text{pass rate}}_{tw}$$

Rushing attempts are modeled separately — designed QB runs are a stable player trait, scrambles are not.

### 2.3 Team play volume

$$\widehat{\text{plays}}_{tw} = \alpha \cdot \overline{\text{plays}}_{t,L4} + (1-\alpha) \cdot \mu_{\text{league}} + \beta_{\text{pace}} \cdot \text{opp pace}_{ow}$$

with $\alpha = 0.6$. Pace is partly a property of the matchup, not just the offense.

### 2.4 Pass rate

$$\widehat{\text{pass rate}}_{tw} = \overline{\text{PROE}}_{t,L6} + f(\text{spread}_{w}, \text{total}_{w})$$

The expected-pass-rate baseline comes from down/distance/score-state league averages; PROE is the team's persistent deviation from it. $f$ maps the Vegas line to expected game script — trailing teams pass more.

Empirically: each point of spread shifts pass rate by roughly **0.6 percentage points** for the underdog.

---

## 3. Layer 2 — Context adjustments

All adjustments are multiplicative and centered on 1.0.

$$\hat{Y}^{(2)}_{iw} = \hat{Y}^{(1)}_{iw} \times A^{\text{opp}} \times A^{\text{pace}} \times A^{\text{script}} \times A^{\text{vac}} \times A^{\text{inj}} \times A^{\text{wx}}$$

### 3.1 Opponent adjustment

$$A^{\text{opp}}_{iw} = 1 + \theta_{\text{pos}} \cdot z(\text{DvP}^{\text{adj}}_{o,\text{pos}})$$

where $\text{DvP}^{\text{adj}}$ is **pace-adjusted** points allowed to the position, and $z(\cdot)$ is the league-wide z-score.

**Critical:** use pace-adjusted DvP. Raw points-allowed is confounded — a fast-paced defense faces more plays and looks worse than it is.

| Position | $\theta$ | Practical range |
|---|---|---|
| QB | 0.06 | ±12% |
| RB | 0.05 | ±10% |
| WR | 0.07 | ±14% |
| TE | 0.09 | ±18% |
| K | 0.04 | ±8% |
| DST | 0.15 | ±30% |

**TE and DST have the widest spreads.** TE production concentrates against defenses with weak linebacker coverage; DST scoring depends enormously on opponent turnover propensity.

**Shrink early in the season.** With $m$ games of opponent data:

$$\theta^{\text{eff}} = \theta \cdot \frac{m}{m + 4}$$

Week 2 DvP is nearly meaningless; by week 8 it's mostly stabilized.

### 3.2 Pace adjustment

$$A^{\text{pace}}_{iw} = \frac{\widehat{\text{plays}}_{tw}}{\overline{\text{plays}}_{t,\text{season}}}$$

Already partly captured in the volume model; apply here only for the opponent's pace contribution to avoid double-counting.

### 3.3 Game script

From the Vegas line, implied team total:

$$T^{\text{implied}}_{tw} = \frac{\text{total}_w}{2} - \frac{\text{spread}_w}{2}$$

(Home perspective, negative spread = home favored. **Verify this sign against your data before trusting any output.**)

| Position | Script effect |
|---|---|
| RB rushing | $1 + 0.025 \times (-\text{spread})$ — favorites run more |
| RB receiving | $1 - 0.015 \times (-\text{spread})$ — underdogs' backs catch more |
| WR/TE | $1 + 0.012 \times \text{spread}$ — trailing teams pass |
| QB pass | $1 + 0.010 \times \text{spread}$ |
| QB rush | Roughly neutral |
| DST | $1 + 0.030 \times (-\text{spread})$ — favorites get more sacks and turnovers |

Also scale by implied total relative to league average ($\approx 22$ points):

$$A^{\text{total}} = \left(\frac{T^{\text{implied}}}{22}\right)^{0.5}$$

The square root damps the effect — a 28-point implied total doesn't mean 27% more fantasy points.

### 3.4 Vacated opportunity

**The highest-leverage signal in the model.** When a teammate is out, their share redistributes non-uniformly.

For player $i$ when teammate $j$ is out:

$$\Delta \text{share}_i = \text{share}_j \times \rho_{ij}$$

Redistribution weights $\rho$, by position and depth:

| Out | To | $\rho$ |
|---|---|---|
| WR1 | WR2 | 0.35 |
| WR1 | WR3 | 0.30 |
| WR1 | TE1 | 0.20 |
| WR1 | RB (receiving) | 0.15 |
| RB1 | RB2 | 0.65 |
| RB1 | RB3 | 0.25 |
| TE1 | TE2 | 0.40 |
| TE1 | WRs | 0.60 (split by existing share) |

These are league-average starting points. **Team-specific redistribution is better where you have data** — some offenses funnel to a single replacement, others spread it.

**Cap the adjustment.** No player's projected target share should exceed 0.40; beyond that the redistribution model breaks down and you're extrapolating past anything observed.

### 3.5 Injury discount

Applied to the player's own status, distinct from `p_zero`:

| Status | $A^{\text{inj}}$ | $p_{\text{zero}}$ contribution |
|---|---|---|
| Healthy | 1.00 | 0.02 |
| Questionable | 0.94 | 0.25 |
| Doubtful | 0.80 | 0.75 |
| Out / IR / bye | — | 1.00 (`is_playing = false`) |
| Returning from multi-week absence | 0.88 (2 weeks) | 0.10 |

$A^{\text{inj}}$ reflects **reduced effectiveness when active**; $p_{\text{zero}}$ reflects **probability of not playing**. These are different things and both matter.

### 3.6 Weather

Only material outdoors:

| Condition | Effect |
|---|---|
| Wind > 15 mph | Pass game ×0.92, K ×0.85 |
| Wind > 20 mph | Pass game ×0.85, K ×0.70 |
| Precipitation | Pass ×0.95, rush ×1.03 |
| Temp < 20°F | All ×0.96 |
| Dome / closed roof | 1.00 |

**Wind is the only weather variable with a large, reliable effect.** Temperature and precipitation effects are small and often overstated.

---

## 4. Layer 3 — Distributions

Point estimates are close to useless for start/sit. Produce a full distribution.

### 4.1 Distributional form

Fantasy scoring is right-skewed and non-negative. Use a **gamma** fit to standardized residuals, parameterized by position and projected-volume tier.

$$Y_{iw} \sim \text{Gamma}(k_{\text{pos},v}, \; \hat{Y}_{iw} / k_{\text{pos},v})$$

The shape parameter $k$ controls skew — lower $k$ means fatter right tail.

Typical fitted values:

| Position | Volume tier | $k$ | Interpretation |
|---|---|---|---|
| QB | all | 6.5 | Fairly symmetric |
| RB | high (>15 touches) | 4.0 | Moderate skew |
| RB | low (<10 touches) | 2.2 | High variance |
| WR | high (>7 targets) | 3.2 | Skewed |
| WR | low (<5 targets) | 1.8 | **Very fat-tailed** |
| TE | high | 2.8 | |
| TE | low | 1.6 | Boom/bust |
| K | all | 3.5 | |
| DST | all | 2.0 | Extremely volatile |

**This is why mean-based advice fails.** A low-volume WR and a high-volume RB with identical 11.0 means are entirely different plays: the WR's p90 might be 28 against the RB's 19.

### 4.2 Zero-inflation

$$P(Y=0) = p_{\text{zero}}$$

Mix the gamma with a point mass at zero:

$$\mathcal{D}_{iw} = p_{\text{zero}} \cdot \delta_0 + (1 - p_{\text{zero}}) \cdot \text{Gamma}(k, \theta)$$

Rescale the gamma so the mixture mean equals $\hat{Y}_{iw}$:

$$\theta = \frac{\hat{Y}_{iw}}{k \,(1 - p_{\text{zero}})}$$

### 4.3 Percentile extraction

Compute p10/p20/p50/p80/p90 from the mixture CDF analytically where possible, or by sampling 10k draws when the mixture makes closed form awkward.

**Store `mean` and `p50` separately.** They differ by 5–15% for skewed distributions, and conflating them is a common source of confusing UI.

---

## 5. Layer 4 — Monte Carlo matchup simulation

### 5.1 Basic loop

```
for iteration in 1..N:
    my_total  = Σ sample(D_i) for i in my_lineup
    opp_total = Σ sample(D_j) for j in opp_lineup
    wins += (my_total > opp_total)
win_probability = wins / N
```

$N = 10{,}000$ gives a standard error of about 0.005 on the win probability — plenty. $N = 100{,}000$ buys precision you can't act on.

### 5.2 Correlation — do not skip this

Independent sampling **understates variance by 10–15%** and systematically misprices stacks.

Add a shared game-level factor. For each game $g$ in the slate, draw $Z_g \sim \mathcal{N}(0,1)$ once per iteration, then:

$$Y_i = F^{-1}_i\big(\Phi(\rho_i Z_{g(i)} + \sqrt{1-\rho_i^2} \, \varepsilon_i)\big)$$

with $\varepsilon_i \sim \mathcal{N}(0,1)$ independent. This is a Gaussian copula with a single common factor per game.

Loadings $\rho$:

| Relationship | $\rho$ |
|---|---|
| QB ↔ his WR1 | +0.55 |
| QB ↔ his WR2/3 | +0.40 |
| QB ↔ his TE | +0.35 |
| QB ↔ his RB (receiving) | +0.20 |
| WR ↔ same-team WR | −0.10 |
| RB ↔ same-team RB | −0.35 |
| Player ↔ opposing DST | −0.45 |
| Any ↔ opposing skill player | +0.15 (shootout effect) |

**Same-team RBs are negatively correlated** (they split a fixed pie), while **QB and receivers are positively correlated** (they share a passing game). Both matter for lineup construction.

### 5.3 Yet-to-play adjustment (live)

Mid-game, condition on realized points:

$$\mathcal{D}^{\text{remaining}}_i = \mathcal{D}_i \times \frac{\text{snaps remaining}}{\text{total snaps}}$$

Crude but adequate. Players who have finished contribute a point mass at their actual score.

---

## 6. Season-long projections

For draft, trades, and playoff odds.

$$\hat{Y}^{\text{ROS}}_i = \sum_{w=w_0}^{18} \hat{Y}_{iw} \cdot P(\text{active}_{iw})$$

$P(\text{active})$ accounts for injury risk over time:

$$P(\text{active}_{iw}) = (1 - h_{\text{pos}})^{w - w_0}$$

Weekly hazard rates $h$:

| Position | $h$ | Season survival |
|---|---|---|
| QB | 0.012 | ~80% |
| RB | 0.028 | ~61% |
| WR | 0.019 | ~71% |
| TE | 0.022 | ~68% |
| K | 0.005 | ~92% |

**RBs get injured most.** This is a real and often-underweighted argument against early-round RB investment.

Add an age modifier: $h \times (1 + 0.04 \times \max(0, \text{age} - 27))$.

---

## 7. VORP and auction values

### 7.1 Replacement level

For a league with $T$ teams and $s_p$ starting slots at position $p$ (including FLEX share):

$$R_p = T \times s_p^{\text{eff}}$$

where $s_p^{\text{eff}}$ includes the FLEX allocation, empirically about 60% RB / 35% WR / 5% TE.

12-team, 1QB/2RB/2WR/1TE/1FLEX:

| Position | $s_p^{\text{eff}}$ | $R_p$ | Replacement player |
|---|---|---|---|
| QB | 1.0 | 12 | QB12 |
| RB | 2.6 | 31 | RB31 |
| WR | 2.35 | 28 | WR28 |
| TE | 1.05 | 13 | TE13 |

$$\text{VORP}_i = \hat{Y}^{\text{ROS}}_i - \hat{Y}^{\text{ROS}}_{R_{p(i)}}$$

### 7.2 Auction values

$$\$_i = \frac{\max(\text{VORP}_i, 0)}{\sum_j \max(\text{VORP}_j, 0)} \times (B \times T - T \times n_{\text{roster}})$$

The subtracted term reserves $1 per roster spot. Only players above replacement get positive value.

### 7.3 Tiers

Cluster within position by projected points, breaking where the gap exceeds a threshold:

$$\text{break if } \hat{Y}_{(j)} - \hat{Y}_{(j+1)} > \max(1.5, \; 0.4 \times \sigma_{\text{pos}})$$

Tiers matter more than ranks. The actionable question during a draft is "is this the last player in this tier?" — not "is this player ranked 23rd or 26th?"

---

## 8. Backtesting protocol

**Non-negotiable before trusting any of this.**

### 8.1 Method

Walk-forward, never random splits:

```
for season in [2022, 2023, 2024]:
    for week in 4..17:
        train on all data strictly before (season, week)
        predict week
        record errors
```

**Never train on future data.** A model that has seen week 8 when predicting week 7 will look excellent and perform terribly.

### 8.2 Metrics

| Metric | Target |
|---|---|
| MAE vs. Layer 0 baseline | 8%+ improvement |
| MAE vs. FantasyPros consensus | Match or beat |
| Calibration (80% interval coverage) | 78–82% |
| Start/sit accuracy vs. mean-based | +2%+ correct decisions |
| Win-probability calibration | Predicted 60% → observed 57–63% |

### 8.3 Per-layer gate

Each layer ships only if it improves held-out MAE:

| Layer | Expected improvement over previous |
|---|---|
| 0 → 1 (volume) | 6–10% |
| 1 → 2 (context) | 3–6% |
| 2 → 3 (distributions) | 0% MAE — improves *decisions*, not point accuracy |
| 3 → 4 (simulation) | 0% MAE — improves *decisions* |

**Layers 3 and 4 don't improve projection accuracy at all.** They improve decision quality, which is a different thing and is the actual point of the app. Measure them by start/sit accuracy and win-probability calibration, not MAE.

### 8.4 Calibration check

Bucket predictions by decile and compare predicted to observed:

```
predicted 0.5-0.6 → observed should be 0.5-0.6
```

Systematic overconfidence (predicting 70% when observing 60%) usually means your variance is too low — most often from ignoring correlation.

---

## 9. Model versioning

Every projection stores `model_version`. Never overwrite; insert new rows.

Format: `v{major}.{minor}-{descriptor}`, e.g. `v2.1-volume`.

- **Major:** structural change (new layer, changed decomposition)
- **Minor:** parameter retune
- **Descriptor:** the dominant mechanism

Keep at least two versions live in-season so you can compare mid-season without losing history. Archive to Parquet weekly and retain the archive across seasons — year-over-year comparison is how you learn whether changes actually helped.

---

## 10. Known limitations

Worth writing down so you don't rediscover them at week 9.

1. **Touchdown regression is unmodeled.** TD rate is near-noise week to week. Players regress toward expected TDs based on red-zone volume, and the model doesn't capture this beyond volume effects.
2. **Coaching changes are invisible.** A new OC can change pass rate 8+ points overnight; the model needs 4–6 weeks to catch up.
3. **Rookie projections are weak.** Draft capital is a blunt prior. Expect large errors through week 6.
4. **Redistribution weights are league-average.** Team-specific behavior varies substantially.
5. **No opponent-adjusted efficiency.** DvP captures matchup at the position level, not scheme-specific effects like a shadow corner.
6. **Vegas lines move.** Projections generated Tuesday use Tuesday's line. Re-run Sunday morning for meaningful shifts.
7. **DST projections are barely better than random.** $R^2$ around 0.05. Stream on schedule and accept the noise.
