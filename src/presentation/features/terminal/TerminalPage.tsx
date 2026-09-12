'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getStockFundamentals, getStockHistory, getStockSummariesWithTimestamp } from '@/data/repositories/StockRepository';
import { StockSummary } from '@/domain/models/Stock';
import { ScreenerPresetId, SCREENER_PRESETS } from '@/domain/screener/presets';
import { mapWithConcurrency } from '@/lib/concurrency';
import { useWatchlist } from '@/presentation/features/screener/hooks/useWatchlist';
import { TerminalHeader } from './components/TerminalHeader';
import { TerminalTickerTape } from './components/TerminalTickerTape';
import { TerminalSessionBar } from './components/TerminalSessionBar';
import { TerminalSectorTicker } from './components/TerminalSectorTicker';
import { TerminalStatCards } from './components/TerminalStatCards';
import { TerminalSidebar } from './components/TerminalSidebar';
import { TerminalFilterTabs } from './components/TerminalFilterTabs';
import { TerminalFilterBar, AiSignalTier, MarketCapBucket } from './components/TerminalFilterBar';
import { TerminalTable, ScreenerResult } from './components/TerminalTable';
import { TerminalFooterBanner, TerminalInfoCards } from './components/TerminalFooterBanner';
import { TerminalFooter } from './components/TerminalFooter';
import { useMarketPulse } from './hooks/useMarketPulse';
import { useIhsgQuote } from './hooks/useIhsgQuote';
import { useIdxSessionStatus } from './hooks/useIdxSessionStatus';
import { getRowDisplay } from './lib/rowDisplay';

export type FilterId = 'all' | ScreenerPresetId;
type ScanStatus = 'idle' | 'loading-summary' | 'scanning' | 'done' | 'error';
export type SortKey = 'change_desc' | 'change_asc' | 'value_desc' | 'ticker_asc';

const HISTORY_CONCURRENCY = 6;
const RESULTS_LIMIT = 50;

export function TerminalPage() {
  const [summaries, setSummaries] = useState<StockSummary[] | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [connectionMs, setConnectionMs] = useState<number | null>(null);
  const [filterId, setFilterId] = useState<FilterId>('all');
  const [status, setStatus] = useState<ScanStatus>('loading-summary');
  const [progress, setProgress] = useState({ checked: 0, total: 0 });
  const [results, setResults] = useState<ScreenerResult[]>([]);
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('change_desc');
  const [marketCap, setMarketCap] = useState<MarketCapBucket>('all');
  const [aiSignal, setAiSignal] = useState<AiSignalTier>('all');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(RESULTS_LIMIT);
  const [compactGrid, setCompactGrid] = useState(true);
  const watchlist = useWatchlist();

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

  const loadSummaries = useCallback(() => {
    const start = performance.now();
    getStockSummariesWithTimestamp()
      .then(({ summaries, lastUpdatedAt }) => {
        setConnectionMs(Math.round(performance.now() - start));
        setSummaries(summaries);
        setLastUpdatedAt(lastUpdatedAt);
        setStatus('idle');
      })
      .catch(() => {
        setErrorMessage('Gagal memuat daftar saham. Coba muat ulang halaman.');
        setStatus('error');
      });
  }, []);

  useEffect(() => {
    loadSummaries();
  }, [loadSummaries]);

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

  // Auto-refresh: real periodic re-scan (not just a decorative "LIVE" label).
  useEffect(() => {
    if (!autoRefresh || !summaries) return;
    const id = setInterval(() => loadSummaries(), 10_000);
    return () => clearInterval(id);
  }, [autoRefresh, summaries, loadSummaries]);

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
      list = list.filter((r) => r.summary.ticker.toLowerCase().includes(q) || r.summary.name.toLowerCase().includes(q));
    }

    if (marketCap !== 'all') {
      list = list.filter((r) => {
        const cap = r.summary.capitalization;
        if (marketCap === 'big') return cap >= 10_000_000_000_000;
        if (marketCap === 'mid') return cap >= 1_000_000_000_000 && cap < 10_000_000_000_000;
        return cap < 1_000_000_000_000;
      });
    }

    if (aiSignal !== 'all') {
      list = list.filter((r) => {
        const { scoreComposite } = getRowDisplay(r.summary, r.evaluation);
        if (aiSignal === 'strong') return scoreComposite >= 65;
        if (aiSignal === 'moderate') return scoreComposite >= 50 && scoreComposite < 65;
        return scoreComposite < 50;
      });
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
  }, [results, query, marketCap, aiSignal, sortKey]);

  const visibleResults = useMemo(() => displayedResults.slice(0, visibleCount), [displayedResults, visibleCount]);
  const hasMoreResults = displayedResults.length > visibleResults.length;

  const topMovers = useMemo(() => {
    if (!summaries) return [];
    return [...summaries].sort((a, b) => b.percentChange1D - a.percentChange1D).slice(0, 12);
  }, [summaries]);

  const breadth = useMemo(() => {
    if (!summaries) return { advancing: 0, declining: 0, unchanged: 0 };
    let advancing = 0;
    let declining = 0;
    let unchanged = 0;
    for (const s of summaries) {
      if (s.percentChange1D > 0) advancing += 1;
      else if (s.percentChange1D < 0) declining += 1;
      else unchanged += 1;
    }
    return { advancing, declining, unchanged };
  }, [summaries]);

  const marketPulse = useMarketPulse(summaries, results);
  const ihsg = useIhsgQuote();
  const sessionStatus = useIdxSessionStatus();

  const isBusy = status === 'scanning' || status === 'loading-summary';

  const handleReset = useCallback(() => {
    setFilterId('all');
    setQuery('');
    setMarketCap('all');
    setAiSignal('all');
    setSortKey('change_desc');
    setVisibleCount(RESULTS_LIMIT);
  }, []);

  return (
    <div className="flex w-full min-h-screen flex-col bg-(--term-bg)">
      <TerminalHeader
        query={query}
        onQueryChange={handleQueryChange}
        ihsg={ihsg}
        onOpenDrawer={() => setDrawerOpen(true)}
        compactGrid={compactGrid}
        onToggleCompactGrid={() => setCompactGrid((c) => !c)}
      />
      <TerminalTickerTape movers={topMovers} ihsg={ihsg} />
      <TerminalSessionBar
        session={sessionStatus}
        ihsg={ihsg}
        breadth={breadth}
        filteredCount={results.length}
        totalCount={summaries?.length ?? 0}
        onReset={handleReset}
        results={displayedResults}
      />
      <TerminalSectorTicker summaries={summaries ?? []} />
      <TerminalStatCards pulse={marketPulse} />

      <div className="w-full flex flex-1 flex-col gap-3.5 px-4 pb-8 sm:px-5 lg:flex-row lg:items-start lg:gap-3.5">
        {drawerOpen && (
          <div className="fixed inset-0 z-[35] bg-zinc-900/50 lg:hidden" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
        )}

        <TerminalSidebar
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          watchlistTickers={watchlist.tickers}
          summariesCount={summaries?.length ?? 0}
          connectionMs={connectionMs}
          sessionEndsAt={sessionStatus.sessionEndsAt}
          sessionOpen={sessionStatus.isOpen}
        />

        <main className="flex min-w-0 flex-1 flex-col gap-3">
          <TerminalFilterTabs selected={filterId} onSelect={handleSelectFilter} />
          <TerminalFilterBar
            sortKey={sortKey}
            onSortChange={setSortKey}
            marketCap={marketCap}
            onMarketCapChange={setMarketCap}
            aiSignal={aiSignal}
            onAiSignalChange={setAiSignal}
            autoRefresh={autoRefresh}
            onAutoRefreshChange={setAutoRefresh}
          />

          {status === 'error' && errorMessage && (
            <div className="flex items-center gap-2 border border-(--term-crimson-border) bg-(--term-crimson-tint) px-3.5 py-2.5 text-sm font-semibold text-(--term-crimson)">
              {errorMessage}
            </div>
          )}

          <TerminalTable
            results={visibleResults}
            totalCount={summaries?.length ?? 0}
            isBusy={isBusy}
            progress={progress}
            isWatchlisted={watchlist.has}
            onToggleWatchlist={watchlist.toggle}
            hasMore={hasMoreResults}
            onLoadMore={() => setVisibleCount((c) => c + RESULTS_LIMIT)}
            remainingCount={displayedResults.length - visibleResults.length}
            compact={compactGrid}
          />
        </main>
      </div>

      <TerminalFooterBanner />
      <TerminalInfoCards />
      <TerminalFooter lastUpdatedAt={lastUpdatedAt} />
    </div>
  );
}
