'use client';

import {
  AlertTriangle,
  ArrowLeft,
  Activity,
  BarChart2,
  History,
  Layers,
  Loader2,
  Rocket,
  Shuffle,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { OHLCVBar } from '@/domain/models/History';
import { StockSummary } from '@/domain/models/Stock';
import { TechnicalHistoryResult } from '@/domain/models/TechnicalHistory';
import { computeTechnicalHistory } from '@/domain/history/technicalHistoryEngine';
import { getStockHistory, getStockSummaries } from '@/data/repositories/StockRepository';
import { cn, formatPercent, formatRupiah } from '@/lib/format';
import { FilterChipItem, PresetTabs } from '@/presentation/features/screener/components/PresetTabs';
import { OHLCVChart } from '@/presentation/features/analysis/OHLCVChart';
import { EventTimeline } from './components/EventTimeline';
import { HistoricalPatternPanel } from './components/HistoricalPatternPanel';

const HISTORY_RANGE = '2y';

type HistoryTab = 'volume' | 'priceAction' | 'breakout' | 'accumDist' | 'indicatorCross' | 'historicalPattern';

const HISTORY_TABS: FilterChipItem[] = [
  { id: 'volume', label: 'Volume History', icon: BarChart2 },
  { id: 'priceAction', label: 'Price Action History', icon: Activity },
  { id: 'breakout', label: 'Breakout History', icon: Rocket },
  { id: 'accumDist', label: 'Accumulation/Distribution', icon: Layers },
  { id: 'indicatorCross', label: 'Indicator Cross History', icon: Shuffle },
  { id: 'historicalPattern', label: 'Historical Pattern', icon: History },
];

type PageStatus = 'loading' | 'ready' | 'error';

export function TechnicalHistoryPage({ ticker }: { ticker: string }) {
  const [status, setStatus] = useState<PageStatus>('loading');
  const [summary, setSummary] = useState<StockSummary | null>(null);
  const [bars, setBars] = useState<OHLCVBar[]>([]);
  const [activeTab, setActiveTab] = useState<HistoryTab>('volume');

  const load = useCallback(async () => {
    const code = ticker.toUpperCase();
    setStatus('loading');
    try {
      const [summaries, historyBars] = await Promise.all([
        getStockSummaries(),
        getStockHistory(code, HISTORY_RANGE),
      ]);
      const found = summaries.find((s) => s.ticker === code);
      if (!found || historyBars.length === 0) throw new Error('Ticker tidak ditemukan');

      const lastBar = historyBars[historyBars.length - 1];
      const prevBar = historyBars.length > 1 ? historyBars[historyBars.length - 2] : null;
      found.lastClose = lastBar.close;
      if (prevBar) {
        found.prevClose = prevBar.close;
        found.percentChange1D = ((lastBar.close - prevBar.close) / prevBar.close) * 100;
      }

      setSummary(found);
      setBars(historyBars);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [ticker]);

  useEffect(() => { load(); }, [load]);

  const history: TechnicalHistoryResult | null = useMemo(() => {
    if (!summary || bars.length === 0) return null;
    return computeTechnicalHistory(summary.ticker, bars);
  }, [summary, bars]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white dark:bg-zinc-950">
        <div className="flex items-center gap-3">
          <Loader2 className="size-6 animate-spin text-emerald-500" />
          <span className="text-zinc-500 dark:text-zinc-400">Memuat riwayat teknikal {ticker.toUpperCase()}…</span>
        </div>
      </div>
    );
  }

  if (status === 'error' || !summary || !history) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white dark:bg-zinc-950 px-4">
        <AlertTriangle className="size-10 text-amber-400" />
        <p className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">Data tidak tersedia</p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center max-w-xs">
          Riwayat teknikal <strong>{ticker.toUpperCase()}</strong> tidak ditemukan atau gagal dimuat.
        </p>
        <Link
          href="/screener"
          className="neo-press inline-flex items-center gap-2 neo-border neo-shadow-sm bg-emerald-400 px-4 py-2 text-sm font-bold text-black"
        >
          <ArrowLeft className="size-4" strokeWidth={2.5} /> Kembali ke Screener
        </Link>
      </div>
    );
  }

  const positiveDay = summary.percentChange1D >= 0;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-20 neo-border border-x-0 border-t-0 bg-white dark:bg-zinc-950">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link
            href={`/screener/${summary.ticker}`}
            className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            aria-label="Kembali ke analisis"
          >
            <ArrowLeft className="size-4" strokeWidth={2.5} />
            <span className="hidden sm:inline">Analisis</span>
          </Link>
          <div className="h-5 w-[3px] bg-(--neo-line)" />
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-bold text-zinc-900 dark:text-zinc-100 text-lg">{summary.ticker}</span>
            <span className="hidden truncate text-sm font-medium text-zinc-500 dark:text-zinc-400 sm:inline">{summary.name}</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 pb-16 space-y-5">
        <div className="neo-border neo-shadow bg-white dark:bg-zinc-900 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                Riwayat Teknikal — {summary.name} ({summary.ticker})
              </h1>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Berdasarkan {history.barCount} bar data EOD ({HISTORY_RANGE}) · Bukan prediksi harga
              </p>
            </div>
            <div className="flex items-baseline gap-2 shrink-0">
              <span className="font-mono text-2xl sm:text-3xl font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                {formatRupiah(summary.lastClose)}
              </span>
              <span className={cn(
                'inline-flex items-center gap-1 text-base sm:text-lg font-mono tabular-nums font-bold',
                positiveDay ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              )}>
                {positiveDay ? <TrendingUp className="size-5" strokeWidth={2.5} /> : <TrendingDown className="size-5" strokeWidth={2.5} />}
                {formatPercent(summary.percentChange1D)}
              </span>
            </div>
          </div>
        </div>

        {bars.length > 0 && (
          <OHLCVChart bars={bars} currentClose={summary.lastClose} ticker={summary.ticker} prevClose={summary.prevClose} />
        )}

        <PresetTabs items={HISTORY_TABS} selected={activeTab} onSelect={(id) => setActiveTab(id as HistoryTab)} />

        <div>
          {activeTab === 'volume' && (
            <div className="space-y-4">
              {(history.volume.maxVolumeBar || history.volume.minVolumeBar) && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {history.volume.maxVolumeBar && (
                    <div className="neo-border neo-shadow-sm bg-white dark:bg-zinc-900 p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">Volume Tertinggi</p>
                      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">{history.volume.maxVolumeBar.interpretation}</p>
                    </div>
                  )}
                  {history.volume.minVolumeBar && (
                    <div className="neo-border neo-shadow-sm bg-white dark:bg-zinc-900 p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">Volume Terendah</p>
                      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">{history.volume.minVolumeBar.interpretation}</p>
                    </div>
                  )}
                </div>
              )}
              <EventTimeline events={history.volume.events} emptyLabel="Belum ada event volume signifikan yang terdeteksi." />
            </div>
          )}

          {activeTab === 'priceAction' && (
            <EventTimeline events={history.priceAction.events} emptyLabel="Belum ada pola price action yang terdeteksi." />
          )}

          {activeTab === 'breakout' && (
            <EventTimeline events={history.breakout.events} emptyLabel="Belum ada breakout/breakdown yang terdeteksi." />
          )}

          {activeTab === 'accumDist' && (
            <EventTimeline events={history.accumDist.events} emptyLabel="Belum ada sinyal akumulasi/distribusi yang terdeteksi." />
          )}

          {activeTab === 'indicatorCross' && (
            <EventTimeline events={history.indicatorCross.events} emptyLabel="Belum ada persilangan indikator yang terdeteksi." />
          )}

          {activeTab === 'historicalPattern' && (
            <HistoricalPatternPanel setups={history.historicalPattern.setups} />
          )}
        </div>
      </main>
    </div>
  );
}
