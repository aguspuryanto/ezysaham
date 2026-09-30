'use client';

/**
 * SectorPage.tsx
 *
 * /sektor — sector overview + per-sector stock list, sharing the Screener's
 * header, sidebar nav, `.sv-theme` tokens and ScreenerTable (with the same
 * lazily computed verdict columns). Data: getStockSummaries (EOD).
 */

import { AlertCircle, ArrowLeft, BarChart3, GitCompare, Layers, LayoutGrid, PieChart, RefreshCw, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getStockFundamentals, getStockHistory, getStockSummariesWithTimestamp } from '@/data/repositories/StockRepository';
import { computeScreenerVerdict, ScreenerVerdict } from '@/domain/analysis/screenerVerdict';
import { StockSummary } from '@/domain/models/Stock';
import { mapWithConcurrency } from '@/lib/concurrency';
import { cn } from '@/lib/format';
import { SITE_NAME } from '@/lib/site';
import { GainerLoserPanel } from '../screener/components/GainerLoserPanel';
import { useMarketSeries } from '../screener/components/MarketSummary';
import { ScreenerResult } from '../screener/components/ResultsTable';
import { ScreenerHeader } from '../screener/components/ScreenerHeader';
import { ScreenerNav } from '../screener/components/ScreenerNav';
import { ScreenerPagination, ScreenerSort, ScreenerSortKey, ScreenerTable, VERDICT_SORT_KEYS } from '../screener/components/ScreenerTable';
import { ScreenerTabItem, ScreenerTabs } from '../screener/components/ScreenerTabs';
import { screenerInter } from '../screener/fonts';
import { useWatchlist } from '../screener/hooks/useWatchlist';
import {
  SectorBreadcrumb,
  SectorCard,
  SectorCardSkeleton,
  SectorHeader,
  SectorHeaderSkeleton,
  SectorStats,
  SectorStatsSkeleton,
} from './components/SectorCards';
import { buildSectorGroups, computeBreadth, SectorSortKey, sortSectorGroups } from './sectorGroups';

type Status = 'loading' | 'ready' | 'error';

const PAGE_SIZE = 25;
const HISTORY_CONCURRENCY = 6;
const DEFAULT_SORT: ScreenerSort = { key: 'change', dir: 'desc' };

const SECTOR_SORT_ITEMS: ScreenerTabItem[] = [
  { id: 'cap', label: 'Market Cap', icon: PieChart },
  { id: 'change', label: 'Perubahan', icon: BarChart3 },
  { id: 'count', label: 'Jumlah Saham', icon: LayoutGrid },
];

function sortValue(s: StockSummary, key: ScreenerSortKey, v?: ScreenerVerdict): number | string | null {
  switch (key) {
    case 'ticker': return s.ticker;
    case 'change': return s.percentChange1D;
    case 'price': return s.lastClose;
    case 'volume': return s.volume;
    case 'fundamental': return v ? v.fundamentalScore.composite : null;
    case 'upside': return v?.valuation.upsidePct ?? null;
  }
}

export function SectorPage({ initialSector }: { initialSector: string | null }) {
  const router = useRouter();
  const market = useMarketSeries();
  const watchlist = useWatchlist();
  const [summaries, setSummaries] = useState<StockSummary[] | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [selectedSector, setSelectedSector] = useState<string | null>(initialSector);
  const [sectorSort, setSectorSort] = useState<SectorSortKey>('cap');
  const [subSector, setSubSector] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<ScreenerSort>(DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [compareSelection, setCompareSelection] = useState<string[]>([]);
  const [verdictByTicker, setVerdictByTicker] = useState<Record<string, ScreenerVerdict>>({});
  const verdictAttemptedRef = useRef<Set<string>>(new Set());

  // Mobile/tablet drawer: lock body scroll and close on Escape (same behaviour as ScreenerPage).
  useEffect(() => {
    if (!drawerOpen) return;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawerOpen(false); };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [drawerOpen]);

  const load = useCallback(() => {
    setStatus('loading');
    getStockSummariesWithTimestamp()
      .then(({ summaries, lastUpdatedAt }) => {
        setSummaries(summaries);
        setLastUpdatedAt(lastUpdatedAt);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, []);

  useEffect(() => {
    Promise.resolve().then(load);
  }, [load]);

  const refresh = useCallback(() => {
    verdictAttemptedRef.current = new Set();
    setVerdictByTicker({});
    load();
  }, [load]);

  const groups = useMemo(() => (summaries ? buildSectorGroups(summaries) : []), [summaries]);
  const marketBreadth = useMemo(() => computeBreadth(summaries ?? []), [summaries]);
  const activeGroup = useMemo(() => groups.find((g) => g.sector === selectedSector) ?? null, [groups, selectedSector]);

  const selectSector = useCallback((sector: string | null) => {
    setSelectedSector(sector);
    setSubSector('all');
    setQuery('');
    setSort(DEFAULT_SORT);
    setPage(1);
    setCompareSelection([]);
    router.replace(sector ? `/sektor?sector=${encodeURIComponent(sector)}` : '/sektor', { scroll: false });
    window.scrollTo({ top: 0 });
  }, [router]);

  const handleQueryChange = useCallback((q: string) => {
    setQuery(q);
    setPage(1);
  }, []);

  // Enter on a full ticker jumps to Detail Emiten, like the detail page's search.
  const handleSubmitQuery = useCallback((q: string) => {
    const code = q.trim().toUpperCase();
    if (/^[A-Z]{4}$/.test(code) && summaries?.some((s) => s.ticker === code)) router.push(`/screener/${code}`);
  }, [router, summaries]);

  // ── Overview ───────────────────────────────────────────────────────────────
  const q = query.trim().toLowerCase();
  const visibleGroups = useMemo(() => {
    const matched = q
      ? groups.filter((g) => g.sector.toLowerCase().includes(q) || g.stocks.some((s) => s.ticker.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)))
      : groups;
    return sortSectorGroups(matched, sectorSort);
  }, [groups, q, sectorSort]);

  // ── Sector detail ──────────────────────────────────────────────────────────
  const subSectorItems = useMemo<ScreenerTabItem[]>(() => {
    if (!activeGroup) return [];
    const subs = [...new Set(activeGroup.stocks.map((s) => s.subSector).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    return [{ id: 'all', label: 'Semua', icon: LayoutGrid }, ...subs.map((s) => ({ id: s, label: s, icon: Layers }))];
  }, [activeGroup]);

  const baseRows = useMemo<ScreenerResult[]>(() => {
    if (!activeGroup) return [];
    return activeGroup.stocks
      .filter((s) => (subSector === 'all' || s.subSector === subSector) && (!q || s.ticker.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)))
      .map((summary) => ({ summary, evaluation: { passed: true, reasons: [], failed: [] } }));
  }, [activeGroup, subSector, q]);

  const sortedRows = useMemo(() => {
    const mul = sort.dir === 'asc' ? 1 : -1;
    return [...baseRows].sort((a, b) => {
      const va = sortValue(a.summary, sort.key, verdictByTicker[a.summary.ticker]);
      const vb = sortValue(b.summary, sort.key, verdictByTicker[b.summary.ticker]);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === 'string' && typeof vb === 'string') return mul * va.localeCompare(vb);
      return mul * ((va as number) - (vb as number));
    });
  }, [baseRows, sort, verdictByTicker]);

  const pageCount = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = useMemo(() => sortedRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE), [sortedRows, currentPage]);

  // Verdict columns (phase, trend, fundamental, valuation…) are computed lazily — only for the
  // visible page, or for the whole sector when sorting by a verdict-based column.
  const verdictTargets = VERDICT_SORT_KEYS.includes(sort.key) ? baseRows : pageRows;
  useEffect(() => {
    const pending = verdictTargets.filter((r) => !verdictAttemptedRef.current.has(r.summary.ticker));
    if (pending.length === 0) return;
    pending.forEach((r) => verdictAttemptedRef.current.add(r.summary.ticker));
    mapWithConcurrency(pending, HISTORY_CONCURRENCY, async ({ summary }) => {
      const [bars, fundamentals] = await Promise.all([getStockHistory(summary.ticker), getStockFundamentals(summary.ticker)]);
      return [summary.ticker, computeScreenerVerdict(summary, bars, fundamentals)] as const;
    }).then((entries) => {
      setVerdictByTicker((prev) => {
        const next = { ...prev };
        for (const [ticker, verdict] of entries) next[ticker] = verdict;
        return next;
      });
    });
  }, [verdictTargets]);

  const handleSort = useCallback((key: ScreenerSortKey) => {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'ticker' ? 'asc' : 'desc' }));
    setPage(1);
  }, []);

  const toggleCompare = useCallback((ticker: string) => {
    setCompareSelection((prev) => {
      if (prev.includes(ticker)) return prev.filter((t) => t !== ticker);
      if (prev.length >= 2) return [prev[1], ticker];
      return [...prev, ticker];
    });
  }, []);
  const isCompareSelected = useCallback((ticker: string) => compareSelection.includes(ticker), [compareSelection]);

  const loading = status === 'loading';
  const unknownSector = status === 'ready' && selectedSector != null && !activeGroup;
  const inDetail = selectedSector != null && !unknownSector;
  const btnSecondary = 'inline-flex h-9 items-center gap-2 rounded-lg border border-(--sv-border) bg-(--sv-surface) px-3 text-sm font-medium text-(--sv-text) hover:bg-(--sv-bg) disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <div className={cn('sv-theme flex min-h-screen w-full flex-col', screenerInter.variable)}>
      <ScreenerHeader
        query={query}
        onQueryChange={handleQueryChange}
        onSubmitQuery={handleSubmitQuery}
        lastUpdatedAt={lastUpdatedAt}
        ihsg={market.ihsg}
        onOpenDrawer={() => setDrawerOpen(true)}
      />

      <div className="flex flex-1">
        {drawerOpen && <div className="fixed inset-0 z-40 bg-slate-900/40 xl:hidden" onClick={() => setDrawerOpen(false)} aria-hidden="true" />}
        <aside
          aria-label="Menu utama"
          className={cn(
            'fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col gap-6 overflow-y-auto border-r border-(--sv-border) bg-(--sv-surface) p-4 transition-transform duration-300 ease-out',
            drawerOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full',
            'xl:sticky xl:top-16 xl:z-auto xl:h-[calc(100vh-4rem)] xl:w-64 xl:max-w-none xl:shrink-0 xl:translate-x-0 xl:shadow-none',
          )}
        >
          <div className="flex items-center justify-between xl:hidden">
            <span className="text-sm font-semibold text-(--sv-text)">Menu</span>
            <button type="button" onClick={() => setDrawerOpen(false)} aria-label="Tutup" className="flex size-8 items-center justify-center rounded-lg border border-(--sv-border) text-(--sv-text)">
              <X className="size-4" strokeWidth={2} />
            </button>
          </div>
          <ScreenerNav watchlistOnly={false} watchlistCount={watchlist.tickers.length} onToggleWatchlist={() => router.push('/screener')} />
          <p className="mt-auto text-[11px] text-(--sv-muted)">© {new Date().getFullYear()} {SITE_NAME} · Data EOD, bukan prediksi harga.</p>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col gap-5 px-4 py-5 pb-28 sm:px-6 xl:pb-8">
          <SectorBreadcrumb sector={inDetail ? selectedSector : null} onBack={() => selectSector(null)} />

          {status === 'error' && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-200">
              <span className="flex items-center gap-2"><AlertCircle className="size-4 shrink-0" />Gagal memuat daftar saham. Periksa koneksi lalu coba lagi.</span>
              <button type="button" onClick={refresh} className="rounded-lg bg-rose-600 px-3 py-1.5 font-medium text-white hover:bg-rose-700">Coba lagi</button>
            </div>
          )}

          {inDetail ? (
            <>
              {loading || !activeGroup ? <SectorHeaderSkeleton /> : <SectorHeader group={activeGroup} />}

              {activeGroup && (
                <aside aria-label="Pergerakan sektor" className="grid gap-4 md:grid-cols-2">
                  <GainerLoserPanel summaries={activeGroup.stocks} />
                </aside>
              )}

              <section aria-labelledby="sector-stocks-title" className="flex min-w-0 flex-col gap-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h2 id="sector-stocks-title" className="text-lg font-semibold text-(--sv-text)">Daftar Saham</h2>
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => selectSector(null)} className={btnSecondary}>
                      <ArrowLeft className="size-4" strokeWidth={2} /> Semua Sektor
                    </button>
                    <button type="button" onClick={refresh} disabled={loading} className={btnSecondary}>
                      <RefreshCw className={cn('size-4', loading && 'animate-spin')} strokeWidth={2} /> Refresh
                    </button>
                  </div>
                </div>

                {subSectorItems.length > 2 && (
                  <ScreenerTabs
                    items={subSectorItems}
                    selected={subSector}
                    onSelect={(id) => { setSubSector(id); setPage(1); }}
                    count={baseRows.length}
                  />
                )}

                {!loading && activeGroup && (
                  <p className="text-sm text-(--sv-muted)">
                    <b className="tabular-nums text-(--sv-text)">{sortedRows.length}</b> dari {activeGroup.stocks.length} saham
                    {(q || subSector !== 'all') && (
                      <button type="button" onClick={() => { setQuery(''); setSubSector('all'); setPage(1); }} className="ml-2 font-medium text-(--sv-primary) hover:underline">
                        Hapus filter
                      </button>
                    )}
                  </p>
                )}

                {status !== 'error' && (
                  <ScreenerTable
                    rows={pageRows}
                    startIndex={(currentPage - 1) * PAGE_SIZE}
                    verdictByTicker={verdictByTicker}
                    loading={loading}
                    sort={sort}
                    onSort={handleSort}
                    emptyHint="Tidak ada saham di sektor ini yang cocok dengan pencarian atau sub-sektor terpilih."
                    onResetFilters={q || subSector !== 'all' ? () => { setQuery(''); setSubSector('all'); setPage(1); } : undefined}
                    isWatchlisted={watchlist.has}
                    onToggleWatchlist={watchlist.toggle}
                    isCompareSelected={isCompareSelected}
                    onToggleCompare={toggleCompare}
                  />
                )}

                {!loading && <ScreenerPagination page={currentPage} pageSize={PAGE_SIZE} total={sortedRows.length} onPage={setPage} />}
              </section>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h1 className="text-xl font-bold text-(--sv-text) sm:text-2xl">Sektor Saham</h1>
                  <p className="mt-0.5 text-sm text-(--sv-muted)">Peta performa harian seluruh sektor BEI/IDX — pilih sektor untuk melihat daftar sahamnya.</p>
                </div>
                <button type="button" onClick={refresh} disabled={loading} className={btnSecondary}>
                  <RefreshCw className={cn('size-4', loading && 'animate-spin')} strokeWidth={2} /> Refresh
                </button>
              </div>

              {unknownSector && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200">
                  Sektor &ldquo;{selectedSector}&rdquo; tidak ditemukan — menampilkan semua sektor.
                </div>
              )}

              {loading ? <SectorStatsSkeleton /> : status === 'ready' && (
                <SectorStats groups={groups} stockCount={summaries?.length ?? 0} breadth={marketBreadth} />
              )}

              {status !== 'error' && (
                <section aria-labelledby="sector-list-title" className="flex flex-col gap-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <h2 id="sector-list-title" className="text-lg font-semibold text-(--sv-text)">
                      Semua Sektor
                      {!loading && <span className="ml-2 text-sm font-normal text-(--sv-muted)">{visibleGroups.length} sektor</span>}
                    </h2>
                    <ScreenerTabs items={SECTOR_SORT_ITEMS} selected={sectorSort} onSelect={(id) => setSectorSort(id as SectorSortKey)} count={null} />
                  </div>

                  {loading ? (
                    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                      {Array.from({ length: 6 }, (_, i) => <SectorCardSkeleton key={i} />)}
                    </div>
                  ) : visibleGroups.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-(--sv-border) bg-(--sv-surface) px-6 py-14 text-center">
                      <p className="text-base font-semibold text-(--sv-text)">Tidak ada sektor yang cocok</p>
                      <p className="text-sm text-(--sv-muted)">Tidak ada sektor atau saham yang cocok dengan &ldquo;{query}&rdquo;.</p>
                      <button type="button" onClick={() => setQuery('')} className="mt-1 rounded-lg border border-(--sv-border) px-3.5 py-2 text-sm font-medium text-(--sv-text) hover:bg-(--sv-bg)">
                        Hapus pencarian
                      </button>
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                      {visibleGroups.map((g) => <SectorCard key={g.sector} group={g} onSelect={selectSector} />)}
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </main>
      </div>

      {compareSelection.length > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
          <div className="flex items-center gap-3 rounded-xl border border-(--sv-border) bg-(--sv-surface) px-4 py-2.5 shadow-lg">
            <GitCompare className="size-4 shrink-0 text-(--sv-primary)" strokeWidth={2} />
            <span className="text-sm font-medium text-(--sv-text)">
              {compareSelection.length === 2 ? `${compareSelection[0]} vs ${compareSelection[1]}` : `${compareSelection[0]} dipilih — pilih 1 saham lagi`}
            </span>
            {compareSelection.length === 2 && (
              <Link href={`/compare?a=${compareSelection[0]}&b=${compareSelection[1]}`} className="rounded-lg bg-(--sv-primary) px-3 py-1.5 text-sm font-semibold text-(--sv-primary-fg)">
                Bandingkan →
              </Link>
            )}
            <button type="button" onClick={() => setCompareSelection([])} aria-label="Batalkan pilihan bandingkan" className="flex size-7 shrink-0 items-center justify-center rounded-md text-(--sv-muted) hover:text-rose-500">
              <X className="size-4" strokeWidth={2} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
