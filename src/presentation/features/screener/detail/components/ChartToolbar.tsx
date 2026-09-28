'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/format';

export const TIMEFRAMES = [
  { key: '1D', bars: 0, label: 'Intraday hari ini (1 menit)' },
  { key: '1W', bars: 5, label: '1 minggu (candle harian)' },
  { key: '1M', bars: 22, label: '1 bulan (candle harian)' },
  { key: '3M', bars: 66, label: '3 bulan (candle harian)' },
  { key: '6M', bars: 132, label: '6 bulan (candle harian)' },
  { key: '1Y', bars: 252, label: '1 tahun (candle harian)' },
] as const;
export type Timeframe = (typeof TIMEFRAMES)[number]['key'];

export const INDICATORS = [
  { key: 'ema9', label: 'EMA 9', color: '#6366f1', tip: 'EMA 9 hari — tren sangat jangka pendek.' },
  { key: 'ema21', label: 'EMA 21', color: '#f59e0b', tip: 'EMA 21 hari — tren jangka pendek (± 1 bulan bursa).' },
  { key: 'ema50', label: 'EMA 50', color: '#10b981', tip: 'EMA 50 hari — tren jangka menengah.' },
  { key: 'ema200', label: 'EMA 200', color: '#ef4444', tip: 'EMA 200 hari — tren jangka panjang.' },
  { key: 'vwap', label: 'VWAP', color: '#94a3b8', tip: 'Volume Weighted Average Price. Intraday: VWAP sesi; harian: VWAP ter-anchor dari awal periode.' },
] as const;
export type IndicatorKey = (typeof INDICATORS)[number]['key'];
export type IndicatorState = Record<IndicatorKey, boolean>;

export function ChartToolbar({
  timeframe,
  onTimeframe,
  indicators,
  onToggleIndicator,
}: {
  timeframe: Timeframe;
  onTimeframe: (t: Timeframe) => void;
  indicators: IndicatorState;
  onToggleIndicator: (k: IndicatorKey) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div role="radiogroup" aria-label="Rentang waktu" className="flex rounded-lg border border-(--sv-border) bg-(--sv-bg) p-0.5">
        {TIMEFRAMES.map((t) => {
          const active = t.key === timeframe;
          return (
            <button
              key={t.key}
              type="button"
              role="radio"
              aria-checked={active}
              title={t.label}
              onClick={() => onTimeframe(t.key)}
              className={cn(
                'h-7 min-w-10 rounded-md px-2.5 text-xs font-semibold tabular-nums transition-colors',
                active ? 'bg-(--sv-primary) text-(--sv-primary-fg) shadow-sm' : 'text-(--sv-muted) hover:text-(--sv-text)',
              )}
            >
              {t.key}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {INDICATORS.map((ind) => {
          const on = indicators[ind.key];
          return (
            <button
              key={ind.key}
              type="button"
              role="checkbox"
              aria-checked={on}
              title={ind.tip}
              onClick={() => onToggleIndicator(ind.key)}
              className="group flex items-center gap-1.5 text-xs font-medium text-(--sv-text)"
            >
              <span
                className="flex size-4 items-center justify-center rounded border transition-colors"
                style={on ? { backgroundColor: ind.color, borderColor: ind.color } : { borderColor: 'var(--sv-border)' }}
              >
                {on && <Check className="size-3 text-white" strokeWidth={3} />}
              </span>
              <span className={cn(!on && 'text-(--sv-muted) group-hover:text-(--sv-text)')}>{ind.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
