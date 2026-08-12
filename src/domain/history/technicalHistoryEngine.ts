import { OHLCVBar } from '@/domain/models/History';
import { closes, ema } from '@/domain/indicators/movingAverages';
import { rsi } from '@/domain/indicators/rsi';
import { macd } from '@/domain/indicators/macd';
import { obv } from '@/domain/indicators/obv';
import { TechnicalHistoryResult } from '@/domain/models/TechnicalHistory';
import { computeRvolSeries, detectVolumeEvents } from './volumeEvents';
import { detectPriceActionEvents } from './priceActionEvents';
import { detectBreakoutEvents } from './breakoutEvents';
import { detectAccumDistEvents } from './accumDistEvents';
import { detectIndicatorCrossEvents } from './indicatorCrossEvents';
import { computeHistoricalPatterns } from './historicalPatterns';

export function computeTechnicalHistory(ticker: string, bars: OHLCVBar[]): TechnicalHistoryResult {
  const closePrices = closes(bars);
  const ema20 = ema(closePrices, 20);
  const ema50 = ema(closePrices, 50);
  const ema200 = ema(closePrices, 200);
  const rsi14 = rsi(bars);
  const macdResult = macd(bars);
  const obvSeries = obv(bars);
  const rvol = computeRvolSeries(bars);

  const volume = detectVolumeEvents(bars, rvol);
  const priceAction = detectPriceActionEvents(bars);
  const breakout = detectBreakoutEvents(bars, rvol);
  const accumDist = detectAccumDistEvents(bars, rvol, obvSeries);
  const indicatorCross = detectIndicatorCrossEvents(bars, ema20, ema50, ema200, macdResult, rsi14);
  const historicalPattern = computeHistoricalPatterns(bars, { ema20, ema50, rsi: rsi14, macd: macdResult });

  const timeline = [
    ...volume.events,
    ...priceAction.events,
    ...breakout.events,
    ...accumDist.events,
    ...indicatorCross.events,
  ].sort((a, b) => (a.date < b.date ? 1 : -1));

  return {
    ticker,
    barCount: bars.length,
    volume,
    priceAction,
    breakout,
    accumDist,
    indicatorCross,
    historicalPattern,
    timeline,
  };
}
