import { OHLCVBar } from '../models/History';

/** On-Balance Volume: cumulative volume, signed by the day's close direction. */
export function obv(bars: OHLCVBar[]): number[] {
  const result: number[] = new Array(bars.length).fill(0);
  for (let i = 1; i < bars.length; i++) {
    const change = bars[i].close - bars[i - 1].close;
    result[i] = result[i - 1] + (change > 0 ? bars[i].volume : change < 0 ? -bars[i].volume : 0);
  }
  return result;
}
