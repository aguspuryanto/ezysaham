import { IntradayBar } from '../models/Intraday';

/** Session Volume Weighted Average Price from 1-minute intraday bars. */
export function vwap(bars: IntradayBar[]): number | null {
  let priceVolSum = 0;
  let volSum = 0;
  for (const bar of bars) {
    priceVolSum += bar.price * bar.volume;
    volSum += bar.volume;
  }
  return volSum > 0 ? priceVolSum / volSum : null;
}
