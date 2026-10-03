/**
 * setupUtils.ts
 *
 * Shared helpers for the trade-setup screeners (dayTrading.ts, swingTrading.ts): numeric
 * guards, IDX tick rounding for order prices, and swing-high resistance detection.
 */

import { OHLCVBar } from '@/domain/models/History';
import { idxTickSize } from '@/domain/analysis/idxTick';

export const DATA_NA = 'DATA TIDAK TERSEDIA';

export interface SetupCheck {
  ok: boolean;
  label: string;
  /** true bila input check tidak bisa dihitung (bukan gagal karena nilainya buruk). */
  missing?: boolean;
}

export const clamp = (v: number, min = 0, max = 100) => Math.max(min, Math.min(max, v));
/** NaN/Infinity → null, so "tidak tersedia" never masquerades as a number. */
export const num = (v: number) => (Number.isFinite(v) ? v : null);
export const fmt = (n: number | null, digits = 1) => (n == null ? DATA_NA : n.toFixed(digits));
export const rp = (n: number | null) => (n == null ? DATA_NA : `Rp${n.toLocaleString('id-ID')}`);

/** First valid tick strictly above `price`. */
export function tickUp(price: number): number {
  const tick = idxTickSize(price);
  return Math.floor(price / tick) * tick + tick;
}
export function floorTick(price: number): number {
  const tick = idxTickSize(price);
  return Math.floor(price / tick) * tick;
}
export function ceilTick(price: number): number {
  const tick = idxTickSize(price);
  return Math.ceil(price / tick) * tick;
}

/** Return (%) of the last close vs the close `n` bars earlier; null when history is too short. */
export function barReturn(bars: OHLCVBar[], n: number): number | null {
  if (bars.length < n + 1) return null;
  const base = bars[bars.length - 1 - n].close;
  return base > 0 ? ((bars[bars.length - 1].close - base) / base) * 100 : null;
}

/** Mean daily traded value (close × volume) over the last `period` bars; null when too short. */
export function avgTradedValue(bars: OHLCVBar[], period = 20): number | null {
  const window = bars.slice(-period);
  if (window.length < period) return null;
  return window.reduce((sum, b) => sum + b.close * b.volume, 0) / window.length;
}

/**
 * Swing highs (pivot: higher than 2 bars each side) above `price` within `lookback` bars before
 * the last bar, ascending. Falls back to the window's highest high when no pivot sits above price.
 */
export function resistancesAbove(bars: OHLCVBar[], price: number, lookback = 60): number[] {
  const window = bars.slice(-(lookback + 1), -1);
  const pivots: number[] = [];
  for (let i = 2; i < window.length - 2; i++) {
    const h = window[i].high;
    if (h > window[i - 1].high && h > window[i - 2].high && h >= window[i + 1].high && h >= window[i + 2].high) {
      pivots.push(h);
    }
  }
  const above = [...new Set(pivots.filter((h) => h > price))].sort((a, b) => a - b);
  if (above.length > 0) return above;
  const maxHigh = window.length > 0 ? Math.max(...window.map((b) => b.high)) : NaN;
  return Number.isFinite(maxHigh) && maxHigh > price ? [maxHigh] : [];
}

/** Nearest swing-high resistance above `price`, or null when none is detected. */
export function nearestResistance(bars: OHLCVBar[], price: number, lookback = 60): number | null {
  return resistancesAbove(bars, price, lookback)[0] ?? null;
}
