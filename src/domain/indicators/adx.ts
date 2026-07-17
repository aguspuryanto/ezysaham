/**
 * adx.ts — Average Directional Index (Wilder, period=14)
 *
 * Returns an array the same length as bars.
 * Values at the start (< period*2) are NaN until enough history is available.
 *
 * Exports:
 *   adx(bars, period)  → number[]   — full ADX series
 *   lastAdx(bars)      → { adx, plusDI, minusDI }  — latest values only
 */

import { OHLCVBar } from '../models/History';

export function adx(bars: OHLCVBar[], period = 14): number[] {
  const n = bars.length;
  const result: number[] = new Array(n).fill(NaN);
  if (n < period * 2 + 1) return result;

  // ── Step 1: True Range, +DM, -DM ────────────────────────────────────────────
  const tr: number[]   = [0];
  const pDm: number[]  = [0];
  const mDm: number[]  = [0];

  for (let i = 1; i < n; i++) {
    const { high, low } = bars[i];
    const prevClose = bars[i - 1].close;
    const prevHigh  = bars[i - 1].high;
    const prevLow   = bars[i - 1].low;

    tr.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
    const up   = high - prevHigh;
    const down = prevLow - low;
    pDm.push(up   > down && up   > 0 ? up   : 0);
    mDm.push(down > up   && down > 0 ? down : 0);
  }

  // ── Step 2: Wilder smoothing (seed = sum of first `period` values) ─────────
  let smoothTR  = tr.slice(1, period + 1).reduce((a, b) => a + b, 0);
  let smoothPDm = pDm.slice(1, period + 1).reduce((a, b) => a + b, 0);
  let smoothMDm = mDm.slice(1, period + 1).reduce((a, b) => a + b, 0);

  const dxArr: number[] = new Array(n).fill(NaN);

  const calcDX = (p14: number, m14: number, atr: number): number => {
    if (atr === 0) return 0;
    const pdi = (p14 / atr) * 100;
    const mdi = (m14 / atr) * 100;
    const denom = pdi + mdi;
    return denom > 0 ? (Math.abs(pdi - mdi) / denom) * 100 : 0;
  };

  dxArr[period] = calcDX(smoothPDm, smoothMDm, smoothTR);

  for (let i = period + 1; i < n; i++) {
    smoothTR  = smoothTR  - smoothTR  / period + tr[i];
    smoothPDm = smoothPDm - smoothPDm / period + pDm[i];
    smoothMDm = smoothMDm - smoothMDm / period + mDm[i];
    dxArr[i]  = calcDX(smoothPDm, smoothMDm, smoothTR);
  }

  // ── Step 3: Smooth DX → ADX (Wilder seed = mean of first `period` DX) ─────
  const startAdx = period * 2;
  if (startAdx >= n) return result;

  let adxVal = 0;
  let count  = 0;
  for (let i = period; i < startAdx; i++) {
    if (!Number.isNaN(dxArr[i])) { adxVal += dxArr[i]; count++; }
  }
  adxVal = count > 0 ? adxVal / count : 0;
  result[startAdx] = adxVal;

  for (let i = startAdx + 1; i < n; i++) {
    if (!Number.isNaN(dxArr[i])) {
      adxVal = (adxVal * (period - 1) + dxArr[i]) / period;
    }
    result[i] = adxVal;
  }

  return result;
}

/** Convenience: returns the last valid ADX, +DI, and -DI values. */
export function lastAdx(
  bars: OHLCVBar[],
  period = 14
): { adxValue: number; plusDI: number; minusDI: number } {
  const n = bars.length;
  const EMPTY = { adxValue: NaN, plusDI: NaN, minusDI: NaN };
  if (n < 2) return EMPTY;

  // Re-compute the last smoothed +DI / -DI values alongside ADX
  const adxSeries = adx(bars, period);
  const adxValue  = adxSeries[n - 1];

  // Recompute raw DI for the last bar
  let smoothTR  = 0;
  let smoothPDm = 0;
  let smoothMDm = 0;

  if (n >= period + 1) {
    // Seed
    for (let i = 1; i <= period; i++) {
      const { high, low } = bars[i];
      const prevClose = bars[i - 1].close;
      const prevHigh  = bars[i - 1].high;
      const prevLow   = bars[i - 1].low;
      const trVal = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
      const up    = high - prevHigh;
      const down  = prevLow - low;
      smoothTR  += trVal;
      smoothPDm += up   > down && up   > 0 ? up   : 0;
      smoothMDm += down > up   && down > 0 ? down : 0;
    }
    for (let i = period + 1; i < n; i++) {
      const { high, low } = bars[i];
      const prevClose = bars[i - 1].close;
      const prevHigh  = bars[i - 1].high;
      const prevLow   = bars[i - 1].low;
      const trVal = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
      const up    = high - prevHigh;
      const down  = prevLow - low;
      smoothTR  = smoothTR  - smoothTR  / period + trVal;
      smoothPDm = smoothPDm - smoothPDm / period + (up   > down && up   > 0 ? up   : 0);
      smoothMDm = smoothMDm - smoothMDm / period + (down > up   && down > 0 ? down : 0);
    }
  }

  const plusDI  = smoothTR > 0 ? (smoothPDm / smoothTR) * 100 : NaN;
  const minusDI = smoothTR > 0 ? (smoothMDm / smoothTR) * 100 : NaN;

  return { adxValue, plusDI, minusDI };
}
