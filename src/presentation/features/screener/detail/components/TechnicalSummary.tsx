'use client';

import { Activity, BarChart3, Gauge, LucideIcon, TrendingDown, TrendingUp, Waves } from 'lucide-react';
import { cn } from '@/lib/format';
import { InfoTip } from '../../components/Popover';
import { TechnicalItem } from '../useStockDetail';
import { TONE_ICON_BG, TONE_TEXT } from './ui';

const ICONS: Record<TechnicalItem['key'], LucideIcon> = {
  trend: TrendingUp,
  momentum: Activity,
  volume: BarChart3,
  rsi: Gauge,
  macd: Waves,
};

const RING: Record<string, string> = {
  positive: 'stroke-emerald-500',
  negative: 'stroke-rose-500',
  warning: 'stroke-amber-500',
  info: 'stroke-blue-500',
  neutral: 'stroke-slate-400',
};

function RsiRing({ value, tone }: { value: number; tone: TechnicalItem['tone'] }) {
  const r = 16;
  const c = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, value)) / 100;
  return (
    <svg viewBox="0 0 40 40" className="size-11 shrink-0 -rotate-90" aria-hidden="true">
      <circle cx="20" cy="20" r={r} fill="none" strokeWidth="4" className="stroke-slate-200 dark:stroke-slate-700" />
      <circle cx="20" cy="20" r={r} fill="none" strokeWidth="4" strokeLinecap="round" className={RING[tone]} strokeDasharray={`${c * pct} ${c}`} />
      <text x="20" y="24" textAnchor="middle" fontSize="12" fontWeight="700" className="rotate-90 fill-(--sv-text)" style={{ transformOrigin: '20px 20px' }}>
        {value}
      </text>
    </svg>
  );
}

export function TechnicalSummary({ indicators }: { indicators: TechnicalItem[] }) {
  return (
    <section aria-labelledby="tech-summary-title" className="flex flex-col gap-3">
      <h2 id="tech-summary-title" className="text-base font-semibold text-(--sv-text)">Ringkasan Teknikal</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {indicators.map((item) => {
          const Icon = item.key === 'trend' && item.tone === 'negative' ? TrendingDown : ICONS[item.key];
          return (
            <div
              key={item.key}
              className="flex flex-col gap-2 rounded-xl border border-(--sv-border) bg-(--sv-surface) p-3.5 shadow-(--sv-shadow) transition-colors hover:border-(--sv-primary)/30"
            >
              <div className="flex items-center gap-2">
                <span className={cn('flex size-7 items-center justify-center rounded-lg', TONE_ICON_BG[item.tone])}>
                  <Icon className="size-4" strokeWidth={2} />
                </span>
                <span className="text-xs font-medium text-(--sv-muted)">{item.label}</span>
                <span className="ml-auto">
                  <InfoTip term={item.label} text={item.tooltip} />
                </span>
              </div>
              {item.gauge != null ? (
                <div className="flex items-center gap-2.5">
                  <RsiRing value={item.gauge} tone={item.tone} />
                  <p className={cn('text-sm font-bold leading-tight', TONE_TEXT[item.tone])}>{item.value}</p>
                </div>
              ) : (
                <p className={cn('text-xl font-bold leading-tight', TONE_TEXT[item.tone])}>{item.value}</p>
              )}
              <p className="text-xs leading-snug text-(--sv-muted)">
                {item.gauge != null ? item.hint ?? item.description : item.description}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
