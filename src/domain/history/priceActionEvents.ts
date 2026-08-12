import { OHLCVBar } from '@/domain/models/History';
import { PriceActionHistoryResult, TechnicalEvent } from '@/domain/models/TechnicalHistory';

type CandlePattern =
  | 'bullish_engulfing'
  | 'bearish_engulfing'
  | 'doji'
  | 'hammer'
  | 'shooting_star'
  | 'marubozu_bullish'
  | 'marubozu_bearish'
  | 'none';

const PATTERN_META: Record<CandlePattern, { label: string; tone: 'bullish' | 'bearish' | 'neutral'; icon: string }> = {
  bullish_engulfing: { label: 'Bullish Engulfing', tone: 'bullish', icon: '🟢' },
  bearish_engulfing: { label: 'Bearish Engulfing', tone: 'bearish', icon: '🔴' },
  doji: { label: 'Doji (Ketidakpastian)', tone: 'neutral', icon: '⚪' },
  hammer: { label: 'Hammer (Potensi Reversal Naik)', tone: 'bullish', icon: '🟢' },
  shooting_star: { label: 'Shooting Star (Potensi Reversal Turun)', tone: 'bearish', icon: '🔴' },
  marubozu_bullish: { label: 'Marubozu Bullish (Kekuatan Beli)', tone: 'bullish', icon: '🟢' },
  marubozu_bearish: { label: 'Marubozu Bearish (Tekanan Jual)', tone: 'bearish', icon: '🔴' },
  none: { label: '', tone: 'neutral', icon: '' },
};

/** Single-candle pattern classification, looped bar-by-bar for the history (vs. only the latest bar elsewhere in the app). */
function classifyCandle(bar: OHLCVBar, prevBar: OHLCVBar): CandlePattern {
  const body = Math.abs(bar.close - bar.open);
  const range = bar.high - bar.low;
  if (range === 0) return 'none';

  const upperWick = bar.high - Math.max(bar.open, bar.close);
  const lowerWick = Math.min(bar.open, bar.close) - bar.low;
  const bodyRatio = body / range;

  if (bodyRatio < 0.1) return 'doji';
  if (bodyRatio > 0.85) return bar.close > bar.open ? 'marubozu_bullish' : 'marubozu_bearish';
  if (lowerWick > body * 2 && upperWick < body * 0.5) return 'hammer';
  if (upperWick > body * 2 && lowerWick < body * 0.5) return 'shooting_star';
  if (bar.close > bar.open && prevBar.close < prevBar.open && bar.close > prevBar.open && bar.open < prevBar.close) {
    return 'bullish_engulfing';
  }
  if (bar.close < bar.open && prevBar.close > prevBar.open && bar.close < prevBar.open && bar.open > prevBar.close) {
    return 'bearish_engulfing';
  }
  return 'none';
}

const BIG_MOVE_THRESHOLD = 5;

export function detectPriceActionEvents(bars: OHLCVBar[]): PriceActionHistoryResult {
  const events: TechnicalEvent[] = [];

  for (let i = 1; i < bars.length; i++) {
    const bar = bars[i];
    const prevBar = bars[i - 1];
    const chg = prevBar.close !== 0 ? ((bar.close - prevBar.close) / prevBar.close) * 100 : NaN;
    const metrics = {
      Open: bar.open.toLocaleString('id-ID'),
      Close: bar.close.toLocaleString('id-ID'),
      Perubahan: Number.isNaN(chg) ? '–' : `${chg >= 0 ? '+' : ''}${chg.toFixed(1)}%`,
    };

    const pattern = classifyCandle(bar, prevBar);
    if (pattern !== 'none') {
      const meta = PATTERN_META[pattern];
      events.push({
        date: bar.date, category: 'priceAction', type: pattern, label: meta.label, tone: meta.tone, icon: meta.icon,
        metrics, summary: `Pola candle ${meta.label} terbentuk pada ${bar.date}.`,
      });
    }

    if (!Number.isNaN(chg) && Math.abs(chg) >= BIG_MOVE_THRESHOLD) {
      const up = chg >= 0;
      events.push({
        date: bar.date, category: 'priceAction', type: up ? 'big_move_up' : 'big_move_down',
        label: up ? 'Kenaikan Signifikan' : 'Penurunan Signifikan', tone: up ? 'bullish' : 'bearish', icon: '⚡',
        metrics, summary: `Harga bergerak ${fmtSigned(chg)} dalam satu hari — pergerakan di luar kebiasaan.`,
      });
    }
  }

  return { events: events.sort((a, b) => (a.date < b.date ? 1 : -1)) };
}

function fmtSigned(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}
