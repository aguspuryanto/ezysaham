'use client';

/**
 * MoonstockPage.tsx
 *
 * Moonstock discovery radar (docs/features_moonstock.md): 🌙 Intraday · 🚀 Swing · 💰 Investing screeners on
 * real data, sharing the Screener's header, sidebar nav and `.sv-theme` tokens (same shell as SignalPage).
 * Screening lives in domain/analysis/moonstockScreener.ts; this file only lays it out. A row opens the
 * stock's detail page, where the Momentum Trade Engine + HARD RISK GATE do the final validation.
 */

import { AlertCircle, ArrowRight, Clock, Loader2, Moon, RefreshCw, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { labelEmoji, MOONSTOCK_MODE_LABEL, MoonstockMode, MoonstockRow } from '@/domain/analysis/moonstockScreener';
import { cn } from '@/lib/format';
import { SITE_NAME } from '@/lib/site';
import { useMarketSeries } from '../screener/components/MarketSummary';
import { ScreenerHeader } from '../screener/components/ScreenerHeader';
import { ScreenerNav } from '../screener/components/ScreenerNav';
import { screenerInter } from '../screener/fonts';
import { useWatchlist } from '../screener/hooks/useWatchlist';
import { SignalEmptyState, SignalTableSkeleton } from '../signal/components/SignalStates';
import { fmtDateLong } from '../signal/signalUi';
import { MoonstockTable } from './components/MoonstockTable';
import { useMoonstock } from './useMoonstock';

const MODES: Array<{ id: MoonstockMode; purpose: string; criteria: string }> = [
  {
    id: 'intraday',
    purpose: 'Saham dengan momentum intraday — potensi ditradingkan hari yang sama.',
    criteria: 'Price > VWAP · RVOL ≥ 1,5× · Volume > 100.000 lbr · Change > 0% · Momentum MODERATE/STRONG · Breakout / dekat resistance · Naik ≥ 10% hari ini = chasing · Size L/M · Value ≥ Rp 5 M',
  },
  {
    id: 'swing',
    purpose: 'Setup swing 2 hari – beberapa minggu dengan tren bersih.',
    criteria: 'Price > EMA20 > EMA50 (EMA50 > EMA200 diprioritaskan) · HH + HL · RSI 50–70 · RVOL ≥ 1,2× · Upside ≥ 20% · R:R kandidat ≥ 1:2 · Size M/L · Value ≥ Rp 10 M',
  },
  {
    id: 'investing',
    purpose: 'Saham fundamental berkualitas untuk investasi jangka menengah/panjang.',
    criteria: 'Rev Growth > 15% · Profit Growth > 15% · ROE > 15% · D/E < 1,0 · Net Margin > 10% · Valuasi wajar/murah · Size M/L · Value ≥ Rp 50 M',
  },
];

const LABELS: Record<MoonstockMode, string[]> = {
  intraday: ['BREAKOUT', 'MOMENTUM', 'WATCH', 'AVOID CHASING'],
  swing: ['BREAKOUT', 'PULLBACK', 'DEVELOPING', 'AVOID'],
  investing: ['UNDERVALUED', 'QUALITY', 'FAIR VALUE', 'VALUE TRAP RISK'],
};

export function MoonstockPage() {
  const router = useRouter();
  const market = useMarketSeries();
  const watchlist = useWatchlist();
  const [mode, setMode] = useState<MoonstockMode>('swing');
  const [label, setLabel] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const moon = useMoonstock(mode);
  const scan = moon.scan;
  const modeInfo = MODES.find((m) => m.id === mode)!;

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

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of scan?.rows ?? []) c[r.label] = (c[r.label] ?? 0) + 1;
    return c;
  }, [scan]);

  const rows = useMemo(() => {
    const q = search.trim().toUpperCase();
    return (scan?.rows ?? []).filter((r) =>
      (label === 'ALL' || r.label === label) && (!q || r.ticker.includes(q) || r.name.toUpperCase().includes(q)));
  }, [scan, label, search]);

  const selectMode = (m: MoonstockMode) => { setMode(m); setLabel('ALL'); };
  const openStock = (r: MoonstockRow) => router.push(`/screener/${r.ticker}`);

  const btnSecondary = 'inline-flex h-9 items-center gap-2 rounded-lg border border-(--sv-border) bg-(--sv-surface) px-3 text-sm font-medium text-(--sv-text) hover:bg-(--sv-bg) disabled:cursor-not-allowed disabled:opacity-50';
  const chip = (active: boolean) => cn(
    'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors',
    active ? 'border-(--sv-primary) bg-(--sv-primary-soft) text-(--sv-primary)' : 'border-(--sv-border) bg-(--sv-surface) text-(--sv-text) hover:bg-(--sv-bg)',
  );

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
                <Moon className="size-5 text-(--sv-primary)" strokeWidth={2} />
                Moonstock
              </h1>
              <p className="mt-0.5 text-sm text-(--sv-muted)">Discovery radar — menemukan kandidat, bukan sinyal BUY. Validasi akhir di Momentum Trade Engine.</p>
              <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-(--sv-muted)">
                <Clock className="size-3.5" strokeWidth={2} />
                {moon.loading
                  ? 'Memindai market universe…'
                  : scan?.dataDate
                    ? <>Snapshot data <span className="font-medium text-(--sv-text)">{fmtDateLong(scan.dataDate)}</span> · {scan.evaluated} saham dipindai{scan.incompatible > 0 ? ` · ${scan.incompatible} data tidak kompatibel (dilewati)` : ''}</>
                    : 'Snapshot data tidak tersedia'}
              </p>
            </div>
            <button type="button" onClick={moon.rescan} disabled={moon.loading} className={btnSecondary}>
              <RefreshCw className={cn('size-4', moon.loading && 'animate-spin')} strokeWidth={2} />
              Refresh
            </button>
          </div>

          <div role="tablist" aria-label="Kategori Moonstock" className="grid gap-2 sm:grid-cols-3">
            {MODES.map((m) => {
              const active = m.id === mode;
              return (
                <button
                  key={m.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => selectMode(m.id)}
                  className={cn(
                    'rounded-xl border p-3 text-left transition-colors',
                    active ? 'border-(--sv-primary) bg-(--sv-primary-soft)' : 'border-(--sv-border) bg-(--sv-surface) hover:bg-(--sv-bg)',
                  )}
                >
                  <span className={cn('block text-sm font-semibold', active ? 'text-(--sv-primary)' : 'text-(--sv-text)')}>{MOONSTOCK_MODE_LABEL[m.id]}</span>
                  <span className="mt-0.5 block text-xs text-(--sv-muted)">{m.purpose}</span>
                </button>
              );
            })}
          </div>

          <section aria-label="Kriteria" className="rounded-xl border border-(--sv-border) bg-(--sv-surface) p-4 shadow-(--sv-shadow)">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-(--sv-muted)">Filter utama</p>
            <p className="mt-1 text-sm text-(--sv-text)">{modeInfo.criteria}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className={chip(label === 'ALL')} onClick={() => setLabel('ALL')}>
                Semua <span className="tabular-nums text-(--sv-muted)">{scan?.rows.length ?? 0}</span>
              </button>
              {LABELS[mode].map((l) => (
                <button key={l} type="button" className={chip(label === l)} onClick={() => setLabel(l)}>
                  {labelEmoji(mode, l)} {l} <span className="tabular-nums text-(--sv-muted)">{counts[l] ?? 0}</span>
                </button>
              ))}
            </div>
          </section>

          {moon.error && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-200">
              <span className="flex items-center gap-2"><AlertCircle className="size-4 shrink-0" />{moon.error}</span>
              <button type="button" onClick={moon.rescan} className="rounded-lg bg-rose-600 px-3 py-1.5 font-medium text-white hover:bg-rose-700">Coba lagi</button>
            </div>
          )}

          {moon.loading && (
            <div className="rounded-xl border border-(--sv-border) bg-(--sv-surface) p-3">
              <div className="flex items-center justify-between text-sm text-(--sv-muted)">
                <span className="inline-flex items-center gap-2"><Loader2 className="size-4 animate-spin text-(--sv-primary)" />{moon.progress?.phase ?? 'Memuat daftar saham'}…</span>
                {moon.progress && <span className="tabular-nums">{moon.progress.checked}/{moon.progress.total}</span>}
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div
                  className="h-full rounded-full bg-(--sv-primary) transition-[width] duration-300"
                  style={{ width: `${moon.progress ? Math.round((moon.progress.checked / Math.max(1, moon.progress.total)) * 100) : 0}%` }}
                />
              </div>
            </div>
          )}

          {!moon.error && (
            <section aria-labelledby="moon-list-title" className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-2">
                <h2 id="moon-list-title" className="text-lg font-semibold text-(--sv-text)">Kandidat {MOONSTOCK_MODE_LABEL[mode]}</h2>
                {scan?.state === 'OK' && (
                  <span className="text-sm text-(--sv-muted)"><b className="tabular-nums text-(--sv-text)">{rows.length}</b> dari {scan.rows.length} kandidat</span>
                )}
              </div>
              {moon.loading ? (
                <SignalTableSkeleton />
              ) : scan?.state === 'STALE' ? (
                <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-400/25 dark:bg-amber-400/5 dark:text-amber-200">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span><b>STALE</b> — {scan.stateNote}</span>
                </div>
              ) : scan?.state === 'EMPTY' ? (
                <SignalEmptyState title="EMPTY — belum ada kandidat" hint={scan.stateNote} />
              ) : rows.length === 0 ? (
                <SignalEmptyState
                  title="Tidak ada kandidat yang cocok"
                  hint="Coba label lain atau kosongkan pencarian."
                  action={{ label: 'Reset filter', onClick: () => { setLabel('ALL'); setSearch(''); } }}
                />
              ) : (
                <MoonstockTable rows={rows} onSelect={openStock} />
              )}
            </section>
          )}

          <section aria-label="Alur Moonstock" className="rounded-xl border border-(--sv-border) bg-(--sv-surface) p-4 text-xs text-(--sv-muted)">
            <p className="mb-2 font-semibold uppercase tracking-wide">Alur</p>
            <p className="flex flex-wrap items-center gap-1.5 text-(--sv-text)">
              {['Market Universe', 'Moonstock', 'Ranking Candidate', 'Analisa Teknikal/Fundamental', 'Momentum Trade Engine', 'HARD RISK GATE', 'BUY / WAIT / NO TRADE'].map((s, k, arr) => (
                <span key={s} className="inline-flex items-center gap-1.5">
                  {s}{k < arr.length - 1 && <ArrowRight className="size-3 text-(--sv-muted)" />}
                </span>
              ))}
            </p>
            <p className="mt-2">Klik baris untuk membuka detail saham dan validasi di Momentum Trade Engine.</p>
          </section>

          <p className="text-xs leading-relaxed text-(--sv-muted)">
            Moonstock adalah discovery radar: kandidat ≠ BUY. Kandidat hanya muncul dari snapshot data yang kompatibel — data kosong
            ditampilkan EMPTY, data lama ditampilkan STALE, dan tidak ada kandidat yang dipaksakan. Bukan nasihat keuangan.
          </p>
        </main>
      </div>
    </div>
  );
}
