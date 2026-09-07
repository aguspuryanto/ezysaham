'use client';

import {
  AlertCircle,
  ArrowLeft,
  Building2,
  GitCompare,
  LayoutGrid,
  Loader2,
  RefreshCw,
  Table2,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getStockSummaries } from '@/data/repositories/StockRepository';
import { StockSummary } from '@/domain/models/Stock';
import { cn, formatCompact, formatPercent } from '@/lib/format';
import { SITE_NAME } from '@/lib/site';
import { ResultsTable, ResultsView, ScreenerResult } from '@/presentation/features/screener/components/ResultsTable';
import { useWatchlist } from '@/presentation/features/screener/hooks/useWatchlist';

type Status = 'loading' | 'ready' | 'error';

interface SectorGroup {
  sector: string;
  stocks: StockSummary[];
  avgChange1D: number;
  totalCapitalization: number;
  topGainer: StockSummary | null;
  topLoser: StockSummary | null;
}

function buildSectorGroups(summaries: StockSummary[]): SectorGroup[] {
  const bySector = new Map<string, StockSummary[]>();
  for (const s of summaries) {
    const key = s.sector || 'Lainnya';
    const list = bySector.get(key);
    if (list) list.push(s);
    else bySector.set(key, [s]);
  }

  const groups: SectorGroup[] = [];
  for (const [sector, stocks] of bySector) {
    const avgChange1D = stocks.reduce((sum, s) => sum + s.percentChange1D, 0) / stocks.length;
    const totalCapitalization = stocks.reduce((sum, s) => sum + s.capitalization, 0);
    const sortedByChange = [...stocks].sort((a, b) => b.percentChange1D - a.percentChange1D);
    groups.push({
      sector,
      stocks,
      avgChange1D,
      totalCapitalization,
      topGainer: sortedByChange[0] ?? null,
      topLoser: sortedByChange[sortedByChange.length - 1] ?? null,
    });
  }

  return groups.sort((a, b) => b.totalCapitalization - a.totalCapitalization);
}

export function SectorPage({ initialSector }: { initialSector: string | null }) {
  const router = useRouter();
  const [summaries, setSummaries] = useState<StockSummary[] | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedSector, setSelectedSector] = useState<string | null>(initialSector);
  const [subSector, setSubSector] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [view, setView] = useState<ResultsView>('table');
  const [compareSelection, setCompareSelection] = useState<string[]>([]);
  const watchlist = useWatchlist();

  const fetchSummaries = useCallback(() => {
    getStockSummaries()
      .then((data) => {
        setSummaries(data);
        setStatus('ready');
      })
      .catch(() => {
        setErrorMessage('Gagal memuat daftar saham. Coba muat ulang halaman.');
        setStatus('error');
      });
  }, []);

  useEffect(() => {
    fetchSummaries();
  }, [fetchSummaries]);

  const reload = useCallback(() => {
    setStatus('loading');
    fetchSummaries();
  }, [fetchSummaries]);

  const sectorGroups = useMemo(() => (summaries ? buildSectorGroups(summaries) : []), [summaries]);

  const selectSector = useCallback((sector: string | null) => {
    setSelectedSector(sector);
    setSubSector('all');
    setQuery('');
    router.replace(sector ? `/sektor?sector=${encodeURIComponent(sector)}` : '/sektor', { scroll: false });
  }, [router]);

  const activeGroup = useMemo(
    () => sectorGroups.find((g) => g.sector === selectedSector) ?? null,
    [sectorGroups, selectedSector]
  );

  const subSectors = useMemo(() => {
    if (!activeGroup) return [];
    return Array.from(new Set(activeGroup.stocks.map((s) => s.subSector).filter(Boolean))).sort();
  }, [activeGroup]);

  const filteredStocks = useMemo(() => {
    if (!activeGroup) return [];
    let list = activeGroup.stocks;
    if (subSector !== 'all') list = list.filter((s) => s.subSector === subSector);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((s) => s.ticker.toLowerCase().includes(q) || s.name.toLowerCase().includes(q));
    }
    return list;
  }, [activeGroup, subSector, query]);

  const results: ScreenerResult[] = useMemo(
    () => filteredStocks.map((summary) => ({ summary, evaluation: { passed: true, reasons: [], failed: [] } })),
    [filteredStocks]
  );

  const toggleCompare = useCallback((ticker: string) => {
    setCompareSelection((prev) => {
      if (prev.includes(ticker)) return prev.filter((t) => t !== ticker);
      if (prev.length >= 2) return [prev[1], ticker];
      return [...prev, ticker];
    });
  }, []);
  const isCompareSelected = useCallback((ticker: string) => compareSelection.includes(ticker), [compareSelection]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm border-b-[3px] border-(--neo-line)">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link
            href={activeGroup ? '#' : '/screener'}
            onClick={(e) => {
              if (activeGroup) {
                e.preventDefault();
                selectSector(null);
              }
            }}
            className="flex shrink-0 items-center gap-1.5 text-sm font-bold text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            <ArrowLeft className="size-4" strokeWidth={2.5} />
            <span className="uppercase tracking-wide text-xs">{activeGroup ? 'Semua Sektor' : 'Screener'}</span>
          </Link>
          <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-700" />
          <h1 className="font-bold text-zinc-900 dark:text-zinc-100 truncate">
            {activeGroup ? activeGroup.sector : 'Saham per Sektor'}
          </h1>
          <button
            type="button"
            onClick={reload}
            title="Muat ulang"
            className="neo-press ml-auto flex shrink-0 size-8 items-center justify-center neo-border neo-shadow-sm bg-white text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"
          >
            <RefreshCw className={cn('size-3.5', status === 'loading' && 'animate-spin')} strokeWidth={2.5} />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6 space-y-5">
        {status === 'loading' && (
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-600 dark:text-zinc-400">
            <Loader2 className="size-4 animate-spin" strokeWidth={2.5} />
            Memuat daftar saham dari bursa...
          </div>
        )}

        {status === 'error' && errorMessage && (
          <div className="flex items-center gap-2 neo-border neo-shadow-sm bg-rose-100 px-3.5 py-2.5 text-sm font-semibold text-rose-800 dark:bg-rose-400/10 dark:text-rose-300">
            <AlertCircle className="size-4 shrink-0" strokeWidth={2.5} />
            {errorMessage}
          </div>
        )}

        {status === 'ready' && !activeGroup && (
          <>
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              {sectorGroups.length} sektor · {summaries?.length ?? 0} saham total · diurutkan berdasarkan total kapitalisasi pasar
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {sectorGroups.map((g) => {
                const up = g.avgChange1D >= 0;
                return (
                  <button
                    key={g.sector}
                    type="button"
                    onClick={() => selectSector(g.sector)}
                    className="neo-press text-left neo-border neo-shadow-sm bg-white dark:bg-zinc-900 p-4 space-y-2.5 hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="flex size-8 shrink-0 items-center justify-center neo-border bg-indigo-500 text-white">
                          <Building2 className="size-4" strokeWidth={2.5} />
                        </span>
                        <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100 leading-tight truncate">
                          {g.sector}
                        </span>
                      </div>
                      <span className={cn(
                        'shrink-0 inline-flex items-center gap-1 text-xs font-mono font-bold tabular-nums px-1.5 py-0.5',
                        up ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400'
                      )}>
                        {up ? <TrendingUp className="size-3" strokeWidth={2.5} /> : <TrendingDown className="size-3" strokeWidth={2.5} />}
                        {formatPercent(g.avgChange1D)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <div className="text-zinc-400 uppercase font-bold text-[10px]">Jumlah Saham</div>
                        <div className="font-mono font-bold text-zinc-800 dark:text-zinc-200">{g.stocks.length}</div>
                      </div>
                      <div>
                        <div className="text-zinc-400 uppercase font-bold text-[10px]">Total Market Cap</div>
                        <div className="font-mono font-bold text-zinc-800 dark:text-zinc-200">{formatCompact(g.totalCapitalization)}</div>
                      </div>
                    </div>
                    {g.topGainer && (
                      <div className="text-[11px] text-zinc-400 truncate">
                        Top gainer: <span className="font-bold text-emerald-600 dark:text-emerald-400">{g.topGainer.ticker}</span> ({formatPercent(g.topGainer.percentChange1D)})
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {status === 'ready' && activeGroup && (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <span className={cn(
                'inline-flex items-center gap-1 text-sm font-mono font-bold tabular-nums px-2 py-1 neo-border',
                activeGroup.avgChange1D >= 0 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400'
              )}>
                Rata-rata {formatPercent(activeGroup.avgChange1D)}
              </span>
              <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                {filteredStocks.length} dari {activeGroup.stocks.length} saham · Total Cap {formatCompact(activeGroup.totalCapitalization)}
              </span>

              {subSectors.length > 1 && (
                <select
                  value={subSector}
                  onChange={(e) => setSubSector(e.target.value)}
                  className="neo-border neo-shadow-sm bg-white px-3 py-1.5 text-sm font-semibold text-zinc-700 outline-none dark:bg-zinc-900 dark:text-zinc-200"
                >
                  <option value="all">Semua Sub-Sektor</option>
                  {subSectors.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              )}

              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari ticker/nama..."
                className="neo-border neo-shadow-sm bg-white px-3 py-1.5 text-sm font-semibold text-zinc-700 outline-none dark:bg-zinc-900 dark:text-zinc-200 placeholder:text-zinc-400"
              />

              <div className="ml-auto flex items-center gap-1 neo-border neo-shadow-sm bg-white p-1 dark:bg-zinc-900">
                <button
                  type="button"
                  onClick={() => setView('table')}
                  aria-label="Tampilan tabel"
                  aria-pressed={view === 'table'}
                  className={cn('p-1.5 transition-colors', view === 'table' ? 'bg-(--neo-accent) text-black' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300')}
                >
                  <Table2 className="size-4" strokeWidth={2.5} />
                </button>
                <button
                  type="button"
                  onClick={() => setView('grid')}
                  aria-label="Tampilan grid"
                  aria-pressed={view === 'grid'}
                  className={cn('p-1.5 transition-colors', view === 'grid' ? 'bg-(--neo-accent) text-black' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300')}
                >
                  <LayoutGrid className="size-4" strokeWidth={2.5} />
                </button>
              </div>
            </div>

            <ResultsTable
              results={results}
              view={view}
              isWatchlisted={watchlist.has}
              onToggleWatchlist={watchlist.toggle}
              isCompareSelected={isCompareSelected}
              onToggleCompare={toggleCompare}
            />
          </>
        )}
      </main>

      {compareSelection.length > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
          <div className="flex items-center gap-3 neo-border neo-shadow-lg bg-white px-4 py-2.5 dark:bg-zinc-900">
            <GitCompare className="size-4 shrink-0 text-blue-500" strokeWidth={2.5} />
            <span className="text-sm font-bold text-zinc-700 dark:text-zinc-200">
              {compareSelection.length === 2
                ? `${compareSelection[0]} vs ${compareSelection[1]}`
                : `${compareSelection[0]} dipilih — pilih 1 saham lagi`}
            </span>
            {compareSelection.length === 2 && (
              <Link
                href={`/compare?a=${compareSelection[0]}&b=${compareSelection[1]}`}
                className="neo-press neo-border neo-shadow-sm bg-(--neo-accent) px-3 py-1.5 text-sm font-bold text-black"
              >
                Bandingkan →
              </Link>
            )}
            <button
              type="button"
              onClick={() => setCompareSelection([])}
              aria-label="Batalkan pilihan bandingkan"
              className="flex size-7 shrink-0 items-center justify-center text-zinc-400 hover:text-rose-500"
            >
              <X className="size-4" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      )}

      <div className="text-center pb-4 text-xs font-semibold text-zinc-400 dark:text-zinc-600">{SITE_NAME}</div>
    </div>
  );
}
