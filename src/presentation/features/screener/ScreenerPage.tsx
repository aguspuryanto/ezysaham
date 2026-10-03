'use client';

import {
  AlertCircle,
  Bookmark,
  BookmarkCheck,
  Building2,
  Crosshair,
  GitCompare,
  LayoutGrid,
  Loader2,
  NotebookPen,
  RefreshCw,
  Rocket,
  ShieldCheck,
  X,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getStockFundamentals, getStockHistory, getStockSummariesWithTimestamp } from '@/data/repositories/StockRepository';
import { computeScreenerVerdict, ScreenerVerdict } from '@/domain/analysis/screenerVerdict';
import { NewJournalEntryInput } from '@/domain/models/JournalEntry';
import { StockSummary } from '@/domain/models/Stock';
import { ScreenerPresetId, SCREENER_PRESETS } from '@/domain/screener/presets';
import { DAY_TRADING_STATUS_LABEL } from '@/domain/screener/dayTrading';
import { SWING_SETUP_LABEL, SWING_STATUS_LABEL } from '@/domain/screener/swingTrading';
import { mapWithConcurrency } from '@/lib/concurrency';
import { cn } from '@/lib/format';
import { SITE_NAME } from '@/lib/site';
import { useJournal } from '@/presentation/features/journal/hooks/useJournal';
import { DayTradingTable } from './components/DayTradingTable';
import { GainerLoserPanel } from './components/GainerLoserPanel';
import { MarketSummary, useMarketSeries } from './components/MarketSummary';
import { InfoTip } from './components/Popover';
import { ScreenerResult } from './components/ResultsTable';
import { ScreenerFilters } from './components/ScreenerFilters';
import { ScreenerHeader } from './components/ScreenerHeader';
import { ScreenerNav } from './components/ScreenerNav';
import { ScreenerPagination, ScreenerSort, ScreenerSortKey, ScreenerTable, VERDICT_SORT_KEYS } from './components/ScreenerTable';
import { ScreenerTabItem, ScreenerTabs } from './components/ScreenerTabs';
import { SwingTradingTable } from './components/SwingTradingTable';
import { ValuationSummary } from './components/ValuationSummary';
import { screenerInter } from './fonts';
import { useWatchlist } from './hooks/useWatchlist';
import {
  DEFAULT_FILTERS,
  hasAdvancedFilters,
  matchesAdvancedFilters,
  matchesBasicFilters,
  ScreenerFilterState,
} from './screenerFilters';

const JOURNAL_PRESETS: ScreenerPresetId[] = ['dayTrading', 'swingTrading'];
/** Presets with their own setup table + composite score (default sort: score desc). */
const SETUP_PRESETS: ScreenerPresetId[] = ['dayTrading', 'swingTrading'];
const JOURNAL_TOP_N = 5;

const HISTORY_CONCURRENCY = 6;
const PAGE_SIZE = 25;
/** Verdicts are committed to state in chunks so progress shows while a full-list analysis runs. */
const VERDICT_CHUNK = 24;
const SAVED_SCREENER_KEY = 'ezysaham.screener.saved.v1';

type FilterId = 'all' | ScreenerPresetId;
type ScanStatus = 'idle' | 'loading-summary' | 'scanning' | 'done' | 'error';

const FILTER_ITEMS: ScreenerTabItem[] = [
  { id: 'all', label: 'Semua', icon: LayoutGrid },
  { id: 'dayTrading', label: 'Day Trading', icon: Zap },
  { id: 'swingTrading', label: 'Swing Trading', icon: Crosshair },
  { id: 'fundamental', label: 'Fundamental', icon: Building2 },
  { id: 'highGrowth', label: 'High Growth', icon: Rocket },
  { id: 'corePortofolio', label: 'Core Portofolio', icon: ShieldCheck },
];

const DEFAULT_SORT: ScreenerSort = { key: 'change', dir: 'desc' };
/** Day/Swing Trading rank by their own composite score; other tabs have no `score` column. */
const SETUP_SORT: ScreenerSort = { key: 'score', dir: 'desc' };

interface SavedScreener {
  filterId: FilterId;
  filters: ScreenerFilterState;
  sort: ScreenerSort;
}

function readSavedScreener(): SavedScreener | null {
  try {
    const raw = window.localStorage.getItem(SAVED_SCREENER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedScreener>;
    // Saved before the Swing Hunter → Swing Trading rename.
    if ((parsed.filterId as string) === 'swingHunter') parsed.filterId = 'swingTrading';
    const filterId = FILTER_ITEMS.some((f) => f.id === parsed.filterId) ? (parsed.filterId as FilterId) : 'all';
    return { filterId, filters: { ...DEFAULT_FILTERS, ...parsed.filters }, sort: parsed.sort ?? DEFAULT_SORT };
  } catch {
    return null;
  }
}

function sortValue(r: ScreenerResult, key: ScreenerSortKey, v?: ScreenerVerdict): number | string | null {
  switch (key) {
    case 'ticker': return r.summary.ticker;
    case 'change': return r.summary.percentChange1D;
    case 'price': return r.summary.lastClose;
    case 'volume': return r.summary.volume;
    case 'fundamental': return v ? v.fundamentalScore.composite : null;
    case 'upside': return v?.valuation.upsidePct ?? null;
    case 'score': return r.evaluation.dayTrading?.scores.total ?? r.evaluation.swingTrading?.scores.total ?? null;
  }
}

export function ScreenerPage() {
  const [summaries, setSummaries] = useState<StockSummary[] | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [filterId, setFilterId] = useState<FilterId>('all');
  const [status, setStatus] = useState<ScanStatus>('loading-summary');
  const [progress, setProgress] = useState({ checked: 0, total: 0 });
  const [results, setResults] = useState<ScreenerResult[]>([]);
  const [query, setQuery] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [compareSelection, setCompareSelection] = useState<string[]>([]);
  const [creatingJurnal, setCreatingJurnal] = useState(false);
  const [jurnalMessage, setJurnalMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [verdictByTicker, setVerdictByTicker] = useState<Record<string, ScreenerVerdict>>({});
  const [filters, setFilters] = useState<ScreenerFilterState>(DEFAULT_FILTERS);
  const [draftFilters, setDraftFilters] = useState<ScreenerFilterState>(DEFAULT_FILTERS);
  const [watchlistOnly, setWatchlistOnly] = useState(false);
  const [sort, setSort] = useState<ScreenerSort>(DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const [savedFlash, setSavedFlash] = useState(false);
  const verdictAttemptedRef = useRef<Set<string>>(new Set());
  const watchlist = useWatchlist();
  const journal = useJournal();
  const market = useMarketSeries();

  const toggleCompare = useCallback((ticker: string) => {
    setCompareSelection((prev) => {
      if (prev.includes(ticker)) return prev.filter((t) => t !== ticker);
      if (prev.length >= 2) return [prev[1], ticker]; // drop the oldest, keep the newest 2
      return [...prev, ticker];
    });
  }, []);
  const isCompareSelected = useCallback((ticker: string) => compareSelection.includes(ticker), [compareSelection]);

  // Mobile/tablet sidebar drawer: lock body scroll and allow Escape to close while open.
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

  const loadSummaries = useCallback((restoreSaved: boolean) => {
    setStatus('loading-summary');
    setErrorMessage(null);
    getStockSummariesWithTimestamp()
      .then(({ summaries, lastUpdatedAt }) => {
        if (restoreSaved) {
          const saved = readSavedScreener();
          if (saved) {
            setFilterId(saved.filterId);
            setFilters(saved.filters);
            setDraftFilters(saved.filters);
            setSort(saved.sort);
          }
        }
        setSummaries(summaries);
        setLastUpdatedAt(lastUpdatedAt);
        setStatus('idle');
      })
      .catch(() => {
        setErrorMessage('Gagal memuat daftar saham. Periksa koneksi lalu coba lagi.');
        setStatus('error');
      });
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => loadSummaries(true));
  }, [loadSummaries]);

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
        needsHistory ? getStockHistory(summary.ticker, activePreset.historyRange) : Promise.resolve([]),
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
    setSort((prev) => (SETUP_PRESETS.includes(id as ScreenerPresetId) ? SETUP_SORT : prev.key === 'score' ? DEFAULT_SORT : prev));
    setPage(1);
  }, []);

  const handleQueryChange = useCallback((next: string) => {
    setQuery(next);
    setPage(1);
  }, []);

  const handleSort = useCallback((key: ScreenerSortKey) => {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'ticker' ? 'asc' : 'desc' }));
    setPage(1);
  }, []);

  const applyFilters = useCallback(() => {
    setFilters(draftFilters);
    setPage(1);
    setDrawerOpen(false);
  }, [draftFilters]);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setDraftFilters(DEFAULT_FILTERS);
    setWatchlistOnly(false);
    setPage(1);
  }, []);

  const handleRefresh = useCallback(() => {
    verdictAttemptedRef.current = new Set();
    setVerdictByTicker({});
    setPage(1);
    loadSummaries(false);
  }, [loadSummaries]);

  const handleSaveScreener = useCallback(() => {
    try {
      const saved: SavedScreener = { filterId, filters, sort };
      window.localStorage.setItem(SAVED_SCREENER_KEY, JSON.stringify(saved));
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } catch {
      setJurnalMessage({ type: 'error', text: 'Browser tidak mengizinkan penyimpanan lokal — screener tidak tersimpan.' });
    }
  }, [filterId, filters, sort]);

  const sectors = useMemo(
    () => [...new Set((summaries ?? []).map((s) => s.sector).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [summaries],
  );

  // Rows matching everything readable from StockSummary alone (search, basic filters, watchlist).
  const isWatchlisted = watchlist.has;
  const baseRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return results.filter((r) => {
      const s = r.summary;
      if (q && !(s.ticker.toLowerCase().includes(q) || s.name.toLowerCase().includes(q) || s.sector?.toLowerCase().includes(q))) return false;
      if (watchlistOnly && !isWatchlisted(s.ticker)) return false;
      return matchesBasicFilters(s, filters);
    });
  }, [results, query, filters, watchlistOnly, isWatchlisted]);

  const advancedActive = hasAdvancedFilters(filters);
  // Advanced filters and verdict-based sorts need every candidate's verdict, not just the visible page.
  const needAllVerdicts = advancedActive || VERDICT_SORT_KEYS.includes(sort.key);

  const sortedRows = useMemo(() => {
    const rows = advancedActive ? baseRows.filter((r) => matchesAdvancedFilters(verdictByTicker[r.summary.ticker], filters)) : baseRows;
    const mul = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = sortValue(a, sort.key, verdictByTicker[a.summary.ticker]);
      const vb = sortValue(b, sort.key, verdictByTicker[b.summary.ticker]);
      if (va == null && vb == null) return 0;
      if (va == null) return 1; // not analyzed yet → always last
      if (vb == null) return -1;
      if (typeof va === 'string' && typeof vb === 'string') return mul * va.localeCompare(vb);
      return mul * ((va as number) - (vb as number));
    });
  }, [baseRows, advancedActive, verdictByTicker, filters, sort]);

  const pageCount = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = useMemo(
    () => sortedRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [sortedRows, currentPage],
  );

  // The Day/Swing Trading tables don't show verdict columns — only fetch verdicts there when an advanced filter needs them.
  const isDayTrading = filterId === 'dayTrading';
  const isSwingTrading = filterId === 'swingTrading';
  const isSetupTab = isDayTrading || isSwingTrading;
  const verdictTargets = useMemo(
    () => (needAllVerdicts ? baseRows : isSetupTab ? [] : pageRows),
    [needAllVerdicts, baseRows, isSetupTab, pageRows],
  );
  const verdictProgress = needAllVerdicts
    ? { done: baseRows.filter((r) => verdictByTicker[r.summary.ticker]).length, total: baseRows.length }
    : null;

  // Lazily computes each target row's verdict (Market Phase / Trend / Fundamental / Momentum /
  // Volume / Fair Value / Risk) — needs a per-ticker history + fundamentals fetch, so it only runs
  // for rows on screen unless an advanced filter/sort needs the whole list.
  useEffect(() => {
    const pending = verdictTargets.filter((r) => !verdictAttemptedRef.current.has(r.summary.ticker));
    if (pending.length === 0) return;

    let cancelled = false;
    (async () => {
      for (let i = 0; i < pending.length && !cancelled; i += VERDICT_CHUNK) {
        const chunk = pending.slice(i, i + VERDICT_CHUNK).filter((r) => !verdictAttemptedRef.current.has(r.summary.ticker));
        chunk.forEach((r) => verdictAttemptedRef.current.add(r.summary.ticker));
        const entries = await mapWithConcurrency(chunk, HISTORY_CONCURRENCY, async ({ summary }) => {
          const [bars, fundamentals] = await Promise.all([
            getStockHistory(summary.ticker),
            getStockFundamentals(summary.ticker),
          ]);
          return [summary.ticker, computeScreenerVerdict(summary, bars, fundamentals)] as const;
        });
        // Results are valid regardless of cancellation — commit them so nothing is fetched twice.
        setVerdictByTicker((prev) => {
          const next = { ...prev };
          for (const [ticker, verdict] of entries) next[ticker] = verdict;
          return next;
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [verdictTargets]);

  const activeFilterInfo = useMemo(() => {
    if (filterId === 'all') {
      return { label: 'Semua', description: 'Seluruh saham tanpa preset — persempit dengan filter di sidebar.', criteria: [] as string[] };
    }
    const preset = SCREENER_PRESETS[filterId];
    return { label: preset.label, description: preset.description, criteria: preset.criteria };
  }, [filterId]);

  const isBusy = status === 'scanning' || status === 'loading-summary';
  const progressPct = progress.total > 0 ? Math.round((progress.checked / progress.total) * 100) : 0;
  const canCreateJurnal = JOURNAL_PRESETS.includes(filterId as ScreenerPresetId) && results.length > 0;
  const filtersDirty = JSON.stringify(draftFilters) !== JSON.stringify(filters);
  const anyFilter = watchlistOnly || JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS) || query.trim() !== '';

  const handleCreateJurnal = useCallback(async () => {
    if (!JOURNAL_PRESETS.includes(filterId as ScreenerPresetId)) return;
    const presetId = filterId as 'dayTrading' | 'swingTrading';
    setCreatingJurnal(true);
    setJurnalMessage(null);
    try {
      const inputs: NewJournalEntryInput[] = [];

      if (presetId === 'dayTrading') {
        // Day Trading: only DAY TRADE SETUP rows (never WATCH), ranked by score, using the
        // preset's own trigger/TP/SL plan.
        const setups = results
          .filter((r) => r.evaluation.dayTrading?.status === 'SETUP')
          .sort((a, b) => (b.evaluation.dayTrading?.scores.total ?? 0) - (a.evaluation.dayTrading?.scores.total ?? 0))
          .slice(0, JOURNAL_TOP_N);
        for (const { summary, evaluation } of setups) {
          const dt = evaluation.dayTrading!;
          if (dt.entryTrigger == null || dt.tp == null || dt.sl == null || dt.riskReward == null) continue;
          inputs.push({
            ticker: summary.ticker,
            presetId,
            entry: dt.entryTrigger,
            tp1: dt.tp,
            tp2: dt.tp,
            sl: dt.sl,
            riskRewardPlanned: dt.riskReward,
            reasonBuy: `${DAY_TRADING_STATUS_LABEL[dt.status]} (skor ${dt.scores.total}) — ${evaluation.reasons.join(', ')}`,
            reasonAvoid: 'Entry hanya jika trigger (break high) terpenuhi. Jangan kejar harga, risiko maks 1% modal, tanpa averaging down.',
          });
        }
        if (inputs.length === 0) {
          setJurnalMessage({ type: 'error', text: 'Belum ada saham berstatus DAY TRADE SETUP — kandidat WATCH tidak dimasukkan ke Jurnal.' });
          return;
        }
      } else {
        // Swing Trading: only SWING BUY SETUP rows (never WAIT), ranked by score, using the
        // preset's own trigger/TP1/TP2/SL plan.
        const setups = results
          .filter((r) => r.evaluation.swingTrading?.status === 'BUY')
          .sort((a, b) => (b.evaluation.swingTrading?.scores.total ?? 0) - (a.evaluation.swingTrading?.scores.total ?? 0))
          .slice(0, JOURNAL_TOP_N);
        for (const { summary, evaluation } of setups) {
          const sw = evaluation.swingTrading!;
          if (sw.entryTrigger == null || sw.tp1 == null || sw.sl == null || sw.riskReward == null) continue;
          inputs.push({
            ticker: summary.ticker,
            presetId,
            entry: sw.entryTrigger,
            tp1: sw.tp1,
            tp2: sw.tp2 ?? sw.tp1,
            sl: sw.sl,
            riskRewardPlanned: sw.riskReward,
            reasonBuy: `${SWING_STATUS_LABEL[sw.status]} — ${SWING_SETUP_LABEL[sw.setupType]} (skor ${sw.scores.total}). ${sw.conclusion.why}`,
            reasonAvoid: `${sw.conclusion.reasonsNotToEnter} Batas entry ${sw.maxEntry?.toLocaleString('id-ID') ?? '-'} — jangan kejar.`,
          });
        }
        if (inputs.length === 0) {
          setJurnalMessage({ type: 'error', text: 'Belum ada saham berstatus SWING BUY SETUP — kandidat SWING WAIT tidak dimasukkan ke Jurnal.' });
          return;
        }
      }

      const res = await journal.addEntries(inputs);
      setJurnalMessage(
        res.ok
          ? { type: 'success', text: `${inputs.length} saham ditambahkan ke Jurnal.` }
          : { type: 'error', text: res.message ?? 'Gagal menyimpan ke Jurnal.' }
      );
    } finally {
      setCreatingJurnal(false);
    }
  }, [filterId, results, journal]);

  const btnSecondary = 'inline-flex h-9 items-center gap-2 rounded-lg border border-(--sv-border) bg-(--sv-surface) px-3 text-sm font-medium text-(--sv-text) hover:bg-(--sv-bg) disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <div className={cn('sv-theme flex min-h-screen w-full flex-col', screenerInter.variable)}>
      <ScreenerHeader
        query={query}
        onQueryChange={handleQueryChange}
        lastUpdatedAt={lastUpdatedAt}
        ihsg={market.ihsg}
        onOpenDrawer={() => setDrawerOpen(true)}
      />

      <div className="flex flex-1">
        {drawerOpen && (
          <div className="fixed inset-0 z-40 bg-slate-900/40 xl:hidden" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
        )}

        <aside
          aria-label="Menu dan filter"
          className={cn(
            'fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col gap-6 overflow-y-auto border-r border-(--sv-border) bg-(--sv-surface) p-4 transition-transform duration-300 ease-out',
            drawerOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full',
            'xl:sticky xl:top-16 xl:z-auto xl:h-[calc(100vh-4rem)] xl:w-64 xl:max-w-none xl:shrink-0 xl:translate-x-0 xl:shadow-none',
          )}
        >
          <div className="flex items-center justify-between xl:hidden">
            <span className="text-sm font-semibold text-(--sv-text)">Menu & Filter</span>
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Tutup"
              className="flex size-8 items-center justify-center rounded-lg border border-(--sv-border) text-(--sv-text)"
            >
              <X className="size-4" strokeWidth={2} />
            </button>
          </div>
          <ScreenerNav
            watchlistOnly={watchlistOnly}
            watchlistCount={watchlist.tickers.length}
            onToggleWatchlist={() => { setWatchlistOnly((w) => !w); setPage(1); setDrawerOpen(false); }}
          />
          <div className="border-t border-(--sv-border) pt-5">
            <ScreenerFilters
              draft={draftFilters}
              onChange={setDraftFilters}
              sectors={sectors}
              onApply={applyFilters}
              onReset={resetFilters}
              dirty={filtersDirty}
            />
          </div>
          <p className="mt-auto text-[11px] text-(--sv-muted)">© {new Date().getFullYear()} {SITE_NAME} · Data EOD, bukan prediksi harga.</p>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col gap-5 px-4 py-5 pb-28 sm:px-6 xl:pb-8">
          <MarketSummary market={market} summaries={summaries} />

          <aside aria-label="Insight pasar" className="grid gap-4 md:grid-cols-2">
            <GainerLoserPanel summaries={summaries ?? []} />
            {/* <ValuationSummary tickers={sortedRows.map((r) => r.summary.ticker)} verdictByTicker={verdictByTicker} /> */}
          </aside>

          <section aria-labelledby="screener-title" className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 id="screener-title" className="text-xl font-bold text-(--sv-text) sm:text-2xl">Screener Saham</h1>
                <p className="mt-0.5 text-sm text-(--sv-muted)">
                  Temukan saham berdasarkan fundamental, teknikal, valuasi, momentum dan risiko.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {canCreateJurnal && (
                  <button
                    type="button"
                    onClick={handleCreateJurnal}
                    disabled={creatingJurnal}
                    title={`Simpan top ${JOURNAL_TOP_N} saham berstatus ${isDayTrading ? 'DAY TRADE SETUP' : 'SWING BUY SETUP'} (berdasarkan skor) ke Jurnal`}
                    className={btnSecondary}
                  >
                    {creatingJurnal ? <Loader2 className="size-4 animate-spin" /> : <NotebookPen className="size-4" strokeWidth={2} />}
                    Create Jurnal
                  </button>
                )}
                <button type="button" onClick={handleSaveScreener} className={btnSecondary}>
                  {savedFlash ? <BookmarkCheck className="size-4 text-emerald-600" strokeWidth={2} /> : <Bookmark className="size-4" strokeWidth={2} />}
                  {savedFlash ? 'Tersimpan' : 'Simpan Screener'}
                </button>
                <button type="button" onClick={handleRefresh} disabled={isBusy} className={btnSecondary}>
                  <RefreshCw className={cn('size-4', isBusy && 'animate-spin')} strokeWidth={2} />
                  Refresh
                </button>
              </div>
            </div>

            <ScreenerTabs
              items={FILTER_ITEMS}
              selected={filterId}
              onSelect={handleSelectFilter}
              count={status === 'done' ? results.length : null}
            />

            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
              <p className="text-(--sv-muted)">
                <span className="font-medium text-(--sv-text)">{activeFilterInfo.label}:</span>{' '}
                {activeFilterInfo.description}
                {activeFilterInfo.criteria.length > 0 && (
                  <span className="ml-1 inline-flex align-middle">
                    <InfoTip term={`Kriteria ${activeFilterInfo.label}`} text={activeFilterInfo.criteria.join(' · ')} />
                  </span>
                )}
              </p>
              {status === 'done' && (
                <p className="text-(--sv-muted)">
                  <b className="tabular-nums text-(--sv-text)">{sortedRows.length}</b> hasil dari {summaries?.length ?? 0} saham
                  {anyFilter && (
                    <button type="button" onClick={() => { resetFilters(); setQuery(''); }} className="ml-2 font-medium text-(--sv-primary) hover:underline">
                      Hapus filter
                    </button>
                  )}
                </p>
              )}
            </div>

            {status === 'scanning' && (
              <div className="rounded-xl border border-(--sv-border) bg-(--sv-surface) p-3">
                <div className="flex items-center justify-between text-sm text-(--sv-muted)">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin text-(--sv-primary)" />
                    Menganalisis kandidat {activeFilterInfo.label}…
                  </span>
                  <span className="tabular-nums">{progress.checked}/{progress.total}</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div className="h-full rounded-full bg-(--sv-primary) transition-[width] duration-300" style={{ width: `${progressPct}%` }} />
                </div>
              </div>
            )}

            {status === 'done' && verdictProgress && verdictProgress.done < verdictProgress.total && (
              <div className="rounded-xl border border-(--sv-border) bg-(--sv-surface) p-3">
                <div className="flex items-center justify-between text-sm text-(--sv-muted)">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin text-(--sv-primary)" />
                    Menghitung fase, fundamental &amp; valuasi untuk filter/urutan…
                  </span>
                  <span className="tabular-nums">{verdictProgress.done}/{verdictProgress.total}</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div
                    className="h-full rounded-full bg-(--sv-primary) transition-[width] duration-300"
                    style={{ width: `${Math.round((verdictProgress.done / Math.max(1, verdictProgress.total)) * 100)}%` }}
                  />
                </div>
              </div>
            )}

            {status === 'error' && errorMessage && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-200">
                <span className="flex items-center gap-2"><AlertCircle className="size-4 shrink-0" />{errorMessage}</span>
                <button type="button" onClick={handleRefresh} className="rounded-lg bg-rose-600 px-3 py-1.5 font-medium text-white hover:bg-rose-700">
                  Coba lagi
                </button>
              </div>
            )}

            {jurnalMessage && (
              <div
                className={cn(
                  'flex items-center justify-between gap-2 rounded-xl border px-4 py-3 text-sm font-medium',
                  jurnalMessage.type === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-200'
                    : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-200'
                )}
              >
                <span>{jurnalMessage.text}</span>
                {jurnalMessage.type === 'success' && (
                  <Link href="/jurnal" className="shrink-0 underline underline-offset-2">Lihat Jurnal →</Link>
                )}
              </div>
            )}

            {status !== 'error' && isDayTrading && (
              <DayTradingTable
                rows={pageRows}
                startIndex={(currentPage - 1) * PAGE_SIZE}
                loading={isBusy}
                sort={sort}
                onSort={handleSort}
                emptyHint={
                  watchlistOnly && watchlist.tickers.length === 0
                    ? 'Watchlist Anda masih kosong — tandai saham dengan ikon bintang.'
                    : 'Tidak ada saham berstatus DAY TRADE SETUP / WATCH dari data EOD terakhir. Jangan memaksakan entry.'
                }
                onResetFilters={anyFilter ? () => { resetFilters(); setQuery(''); } : undefined}
                isWatchlisted={watchlist.has}
                onToggleWatchlist={watchlist.toggle}
                isCompareSelected={isCompareSelected}
                onToggleCompare={toggleCompare}
              />
            )}

            {status !== 'error' && isSwingTrading && (
              <SwingTradingTable
                rows={pageRows}
                startIndex={(currentPage - 1) * PAGE_SIZE}
                loading={isBusy}
                sort={sort}
                onSort={handleSort}
                emptyHint={
                  watchlistOnly && watchlist.tickers.length === 0
                    ? 'Watchlist Anda masih kosong — tandai saham dengan ikon bintang.'
                    : 'Tidak ada saham berstatus SWING BUY SETUP / SWING WAIT dari data EOD terakhir. Tidak ada setup = tidak entry.'
                }
                onResetFilters={anyFilter ? () => { resetFilters(); setQuery(''); } : undefined}
                isWatchlisted={watchlist.has}
                onToggleWatchlist={watchlist.toggle}
                isCompareSelected={isCompareSelected}
                onToggleCompare={toggleCompare}
              />
            )}

            {status !== 'error' && !isSetupTab && (
              <ScreenerTable
                rows={pageRows}
                startIndex={(currentPage - 1) * PAGE_SIZE}
                verdictByTicker={verdictByTicker}
                loading={isBusy}
                sort={sort}
                onSort={handleSort}
                emptyHint={
                  watchlistOnly && watchlist.tickers.length === 0
                    ? 'Watchlist Anda masih kosong — tandai saham dengan ikon bintang.'
                    : verdictProgress && verdictProgress.done < verdictProgress.total
                      ? 'Masih menganalisis kandidat — hasil akan muncul saat data selesai dihitung.'
                      : 'Coba longgarkan filter, ganti tab preset, atau ubah kata kunci pencarian.'
                }
                onResetFilters={anyFilter ? () => { resetFilters(); setQuery(''); } : undefined}
                isWatchlisted={watchlist.has}
                onToggleWatchlist={watchlist.toggle}
                isCompareSelected={isCompareSelected}
                onToggleCompare={toggleCompare}
              />
            )}

            {!isBusy && (
              <ScreenerPagination page={currentPage} pageSize={PAGE_SIZE} total={sortedRows.length} onPage={setPage} />
            )}
          </section>
        </main>
      </div>

      {compareSelection.length > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
          <div className="flex items-center gap-3 rounded-xl border border-(--sv-border) bg-(--sv-surface) px-4 py-2.5 shadow-lg">
            <GitCompare className="size-4 shrink-0 text-(--sv-primary)" strokeWidth={2} />
            <span className="text-sm font-medium text-(--sv-text)">
              {compareSelection.length === 2
                ? `${compareSelection[0]} vs ${compareSelection[1]}`
                : `${compareSelection[0]} dipilih — pilih 1 saham lagi`}
            </span>
            {compareSelection.length === 2 && (
              <Link
                href={`/compare?a=${compareSelection[0]}&b=${compareSelection[1]}`}
                className="rounded-lg bg-(--sv-primary) px-3 py-1.5 text-sm font-semibold text-(--sv-primary-fg)"
              >
                Bandingkan →
              </Link>
            )}
            <button
              type="button"
              onClick={() => setCompareSelection([])}
              aria-label="Batalkan pilihan bandingkan"
              className="flex size-7 shrink-0 items-center justify-center rounded-md text-(--sv-muted) hover:text-rose-500"
            >
              <X className="size-4" strokeWidth={2} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
