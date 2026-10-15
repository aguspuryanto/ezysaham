'use client';

/**
 * BestPerformingPage.tsx
 *
 * Kinerja Terbaik: the top 50 liquid IDX stocks by period performance (1M · 3M · 6M · YTD · 1Y), like TradingView's
 * "Best performing", plus how each one rose (steady vs spike-driven) and where it stands now. Analysis lives in
 * domain/analysis/bestPerforming.ts; shares the Screener's header, sidebar nav and `.sv-theme` tokens (TopBuyPage shell).
 */

import { AlertCircle, Loader2, RefreshCw, TrendingUp, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { PERF_PERIODS, PerfPeriod, summarizePerformers } from '@/domain/analysis/bestPerforming';
import { cn } from '@/lib/format';
import { SITE_NAME } from '@/lib/site';
import { useMarketSeries } from '../screener/components/MarketSummary';
import { ScreenerHeader } from '../screener/components/ScreenerHeader';
import { ScreenerNav } from '../screener/components/ScreenerNav';
import { fmtPct } from '../screener/detail/format';
import { screenerInter } from '../screener/fonts';
import { useWatchlist } from '../screener/hooks/useWatchlist';
import { SignalEmptyState, SignalTableSkeleton } from '../signal/components/SignalStates';
import { BestPerformingTable, SORT_VALUE, SortKey } from './components/BestPerformingTable';
import { useBestPerforming } from './useBestPerforming';

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-(--sv-border) bg-(--sv-surface) p-3 shadow-(--sv-shadow)">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-(--sv-muted)">{label}</p>
      <p className="mt-1 truncate text-lg font-bold text-(--sv-text)">{value}</p>
      {hint && <p className="mt-0.5 truncate text-xs text-(--sv-muted)">{hint}</p>}
    </div>
  );
}

export function BestPerformingPage() {
  const router = useRouter();
  const market = useMarketSeries();
  const watchlist = useWatchlist();
  const [period, setPeriod] = useState<PerfPeriod>('1Y');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'perf', desc: true });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const best = useBestPerforming(period);

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

  const stats = useMemo(() => (best.rows ? summarizePerformers(best.rows) : null), [best.rows]);

  const rows = useMemo(() => {
    const q = search.trim().toUpperCase();
    const list = (best.rows ?? []).filter((r) => !q || r.summary.ticker.includes(q) || r.summary.name.toUpperCase().includes(q));
    const v = SORT_VALUE[sort.key];
    return [...list].sort((a, b) => (sort.desc ? v(b) - v(a) : v(a) - v(b)));
  }, [best.rows, search, sort]);

  const selectPeriod = (p: PerfPeriod) => {
    setPeriod(p);
    setSort({ key: 'perf', desc: true });
  };
  const onSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: true }));

  const btnSecondary = 'inline-flex h-9 items-center gap-2 rounded-lg border border-(--sv-border) bg-(--sv-surface) px-3 text-sm font-medium text-(--sv-text) hover:bg-(--sv-bg) disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <div className={cn('sv-theme flex min-h-screen w-full flex-col', screenerInter.variable)}>
      <ScreenerHeader
        query={search}
        onQueryChange={setSearch}
        lastUpdatedAt={null}
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
          <ScreenerNav watchlistCount={watchlist.tickers.length} />
          <p className="mt-auto text-[11px] text-(--sv-muted)">© {new Date().getFullYear()} {SITE_NAME} · Data EOD, bukan prediksi harga.</p>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col gap-5 px-4 py-5 pb-28 sm:px-6 xl:pb-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="flex items-center gap-2 text-xl font-bold text-(--sv-text) sm:text-2xl">
                <TrendingUp className="size-5 text-(--sv-primary)" strokeWidth={2} />
                Kinerja Terbaik
              </h1>
              <p className="mt-0.5 text-sm text-(--sv-muted)">
                50 saham likuid (nilai transaksi rata-rata ≥ Rp1 M/hari) dengan performa terbaik — dan bagaimana kenaikannya terjadi.
              </p>
            </div>
            <button type="button" onClick={best.rescan} disabled={best.loading} className={btnSecondary}>
              <RefreshCw className={cn('size-4', best.loading && 'animate-spin')} strokeWidth={2} />
              Refresh
            </button>
          </div>

          <div role="tablist" aria-label="Periode" className="flex flex-wrap gap-2">
            {PERF_PERIODS.map((p) => {
              const active = p.id === period;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => selectPeriod(p.id)}
                  className={cn(
                    'inline-flex h-9 items-center rounded-full border px-4 text-sm font-medium transition-colors',
                    active ? 'border-(--sv-primary) bg-(--sv-primary-soft) text-(--sv-primary)' : 'border-(--sv-border) bg-(--sv-surface) text-(--sv-text) hover:bg-(--sv-bg)',
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {best.error && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-200">
              <span className="flex items-center gap-2"><AlertCircle className="size-4 shrink-0" />{best.error}</span>
              <button type="button" onClick={best.rescan} className="rounded-lg bg-rose-600 px-3 py-1.5 font-medium text-white hover:bg-rose-700">Coba lagi</button>
            </div>
          )}

          {best.loading && (
            <>
              <div className="rounded-xl border border-(--sv-border) bg-(--sv-surface) p-3">
                <div className="flex items-center justify-between text-sm text-(--sv-muted)">
                  <span className="inline-flex items-center gap-2"><Loader2 className="size-4 animate-spin text-(--sv-primary)" />{best.progress ? 'Memuat harga harian 1 tahun' : 'Memuat daftar saham'}…</span>
                  {best.progress && <span className="tabular-nums">{best.progress.checked}/{best.progress.total}</span>}
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div
                    className="h-full rounded-full bg-(--sv-primary) transition-[width] duration-300"
                    style={{ width: `${best.progress ? Math.round((best.progress.checked / Math.max(1, best.progress.total)) * 100) : 0}%` }}
                  />
                </div>
              </div>
              <SignalTableSkeleton />
            </>
          )}

          {!best.loading && !best.error && stats && best.rows && best.rows.length > 0 && (
            <section aria-label="Ringkasan" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label={`Median perf ${period}`} value={fmtPct(stats.medianPerf, 1)} hint={`${best.rows.length} saham dari ${best.candidates} kandidat teratas`} />
              <Stat
                label="Sektor dominan"
                value={stats.topSectors[0]?.sector ?? '—'}
                hint={stats.topSectors.map((s) => `${s.sector} ${s.count}`).join(' · ')}
              />
              <Stat label="Didorong lonjakan" value={`${Math.round(stats.spikeDrivenPct)}%`} hint="≥ 70% kenaikan dari 5 hari terbaik" />
              <Stat label="Masih uptrend" value={`${Math.round(stats.uptrendPct)}%`} hint={`Median jarak dari high: ${fmtPct(stats.medianFromHigh, 1)}`} />
            </section>
          )}

          {!best.loading && !best.error && best.rows && (
            best.rows.length === 0 ? (
              <SignalEmptyState title="Belum ada data" hint="Tidak ada saham likuid dengan data harga yang cukup. Coba refresh." />
            ) : rows.length === 0 ? (
              <SignalEmptyState title="Tidak ada yang cocok" hint="Kosongkan pencarian." action={{ label: 'Reset', onClick: () => setSearch('') }} />
            ) : (
              <BestPerformingTable rows={rows} period={period} sort={sort} onSort={onSort} onSelect={(r) => router.push(`/screener/${r.summary.ticker}`)} />
            )
          )}

          <div className="rounded-xl border border-(--sv-border) bg-(--sv-surface) p-4 text-xs leading-relaxed text-(--sv-muted)">
            <p className="mb-1 font-semibold uppercase tracking-wide">Cara membaca</p>
            <p><b className="text-(--sv-text)">Perf</b> dari Pasardana. <b className="text-(--sv-text)">Nilai/hari</b> = rata-rata close × volume 20 hari terakhir. <b className="text-(--sv-text)">Dari high</b> = jarak harga sekarang ke high 1 tahun. <b className="text-(--sv-text)">Max DD</b> = penurunan terdalam dari puncak selama periode.</p>
            <p className="mt-1"><b className="text-(--sv-text)">Karakter</b>: &quot;Didorong lonjakan&quot; bila ≥ 70% kenaikan periode terjadi di 5 hari terbaik — kenaikan seperti ini lebih sering terkoreksi (lihat studi pola top gainer); &quot;Tren bertahap&quot; bila kenaikan tersebar.</p>
            <p className="mt-1"><b className="text-(--sv-text)">Trend</b> = jangka menengah: Uptrend kuat bila close &gt; EMA50 &gt; EMA200. <b className="text-(--sv-text)">Fase</b> = kondisi jangka pendek (EMA9/21, RSI, volume) — saham bisa Uptrend kuat tetapi sedang fase Bearish/Pullback.</p>
            <p className="mt-2">Performa masa lalu bukan jaminan hasil di masa depan. Bukan rekomendasi investasi.</p>
          </div>
        </main>
      </div>
    </div>
  );
}
