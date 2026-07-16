import { OHLCVBar } from '../models/History';
import { closes, ema } from './movingAverages';

export interface MacdResult {
  macdLine: number[];
  signalLine: number[];
  histogram: number[];
}

export function macd(bars: OHLCVBar[], fast = 12, slow = 26, signalPeriod = 9): MacdResult {
  const priceCloses = closes(bars);
  const emaFast = ema(priceCloses, fast);
  const emaSlow = ema(priceCloses, slow);

  const macdLine = priceCloses.map((_, i) =>
    Number.isNaN(emaFast[i]) || Number.isNaN(emaSlow[i]) ? NaN : emaFast[i] - emaSlow[i]
  );

  const firstValidIndex = macdLine.findIndex((v) => !Number.isNaN(v));
  const signalLine: number[] = new Array(macdLine.length).fill(NaN);
  if (firstValidIndex >= 0) {
    const macdTail = macdLine.slice(firstValidIndex);
    const signalTail = ema(macdTail, signalPeriod);
    for (let i = 0; i < signalTail.length; i++) {
      signalLine[firstValidIndex + i] = signalTail[i];
    }
  }

  const histogram = macdLine.map((v, i) =>
    Number.isNaN(v) || Number.isNaN(signalLine[i]) ? NaN : v - signalLine[i]
  );

  return { macdLine, signalLine, histogram };
}
