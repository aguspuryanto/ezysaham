'use client';

/**
 * SmartMoneyPage.tsx
 *
 * Smart Money Accumulation Hunter (docs/features_smartmoney_hunter.md): Pasardana prefilter → score from EOD bars +
 * fundamentals, foreign/broker flows fetched per stock on demand (Index Alpha quota). Shares the Screener's header,
 * sidebar nav and `.sv-theme` tokens. Scoring lives in domain/analysis/smartMoneyHunter.ts.
 */

import { AlertCircle, Clock, Landmark, Loader2, RefreshCw, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { SmartMoneyResult, SmStatus } from '@/domain/analysis/smartMoneyHunter';
import { cn } from '@/lib/format';
import { SITE_NAME } from '@/lib/site';
import { useMarketSeries } from '../screener/components/MarketSummary';
import { ScreenerHeader } from '../screener/components/ScreenerHeader';
import { ScreenerNav } from '../screener/components/ScreenerNav';
import { screenerInter } from '../screener/fonts';
import { useWatchlist } from '../screener/hooks/useWatchlist';
import { SignalEmptyState, SignalTableSkeleton } from '../signal/components/SignalStates';
import { fmtDateLong } from '../signal/signalUi';
import { SmartMoneyDetail } from './components/SmartMoneyDetail';
import { SmartMoneyTable, SortKey, sortValue } from './components/SmartMoneyTable';
import { statusLabel } from './smartMoneyUi';
import { useSmartMoney } from './useSmartMoney';

const STATUSES: SmStatus[] = ['BUY_CANDIDATE', 'WAIT', 'AVOID_CHASING', 'NO_TRADE', 'INSUFFICIENT_DATA'];

/** Category filters. Flow-based ones also drop stocks whose flows were not fetched (N/A ≠ PASS). */
const FILTERS: Array<{ key: string; label: string; test: (r: SmartMoneyResult) => boolean }> = [
  { key: 'foreign', label: 'Foreign net buy 5H > 0', test: (r) => (r.measures.foreignNet5 ?? 0) > 0 },
  { key: 'broker', label: 'Broker akumulasi (top-3 ≥ 1,5x)', test: (r) => (r.measures.brokerImbalance ?? 0) >= 1.5 },
  { key: 'activity', label: 'Aktivitas naik (nilai ≥ 1,5x)', test: (r) => (r.measures.relValue5 ?? 0) >= 1.5 },
  { key: 'momentum', label: 'Close > MA60', test: (r) => r.measures.close != null && r.measures.ma60 != null && r.measures.close > r.measures.ma60 },
  { key: 'fundamental', label: 'Laba positif', test: (r) => r.measures.profitPositive === true },
  { key: 'gate', label: 'Tanpa Risk Gate FAIL', test: (r) => r.gates.every((g) => g.result !== 'FAIL') },
];

export function SmartMoneyPage() {
  const market = useMarketSeries();
  const watchlist = useWatchlist();
  const [search, setSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [statuses, setStatuses] = useState<SmStatus[]>([]);
  const [filters, setFilters] = useState<string[]>([]);
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const sm = useSmartMoney();
  const scan = sm.scan;

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
    const active = FILTERS.filter((f) => filters.includes(f.key));
    const list = scan.results.filter((r) =>
      (!q || r.measures.ticker.includes(q) || r.measures.name.toUpperCase().includes(q))
      && (!statuses.length || statuses.includes(r.status))
      && active.every((f) => f.test(r)));
    if (!sort) return list; // default: status, then score (rankSmartMoney)
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      const va = sortValue(a, sort.key), vb = sortValue(b, sort.key);
      if (va == null || vb == null) return va == null ? (vb == null ? 0 : 1) : -1;
      return (typeof va === 'string' ? va.localeCompare(vb as string) : va - (vb as number)) * dir;
    });
  }, [scan, search, statuses, filters, sort]);

  const counts = useMemo(() => {
    const c = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<SmStatus, number>;
    for (const r of scan?.results ?? []) c[r.status] += 1;
    return c;
  }, [scan]);

  const summary = useMemo(() => {
    const res = scan?.results ?? [];
    const priceDate = res.reduce((d, r) => (r.measures.priceDate && r.measures.priceDate > d ? r.measures.priceDate : d), '');
    const withFlows = res.filter((r) => r.measures.flowsAsOf != null).length;
    const avgCoverage = res.length ? Math.round(res.reduce((s, r) => s + r.coverage, 0) / res.length) : 0;
    return { priceDate, withFlows, avgCoverage };
  }, [scan]);

  const onSort = (key: SortKey) =>
    setSort((s) => (s?.key === key ? (s.dir === 'desc' ? { key, dir: 'asc' } : null) : { key, dir: key === 'ticker' ? 'asc' : 'desc' }));
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const closeDetail = useCallback(() => setSelected(null), []);
  const selectedResult = scan?.results.find((r) => r.measures.ticker === selected) ?? null;

  const btnSecondary = 'inline-flex h-9 items-center gap-2 rounded-lg border border-(--sv-border) bg-(--sv-surface) px-3 text-sm font-medium text-(--sv-text) hover:bg-(--sv-bg) disabled:cursor-not-allowed disabled:opacity-50';
  const chip = (on: boolean) => cn('rounded-full border px-3 py-1 text-xs font-medium transition-colors', on ? 'border-(--sv-primary) bg-(--sv-primary-soft) text-(--sv-primary)' : 'border-(--sv-border) text-(--sv-text) hover:bg-(--sv-bg)');

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
                <Landmark className="size-5 text-(--sv-primary)" strokeWidth={2} />
                Smart Money Accumulation Hunter
              </h1>
              <p className="mt-0.5 text-sm text-(--sv-muted)">Indikasi akumulasi asing & broker, aktivitas transaksi, momentum, dan fundamental — alat screening probabilistik, bukan bukti aktivitas bandar.</p>
              <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-(--sv-muted)">
                <Clock className="size-3.5" strokeWidth={2} />
                {sm.loading
                  ? 'Memindai saham…'
                  : summary.priceDate
                    ? <>Data EOD <span className="font-medium text-(--sv-text)">{fmtDateLong(summary.priceDate)}</span> · foreign & broker Index Alpha (update 19.00 WIB)</>
                    : 'Data tidak tersedia'}
              </p>
            </div>
            <button type="button" onClick={sm.rescan} disabled={sm.loading} className={btnSecondary}>
              <RefreshCw className={cn('size-4', sm.loading && 'animate-spin')} strokeWidth={2} />
              Refresh
            </button>
          </div>

          {sm.error && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-200">
              <span className="flex items-center gap-2"><AlertCircle className="size-4 shrink-0" />{sm.error}</span>
              <button type="button" onClick={sm.rescan} className="rounded-lg bg-rose-600 px-3 py-1.5 font-medium text-white hover:bg-rose-700">Coba lagi</button>
            </div>
          )}

          {sm.loading && (
            <>
              <div className="rounded-xl border border-(--sv-border) bg-(--sv-surface) p-3">
                <div className="flex items-center justify-between text-sm text-(--sv-muted)">
                  <span className="inline-flex items-center gap-2"><Loader2 className="size-4 animate-spin text-(--sv-primary)" />{sm.progress ? 'Memuat harga & fundamental' : 'Memuat daftar saham'}…</span>
                  {sm.progress && <span className="tabular-nums">{sm.progress.checked}/{sm.progress.total}</span>}
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div
                    className="h-full rounded-full bg-(--sv-primary) transition-[width] duration-300"
                    style={{ width: `${sm.progress ? Math.round((sm.progress.checked / Math.max(1, sm.progress.total)) * 100) : 0}%` }}
                  />
                </div>
              </div>
              <SignalTableSkeleton />
            </>
          )}

          {!sm.loading && !sm.error && scan && (
            <>
              <section aria-label="Ringkasan" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  { value: `${scan.scanned}`, label: `dipindai dari ${scan.universe} emiten (nilai ≥ Rp1 M, 1W > 0, ${scan.scanned} terlikuid)` },
                  { value: `${counts.BUY_CANDIDATE} / ${counts.WAIT}`, label: 'BUY CANDIDATE / WATCHLIST' },
                  { value: `${summary.withFlows}`, label: 'saham dengan data foreign & broker' },
                  { value: `${summary.avgCoverage}%`, label: 'rata-rata coverage data' },
                ].map((c) => (
                  <div key={c.label} className="rounded-xl border border-(--sv-border) bg-(--sv-surface) p-4 shadow-(--sv-shadow)">
                    <p className="text-2xl font-bold text-(--sv-text) tabular-nums">{c.value}</p>
                    <p className="text-xs text-(--sv-muted)">{c.label}</p>
                  </div>
                ))}
              </section>

              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:border-amber-400/25 dark:bg-amber-400/5 dark:text-amber-200">
                Foreign flow & broker summary memakai kuota Index Alpha (paket Free: 5 permintaan/hari ≈ 1 saham/hari), jadi diambil per saham saat Anda membuka detail. Tanpa data itu, skor hanya dari ±51% indikator (confidence LOW) dan status maksimal WATCHLIST.
              </div>

              <section aria-label="Filter" className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-2">
                  {STATUSES.map((s) => (
                    <button key={s} type="button" onClick={() => setStatuses((x) => toggle(x, s))} className={chip(statuses.includes(s))} aria-pressed={statuses.includes(s)}>
                      {statusLabel(s)} <span className="tabular-nums opacity-70">{counts[s]}</span>
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  {FILTERS.map((f) => (
                    <button key={f.key} type="button" onClick={() => setFilters((x) => toggle(x, f.key))} className={chip(filters.includes(f.key))} aria-pressed={filters.includes(f.key)}>
                      {f.label}
                    </button>
                  ))}
                </div>
              </section>

              {rows.length === 0
                ? <SignalEmptyState title="Tidak ada saham" hint={search || statuses.length || filters.length ? 'Tidak ada yang cocok dengan pencarian atau filter.' : 'Tidak ada saham yang lolos tahap awal.'} />
                : <SmartMoneyTable rows={rows} sort={sort} onSort={onSort} onSelect={(r) => setSelected(r.measures.ticker)} />}

              <p className="text-xs leading-relaxed text-(--sv-muted)">
                Klik baris untuk detail, alasan skor, Risk Gate dan trading plan. N/A = data tidak tersedia (tidak dihitung sebagai lolos).
                Skor bukan probabilitas keuntungan yang tervalidasi. Hasil statistik dari data EOD, bukan rekomendasi investasi.
              </p>
            </>
          )}
        </main>
      </div>

      <SmartMoneyDetail
        result={selectedResult}
        flow={selected ? sm.flows[selected] : undefined}
        onFetchFlows={sm.fetchFlows}
        onClose={closeDetail}
      />
    </div>
  );
}
