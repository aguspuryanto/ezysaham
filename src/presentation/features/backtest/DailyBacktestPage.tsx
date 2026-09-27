'use client';

import { AlertTriangle, ArrowLeft, CalendarDays, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { OHLCVBar } from '@/domain/models/History';
import { getStockHistory } from '@/data/repositories/StockRepository';
import {
  DAILY_EXIT_LABEL,
  DAILY_FILTER_LABEL,
  DailyBacktestConfig,
  DailyBacktestFilters,
  DEFAULT_DAILY_BACKTEST_CONFIG,
  runDailyTradingBacktest,
} from '@/domain/backtest/dailyTradingBacktest';
import { cn, formatRupiah } from '@/lib/format';

/** 60 tested days + EMA20/SMA20 warm-up. */
const HISTORY_RANGE = '6mo';
const DAY_OPTIONS = [20, 40, 60];

const pct = (n: number | null, dec = 2) => (n == null || !Number.isFinite(n) ? 'N/A' : `${n >= 0 ? '+' : ''}${n.toFixed(dec)}%`);
const toneOf = (n: number | null) => (n == null ? 'text-zinc-500' : n > 0 ? 'text-emerald-600 dark:text-emerald-400' : n < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-zinc-700 dark:text-zinc-300');

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="neo-border bg-white dark:bg-zinc-900 px-3 py-2">
      <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className={cn('mt-0.5 font-mono text-base font-bold tabular-nums text-zinc-900 dark:text-zinc-100', className)}>{value}</p>
    </div>
  );
}

function NumberField({ label, value, onChange, step = 0.5, suffix }: {
  label: string; value: number; onChange: (v: number) => void; step?: number; suffix?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">
      {label}
      <span className="flex items-center neo-border bg-white dark:bg-zinc-900">
        <input
          type="number"
          min={0}
          step={step}
          value={value}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
          className="w-full min-w-0 bg-transparent px-2 py-1.5 font-mono text-sm text-zinc-900 dark:text-zinc-100 outline-none"
        />
        {suffix && <span className="px-2 text-zinc-400">{suffix}</span>}
      </span>
    </label>
  );
}

type PageStatus = 'loading' | 'ready' | 'error';

export function DailyBacktestPage({ ticker }: { ticker: string }) {
  const [state, setState] = useState<{ status: PageStatus; bars: OHLCVBar[] }>({ status: 'loading', bars: [] });
  const [config, setConfig] = useState<DailyBacktestConfig>(DEFAULT_DAILY_BACKTEST_CONFIG);

  useEffect(() => {
    let cancelled = false;
    getStockHistory(ticker, HISTORY_RANGE)
      .then((bars) => { if (!cancelled) setState({ status: bars.length > 1 ? 'ready' : 'error', bars }); })
      .catch(() => { if (!cancelled) setState({ status: 'error', bars: [] }); });
    return () => { cancelled = true; };
  }, [ticker]);

  const result = useMemo(() => runDailyTradingBacktest(state.bars, config), [state.bars, config]);
  const setFilter = (k: keyof DailyBacktestFilters, v: boolean) => setConfig((c) => ({ ...c, filters: { ...c.filters, [k]: v } }));

  if (state.status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center gap-3 bg-white dark:bg-zinc-950">
        <Loader2 className="size-6 animate-spin text-emerald-500" />
        <span className="text-zinc-500 dark:text-zinc-400">Memuat data {ticker}…</span>
      </div>
    );
  }

  if (state.status === 'error' || !result) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white dark:bg-zinc-950 px-4">
        <AlertTriangle className="size-10 text-amber-400" />
        <p className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">Data harga {ticker} tidak tersedia</p>
        <Link href={`/backtest/${ticker}`} className="neo-press inline-flex items-center gap-2 neo-border neo-shadow-sm bg-emerald-400 px-4 py-2 text-sm font-bold text-black">
          <ArrowLeft className="size-4" strokeWidth={2.5} /> Kembali ke Backtest
        </Link>
      </div>
    );
  }

  const s = result.stats;
  const trades = [...result.trades].reverse();
  const skipped = result.days.filter((d) => !d.traded).length;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-20 neo-border border-x-0 border-t-0 bg-white dark:bg-zinc-950">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link
            href={`/backtest/${ticker}`}
            className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            aria-label="Kembali ke backtest"
          >
            <ArrowLeft className="size-4" strokeWidth={2.5} />
            <span className="hidden sm:inline">Backtest</span>
          </Link>
          <div className="h-5 w-[3px] bg-(--neo-line)" />
          <span className="font-bold text-zinc-900 dark:text-zinc-100 text-lg">{ticker}</span>
          <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Backtest Harian</span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 pb-16 space-y-5">
        <div className="neo-border neo-shadow bg-white dark:bg-zinc-900 p-5 space-y-4">
          <div>
            <h1 className="flex items-center gap-2 text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              <CalendarDays className="size-6" strokeWidth={2.5} />
              Backtest Trading Harian — {ticker}
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {s.daysTested} hari bursa ({result.firstDate} → {result.lastDate}) · beli di Open, jual di hari yang sama saat TP / SL / Close.
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {DAY_OPTIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setConfig((c) => ({ ...c, days: d }))}
                className={cn(
                  'neo-press neo-border px-3 py-1 text-sm font-bold',
                  config.days === d ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'bg-white text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300',
                )}
              >
                {d} hari
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3 max-w-md">
            <NumberField label="Take Profit" value={config.tpPct} suffix="%" onChange={(v) => setConfig((c) => ({ ...c, tpPct: v }))} />
            <NumberField label="Stop Loss" value={config.slPct} suffix="%" onChange={(v) => setConfig((c) => ({ ...c, slPct: v }))} />
            <NumberField label="Fee PP" value={config.feePct} step={0.05} suffix="%" onChange={(v) => setConfig((c) => ({ ...c, feePct: v }))} />
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-zinc-600 dark:text-zinc-300 mb-1.5">Filter opsional (tidak wajib)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {(Object.keys(DAILY_FILTER_LABEL) as (keyof DailyBacktestFilters)[]).map((k) => (
                <label key={k} className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                  <input type="checkbox" checked={config.filters[k]} onChange={(e) => setFilter(k, e.target.checked)} className="size-4 accent-emerald-500" />
                  {DAILY_FILTER_LABEL[k]}
                </label>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-zinc-400">TP / SL 0% = tidak dipakai. Semua filter mati = beli setiap hari.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Total Return" value={pct(s.totalReturnPct)} className={toneOf(s.totalReturnPct)} />
          <Stat label="Buy & Hold" value={pct(s.buyHoldPct)} className={toneOf(s.buyHoldPct)} />
          <Stat label="Trades" value={`${s.totalTrades} / ${s.daysTested} hari`} />
          <Stat label="Win Rate" value={s.winRate == null ? 'N/A' : `${s.winRate.toFixed(1)}%`} />
          <Stat label="Avg Win / Loss" value={`${pct(s.avgWinPct)} / ${pct(s.avgLossPct)}`} />
          <Stat label="Profit Factor" value={s.profitFactor == null ? 'N/A' : s.profitFactor.toFixed(2)} />
          <Stat label="Expectancy" value={pct(s.expectancyPct)} className={toneOf(s.expectancyPct)} />
          <Stat label="Max Drawdown" value={pct(s.maxDrawdownPct)} className={toneOf(s.maxDrawdownPct)} />
        </div>

        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Exit: <b>{s.tpHits}</b> Take Profit · <b>{s.slHits}</b> Stop Loss · <b>{s.closeExits}</b> jual di Close
          {skipped > 0 && <> · <b>{skipped}</b> hari dilewati filter</>}.
          {s.totalTrades > 0 && s.totalTrades < 30 && ' Sampel < 30 trade — hasil belum signifikan.'}
        </p>

        <div className="neo-border neo-shadow-sm bg-white dark:bg-zinc-900">
          <h2 className="px-4 py-3 text-sm font-bold uppercase tracking-wide text-zinc-700 dark:text-zinc-200 border-b-[3px] border-(--neo-line)">
            Detail Trade Harian ({result.trades.length})
          </h2>
          {trades.length === 0 ? (
            <p className="px-4 py-6 text-sm text-zinc-500 dark:text-zinc-400">Tidak ada trade — semua hari terfilter.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="text-left text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  <tr className="border-b border-zinc-200 dark:border-zinc-800">
                    {['Tanggal', 'Entry (Open)', 'TP', 'SL', 'Exit', 'P/L % (net)', 'Exit Reason', 'Equity'].map((h) => (
                      <th key={h} className="px-3 py-2 font-bold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="font-mono tabular-nums">
                  {trades.map((t) => (
                    <tr key={t.date} className="border-b border-zinc-100 dark:border-zinc-800 last:border-b-0">
                      <td className="px-3 py-2 whitespace-nowrap">{t.date}</td>
                      <td className="px-3 py-2">{formatRupiah(t.entry)}</td>
                      <td className="px-3 py-2 text-emerald-700 dark:text-emerald-400">{t.tp != null ? formatRupiah(t.tp) : '–'}</td>
                      <td className="px-3 py-2 text-rose-600 dark:text-rose-400">{t.sl != null ? formatRupiah(t.sl) : '–'}</td>
                      <td className="px-3 py-2">{formatRupiah(Math.round(t.exit))}</td>
                      <td className={cn('px-3 py-2 font-bold', toneOf(t.plPct))}>{pct(t.plPct)}</td>
                      <td className="px-3 py-2 font-sans text-xs">{DAILY_EXIT_LABEL[t.exitReason]}</td>
                      <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">{t.equity.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-xs text-zinc-400 leading-relaxed">
          Simulasi dari candle harian (EOD): urutan harga di dalam hari tidak diketahui, jadi jika TP dan SL sama-sama tersentuh dianggap SL lebih dulu.
          Filter hanya memakai data sampai kemarin (gap up memakai Open hari ini, yang sudah diketahui saat entry). Equity mulai dari 100, modal penuh per trade,
          fee dipotong setiap trade, belum termasuk slippage/ARB/ARA. Hasil masa lalu bukan jaminan hasil masa depan. Edukasi, bukan ajakan jual/beli.
        </p>
      </main>
    </div>
  );
}
