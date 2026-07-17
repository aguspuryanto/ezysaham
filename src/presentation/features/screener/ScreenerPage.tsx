'use client';

import {
  Activity,
  AlertCircle,
  Flame,
  LayoutGrid,
  Loader2,
  RefreshCw,
  Rocket,
  Shield,
  Star,
  Table2,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getStockHistory, getStockSummaries } from '@/data/repositories/StockRepository';
import { StockSummary } from '@/domain/models/Stock';
import { ScreenerPresetId, SCREENER_PRESETS } from '@/domain/screener/presets';
import { mapWithConcurrency } from '@/lib/concurrency';
import { cn } from '@/lib/format';
import { AppHeader } from '@/presentation/components/layout/AppHeader';
import { BottomNav } from './components/BottomNav';
import { FilterChipItem, PresetTabs } from './components/PresetTabs';
import { ResultsTable, ResultsView, ScreenerResult } from './components/ResultsTable';
import { FilterInfoCard, WatchlistCard } from './components/ScreenerSidebar';
import { TickerTape } from './components/TickerTape';
import { useWatchlist } from './hooks/useWatchlist';
import { PhilosophyBanner } from './components/PhilosophyBanner';

const HISTORY_CONCURRENCY = 6;
const RESULTS_LIMIT = 50;

type FilterId = 'all' | ScreenerPresetId;
type ScanStatus = 'idle' | 'loading-summary' | 'scanning' | 'done' | 'error';
type SortKey = 'change_desc' | 'change_asc' | 'value_desc' | 'ticker_asc';

const FILTER_ITEMS: FilterChipItem[] = [
  { id: 'all',           label: 'Semua',               icon: LayoutGrid },
  // ── EzySaham V2 Watchlist ────────────────────────────────────────
  { id: 'momentum',      label: '🚀 Momentum Hunter',    icon: TrendingUp },
  { id: 'early_breakout',label: '⭐ Early Breakout',      icon: Star },
  { id: 'smart_money',   label: '💎 Smart Money',          icon: Shield },
  { id: 'swing',         label: '📈 Swing Hunter',         icon: Activity },
  { id: 'hrrr',          label: '🔥 High Risk / Reward',   icon: Flame },
];

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: 'change_desc', label: 'Perubahan (Tertinggi)' },
  { value: 'change_asc', label: 'Perubahan (Terendah)' },
  { value: 'value_desc', label: 'Nilai Transaksi (Tertinggi)' },
  { value: 'ticker_asc', label: 'Ticker (A-Z)' },
];

export function ScreenerPage() {
  const [summaries, setSummaries] = useState<StockSummary[] | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [filterId, setFilterId] = useState<FilterId>('all');
  const [status, setStatus] = useState<ScanStatus>('loading-summary');
  const [progress, setProgress] = useState({ checked: 0, total: 0 });
  const [results, setResults] = useState<ScreenerResult[]>([]);
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('change_desc');
  const [view, setView] = useState<ResultsView>('table');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(RESULTS_LIMIT);
  const watchlist = useWatchlist();

  // Mobile sidebar drawer: lock body scroll and allow Escape to close while open.
  useEffect(() => {
    if (!drawerOpen) return;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [drawerOpen]);

  useEffect(() => {
    getStockSummaries()
      .then((data) => {
        setSummaries(data);
        setLastUpdatedAt(new Date());
        setStatus('idle');
      })
      .catch(() => {
        setErrorMessage('Gagal memuat daftar saham. Coba muat ulang halaman.');
        setStatus('error');
      });
  }, []);

  // Guards against a slow, superseded scan (e.g. rapid preset switching)
  // overwriting the results of a newer one.
  const scanTokenRef = useRef(0);

  const runScan = useCallback(async (id: FilterId, allSummaries: StockSummary[]) => {
    const token = ++scanTokenRef.current;
    setErrorMessage(null);

    if (id === 'all') {
      setResults(allSummaries.map((summary) => ({ summary, evaluation: { passed: true, reasons: [], failed: [] } })));
      setStatus('done');
      return;
    }

    const activePreset = SCREENER_PRESETS[id];
    const shortlist = allSummaries.filter(activePreset.coarseFilter);

    setResults([]);
    setStatus('scanning');
    setProgress({ checked: 0, total: shortlist.length });

    if (shortlist.length === 0) {
      setStatus('done');
      return;
    }

    let checked = 0;
    const evaluated = await mapWithConcurrency(shortlist, HISTORY_CONCURRENCY, async (summary) => {
      const bars = await getStockHistory(summary.ticker);
      checked += 1;
      if (scanTokenRef.current === token) setProgress({ checked, total: shortlist.length });
      if (bars.length === 0) return null;
      const evaluation = activePreset.evaluate(summary, bars);
      return evaluation.passed ? { summary, evaluation } : null;
    });

    if (scanTokenRef.current !== token) return;
    const passed = evaluated.filter((r): r is ScreenerResult => r !== null);
    setResults(passed);
    setStatus('done');
  }, []);

  useEffect(() => {
    if (!summaries) return;
    Promise.resolve().then(() => runScan(filterId, summaries));
  }, [filterId, summaries, runScan]);

  const handleSelectFilter = useCallback((id: string) => {
    setFilterId(id as FilterId);
    setVisibleCount(RESULTS_LIMIT);
  }, []);

  const handleQueryChange = useCallback((next: string) => {
    setQuery(next);
    setVisibleCount(RESULTS_LIMIT);
  }, []);

  const displayedResults = useMemo(() => {
    let list = results;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (r) => r.summary.ticker.toLowerCase().includes(q) || r.summary.name.toLowerCase().includes(q)
      );
    }

    const sorted = [...list];
    switch (sortKey) {
      case 'change_desc':
        sorted.sort((a, b) => b.summary.percentChange1D - a.summary.percentChange1D);
        break;
      case 'change_asc':
        sorted.sort((a, b) => a.summary.percentChange1D - b.summary.percentChange1D);
        break;
      case 'value_desc':
        sorted.sort((a, b) => b.summary.value - a.summary.value);
        break;
      case 'ticker_asc':
        sorted.sort((a, b) => a.summary.ticker.localeCompare(b.summary.ticker));
        break;
    }
    return sorted;
  }, [results, query, sortKey]);

  const visibleResults = useMemo(() => displayedResults.slice(0, visibleCount), [displayedResults, visibleCount]);
  const hasMoreResults = displayedResults.length > visibleResults.length;

  const topMovers = useMemo(() => {
    if (!summaries) return [];
    return [...summaries].sort((a, b) => b.percentChange1D - a.percentChange1D).slice(0, 12);
  }, [summaries]);

  const activeFilterInfo = useMemo(() => {
    if (filterId === 'all') {
      return {
        label: 'Semua',
        description: 'Menampilkan seluruh saham tanpa filter, diurutkan sesuai pilihan Anda.',
        criteria: [] as string[],
      };
    }
    const preset = SCREENER_PRESETS[filterId];
    return { label: preset.label, description: preset.description, criteria: preset.criteria };
  }, [filterId]);

  const isBusy = status === 'scanning' || status === 'loading-summary';
  const progressPct = progress.total > 0 ? Math.round((progress.checked / progress.total) * 100) : 0;

  return (
    <div className="flex w-full min-h-screen flex-col bg-white dark:bg-black">
      <AppHeader
        query={query}
        onQueryChange={handleQueryChange}
        lastUpdatedAt={lastUpdatedAt}
        onOpenDrawer={() => setDrawerOpen(true)}
        watchlistCount={watchlist.tickers.length}
      />
      <TickerTape movers={topMovers} />

      <div className="w-full flex flex-1 flex-col gap-6 px-4 pt-6 pb-24 sm:px-6 lg:flex-row lg:items-start lg:gap-8 lg:pb-6">
        {drawerOpen && (
          <div
            className="fixed inset-0 z-[35] bg-zinc-900/40 backdrop-blur-[2px] lg:hidden"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
        )}

        <aside
          role="dialog"
          aria-modal={drawerOpen}
          aria-label="Filter dan daftar pantau"
          className={cn(
            'fixed top-0 bottom-0 left-0 z-40 flex w-80 max-w-[85vw] flex-col gap-4 overflow-y-auto border-r border-zinc-200 bg-white p-4 shadow-xl transition-transform duration-300 ease-out',
            'dark:border-zinc-800 dark:bg-zinc-950',
            drawerOpen ? 'translate-x-0' : '-translate-x-full',
            'lg:sticky lg:top-20 lg:bottom-auto lg:left-auto lg:z-auto lg:w-72 lg:max-w-none lg:shrink-0',
            'lg:translate-x-0 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none'
          )}
        >
          <div className="flex items-center justify-between lg:hidden">
            <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Filter & Pantauan</span>
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Tutup"
              className="flex size-8 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
            >
              <X className="size-4.5" />
            </button>
          </div>
          <FilterInfoCard
            label={activeFilterInfo.label}
            description={activeFilterInfo.description}
            criteria={activeFilterInfo.criteria}
          />
          <WatchlistCard tickers={watchlist.tickers} summaries={summaries ?? []} onRemove={watchlist.toggle} />
        </aside>

        <main className="flex min-w-0 flex-1 flex-col gap-1">
          {/* ── UI — disclaimer banner (hide on mobile) ────────────────────── */}
          <div className="hidden lg:mt-4 lg:block">
            <PhilosophyBanner />
          </div>

          <div className="hidden lg:block">
            <PresetTabs items={FILTER_ITEMS} selected={filterId} onSelect={handleSelectFilter} />
          </div>

          {status === 'loading-summary' && (
            <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
              <Loader2 className="size-4 animate-spin" />
              Memuat daftar saham dari bursa...
            </div>
          )}

          {status === 'scanning' && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm text-zinc-500 dark:text-zinc-400">
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin text-emerald-600 dark:text-emerald-400" />
                  Menganalisis kandidat...
                </span>
                <span className="font-mono tabular-nums">
                  {progress.checked}/{progress.total}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-[width] duration-300 ease-out"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          {status === 'error' && errorMessage && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700 ring-1 ring-inset ring-rose-600/15 dark:bg-rose-400/10 dark:text-rose-300 dark:ring-rose-400/20">
              <AlertCircle className="size-4 shrink-0" />
              {errorMessage}
            </div>
          )}

          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                Hasil Screening
              </h1>
              <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                {hasMoreResults
                  ? `Menampilkan ${visibleResults.length} dari ${displayedResults.length} saham ditemukan`
                  : `${displayedResults.length} saham ditemukan`}{' '}
                dari {summaries?.length ?? 0} total · Data EOD, bukan prediksi harga
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 outline-none focus:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-1 rounded-xl border border-zinc-200 p-1 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setView('table')}
                  aria-label="Tampilan tabel"
                  aria-pressed={view === 'table'}
                  className={cn(
                    'rounded-lg p-1.5 transition-colors',
                    view === 'table'
                      ? 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100'
                      : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
                  )}
                >
                  <Table2 className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setView('grid')}
                  aria-label="Tampilan grid"
                  aria-pressed={view === 'grid'}
                  className={cn(
                    'rounded-lg p-1.5 transition-colors',
                    view === 'grid'
                      ? 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100'
                      : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
                  )}
                >
                  <LayoutGrid className="size-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (summaries) runScan(filterId, summaries);
                  setVisibleCount(RESULTS_LIMIT);
                }}
                disabled={!summaries || isBusy}
                aria-label="Pindai ulang"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-200 p-2 text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                <RefreshCw className={cn('size-4', status === 'scanning' && 'animate-spin')} />
              </button>
            </div>
          </div>

          <ResultsTable
            results={visibleResults}
            view={view}
            isWatchlisted={watchlist.has}
            onToggleWatchlist={watchlist.toggle}
          />

          {hasMoreResults && (
            <button
              type="button"
              onClick={() => setVisibleCount((count) => count + RESULTS_LIMIT)}
              className="mt-1 rounded-xl border border-zinc-200 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Muat {Math.min(RESULTS_LIMIT, displayedResults.length - visibleResults.length)} lagi
            </button>
          )}
        </main>
      </div>

      <BottomNav items={FILTER_ITEMS} selected={filterId} onSelect={handleSelectFilter} />
    </div>
  );
}
