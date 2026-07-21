import { OHLCVBar } from '@/domain/models/History';
import { StockSummary } from '@/domain/models/Stock';
import { ema, lastValid, sma } from '@/domain/indicators/movingAverages';
import { macd } from '@/domain/indicators/macd';
import { rsi } from '@/domain/indicators/rsi';
import { relativeVolume, volumeMA } from '@/domain/indicators/volume';

/** IDX board lot size: 1 lot = 100 shares. */
export const LOT_SIZE = 100;

export type ScreenerPresetId = 'ara' | 'bpjs' | 'momentum' | 'breakout';

// ── Breakout Hunter scoring (8 dimensions) ─────────────────────────────────────
export interface BreakoutScores {
  /** 🌀 0-100 — volatility/range contraction ("coiled spring" before an explosive move) */
  compression: number;
  /** 🔥 0-100 — EMA structure, MACD, RSI sweet-spot */
  momentum: number;
  /** 💰 0-100 — Nilai transaksi tier */
  likuiditas: number;
  /** 🏦 0-100 — Volume surge, candle quality, closing position */
  smartMoney: number;
  /** 📊 0-100 — multi-day volume ramp (acceleration), distinct from single-day RVOL burst */
  volumeExpansion: number;
  /** 🎯 0-100 — close position within the recent trading range */
  breakoutPosition: number;
  /** 📐 0-100 — magnitude of historical daily swings (ARA/ARB-prone stocks score higher) */
  historicalVolatility: number;
  /** 🧭 0-100 — proxy for beta: ATR(14) now vs. ~2 months ago. No IHSG series is available in this
   *  codebase, so true market-beta can't be computed — this approximates "is this stock's volatility
   *  regime structurally expanding" instead. */
  historicalBeta: number;
  /** ⚠️ 0-100 — lower is safer — overbought signals, distribution flags (safety gate, not weighted into composite) */
  distributionRisk: number;
  /** 📈 0-100 — synthetic probability of >10% gain in 1-3 days */
  probUp: number;
  /** 📉 0-100 — synthetic probability of >3% loss */
  probDown: number;
  /** 🌅 0-100 — pre-open positioning quality (safety gate, not weighted into composite) */
  openingConfirmation: number;
  /** Weighted composite of all dimensions */
  composite: number;
  /** BUY_WATCH = high-quality setup | WATCH = borderline | SKIP = too risky/weak */
  status: 'BUY_WATCH' | 'WATCH' | 'SKIP';
}

export interface PresetEvaluation {
  passed: boolean;
  reasons: string[];
  failed: string[];
  /** Only present for the Breakout Hunter preset */
  breakoutScores?: BreakoutScores;
}

export interface ScreenerPreset {
  id: ScreenerPresetId;
  label: string;
  description: string;
  /** Static display copy of the criteria below, for UI panels that explain the active filter. */
  criteria: string[];
  /** Cheap, summary-only check used to shortlist candidates before fetching OHLCV history. */
  coarseFilter: (s: StockSummary) => boolean;
  /** Full check once OHLCV bars are available for a shortlisted candidate. */
  evaluate: (s: StockSummary, bars: OHLCVBar[]) => PresetEvaluation;
}

function verdict(checks: Array<[boolean, string]>): PresetEvaluation {
  const reasons: string[] = [];
  const failed: string[] = [];
  for (const [ok, label] of checks) {
    (ok ? reasons : failed).push(label);
  }
  return { passed: failed.length === 0, reasons, failed };
}

// ── Existing presets ──────────────────────────────────────────────────────────

const araPreset: ScreenerPreset = {
  id: 'ara',
  label: 'ARA',
  description: 'Saham yang sedang menuju/mendekati auto rejection atas, didukung volume yang menguat.',
  criteria: ['Harga > 100', 'Return 1 hari > 10%', 'Volume > 20.000 lot', 'Volume MA5 > Volume MA20'],
  coarseFilter: (s) =>
    s.lastClose > 100 && s.percentChange1D > 10 && s.volume > 20_000 * LOT_SIZE,
  evaluate: (s, bars) => {
    const volumes = bars.map((b) => b.volume);
    const volMa5 = lastValid(sma(volumes, 5));
    const volMa20 = lastValid(sma(volumes, 20));
    return verdict([
      [s.lastClose > 100, 'Harga > 100'],
      [s.percentChange1D > 10, 'Return 1 hari > 10%'],
      [s.volume > 20_000 * LOT_SIZE, 'Volume > 20.000 lot'],
      [!Number.isNaN(volMa5) && !Number.isNaN(volMa20) && volMa5 > volMa20, 'Volume MA5 > Volume MA20'],
    ]);
  },
};

const bpjsPreset: ScreenerPreset = {
  id: 'bpjs',
  label: 'BPJS',
  description: 'Breakout dengan konfirmasi harga dan volume di atas rata-rata — mengejar momentum harian.',
  criteria: [
    'Harga > MA5',
    'Close > Prev Close x 1.05',
    'Close > Open',
    'Volume > 120% volume hari sebelumnya',
    'Nilai transaksi > Rp 5 miliar',
  ],
  coarseFilter: (s) => s.value > 5_000_000_000 && s.percentChange1D > 5,
  evaluate: (s, bars) => {
    const lastBar = bars[bars.length - 1];
    const prevBar = bars[bars.length - 2];
    const ma5 = lastValid(sma(bars.map((b) => b.close), 5));
    return verdict([
      [!Number.isNaN(ma5) && s.lastClose > ma5, 'Harga > MA5'],
      [s.lastClose > s.prevClose * 1.05, 'Close > Prev Close x 1.05'],
      [!!lastBar && s.lastClose > lastBar.open, 'Close > Open'],
      [!!prevBar && s.volume > prevBar.volume * 1.2, 'Volume > 120% volume hari sebelumnya'],
      [s.value > 5_000_000_000, 'Nilai transaksi > Rp 5 miliar'],
    ]);
  },
};

const momentumPreset: ScreenerPreset = {
  id: 'momentum',
  label: 'Momentum',
  description: 'Trend naik yang sudah terkonfirmasi EMA, MACD, RSI, dan lonjakan volume relatif.',
  criteria: [
    'EMA20 > EMA50',
    'Close > EMA20',
    'MACD bullish',
    'RSI antara 55-70',
    'RVOL > 2',
    'Nilai transaksi > Rp 20 miliar',
  ],
  coarseFilter: (s) => s.value > 20_000_000_000,
  evaluate: (s, bars) => {
    const closes = bars.map((b) => b.close);
    const ema20 = lastValid(ema(closes, 20));
    const ema50 = lastValid(ema(closes, 50));
    const { macdLine, signalLine } = macd(bars);
    const macdLast = lastValid(macdLine);
    const signalLast = lastValid(signalLine);
    const rsiLast = lastValid(rsi(bars, 14));
    const rvol = relativeVolume(bars, 20);

    return verdict([
      [!Number.isNaN(ema20) && !Number.isNaN(ema50) && ema20 > ema50, 'EMA20 > EMA50'],
      [!Number.isNaN(ema20) && s.lastClose > ema20, 'Close > EMA20'],
      [!Number.isNaN(macdLast) && !Number.isNaN(signalLast) && macdLast > signalLast, 'MACD bullish'],
      [!Number.isNaN(rsiLast) && rsiLast >= 55 && rsiLast <= 70, 'RSI antara 55-70'],
      [!Number.isNaN(rvol) && rvol > 2, 'RVOL > 2'],
      [s.value > 20_000_000_000, 'Nilai transaksi > Rp 20 miliar'],
    ]);
  },
};

// ── Breakout Hunter ───────────────────────────────────────────────────────────

function clamp(v: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, v));
}

function calcMomentumScore(s: StockSummary, bars: OHLCVBar[]): number {
  const closes = bars.map((b) => b.close);
  const ema20 = lastValid(ema(closes, 20));
  const ema50 = lastValid(ema(closes, 50));
  const { macdLine, signalLine, histogram } = macd(bars);
  const macdLast = lastValid(macdLine);
  const signalLast = lastValid(signalLine);
  const histLast = lastValid(histogram);
  const prevHist = histogram[histogram.length - 2] ?? NaN;
  const rsiLast = lastValid(rsi(bars, 14));

  let score = 0;

  // EMA structure (30 pts)
  if (!Number.isNaN(ema20) && !Number.isNaN(ema50) && ema20 > ema50) score += 18;
  if (!Number.isNaN(ema20) && s.lastClose > ema20) score += 12;

  // MACD (40 pts): bullish position + crossover bonus
  if (!Number.isNaN(macdLast) && !Number.isNaN(signalLast) && macdLast > signalLast) score += 25;
  if (!Number.isNaN(histLast) && !Number.isNaN(prevHist) && histLast > 0 && prevHist <= 0) score += 15; // fresh crossover

  // RSI sweet-spot (30 pts)
  if (!Number.isNaN(rsiLast)) {
    if (rsiLast >= 55 && rsiLast <= 70) score += 30;
    else if (rsiLast >= 50 && rsiLast < 55) score += 18;
    else if (rsiLast > 70 && rsiLast <= 75) score += 10;
  }

  return clamp(score);
}

/** True range at index i (needs bars[i - 1] for the prior close). */
function trueRangeAt(bars: OHLCVBar[], i: number): number {
  const prevClose = bars[i - 1].close;
  return Math.max(
    bars[i].high - bars[i].low,
    Math.abs(bars[i].high - prevClose),
    Math.abs(bars[i].low - prevClose)
  );
}

function avgTrueRange(bars: OHLCVBar[], from: number, count: number): number {
  let sum = 0;
  for (let i = from; i < from + count; i++) sum += trueRangeAt(bars, i);
  return sum / count;
}

/** 🌀 Compression: volatility/range contraction — a "coiled spring" setup. Rewards a
 *  tight recent range even when the trend (EMA) is still bearish, since this is exactly
 *  the pattern that precedes explosive ARA-style moves on the IDX. */
function calcCompressionScore(bars: OHLCVBar[]): number {
  if (bars.length < 25) return 50;
  const n = bars.length;
  const atrShort = avgTrueRange(bars, n - 5, 5);
  const atrLong = avgTrueRange(bars, n - 20, 20);
  if (atrLong <= 0) return 50;
  const ratio = atrShort / atrLong;

  let score: number;
  if (ratio <= 0.5) score = 100;
  else if (ratio <= 0.7) score = 85;
  else if (ratio <= 0.9) score = 65;
  else if (ratio <= 1.1) score = 40;
  else score = 15;

  // Bonus: last close still inside a tight 10-day range (hasn't expanded yet)
  const last10 = bars.slice(-10);
  const high10 = Math.max(...last10.map((b) => b.high));
  const low10 = Math.min(...last10.map((b) => b.low));
  const range10Pct = high10 > 0 ? ((high10 - low10) / high10) * 100 : 100;
  if (range10Pct <= 8) score += 10;
  else if (range10Pct <= 12) score += 5;

  return clamp(score);
}

/** 📊 Volume Expansion: multi-day volume ramp (acceleration), distinct from Smart Money's
 *  single-day RVOL burst — catches volume building up over several days ahead of a move. */
function calcVolumeExpansionScore(s: StockSummary, bars: OHLCVBar[]): number {
  if (bars.length < 15) return 30;
  const volumes = bars.map((b) => b.volume);

  const recent3 = volumes.slice(-3);
  const avgRecent3 = recent3.reduce((a, b) => a + b, 0) / recent3.length;
  const prior10 = volumes.slice(-13, -3);
  const avgPrior10 = prior10.length > 0 ? prior10.reduce((a, b) => a + b, 0) / prior10.length : avgRecent3;

  let score = 0;

  const expansionRatio = avgPrior10 > 0 ? avgRecent3 / avgPrior10 : 1;
  if (expansionRatio >= 2) score += 50;
  else if (expansionRatio >= 1.5) score += 35;
  else if (expansionRatio >= 1.2) score += 20;
  else if (expansionRatio >= 1) score += 10;

  const volMa5 = lastValid(sma(volumes, 5));
  const todayVsMa5 = !Number.isNaN(volMa5) && volMa5 > 0 ? s.volume / volMa5 : 1;
  if (todayVsMa5 >= 2) score += 30;
  else if (todayVsMa5 >= 1.5) score += 20;
  else if (todayVsMa5 >= 1.2) score += 10;

  const last3Bars = bars.slice(-3);
  let risingDays = 0;
  for (let i = 1; i < last3Bars.length; i++) {
    if (last3Bars[i].volume > last3Bars[i - 1].volume) risingDays++;
  }
  score += risingDays * 10;

  return clamp(score);
}

/** 🎯 Breakout Position: where the close sits within the recent trading range. */
function calcBreakoutPositionScore(s: StockSummary, bars: OHLCVBar[]): number {
  if (bars.length < 5) return 50;
  const last20 = bars.slice(-Math.min(20, bars.length));
  const high20 = Math.max(...last20.map((b) => b.high));
  const low20 = Math.min(...last20.map((b) => b.low));
  const posInRange = high20 > low20 ? (s.lastClose - low20) / (high20 - low20) : 0.5;

  if (posInRange >= 0.9) return 100;
  if (posInRange >= 0.8) return 85;
  if (posInRange >= 0.6) return 60;
  if (posInRange >= 0.4) return 40;
  if (posInRange >= 0.2) return 20;
  return 10;
}

/** 📐 Historical Volatility: magnitude of daily swings over the last 20 sessions.
 *  Higher volatility scores higher here — it's exactly the character of stocks capable
 *  of an explosive ARA-style move, not a risk penalty (see Distribution Risk for that). */
function calcHistoricalVolatilityScore(bars: OHLCVBar[]): number {
  if (bars.length < 21) return 40;
  const closes = bars.map((b) => b.close);
  const returns: number[] = [];
  for (let i = closes.length - 20; i < closes.length; i++) {
    if (i <= 0) continue;
    returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }
  if (returns.length === 0) return 40;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, r) => a + (r - mean) ** 2, 0) / returns.length;
  const dailyVolPct = Math.sqrt(variance) * 100;

  if (dailyVolPct >= 6) return 100;
  if (dailyVolPct >= 4) return 85;
  if (dailyVolPct >= 3) return 65;
  if (dailyVolPct >= 2) return 45;
  if (dailyVolPct >= 1) return 25;
  return 10;
}

/** 🧭 Historical Beta (proxy): no IHSG/index series exists in this codebase, so true
 *  market-beta can't be computed. This approximates it as ATR(14) now vs. ATR(14) from
 *  ~40 sessions ago — a structurally expanding volatility regime is the closest available
 *  signal for "this stock is becoming more beta-sensitive / explosive". */
function calcHistoricalBetaScore(bars: OHLCVBar[]): number {
  if (bars.length < 60) return 40;
  const n = bars.length;
  const atrRecent = avgTrueRange(bars, n - 14, 14);
  const atrPast = avgTrueRange(bars, n - 54, 14);
  if (atrPast <= 0) return 40;
  const ratio = atrRecent / atrPast;

  if (ratio >= 1.5) return 100;
  if (ratio >= 1.2) return 75;
  if (ratio >= 0.9) return 50;
  if (ratio >= 0.7) return 30;
  return 15;
}

function calcLikuiditasScore(s: StockSummary): number {
  const v = s.value;
  if (v >= 100_000_000_000) return 100;
  if (v >= 50_000_000_000) return 90;
  if (v >= 20_000_000_000) return 78;
  if (v >= 10_000_000_000) return 63;
  if (v >= 5_000_000_000) return 45;
  if (v >= 1_000_000_000) return 25;
  return 10;
}

function calcSmartMoneyScore(s: StockSummary, bars: OHLCVBar[]): number {
  const lastBar = bars[bars.length - 1];
  if (!lastBar) return 0;

  const volMa20 = volumeMA(bars, 20);
  const rvol = !Number.isNaN(volMa20) && volMa20 > 0 ? s.volume / volMa20 : 1;

  let score = 0;

  // Volume surge (40 pts)
  if (rvol >= 3) score += 40;
  else if (rvol >= 2) score += 30;
  else if (rvol >= 1.5) score += 20;
  else if (rvol >= 1.2) score += 10;

  // Bullish candle (20 pts)
  if (s.lastClose > lastBar.open) score += 20;

  // Closing position in day range (20 pts)
  const dayRange = lastBar.high - lastBar.low;
  const closePos = dayRange > 0 ? (s.lastClose - lastBar.low) / dayRange : 0.5;
  if (closePos >= 0.75) score += 20;
  else if (closePos >= 0.5) score += 10;

  // Candle body quality (20 pts)
  const body = Math.abs(s.lastClose - lastBar.open);
  const bodyRatio = dayRange > 0 ? body / dayRange : 0;
  if (bodyRatio >= 0.6) score += 20;
  else if (bodyRatio >= 0.4) score += 10;

  return clamp(score);
}

function calcDistributionRisk(s: StockSummary, bars: OHLCVBar[]): number {
  const rsiLast = lastValid(rsi(bars, 14));
  const lastBar = bars[bars.length - 1];

  // Stochastic %K
  const kPeriod = 14;
  let stochK = 50;
  if (bars.length >= kPeriod) {
    const slice = bars.slice(-kPeriod);
    const lowest = Math.min(...slice.map((b) => b.low));
    const highest = Math.max(...slice.map((b) => b.high));
    stochK = highest > lowest ? ((bars[bars.length - 1].close - lowest) / (highest - lowest)) * 100 : 50;
  }

  let risk = 0;

  // RSI overbought
  if (!Number.isNaN(rsiLast)) {
    if (rsiLast > 80) risk += 35;
    else if (rsiLast > 70) risk += 20;
    else if (rsiLast > 75) risk += 28;
  }

  // Stoch overbought
  if (stochK > 85) risk += 25;
  else if (stochK > 75) risk += 15;

  // Already up big today (>10%)
  if (s.percentChange1D > 10) risk += 20;
  else if (s.percentChange1D > 7) risk += 10;

  // Near annual high (within 3%) — limited upside
  if (s.annualHigh > 0 && s.lastClose >= s.annualHigh * 0.97) risk += 10;

  // Upper shadow dominance (rejection candle)
  if (lastBar) {
    const upperWick = lastBar.high - Math.max(lastBar.open, lastBar.close);
    const range = lastBar.high - lastBar.low;
    if (range > 0 && upperWick / range > 0.5) risk += 10;
  }

  return clamp(risk);
}

function calcOpeningConfirmation(s: StockSummary, bars: OHLCVBar[]): number {
  // Approximated from EOD data — simulates pre-next-open readiness
  const lastBar = bars[bars.length - 1];
  if (!lastBar) return 30;

  let score = 0;
  const dayRange = lastBar.high - lastBar.low;
  const closePos = dayRange > 0 ? (s.lastClose - lastBar.low) / dayRange : 0.5;

  // Strong close in upper range (30 pts)
  if (closePos >= 0.8) score += 30;
  else if (closePos >= 0.6) score += 18;
  else if (closePos >= 0.4) score += 8;

  // Positive momentum into close (30 pts)
  if (s.percentChange1D > 3) score += 30;
  else if (s.percentChange1D > 1) score += 20;
  else if (s.percentChange1D > 0) score += 10;

  // High volume closing (20 pts) — sustained buying
  const rvol = relativeVolume(bars, 20);
  if (!Number.isNaN(rvol)) {
    if (rvol >= 2) score += 20;
    else if (rvol >= 1.5) score += 12;
    else if (rvol >= 1.2) score += 6;
  }

  // Consecutive positive days — trend confirmation (20 pts)
  const last3 = bars.slice(-3);
  const positiveDays = last3.filter((b) => b.close > b.open).length;
  if (positiveDays === 3) score += 20;
  else if (positiveDays === 2) score += 12;
  else if (positiveDays === 1) score += 5;

  return clamp(score);
}

export function computeBreakoutScores(s: StockSummary, bars: OHLCVBar[]): BreakoutScores {
  const compression = calcCompressionScore(bars);
  const momentum = calcMomentumScore(s, bars);
  const likuiditas = calcLikuiditasScore(s);
  const smartMoney = calcSmartMoneyScore(s, bars);
  const volumeExpansion = calcVolumeExpansionScore(s, bars);
  const breakoutPosition = calcBreakoutPositionScore(s, bars);
  const historicalVolatility = calcHistoricalVolatilityScore(bars);
  const historicalBeta = calcHistoricalBetaScore(bars);
  const distributionRisk = calcDistributionRisk(s, bars);
  const openingConfirmation = calcOpeningConfirmation(s, bars);

  // Probabilitas naik >10%: driven by momentum + smart money, dampened by risk
  const probUp = clamp(
    momentum * 0.40 + smartMoney * 0.30 + (100 - distributionRisk) * 0.30
  );

  // Probabilitas turun >3%: driven by risk + weak momentum
  const probDown = clamp(
    distributionRisk * 0.50 + (100 - momentum) * 0.30 + (100 - smartMoney) * 0.20
  );

  // Composite weighted score — favors a "compressed before explosive move" setup
  // (e.g. SULI-style: tight range + smart money inflow) over a strict EMA-bullish trend.
  // Distribution Risk & Opening Confirmation stay out of the weighted sum and instead
  // act as safety gates below, same as before.
  const composite = clamp(
    compression * 0.20 +
    smartMoney * 0.20 +
    likuiditas * 0.15 +
    volumeExpansion * 0.15 +
    breakoutPosition * 0.10 +
    momentum * 0.10 +
    historicalVolatility * 0.05 +
    historicalBeta * 0.05
  );

  // Status determination
  let status: BreakoutScores['status'];
  if (composite >= 68 && distributionRisk < 35 && openingConfirmation >= 55 && likuiditas >= 45) {
    status = 'BUY_WATCH';
  } else if (composite >= 55 && distributionRisk < 50 && likuiditas >= 25) {
    status = 'WATCH';
  } else {
    status = 'SKIP';
  }

  return {
    compression: Math.round(compression),
    momentum: Math.round(momentum),
    likuiditas: Math.round(likuiditas),
    smartMoney: Math.round(smartMoney),
    volumeExpansion: Math.round(volumeExpansion),
    breakoutPosition: Math.round(breakoutPosition),
    historicalVolatility: Math.round(historicalVolatility),
    historicalBeta: Math.round(historicalBeta),
    distributionRisk: Math.round(distributionRisk),
    probUp: Math.round(probUp),
    probDown: Math.round(probDown),
    openingConfirmation: Math.round(openingConfirmation),
    composite: Math.round(composite),
    status,
  };
}

const breakoutPreset: ScreenerPreset = {
  id: 'breakout',
  label: 'Breakout Hunter',
  description: 'Mencari saham dengan peluang tertinggi menghasilkan kenaikan 10–20% dalam 1–3 hari, dengan risiko maksimal ~3%. Menggunakan 8 dimensi skor AI — menekankan pola "compressed before explosive move" (SULI-style), bukan hanya tren EMA yang sudah bullish.',
  criteria: [
    'Harga > 100 (hindari penny stock)',
    'Nilai transaksi > Rp 5 miliar',
    'Compression Score 20% — kontraksi volatilitas/range ("coiled spring")',
    'Smart Money Score 20% — RVOL, kualitas candle, posisi close',
    'Liquidity Score 15% — tier nilai transaksi',
    'Volume Expansion 15% — akselerasi volume multi-hari',
    'Breakout Position 10% — posisi close dalam range terkini',
    'Momentum Score 10% — EMA, MACD, RSI',
    'Historical Volatility 5% — magnitude swing harian historis',
    'Historical Beta 5% — proxy ekspansi ATR (tidak ada data IHSG)',
    'Distribution Risk < 50 & Opening Confirmation ≥ 40 (safety gate)',
    'Composite Score ≥ 55',
  ],
  coarseFilter: (s) =>
    s.lastClose > 100 &&
    s.value > 5_000_000_000 &&
    s.percentChange1D > -3 &&
    s.percentChange1D < 16,
  evaluate: (s, bars) => {
    const scores = computeBreakoutScores(s, bars);
    const passed = scores.status !== 'SKIP';

    const reasons: string[] = [];
    const failed: string[] = [];

    // Readable reason strings for display
    if (scores.composite >= 55) reasons.push(`Composite Score ${scores.composite}/100`);
    else failed.push(`Composite Score lemah (${scores.composite}/100)`);

    if (scores.compression >= 60) reasons.push(`🌀 Compression ${scores.compression}/100`);
    else failed.push(`🌀 Compression lemah (${scores.compression}/100)`);

    if (scores.smartMoney >= 40) reasons.push(`🏦 Smart Money ${scores.smartMoney}/100`);
    else failed.push(`🏦 Smart Money lemah (${scores.smartMoney}/100)`);

    if (scores.likuiditas >= 45) reasons.push(`💰 Likuiditas ${scores.likuiditas}/100`);
    else failed.push(`💰 Likuiditas rendah (${scores.likuiditas}/100)`);

    if (scores.volumeExpansion >= 40) reasons.push(`📊 Volume Expansion ${scores.volumeExpansion}/100`);
    else failed.push(`📊 Volume Expansion lemah (${scores.volumeExpansion}/100)`);

    reasons.push(`🎯 Breakout Position ${scores.breakoutPosition}/100`);
    reasons.push(`🔥 Momentum ${scores.momentum}/100`);
    reasons.push(`📐 Historical Volatility ${scores.historicalVolatility}/100`);
    reasons.push(`🧭 Historical Beta ${scores.historicalBeta}/100`);

    if (scores.distributionRisk < 50) reasons.push(`⚠️ Distribution Risk ${scores.distributionRisk}/100 (aman)`);
    else failed.push(`⚠️ Distribution Risk tinggi (${scores.distributionRisk}/100)`);

    if (scores.openingConfirmation >= 40) reasons.push(`🌅 Opening Confirmation ${scores.openingConfirmation}/100`);
    else failed.push(`🌅 Opening Confirmation rendah (${scores.openingConfirmation}/100)`);

    reasons.push(`📈 Prob Naik >10%: ${scores.probUp}%`);
    reasons.push(`📉 Prob Turun >3%: ${scores.probDown}%`);

    return { passed, reasons, failed, breakoutScores: scores };
  },
};

// ── Registry ──────────────────────────────────────────────────────────────────

export const SCREENER_PRESETS: Record<ScreenerPresetId, ScreenerPreset> = {
  ara: araPreset,
  bpjs: bpjsPreset,
  momentum: momentumPreset,
  breakout: breakoutPreset,
};

export const SCREENER_PRESET_LIST: ScreenerPreset[] = [araPreset, bpjsPreset, momentumPreset, breakoutPreset];
