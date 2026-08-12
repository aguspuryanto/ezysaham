import { OHLCVBar } from '@/domain/models/History';
import { BreakoutHistoryResult, TechnicalEvent } from '@/domain/models/TechnicalHistory';

const LOOKBACK = 20;
const COMPRESSION_THRESHOLD = 0.08; // 20D range / close

/** Highest high over the `period` bars strictly before index i (excludes bar i itself). */
export function priorHigh(bars: OHLCVBar[], i: number, period = LOOKBACK): number {
  if (i < period) return NaN;
  let max = -Infinity;
  for (let j = i - period; j < i; j++) max = Math.max(max, bars[j].high);
  return max;
}

/** Lowest low over the `period` bars strictly before index i (excludes bar i itself). */
function priorLow(bars: OHLCVBar[], i: number, period = LOOKBACK): number {
  if (i < period) return NaN;
  let min = Infinity;
  for (let j = i - period; j < i; j++) min = Math.min(min, bars[j].low);
  return min;
}

/** Whether the `period`-day range (inclusive of bar j) is tight relative to price. */
function isCompressed(bars: OHLCVBar[], j: number, period = LOOKBACK): boolean {
  if (j < period - 1) return false;
  let hi = -Infinity, lo = Infinity;
  for (let k = j - period + 1; k <= j; k++) {
    hi = Math.max(hi, bars[k].high);
    lo = Math.min(lo, bars[k].low);
  }
  return bars[j].close > 0 && (hi - lo) / bars[j].close <= COMPRESSION_THRESHOLD;
}

function compressionDaysBefore(bars: OHLCVBar[], i: number): number {
  let days = 0;
  for (let j = i - 1; j >= 0 && isCompressed(bars, j); j--) days++;
  return days;
}

export function detectBreakoutEvents(bars: OHLCVBar[], rvol: number[]): BreakoutHistoryResult {
  const events: TechnicalEvent[] = [];

  for (let i = LOOKBACK; i < bars.length; i++) {
    const bar = bars[i];
    const high20 = priorHigh(bars, i);
    const low20 = priorLow(bars, i);
    const r = rvol[i];
    const volumeConfirmed = !Number.isNaN(r) && r >= 1.5;

    if (bar.close > high20) {
      const compression = compressionDaysBefore(bars, i);
      events.push({
        date: bar.date, category: 'breakout', type: 'breakout_up',
        label: volumeConfirmed ? 'Breakout Resistance 20D + Volume' : 'Breakout Resistance 20D',
        tone: 'bullish', icon: '🚀',
        metrics: {
          Close: bar.close.toLocaleString('id-ID'),
          'Resistance 20D': Math.round(high20).toLocaleString('id-ID'),
          RVOL: Number.isNaN(r) ? '–' : `${r.toFixed(1)}×`,
          'Kompresi Sebelumnya': compression > 0 ? `${compression} hari` : '–',
        },
        summary: volumeConfirmed
          ? `Harga menembus resistance 20 hari terakhir disertai konfirmasi volume (RVOL ${r.toFixed(1)}×).`
          : 'Harga menembus resistance 20 hari terakhir tanpa konfirmasi volume yang kuat.',
      });
    } else if (bar.close < low20) {
      events.push({
        date: bar.date, category: 'breakout', type: 'breakout_down',
        label: 'Breakdown Support 20D', tone: 'bearish', icon: '🔴',
        metrics: {
          Close: bar.close.toLocaleString('id-ID'),
          'Support 20D': Math.round(low20).toLocaleString('id-ID'),
          RVOL: Number.isNaN(r) ? '–' : `${r.toFixed(1)}×`,
        },
        summary: 'Harga jatuh menembus support 20 hari terakhir — tekanan jual meningkat.',
      });
    }
  }

  return { events: events.sort((a, b) => (a.date < b.date ? 1 : -1)) };
}
