/**
 * technicalScore.ts
 *
 * Pure scoring function for the "7-Confirmation" technical checklist
 * (EMA200/50/9-21 stack, RSI14, MACD, Volume). Derived from TrendEmaAnalysis /
 * IndicatorAnalysis / VolumeAnalysis (see stockAnalysisEngine.ts), so it can be
 * reused anywhere those are already computed (analysis page, screener, etc.)
 * without recomputing indicators from raw bars.
 */

import { IndicatorAnalysis, TrendEmaAnalysis, VolumeAnalysis } from '@/domain/models/StockAnalysis';

export interface TechnicalScoreFactor {
  key: 'ema200' | 'ema50' | 'emaFast' | 'rsi' | 'macd' | 'volume';
  label: string;
  detail: string;
  score: number;
  max: number;
}

export type TechnicalScoreTone = 'green' | 'amber' | 'red';

export interface TechnicalScoreClassification {
  label: string;
  tone: TechnicalScoreTone;
}

export interface TechnicalScoreResult {
  total: number;
  max: number;
  factors: TechnicalScoreFactor[];
  classification: TechnicalScoreClassification;
}

function fmtN(n: number, dec = 2): string {
  if (Number.isNaN(n)) return '–';
  return n.toFixed(dec);
}

export function computeTechnicalScore(
  price: number,
  trendEma: TrendEmaAnalysis,
  indicators: IndicatorAnalysis,
  volume: VolumeAnalysis
): TechnicalScoreResult {
  const priceAboveEma200 = price > trendEma.ema200;
  const ema200Rising = trendEma.trend === 'bullish';
  const ema50Rising = trendEma.trend !== 'bearish';
  const ema50AboveEma200 = trendEma.ema50 > trendEma.ema200;
  const momentumStackBullish = trendEma.priceVsEma20 === 'above' && trendEma.higherLows;

  // 1. EMA 200 — filter tren utama (maks 25)
  const ema200Score = (priceAboveEma200 ? 15 : 0) + (ema200Rising ? 10 : 0);

  // 2. EMA 50 — struktur tren menengah (maks 15)
  const ema50Score =
    (ema50Rising ? 5 : 0) +
    (trendEma.priceVsEma50 === 'above' ? 5 : 0) +
    (ema50AboveEma200 ? 5 : 0);

  // 3. EMA 9/21 — area pullback & momentum (maks 10, proxy: EMA20 + higher-low structure)
  const emaFastScore = momentumStackBullish ? 10 : trendEma.priceVsEma20 === 'above' ? 5 : 0;

  // 4. RSI 14 — zona favorit 50–65 (maks 10)
  const rsi = indicators.rsi14;
  const rsiScore = rsi >= 50 && rsi <= 65 ? 10 : rsi > 65 && rsi <= 70 ? 5 : 0;

  // 5. MACD — konfirmasi momentum (maks 15, minus jika bearish)
  const macdScore =
    indicators.macdSignalType === 'bullish_crossover' || (indicators.macdSignalType === 'bullish' && indicators.macdValue > 0)
      ? 15
      : indicators.macdSignalType === 'bullish'
        ? 7
        : indicators.macdSignalType === 'bearish_crossover' || indicators.macdSignalType === 'bearish'
          ? -10
          : 0;

  // 6. Volume — konfirmasi transaksi (maks 10)
  const rvol = volume.relativeVolume;
  const volumeScore = rvol >= 2 ? 10 : rvol >= 1.5 ? 7 : rvol >= 1 ? 3 : 0;

  const factors: TechnicalScoreFactor[] = [
    {
      key: 'ema200',
      label: 'EMA 200',
      detail: priceAboveEma200 ? (ema200Rising ? 'Harga di atas & EMA200 menanjak' : 'Harga di atas EMA200') : 'Harga di bawah EMA200 — hindari agresif',
      score: ema200Score,
      max: 25,
    },
    {
      key: 'ema50',
      label: 'EMA 50',
      detail: ema50AboveEma200 && trendEma.priceVsEma50 === 'above' ? 'Struktur menengah sehat (>EMA50>EMA200)' : 'Struktur menengah belum ideal',
      score: ema50Score,
      max: 15,
    },
    {
      key: 'emaFast',
      label: 'EMA 9/21',
      detail: momentumStackBullish ? 'Momentum & higher-low bullish' : trendEma.priceVsEma20 === 'above' ? 'Harga di atas EMA20' : 'Momentum lemah',
      score: emaFastScore,
      max: 10,
    },
    {
      key: 'rsi',
      label: 'RSI 14',
      detail: `RSI ${fmtN(rsi, 1)} — ${rsi < 50 ? 'momentum lemah' : rsi <= 65 ? 'zona favorit' : rsi <= 70 ? 'momentum kuat' : 'overbought, jangan kejar'}`,
      score: rsiScore,
      max: 10,
    },
    {
      key: 'macd',
      label: 'MACD',
      detail: indicators.macdNote,
      score: macdScore,
      max: 15,
    },
    {
      key: 'volume',
      label: 'Volume',
      detail: `RVOL ${fmtN(rvol, 2)}x rata-rata 20 hari`,
      score: volumeScore,
      max: 10,
    },
  ];

  const total = factors.reduce((sum, f) => sum + f.score, 0);
  const max = factors.reduce((sum, f) => sum + f.max, 0);

  const classification: TechnicalScoreClassification =
    total >= 70
      ? { label: 'STRONG BUY', tone: 'green' }
      : total >= 60
        ? { label: 'BUY', tone: 'green' }
        : total >= 50
          ? { label: 'WATCHLIST', tone: 'amber' }
          : total >= 40
            ? { label: 'HOLD / WAIT', tone: 'amber' }
            : { label: 'AVOID', tone: 'red' };

  return { total, max, factors, classification };
}
