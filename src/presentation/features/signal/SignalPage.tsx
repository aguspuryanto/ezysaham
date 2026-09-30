'use client';

/**
 * SignalPage.tsx
 *
 * SARA AI Signals dashboard (features_signal.md). Shares the Screener's header,
 * sidebar nav and `.sv-theme` tokens. Data comes from SignalRepository
 * (mock for now) via useSignals — this file only filters and lays it out.
 */

import { AlertCircle, Clock, RefreshCw, Sparkles, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { todayWib } from '@/data/repositories/SignalRepository';
import { SignalFilterState, StockSignal } from '@/domain/models/Signal';
import { cn } from '@/lib/format';
import { SITE_NAME } from '@/lib/site';
import { useMarketSeries } from '../screener/components/MarketSummary';
import { ScreenerHeader } from '../screener/components/ScreenerHeader';
import { ScreenerNav } from '../screener/components/ScreenerNav';
import { screenerInter } from '../screener/fonts';
import { useWatchlist } from '../screener/hooks/useWatchlist';
import { PerformanceSummary, PerformanceSummarySkeleton } from './components/PerformanceSummary';
import { SignalCard } from './components/SignalCard';
import { SignalDetailDrawer } from './components/SignalDetailDrawer';
import { SignalFilters } from './components/SignalFilters';
import { SignalCardSkeleton, SignalEmptyState, SignalTableSkeleton } from './components/SignalStates';
import { SignalTable } from './components/SignalTable';
import { fmtDateLong, fmtTimestamp } from './signalUi';
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
  const noBatch = !loading && data != null && data.signals.length === 0;

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
                {loading
                  ? 'Memuat sinyal…'
                  : data?.lastUpdated
                    ? <>Last updated: <span className="font-medium text-(--sv-text)">{fmtTimestamp(data.lastUpdated)}</span></>
                    : `Belum ada batch sinyal untuk ${fmtDateLong(filters.date)}`}
              </p>
            </div>
            <button type="button" onClick={refresh} disabled={loading} className={btnSecondary}>
              <RefreshCw className={cn('size-4', loading && 'animate-spin')} strokeWidth={2} />
              Refresh
            </button>
          </div>

          {loading || !data ? <PerformanceSummarySkeleton /> : <PerformanceSummary data={data.performance} />}

          <section aria-label="Filter sinyal" className="rounded-xl border border-(--sv-border) bg-(--sv-surface) p-4 shadow-(--sv-shadow)">
            <SignalFilters value={filters} onChange={setFilters} maxDate={today} />
          </section>

          {error && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-200">
              <span className="flex items-center gap-2"><AlertCircle className="size-4 shrink-0" />{error}</span>
              <button type="button" onClick={refresh} className="rounded-lg bg-rose-600 px-3 py-1.5 font-medium text-white hover:bg-rose-700">Coba lagi</button>
            </div>
          )}

          {noBatch ? (
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
    </div>
  );
}
