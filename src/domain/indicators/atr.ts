import { OHLCVBar } from '../models/History';

/** Wilder's Average True Range — same smoothing convention as rsi.ts. */
export function atr(bars: OHLCVBar[], period = 14): number[] {
  const result: number[] = new Array(bars.length).fill(NaN);
  if (bars.length < period + 1) return result;

  const trueRange = (i: number): number => {
    const high = bars[i].high;
    const low = bars[i].low;
    const prevClose = bars[i - 1].close;
    return Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
  };

  let sum = 0;
  for (let i = 1; i <= period; i++) sum += trueRange(i);
  let prevAtr = sum / period;
  result[period] = prevAtr;

  for (let i = period + 1; i < bars.length; i++) {
    prevAtr = (prevAtr * (period - 1) + trueRange(i)) / period;
    result[i] = prevAtr;
  }

  return result;
}

/** ATR normalized as a % of price — comparable across stocks trading at different price levels. */
export function atrPercent(atrValue: number, price: number): number {
  if (!(price > 0) || Number.isNaN(atrValue)) return NaN;
  return (atrValue / price) * 100;
}
