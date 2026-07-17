/**
 * stockAnalysisEngine.ts
 *
 * Derives a full StockAnalysis (7 aspects) from OHLCV bars + StockSummary.
 * All computation is deterministic, runs client-side, no network calls.
 */

import { OHLCVBar } from '@/domain/models/History';
import { StockSummary } from '@/domain/models/Stock';
import {
  CandlePattern,
  ConclusionAnalysis,
  IndicatorAnalysis,
  MacdSignal,
  PriceActionAnalysis,
  PriceLevel,
  RsiZone,
  StockAnalysis,
  StochZone,
  SupportResistanceAnalysis,
  Trend,
  TradingPlanAnalysis,
  TrendEmaAnalysis,
  VolumeAnalysis,
} from '@/domain/models/StockAnalysis';
import { ema, lastValid, sma } from '@/domain/indicators/movingAverages';
import { macd } from '@/domain/indicators/macd';
import { rsi } from '@/domain/indicators/rsi';

// ─── helpers ──────────────────────────────────────────────────────────────────
function closes(bars: OHLCVBar[]): number[] {
  return bars.map((b) => b.close);
}

function highs(bars: OHLCVBar[]): number[] {
  return bars.map((b) => b.high);
}

function lows(bars: OHLCVBar[]): number[] {
  return bars.map((b) => b.low);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Stochastic Oscillator %K/%D (fast) */
function stochastic(
  bars: OHLCVBar[],
  kPeriod = 14,
  dPeriod = 3
): { k: number[]; d: number[] } {
  const k: number[] = new Array(bars.length).fill(NaN);
  for (let i = kPeriod - 1; i < bars.length; i++) {
    const slice = bars.slice(i - kPeriod + 1, i + 1);
    const lowest = Math.min(...slice.map((b) => b.low));
    const highest = Math.max(...slice.map((b) => b.high));
    k[i] = highest === lowest ? 50 : ((bars[i].close - lowest) / (highest - lowest)) * 100;
  }
  const d = sma(k.map((v) => (Number.isNaN(v) ? 0 : v)), dPeriod);
  return { k, d };
}

/** Find local pivot highs/lows (simplified swing detection) */
function swingHighs(bars: OHLCVBar[], lookback = 5): number[] {
  const result: number[] = [];
  for (let i = lookback; i < bars.length - lookback; i++) {
    const slice = bars.slice(i - lookback, i + lookback + 1);
    const maxH = Math.max(...slice.map((b) => b.high));
    if (bars[i].high === maxH) result.push(bars[i].high);
  }
  return result;
}

function swingLows(bars: OHLCVBar[], lookback = 5): number[] {
  const result: number[] = [];
  for (let i = lookback; i < bars.length - lookback; i++) {
    const slice = bars.slice(i - lookback, i + lookback + 1);
    const minL = Math.min(...slice.map((b) => b.low));
    if (bars[i].low === minL) result.push(bars[i].low);
  }
  return result;
}

/** Cluster nearby price levels within a tolerance band */
function clusterLevels(levels: number[], tolerance = 0.015): number[] {
  if (levels.length === 0) return [];
  const sorted = [...levels].sort((a, b) => a - b);
  const clusters: number[] = [];
  let group: number[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    if ((sorted[i] - sorted[i - 1]) / sorted[i - 1] < tolerance) {
      group.push(sorted[i]);
    } else {
      clusters.push(group.reduce((a, b) => a + b, 0) / group.length);
      group = [sorted[i]];
    }
  }
  clusters.push(group.reduce((a, b) => a + b, 0) / group.length);
  return clusters;
}

// ─── 1. Trend & EMA ──────────────────────────────────────────────────────────
function analyzeTrendEma(bars: OHLCVBar[], summary: StockSummary): TrendEmaAnalysis {
  const cls = closes(bars);
  const ema20Series = ema(cls, 20);
  const ema50Series = ema(cls, 50);
  const ema200Series = ema(cls, 200);

  const ema20 = round2(lastValid(ema20Series));
  const ema50 = round2(lastValid(ema50Series));
  const ema200 = round2(lastValid(ema200Series));
  const price = summary.lastClose;

  const EPS = price * 0.002;
  const priceVsEma20 =
    Math.abs(price - ema20) < EPS ? 'at' : price > ema20 ? 'above' : 'below';
  const priceVsEma50 =
    Math.abs(price - ema50) < EPS ? 'at' : price > ema50 ? 'above' : 'below';

  // Trend classification
  let trend: Trend;
  let trendDescription: string;
  if (price > ema20 && ema20 > ema50) {
    trend = 'bullish';
    trendDescription = 'Tren naik — harga di atas EMA20 & EMA50, EMA20 memotong ke atas EMA50.';
  } else if (price < ema20 && ema20 < ema50) {
    trend = 'bearish';
    trendDescription = 'Tren turun — harga di bawah EMA20 & EMA50, EMA20 bergerak ke bawah EMA50.';
  } else if (price > ema20 && ema20 < ema50) {
    trend = 'sideways';
    trendDescription = 'Potensi pembalikan — harga di atas EMA20 namun EMA20 masih di bawah EMA50.';
  } else if (price > ema20 && ema20 > ema50) {
    trend = 'bullish';
    trendDescription = 'Tren naik — struktur EMA bullish.';
  } else {
    trend = 'sideways';
    trendDescription = 'Tren sideways/konsolidasi — EMA belum memberikan sinyal yang jelas.';
  }

  // Higher low detection (last 3 swing lows)
  const sl = swingLows(bars, 5);
  const last3 = sl.slice(-3);
  const higherLows =
    last3.length === 3 &&
    last3[1] > last3[0] &&
    last3[2] > last3[1];

  return { ema20, ema50, ema200, priceVsEma20, priceVsEma50, trend, trendDescription, higherLows };
}

// ─── 2. Support & Resistance ──────────────────────────────────────────────────
function analyzeSupportResistance(
  bars: OHLCVBar[],
  summary: StockSummary
): SupportResistanceAnalysis {
  const price = summary.lastClose;
  const sh = clusterLevels(swingHighs(bars, 5));
  const sl = clusterLevels(swingLows(bars, 5));

  // annual high/low as extra levels
  const annualHigh = summary.annualHigh;
  const annualLow = summary.annualLow;

  const resistancePrices = [...sh, annualHigh]
    .filter((p) => p > price * 1.005)
    .sort((a, b) => a - b)
    .slice(0, 4);

  const supportPrices = [...sl, annualLow]
    .filter((p) => p < price * 0.995)
    .sort((a, b) => b - a)
    .slice(0, 4);

  const labels = ['R1', 'R2', 'R3', 'R4'];
  const supportLabels = ['S1', 'S2', 'S3', 'S4'];
  const rDesc = ['Resistance terdekat', 'Resistance menengah', 'Resistance berikutnya', 'Target tinggi'];
  const sDesc = ['Support kuat', 'Support menengah', 'Support psikologis', 'Support jauh'];

  const resistances: PriceLevel[] = resistancePrices.map((p, i) => ({
    price: round2(p),
    label: labels[i],
    description: rDesc[i] ?? 'Resistance',
  }));

  const supports: PriceLevel[] = supportPrices.map((p, i) => ({
    price: round2(p),
    label: supportLabels[i],
    description: sDesc[i] ?? 'Support',
  }));

  return { resistances, supports };
}

// ─── 3. Price Action ──────────────────────────────────────────────────────────
function detectCandlePattern(bar: OHLCVBar, prevBar: OHLCVBar): { pattern: CandlePattern; label: string } {
  const body = Math.abs(bar.close - bar.open);
  const range = bar.high - bar.low;
  if (range === 0) return { pattern: 'none', label: 'Tidak jelas' };

  const upperWick = bar.high - Math.max(bar.open, bar.close);
  const lowerWick = Math.min(bar.open, bar.close) - bar.low;
  const bodyRatio = body / range;

  // Doji
  if (bodyRatio < 0.1) return { pattern: 'doji', label: 'Doji (ketidakpastian)' };

  // Marubozu
  if (bodyRatio > 0.85) {
    if (bar.close > bar.open)
      return { pattern: 'marubozu_bullish', label: 'Marubozu Bullish (kekuatan beli)' };
    return { pattern: 'marubozu_bearish', label: 'Marubozu Bearish (tekanan jual)' };
  }

  // Hammer / Shooting Star
  if (lowerWick > body * 2 && upperWick < body * 0.5)
    return { pattern: 'hammer', label: 'Hammer (potensi reversal naik)' };
  if (upperWick > body * 2 && lowerWick < body * 0.5)
    return { pattern: 'shooting_star', label: 'Shooting Star (potensi reversal turun)' };

  // Engulfing
  if (
    bar.close > bar.open &&
    prevBar.close < prevBar.open &&
    bar.close > prevBar.open &&
    bar.open < prevBar.close
  )
    return { pattern: 'bullish_engulfing', label: 'Bullish Engulfing (sinyal pembalikan naik)' };

  if (
    bar.close < bar.open &&
    prevBar.close > prevBar.open &&
    bar.close < prevBar.open &&
    bar.open > prevBar.close
  )
    return { pattern: 'bearish_engulfing', label: 'Bearish Engulfing (sinyal pembalikan turun)' };

  return { pattern: 'none', label: 'Candle normal' };
}

function analyzePriceAction(
  bars: OHLCVBar[],
  summary: StockSummary,
  trendEma: TrendEmaAnalysis
): PriceActionAnalysis {
  const lastBar = bars[bars.length - 1];
  const prevBar = bars[bars.length - 2] ?? lastBar;

  const lastCandleColor =
    Math.abs(lastBar.close - lastBar.open) / (lastBar.high - lastBar.low || 1) < 0.1
      ? 'doji'
      : lastBar.close >= lastBar.open
      ? 'green'
      : 'red';

  const { pattern, label: patternLabel } = detectCandlePattern(lastBar, prevBar);
  const aboveEma20 = trendEma.priceVsEma20 === 'above' || trendEma.priceVsEma20 === 'at';
  const aboveEma50 = trendEma.priceVsEma50 === 'above' || trendEma.priceVsEma50 === 'at';

  const notes: string[] = [];
  const pct = summary.percentChange1D;
  notes.push(`Candle hari ini ${lastCandleColor === 'green' ? 'hijau' : lastCandleColor === 'red' ? 'merah' : 'doji'} (${pct > 0 ? '+' : ''}${pct.toFixed(2)}%).`);
  if (aboveEma20 && aboveEma50)
    notes.push('Harga bertahan di atas EMA20 dan EMA50.');
  else if (aboveEma20)
    notes.push('Harga di atas EMA20 namun masih di bawah EMA50.');
  else
    notes.push('Harga di bawah EMA20, waspadai tekanan jual.');

  const canContinueUp = lastCandleColor === 'green' && aboveEma20;
  if (canContinueUp)
    notes.push('Ada potensi melanjutkan kenaikan jika volume mendukung.');
  else if (!canContinueUp && lastCandleColor === 'green')
    notes.push('Pantau apakah EMA20 bisa menjadi support dinamis.');
  else
    notes.push('Jika gagal rebound, berpotensi konsolidasi lebih lanjut.');

  return { lastCandleColor, pattern, patternLabel, aboveEma20, aboveEma50, canContinueUp, notes };
}

// ─── 4. Volume ────────────────────────────────────────────────────────────────
function analyzeVolume(bars: OHLCVBar[], summary: StockSummary): VolumeAnalysis {
  const volumes = bars.map((b) => b.volume);
  const volumeMa20 = round2(lastValid(sma(volumes, 20)));
  const lastVolume = summary.volume;
  const relVol = volumeMa20 > 0 ? round2(lastVolume / volumeMa20) : NaN;

  const isHighVolume = relVol >= 1.5;
  const idealBreakoutVolume = round2(volumeMa20 * 1.3);

  // Simple trend: compare last 5 avg vs prior 5
  const last5 = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5;
  const prior5 = volumes.slice(-10, -5).reduce((a, b) => a + b, 0) / 5;
  const volumeTrend =
    last5 > prior5 * 1.1 ? 'increasing' : last5 < prior5 * 0.9 ? 'decreasing' : 'normal';

  const notes: string[] = [];
  notes.push(`Volume hari ini ${new Intl.NumberFormat('id-ID').format(lastVolume)} (RVOL ${Number.isNaN(relVol) ? '–' : relVol.toFixed(2)}×).`);
  notes.push(`Volume MA20: ${new Intl.NumberFormat('id-ID').format(Math.round(volumeMa20))}.`);
  if (isHighVolume) notes.push('Volume di atas rata-rata — konfirmasi pergerakan kuat.');
  else notes.push(`Butuh volume > ${new Intl.NumberFormat('id-ID').format(Math.round(idealBreakoutVolume))} untuk konfirmasi breakout.`);

  return { lastVolume, volumeMa20, relativeVolume: relVol, volumeTrend, isHighVolume, idealBreakoutVolume, notes };
}

// ─── 5. Indikator ─────────────────────────────────────────────────────────────
function analyzeIndicators(bars: OHLCVBar[]): IndicatorAnalysis {
  const rsiSeries = rsi(bars, 14);
  const rsi14 = round2(lastValid(rsiSeries));

  let rsiZone: RsiZone;
  let rsiNote: string;
  if (rsi14 < 30) { rsiZone = 'oversold'; rsiNote = 'RSI oversold — potensi rebound / reversal naik.'; }
  else if (rsi14 < 55) { rsiZone = 'neutral'; rsiNote = 'RSI di zona netral, belum ada momentum kuat.'; }
  else if (rsi14 <= 70) { rsiZone = 'bullish_zone'; rsiNote = 'RSI di zona bullish — momentum naik cukup sehat.'; }
  else if (rsi14 <= 80) { rsiZone = 'overbought_risk'; rsiNote = 'RSI mulai overbought — potensi profit taking / konsolidasi.'; }
  else { rsiZone = 'overbought'; rsiNote = 'RSI sangat overbought — risiko koreksi tinggi.'; }

  const { macdLine, signalLine, histogram } = macd(bars);
  const macdValue = round2(lastValid(macdLine));
  const macdSignalVal = round2(lastValid(signalLine));
  const macdHist = round2(lastValid(histogram));

  const prevHist = histogram[histogram.length - 2];
  let macdSignalType: MacdSignal;
  let macdNote: string;

  if (macdHist > 0 && !Number.isNaN(prevHist) && prevHist <= 0) {
    macdSignalType = 'bullish_crossover'; macdNote = 'MACD golden cross — sinyal beli baru.';
  } else if (macdHist < 0 && !Number.isNaN(prevHist) && prevHist >= 0) {
    macdSignalType = 'bearish_crossover'; macdNote = 'MACD death cross — sinyal jual baru.';
  } else if (macdValue > macdSignalVal) {
    macdSignalType = 'bullish'; macdNote = 'MACD bullish — di atas signal line.';
  } else if (macdValue < macdSignalVal) {
    macdSignalType = 'bearish'; macdNote = 'MACD bearish — di bawah signal line.';
  } else {
    macdSignalType = 'neutral'; macdNote = 'MACD netral.';
  }

  const { k, d } = stochastic(bars, 14, 3);
  const stochK = round2(lastValid(k));
  const stochD = round2(lastValid(d));

  let stochZone: StochZone;
  let stochNote: string;
  if (stochK < 20) { stochZone = 'oversold'; stochNote = 'Stochastic oversold — potensi reversal naik jangka pendek.'; }
  else if (stochK > 80) { stochZone = 'overbought'; stochNote = 'Stochastic overbought — potensi jeda/koreksi jangka pendek.'; }
  else { stochZone = 'neutral'; stochNote = `Stochastic %K ${stochK.toFixed(1)} di zona netral.`; }

  return {
    rsi14, rsiZone, rsiNote,
    macdValue, macdSignal: macdSignalVal, macdHistogram: macdHist, macdSignalType, macdNote,
    stochK, stochD, stochZone, stochNote,
  };
}

// ─── 6. Rencana Trading ───────────────────────────────────────────────────────
function buildTradingPlan(
  summary: StockSummary,
  sr: SupportResistanceAnalysis,
  trend: Trend
): TradingPlanAnalysis {
  const price = summary.lastClose;

  const r1 = sr.resistances[0]?.price ?? round2(price * 1.03);
  const r2 = sr.resistances[1]?.price ?? round2(price * 1.06);
  const s1 = sr.supports[0]?.price ?? round2(price * 0.97);
  const s2 = sr.supports[1]?.price ?? round2(price * 0.94);

  // Bullish scenario
  const bullEntry = round2(price * 0.995); // small pullback
  const bullSl = round2(s1 * 0.995);
  const bullTp1 = r1;
  const bullTp2 = r2;
  const bullRR = round2((bullTp1 - bullEntry) / Math.max(bullEntry - bullSl, 1));

  // Bearish scenario
  const bearEntry = round2(r1 * 1.001);
  const bearSl = round2(r1 * 1.015);
  const bearTp1 = round2(price * 0.99);
  const bearTp2 = s1;
  const bearRR = round2((bearEntry - bearTp1) / Math.max(bearSl - bearEntry, 1));

  const recommendedBias: 'bullish' | 'bearish' | 'neutral' =
    trend === 'bullish' ? 'bullish' : trend === 'bearish' ? 'bearish' : 'neutral';

  return {
    bullish: {
      entry: bullEntry, tp1: bullTp1, tp2: bullTp2, sl: bullSl,
      riskRewardRatio: bullRR,
      notes: `Entry buy saat pullback ke area ${bullEntry.toLocaleString('id-ID')} – ${round2(price * 1.002).toLocaleString('id-ID')}. Konfirmasi: volume > MA20.`,
    },
    bearish: {
      entry: bearEntry, tp1: bearTp1, tp2: bearTp2, sl: bearSl,
      riskRewardRatio: bearRR,
      notes: `Jika gagal break resistance ${r1.toLocaleString('id-ID')}, entry sell/short di ${bearEntry.toLocaleString('id-ID')}.`,
    },
    recommendedBias,
  };
}

// ─── 7. Kesimpulan ────────────────────────────────────────────────────────────
function buildConclusion(
  summary: StockSummary,
  trendEma: TrendEmaAnalysis,
  sr: SupportResistanceAnalysis,
  priceAction: PriceActionAnalysis,
  indicators: IndicatorAnalysis
): ConclusionAnalysis {
  const price = summary.lastClose;
  const pct = summary.percentChange1D;
  const r1 = sr.resistances[0]?.price;
  const s1 = sr.supports[0]?.price;

  const overallBias = trendEma.trend;

  const summary_str =
    `${summary.ticker} ${pct >= 0 ? 'naik' : 'turun'} ${Math.abs(pct).toFixed(2)}% hari ini dan close di ${price.toLocaleString('id-ID')}. ` +
    `Harga ${trendEma.priceVsEma20 === 'above' ? 'berada di atas' : 'masih di bawah'} EMA20, ` +
    `${trendEma.priceVsEma50 === 'above' ? 'dan di atas EMA50' : 'dan di bawah EMA50'}. ` +
    `${trendEma.trendDescription}`;

  const keyLevel = r1
    ? `Kunci utama ada di area ${r1.toLocaleString('id-ID')}${sr.resistances[1] ? ` – ${sr.resistances[1].price.toLocaleString('id-ID')}` : ''}, jika berhasil dikonfirmasi volume, peluang naik ke ${sr.resistances[1]?.price?.toLocaleString('id-ID') ?? 'target berikutnya'} terbuka.`
    : 'Pantau level kunci pada candle berikutnya.';

  const watchOut = s1
    ? `Waspadai jika harga gagal bertahan di atas ${s1.toLocaleString('id-ID')} — potensi tekanan jual lebih lanjut.`
    : indicators.rsiZone === 'overbought' || indicators.rsiZone === 'overbought_risk'
    ? 'Waspadai koreksi karena RSI mulai overbought.'
    : 'Tetap disiplin manajemen risiko, pantau perkembangan volume.';

  return { overallBias, summary: summary_str, keyLevel, watchOut };
}

// ─── Public API ───────────────────────────────────────────────────────────────
export function computeStockAnalysis(
  summary: StockSummary,
  bars: OHLCVBar[]
): StockAnalysis {
  if (bars.length < 20) {
    // Insufficient data — return minimal structure
    const empty = {
      ema20: NaN, ema50: NaN, ema200: NaN,
      priceVsEma20: 'at' as const, priceVsEma50: 'at' as const,
      trend: 'sideways' as const,
      trendDescription: 'Data terbatas, analisis tidak tersedia.',
      higherLows: false,
    };
    const noLevels = { resistances: [], supports: [] };
    const noPA: PriceActionAnalysis = {
      lastCandleColor: 'doji', pattern: 'none', patternLabel: '–',
      aboveEma20: false, aboveEma50: false, canContinueUp: false, notes: ['Data tidak cukup.'],
    };
    const noVol: VolumeAnalysis = {
      lastVolume: summary.volume, volumeMa20: NaN, relativeVolume: NaN,
      volumeTrend: 'normal', isHighVolume: false, idealBreakoutVolume: NaN, notes: ['Data tidak cukup.'],
    };
    const noInd: IndicatorAnalysis = {
      rsi14: NaN, rsiZone: 'neutral', rsiNote: '–',
      macdValue: NaN, macdSignal: NaN, macdHistogram: NaN, macdSignalType: 'neutral', macdNote: '–',
      stochK: NaN, stochD: NaN, stochZone: 'neutral', stochNote: '–',
    };
    const noTrade: TradingPlanAnalysis = {
      bullish: { entry: 0, tp1: 0, tp2: 0, sl: 0, riskRewardRatio: 0, notes: '–' },
      bearish: { entry: 0, tp1: 0, tp2: 0, sl: 0, riskRewardRatio: 0, notes: '–' },
      recommendedBias: 'neutral',
    };
    const noConc: ConclusionAnalysis = {
      overallBias: 'sideways', summary: 'Data tidak cukup untuk analisis.', keyLevel: '–', watchOut: '–',
    };
    return {
      ticker: summary.ticker, generatedAt: new Date(),
      trendEma: empty, supportResistance: noLevels, priceAction: noPA,
      volume: noVol, indicators: noInd, tradingPlan: noTrade, conclusion: noConc,
    };
  }

  const trendEma = analyzeTrendEma(bars, summary);
  const supportResistance = analyzeSupportResistance(bars, summary);
  const priceAction = analyzePriceAction(bars, summary, trendEma);
  const volume = analyzeVolume(bars, summary);
  const indicators = analyzeIndicators(bars);
  const tradingPlan = buildTradingPlan(summary, supportResistance, trendEma.trend);
  const conclusion = buildConclusion(summary, trendEma, supportResistance, priceAction, indicators);

  return {
    ticker: summary.ticker,
    generatedAt: new Date(),
    trendEma,
    supportResistance,
    priceAction,
    volume,
    indicators,
    tradingPlan,
    conclusion,
  };
}
