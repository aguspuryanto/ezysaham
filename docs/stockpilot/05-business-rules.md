# StockPilot — Business Rules, Trading Formulas, AI Scoring Formulas

**This document transcribes formulas already implemented and working in `saham-screener`'s `src/domain/engine/*` and specified in `aistock.md` — it does not invent new generic weights.** Every number below was read directly from source at the time of writing. If the code changes, re-transcribe rather than trusting this doc from memory.

## 1. Screener Presets (ARA / BPJS / Momentum)

These are the named filter presets from the original PRD. They are **not yet implemented as named functions** in the current codebase (only their underlying indicators exist) — they are net-new filter logic for StockPilot's Screener page, using the exact thresholds from the source PRD:

**ARA Screener**
- Price > 100
- 1-day return > 10%
- Volume > 20,000 lots
- Volume MA5 > Volume MA20

**BPJS Screener**
- Price > MA5
- Close > Previous Close × 1.05
- Close > Open
- Volume > 20% of previous volume
- Transaction value > Rp 5 billion

**Momentum Screener**
- EMA20 > EMA50
- Close > EMA20
- MACD bullish
- RSI between 55-70
- RVOL (relative volume) > 2
- Transaction value > Rp 20 billion

## 2. Watchlist Engine — "After-Market AI" (Stage 1)

Source: `src/domain/engine/watchlistEngine.ts`. Its own docstring: *"Screens for stocks worth watching tomorrow, not stocks that are 'going to go up'. Never emits BUY/SELL."*

### Category weights (`CATEGORY_WEIGHTS`)

| Category | Weight |
|---|---|
| Momentum | 30% |
| Liquidity | 25% |
| Smart Money | 20% |
| Structure | 15% |
| Risk | 10% |

### Formula

```
compositeRaw = momentum*0.30 + liquidity*0.25 + smartMoney*0.20 + structure*0.15 + risk*0.10
finalScore   = clamp(round(compositeRaw - totalPenalty), 0, 100)
```

### Tier thresholds (`tierFromScore`)

| Score | Tier |
|---|---|
| ≥ 90 | ELITE |
| ≥ 80 | VERY_GOOD |
| ≥ 70 | WORTH_WATCHING |
| < 70 | NO_TRADE |

### Momentum category (30% weight) — `watchlistMomentum.ts`

Starts at base 50, then:
- Close within top 30% of daily range (`closeNearHigh > 0.7`): **+10**
- Breaks 20-day highest high: **+15**
- Full bullish EMA stack (EMA20 > EMA50 > EMA100): **+15**; if only EMA20 > EMA50 (EMA100 unavailable/not aligned): **+7**
- MACD bullish (MACD > signal): **+10**
- RSI zones: **>88 → −15** (profit-taking risk); **60-70 → +15** (optimal zone); **70-80 → +8**; **<50 → −8**

### Liquidity & Smart Money — `scores.ts`

- **Liquidity** = `turnoverScore*0.5 + absoluteValueScore*0.3 + relVolScore*0.2`, where `turnoverScore = clamp((avgTransactionValue/capitalization)/0.005 * 100, 0, 100)`, `absoluteValueScore = clamp(avgTransactionValue/20_000_000_000 * 100, 0, 100)`, `relVolScore = clamp(relativeVolume/1.5 * 100, 0, 100)`.
- **Smart Money** (proxy only — no real broker/foreign-flow feed): base 40, **+15** if close in top 30% of range, **+15** if Higher Low, **+15** if RVOL>1.3 and close ≥ prevClose, **+10** if avg transaction value > Rp 5B, **+5** if EMA9 > EMA20.

### Structure category (15% weight) — `watchlistStructure.ts` (referenced, not transcribed line-by-line here — see source for the exact Higher-Low / breakout / pattern detection logic feeding this score).

### Risk category (10% weight) — `watchlistRisk.ts`

Base 70; **+15** if ATR% between 1-5% of price (healthy volatility); **−20** if ATR% > 7% (extreme); **−20** if candle down + RVOL > 1.3 (active distribution).

### Penalty table (applied once to the final composite, separate from the 10%-weight Risk category so danger signals aren't diluted)

| Penalty | Points | Condition |
|---|---|---|
| Gap terlalu besar | −20 | Gap > 15% |
| Gap besar | −12 | Gap > 8% |
| Terlalu dekat resistance | −10 | Room to resistance 0-2% |
| Sinyal distribusi | −15 | Close < prevClose and RVOL > 1.3 |
| Long upper shadow | −10 | Upper shadow > 40% of range |
| Kenaikan >25% sehari | −15 | 1-day gain > 25% |
| 3 hari hijau + kenaikan besar | −10 | 3 consecutive green candles, cumulative gain > 15% |
| Volatilitas ekstrem | −10 | ATR% > 7% |

**Documented limitation (carry forward verbatim):** Liquidity and Smart Money are proxied from RVOL, turnover, and close-position only — there is no real broker-summary or foreign-flow feed in this codebase.

## 3. AI Engine — BUY/WATCHLIST/WAIT/AVOID Decision Engine

Source: `src/domain/engine/aiEngine.ts`, `scores.ts`, `rules.ts`, `probability.ts`. Cross-referenced against `aistock.md` lines 215-530 (AI SCORING / PROBABILITY ENGINE / RULE ENGINE / CONFIDENCE SCORE sections), which is the original spec this engine implements.

### The 7 base scores (`AiScores`)

| Score | Formula summary |
|---|---|
| `momentum` | Base 50; +15 EMA9>EMA20 else −15; +10 EMA20>EMA50 else −5; +10 MACD bullish else −10; RSI 50-70 → +15, RSI>70 → −5, RSI<30 → −10; +5 Higher High; +5 Higher Low; +10 if RVOL>1.5 |
| `trend` | `Strong Uptrend` (90) if EMA-bullish & ADX≥25; `Uptrend` (70) if EMA-bullish only; `Strong Downtrend` (10) / `Downtrend` (30) mirror; else `Sideways` (50) |
| `liquidity` | Same formula as Watchlist Engine's liquidity score (`scores.ts`, shared function) |
| `volatility` | ATR% of price: <0.5%→20, <1.5%→60, ≤4%→90 (ideal), ≤7%→55, else→20 (too volatile = risky, too low = hard to profit) |
| `smart_money` | Same formula as Watchlist Engine's smart-money score |
| `distribution` | Base 20; +25 if RVOL>1.3 and close<prevClose; +15 if upper shadow>40%; +20 if last 3 candles all red; +20 if Higher High but RSI falling and RSI>60 (bearish divergence) |
| `fundamental` | Base 50; PER<10→+20, PER 10-20→+10, PER 20-30→+0, PER>30 or ≤0→−15/−20; PBV 0-1→+15, PBV<2→+5, PBV>5→−15; ROE>20→+15, ROE>10→+5, ROE<0→−20 |

### Rule Engine (fires on top of base scores — `rules.ts`, 13 rules total)

Each rule adds score/probability deltas *scaled by an optional per-rule weight* (default 1.0, tunable — see Self-Learning note below). Representative examples:

- **`bullish_momentum_combo`**: Close>EMA20, EMA9>EMA20, RSI 55-70, RVOL>2, ATR rising, Higher High → momentum+15, trend+10, swing take_profit+12, scalp momentum_continuation+8.
- **`bearish_distribution_combo`**: upper shadow>40%, RVOL>2, close in bottom 30% of range → distribution+20, swing stop_loss+15, scalp false_breakout+25.
- **`macd_golden_cross`** / **`macd_death_cross`**: fresh MACD cross → momentum±12, trend±5.
- **`oversold_reversal`**: RSI<30 and Stochastic<20 → momentum+8.
- **`overbought_warning`**: RSI>75 → momentum−5, swing stop_loss+10.
- **`volume_dry_up`**: RVOL<0.5 → liquidity−15.
- Candlestick-pattern rules (`hammer_reversal`, `bullish_engulfing_signal`, `bearish_engulfing_signal`) key off `detectPatterns(bars)`.

### Recommendation formula

```
composite = momentum*0.35 + trend*0.25 + smart_money*0.20 + fundamental*0.10 + liquidity*0.10 − distribution*0.30

if distribution >= 70:            AVOID
else if composite >= 65 and confidence >= 65:  BUY
else if composite >= 50:          WATCHLIST
else if composite >= 35:          WAIT
else:                              AVOID
```

### Confidence Score

Counts bullish vs. bearish "votes" across 6 indicator checks (EMA9>EMA20, EMA20>EMA50, MACD>signal, RSI>50, Close>EMA20, Stochastic K>D) plus structure (Higher High/Low) plus every detected candlestick pattern's bullish/bearish flag:

```
confidence = clamp(40 + (max(bullish, bearish) / total) * 60, 30, 98)
```

More indicators agreeing (either direction) → higher confidence, matching `aistock.md`'s "Semakin banyak indikator searah, semakin tinggi confidence."

### Probability Model (swing & scalping)

```
take_profit%      = clamp(30 + (momentum-50)*0.6 + (trend-50)*0.4, 10, 90)
stop_loss%        = clamp(100 - take_profit + (distribution-50)*0.2, 5, 90)
expected_return%  = clamp(1 + ((momentum-50)/50) * atrPct * 1.5, 0.5, 12)
expected_drawdown%= clamp(atrPct * 0.8, 0.3, 8)

gap_up%                = clamp(50 + (momentum-50)*0.4 + gapPct*5, 5, 95)
opening_strength%      = clamp(50 + (momentum-50)*0.5 + (liquidity-50)*0.2, 5, 95)
momentum_continuation% = clamp(momentum, 5, 95)
false_breakout%        = clamp(100 - momentum*0.5 + distribution*0.5, 5, 95)
```

Rule-engine deltas (above) are added on top of these base probabilities, then re-clamped to [1, 99].

## 4. Trade Engine — "Execution AI" (Stage 3)

Source: `src/domain/engine/tradeEngine.ts`, `tradeDecision.ts`, `riskReward.ts`. Module docstring: *"Is this trade worth taking?" — not "will this stock go up?"* Probabilities here are explicitly rule-derived heuristics, capped by construction so the engine can never emit a "95% probability, −8% next day" combination.

### Layer weights (`LAYER_WEIGHTS`, `tradeDecision.ts`)

| Layer | Weight |
|---|---|
| Momentum | 20% |
| Risk | 20% |
| Liquidity | 15% |
| Smart Money | 15% |
| False Breakout | 15% |
| Risk:Reward | 15% |

`composite = round(momentum*0.20 + liquidity*0.15 + smartMoney*0.15 + risk*0.20 + falseBreakout*0.15 + riskReward*0.15)`

### Gates (all must pass, else decision = `NO_TRADE` regardless of composite)

1. Risk:Reward ≥ 1:1
2. Gap ≤ 20%
3. RSI ≤ 88
4. False-breakout score ≥ 30
5. Risk score ≥ 25
6. Not (gap > 15% AND opening strength < 40)

### Grade → Decision

| Composite | Grade | Decision rule |
|---|---|---|
| ≥80, RR≥2, risk≥65 | A+ | BUY if RR≥1.5, else WATCH |
| ≥68 | A | BUY if RR≥1.5 and risk≥55, else WATCH |
| ≥55 | B | WATCH |
| ≥42 | C | WATCH |
| else | D | NO_TRADE |

### Position sizing

Fixed-fractional: risk at most 1% of capital per trade, then scaled down by grade (`GRADE_POSITION_FACTOR`: A+=1.0, A=0.8, B=0.5, C=0.25, D=0).

### Risk:Reward levels

`stopLoss = max(support, entry − ATR×1.5)`; `takeProfit1 = entry + ATR×2`; `takeProfit2 = max(takeProfit1+ATR, min(resistance, entry+ATR×3.5))`. RR-ratio scored: <1→15 (very bad), <1.5→40, <2→65, ≥2→90 (good) — matches the PRD's own RR grading table.

## 5. Indicator Reference

Computed in `src/domain/indicators.ts`, matching `aistock.md`'s "INDIKATOR YANG HARUS DIHITUNG" list (lines 139-214): EMA 5/9/20/50/100, MA20/50, RSI14, MACD+signal, ATR14, Bollinger Bands, Stochastic (%K/%D), ADX14, Volume MA20, Relative Volume (RVOL), average transaction value, average daily range, support/resistance, highest-high-20/lowest-low-20, Higher High/Higher Low flags, gap%, body%/upper-shadow%/lower-shadow%, and candlestick patterns (Bullish/Bearish Engulfing, Morning Star, Hammer, Shooting Star, Doji, Inside/Outside Bar) via `src/domain/patterns/candlestick.ts`.

## 6. Explicitly retired — do not port

**`src/utils/scoringEngine.ts`** — a second, materially different weighting scheme computed from *summary return percentages only* (no real OHLCV bars), currently driving the main Screener UI:

- Swing Trade Score: Momentum 30%, Breakout 25%, Volume Spike 25%, Fundamental 20%.
- Scalping Score: Volatility 35%, Momentum 35%, Volume Spike 30%.

This disagreed with the Watchlist/AI engines above on real tickers (confirmed during exploration) and is retired, not merged or reconciled — StockPilot shows one scoring system only.

## 7. Backtest Engine & Self-Learning (v2/roadmap — not v1)

Per `aistock.md` lines 531-604: backtest a rule set over N years, report Win Rate / Average Return / Max Drawdown / Profit Factor / Expectancy / sample size. Self-Learning concept: indicator weights adjust automatically based on which have historically improved win rate — **not implemented today, no labeled historical outcome data exists yet.** Tracked as a v2+ backlog item, informed by `docs/momentum-score-backtest-report.md`'s existing "Momentum Score v2.0" recommendation (see [07-roadmap.md](07-roadmap.md)).

## 8. Sample Output JSON (canonical shape, from `aistock.md` lines 605-651)

```json
{
  "stock": "BBCA",
  "strategy": "Swing Trade",
  "recommendation": "BUY",
  "confidence": 91,
  "swing_probability": { "take_profit": 78, "stop_loss": 22, "expected_return": 4.8, "expected_drawdown": 1.7 },
  "scalping_probability": { "gap_up": 71, "opening_strength": 81, "momentum_continuation": 76, "false_breakout": 24 },
  "scores": { "liquidity": 88, "momentum": 92, "trend": 90, "volatility": 74, "smart_money": 81, "distribution": 18, "fundamental": 85 },
  "entry": 9450, "stop_loss": 9250, "take_profit": [9700, 9900], "risk_reward": "1:2.4",
  "explanation": ["EMA9 berada di atas EMA20", "MACD Golden Cross", "Volume 2.5x rata-rata 20 hari", "RSI 61", "Breakout resistance", "Tidak ada sinyal distribusi"]
}
```
