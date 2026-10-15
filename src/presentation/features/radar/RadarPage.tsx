'use client';

/**
 * RadarPage.tsx
 *
 * Radar saham panas (docs/features_topgain_radar.md): stocks with the most pre-topgain conditions at the last close,
 * to watch on the next trading day. A watch list with risk warnings, not a BUY signal. Shares the Screener's header,
 * sidebar nav and `.sv-theme` tokens (same shell as TopBuyPage). Scoring lives in domain/analysis/topgainRadar.ts.
 */

import { AlertCircle, Clock, Info, Loader2, Radar, RefreshCw, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { radarTop, RADAR_TOP_N } from '@/domain/analysis/topgainRadar';
import { cn } from '@/lib/format';
import { SITE_NAME } from '@/lib/site';
import { useMarketSeries } from '../screener/components/MarketSummary';
import { ScreenerHeader } from '../screener/components/ScreenerHeader';
import { ScreenerNav } from '../screener/components/ScreenerNav';
import { screenerInter } from '../screener/fonts';
import { useWatchlist } from '../screener/hooks/useWatchlist';
import { SignalEmptyState, SignalTableSkeleton } from '../signal/components/SignalStates';
import { fmtDateLong } from '../signal/signalUi';
import { RadarTable } from './components/RadarTable';
import { useRadar } from './useRadar';

/** Out-of-sample backtest, 20 Jul – 15 Okt 2026 (docs/features_topgain_radar.md). */
const BACKTEST = [
  { value: '~1 saham', label: 'dari 20 kandidat teratas masuk Top 5 besok (rata-rata)' },
  { value: '68%', label: 'hari dengan minimal 1 Top 5 di 20 kandidat teratas' },
  { value: '12%', label: 'kandidat Top 20 yang naik ≥ 10% besoknya (acak: 1,7%)' },
];

export function RadarPage() {
  const market = useMarketSeries();
  const watchlist = useWatchlist();
  const [search, setSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [includeThin, setIncludeThin] = useState(false);
  const radar = useRadar();
  const scan = radar.scan;

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

  const rows = useMemo(() => {
    if (!scan) return [];
    const q = search.trim().toUpperCase();
    const top = radarTop(scan, includeThin);
    return q ? top.filter((r) => r.summary.ticker.includes(q) || r.summary.name.toUpperCase().includes(q)) : top;
  }, [scan, search, includeThin]);

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
                <Radar className="size-5 text-(--sv-primary)" strokeWidth={2} />
                Radar Saham Panas
              </h1>
              <p className="mt-0.5 text-sm text-(--sv-muted)">Saham dengan jejak pra-topgain terbanyak pada penutupan terakhir — untuk dipantau di hari bursa berikutnya.</p>
              <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-(--sv-muted)">
                <Clock className="size-3.5" strokeWidth={2} />
                {radar.loading
                  ? 'Memindai saham…'
                  : scan?.dataDate
                    ? <>Kondisi penutupan <span className="font-medium text-(--sv-text)">{fmtDateLong(scan.dataDate)}</span> · {scan.stateNote}</>
                    : 'Data penutupan tidak tersedia'}
              </p>
            </div>
            <button type="button" onClick={radar.rescan} disabled={radar.loading} className={btnSecondary}>
              <RefreshCw className={cn('size-4', radar.loading && 'animate-spin')} strokeWidth={2} />
              Refresh
            </button>
          </div>

          <section aria-label="Akurasi radar" className="rounded-xl border border-(--sv-border) bg-(--sv-surface) p-4 shadow-(--sv-shadow)">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-(--sv-muted)">Akurasi backtest 3 bulan</p>
            <dl className="mt-2 grid gap-3 sm:grid-cols-3">
              {BACKTEST.map((b) => (
                <div key={b.label}>
                  <dt className="text-lg font-bold text-(--sv-text) tabular-nums">{b.value}</dt>
                  <dd className="text-xs text-(--sv-muted)">{b.label}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-300">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
              Bukan sinyal BUY. Top 5 yang tepat tidak bisa ditebak, dan setelah topgain saham biasanya terkoreksi (median besok −2%). Jangan kejar harga.
            </p>
          </section>

          {radar.error && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-200">
              <span className="flex items-center gap-2"><AlertCircle className="size-4 shrink-0" />{radar.error}</span>
              <button type="button" onClick={radar.rescan} className="rounded-lg bg-rose-600 px-3 py-1.5 font-medium text-white hover:bg-rose-700">Coba lagi</button>
            </div>
          )}

          {radar.loading && (
            <>
              <div className="rounded-xl border border-(--sv-border) bg-(--sv-surface) p-3">
                <div className="flex items-center justify-between text-sm text-(--sv-muted)">
                  <span className="inline-flex items-center gap-2"><Loader2 className="size-4 animate-spin text-(--sv-primary)" />{radar.progress ? 'Memuat harga harian' : 'Memuat daftar saham'}…</span>
                  {radar.progress && <span className="tabular-nums">{radar.progress.checked}/{radar.progress.total}</span>}
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div
                    className="h-full rounded-full bg-(--sv-primary) transition-[width] duration-300"
                    style={{ width: `${radar.progress ? Math.round((radar.progress.checked / Math.max(1, radar.progress.total)) * 100) : 0}%` }}
                  />
                </div>
              </div>
              <SignalTableSkeleton />
            </>
          )}

          {!radar.loading && !radar.error && scan?.state === 'STALE' && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-400/25 dark:bg-amber-400/5 dark:text-amber-200">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span><b>STALE</b> — {scan.stateNote}</span>
            </div>
          )}

          {!radar.loading && !radar.error && scan?.state === 'EMPTY' && (
            <SignalEmptyState title="Belum ada kandidat" hint={scan.stateNote} />
          )}

          {!radar.loading && !radar.error && scan?.state === 'OK' && (
            <section aria-labelledby="radar-kandidat" className="flex flex-col gap-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 id="radar-kandidat" className="text-lg font-semibold text-(--sv-text)">
                    Kandidat radar <span className="tabular-nums text-(--sv-muted)">({rows.length})</span>
                  </h2>
                  <p className="text-xs text-(--sv-muted)">
                    {RADAR_TOP_N} skor tertinggi{includeThin ? '' : ', rata-rata nilai 20 hari ≥ Rp0,5 M'}. Skor = jumlah bobot kondisi pra-topgain yang terpenuhi.
                  </p>
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-(--sv-text)">
                  <input type="checkbox" checked={includeThin} onChange={(e) => setIncludeThin(e.target.checked)} className="size-4 accent-(--sv-primary)" />
                  Sertakan saham sepi
                </label>
              </div>

              {scan.liveBarDropped && (
                <p className="flex items-start gap-1.5 text-xs text-(--sv-muted)">
                  <Info className="mt-0.5 size-3.5 shrink-0" />
                  Sesi bursa hari ini belum tutup, jadi skor memakai penutupan sebelumnya. Refresh setelah pukul 16.00 WIB untuk radar besok.
                </p>
              )}

              {rows.length === 0
                ? <p className="rounded-xl border border-dashed border-(--sv-border) px-4 py-3 text-sm text-(--sv-muted)">{search ? 'Tidak ada yang cocok dengan pencarian.' : 'Tidak ada kandidat.'}</p>
                : <RadarTable rows={rows} />}

              {scan.noTrade.length > 0 && (
                <p className="text-xs text-(--sv-muted)">
                  Dikeluarkan karena tidak ada transaksi pada {fmtDateLong(scan.dataDate!)} (kemungkinan suspensi): {scan.noTrade.join(', ')}.
                </p>
              )}
            </section>
          )}

          <div className="rounded-xl border border-(--sv-border) bg-(--sv-surface) p-4 text-xs leading-relaxed text-(--sv-muted)">
            <p className="font-semibold text-(--sv-text)">Cara membaca jalur</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              <li><b className="text-(--sv-text)">Lanjutan</b> — sudah naik besar atau baru topgain. Paling sering muncul, follow-through rendah.</li>
              <li><b className="text-(--sv-text)">Turun dulu</b> — saham panas yang terkoreksi ≥ 5% hari ini; sering dibeli lagi.</li>
              <li><b className="text-(--sv-text)">Rebound</b> — oversold, dekat low 1 tahun, atau turun ≥ 20% dalam 20 hari. Follow-through terbaik di studi (43% naik lagi besoknya).</li>
            </ul>
            <p className="mt-2">Hasil statistik dari data EOD, bukan rekomendasi investasi.</p>
          </div>
        </main>
      </div>
    </div>
  );
}
