import { OHLCVBar } from '../models/History';

/**
 * oscillators.ts
 *
 * Oscillators used by the buy checklist (docs/features_checklist_buy.md) that aren't part of
 * StockAnalysis. Every series is aligned to `bars` (same length); indexes without enough
 * history are NaN — never 0, so "no data" can't be mistaken for an oversold reading.
 */

function smaSeries(values: number[], period: number): number[] {
  const out: number[] = new Array(values.length).fill(NaN);
  let sum = 0;
  let count = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (!Number.isFinite(v)) { sum = 0; count = 0; continue; }
    sum += v;
    count++;
    if (count > period) { sum -= values[i - period]; count = period; }
    if (count === period) out[i] = sum / period;
  }
  return out;
}

/** Slow Stochastic (k, kSmooth, d) — default 14,3,3: raw %K smoothed by SMA(kSmooth), %D = SMA(d) of that. */
export function stochasticSlow(bars: OHLCVBar[], kPeriod = 14, kSmooth = 3, dPeriod = 3): { k: number[]; d: number[] } {
  const raw: number[] = new Array(bars.length).fill(NaN);
  for (let i = kPeriod - 1; i < bars.length; i++) {
    let lo = Infinity;
    let hi = -Infinity;
    for (let j = i - kPeriod + 1; j <= i; j++) {
      lo = Math.min(lo, bars[j].low);
      hi = Math.max(hi, bars[j].high);
    }
    raw[i] = hi === lo ? 50 : ((bars[i].close - lo) / (hi - lo)) * 100;
  }
  const k = smaSeries(raw, kSmooth);
  return { k, d: smaSeries(k, dPeriod) };
}

/** Money Flow Index (period 14) on typical price × volume. */
export function mfi(bars: OHLCVBar[], period = 14): number[] {
  const out: number[] = new Array(bars.length).fill(NaN);
  const tp = bars.map((b) => (b.high + b.low + b.close) / 3);
  for (let i = period; i < bars.length; i++) {
    let pos = 0;
    let neg = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const flow = tp[j] * bars[j].volume;
      if (tp[j] > tp[j - 1]) pos += flow;
      else if (tp[j] < tp[j - 1]) neg += flow;
    }
    out[i] = neg === 0 ? (pos === 0 ? 50 : 100) : 100 - 100 / (1 + pos / neg);
  }
  return out;
}

/** Commodity Channel Index (period 20): (TP − SMA(TP)) / (0.015 × mean deviation). */
export function cci(bars: OHLCVBar[], period = 20): number[] {
  const out: number[] = new Array(bars.length).fill(NaN);
  const tp = bars.map((b) => (b.high + b.low + b.close) / 3);
  for (let i = period - 1; i < bars.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += tp[j];
    const mean = sum / period;
    let dev = 0;
    for (let j = i - period + 1; j <= i; j++) dev += Math.abs(tp[j] - mean);
    dev /= period;
    out[i] = dev === 0 ? 0 : (tp[i] - mean) / (0.015 * dev);
  }
  return out;
}

/** Williams %R (period 14): −100 … 0. */
export function williamsR(bars: OHLCVBar[], period = 14): number[] {
  const out: number[] = new Array(bars.length).fill(NaN);
  for (let i = period - 1; i < bars.length; i++) {
    let lo = Infinity;
    let hi = -Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      lo = Math.min(lo, bars[j].low);
      hi = Math.max(hi, bars[j].high);
    }
    out[i] = hi === lo ? -50 : ((hi - bars[i].close) / (hi - lo)) * -100;
  }
  return out;
}

/** Chande Momentum Oscillator (period 14): −100 … 100. */
export function cmo(bars: OHLCVBar[], period = 14): number[] {
  const out: number[] = new Array(bars.length).fill(NaN);
  for (let i = period; i < bars.length; i++) {
    let up = 0;
    let down = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const ch = bars[j].close - bars[j - 1].close;
      if (ch > 0) up += ch;
      else down -= ch;
    }
    out[i] = up + down === 0 ? 0 : ((up - down) / (up + down)) * 100;
  }
  return out;
}
