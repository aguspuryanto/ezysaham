/**
 * marketRegimeEngine.ts
 *
 * Classifies the overall market condition (e.g. IHSG) as bullish / neutral /
 * bearish from an EMA9/21/50/200 stack + RSI14 + MACD, mirroring the
 * "7-Confirmation IDX" checklist used for individual stocks
 * (see technicalScore.ts) but applied to a composite index series.
 */

import { OHLCVBar } from '@/domain/models/History';
import { closes, ema, lastValid } from '@/domain/indicators/movingAverages';
import { rsi } from '@/domain/indicators/rsi';
import { macd } from '@/domain/indicators/macd';

export type MarketRegime = 'bullish' | 'neutral' | 'bearish';

export interface MarketRegimeEma {
  value: number;
  rising: boolean;
}

export interface MarketRegimeResult {
  regime: MarketRegime;
  label: string;
  price: number;
  ema9: MarketRegimeEma;
  ema21: MarketRegimeEma;
  ema50: MarketRegimeEma;
  ema200: MarketRegimeEma;
  rsi14: number;
  macdBullish: boolean;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Rising = last valid value higher than the value ~5 bars before it. */
function isRising(series: number[]): boolean {
  const validIdx: number[] = [];
  for (let i = series.length - 1; i >= 0 && validIdx.length < 6; i--) {
    if (!Number.isNaN(series[i])) validIdx.push(i);
  }
  if (validIdx.length < 2) return false;
  const lastIdx = validIdx[0];
  const priorIdx = validIdx[validIdx.length - 1];
  return series[lastIdx] > series[priorIdx];
}

/** Requires at least 200 bars of history to seed EMA200 — returns null otherwise. */
export function computeMarketRegime(bars: OHLCVBar[]): MarketRegimeResult | null {
  if (bars.length < 200) return null;

  const cls = closes(bars);
  const price = cls[cls.length - 1];

  const ema9Series = ema(cls, 9);
  const ema21Series = ema(cls, 21);
  const ema50Series = ema(cls, 50);
  const ema200Series = ema(cls, 200);

  const ema9: MarketRegimeEma = { value: round2(lastValid(ema9Series)), rising: isRising(ema9Series) };
  const ema21: MarketRegimeEma = { value: round2(lastValid(ema21Series)), rising: isRising(ema21Series) };
  const ema50: MarketRegimeEma = { value: round2(lastValid(ema50Series)), rising: isRising(ema50Series) };
  const ema200: MarketRegimeEma = { value: round2(lastValid(ema200Series)), rising: isRising(ema200Series) };

  const rsi14 = round2(lastValid(rsi(bars, 14)));

  const { macdLine, signalLine } = macd(bars);
  const macdBullish = lastValid(macdLine) > lastValid(signalLine);

  const bullishStack = price > ema200.value && ema9.value > ema21.value && ema21.value > ema50.value && ema50.value > ema200.value;
  const bearishStack = price < ema200.value && ema9.value < ema21.value && ema21.value < ema50.value && ema50.value < ema200.value;

  let regime: MarketRegime;
  let label: string;
  if (bullishStack && ema200.rising && rsi14 > 50 && macdBullish) {
    regime = 'bullish';
    label = 'BULLISH MARKET';
  } else if (bearishStack && !ema200.rising && rsi14 < 50 && !macdBullish) {
    regime = 'bearish';
    label = 'BEARISH MARKET';
  } else {
    regime = 'neutral';
    label = 'NEUTRAL MARKET';
  }

  return { regime, label, price, ema9, ema21, ema50, ema200, rsi14, macdBullish };
}
