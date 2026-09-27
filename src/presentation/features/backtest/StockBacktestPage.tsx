'use client';

import { AlertTriangle, ArrowLeft, CalendarDays, FlaskConical, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { OHLCVBar } from '@/domain/models/History';
import { getStockHistory } from '@/data/repositories/StockRepository';
import {
  BACKTEST_PARAMS,
  BacktestStats,
  EXIT_REASON_LABEL,
  runStructureMomentumBacktest,
} from '@/domain/backtest/structureMomentumBacktest';
import { cn, formatRupiah } from '@/lib/format';

/** Longest range the history API serves reliably — EMA200 warm-up eats the first ~200 bars. */
const BACKTEST_RANGE = '5y';

const pct = (n: number | null, dec = 2) => (n == null || !Number.isFinite(n) ? 'N/A' : `${n >= 0 ? '+' : ''}${n.toFixed(dec)}%`);
const num = (n: number | null, dec = 2) => (n == null || !Number.isFinite(n) ? 'N/A' : n.toFixed(dec));
const toneOf = (n: number | null) => (n == null ? 'text-zinc-500' : n > 0 ? 'text-emerald-600 dark:text-emerald-400' : n < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-zinc-700 dark:text-zinc-300');

function StatRow({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 border-b border-zinc-100 dark:border-zinc-800 last:border-b-0">
      <span className="text-xs text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className={cn('font-mono text-sm font-semibold tabular-nums text-zinc-800 dark:text-zinc-200', className)}>{value}</span>
    </div>
  );
}

function StatsCard({ title, subtitle, stats }: { title: string; subtitle: string; stats: BacktestStats }) {
  return (
    <div className="neo-border neo-shadow-sm bg-white dark:bg-zinc-900 p-4">
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-700 dark:text-zinc-200">{title}</h3>
        <span className="text-[11px] text-zinc-400">{subtitle}</span>
      </div>
      <StatRow label="Total Trades" value={String(stats.totalTrades)} />
      <StatRow label="Win Rate" value={stats.winRate == null ? 'N/A' : `${stats.winRate.toFixed(1)}% (${stats.wins}W / ${stats.losses}L)`} />
      <StatRow label="Average Win" value={pct(stats.avgWinPct)} className={toneOf(stats.avgWinPct)} />
      <StatRow label="Average Loss" value={pct(stats.avgLossPct)} className={toneOf(stats.avgLossPct)} />
      <StatRow label="Profit Factor" value={stats.profitFactor == null ? (stats.totalTrades > 0 ? 'N/A (tanpa loss)' : 'N/A') : num(stats.profitFactor)} />
      <StatRow label="Expectancy / trade" value={pct(stats.expectancyPct)} className={toneOf(stats.expectancyPct)} />
      <StatRow label="Max Drawdown" value={pct(stats.maxDrawdownPct)} className={toneOf(stats.maxDrawdownPct)} />
      <StatRow label="Avg Holding" value={stats.avgHoldingDays == null ? 'N/A' : `${stats.avgHoldingDays.toFixed(1)} hari bursa`} />
      <StatRow label="Total Return" value={pct(stats.totalReturnPct)} className={toneOf(stats.totalReturnPct)} />
      {stats.tooFewTrades && (
        <p className="mt-2 flex items-start gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
          <AlertTriangle className="size-3.5 mt-0.5 shrink-0" strokeWidth={2.5} />
          Trade terlalu sedikit (&lt; {BACKTEST_PARAMS.minTradesForConfidence}) — tidak signifikan.
        </p>
      )}
    </div>
  );
}

type PageStatus = 'loading' | 'ready' | 'error';

export function StockBacktestPage({ ticker }: { ticker: string }) {
  const [state, setState] = useState<{ status: PageStatus; bars: OHLCVBar[] }>({ status: 'loading', bars: [] });

  useEffect(() => {
    let cancelled = false;
    getStockHistory(ticker, BACKTEST_RANGE)
      .then((bars) => { if (!cancelled) setState({ status: bars.length > 0 ? 'ready' : 'error', bars }); })
      .catch(() => { if (!cancelled) setState({ status: 'error', bars: [] }); });
    return () => { cancelled = true; };
  }, [ticker]);

  const result = useMemo(() => runStructureMomentumBacktest(state.bars), [state.bars]);

  if (state.status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center gap-3 bg-white dark:bg-zinc-950">
        <Loader2 className="size-6 animate-spin text-emerald-500" />
        <span className="text-zinc-500 dark:text-zinc-400">Menjalankan backtest {ticker}…</span>
      </div>
    );
  }

  if (state.status === 'error' || !result) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white dark:bg-zinc-950 px-4">
        <AlertTriangle className="size-10 text-amber-400" />
        <p className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">Backtest tidak bisa dijalankan</p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center max-w-xs">
          Data harga <strong>{ticker}</strong> tidak tersedia atau kurang dari {BACKTEST_PARAMS.emaTrend + 4} bar (butuh EMA200).
        </p>
        <Link href={`/screener/${ticker}`} className="neo-press inline-flex items-center gap-2 neo-border neo-shadow-sm bg-emerald-400 px-4 py-2 text-sm font-bold text-black">
          <ArrowLeft className="size-4" strokeWidth={2.5} /> Kembali ke Analisis
        </Link>
      </div>
    );
  }

  const P = BACKTEST_PARAMS;
  const trades = [...result.trades].reverse();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-20 neo-border border-x-0 border-t-0 bg-white dark:bg-zinc-950">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link
            href={`/screener/${ticker}`}
            className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            aria-label="Kembali ke analisis"
          >
            <ArrowLeft className="size-4" strokeWidth={2.5} />
            <span className="hidden sm:inline">Analisis</span>
          </Link>
          <div className="h-5 w-[3px] bg-(--neo-line)" />
          <span className="font-bold text-zinc-900 dark:text-zinc-100 text-lg">{ticker}</span>
          <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Backtest</span>
          <Link
            href={`/backtest/${ticker}/harian`}
            className="neo-press ml-auto flex items-center gap-1.5 px-3 py-1.5 neo-border neo-shadow-sm bg-white text-sm font-bold text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"
          >
            <CalendarDays className="size-3.5" strokeWidth={2.5} />
            Harian 60 Hari
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 pb-16 space-y-5">
        <div className="neo-border neo-shadow bg-white dark:bg-zinc-900 p-5 space-y-3">
          <h1 className="flex items-center gap-2 text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            <FlaskConical className="size-6" strokeWidth={2.5} />
            Backtest — {ticker}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Market Structure + EMA {P.emaFast}/{P.emaSlow}/{P.emaTrend} + Momentum Candle + Volume · {result.barCount} bar EOD
            ({result.firstDate} → {result.lastDate}) · sinyal pertama mungkin setelah {result.warmupDate ?? 'N/A'} (warm-up EMA200)
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
            <li><b>Trend:</b> Close &gt; EMA{P.emaTrend} dan EMA{P.emaFast} &gt; EMA{P.emaSlow}</li>
            <li><b>Structure:</b> Higher High + Higher Low, swing N={P.swingN} yang sudah terkonfirmasi</li>
            <li><b>Momentum:</b> Close &gt; Open, Body/Range ≥ {P.minBodyRatio}, Close ≥ High − {P.maxUpperWickRatio}·Range</li>
            <li><b>Volume:</b> Volume ≥ SMA{P.volumeSma} × {P.volumeMultiplier}</li>
            <li><b>Entry:</b> Open candle setelah sinyal · <b>SL:</b> swing low terkonfirmasi terakhir</li>
            <li><b>Exit:</b> Low ≤ SL · Close &lt; EMA{P.emaSlow} · struktur invalid (SL dicek lebih dulu)</li>
          </ul>
        </div>

        <div className="neo-border bg-amber-50 dark:bg-amber-400/10 border-amber-400 px-4 py-3 text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed">
          <p className="text-xs font-bold uppercase tracking-wide text-zinc-600 dark:text-zinc-300 mb-1">Kesimpulan</p>
          {result.verdict}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <StatsCard title="In-Sample" subtitle={`70% · s/d ${result.splitDate}`} stats={result.inSample} />
          <StatsCard title="Out-of-Sample" subtitle={`30% · dari ${result.splitDate}`} stats={result.outOfSample} />
          <StatsCard title="Semua Data" subtitle="100%" stats={result.all} />
        </div>

        {(result.openPosition || result.invalidSignals.length > 0) && (
          <div className="neo-border bg-white dark:bg-zinc-900 px-4 py-3 space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
            {result.openPosition && (
              <p>
                <b>Posisi masih terbuka</b> (tidak dihitung di statistik): entry {result.openPosition.entryDate} di {formatRupiah(result.openPosition.entryPrice)},
                SL {formatRupiah(result.openPosition.stopLoss)}, close terakhir {formatRupiah(result.openPosition.lastClose)}{' '}
                (<span className={toneOf(result.openPosition.unrealizedPct)}>{pct(result.openPosition.unrealizedPct)}</span>).
              </p>
            )}
            {result.invalidSignals.length > 0 && (
              <p>
                <b>{result.invalidSignals.length} sinyal INVALID</b> (SL ≥ Entry, tidak dieksekusi):{' '}
                {result.invalidSignals.map((s) => s.signalDate).join(', ')}.
              </p>
            )}
          </div>
        )}

        <div className="neo-border neo-shadow-sm bg-white dark:bg-zinc-900">
          <h2 className="px-4 py-3 text-sm font-bold uppercase tracking-wide text-zinc-700 dark:text-zinc-200 border-b-[3px] border-(--neo-line)">
            Detail Trade ({result.trades.length})
          </h2>
          {trades.length === 0 ? (
            <p className="px-4 py-6 text-sm text-zinc-500 dark:text-zinc-400">Tidak ada trade tertutup pada periode ini.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="text-left text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  <tr className="border-b border-zinc-200 dark:border-zinc-800">
                    {['Set', 'Entry Date', 'Entry', 'SL', 'Exit Date', 'Exit', 'P/L %', 'Hold', 'Exit Reason'].map((h) => (
                      <th key={h} className="px-3 py-2 font-bold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="font-mono tabular-nums">
                  {trades.map((t) => (
                    <tr key={t.entryDate} className="border-b border-zinc-100 dark:border-zinc-800 last:border-b-0">
                      <td className="px-3 py-2 font-sans text-xs font-bold text-zinc-500">{t.set === 'IN_SAMPLE' ? 'IS' : 'OOS'}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{t.entryDate}</td>
                      <td className="px-3 py-2">{formatRupiah(t.entryPrice)}</td>
                      <td className="px-3 py-2 text-rose-600 dark:text-rose-400">{formatRupiah(Math.round(t.stopLoss))}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{t.exitDate}</td>
                      <td className="px-3 py-2">{formatRupiah(Math.round(t.exitPrice))}</td>
                      <td className={cn('px-3 py-2 font-bold', toneOf(t.plPct))}>{pct(t.plPct)}</td>
                      <td className="px-3 py-2">{t.holdingDays}h</td>
                      <td className="px-3 py-2 font-sans text-xs">{EXIT_REASON_LABEL[t.exitReason]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-xs text-zinc-400 leading-relaxed">
          Parameter tetap (tidak dioptimasi dari hasil), satu posisi dalam satu waktu, modal penuh per trade, belum termasuk fee &amp; slippage.
          Hold = jumlah hari bursa dari candle entry sampai candle exit. Hasil masa lalu bukan jaminan hasil masa depan. Edukasi, bukan ajakan jual/beli.
        </p>
      </main>
    </div>
  );
}
