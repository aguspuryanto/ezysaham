'use client';

import { StockSummary } from '@/domain/models/Stock';
import { cn, formatPercent, formatRupiah } from '@/lib/format';
import { IhsgQuote } from '../hooks/useIhsgQuote';

export function TerminalTickerTape({ movers, ihsg }: { movers: StockSummary[]; ihsg: IhsgQuote | null }) {
  if (movers.length === 0 && !ihsg) return null;

  const items = [
    ...(ihsg
      ? [
          {
            key: 'ihsg',
            label: 'IHSG',
            value: new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(ihsg.value),
            changePct: ihsg.changePct,
          },
        ]
      : []),
    ...movers.map((s) => ({ key: s.ticker, label: s.ticker, value: formatRupiah(s.lastClose), changePct: s.percentChange1D })),
  ];

  const loop = [...items, ...items];

  return (
    <div className="h-8 shrink-0 overflow-hidden border-b border-(--term-border) bg-(--term-surface-sunken)">
      <div className="animate-marquee motion-reduce:animate-none flex h-full w-max items-center gap-6 whitespace-nowrap px-4">
        <span className="font-terminal-mono flex shrink-0 items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-(--term-muted)">
          <span className="size-1.5 rounded-full bg-(--term-emerald)" />
          IDX Live Ticker
        </span>
        {loop.map((it, i) => (
          <span key={`${it.key}-${i}`} className="font-terminal-mono flex items-center gap-1.5 text-xs text-(--term-text)">
            <b>{it.label}</b>
            <span>{it.value}</span>
            <span className={cn('font-semibold', it.changePct >= 0 ? 'text-(--term-emerald)' : 'text-(--term-crimson)')}>
              ({formatPercent(it.changePct)})
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
