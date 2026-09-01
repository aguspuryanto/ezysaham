'use client';

import Link from 'next/link';
import { ExternalLink, Loader2, TrendingDown, TrendingUp } from 'lucide-react';
import { formatCompact, formatPercent, formatRupiah } from '@/lib/format';
import { useStockAnalysis } from '@/presentation/features/analysis/useStockAnalysis';
import { OHLCVChart } from '@/presentation/features/analysis/OHLCVChart';
import { DataFreshnessPill } from '@/presentation/features/analysis/DataFreshnessBanner';

/** Live snapshot of a ticker (identity card + EMA chart), embedded inside a blog post. */
export function StockEmbed({ ticker }: { ticker: string }) {
  const { status, summary, analysis, bars, freshness } = useStockAnalysis(ticker);

  if (status === 'loading') {
    return (
      <div className="neo-border neo-shadow flex items-center justify-center gap-2 bg-white p-8 text-sm font-semibold text-zinc-400 dark:bg-zinc-900">
        <Loader2 className="size-4 animate-spin" strokeWidth={2.5} />
        Memuat data {ticker.toUpperCase()}…
      </div>
    );
  }

  if (status === 'error' || !summary || !analysis) {
    return null;
  }

  const positiveDay = summary.percentChange1D >= 0;

  return (
    <div className="not-prose space-y-3">
      <div className="neo-border neo-shadow bg-white p-5 dark:bg-zinc-900">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                {summary.name} ({summary.ticker})
              </h3>
              <span className="neo-border bg-zinc-100 px-2 py-0.5 text-xs font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                {summary.sector || 'Sektor BEI'}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 text-sm font-medium text-zinc-500 dark:text-zinc-400">
              <span>Market Cap: <strong>{formatCompact(summary.capitalization)}</strong></span>
              <span>Avg Vol 20D: <strong>{formatCompact(analysis.volume.volumeMa20)} lembar</strong></span>
            </div>
            {freshness && (
              <div className="mt-1 text-zinc-500 dark:text-zinc-400">
                <DataFreshnessPill freshness={freshness} />
              </div>
            )}
          </div>

          <div className="flex flex-col items-end gap-1 shrink-0">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                {formatRupiah(summary.lastClose)}
              </span>
              <span
                className={
                  positiveDay
                    ? 'inline-flex items-center gap-1 font-mono text-base font-bold tabular-nums text-emerald-600 dark:text-emerald-400'
                    : 'inline-flex items-center gap-1 font-mono text-base font-bold tabular-nums text-rose-600 dark:text-rose-400'
                }
              >
                {positiveDay ? <TrendingUp className="size-4" strokeWidth={2.5} /> : <TrendingDown className="size-4" strokeWidth={2.5} />}
                {formatPercent(summary.percentChange1D)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {bars.length > 0 && (
        <OHLCVChart bars={bars} currentClose={summary.lastClose} ticker={summary.ticker} prevClose={summary.prevClose} />
      )}

      <Link
        href={`/screener/${summary.ticker}`}
        className="neo-press flex w-fit items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        Lihat analisis lengkap {summary.ticker} di Screener
        <ExternalLink className="size-3.5" strokeWidth={2.5} />
      </Link>
    </div>
  );
}
