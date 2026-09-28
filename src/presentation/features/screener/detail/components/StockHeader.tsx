'use client';

import { Building2, Check, Loader2, NotebookPen, Plus, TrendingDown, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/format';
import { isIdxOpen } from '../../components/IhsgChart';
import { fmtCompact, fmtNum, fmtPct, fmtRp } from '../format';
import { StockHeaderData } from '../useStockDetail';
import { Badge, Card } from './ui';

function useMarketOpen() {
  const [open, setOpen] = useState<boolean | null>(null);
  useEffect(() => {
    const tick = () => setOpen(isIdxOpen(new Date()));
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 60_000);
    return () => { clearTimeout(first); clearInterval(id); };
  }, []);
  return open;
}

export function StockHeader({
  stock,
  watchlisted,
  onToggleWatchlist,
  onCreatePlan,
  planState,
}: {
  stock: StockHeaderData;
  watchlisted: boolean;
  onToggleWatchlist: () => void;
  onCreatePlan: () => void;
  planState: 'idle' | 'saving' | 'saved';
}) {
  const marketOpen = useMarketOpen();
  const up = stock.change >= 0;
  const TrendIcon = up ? TrendingUp : TrendingDown;

  return (
    <Card className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center">
      {/* Identity */}
      <div className="flex min-w-0 items-center gap-4 lg:w-[38%]">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-(--sv-primary) text-lg font-bold text-(--sv-primary-fg)">
          {stock.ticker.slice(0, 2)}
        </span>
        <div className="min-w-0">
          <h1 className="text-3xl font-extrabold leading-none tracking-tight text-(--sv-text)">{stock.ticker}</h1>
          <p className="mt-1.5 truncate text-[15px] font-medium text-(--sv-text)" title={stock.name}>{stock.name}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-(--sv-muted)">
            <Building2 className="size-3.5" strokeWidth={2} />
            {stock.sector}
          </p>
        </div>
      </div>

      {/* Price */}
      <div className="min-w-0 flex-1 border-(--sv-border) lg:border-l lg:pl-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="text-3xl font-bold tabular-nums text-(--sv-text)">{fmtRp(stock.price)}</p>
          <p className={cn('flex items-center gap-1 text-base font-semibold tabular-nums', up ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
            <TrendIcon className="size-4" strokeWidth={2.25} />
            {up ? '+' : ''}{fmtNum(stock.change)} ({fmtPct(stock.changePct)})
          </p>
          {marketOpen != null && (
            <Badge tone={marketOpen ? 'positive' : 'neutral'}>{marketOpen ? 'OPEN' : 'CLOSED'}</Badge>
          )}
        </div>
        <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs">
          {[
            ['High', fmtRp(stock.high)],
            ['Low', fmtRp(stock.low)],
            ['Vol', fmtCompact(stock.volume)],
          ].map(([k, v]) => (
            <div key={k} className="flex gap-1.5">
              <dt className="text-(--sv-muted)">{k}</dt>
              <dd className="font-semibold tabular-nums text-(--sv-text)">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 gap-2 sm:flex-row lg:w-48 lg:flex-col">
        <button
          type="button"
          onClick={onToggleWatchlist}
          aria-pressed={watchlisted}
          className={cn(
            'inline-flex h-10 flex-1 lg:flex-none items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold transition-colors',
            watchlisted
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-300'
              : 'border-(--sv-primary) bg-(--sv-surface) text-(--sv-primary) hover:bg-(--sv-primary-soft)',
          )}
        >
          {watchlisted ? <Check className="size-4" strokeWidth={2.25} /> : <Plus className="size-4" strokeWidth={2.25} />}
          {watchlisted ? 'Di Watchlist' : 'Tambah Watchlist'}
        </button>
        <button
          type="button"
          onClick={onCreatePlan}
          disabled={planState !== 'idle'}
          className="inline-flex h-10 flex-1 lg:flex-none items-center justify-center gap-2 rounded-lg bg-(--sv-primary) px-3 text-sm font-semibold text-(--sv-primary-fg) hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {planState === 'saving' ? <Loader2 className="size-4 animate-spin" /> : planState === 'saved' ? <Check className="size-4" /> : <NotebookPen className="size-4" strokeWidth={2} />}
          {planState === 'saved' ? 'Tersimpan di Jurnal' : 'Buat Trading Plan'}
        </button>
      </div>
    </Card>
  );
}

export function StockHeaderSkeleton() {
  return (
    <Card className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center">
      <div className="flex items-center gap-4 lg:w-[38%]">
        <div className="size-14 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700" />
        <div className="space-y-2">
          <div className="h-7 w-24 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
          <div className="h-4 w-44 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
        </div>
      </div>
      <div className="flex-1 space-y-2">
        <div className="h-8 w-48 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
        <div className="h-4 w-64 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
      </div>
      <div className="h-20 w-48 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
    </Card>
  );
}
