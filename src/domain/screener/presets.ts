import { OHLCVBar } from '@/domain/models/History';
import { StockSummary } from '@/domain/models/Stock';
import { ema, lastValid, sma } from '@/domain/indicators/movingAverages';
import { macd } from '@/domain/indicators/macd';
import { rsi } from '@/domain/indicators/rsi';
import { relativeVolume, volumeMA } from '@/domain/indicators/volume';
import { adx } from '@/domain/indicators/adx';

/** IDX board lot size: 1 lot = 100 shares. */
export const LOT_SIZE = 100;

export type ScreenerPresetId =
  | 'ara' | 'bpjs' | 'momentum' | 'breakout'
  | 'early_breakout' | 'smart_money' | 'swing' | 'hrrr';

// ── Breakout Hunter scoring (7 dimensions) ────────────────────────────────────
export interface BreakoutScores {
  /** 🔥 0-100 — EMA structure, MACD, RSI sweet-spot, breakout position */
  momentum: number;
  /** 💰 0-100 — Nilai transaksi tier */
  likuiditas: number;
  /** 🏦 0-100 — Volume surge, candle quality, closing position */
  smartMoney: number;
  /** ⚠️ 0-100 — lower is safer — overbought signals, distribution flags */
  distributionRisk: number;
  /** 📈 0-100 — synthetic probability of >10% gain in 1-3 days */
  probUp: number;
  /** 📉 0-100 — synthetic probability of >3% loss */
  probDown: number;
  /** 🌅 0-100 — pre-open positioning quality */
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
  label: 'Momentum Hunter',
  description: 'Saham yang sedang mengalami percepatan momentum — return 5-20% hari ini dengan konfirmasi EMA, MACD, RSI, volume, dan posisi close dekat high.',
  criteria: [
    'Return 1 hari antara 5% – 20%',
    'Nilai transaksi > Rp 20 miliar',
    'RVOL > 1,8 (volume di atas rata-rata)',
    'Close di 70%+ range candle harian',
    'EMA20 > EMA50 (struktur uptrend)',
    'Close > EMA20',
    'MACD bullish (MACD > Signal)',
    'RSI antara 60 – 75',
  ],
  // Cheap summary-only pre-filter: return 5-20% + value > 20B
  coarseFilter: (s) =>
    s.value > 20_000_000_000 &&
    s.percentChange1D >= 5 &&
    s.percentChange1D <= 20,
  evaluate: (s, bars) => {
    const lastBar = bars[bars.length - 1];
    const closes = bars.map((b) => b.close);
    const ema20 = lastValid(ema(closes, 20));
    const ema50 = lastValid(ema(closes, 50));
    const { macdLine, signalLine } = macd(bars);
    const macdLast = lastValid(macdLine);
    const signalLast = lastValid(signalLine);
    const rsiLast = lastValid(rsi(bars, 14));
    const rvol = relativeVolume(bars, 20);

    // Close position in today's candle range (0–1)
    const dayRange = lastBar ? lastBar.high - lastBar.low : 0;
    const closePos = dayRange > 0 && lastBar
      ? (s.lastClose - lastBar.low) / dayRange
      : 0;

    return verdict([
      [s.percentChange1D >= 5 && s.percentChange1D <= 20,  'Return 1 hari antara 5% – 20%'],
      [s.value > 20_000_000_000,                            'Nilai transaksi > Rp 20 miliar'],
      [!Number.isNaN(rvol) && rvol > 1.8,                  'RVOL > 1,8'],
      [closePos >= 0.70,                                    'Close di 70%+ range candle'],
      [!Number.isNaN(ema20) && !Number.isNaN(ema50) && ema20 > ema50, 'EMA20 > EMA50'],
      [!Number.isNaN(ema20) && s.lastClose > ema20,         'Close > EMA20'],
      [!Number.isNaN(macdLast) && !Number.isNaN(signalLast) && macdLast > signalLast, 'MACD bullish'],
      [!Number.isNaN(rsiLast) && rsiLast >= 60 && rsiLast <= 75, 'RSI antara 60 – 75'],
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

  // EMA structure (25 pts)
  if (!Number.isNaN(ema20) && !Number.isNaN(ema50) && ema20 > ema50) score += 15;
  if (!Number.isNaN(ema20) && s.lastClose > ema20) score += 10;

  // MACD (30 pts): bullish position + crossover bonus
  if (!Number.isNaN(macdLast) && !Number.isNaN(signalLast) && macdLast > signalLast) score += 20;
  if (!Number.isNaN(histLast) && !Number.isNaN(prevHist) && histLast > 0 && prevHist <= 0) score += 10; // fresh crossover

  // RSI sweet-spot (25 pts)
  if (!Number.isNaN(rsiLast)) {
    if (rsiLast >= 55 && rsiLast <= 70) score += 25;
    else if (rsiLast >= 50 && rsiLast < 55) score += 15;
    else if (rsiLast > 70 && rsiLast <= 75) score += 10;
  }

  // Breakout position: close in upper 80%+ of 20-day range (20 pts)
  const last20 = bars.slice(-20);
  const high20 = Math.max(...last20.map((b) => b.high));
  const low20 = Math.min(...last20.map((b) => b.low));
  const posInRange = high20 > low20 ? (s.lastClose - low20) / (high20 - low20) : 0.5;
  if (posInRange >= 0.8) score += 20;
  else if (posInRange >= 0.6) score += 12;
  else if (posInRange >= 0.4) score += 5;

  return clamp(score);
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

function computeBreakoutScores(s: StockSummary, bars: OHLCVBar[]): BreakoutScores {
  const momentum = calcMomentumScore(s, bars);
  const likuiditas = calcLikuiditasScore(s);
  const smartMoney = calcSmartMoneyScore(s, bars);
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

  // Composite weighted score
  const composite = clamp(
    momentum * 0.30 +
    likuiditas * 0.15 +
    smartMoney * 0.25 +
    (100 - distributionRisk) * 0.20 +
    openingConfirmation * 0.10
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
    momentum: Math.round(momentum),
    likuiditas: Math.round(likuiditas),
    smartMoney: Math.round(smartMoney),
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
  description: 'Mencari saham dengan peluang tertinggi menghasilkan kenaikan 10–20% dalam 1–3 hari, dengan risiko maksimal ~3%. Menggunakan 7 dimensi skor AI.',
  criteria: [
    'Harga > 100 (hindari penny stock)',
    'Nilai transaksi > Rp 5 miliar',
    'Momentum Score (EMA, MACD, RSI, posisi breakout)',
    'Smart Money Score (RVOL, kualitas candle, posisi close)',
    'Distribution Risk < 50 (bukan overbought berat)',
    'Composite Score ≥ 55',
    'Opening Confirmation Score ≥ 40',
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

    if (scores.momentum >= 50) reasons.push(`🔥 Momentum ${scores.momentum}/100`);
    else failed.push(`🔥 Momentum lemah (${scores.momentum}/100)`);

    if (scores.likuiditas >= 45) reasons.push(`💰 Likuiditas ${scores.likuiditas}/100`);
    else failed.push(`💰 Likuiditas rendah (${scores.likuiditas}/100)`);

    if (scores.smartMoney >= 40) reasons.push(`🏦 Smart Money ${scores.smartMoney}/100`);
    else failed.push(`🏦 Smart Money lemah (${scores.smartMoney}/100)`);

    if (scores.distributionRisk < 50) reasons.push(`⚠️ Distribution Risk ${scores.distributionRisk}/100 (aman)`);
    else failed.push(`⚠️ Distribution Risk tinggi (${scores.distributionRisk}/100)`);

    if (scores.openingConfirmation >= 40) reasons.push(`🌅 Opening Confirmation ${scores.openingConfirmation}/100`);
    else failed.push(`🌅 Opening Confirmation rendah (${scores.openingConfirmation}/100)`);

    reasons.push(`📈 Prob Naik >10%: ${scores.probUp}%`);
    reasons.push(`📉 Prob Turun >3%: ${scores.probDown}%`);

    return { passed, reasons, failed, breakoutScores: scores };
  },
};

// ── ⭐ Early Breakout Hunter ──────────────────────────────────────────────────

const earlyBreakoutPreset: ScreenerPreset = {
  id: 'early_breakout',
  label: 'Early Breakout Hunter',
  description: 'Mencari saham yang belum naik signifikan, tetapi memiliki struktur yang sering mendahului breakout besar — kandidat 1-3 hari sebelum ramai.',
  criteria: [
    'Nilai transaksi > Rp 10 miliar',
    'Harga > EMA20',
    'EMA20 baru melewati EMA50 (crossover dalam 5 bar terakhir atau rasio ≤ 1.5%)',
    'RSI antara 50 – 60 (belum overbought)',
    'MACD baru bullish crossover',
    'RVOL > 1,3',
    'Close di 80%+ range candle harian',
    'Jarak ke 20-hari high > 8% (masih ada ruang naik)',
    'ADX 18–28 dan meningkat (tren mulai terbentuk)',
  ],
  coarseFilter: (s) =>
    s.value > 10_000_000_000 &&
    s.percentChange1D > -1 &&
    s.percentChange1D < 8,
  evaluate: (s, bars) => {
    const n = bars.length;
    const lastBar = bars[n - 1];
    const closes = bars.map((b) => b.close);
    const ema20Arr = ema(closes, 20);
    const ema50Arr = ema(closes, 50);
    const ema20 = lastValid(ema20Arr);
    const ema50 = lastValid(ema50Arr);
    const { macdLine, signalLine } = macd(bars);
    const macdLast = lastValid(macdLine);
    const signalLast = lastValid(signalLine);
    const macdPrev = n >= 2 ? macdLine[n - 2] : NaN;
    const signalPrev = n >= 2 ? signalLine[n - 2] : NaN;
    const rsiLast = lastValid(rsi(bars, 14));
    const rvol = relativeVolume(bars, 20);
    const adxSeries = adx(bars, 14);
    const adxLast = adxSeries[n - 1];
    const adxPrev = n >= 2 ? adxSeries[n - 2] : NaN;

    // Candle range position
    const dayRange = lastBar ? lastBar.high - lastBar.low : 0;
    const closePos = dayRange > 0 && lastBar ? (s.lastClose - lastBar.low) / dayRange : 0;

    // 20-day high resistance distance
    const high20 = Math.max(...bars.slice(-20).map((b) => b.high));
    const upsideToHigh20 = high20 > 0 ? ((high20 - s.lastClose) / s.lastClose) * 100 : 0;

    // EMA20 freshly crossed EMA50 (within last 5 bars or ratio very tight)
    const ema20OverEma50 = !Number.isNaN(ema20) && !Number.isNaN(ema50) && ema20 > ema50;
    const freshCross = ema20OverEma50 && (ema20 / ema50 - 1) < 0.015;

    // MACD fresh bullish crossover
    const macdCrossover =
      !Number.isNaN(macdLast) && !Number.isNaN(signalLast) && macdLast > signalLast &&
      !Number.isNaN(macdPrev) && !Number.isNaN(signalPrev) && macdPrev <= signalPrev;

    // ADX 18-28 and rising
    const adxInZone = !Number.isNaN(adxLast) && adxLast >= 18 && adxLast <= 28;
    const adxRising = !Number.isNaN(adxLast) && !Number.isNaN(adxPrev) && adxLast > adxPrev;

    return verdict([
      [s.value > 10_000_000_000,                        'Nilai transaksi > Rp 10 miliar'],
      [!Number.isNaN(ema20) && s.lastClose > ema20,     'Harga > EMA20'],
      [freshCross,                                       'EMA20 baru melewati EMA50'],
      [!Number.isNaN(rsiLast) && rsiLast >= 50 && rsiLast <= 60, 'RSI antara 50 – 60'],
      [macdCrossover,                                    'MACD baru bullish crossover'],
      [!Number.isNaN(rvol) && rvol > 1.3,               'RVOL > 1,3'],
      [closePos >= 0.80,                                 'Close di 80%+ range candle'],
      [upsideToHigh20 > 8,                               'Jarak ke 20H high > 8%'],
      [adxInZone && adxRising,                           'ADX 18-28 dan meningkat'],
    ]);
  },
};

// ── 💎 Smart Money Hunter ─────────────────────────────────────────────────────

const smartMoneyPreset: ScreenerPreset = {
  id: 'smart_money',
  label: 'Smart Money Hunter',
  description: 'Mencari tanda akumulasi bandar — volume tinggi tetapi harga belum naik signifikan. Kandidat sebelum pergerakan besar.',
  criteria: [
    'Return 1 hari < 3% (harga belum naik banyak)',
    'RVOL > 2 (volume sudah tinggi)',
    'Nilai transaksi > Rp 10 miliar',
    'Close di 65%+ range candle (tutup dekat high)',
    'MACD baru golden cross (bullish crossover)',
    'RSI antara 45 – 60',
    'ADX mulai naik',
  ],
  coarseFilter: (s) =>
    s.value > 10_000_000_000 &&
    s.percentChange1D >= -1 &&
    s.percentChange1D < 4,
  evaluate: (s, bars) => {
    const n = bars.length;
    const lastBar = bars[n - 1];
    const { macdLine, signalLine } = macd(bars);
    const macdLast = lastValid(macdLine);
    const signalLast = lastValid(signalLine);
    const macdPrev = n >= 2 ? macdLine[n - 2] : NaN;
    const signalPrev = n >= 2 ? signalLine[n - 2] : NaN;
    const rsiLast = lastValid(rsi(bars, 14));
    const rvol = relativeVolume(bars, 20);
    const adxSeries = adx(bars, 14);
    const adxLast = adxSeries[n - 1];
    const adxPrev = n >= 2 ? adxSeries[n - 2] : NaN;

    const dayRange = lastBar ? lastBar.high - lastBar.low : 0;
    const closePos = dayRange > 0 && lastBar ? (s.lastClose - lastBar.low) / dayRange : 0;

    const macdGoldenCross =
      !Number.isNaN(macdLast) && !Number.isNaN(signalLast) && macdLast > signalLast &&
      !Number.isNaN(macdPrev) && !Number.isNaN(signalPrev) && macdPrev <= signalPrev;

    const adxRising = !Number.isNaN(adxLast) && !Number.isNaN(adxPrev) && adxLast > adxPrev;

    return verdict([
      [s.percentChange1D >= -1 && s.percentChange1D < 3,  'Return 1 hari < 3%'],
      [!Number.isNaN(rvol) && rvol > 2,                   'RVOL > 2'],
      [s.value > 10_000_000_000,                           'Nilai transaksi > Rp 10 miliar'],
      [closePos >= 0.65,                                   'Close di 65%+ range candle'],
      [macdGoldenCross,                                    'MACD baru golden cross'],
      [!Number.isNaN(rsiLast) && rsiLast >= 45 && rsiLast <= 60, 'RSI antara 45 – 60'],
      [adxRising,                                          'ADX mulai naik'],
    ]);
  },
};

// ── 📈 Swing Hunter ───────────────────────────────────────────────────────────

const swingPreset: ScreenerPreset = {
  id: 'swing',
  label: 'Swing Hunter',
  description: 'Uptrend terkonfirmasi oleh tiga EMA, ADX kuat, RSI sehat — kandidat holding 1-4 minggu dengan target 10-20%.',
  criteria: [
    'EMA20 > EMA50 > EMA200 (struktur uptrend sempurna)',
    'ADX > 25 (tren kuat)',
    'RSI antara 55 – 70',
    'MACD bullish',
    'Volume di atas MA20',
    'Higher High (high hari ini > high kemarin)',
    'Higher Low (low hari ini > low kemarin)',
    'Nilai transaksi > Rp 20 miliar',
  ],
  coarseFilter: (s) => s.value > 20_000_000_000 && s.percentChange1D > 0,
  evaluate: (s, bars) => {
    const n = bars.length;
    const lastBar = bars[n - 1];
    const prevBar = n >= 2 ? bars[n - 2] : null;
    const closes = bars.map((b) => b.close);
    const ema20 = lastValid(ema(closes, 20));
    const ema50 = lastValid(ema(closes, 50));
    const ema200 = lastValid(ema(closes, 200));
    const { macdLine, signalLine } = macd(bars);
    const macdLast = lastValid(macdLine);
    const signalLast = lastValid(signalLine);
    const rsiLast = lastValid(rsi(bars, 14));
    const adxSeries = adx(bars, 14);
    const adxLast = adxSeries[n - 1];
    const volMa20 = volumeMA(bars, 20);

    const higherHigh = !!lastBar && !!prevBar && lastBar.high > prevBar.high;
    const higherLow  = !!lastBar && !!prevBar && lastBar.low  > prevBar.low;
    const volAboveMa = !Number.isNaN(volMa20) && volMa20 > 0 && lastBar && lastBar.volume > volMa20;

    return verdict([
      [!Number.isNaN(ema20) && !Number.isNaN(ema50) && !Number.isNaN(ema200) && ema20 > ema50 && ema50 > ema200, 'EMA20 > EMA50 > EMA200'],
      [!Number.isNaN(adxLast) && adxLast > 25,              'ADX > 25'],
      [!Number.isNaN(rsiLast) && rsiLast >= 55 && rsiLast <= 70, 'RSI antara 55 – 70'],
      [!Number.isNaN(macdLast) && !Number.isNaN(signalLast) && macdLast > signalLast, 'MACD bullish'],
      [!!volAboveMa,                                         'Volume di atas MA20'],
      [higherHigh,                                           'Higher High'],
      [higherLow,                                            'Higher Low'],
      [s.value > 20_000_000_000,                             'Nilai transaksi > Rp 20 miliar'],
    ]);
  },
};

// ── 🔥 High Risk High Reward ──────────────────────────────────────────────────

const hrrrPreset: ScreenerPreset = {
  id: 'hrrr',
  label: 'High Risk High Reward',
  description: 'Saham dengan probabilitas pergerakan ekstrem tinggi — bukan prediksi ARA, tetapi kandidat volatilitas tinggi yang layak dipantau dengan manajemen risiko ketat.',
  criteria: [
    'Return 1 hari > 5%',
    'Nilai transaksi > Rp 15 miliar',
    'RVOL > 2,5 (volume sangat tinggi)',
    'Close di 75%+ range candle harian',
    'RSI antara 60 – 85',
    'MACD bullish',
    'Volume MA5 > Volume MA20 (akselerasi volume)',
  ],
  coarseFilter: (s) =>
    s.value > 15_000_000_000 &&
    s.percentChange1D > 5,
  evaluate: (s, bars) => {
    const n = bars.length;
    const lastBar = bars[n - 1];
    const volumes = bars.map((b) => b.volume);
    const volMa5  = lastValid(sma(volumes, 5));
    const volMa20 = lastValid(sma(volumes, 20));
    const { macdLine, signalLine } = macd(bars);
    const macdLast = lastValid(macdLine);
    const signalLast = lastValid(signalLine);
    const rsiLast = lastValid(rsi(bars, 14));
    const rvol = relativeVolume(bars, 20);

    const dayRange = lastBar ? lastBar.high - lastBar.low : 0;
    const closePos = dayRange > 0 && lastBar ? (s.lastClose - lastBar.low) / dayRange : 0;

    const volAccelerating = !Number.isNaN(volMa5) && !Number.isNaN(volMa20) && volMa5 > volMa20;

    return verdict([
      [s.percentChange1D > 5,                              'Return 1 hari > 5%'],
      [s.value > 15_000_000_000,                           'Nilai transaksi > Rp 15 miliar'],
      [!Number.isNaN(rvol) && rvol > 2.5,                 'RVOL > 2,5'],
      [closePos >= 0.75,                                   'Close di 75%+ range candle'],
      [!Number.isNaN(rsiLast) && rsiLast >= 60 && rsiLast <= 85, 'RSI antara 60 – 85'],
      [!Number.isNaN(macdLast) && !Number.isNaN(signalLast) && macdLast > signalLast, 'MACD bullish'],
      [volAccelerating,                                    'Volume MA5 > Volume MA20'],
    ]);
  },
};

// ── Registry ──────────────────────────────────────────────────────────────────

export const SCREENER_PRESETS: Record<ScreenerPresetId, ScreenerPreset> = {
  ara:           araPreset,
  bpjs:          bpjsPreset,
  momentum:      momentumPreset,
  breakout:      breakoutPreset,
  early_breakout: earlyBreakoutPreset,
  smart_money:   smartMoneyPreset,
  swing:         swingPreset,
  hrrr:          hrrrPreset,
};

export const SCREENER_PRESET_LIST: ScreenerPreset[] = [
  araPreset, bpjsPreset, momentumPreset, breakoutPreset,
  earlyBreakoutPreset, smartMoneyPreset, swingPreset, hrrrPreset,
];
