'use client';

/**
 * WatchlistPage.tsx
 *
 * /watchlist — the user's starred stocks (localStorage via useWatchlist) in the same table as the
 * Screener, with every row's verdict loaded (the list is small) so all columns and sorts work.
 * Tickers no longer in the EOD summary list (suspended/delisted) are listed separately so they
 * can still be removed.
 */

import { AlertCircle, Loader2, RefreshCw, ScanSearch, Star, X } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getStockSummariesWithTimestamp } from '@/data/repositories/StockRepository';
import { StockSummary } from '@/domain/models/Stock';
import { cn } from '@/lib/format';
import { AppShell } from '../screener/components/AppShell';
import { CompareBar, useCompareSelection } from '../screener/components/CompareBar';
import { ScreenerResult } from '../screener/components/ResultsTable';
import { ScreenerPagination, ScreenerSort, ScreenerSortKey, ScreenerTable } from '../screener/components/ScreenerTable';
import { useScreenerVerdicts } from '../screener/hooks/useScreenerVerdicts';
import { useWatchlist } from '../screener/hooks/useWatchlist';
import { nextSort, sortScreenerRows } from '../screener/screenerSort';

const PAGE_SIZE = 25;
const DEFAULT_SORT: ScreenerSort = { key: 'change', dir: 'desc' };

type LoadStatus = 'loading' | 'done' | 'error';

export function WatchlistPage() {
  const watchlist = useWatchlist();
  const compare = useCompareSelection();
  const { verdictByTicker, load: loadVerdicts, reset: resetVerdicts } = useScreenerVerdicts();
  const [summaries, setSummaries] = useState<StockSummary[] | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<ScreenerSort>(DEFAULT_SORT);
  const [page, setPage] = useState(1);

  const loadSummaries = useCallback(() => {
    setStatus('loading');
    getStockSummariesWithTimestamp()
      .then(({ summaries, lastUpdatedAt }) => {
        setSummaries(summaries);
        setLastUpdatedAt(lastUpdatedAt);
        setStatus('done');
      })
      .catch(() => setStatus('error'));
  }, []);

  useEffect(() => {
    Promise.resolve().then(loadSummaries);
  }, [loadSummaries]);

  const handleRefresh = useCallback(() => {
    resetVerdicts();
    loadSummaries();
  }, [loadSummaries, resetVerdicts]);

  // Watchlist order is the user's own; rows follow it until a sort is applied.
  const { rows, missing } = useMemo(() => {
    const byTicker = new Map((summaries ?? []).map((s) => [s.ticker, s]));
    const found: ScreenerResult[] = [];
    const notFound: string[] = [];
    for (const ticker of watchlist.tickers) {
      const summary = byTicker.get(ticker);
      if (summary) found.push({ summary, evaluation: { passed: true, reasons: [], failed: [] } });
      else notFound.push(ticker);
    }
    return { rows: found, missing: summaries ? notFound : [] };
  }, [summaries, watchlist.tickers]);

  // Watchlists are short, so every row gets its verdict — keeps Fundamental/Upside sorts complete.
  useEffect(() => loadVerdicts(rows), [loadVerdicts, rows]);

  const sortedRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? rows.filter(({ summary: s }) => s.ticker.toLowerCase().includes(q) || s.name.toLowerCase().includes(q) || s.sector?.toLowerCase().includes(q))
      : rows;
    return sortScreenerRows(filtered, sort, verdictByTicker);
  }, [rows, query, sort, verdictByTicker]);

  const pageCount = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = useMemo(() => sortedRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE), [sortedRows, currentPage]);

  const handleQueryChange = useCallback((q: string) => {
    setQuery(q);
    setPage(1);
  }, []);
  const handleSort = useCallback((key: ScreenerSortKey) => {
    setSort((prev) => nextSort(prev, key));
    setPage(1);
  }, []);

  const loading = !watchlist.ready || status === 'loading';
  const isEmpty = watchlist.ready && watchlist.tickers.length === 0;
  const verdictsDone = rows.filter((r) => verdictByTicker[r.summary.ticker]).length;
  const btnSecondary = 'inline-flex h-9 items-center gap-2 rounded-lg border border-(--sv-border) bg-(--sv-surface) px-3 text-sm font-medium text-(--sv-text) hover:bg-(--sv-bg) disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <AppShell query={query} onQueryChange={handleQueryChange} lastUpdatedAt={lastUpdatedAt}>
      <main className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold text-(--sv-text) sm:text-2xl">
              <Star className="size-5 fill-amber-400 text-amber-500" strokeWidth={2} />
              Watchlist
            </h1>
            <p className="mt-0.5 text-sm text-(--sv-muted)">
              Saham yang Anda tandai dengan ikon bintang — tersimpan di browser ini.
            </p>
          </div>
          {!isEmpty && (
            <button type="button" onClick={handleRefresh} disabled={loading} className={btnSecondary}>
              <RefreshCw className={cn('size-4', loading && 'animate-spin')} strokeWidth={2} />
              Refresh
            </button>
          )}
        </div>

        {isEmpty ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-(--sv-border) bg-(--sv-surface) px-6 py-14 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-(--sv-primary-soft) text-(--sv-primary)">
              <Star className="size-6" strokeWidth={2} />
            </span>
            <p className="text-base font-semibold text-(--sv-text)">Watchlist Anda masih kosong</p>
            <p className="max-w-sm text-sm text-(--sv-muted)">Tandai saham dengan ikon bintang di Screener atau halaman detail emiten untuk memantaunya di sini.</p>
            <Link href="/screener" className="mt-1 inline-flex items-center gap-2 rounded-lg bg-(--sv-primary) px-3.5 py-2 text-sm font-semibold text-(--sv-primary-fg)">
              <ScanSearch className="size-4" strokeWidth={2} />
              Buka Screener
            </Link>
          </div>
        ) : (
          <>
            {status === 'error' && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-200">
                <span className="flex items-center gap-2"><AlertCircle className="size-4 shrink-0" />Gagal memuat data saham. Periksa koneksi lalu coba lagi.</span>
                <button type="button" onClick={handleRefresh} className="rounded-lg bg-rose-600 px-3 py-1.5 font-medium text-white hover:bg-rose-700">
                  Coba lagi
                </button>
              </div>
            )}

            {status === 'done' && (
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm text-(--sv-muted)">
                <p><b className="tabular-nums text-(--sv-text)">{sortedRows.length}</b> dari {watchlist.tickers.length} saham di watchlist</p>
                {verdictsDone < rows.length && (
                  <p className="inline-flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin text-(--sv-primary)" />
                    Menganalisis {verdictsDone}/{rows.length}
                  </p>
                )}
              </div>
            )}

            {missing.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200">
                <span>Tidak ada di data EOD terbaru (suspensi/delisting?):</span>
                {missing.map((ticker) => (
                  <span key={ticker} className="inline-flex items-center gap-1 rounded-md bg-white/70 px-2 py-0.5 font-semibold dark:bg-black/20">
                    {ticker}
                    <button type="button" onClick={() => watchlist.toggle(ticker)} aria-label={`Hapus ${ticker} dari watchlist`} className="hover:text-rose-600">
                      <X className="size-3.5" strokeWidth={2.5} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {status !== 'error' && (
              <ScreenerTable
                rows={pageRows}
                startIndex={(currentPage - 1) * PAGE_SIZE}
                verdictByTicker={verdictByTicker}
                loading={loading}
                sort={sort}
                onSort={handleSort}
                emptyHint={query.trim() ? 'Tidak ada saham watchlist yang cocok dengan kata kunci ini.' : 'Saham di watchlist Anda tidak ditemukan di data EOD terbaru.'}
                onResetFilters={query.trim() ? () => handleQueryChange('') : undefined}
                isWatchlisted={watchlist.has}
                onToggleWatchlist={watchlist.toggle}
                isCompareSelected={compare.isSelected}
                onToggleCompare={compare.toggle}
              />
            )}

            {!loading && <ScreenerPagination page={currentPage} pageSize={PAGE_SIZE} total={sortedRows.length} onPage={setPage} />}
          </>
        )}
      </main>

      <CompareBar selection={compare.selection} onClear={compare.clear} />
    </AppShell>
  );
}
