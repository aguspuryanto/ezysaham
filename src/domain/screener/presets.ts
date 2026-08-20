import { OHLCVBar } from '@/domain/models/History';
import { StockSummary } from '@/domain/models/Stock';
import { ema, lastValid, sma } from '@/domain/indicators/movingAverages';
import { macd } from '@/domain/indicators/macd';
import { rsi } from '@/domain/indicators/rsi';
import { relativeVolume, volumeMA } from '@/domain/indicators/volume';
import { computeStockAnalysis } from '@/domain/analysis/stockAnalysisEngine';
import { computeDataFreshness, DataFreshness } from '@/domain/analysis/dataFreshness';
import { formatCompact } from '@/lib/format';

/** IDX board lot size: 1 lot = 100 shares. */
export const LOT_SIZE = 100;

export type ScreenerPresetId = 'ara' | 'bpjs' | 'momentum' | 'breakout' | 'tradingPlan' | 'swingHunter' | 'araHunter' | 'smartMoneyHunter' | 'dayTrading' | 'fundamental';

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

// ── Trading Plan scoring ("Opportunity Score", 8 weighted factors) ────────────
export interface TradingPlanScore {
  /** Overall trend classification from EMA structure */
  trend: 'bullish' | 'bearish' | 'sideways';
  /** 1-5 — quality of momentum (RSI/Stochastic/MACD sweet-spot) */
  momentumStars: number;
  /** Area harga yang disarankan untuk entry */
  buyAreaLow: number;
  buyAreaHigh: number;
  /** Area harga untuk menambah posisi (average down) jika entry awal belum konfirmasi */
  avgDown: number;
  /** Batas keluar jika setup gagal */
  stopLoss: number;
  /** Target profit bertingkat */
  tp1: number;
  tp2: number;
  tp3: number;
  /** (tp1 - entry) / (entry - stopLoss) */
  riskRewardRatio: number;
  /** 0-100 — weighted composite ("Opportunity Score") */
  score: number;
  /** 0-100 — proxy keyakinan setup, sejalan dengan score */
  confidencePct: number;
  status: 'STRONG_BUY' | 'BUY' | 'WATCHLIST' | 'SPECULATIVE' | 'AVOID';
  /** Breakdown per faktor (masing-masing 0-100) untuk transparansi skor */
  breakdown: {
    emaTrend: number;
    supportStrength: number;
    resistanceSpace: number;
    volume: number;
    rvol: number;
    stochastic: number;
    rsi: number;
    momentum1W: number;
  };
}

export interface PresetEvaluation {
  passed: boolean;
  reasons: string[];
  failed: string[];
  /** Only present for the Breakout Hunter preset */
  breakoutScores?: BreakoutScores;
  /** Only present for the Trading Plan preset */
  tradingPlan?: TradingPlanScore;
  /** Only present for the ARA Hunter preset */
  araProbability?: AraProbabilityScore;
  /** Only present for the Fundamental preset */
  fundamentalScore?: FundamentalScore;
  /** Relative volume (volume hari ini / volume MA20) — diisi oleh preset yang menghitungnya */
  relativeVolume?: number;
  /** Usia data OHLCV terakhir. Tier "stale" berarti data 3+ hari bursa lalu — jangan dipakai untuk keputusan Day Trading/ARA hari ini. */
  freshness?: DataFreshness;
}

// ── ARA Probability scoring ────────────────────────────────────────────────────
export interface AraProbabilityScore {
  /** 0-100 — naik 5-20% sweet-spot, dikonfirmasi EMA20 > EMA50 */
  momentum: number;
  /** 0-100 — RVOL & akselerasi volume vs MA5 */
  volume: number;
  /** 0-100 — posisi close dalam range harian + ruang ke resistance */
  breakout: number;
  /** 0-100 — tier nilai transaksi (lebih besar = lebih aman untuk entry) */
  liquidity: number;
  /** Komposit tertimbang dari 4 dimensi di atas */
  composite: number;
  probability: 'HIGH' | 'MEDIUM' | 'LOW';
  /** True bila data stale memaksa probability turun ke LOW terlepas dari composite */
  freshnessCapped: boolean;
  reasons: string[];
  /** Selalu ditampilkan berdampingan dengan label probability. */
  disclaimer: string;
}

/**
 * Momentum/volume/breakout detection framework — bukan "ARA prediction".
 * News catalyst sengaja tidak diikutkan: preset ini dievaluasi per-ticker di
 * dalam scan massal screener (lihat ScreenerPage.tsx), fetch berita per
 * ticker di sana terlalu mahal untuk dilakukan di jalur itu.
 */
export function computeAraProbability(s: StockSummary, bars: OHLCVBar[]): AraProbabilityScore {
  const closes = bars.map((b) => b.close);
  const ema20 = lastValid(ema(closes, 20));
  const ema50 = lastValid(ema(closes, 50));
  const rvol = relativeVolume(bars, 20);
  const rsiLast = lastValid(rsi(bars, 14));
  const lastBar = bars[bars.length - 1];
  const volMa5 = lastValid(sma(bars.map((b) => b.volume), 5));
  const todayVsMa5 = !Number.isNaN(volMa5) && volMa5 > 0 ? s.volume / volMa5 : 1;

  const dayRange = lastBar ? lastBar.high - lastBar.low : 0;
  const closePos = dayRange > 0 && lastBar ? (s.lastClose - lastBar.low) / dayRange : 0;

  const prior20 = bars.slice(-21, -1);
  const high20 = prior20.length > 0 ? Math.max(...prior20.map((b) => b.high)) : s.lastClose;
  const resistancePct = high20 > s.lastClose ? ((high20 - s.lastClose) / s.lastClose) * 100 : 15;

  const reasons: string[] = [];

  // Momentum: sweet-spot naik 5–20% (puncak di 12.5%), dikonfirmasi trend EMA
  let momentum = Math.max(0, 100 - Math.abs(s.percentChange1D - 12.5) * 5);
  if (!Number.isNaN(ema20) && !Number.isNaN(ema50) && ema20 > ema50) {
    momentum = Math.min(100, momentum + 15);
    reasons.push('Trend EMA20 > EMA50 mengkonfirmasi momentum');
  } else {
    momentum = Math.max(0, momentum - 20);
  }
  if (!Number.isNaN(rsiLast) && rsiLast >= 80) {
    momentum = Math.max(0, momentum - 25);
    reasons.push(`RSI ${rsiLast.toFixed(1)} mendekati zona distribusi`);
  }
  momentum = Math.round(momentum);

  // Volume: RVOL + akselerasi volume vs MA5
  const rvolScore = Number.isNaN(rvol) ? 0 : Math.min(100, (rvol / 3) * 100);
  const accelScore = Math.min(100, (todayVsMa5 / 2) * 100);
  const volume = Math.round(rvolScore * 0.6 + accelScore * 0.4);
  if (!Number.isNaN(rvol) && rvol > 2) reasons.push(`RVOL ${rvol.toFixed(2)}x di atas rata-rata`);

  // Breakout: close dekat high hari ini + ruang ke resistance
  const closePosScore = Math.round(closePos * 100);
  const resistanceScore = Math.max(0, Math.min(100, resistancePct * 10));
  const breakout = Math.round(closePosScore * 0.6 + resistanceScore * 0.4);
  if (closePos >= 0.8) reasons.push(`Close di ${(closePos * 100).toFixed(0)}% range harian`);

  // Liquidity: tier nilai transaksi
  let liquidity = 30;
  if (s.value > 50_000_000_000) liquidity = 100;
  else if (s.value > 20_000_000_000) liquidity = 80;
  else if (s.value > 5_000_000_000) liquidity = 55;
  if (liquidity >= 80) reasons.push(`Nilai transaksi ${formatCompact(s.value)} — likuiditas memadai`);

  const composite = Math.round(momentum * 0.3 + volume * 0.3 + breakout * 0.25 + liquidity * 0.15);

  const freshness = computeDataFreshness(bars, new Date());
  const freshnessCapped = freshness?.tier === 'stale';

  let probability: 'HIGH' | 'MEDIUM' | 'LOW' = composite >= 80 ? 'HIGH' : composite >= 55 ? 'MEDIUM' : 'LOW';
  if (freshnessCapped && freshness) {
    probability = 'LOW';
    reasons.unshift(`Data terakhir ${freshness.ageInTradingDays} hari bursa lalu — probabilitas diturunkan otomatis`);
  }

  return {
    momentum,
    volume,
    breakout,
    liquidity,
    composite,
    probability,
    freshnessCapped: Boolean(freshnessCapped),
    reasons,
    disclaimer: 'Skor probabilitas momentum, bukan jaminan ARA. Selalu terapkan manajemen risiko.',
  };
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
  /** Set to false to skip the per-ticker OHLCV fetch entirely (preset only needs summary fields). Defaults to true. */
  needsHistory?: boolean;
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
    const result = verdict([
      [s.lastClose > 100, 'Harga > 100'],
      [s.percentChange1D > 10, 'Return 1 hari > 10%'],
      [s.volume > 20_000 * LOT_SIZE, 'Volume > 20.000 lot'],
      [!Number.isNaN(volMa5) && !Number.isNaN(volMa20) && volMa5 > volMa20, 'Volume MA5 > Volume MA20'],
    ]);
    return { ...result, freshness: computeDataFreshness(bars, new Date()) ?? undefined };
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
    const result = verdict([
      [!Number.isNaN(ma5) && s.lastClose > ma5, 'Harga > MA5'],
      [s.lastClose > s.prevClose * 1.05, 'Close > Prev Close x 1.05'],
      [!!lastBar && s.lastClose > lastBar.open, 'Close > Open'],
      [!!prevBar && s.volume > prevBar.volume * 1.2, 'Volume > 120% volume hari sebelumnya'],
      [s.value > 5_000_000_000, 'Nilai transaksi > Rp 5 miliar'],
    ]);
    return { ...result, freshness: computeDataFreshness(bars, new Date()) ?? undefined };
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

    const result = verdict([
      [!Number.isNaN(ema20) && !Number.isNaN(ema50) && ema20 > ema50, 'EMA20 > EMA50'],
      [!Number.isNaN(ema20) && s.lastClose > ema20, 'Close > EMA20'],
      [!Number.isNaN(macdLast) && !Number.isNaN(signalLast) && macdLast > signalLast, 'MACD bullish'],
      [!Number.isNaN(rsiLast) && rsiLast >= 55 && rsiLast <= 70, 'RSI antara 55-70'],
      [!Number.isNaN(rvol) && rvol > 2, 'RVOL > 2'],
      [s.value > 20_000_000_000, 'Nilai transaksi > Rp 20 miliar'],
    ]);
    return {
      ...result,
      relativeVolume: Number.isNaN(rvol) ? undefined : rvol,
      freshness: computeDataFreshness(bars, new Date()) ?? undefined,
    };
  },
};

// ── Breakout Hunter ───────────────────────────────────────────────────────────

function clamp(v: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, v));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
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

    return { passed, reasons, failed, breakoutScores: scores, freshness: computeDataFreshness(bars, new Date()) ?? undefined };
  },
};

// ── Trading Plan ──────────────────────────────────────────────────────────────
// Buy Area / Stop Loss / Targets / Risk-Reward below are derived from the exact
// same computeStockAnalysis() the ticker detail page uses for its "6. Rencana
// Trading" section, so the numbers shown in the screener list always match what
// the user sees after clicking through to /screener/[ticker].

function calcEmaTrendScore(price: number, ema20: number, ema50: number): number {
  if (Number.isNaN(ema20) || Number.isNaN(ema50)) return 50;
  if (price > ema20 && ema20 > ema50) return 100;
  if (price > ema20 && ema20 <= ema50) return 65;
  if (price <= ema20 && ema20 > ema50) return 45;
  return 20;
}

function calcSupportStrengthScore(price: number, nearestSupport: number | undefined): number {
  if (!nearestSupport) return 50;
  const distancePct = ((price - nearestSupport) / price) * 100;
  if (distancePct <= 3) return 100;
  if (distancePct <= 6) return 80;
  if (distancePct <= 10) return 60;
  if (distancePct <= 15) return 40;
  return 20;
}

function calcResistanceSpaceScore(price: number, nearestResistance: number | undefined): number {
  if (!nearestResistance) return 50;
  const upsidePct = ((nearestResistance - price) / price) * 100;
  if (upsidePct > 10) return 100;
  if (upsidePct > 7) return 85;
  if (upsidePct > 5) return 65;
  if (upsidePct > 3) return 45;
  if (upsidePct > 1.5) return 25;
  return 10;
}

function calcRvolScore(rvol: number): number {
  if (Number.isNaN(rvol)) return 30;
  if (rvol >= 3) return 100;
  if (rvol >= 2) return 85;
  if (rvol >= 1.5) return 65;
  if (rvol >= 1.2) return 45;
  if (rvol >= 1) return 25;
  return 10;
}

function calcStochasticScore(stochK: number): number {
  if (Number.isNaN(stochK)) return 30;
  if (stochK >= 40 && stochK <= 80) return 100;
  if (stochK < 40 && stochK >= 20) return 60;
  if (stochK < 20) return 50; // oversold — rebound potential
  if (stochK > 80 && stochK <= 90) return 40;
  return 15; // deeply overbought
}

function calcRsiScore(rsiLast: number): number {
  if (Number.isNaN(rsiLast)) return 30;
  if (rsiLast >= 55 && rsiLast <= 70) return 100;
  if ((rsiLast >= 50 && rsiLast < 55) || (rsiLast > 70 && rsiLast <= 75)) return 70;
  if (rsiLast < 50 && rsiLast >= 40) return 45;
  return 25;
}

function calcMomentum1WScore(percentChange1W: number): number {
  if (percentChange1W > 5) return 100;
  if (percentChange1W > 2) return 80;
  if (percentChange1W > 0) return 60;
  if (percentChange1W > -2) return 40;
  return 15;
}

export function computeTradingPlanScore(s: StockSummary, bars: OHLCVBar[]): TradingPlanScore {
  const price = s.lastClose;
  const analysis = computeStockAnalysis(s, bars);
  const { trendEma, supportResistance, volume, indicators, tradingPlan } = analysis;

  const nearestSupport = supportResistance.supports[0]?.price;
  const nearestResistance = supportResistance.resistances[0]?.price;
  const thirdResistance = supportResistance.resistances[2]?.price;

  const emaTrend = calcEmaTrendScore(price, trendEma.ema20, trendEma.ema50);
  const supportStrength = calcSupportStrengthScore(price, nearestSupport);
  const resistanceSpace = calcResistanceSpaceScore(price, nearestResistance);
  const volumeScore = calcVolumeExpansionScore(s, bars);
  const rvolScore = calcRvolScore(volume.relativeVolume);
  const stochasticScore = calcStochasticScore(indicators.stochK);
  const rsiScore = calcRsiScore(indicators.rsi14);
  const momentum1W = calcMomentum1WScore(s.percentChange1W);

  const score = clamp(
    emaTrend * 0.20 +
    supportStrength * 0.20 +
    resistanceSpace * 0.15 +
    volumeScore * 0.15 +
    rvolScore * 0.10 +
    stochasticScore * 0.10 +
    rsiScore * 0.05 +
    momentum1W * 0.05
  );

  let status: TradingPlanScore['status'];
  if (score >= 90) status = 'STRONG_BUY';
  else if (score >= 80) status = 'BUY';
  else if (score >= 70) status = 'WATCHLIST';
  else if (score >= 60) status = 'SPECULATIVE';
  else status = 'AVOID';

  const momentumStars = clamp(Math.round(((rsiScore * 0.4 + stochasticScore * 0.35 + emaTrend * 0.25) / 100) * 5), 1, 5);

  // Buy Area / Stop Loss / Targets / Risk-Reward: identical to the bullish scenario
  // shown in the detail page's "6. Rencana Trading" section (buildTradingPlan()),
  // so a stock's screener badge never contradicts its own detail page.
  const bullish = tradingPlan.bullish;
  const buyAreaLow = bullish.entry;
  const buyAreaHigh = round2(price * 1.002);
  const avgDown = bullish.avgDown ?? round2((bullish.entry + bullish.sl) / 2);
  const stopLoss = bullish.sl;
  const tp1 = bullish.tp1;
  const tp2 = bullish.tp2;
  const tp3 = round2(thirdResistance ?? tp2 * 1.05);
  const riskRewardRatio = bullish.riskRewardRatio;

  return {
    trend: trendEma.trend,
    momentumStars,
    buyAreaLow,
    buyAreaHigh,
    avgDown,
    stopLoss,
    tp1,
    tp2,
    tp3,
    riskRewardRatio,
    score: Math.round(score),
    confidencePct: Math.round(score),
    status,
    breakdown: {
      emaTrend: Math.round(emaTrend),
      supportStrength: Math.round(supportStrength),
      resistanceSpace: Math.round(resistanceSpace),
      volume: Math.round(volumeScore),
      rvol: Math.round(rvolScore),
      stochastic: Math.round(stochasticScore),
      rsi: Math.round(rsiScore),
      momentum1W: Math.round(momentum1W),
    },
  };
}

const tradingPlanPreset: ScreenerPreset = {
  id: 'tradingPlan',
  label: 'Trading Plan',
  description: 'Rencana beli-jual siap pakai: buy area, stop loss, target bertingkat, dan risk-reward — dihitung dari 8 faktor teknikal berbobot ("Opportunity Score").',
  criteria: [
    'EMA Trend 20% — struktur EMA20 vs EMA50',
    'Support Strength 20% — jarak ke support terdekat',
    'Resistance Space 15% — ruang naik ke resistance terdekat',
    'Volume 15% — akselerasi volume multi-hari',
    'RVOL 10% — volume relatif hari ini',
    'Stochastic 10% — posisi %K',
    'RSI 5% — zona RSI',
    'Momentum 1W 5% — perubahan harga 1 minggu',
    'Risk-Reward minimal 1:2 (di bawah itu otomatis tidak layak entry)',
    'Opportunity Score ≥ 60',
  ],
  coarseFilter: (s) => s.lastClose > 50 && s.value > 1_000_000_000,
  evaluate: (s, bars) => {
    const plan = computeTradingPlanScore(s, bars);
    const passed = plan.status !== 'AVOID' && plan.riskRewardRatio >= 2;

    const reasons: string[] = [];
    const failed: string[] = [];

    if (plan.score >= 70) reasons.push(`Opportunity Score ${plan.score}/100`);
    else failed.push(`Opportunity Score lemah (${plan.score}/100)`);

    if (plan.trend === 'bullish') reasons.push('Trend bullish — EMA20 > EMA50');
    else if (plan.trend === 'bearish') failed.push('Trend bearish — harga di bawah EMA20 & EMA50');
    else reasons.push('Trend sideways — tunggu konfirmasi arah');

    if (plan.breakdown.supportStrength >= 60) reasons.push(`Dekat support kuat (skor ${plan.breakdown.supportStrength}/100)`);
    else failed.push(`Jauh dari support (skor ${plan.breakdown.supportStrength}/100)`);

    if (plan.breakdown.resistanceSpace >= 45) reasons.push(`Ruang naik ke resistance cukup (skor ${plan.breakdown.resistanceSpace}/100)`);
    else failed.push(`Ruang naik terbatas (skor ${plan.breakdown.resistanceSpace}/100)`);

    if (plan.riskRewardRatio >= 2) reasons.push(`Risk-Reward 1:${plan.riskRewardRatio.toFixed(1)}`);
    else failed.push(`Risk-Reward kurang menarik (1:${plan.riskRewardRatio.toFixed(1)})`);

    reasons.push(`RVOL skor ${plan.breakdown.rvol}/100`);
    reasons.push(`Stochastic skor ${plan.breakdown.stochastic}/100`);
    reasons.push(`RSI skor ${plan.breakdown.rsi}/100`);
    reasons.push(`Momentum 1W skor ${plan.breakdown.momentum1W}/100`);

    return { passed, reasons, failed, tradingPlan: plan, freshness: computeDataFreshness(bars, new Date()) ?? undefined };
  },
};

// ── Swing Hunter ──────────────────────────────────────────────────────────────
// Target: 5–15% | Holding: 3–10 hari
// Filter: EMA20 > EMA50, ADX > 25, RSI 55–70, MACD Bullish, RVOL > 1.5, Nilai > 20 M

/** Wilder's Average True Range helper, used by ADX. */
function wilderATR(bars: OHLCVBar[], period: number): number[] {
  const trs: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    trs.push(Math.max(
      bars[i].high - bars[i].low,
      Math.abs(bars[i].high - bars[i - 1].close),
      Math.abs(bars[i].low - bars[i - 1].close)
    ));
  }
  if (trs.length < period) return [];
  const result: number[] = new Array(trs.length).fill(NaN);
  let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result[period - 1] = atr;
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
    result[i] = atr;
  }
  return result;
}

/** Approximate ADX(14) using Wilder's smoothing. Returns NaN when insufficient data. */
function calcADX(bars: OHLCVBar[], period = 14): number {
  if (bars.length < period * 2) return NaN;
  const dmPlus: number[] = [];
  const dmMinus: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const upMove = bars[i].high - bars[i - 1].high;
    const downMove = bars[i - 1].low - bars[i].low;
    dmPlus.push(upMove > downMove && upMove > 0 ? upMove : 0);
    dmMinus.push(downMove > upMove && downMove > 0 ? downMove : 0);
  }
  const atrArr = wilderATR(bars, period);
  if (atrArr.length < period) return NaN;

  // Wilder-smooth DM+, DM-
  let smDmPlus = dmPlus.slice(0, period).reduce((a, b) => a + b, 0);
  let smDmMinus = dmMinus.slice(0, period).reduce((a, b) => a + b, 0);

  const dxArr: number[] = [];
  for (let i = period; i < dmPlus.length; i++) {
    const atr = atrArr[i - 1];
    smDmPlus = smDmPlus - smDmPlus / period + dmPlus[i];
    smDmMinus = smDmMinus - smDmMinus / period + dmMinus[i];
    const diPlus = atr > 0 ? (smDmPlus / atr) * 100 : 0;
    const diMinus = atr > 0 ? (smDmMinus / atr) * 100 : 0;
    const dx = diPlus + diMinus > 0 ? (Math.abs(diPlus - diMinus) / (diPlus + diMinus)) * 100 : 0;
    dxArr.push(dx);
  }
  if (dxArr.length < period) return NaN;
  return dxArr.slice(-period).reduce((a, b) => a + b, 0) / period;
}

const swingHunterPreset: ScreenerPreset = {
  id: 'swingHunter',
  label: 'Swing Hunter',
  description: 'Mendeteksi setup swing trading berkualitas tinggi dengan probabilitas tertinggi untuk pengguna umum. Target 5–15% dalam 3–10 hari trading.',
  criteria: [
    'EMA20 > EMA50 — trend naik terkonfirmasi',
    'ADX > 25 — tren cukup kuat',
    'RSI 55–70 — momentum naik, belum overbought',
    'MACD Bullish — MACD Line > Signal Line',
    'RVOL > 1.5 — volume di atas rata-rata',
    'Nilai transaksi > Rp 20 miliar',
  ],
  coarseFilter: (s) => s.value > 20_000_000_000 && s.percentChange1D > -5,
  evaluate: (s, bars) => {
    const closes = bars.map((b) => b.close);
    const ema20 = lastValid(ema(closes, 20));
    const ema50 = lastValid(ema(closes, 50));
    const { macdLine, signalLine } = macd(bars);
    const macdLast = lastValid(macdLine);
    const signalLast = lastValid(signalLine);
    const rsiLast = lastValid(rsi(bars, 14));
    const rvol = relativeVolume(bars, 20);
    const adx = calcADX(bars, 14);

    const result = verdict([
      [!Number.isNaN(ema20) && !Number.isNaN(ema50) && ema20 > ema50, 'EMA20 > EMA50'],
      [!Number.isNaN(adx) && adx > 25, `ADX > 25 (${Number.isNaN(adx) ? 'N/A' : adx.toFixed(1)})`],
      [!Number.isNaN(rsiLast) && rsiLast >= 55 && rsiLast <= 70, `RSI 55–70 (${Number.isNaN(rsiLast) ? 'N/A' : rsiLast.toFixed(1)})`],
      [!Number.isNaN(macdLast) && !Number.isNaN(signalLast) && macdLast > signalLast, 'MACD Bullish'],
      [!Number.isNaN(rvol) && rvol > 1.5, `RVOL > 1.5 (${Number.isNaN(rvol) ? 'N/A' : rvol.toFixed(2)})`],
      [s.value > 20_000_000_000, 'Nilai transaksi > Rp 20 miliar'],
    ]);
    return {
      ...result,
      relativeVolume: Number.isNaN(rvol) ? undefined : rvol,
      freshness: computeDataFreshness(bars, new Date()) ?? undefined,
    };
  },
};

// ── ARA Hunter ────────────────────────────────────────────────────────────────
// Target: 10–25% | Holding: 1–3 hari
// Filter: naik 5-10% hari ini, belum ARA, EMA20 > EMA50, RVOL > 2,
//         close dekat high, volume meningkat, resistance masih jauh, nilai > 20 M

const araHunterPreset: ScreenerPreset = {
  id: 'araHunter',
  label: 'ARA Hunter',
  description: 'Mendeteksi momentum & probabilitas (bukan prediksi pasti) saham melanjutkan kenaikan menuju ARA. Skor 0-100 dari momentum, volume, breakout, dan likuiditas — otomatis diturunkan ke LOW bila data sudah tidak segar.',
  criteria: [
    'Momentum 30% — naik 5-20% sweet-spot, dikonfirmasi EMA20 > EMA50',
    'Volume 30% — RVOL & akselerasi volume vs MA5',
    'Breakout 25% — close dekat high hari ini + ruang ke resistance',
    'Liquidity 15% — tier nilai transaksi',
    'ARA Probability MEDIUM/HIGH (composite ≥ 55) — LOW otomatis tersaring',
    'Data freshness — probability dipaksa ke LOW bila data 3+ hari bursa lalu',
  ],
  coarseFilter: (s) =>
    s.percentChange1D >= 5 &&
    s.percentChange1D < 20 &&
    s.value > 20_000_000_000,
  evaluate: (s, bars) => {
    const araProbability = computeAraProbability(s, bars);
    const passed = araProbability.probability !== 'LOW';

    const reasons: string[] = [];
    const failed: string[] = [];

    if (araProbability.composite >= 55) reasons.push(`ARA Probability Score ${araProbability.composite}/100`);
    else failed.push(`ARA Probability Score lemah (${araProbability.composite}/100)`);

    if (araProbability.momentum >= 60) reasons.push(`Momentum ${araProbability.momentum}/100`);
    else failed.push(`Momentum lemah (${araProbability.momentum}/100)`);

    if (araProbability.volume >= 60) reasons.push(`Volume ${araProbability.volume}/100`);
    else failed.push(`Volume lemah (${araProbability.volume}/100)`);

    if (araProbability.breakout >= 60) reasons.push(`Breakout ${araProbability.breakout}/100`);
    else failed.push(`Breakout lemah (${araProbability.breakout}/100)`);

    reasons.push(`Liquidity ${araProbability.liquidity}/100`);
    if (araProbability.freshnessCapped) failed.push('Data stale — probability dipaksa LOW');

    return { passed, reasons, failed, araProbability, freshness: computeDataFreshness(bars, new Date()) ?? undefined };
  },
};

// ── Smart Money Hunter ────────────────────────────────────────────────────────
// Target: 5–15% | Holding: 5–20 hari
// Filter: harga sideways, EMA20 mulai naik, volume naik perlahan, RVOL > 1.3,
//         MACD baru golden cross, RSI 50–60, belum breakout besar

const smartMoneyHunterPreset: ScreenerPreset = {
  id: 'smartMoneyHunter',
  label: 'Early Accumulation',
  description: 'Mendeteksi pola teknikal awal akumulasi — harga masih sideways tapi EMA & volume mulai naik bertahap. Berbasis OHLCV saja, bukan data transaksi broker/institusi asli. Target 5–15% dalam 5–20 hari.',
  criteria: [
    'Harga sideways (range 20 hari < 15%)',
    'EMA20 mulai naik (EMA20 > EMA50 atau mendekati)',
    'Volume naik perlahan (MA5 volume > MA20 volume)',
    'RVOL > 1.3 — ada inflow bertahap',
    'MACD baru Golden Cross (histogram baru positif)',
    'RSI 50–60 — belum overbought',
    'Belum breakout besar (perubahan 1 hari < 5%)',
    'Nilai transaksi > Rp 5 miliar',
  ],
  coarseFilter: (s) =>
    s.value > 5_000_000_000 &&
    s.percentChange1D < 5 &&
    s.percentChange1D > -5,
  evaluate: (s, bars) => {
    const closes = bars.map((b) => b.close);
    const volumes = bars.map((b) => b.volume);
    const ema20 = lastValid(ema(closes, 20));
    const ema50 = lastValid(ema(closes, 50));
    const rsiLast = lastValid(rsi(bars, 14));
    const rvol = relativeVolume(bars, 20);
    const { histogram } = macd(bars);
    const histLast = lastValid(histogram);
    const prevHist = histogram[histogram.length - 2] ?? NaN;
    const volMa5 = lastValid(sma(volumes, 5));
    const volMa20 = lastValid(sma(volumes, 20));

    // Sideways: 20-day high-low range < 15%
    const last20 = bars.slice(-20);
    const high20 = last20.length > 0 ? Math.max(...last20.map((b) => b.high)) : s.lastClose;
    const low20 = last20.length > 0 ? Math.min(...last20.map((b) => b.low)) : s.lastClose;
    const rangePct = high20 > 0 ? ((high20 - low20) / high20) * 100 : 100;
    const isSideways = rangePct < 15;

    // EMA20 trending up: EMA20 >= EMA50 (or within 3% below)
    const emaUptrend =
      !Number.isNaN(ema20) && !Number.isNaN(ema50) &&
      (ema20 > ema50 || (ema50 > 0 && (ema50 - ema20) / ema50 < 0.03));

    // MACD Golden Cross: histogram just turned positive
    const macdGoldenCross =
      !Number.isNaN(histLast) && !Number.isNaN(prevHist) &&
      histLast > 0 && prevHist <= 0;

    // Volume rising gradually: MA5 > MA20
    const volumeRising =
      !Number.isNaN(volMa5) && !Number.isNaN(volMa20) && volMa5 > volMa20;

    const freshness = computeDataFreshness(bars, new Date());

    const result = verdict([
      [isSideways, `Harga sideways (range ${rangePct.toFixed(1)}%)`],
      [emaUptrend, 'EMA20 mulai naik (mendekati atau di atas EMA50)'],
      [volumeRising, 'Volume MA5 > MA20 — inflow bertahap'],
      [!Number.isNaN(rvol) && rvol > 1.3, `RVOL > 1.3 (${Number.isNaN(rvol) ? 'N/A' : rvol.toFixed(2)})`],
      [macdGoldenCross, 'MACD baru Golden Cross'],
      [!Number.isNaN(rsiLast) && rsiLast >= 50 && rsiLast <= 60, `RSI 50–60 (${Number.isNaN(rsiLast) ? 'N/A' : rsiLast.toFixed(1)})`],
      [Math.abs(s.percentChange1D) < 5, `Belum breakout besar (${s.percentChange1D.toFixed(1)}%)`],
      [s.value > 5_000_000_000, 'Nilai transaksi > Rp 5 miliar'],
      [freshness?.tier !== 'stale', freshness ? `Data segar (H-${freshness.ageInTradingDays})` : 'Data tidak tersedia'],
    ]);
    return { ...result, relativeVolume: Number.isNaN(rvol) ? undefined : rvol, freshness: freshness ?? undefined };
  },
};

// ── Day Trading ──────────────────────────────────────────────────────────────
// Target: 3–8% | Holding: 1–3 hari
// Timeframe: H1, H4 (disimulasikan dari data daily EOD)
// Buy ketika: EMA20 > EMA50, RSI 55–70, MACD Golden Cross, Volume meningkat

const dayTradingPreset: ScreenerPreset = {
  id: 'dayTrading',
  label: 'Day Trading',
  description: 'Setup day trading dengan konfirmasi multi-indikator. Target 3–8% dalam 1–3 hari. Gunakan pada timeframe H1/H4 untuk entry presisi.',
  criteria: [
    'EMA20 > EMA50 — trend intraday naik',
    'RSI 55–70 — momentum bullish, belum overbought',
    'MACD Golden Cross — histogram baru positif (momentum fresh)',
    'Volume meningkat — volume hari ini > rata-rata 5 hari',
    'Close > EMA20 — harga di atas tren jangka pendek',
    'Nilai transaksi > Rp 10 miliar (likuiditas cukup)',
  ],
  coarseFilter: (s) =>
    s.value > 10_000_000_000 &&
    s.percentChange1D > -3 &&
    s.percentChange1D < 10,
  evaluate: (s, bars) => {
    const closes = bars.map((b) => b.close);
    const volumes = bars.map((b) => b.volume);

    const ema20 = lastValid(ema(closes, 20));
    const ema50 = lastValid(ema(closes, 50));
    const rsiLast = lastValid(rsi(bars, 14));

    const { macdLine, signalLine, histogram } = macd(bars);
    const macdLast = lastValid(macdLine);
    const signalLast = lastValid(signalLine);
    const histLast = lastValid(histogram);
    const prevHist = histogram[histogram.length - 2] ?? NaN;

    // MACD Golden Cross: histogram baru berubah dari negatif/nol ke positif
    const macdGoldenCross =
      !Number.isNaN(histLast) && !Number.isNaN(prevHist) &&
      histLast > 0 && prevHist <= 0;
    // Atau setidaknya MACD bullish (MACD line > Signal line)
    const macdBullish =
      macdGoldenCross ||
      (!Number.isNaN(macdLast) && !Number.isNaN(signalLast) && macdLast > signalLast);

    // Volume meningkat: hari ini > rata-rata 5 hari terakhir
    const volMa5 = lastValid(sma(volumes, 5));
    const volIncreasing = !Number.isNaN(volMa5) && volMa5 > 0 && s.volume > volMa5;

    // RVOL approx: volume hari ini vs MA5 volume
    const rvolApprox = !Number.isNaN(volMa5) && volMa5 > 0 ? s.volume / volMa5 : NaN;
    const freshness = computeDataFreshness(bars, new Date());

    const result = verdict([
      [!Number.isNaN(ema20) && !Number.isNaN(ema50) && ema20 > ema50, 'EMA20 > EMA50'],
      [!Number.isNaN(ema20) && s.lastClose > ema20, `Close > EMA20 (${Number.isNaN(ema20) ? 'N/A' : ema20.toFixed(0)})`],
      [!Number.isNaN(rsiLast) && rsiLast >= 55 && rsiLast <= 70, `RSI 55–70 (${Number.isNaN(rsiLast) ? 'N/A' : rsiLast.toFixed(1)})`],
      [macdBullish, macdGoldenCross ? 'MACD Golden Cross ✓' : 'MACD Bullish (MACD > Signal)'],
      [volIncreasing, `Volume meningkat (${Number.isNaN(volMa5) ? 'N/A' : (s.volume / volMa5).toFixed(2)}x MA5)`],
      [s.value > 10_000_000_000, 'Nilai transaksi > Rp 10 miliar'],
      [freshness?.tier !== 'stale', freshness ? `Data segar (H-${freshness.ageInTradingDays})` : 'Data tidak tersedia'],
    ]);
    return { ...result, relativeVolume: Number.isNaN(rvolApprox) ? undefined : rvolApprox, freshness: freshness ?? undefined };
  },
};

// ── Fundamental ───────────────────────────────────────────────────────────────
// Menilai kualitas bisnis (profitabilitas) + kewajaran harga (valuasi), bukan
// hanya "PER murah = bagus". Data fundamental yang tersedia di sumber data ini
// (ringkasan Pasardana) hanya ROE, PER, PBV, free float, dan kapitalisasi —
// TIDAK ada data pertumbuhan EPS/revenue, laporan arus kas, atau rasio utang
// (DER/interest coverage), jadi skor "Growth", "Cash Flow", "Balance Sheet",
// dan "Dividend" dari kerangka fundamental yang lebih lengkap sengaja tidak
// dibuat di sini — lebih baik tidak menampilkan skor daripada menampilkan
// angka yang direka-reka. Preset ini tidak butuh OHLCV sama sekali
// (needsHistory: false) karena seluruh input sudah ada di StockSummary.

export interface FundamentalScore {
  /** 0-100 — dari ROE: seberapa efisien perusahaan menghasilkan laba dari modal */
  profitability: number;
  /** 0-100 — dari PER & PBV: seberapa wajar harga saat ini */
  valuation: number;
  /** 0-100 — dari free float & nilai transaksi: proxy keandalan harga/rasio (saham tipis rawan distorsi) */
  qualityGate: number;
  /** Komposit tertimbang: Profitability 50% + Valuation 35% + Quality Gate 15% */
  composite: number;
  status: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'WEAK';
}

function calcProfitabilityScore(roe: number): number {
  if (roe >= 20) return 100;
  if (roe >= 15) return 80;
  if (roe >= 10) return 60;
  if (roe >= 5) return 35;
  if (roe > 0) return 15;
  return 0;
}

function calcValuationScore(per: number, pbv: number): number {
  let perScore: number;
  if (per <= 0) perScore = 20; // rugi atau data tidak valid — skeptis, bukan otomatis nol
  else if (per <= 8) perScore = 100;
  else if (per <= 12) perScore = 85;
  else if (per <= 18) perScore = 65;
  else if (per <= 25) perScore = 45;
  else if (per <= 35) perScore = 25;
  else perScore = 10;

  let pbvScore: number;
  if (pbv <= 0) pbvScore = 30;
  else if (pbv <= 1) pbvScore = 100;
  else if (pbv <= 2) pbvScore = 80;
  else if (pbv <= 3) pbvScore = 60;
  else if (pbv <= 5) pbvScore = 35;
  else pbvScore = 15;

  return Math.round((perScore + pbvScore) / 2);
}

function calcFundamentalQualityGate(s: StockSummary): number {
  let freeFloatScore: number;
  if (s.freeFloat >= 30) freeFloatScore = 100;
  else if (s.freeFloat >= 15) freeFloatScore = 70;
  else if (s.freeFloat >= 7.5) freeFloatScore = 40;
  else freeFloatScore = 15;

  let liquidityScore: number;
  if (s.value >= 20_000_000_000) liquidityScore = 100;
  else if (s.value >= 5_000_000_000) liquidityScore = 70;
  else if (s.value >= 1_000_000_000) liquidityScore = 40;
  else liquidityScore = 15;

  return Math.round((freeFloatScore + liquidityScore) / 2);
}

export function computeFundamentalScore(s: StockSummary): FundamentalScore {
  const profitability = calcProfitabilityScore(s.roe);
  const valuation = calcValuationScore(s.per, s.pbv);
  const qualityGate = calcFundamentalQualityGate(s);

  const composite = clamp(profitability * 0.5 + valuation * 0.35 + qualityGate * 0.15);

  let status: FundamentalScore['status'];
  if (composite >= 80) status = 'EXCELLENT';
  else if (composite >= 65) status = 'GOOD';
  else if (composite >= 50) status = 'FAIR';
  else status = 'WEAK';

  return {
    profitability: Math.round(profitability),
    valuation: Math.round(valuation),
    qualityGate: Math.round(qualityGate),
    composite: Math.round(composite),
    status,
  };
}

const fundamentalPreset: ScreenerPreset = {
  id: 'fundamental',
  label: 'Fundamental',
  description: 'Saham dengan bisnis menguntungkan (ROE) dan harga yang belum terlalu mahal (PER & PBV). Skor berbasis data ringkasan saja — tidak ada data pertumbuhan laba, arus kas, atau rasio utang di sumber data ini, jadi skor ini adalah pandangan sebagian (Profitability + Valuation), bukan analisis fundamental lengkap.',
  criteria: [
    'Profitability 50% — ROE (Return on Equity)',
    'Valuation 35% — PER & PBV (lebih rendah = lebih menarik)',
    'Quality Gate 15% — free float & nilai transaksi (proxy keandalan harga)',
    'ROE > 0 — perusahaan harus profitable',
    'PER > 0 — mengeluarkan saham rugi (PER negatif)',
    'Fundamental Score ≥ 55',
    '⚠️ Belum mencakup pertumbuhan EPS/revenue, arus kas, dan rasio utang — data tidak tersedia di sumber ini',
  ],
  needsHistory: false,
  coarseFilter: (s) => s.roe > 0 && s.per > 0,
  evaluate: (s) => {
    const fundamentalScore = computeFundamentalScore(s);
    const passed = fundamentalScore.composite >= 55 && s.roe > 0 && s.per > 0;

    const reasons: string[] = [];
    const failed: string[] = [];

    if (fundamentalScore.composite >= 55) reasons.push(`Fundamental Score ${fundamentalScore.composite}/100`);
    else failed.push(`Fundamental Score lemah (${fundamentalScore.composite}/100)`);

    if (fundamentalScore.profitability >= 60) reasons.push(`ROE ${s.roe.toFixed(1)}% — profitabilitas kuat`);
    else if (s.roe > 0) failed.push(`ROE ${s.roe.toFixed(1)}% — profitabilitas lemah`);
    else failed.push('ROE negatif — perusahaan merugi');

    if (fundamentalScore.valuation >= 60) reasons.push(`Valuasi menarik (PER ${s.per.toFixed(1)}x, PBV ${s.pbv.toFixed(1)}x)`);
    else failed.push(`Valuasi kurang menarik (PER ${s.per.toFixed(1)}x, PBV ${s.pbv.toFixed(1)}x)`);

    if (fundamentalScore.qualityGate >= 55) reasons.push(`Free float & likuiditas memadai`);
    else failed.push(`Free float/likuiditas rendah — harga rawan distorsi`);

    return { passed, reasons, failed, fundamentalScore };
  },
};

// ── Registry ──────────────────────────────────────────────────────────────────

export const SCREENER_PRESETS: Record<ScreenerPresetId, ScreenerPreset> = {
  ara: araPreset,
  bpjs: bpjsPreset,
  momentum: momentumPreset,
  breakout: breakoutPreset,
  tradingPlan: tradingPlanPreset,
  swingHunter: swingHunterPreset,
  araHunter: araHunterPreset,
  smartMoneyHunter: smartMoneyHunterPreset,
  dayTrading: dayTradingPreset,
  fundamental: fundamentalPreset,
};

export const SCREENER_PRESET_LIST: ScreenerPreset[] = [
  araPreset,
  bpjsPreset,
  momentumPreset,
  breakoutPreset,
  tradingPlanPreset,
  swingHunterPreset,
  araHunterPreset,
  smartMoneyHunterPreset,
  dayTradingPreset,
  fundamentalPreset,
];
