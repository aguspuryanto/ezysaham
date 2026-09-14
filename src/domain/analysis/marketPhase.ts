/**
 * marketPhase.ts
 *
 * Classifies a stock's EOD state into one of the "5 Phase Market State + Bearish"
 * buckets described in features_topgain.md — a lightweight companion to the
 * gainer_rank/change_pct sort so "Top Gainer" isn't mistaken for "Top Entry".
 * Priority order (first match wins) mirrors the reference doc exactly:
 * BEARISH → PULLBACK → EXTENDED → DISTRIBUTION → BREAKOUT → BULLISH_AWAL → NEUTRAL.
 */

import { OHLCVBar } from '@/domain/models/History';
import { StockSummary } from '@/domain/models/Stock';
import { ema, sma, lastValid } from '@/domain/indicators/movingAverages';
import { rsi } from '@/domain/indicators/rsi';

export type MarketPhase =
  | 'BEARISH'
  | 'PULLBACK'
  | 'EXTENDED'
  | 'DISTRIBUTION'
  | 'BREAKOUT'
  | 'BULLISH_AWAL'
  | 'NEUTRAL';

export interface MarketPhaseResult {
  phase: MarketPhase;
  label: string;
  emoji: string;
}

const PHASE_META: Record<MarketPhase, { label: string; emoji: string }> = {
  BEARISH: { label: 'Bearish', emoji: '🔴' },
  PULLBACK: { label: 'Pullback', emoji: '🟡' },
  EXTENDED: { label: 'Extended', emoji: '🔥' },
  DISTRIBUTION: { label: 'Distribution', emoji: '🟠' },
  BREAKOUT: { label: 'Breakout', emoji: '🚀' },
  BULLISH_AWAL: { label: 'Bullish Awal', emoji: '🟢' },
  NEUTRAL: { label: 'Netral', emoji: '⚪' },
};

const MIN_BARS = 21;

/** Returns null when there isn't enough EOD history (EMA21/RSI14/20D-high) to classify. */
export function computeMarketPhase(summary: StockSummary, bars: OHLCVBar[]): MarketPhaseResult | null {
  if (bars.length < MIN_BARS) return null;

  const closeSeries = bars.map((b) => b.close);
  const volumeSeries = bars.map((b) => b.volume);

  const ema9 = lastValid(ema(closeSeries, 9));
  const ema21 = lastValid(ema(closeSeries, 21));
  const rsi14 = lastValid(rsi(bars, 14));
  const avgVolume20 = lastValid(sma(volumeSeries, 20));

  if ([ema9, ema21, rsi14].some(Number.isNaN)) return null;

  const close = summary.lastClose;
  const changePct = summary.percentChange1D;
  const lastBar = bars[bars.length - 1];

  const volumeRatio = avgVolume20 > 0 ? summary.volume / avgVolume20 : NaN;
  const closePosition =
    lastBar.high > lastBar.low ? ((close - lastBar.low) / (lastBar.high - lastBar.low)) * 100 : 50;

  const prior20 = bars.slice(-21, -1);
  const high20Prev = prior20.length > 0 ? Math.max(...prior20.map((b) => b.high)) : NaN;
  const breakout20d = Number.isFinite(high20Prev) && close > high20Prev;

  let phase: MarketPhase;
  if (close < ema21 && ema9 < ema21 && rsi14 < 50) {
    phase = 'BEARISH';
  } else if (close < ema9 && close >= ema21 && ema9 > ema21 && volumeRatio < 1.5) {
    phase = 'PULLBACK';
  } else if (rsi14 >= 75 || changePct >= 10 || (ema21 > 0 && ((close - ema21) / ema21) * 100 >= 10)) {
    phase = 'EXTENDED';
  } else if (volumeRatio >= 2 && closePosition < 50 && changePct > 0) {
    phase = 'DISTRIBUTION';
  } else if (breakout20d && volumeRatio >= 1.5 && closePosition >= 70 && changePct >= 3) {
    phase = 'BREAKOUT';
  } else if (close > ema21 && ema9 > ema21 && rsi14 >= 50 && rsi14 <= 70 && volumeRatio >= 1) {
    phase = 'BULLISH_AWAL';
  } else {
    phase = 'NEUTRAL';
  }

  return { phase, ...PHASE_META[phase] };
}
