'use client';

/**
 * TopBuyPage.tsx
 *
 * Top BUY (docs/features_topbuy.md): Pasardana prefilter funnel → Decision Engine v3 verdict, grouped into
 * BUY / WAIT (watchlist) / AVOID. Shares the Screener's header, sidebar nav and `.sv-theme` tokens (same shell
 * as SignalPage). Screening lives in domain/analysis/topBuyScreener.ts; this file only lays it out.
 */

import { AlertCircle, ArrowUpRight, Clock, Loader2, RefreshCw, Trophy, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { TopBuyRow } from '@/domain/analysis/topBuyScreener';
import { SignalAction, StockSignal } from '@/domain/models/Signal';
import { cn } from '@/lib/format';
import { SITE_NAME } from '@/lib/site';
import { useMarketSeries } from '../screener/components/MarketSummary';
import { ScreenerHeader } from '../screener/components/ScreenerHeader';
import { ScreenerNav } from '../screener/components/ScreenerNav';
import { screenerInter } from '../screener/fonts';
import { useWatchlist } from '../screener/hooks/useWatchlist';
import { SignalDetailDrawer } from '../signal/components/SignalDetailDrawer';
import { SignalEmptyState, SignalTableSkeleton } from '../signal/components/SignalStates';
import { fmtDateLong } from '../signal/signalUi';
import { TopBuyTable } from './components/TopBuyTable';
import { useTopBuy } from './useTopBuy';

const GROUPS: Array<{ action: SignalAction; title: string; hint: string; empty: string }> = [
  { action: 'BUY', title: 'BUY', hint: 'Semua aturan trading Decision Engine v3 terpenuhi.', empty: 'Tidak ada saham BUY pada snapshot ini — tidak ada yang dipaksakan.' },
  { action: 'WAIT', title: 'WAIT — watchlist', hint: 'Belum BUY. Diurutkan berdasarkan % aturan terpenuhi, lalu SARA Score.', empty: 'Tidak ada saham WAIT.' },
  // { action: 'AVOID', title: 'AVOID', hint: 'Lolos kriteria awal, tetapi ditolak mesin.', empty: 'Tidak ada saham AVOID.' },
];

export function TopBuyPage() {
  const market = useMarketSeries();
  const watchlist = useWatchlist();
  const [search, setSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState<StockSignal | null>(null);
  const top = useTopBuy();
  const scan = top.scan;

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

  const groups = useMemo(() => {
    const q = search.trim().toUpperCase();
    const match = (r: TopBuyRow) => !q || r.signal.ticker.includes(q) || r.signal.companyName.toUpperCase().includes(q);
    return GROUPS.map((g) => ({ ...g, rows: (scan?.rows[g.action] ?? []).filter(match) }));
  }, [scan, search]);

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
                <Trophy className="size-5 text-(--sv-primary)" strokeWidth={2} />
                Rekomendasi Saham
              </h1>
              <p className="mt-0.5 text-sm text-(--sv-muted)">Rekomendasi saham yang dipilih berdasarkan kriteria likuiditas, valuasi dan momentum mingguan, lalu divalidasi Decision Engine v3.</p>
              <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-(--sv-muted)">
                <Clock className="size-3.5" strokeWidth={2} />
                {top.loading
                  ? 'Memindai saham…'
                  : scan?.dataDate
                    ? <>Snapshot data <span className="font-medium text-(--sv-text)">{fmtDateLong(scan.dataDate)}</span> · {scan.stateNote}</>
                    : 'Snapshot data tidak tersedia'}
              </p>
            </div>
            <button type="button" onClick={top.rescan} disabled={top.loading} className={btnSecondary}>
              <RefreshCw className={cn('size-4', top.loading && 'animate-spin')} strokeWidth={2} />
              Refresh
            </button>
          </div>

          {/* {scan && (
            <section aria-label="Tahap 1 — kriteria awal" className="rounded-xl border border-(--sv-border) bg-(--sv-surface) p-4 shadow-(--sv-shadow)">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-(--sv-muted)">Tahap 1 — Kriteria awal</p>
              <ol className="mt-2 divide-y divide-(--sv-border) text-sm">
                {scan.funnel.map((f, k) => (
                  <li key={f.label} className="flex items-center justify-between gap-3 py-1.5">
                    <span className="text-(--sv-text)">
                      {f.label} <span className="text-xs text-(--sv-muted)">· {f.field}</span>
                    </span>
                    <span className={cn('tabular-nums', k === scan.funnel.length - 1 ? 'font-bold text-(--sv-primary)' : 'text-(--sv-text)')}>{f.remaining}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-2 text-xs text-(--sv-muted)">Tahap 2 — setiap kandidat dinilai Decision Engine v3 (verdict yang sama dengan halaman Signal dan detail saham).</p>
            </section>
          )} */}

          {top.error && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-200">
              <span className="flex items-center gap-2"><AlertCircle className="size-4 shrink-0" />{top.error}</span>
              <button type="button" onClick={top.rescan} className="rounded-lg bg-rose-600 px-3 py-1.5 font-medium text-white hover:bg-rose-700">Coba lagi</button>
            </div>
          )}

          {top.loading && (
            <>
              <div className="rounded-xl border border-(--sv-border) bg-(--sv-surface) p-3">
                <div className="flex items-center justify-between text-sm text-(--sv-muted)">
                  <span className="inline-flex items-center gap-2"><Loader2 className="size-4 animate-spin text-(--sv-primary)" />{top.progress?.phase ?? 'Memuat daftar saham'}…</span>
                  {top.progress && <span className="tabular-nums">{top.progress.checked}/{top.progress.total}</span>}
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div
                    className="h-full rounded-full bg-(--sv-primary) transition-[width] duration-300"
                    style={{ width: `${top.progress ? Math.round((top.progress.checked / Math.max(1, top.progress.total)) * 100) : 0}%` }}
                  />
                </div>
              </div>
              <SignalTableSkeleton />
            </>
          )}

          {!top.loading && !top.error && scan?.state === 'STALE' && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-400/25 dark:bg-amber-400/5 dark:text-amber-200">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span><b>STALE</b> — {scan.stateNote}</span>
            </div>
          )}

          {!top.loading && !top.error && scan?.state === 'EMPTY' && (
            <SignalEmptyState title="Belum ada kandidat" hint={scan.stateNote} />
          )}

          {!top.loading && !top.error && scan?.state === 'OK' && groups.map((g) => (
            <section key={g.action} aria-labelledby={`topbuy-${g.action}`} className="flex flex-col gap-3">
              <div>
                <h2 id={`topbuy-${g.action}`} className="text-lg font-semibold text-(--sv-text)">
                  {g.title} <span className="tabular-nums text-(--sv-muted)">({g.rows.length})</span>
                </h2>
                <p className="text-xs text-(--sv-muted)">{g.hint}</p>
              </div>
              {g.rows.length === 0
                ? <p className="rounded-xl border border-dashed border-(--sv-border) px-4 py-3 text-sm text-(--sv-muted)">{search ? 'Tidak ada yang cocok dengan pencarian.' : g.empty}</p>
                : <TopBuyTable rows={g.rows} variant={g.action} onSelect={(r) => setSelected(r.signal)} />}
            </section>
          ))}

          <p className="flex flex-wrap items-center gap-1 text-xs leading-relaxed text-(--sv-muted)">
            Hasil penyaringan algoritmik, bukan rekomendasi investasi. Klik baris untuk melihat alasan dan trade plan, atau buka
            <Link href="/signal" className="inline-flex items-center gap-0.5 font-medium text-(--sv-primary) hover:underline">
              Signal <ArrowUpRight className="size-3" />
            </Link>
          </p>
        </main>
      </div>

      <SignalDetailDrawer signal={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
