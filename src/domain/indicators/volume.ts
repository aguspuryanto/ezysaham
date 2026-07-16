import { OHLCVBar } from '../models/History';
import { sma, lastValid } from './movingAverages';

export function volumeMA(bars: OHLCVBar[], period: number): number {
  const volumes = bars.map((b) => b.volume);
  return lastValid(sma(volumes, period));
}

export function relativeVolume(bars: OHLCVBar[], period = 20): number {
  if (bars.length === 0) return NaN;
  const avgVol = volumeMA(bars, period);
  const lastVol = bars[bars.length - 1].volume;
  if (!avgVol || Number.isNaN(avgVol) || avgVol === 0) return NaN;
  return lastVol / avgVol;
}
