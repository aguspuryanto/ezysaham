'use client';

import Link from 'next/link';
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import { cn, formatCompact, formatPercent, formatRupiah } from '@/lib/format';
import { DataFreshnessPill } from '@/presentation/features/analysis/DataFreshnessBanner';
import { useStockAnalysis } from '@/presentation/features/analysis/useStockAnalysis';
import { PriceChart, PriceChartSkeleton } from '@/presentation/features/screener/detail/components/PriceChart';
import { Badge, Card, Skeleton } from '@/presentation/features/screener/detail/components/ui';

/** Live snapshot of a ticker (identity card + price chart), embedded inside a blog post — Detail Emiten styling. */
export function StockEmbed({ ticker }: { ticker: string }) {
  const { status, summary, analysis, bars, freshness } = useStockAnalysis(ticker);

  if (status === 'loading') {
    return (
      <div className="flex flex-col gap-4">
        <Card className="flex items-center gap-4 p-5">
          <Skeleton className="size-14 rounded-lg" />
          <div className="flex-1 space-y-2"><Skeleton className="h-6 w-1/3" /><Skeleton className="h-4 w-1/2" /></div>
        </Card>
        <PriceChartSkeleton />
      </div>
    );
  }

  if (status === 'error' || !summary || !analysis) return null;

  const change = summary.percentChange1D;
  const up = change >= 0;
  const ChangeIcon = up ? ArrowUpRight : ArrowDownRight;

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-(--sv-primary) text-lg font-bold text-(--sv-primary-fg)">
            {summary.ticker.slice(0, 2)}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-(--sv-text)">{summary.ticker}</h2>
              <Badge>{summary.sector || 'Sektor BEI'}</Badge>
            </div>
            <p className="truncate text-sm text-(--sv-text)">{summary.name}</p>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-(--sv-muted)">
              <span>Market Cap <b className="font-semibold text-(--sv-text)">{formatCompact(summary.capitalization)}</b></span>
              <span>Avg Vol 20D <b className="font-semibold text-(--sv-text)">{formatCompact(analysis.volume.volumeMa20)}</b></span>
              {freshness && <DataFreshnessPill freshness={freshness} />}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tabular-nums text-(--sv-text)">{formatRupiah(summary.lastClose)}</span>
            <span className={cn('inline-flex items-center gap-0.5 text-sm font-semibold tabular-nums', up ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
              <ChangeIcon className="size-4" strokeWidth={2.25} />
              {formatPercent(change)}
            </span>
          </div>
          <Link
            href={`/screener/${summary.ticker}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-(--sv-primary) px-3.5 text-sm font-semibold text-(--sv-primary-fg) hover:opacity-90"
          >
            Analisis lengkap {summary.ticker} <ArrowRight className="size-4" />
          </Link>
        </div>
      </Card>

      {bars.length > 0 && <PriceChart ticker={summary.ticker} bars={bars} currentPrice={summary.lastClose} />}
    </div>
  );
}
