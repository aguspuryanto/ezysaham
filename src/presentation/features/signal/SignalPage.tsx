'use client';

/**
 * SignalPage.tsx
 *
 * SARA AI Signals dashboard (features_signal.md). Shares the Screener's header,
 * sidebar nav and `.sv-theme` tokens. Data comes from SignalRepository
 * (mock for now) via useSignals — this file only filters and lays it out.
 */

import { AlertCircle, Clock, Flame, Loader2, RefreshCw, Sparkles, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { todayWib } from '@/data/repositories/SignalRepository';
import { POTENTIAL_25_FILTER, SignalFilterState, StockSignal } from '@/domain/models/Signal';
import { cn } from '@/lib/format';
import { SITE_NAME } from '@/lib/site';
import { useMarketSeries } from '../screener/components/MarketSummary';
import { ScreenerHeader } from '../screener/components/ScreenerHeader';
import { ScreenerNav } from '../screener/components/ScreenerNav';
import { screenerInter } from '../screener/fonts';
import { useWatchlist } from '../screener/hooks/useWatchlist';
import { PerformanceSummary, PerformanceSummarySkeleton } from './components/PerformanceSummary';
import { Potential25Card, Potential25Drawer, Potential25Summary, Potential25Table } from './components/Potential25';
import { SignalCard } from './components/SignalCard';
import { SignalDetailDrawer } from './components/SignalDetailDrawer';
import { SignalFilters } from './components/SignalFilters';
import { SignalCardSkeleton, SignalEmptyState, SignalTableSkeleton } from './components/SignalStates';
import { SignalTable } from './components/SignalTable';
import { fmtDateLong, fmtTimestamp } from './signalUi';
import { Potential25Candidate, usePotential25 } from './usePotential25';
import { useSignals } from './useSignals';

const TOP_N = 3;

function defaultFilters(date: string): SignalFilterState {
  return { date, action: 'ALL', pattern: 'ALL', minScore: 0, search: '' };
}

function matches(s: StockSignal, f: SignalFilterState): boolean {
  if (f.action !== 'ALL' && s.action !== f.action) return false;
  if (f.pattern !== 'ALL' && s.pattern !== f.pattern) return false;
  if (s.saraScore < f.minScore) return false;
  const q = f.search.trim().toUpperCase();
  if (q && !s.ticker.includes(q) && !s.companyName.toUpperCase().includes(q)) return false;
  return true;
}

export function SignalPage() {
  const router = useRouter();
  const market = useMarketSeries();
  const watchlist = useWatchlist();
  const [today] = useState(todayWib);
  const [filters, setFilters] = useState<SignalFilterState>(() => defaultFilters(today));
  const [selected, setSelected] = useState<StockSignal | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { loading, data, error, refresh } = useSignals(filters.date);
  const potentialMode = filters.action === POTENTIAL_25_FILTER;
  const potential = usePotential25(filters.date, potentialMode, market.ihsgBars, !market.loading);
  const [selectedP25, setSelectedP25] = useState<Potential25Candidate | null>(null);

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

  const filtered = useMemo(
    () => (data?.signals ?? []).filter((s) => matches(s, filters)).sort((a, b) => b.saraScore - a.saraScore),
    [data, filters],
  );

  // Best actionable setups first: entry allowed, then highest SARA Score.
  const topSignals = useMemo(
    () => [...filtered].sort((a, b) => Number(b.decision.buyAllowed) - Number(a.decision.buyAllowed) || b.saraScore - a.saraScore).slice(0, TOP_N),
    [filtered],
  );

  const allowedCount = filtered.filter((s) => s.decision.buyAllowed).length;
  const isFiltered = filters.action !== 'ALL' || filters.pattern !== 'ALL' || filters.minScore > 0 || filters.search.trim() !== '';
  const resetFilters = () => setFilters((f) => ({ ...defaultFilters(f.date) }));
  const closeDetail = useCallback(() => setSelected(null), []);
  const closeP25 = useCallback(() => setSelectedP25(null), []);

  // Potential 25%: SKIP (<60) is never shown; Min. Score and search still apply.
  const p25Rows = useMemo(() => {
    const q = filters.search.trim().toUpperCase();
    return (potential.scan?.candidates ?? []).filter((c) =>
      c.result.classification !== 'SKIP'
      && c.result.score >= filters.minScore
      && (!q || c.ticker.includes(q) || c.companyName.toUpperCase().includes(q)));
  }, [potential.scan, filters.minScore, filters.search]);
  const p25Top = useMemo(
    () => [...p25Rows]
      .sort((a, b) => Number(b.result.action === 'BUY_CANDIDATE') - Number(a.result.action === 'BUY_CANDIDATE') || b.result.score - a.result.score)
      .slice(0, TOP_N),
    [p25Rows],
  );
  const noBatch = !loading && data != null && data.signals.length === 0;
  const busy = potentialMode ? potential.loading : loading;

  const btnSecondary = 'inline-flex h-9 items-center gap-2 rounded-lg border border-(--sv-border) bg-(--sv-surface) px-3 text-sm font-medium text-(--sv-text) hover:bg-(--sv-bg) disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <div className={cn('sv-theme flex min-h-screen w-full flex-col', screenerInter.variable)}>
      <ScreenerHeader
        query={filters.search}
        onQueryChange={(q) => setFilters((f) => ({ ...f, search: q }))}
        lastUpdatedAt={data?.lastUpdated ? new Date(data.lastUpdated) : null}
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="flex items-center gap-2 text-xl font-bold text-(--sv-text) sm:text-2xl">
                <Sparkles className="size-5 text-(--sv-primary)" strokeWidth={2} />
                SARA AI Signals
              </h1>
              <p className="mt-0.5 text-sm text-(--sv-muted)">Daily algorithmic stock signals — jawab &ldquo;Boleh entry?&rdquo; dalam 10 detik.</p>
              <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-(--sv-muted)">
                <Clock className="size-3.5" strokeWidth={2} />
                {potentialMode
                  ? potential.loading
                    ? 'Memindai saham Rp50–999…'
                    : potential.scan?.dataDate
                      ? <>Potential 25% · data EOD <span className="font-medium text-(--sv-text)">{fmtDateLong(potential.scan.dataDate)}</span></>
                      : 'Potential 25%'
                  : loading
                  ? 'Memuat sinyal…'
                  : data?.lastUpdated
                    ? <>Last updated: <span className="font-medium text-(--sv-text)">{fmtTimestamp(data.lastUpdated)}</span></>
                    : `Belum ada batch sinyal untuk ${fmtDateLong(filters.date)}`}
              </p>
            </div>
            <button type="button" onClick={potentialMode ? potential.rescan : refresh} disabled={busy} className={btnSecondary}>
              <RefreshCw className={cn('size-4', busy && 'animate-spin')} strokeWidth={2} />
              Refresh
            </button>
          </div>

          {!potentialMode && (loading || !data ? <PerformanceSummarySkeleton /> : <PerformanceSummary data={data.performance} />)}

          <section aria-label="Filter sinyal" className="rounded-xl border border-(--sv-border) bg-(--sv-surface) p-4 shadow-(--sv-shadow)">
            <SignalFilters value={filters} onChange={setFilters} maxDate={today} />
          </section>

          {potentialMode && (
            <>
              {potential.error && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-200">
                  <span className="flex items-center gap-2"><AlertCircle className="size-4 shrink-0" />{potential.error}</span>
                  <button type="button" onClick={potential.rescan} className="rounded-lg bg-rose-600 px-3 py-1.5 font-medium text-white hover:bg-rose-700">Coba lagi</button>
                </div>
              )}

              {potential.loading && (
                <div className="rounded-xl border border-(--sv-border) bg-(--sv-surface) p-3">
                  <div className="flex items-center justify-between text-sm text-(--sv-muted)">
                    <span className="inline-flex items-center gap-2"><Loader2 className="size-4 animate-spin text-(--sv-primary)" />Memindai momentum &amp; resistance saham Rp50–999…</span>
                    {potential.progress && <span className="tabular-nums">{potential.progress.checked}/{potential.progress.total}</span>}
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div
                      className="h-full rounded-full bg-(--sv-primary) transition-[width] duration-300"
                      style={{ width: `${potential.progress ? Math.round((potential.progress.checked / Math.max(1, potential.progress.total)) * 100) : 0}%` }}
                    />
                  </div>
                </div>
              )}

              {potential.scan && <Potential25Summary scan={potential.scan} shown={p25Rows.length} />}

              {!potential.error && (
                <>
                  <section aria-labelledby="p25-top-title" className="flex flex-col gap-3">
                    <h2 id="p25-top-title" className="flex items-center gap-2 text-lg font-semibold text-(--sv-text)">
                      <Flame className="size-5 text-orange-500" strokeWidth={2} />Top Potential 25% Candidates
                    </h2>
                    {potential.loading ? (
                      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">{Array.from({ length: TOP_N }, (_, i) => <SignalCardSkeleton key={i} />)}</div>
                    ) : p25Top.length === 0 ? (
                      <SignalEmptyState
                        title="Belum ada kandidat Potential 25%"
                        hint="Tidak ada saham Rp50–999 yang lolos filter momentum, volume dan upside ≥25% untuk tanggal ini. Coba tanggal lain atau turunkan minimum score."
                        action={filters.minScore > 0 || filters.search ? { label: 'Reset filter', onClick: () => setFilters((f) => ({ ...f, minScore: 0, search: '' })) } : undefined}
                      />
                    ) : (
                      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                        {p25Top.map((c) => <Potential25Card key={c.ticker} candidate={c} onSelect={setSelectedP25} />)}
                      </div>
                    )}
                  </section>

                  <section aria-labelledby="p25-all-title" className="flex flex-col gap-3">
                    <h2 id="p25-all-title" className="text-lg font-semibold text-(--sv-text)">Semua Kandidat</h2>
                    {potential.loading ? <SignalTableSkeleton /> : p25Rows.length > 0 && <Potential25Table candidates={p25Rows} onSelect={setSelectedP25} />}
                  </section>
                </>
              )}
            </>
          )}

          {!potentialMode && error && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-200">
              <span className="flex items-center gap-2"><AlertCircle className="size-4 shrink-0" />{error}</span>
              <button type="button" onClick={refresh} className="rounded-lg bg-rose-600 px-3 py-1.5 font-medium text-white hover:bg-rose-700">Coba lagi</button>
            </div>
          )}

          {potentialMode ? null : noBatch ? (
            <SignalEmptyState
              title="Belum ada sinyal"
              hint={`Tidak ada batch sinyal untuk ${fmtDateLong(filters.date)} — kemungkinan bukan hari bursa. Pilih tanggal lain.`}
              action={filters.date !== today ? { label: 'Kembali ke hari ini', onClick: () => setFilters((f) => ({ ...f, date: today })) } : undefined}
            />
          ) : !error && (
            <>
              <section aria-labelledby="top-signals-title" className="flex flex-col gap-3">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 id="top-signals-title" className="text-lg font-semibold text-(--sv-text)">Top Signals Hari Ini</h2>
                  {!loading && (
                    <span className="text-sm text-(--sv-muted)">
                      <b className="tabular-nums text-emerald-600 dark:text-emerald-400">{allowedCount}</b> saham boleh entry
                    </span>
                  )}
                </div>
                {loading ? (
                  <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                    {Array.from({ length: TOP_N }, (_, i) => <SignalCardSkeleton key={i} />)}
                  </div>
                ) : topSignals.length === 0 ? (
                  <SignalEmptyState
                    title="Tidak ada sinyal yang cocok"
                    hint="Coba longgarkan filter signal, pattern, atau minimum score."
                    action={isFiltered ? { label: 'Reset filter', onClick: resetFilters } : undefined}
                  />
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                    {topSignals.map((s) => <SignalCard key={s.id} signal={s} onSelect={setSelected} />)}
                  </div>
                )}
              </section>

              <section aria-labelledby="all-signals-title" className="flex flex-col gap-3">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 id="all-signals-title" className="text-lg font-semibold text-(--sv-text)">Semua Sinyal</h2>
                  {!loading && data && (
                    <span className="text-sm text-(--sv-muted)">
                      <b className="tabular-nums text-(--sv-text)">{filtered.length}</b> dari {data.signals.length} saham
                    </span>
                  )}
                </div>
                {loading ? <SignalTableSkeleton /> : filtered.length > 0 && <SignalTable signals={filtered} onSelect={setSelected} />}
              </section>
            </>
          )}

          <p className="text-xs leading-relaxed text-(--sv-muted)">
            SARA AI (Smart Algorithmic Return Analysis) menghasilkan sinyal dari data EOD sebagai alat bantu keputusan — bukan nasihat
            keuangan dan tidak menjamin profit. Kinerja masa lalu tidak menjamin hasil di masa depan.
          </p>
        </main>
      </div>

      <SignalDetailDrawer signal={selected} onClose={closeDetail} />
      <Potential25Drawer candidate={selectedP25} onClose={closeP25} />
    </div>
  );
}
