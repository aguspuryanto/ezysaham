'use client';

/**
 * JournalPage.tsx
 *
 * /jurnal — trading journal sharing the Screener's header, sidebar nav and
 * `.sv-theme` tokens. Entries come from useJournal; each plan is graded against
 * the next trading day's EOD close by the journal API ("Refresh Outcomes").
 */

import { ChevronRight, CircleDot, Home, LayoutGrid, MinusCircle, RefreshCw, ScanSearch, TrendingDown, TrendingUp, X, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import type { JournalEntryEditableFields } from '@/data/repositories/JournalRepository';
import { JournalEntry, JournalStatus } from '@/domain/models/JournalEntry';
import { cn, formatPercent } from '@/lib/format';
import { SITE_NAME } from '@/lib/site';
import { useMarketSeries } from '../screener/components/MarketSummary';
import { ScreenerHeader } from '../screener/components/ScreenerHeader';
import { ScreenerNav } from '../screener/components/ScreenerNav';
import { ScreenerTabItem, ScreenerTabs } from '../screener/components/ScreenerTabs';
import { Card, Skeleton } from '../screener/detail/components/ui';
import { screenerInter } from '../screener/fonts';
import { useWatchlist } from '../screener/hooks/useWatchlist';
import { JournalEmptyState, JournalTable, STATUS_LABEL } from './components/JournalTable';
import { useJournal } from './hooks/useJournal';

type StatusFilter = 'all' | JournalStatus;

const STATUS_ITEMS: ScreenerTabItem[] = [
  { id: 'all', label: 'Semua', icon: LayoutGrid },
  { id: 'open', label: STATUS_LABEL.open, icon: CircleDot },
  { id: 'tp_hit', label: STATUS_LABEL.tp_hit, icon: TrendingUp },
  { id: 'sl_hit', label: STATUS_LABEL.sl_hit, icon: TrendingDown },
  { id: 'sideways', label: STATUS_LABEL.sideways, icon: MinusCircle },
];

function StatTile({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <Card as="div" className="flex min-w-0 flex-col gap-1 p-4">
      <span className="text-xs font-medium text-(--sv-muted)">{label}</span>
      <div className="text-xl font-bold tabular-nums text-(--sv-text)">{children}</div>
      {hint && <div className="text-xs text-(--sv-muted)">{hint}</div>}
    </Card>
  );
}

export function JournalPage() {
  const router = useRouter();
  const market = useMarketSeries();
  const watchlist = useWatchlist();
  const { entries, loading, refresh, removeEntry, updateEntry } = useJournal();

  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [tickerFilter, setTickerFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);

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

  const tickers = useMemo(() => [...new Set(entries.map((e) => e.ticker))].sort(), [entries]);

  // Ticker / date / search narrow the set the stats describe; the status tab only narrows the table.
  const scoped = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...entries]
      .sort((a, b) => b.addedAt.localeCompare(a.addedAt))
      .filter((e) => {
        if (tickerFilter !== 'all' && e.ticker !== tickerFilter) return false;
        const day = e.addedAt.slice(0, 10);
        if (dateFrom && day < dateFrom) return false;
        if (dateTo && day > dateTo) return false;
        if (q && !(e.ticker.toLowerCase().includes(q) || e.reasonBuy.toLowerCase().includes(q) || e.reasonAvoid.toLowerCase().includes(q))) return false;
        return true;
      });
  }, [entries, tickerFilter, dateFrom, dateTo, query]);

  const visible = useMemo(() => (status === 'all' ? scoped : scoped.filter((e) => e.status === status)), [scoped, status]);

  const stats = useMemo(() => {
    const resolved = scoped.filter((e) => e.status !== 'open');
    const wins = resolved.filter((e) => e.status === 'tp_hit').length;
    const losses = resolved.filter((e) => e.status === 'sl_hit').length;
    const gains = resolved.map((e) => e.gainLossPct ?? 0);
    return {
      total: scoped.length,
      open: scoped.length - resolved.length,
      resolved: resolved.length,
      wins,
      losses,
      winRate: resolved.length > 0 ? (wins / resolved.length) * 100 : null,
      avgGainLoss: gains.length > 0 ? gains.reduce((a, b) => a + b, 0) / gains.length : null,
    };
  }, [scoped]);

  const hasFilter = tickerFilter !== 'all' || dateFrom !== '' || dateTo !== '' || query.trim() !== '' || status !== 'all';
  const resetFilters = useCallback(() => {
    setTickerFilter('all');
    setDateFrom('');
    setDateTo('');
    setQuery('');
    setStatus('all');
  }, []);

  const handleDelete = useCallback(async (entry: JournalEntry) => {
    if (!confirm(`Hapus entri jurnal ${entry.ticker}?`)) return;
    await removeEntry(entry.id);
  }, [removeEntry]);

  const handleSave = useCallback(async (id: string, patch: JournalEntryEditableFields) => (await updateEntry(id, patch)).ok, [updateEntry]);

  const initialLoading = loading && entries.length === 0;
  const btnSecondary = 'inline-flex h-9 items-center gap-2 rounded-lg border border-(--sv-border) bg-(--sv-surface) px-3 text-sm font-medium text-(--sv-text) hover:bg-(--sv-bg) disabled:cursor-not-allowed disabled:opacity-50';
  const field = 'h-9 rounded-lg border border-(--sv-border) bg-(--sv-bg) px-3 text-sm text-(--sv-text) outline-none focus:border-(--sv-primary) focus:bg-(--sv-surface) focus:ring-2 focus:ring-(--sv-primary)/15';
  const fieldLabel = 'flex min-w-0 flex-col gap-1 text-xs font-medium text-(--sv-muted)';

  return (
    <div className={cn('sv-theme flex min-h-screen w-full flex-col', screenerInter.variable)}>
      <ScreenerHeader
        query={query}
        onQueryChange={setQuery}
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
          <ScreenerNav watchlistOnly={false} watchlistCount={watchlist.tickers.length} onToggleWatchlist={() => router.push('/screener')} />
          <p className="mt-auto text-[11px] text-(--sv-muted)">© {new Date().getFullYear()} {SITE_NAME} · Data EOD, bukan prediksi harga.</p>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col gap-5 px-4 py-5 pb-28 sm:px-6 xl:pb-8">
          <nav aria-label="Breadcrumb" className="text-sm">
            <ol className="flex items-center gap-1.5 text-(--sv-muted)">
              <li><Link href="/" aria-label="Beranda" className="flex items-center hover:text-(--sv-text)"><Home className="size-4" strokeWidth={2} /></Link></li>
              <ChevronRight className="size-3.5" aria-hidden="true" />
              <li aria-current="page" className="font-medium text-(--sv-text)">Jurnal Trading</li>
            </ol>
          </nav>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-xl font-bold text-(--sv-text) sm:text-2xl">Jurnal Trading</h1>
              <p className="mt-0.5 text-sm text-(--sv-muted)">Setiap rencana Entry/TP/SL dinilai otomatis terhadap harga penutupan EOD hari bursa berikutnya.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/screener" className={btnSecondary}>
                <ScanSearch className="size-4" strokeWidth={2} /> Cari di Screener
              </Link>
              <button type="button" onClick={() => refresh()} disabled={loading} className="inline-flex h-9 items-center gap-2 rounded-lg bg-(--sv-primary) px-3.5 text-sm font-semibold text-(--sv-primary-fg) hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
                <RefreshCw className={cn('size-4', loading && 'animate-spin')} strokeWidth={2} /> Refresh Outcomes
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {initialLoading ? (
              Array.from({ length: 4 }, (_, i) => (
                <Card as="div" key={i} className="space-y-2 p-4"><Skeleton className="h-3 w-1/2" /><Skeleton className="h-6 w-2/3" /></Card>
              ))
            ) : (
              <>
                <StatTile label="Total Entri" hint={`${stats.open} masih open`}>{stats.total}</StatTile>
                <StatTile label="Selesai" hint={`dari ${stats.total} entri`}>{stats.resolved}</StatTile>
                <StatTile
                  label="Win Rate"
                  hint={stats.resolved > 0 ? (
                    <span><b className="text-emerald-600 dark:text-emerald-400">{stats.wins}W</b> · <b className="text-rose-600 dark:text-rose-400">{stats.losses}L</b> · {stats.resolved - stats.wins - stats.losses} sideways</span>
                  ) : 'Belum ada entri selesai'}
                >
                  {stats.winRate != null ? `${stats.winRate.toFixed(1)}%` : '–'}
                </StatTile>
                <StatTile label="Avg Gain/Loss" hint="rata-rata entri selesai">
                  <span className={stats.avgGainLoss == null ? undefined : stats.avgGainLoss >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                    {stats.avgGainLoss != null ? formatPercent(stats.avgGainLoss) : '–'}
                  </span>
                </StatTile>
              </>
            )}
          </div>

          <section aria-labelledby="journal-title" className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <h2 id="journal-title" className="text-lg font-semibold text-(--sv-text)">Riwayat Rencana</h2>
              <div className="flex flex-wrap items-end gap-2">
                <label className={fieldLabel}>
                  Kode
                  <select value={tickerFilter} onChange={(e) => setTickerFilter(e.target.value)} className={cn(field, 'min-w-32')}>
                    <option value="all">Semua kode</option>
                    {tickers.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
                <label className={fieldLabel}>
                  Dari
                  <input type="date" value={dateFrom} max={dateTo || undefined} onChange={(e) => setDateFrom(e.target.value)} className={field} />
                </label>
                <label className={fieldLabel}>
                  Sampai
                  <input type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => setDateTo(e.target.value)} className={field} />
                </label>
                {hasFilter && (
                  <button type="button" onClick={resetFilters} className={btnSecondary}>
                    <XCircle className="size-4" strokeWidth={2} /> Reset
                  </button>
                )}
              </div>
            </div>

            <ScreenerTabs
              items={STATUS_ITEMS}
              selected={status}
              onSelect={(id) => setStatus(id as StatusFilter)}
              count={initialLoading ? null : visible.length}
            />

            {!initialLoading && entries.length === 0 ? (
              <JournalEmptyState
                title="Belum ada entri jurnal"
                hint="Tambahkan rencana dari Screener (Day Trading / Swing Hunter → Create Jurnal) atau tombol Buat Trading Plan di Detail Emiten."
                action={{ label: 'Buka Screener', href: '/screener' }}
              />
            ) : !initialLoading && visible.length === 0 ? (
              <JournalEmptyState
                title="Tidak ada entri yang cocok"
                hint="Coba ganti tab status, kode saham, rentang tanggal, atau kata kunci pencarian."
                action={{ label: 'Reset filter', onClick: resetFilters }}
              />
            ) : (
              <JournalTable entries={visible} loading={initialLoading} onDelete={handleDelete} onSave={handleSave} />
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
