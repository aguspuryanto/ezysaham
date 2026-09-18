'use client';

import { AlertCircle, ArrowLeft, Flame, GitCompare, LayoutGrid, Loader2, RefreshCw, Snowflake, Table2, X } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getStockSummaries } from '@/data/repositories/StockRepository';
import { StockSummary } from '@/domain/models/Stock';
import { cn } from '@/lib/format';
import { LINKS, SITE_NAME } from '@/lib/site';
import { ResultsTable, ResultsView, ScreenerResult } from '@/presentation/features/screener/components/ResultsTable';
import { useWatchlist } from '@/presentation/features/screener/hooks/useWatchlist';

type Status = 'loading' | 'ready' | 'error';

export type MoversDirection = 'gainers' | 'losers';

const MOVERS_LIMIT = 50;

const DIRECTION_CONFIG: Record<MoversDirection, { title: string; icon: typeof Flame; iconTone: string }> = {
  gainers: { title: 'Top 50 Gainer', icon: Flame, iconTone: 'bg-emerald-500' },
  losers: { title: 'Top 50 Loser', icon: Snowflake, iconTone: 'bg-blue-500' },
};

export function MoversPage({ direction }: { direction: MoversDirection }) {
  const [summaries, setSummaries] = useState<StockSummary[] | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [view, setView] = useState<ResultsView>('table');
  const [compareSelection, setCompareSelection] = useState<string[]>([]);
  const watchlist = useWatchlist();

  const config = DIRECTION_CONFIG[direction];

  const fetchSummaries = useCallback(() => {
    getStockSummaries()
      .then((data) => {
        setSummaries(data);
        setStatus('ready');
      })
      .catch(() => {
        setErrorMessage('Gagal memuat daftar saham. Coba muat ulang halaman.');
        setStatus('error');
      });
  }, []);

  useEffect(() => {
    fetchSummaries();
  }, [fetchSummaries]);

  const reload = useCallback(() => {
    setStatus('loading');
    fetchSummaries();
  }, [fetchSummaries]);

  const movers = useMemo(() => {
    if (!summaries) return [];
    const sorted = [...summaries].sort((a, b) =>
      direction === 'gainers' ? b.percentChange1D - a.percentChange1D : a.percentChange1D - b.percentChange1D
    );
    return sorted.slice(0, MOVERS_LIMIT);
  }, [summaries, direction]);

  const filteredMovers = useMemo(() => {
    if (!query.trim()) return movers;
    const q = query.trim().toLowerCase();
    return movers.filter((s) => s.ticker.toLowerCase().includes(q) || s.name.toLowerCase().includes(q));
  }, [movers, query]);

  const results: ScreenerResult[] = useMemo(
    () => filteredMovers.map((summary) => ({ summary, evaluation: { passed: true, reasons: [], failed: [] } })),
    [filteredMovers]
  );

  const toggleCompare = useCallback((ticker: string) => {
    setCompareSelection((prev) => {
      if (prev.includes(ticker)) return prev.filter((t) => t !== ticker);
      if (prev.length >= 2) return [prev[1], ticker];
      return [...prev, ticker];
    });
  }, []);
  const isCompareSelected = useCallback((ticker: string) => compareSelection.includes(ticker), [compareSelection]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="bg-white dark:bg-zinc-950 border-b-[3px] border-(--neo-line)">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link
            href="/screener"
            className="flex shrink-0 items-center gap-1.5 text-sm font-bold text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            <ArrowLeft className="size-4" strokeWidth={2.5} />
            <span className="uppercase tracking-wide text-xs">Screener</span>
          </Link>
          <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-700" />
          <span className={cn('flex size-7 shrink-0 items-center justify-center neo-border text-white', config.iconTone)}>
            <config.icon className="size-3.5" strokeWidth={2.5} />
          </span>
          <h1 className="font-bold text-zinc-900 dark:text-zinc-100 truncate">{config.title}</h1>

          <nav className="ml-auto hidden sm:flex items-center gap-1">
            {LINKS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold uppercase tracking-wide text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <Icon className="size-3.5" strokeWidth={2.5} />
                <span>{label}</span>
              </Link>
            ))}
          </nav>

          <button
            type="button"
            onClick={reload}
            title="Muat ulang"
            className="neo-press flex shrink-0 size-8 items-center justify-center neo-border neo-shadow-sm bg-white text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 sm:ml-0 ml-auto"
          >
            <RefreshCw className={cn('size-3.5', status === 'loading' && 'animate-spin')} strokeWidth={2.5} />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6 space-y-5">
        {status === 'loading' && (
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-600 dark:text-zinc-400">
            <Loader2 className="size-4 animate-spin" strokeWidth={2.5} />
            Memuat daftar saham dari bursa...
          </div>
        )}

        {status === 'error' && errorMessage && (
          <div className="flex items-center gap-2 neo-border neo-shadow-sm bg-rose-100 px-3.5 py-2.5 text-sm font-semibold text-rose-800 dark:bg-rose-400/10 dark:text-rose-300">
            <AlertCircle className="size-4 shrink-0" strokeWidth={2.5} />
            {errorMessage}
          </div>
        )}

        {status === 'ready' && (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                {filteredMovers.length} dari {movers.length} saham · {summaries?.length ?? 0} total saham dipantau
              </span>

              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari ticker/nama..."
                className="neo-border neo-shadow-sm bg-white px-3 py-1.5 text-sm font-semibold text-zinc-700 outline-none dark:bg-zinc-900 dark:text-zinc-200 placeholder:text-zinc-400"
              />

              <div className="ml-auto flex items-center gap-1 neo-border neo-shadow-sm bg-white p-1 dark:bg-zinc-900">
                <button
                  type="button"
                  onClick={() => setView('table')}
                  aria-label="Tampilan tabel"
                  aria-pressed={view === 'table'}
                  className={cn('p-1.5 transition-colors', view === 'table' ? 'bg-(--neo-accent) text-black' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300')}
                >
                  <Table2 className="size-4" strokeWidth={2.5} />
                </button>
                <button
                  type="button"
                  onClick={() => setView('grid')}
                  aria-label="Tampilan grid"
                  aria-pressed={view === 'grid'}
                  className={cn('p-1.5 transition-colors', view === 'grid' ? 'bg-(--neo-accent) text-black' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300')}
                >
                  <LayoutGrid className="size-4" strokeWidth={2.5} />
                </button>
              </div>
            </div>

            <ResultsTable
              results={results}
              view={view}
              isWatchlisted={watchlist.has}
              onToggleWatchlist={watchlist.toggle}
              isCompareSelected={isCompareSelected}
              onToggleCompare={toggleCompare}
            />
          </>
        )}
      </main>

      {compareSelection.length > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
          <div className="flex items-center gap-3 neo-border neo-shadow-lg bg-white px-4 py-2.5 dark:bg-zinc-900">
            <GitCompare className="size-4 shrink-0 text-blue-500" strokeWidth={2.5} />
            <span className="text-sm font-bold text-zinc-700 dark:text-zinc-200">
              {compareSelection.length === 2
                ? `${compareSelection[0]} vs ${compareSelection[1]}`
                : `${compareSelection[0]} dipilih — pilih 1 saham lagi`}
            </span>
            {compareSelection.length === 2 && (
              <Link
                href={`/compare?a=${compareSelection[0]}&b=${compareSelection[1]}`}
                className="neo-press neo-border neo-shadow-sm bg-(--neo-accent) px-3 py-1.5 text-sm font-bold text-black"
              >
                Bandingkan →
              </Link>
            )}
            <button
              type="button"
              onClick={() => setCompareSelection([])}
              aria-label="Batalkan pilihan bandingkan"
              className="flex size-7 shrink-0 items-center justify-center text-zinc-400 hover:text-rose-500"
            >
              <X className="size-4" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      )}

      <div className="text-center pb-4 text-xs font-semibold text-zinc-400 dark:text-zinc-600">{SITE_NAME}</div>
    </div>
  );
}
