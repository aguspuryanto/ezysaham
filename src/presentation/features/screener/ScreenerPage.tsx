'use client';

import {
  AlertCircle,
  Building2,
  Crosshair,
  Eye,
  Flame,
  GitCompare,
  LayoutGrid,
  Loader2,
  RefreshCw,
  Rocket,
  Table2,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getStockFundamentals, getStockHistory, getStockSummariesWithTimestamp } from '@/data/repositories/StockRepository';
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
import { IhsgChart } from './components/IhsgChart';

const HISTORY_CONCURRENCY = 6;
const RESULTS_LIMIT = 50;

type FilterId = 'all' | ScreenerPresetId;
type ScanStatus = 'idle' | 'loading-summary' | 'scanning' | 'done' | 'error';
type SortKey = 'change_desc' | 'change_asc' | 'value_desc' | 'ticker_asc';

const FILTER_ITEMS: FilterChipItem[] = [
  { id: 'all', label: 'Semua', icon: LayoutGrid },
  { id: 'dayTrading', label: 'Day Trading', icon: Zap },
  { id: 'swingHunter', label: 'Swing Hunter', icon: Crosshair },
  // { id: 'araHunter', label: 'ARA Hunter', icon: Flame },
  // { id: 'smartMoneyHunter', label: 'Early Accumulation', icon: Eye },
  // { id: 'tradingPlan', label: 'Trading Plan', icon: Target },
  { id: 'fundamental', label: 'Fundamental', icon: Building2 },
  // { id: 'bandarDetector', label: 'Bandar Detector', icon: Eye },
  // { id: 'breakout', label: 'Breakout Hunter', icon: Rocket },
  // { id: 'ara', label: 'ARA', icon: Flame },
  // { id: 'bpjs', label: 'BPJS', icon: Zap },
  // { id: 'momentum', label: 'Momentum', icon: TrendingUp },
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
  const [compareSelection, setCompareSelection] = useState<string[]>([]);
  const watchlist = useWatchlist();

  const toggleCompare = useCallback((ticker: string) => {
    setCompareSelection((prev) => {
      if (prev.includes(ticker)) return prev.filter((t) => t !== ticker);
      if (prev.length >= 2) return [prev[1], ticker]; // drop the oldest, keep the newest 2
      return [...prev, ticker];
    });
  }, []);
  const isCompareSelected = useCallback((ticker: string) => compareSelection.includes(ticker), [compareSelection]);

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
    getStockSummariesWithTimestamp()
      .then(({ summaries, lastUpdatedAt }) => {
        setSummaries(summaries);
        setLastUpdatedAt(lastUpdatedAt);
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

    const needsHistory = activePreset.needsHistory !== false;
    const needsFundamentals = activePreset.needsFundamentals === true;
    let checked = 0;
    const evaluated = await mapWithConcurrency(shortlist, HISTORY_CONCURRENCY, async (summary) => {
      const [bars, fundamentals] = await Promise.all([
        needsHistory ? getStockHistory(summary.ticker) : Promise.resolve([]),
        needsFundamentals ? getStockFundamentals(summary.ticker) : Promise.resolve(null),
      ]);
      checked += 1;
      if (scanTokenRef.current === token) setProgress({ checked, total: shortlist.length });
      if (needsHistory && bars.length === 0) return null;
      const evaluation = activePreset.evaluate(summary, bars, fundamentals);
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
            className="fixed inset-0 z-[35] bg-zinc-900/50 lg:hidden"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
        )}

        <aside
          role="dialog"
          aria-modal={drawerOpen}
          aria-label="Filter dan daftar pantau"
          className={cn(
            'fixed top-0 bottom-0 left-0 z-40 flex w-64 max-w-[85vw] flex-col gap-4 overflow-y-auto neo-border border-y-0 border-l-0 bg-white p-2 transition-transform duration-300 ease-out',
            'dark:bg-zinc-950',
            drawerOpen ? 'translate-x-0 neo-shadow-lg' : '-translate-x-full',
            'lg:sticky lg:top-20 lg:bottom-auto lg:left-auto lg:z-auto lg:w-52 lg:max-w-none lg:shrink-0',
            'lg:translate-x-0 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none'
          )}
        >
          <div className="flex items-center justify-between lg:hidden">
            <span className="text-sm font-bold uppercase tracking-wide text-zinc-800 dark:text-zinc-100">Filter & Pantauan</span>
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Tutup"
              className="neo-press flex size-8 items-center justify-center neo-border bg-white text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
            >
              <X className="size-4.5" strokeWidth={2.5} />
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
          <IhsgChart />

          {/* ── UI — disclaimer banner (hide on mobile) ────────────────────── */}
          <div className="hidden lg:mt-4 lg:block">
            <PhilosophyBanner />
          </div>

          <div className="hidden lg:block">
            <PresetTabs items={FILTER_ITEMS} selected={filterId} onSelect={handleSelectFilter} />
          </div>

          {status === 'loading-summary' && (
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-600 dark:text-zinc-400">
              <Loader2 className="size-4 animate-spin" strokeWidth={2.5} />
              Memuat daftar saham dari bursa...
            </div>
          )}

          {status === 'scanning' && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm font-semibold text-zinc-600 dark:text-zinc-400">
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} />
                  Menganalisis kandidat...
                </span>
                <span className="font-mono tabular-nums">
                  {progress.checked}/{progress.total}
                </span>
              </div>
              <div className="h-3 w-full overflow-hidden neo-border bg-zinc-100 dark:bg-zinc-800">
                <div
                  className="h-full bg-emerald-400 transition-[width] duration-300 ease-out"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          {status === 'error' && errorMessage && (
            <div className="flex items-center gap-2 neo-border neo-shadow-sm bg-rose-100 px-3.5 py-2.5 text-sm font-semibold text-rose-800 dark:bg-rose-400/10 dark:text-rose-300">
              <AlertCircle className="size-4 shrink-0" strokeWidth={2.5} />
              {errorMessage}
            </div>
          )}

          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-xl font-bold uppercase tracking-tight text-zinc-900 dark:text-zinc-50">
                Hasil Screening
              </h1>
              <p className="mt-0.5 text-sm font-medium text-zinc-500 dark:text-zinc-400">
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
                className="neo-border neo-shadow-sm bg-white px-3 py-2 text-sm font-semibold text-zinc-700 outline-none dark:bg-zinc-900 dark:text-zinc-200"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-1 neo-border neo-shadow-sm bg-white p-1 dark:bg-zinc-900">
                <button
                  type="button"
                  onClick={() => setView('table')}
                  aria-label="Tampilan tabel"
                  aria-pressed={view === 'table'}
                  className={cn(
                    'p-1.5 transition-colors',
                    view === 'table'
                      ? 'bg-(--neo-accent) text-black'
                      : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
                  )}
                >
                  <Table2 className="size-4" strokeWidth={2.5} />
                </button>
                <button
                  type="button"
                  onClick={() => setView('grid')}
                  aria-label="Tampilan grid"
                  aria-pressed={view === 'grid'}
                  className={cn(
                    'p-1.5 transition-colors',
                    view === 'grid'
                      ? 'bg-(--neo-accent) text-black'
                      : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
                  )}
                >
                  <LayoutGrid className="size-4" strokeWidth={2.5} />
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
                className="neo-press inline-flex items-center justify-center gap-2 neo-border neo-shadow-sm bg-white p-2 text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-900 dark:text-zinc-300"
              >
                <RefreshCw className={cn('size-4', status === 'scanning' && 'animate-spin')} strokeWidth={2.5} />
              </button>
            </div>
          </div>

          <ResultsTable
            results={visibleResults}
            view={view}
            isWatchlisted={watchlist.has}
            onToggleWatchlist={watchlist.toggle}
            isCompareSelected={isCompareSelected}
            onToggleCompare={toggleCompare}
          />

          {hasMoreResults && (
            <button
              type="button"
              onClick={() => setVisibleCount((count) => count + RESULTS_LIMIT)}
              className="neo-press mt-1 neo-border neo-shadow-sm bg-white py-2.5 text-sm font-bold uppercase tracking-wide text-zinc-700 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Muat {Math.min(RESULTS_LIMIT, displayedResults.length - visibleResults.length)} lagi
            </button>
          )}
        </main>
      </div>

      <BottomNav items={FILTER_ITEMS} selected={filterId} onSelect={handleSelectFilter} />

      {compareSelection.length > 0 && (
        <div className="fixed inset-x-0 bottom-16 z-40 flex justify-center px-4 lg:bottom-4">
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
    </div>
  );
}
