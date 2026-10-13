/**
 * Shared synthetic OHLCV fixtures for the momentum engine tests (not a test file itself).
 */

import { MomentumInput } from '@/domain/analysis/momentumSpeculation';
import { atr } from '@/domain/indicators/atr';
import { macd } from '@/domain/indicators/macd';
import { ema, lastValid } from '@/domain/indicators/movingAverages';
import { rsi } from '@/domain/indicators/rsi';
import { volumeMA } from '@/domain/indicators/volume';
import { OHLCVBar } from '@/domain/models/History';

export type Step = { pct: number; vol?: number; wick?: number; open?: number };

/** Daily bars (weekdays from 2025-01-01) from % steps; `wick` = high/low wick as % of price. */
export function barsFrom(start: number, steps: Step[], baseVol = 5_000_000): OHLCVBar[] {
  const bars: OHLCVBar[] = [];
  let prev = start;
  const day = new Date(Date.UTC(2025, 0, 1));
  steps.forEach((s) => {
    while (day.getUTCDay() % 6 === 0) day.setUTCDate(day.getUTCDate() + 1);
    const open = prev * (1 + (s.open ?? 0) / 100);
    const close = prev * (1 + s.pct / 100);
    const w = (s.wick ?? 1.5) / 100;
    const date = day.toISOString().slice(0, 10);
    day.setUTCDate(day.getUTCDate() + 1);
    bars.push({ date, open, close, high: Math.max(open, close) * (1 + w), low: Math.min(open, close) * (1 - w), volume: s.vol ?? baseVol });
    prev = close;
  });
  return bars;
}

export const zigzag = (n: number, up: number, down: number, extra: Partial<Step> = {}): Step[] =>
  Array.from({ length: n }, (_, k) => ({ pct: k % 2 === 0 ? up : -down, ...extra }));

export function inputFrom(bars: OHLCVBar[], over: Partial<MomentumInput> = {}): MomentumInput {
  const closes = bars.map((b) => b.close);
  const last = bars[bars.length - 1];
  const at = (k: number) => bars[bars.length - 1 - k]?.close;
  const chg = (k: number) => (at(k) ? (last.close / at(k)! - 1) * 100 : null);
  const volMa20 = volumeMA(bars, 20);
  return {
    bars,
    price: last.close,
    change1D: chg(1), change1W: chg(5), change1M: chg(21),
    annualHigh: null,
    ema9: lastValid(ema(closes, 9)),
    ema20: lastValid(ema(closes, 20)),
    ema50: lastValid(ema(closes, 50)),
    vwap: null,
    rvol: last.volume / volMa20,
    volumeMa20: volMa20,
    rsi14: lastValid(rsi(bars, 14)),
    macdHistogram: lastValid(macd(bars).histogram),
    atr14: lastValid(atr(bars, 14)),
    tradedValue: last.close * last.volume,
    capitalization: null, freeFloat: null,
    per: null, pbv: null, roe: null, revenueGrowth: null, earningsGrowth: null, debtToEquity: null, currentRatio: null, netMargin: null,
    isFinancial: false,
    healthVerdict: 'DATA_KURANG', valuationVerdict: 'TIDAK_DAPAT_DINILAI',
    fairValue: null, accumulationLow: null, accumulationHigh: null,
    supports: [],
    resistances: [],
    ...over,
  };
}
