'use client';

import { useMemo } from 'react';
import { StockSummary } from '@/domain/models/Stock';
import { cn, formatPercent } from '@/lib/format';

export function TerminalSectorTicker({ summaries }: { summaries: StockSummary[] }) {
  const sectors = useMemo(() => {
    const map = new Map<string, { count: number; changeSum: number }>();
    for (const s of summaries) {
      const key = s.sector || 'Lainnya';
      const entry = map.get(key) ?? { count: 0, changeSum: 0 };
      entry.count += 1;
      entry.changeSum += s.percentChange1D;
      map.set(key, entry);
    }
    return Array.from(map.entries())
      .map(([sector, { count, changeSum }]) => ({ sector, avgChange: changeSum / count }))
      .sort((a, b) => b.avgChange - a.avgChange);
  }, [summaries]);

  if (sectors.length === 0) return null;

  return (
    <div className="flex shrink-0 items-center gap-4 overflow-x-auto border-b border-(--term-border) bg-(--term-surface) px-4 py-2 sm:px-5">
      <span className="font-terminal-mono shrink-0 text-[10px] font-bold uppercase tracking-wide text-(--term-muted)">Sektor IHSG:</span>
      {sectors.map((s) => (
        <span key={s.sector} className="font-terminal-mono shrink-0 text-[11px] text-(--term-text)">
          {s.sector}{' '}
          <b className={cn(s.avgChange >= 0 ? 'text-(--term-emerald)' : 'text-(--term-crimson)')}>{formatPercent(s.avgChange)}</b>
        </span>
      ))}
    </div>
  );
}
