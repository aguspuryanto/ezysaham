'use client';

import { ArrowLeft, FlaskConical, Loader2, Play } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { BacktestPresetId, BacktestSignal, BacktestSignalStatus } from '@/domain/backtest/BacktestEntry';
import { cn, formatPercent, formatRupiah } from '@/lib/format';
import { useBacktest } from './hooks/useBacktest';

const PRESET_OPTIONS: Array<{ id: BacktestPresetId; label: string }> = [
  { id: 'dayTrading', label: 'Day Trading' },
  { id: 'swingHunter', label: 'Swing Hunter' },
];

const RANGE_OPTIONS = ['6mo', '1y', '2y'];
const HOLDING_DAYS_OPTIONS = [3, 5, 10, 20];

const STATUS_STYLES: Record<BacktestSignalStatus, string> = {
  tp_hit: 'bg-emerald-500 text-white dark:bg-emerald-600',
  sl_hit: 'bg-rose-500 text-white dark:bg-rose-600',
  timeout: 'bg-zinc-300 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300',
};

const STATUS_LABEL: Record<BacktestSignalStatus, string> = {
  tp_hit: 'TP Hit',
  sl_hit: 'SL Hit',
  timeout: 'Timeout',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function BacktestPage() {
  const { run, loading, progress, result, error } = useBacktest();
  const [presetId, setPresetId] = useState<BacktestPresetId>('dayTrading');
  const [tickersInput, setTickersInput] = useState('BBCA, BBRI, TLKM, BMRI, ASII');
  const [range, setRange] = useState('1y');
  const [holdingDays, setHoldingDays] = useState(5);

  const sortedSignals = useMemo(
    () => (result ? [...result.signals].sort((a, b) => b.signalDate.localeCompare(a.signalDate)) : []),
    [result]
  );

  const handleRun = () => {
    const tickers = tickersInput
      .split(',')
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean);
    if (tickers.length === 0) return;
    run({ presetId, tickers, range, holdingDays });
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm border-b border-zinc-200 dark:border-zinc-800 neo-border border-x-0 border-t-0">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-2.5 sm:px-6 sm:py-3">
          <Link
            href="/screener"
            className="flex shrink-0 items-center gap-1 text-sm font-bold text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            aria-label="Kembali ke screener"
          >
            <ArrowLeft className="size-4" strokeWidth={2.5} />
            <span className="hidden sm:inline text-xs uppercase tracking-wide">Screener</span>
          </Link>
          <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-700" />
          <div className="flex items-center gap-1.5 flex-1">
            <FlaskConical className="size-4 text-zinc-500" strokeWidth={2.5} />
            <span className="font-bold text-zinc-900 dark:text-zinc-100 text-base">Backtest</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-3 py-4 sm:px-6 sm:py-6 space-y-4">
        {/* Config form */}
        <div className="neo-border neo-shadow-sm bg-white dark:bg-zinc-900 p-3 sm:p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wide font-bold text-zinc-400 dark:text-zinc-500">
                Preset
              </label>
              <div className="mt-1 flex gap-1.5">
                {PRESET_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPresetId(opt.id)}
                    className={cn(
                      'neo-press flex-1 neo-border px-3 py-1.5 text-xs font-bold uppercase tracking-wide',
                      presetId === opt.id
                        ? 'bg-emerald-400 text-black dark:bg-emerald-500'
                        : 'bg-white text-zinc-600 dark:bg-zinc-950 dark:text-zinc-300'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wide font-bold text-zinc-400 dark:text-zinc-500">
                Range Data
              </label>
              <div className="mt-1 flex gap-1.5">
                {RANGE_OPTIONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRange(r)}
                    className={cn(
                      'neo-press flex-1 neo-border px-3 py-1.5 text-xs font-bold uppercase tracking-wide',
                      range === r
                        ? 'bg-emerald-400 text-black dark:bg-emerald-500'
                        : 'bg-white text-zinc-600 dark:bg-zinc-950 dark:text-zinc-300'
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wide font-bold text-zinc-400 dark:text-zinc-500">
              Ticker (pisahkan dengan koma)
            </label>
            <input
              type="text"
              value={tickersInput}
              onChange={(e) => setTickersInput(e.target.value)}
              placeholder="BBCA, BBRI, TLKM"
              className="mt-1 w-full neo-border bg-white px-3 py-1.5 text-sm font-mono dark:bg-zinc-950"
            />
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wide font-bold text-zinc-400 dark:text-zinc-500">
              Holding Period (hari bursa)
            </label>
            <div className="mt-1 flex gap-1.5">
              {HOLDING_DAYS_OPTIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setHoldingDays(d)}
                  className={cn(
                    'neo-press neo-border px-3 py-1.5 text-xs font-bold uppercase tracking-wide',
                    holdingDays === d
                      ? 'bg-emerald-400 text-black dark:bg-emerald-500'
                      : 'bg-white text-zinc-600 dark:bg-zinc-950 dark:text-zinc-300'
                  )}
                >
                  {d}D
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleRun}
            disabled={loading}
            className="neo-press flex w-full items-center justify-center gap-2 neo-border neo-shadow-sm bg-emerald-400 dark:bg-emerald-500 text-black px-4 py-2.5 text-sm font-bold uppercase tracking-wide disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" strokeWidth={2.5} />
                Memproses {progress.done}/{progress.total} ticker...
              </>
            ) : (
              <>
                <Play className="size-4" strokeWidth={2.5} />
                Jalankan Backtest
              </>
            )}
          </button>

          {error && <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{error}</p>}
        </div>

        {/* Results */}
        {result && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <StatCard label="Total Sinyal" value={String(result.signals.length)} />
              <StatCard
                label="Win Rate"
                value={result.winRate !== null ? formatPercent(result.winRate) : '–'}
                positive={result.winRate !== null ? result.winRate >= 50 : undefined}
              />
              <StatCard
                label="Avg Gain/Loss"
                value={result.avgGainLossPct !== null ? formatPercent(result.avgGainLossPct) : '–'}
                positive={result.avgGainLossPct !== null ? result.avgGainLossPct >= 0 : undefined}
              />
              <StatCard
                label="TP / SL / Timeout"
                value={`${result.signals.filter((s) => s.status === 'tp_hit').length} / ${result.signals.filter((s) => s.status === 'sl_hit').length} / ${result.signals.filter((s) => s.status === 'timeout').length}`}
              />
            </div>

            {sortedSignals.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-center px-4">
                <FlaskConical className="size-8 text-zinc-300 dark:text-zinc-700" />
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 max-w-xs">
                  Tidak ada sinyal ditemukan untuk kombinasi preset/ticker/periode ini.
                </p>
              </div>
            ) : (
              <div className="neo-border neo-shadow-sm bg-white dark:bg-zinc-900 overflow-x-auto">
                <table className="w-full text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b-2 border-(--neo-line) text-left text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      <th className="px-3 py-2 whitespace-nowrap">Tanggal Sinyal</th>
                      <th className="px-3 py-2 whitespace-nowrap">Ticker</th>
                      <th className="px-3 py-2 whitespace-nowrap text-right">Entry</th>
                      <th className="px-3 py-2 whitespace-nowrap text-right">TP1 / TP2</th>
                      <th className="px-3 py-2 whitespace-nowrap text-right">SL</th>
                      <th className="px-3 py-2 whitespace-nowrap">Tanggal Resolve</th>
                      <th className="px-3 py-2 whitespace-nowrap">Status</th>
                      <th className="px-3 py-2 whitespace-nowrap text-right">Gain/Loss %</th>
                      <th className="px-3 py-2 whitespace-nowrap text-right">Hari</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedSignals.map((signal, idx) => (
                      <SignalRow key={`${signal.ticker}-${signal.signalDate}-${idx}`} signal={signal} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="neo-border neo-shadow-sm bg-white dark:bg-zinc-900 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wide font-bold text-zinc-400 dark:text-zinc-500">{label}</div>
      <div
        className={cn(
          'font-mono text-lg font-bold tabular-nums',
          positive === undefined
            ? 'text-zinc-900 dark:text-zinc-100'
            : positive
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-rose-600 dark:text-rose-400'
        )}
      >
        {value}
      </div>
    </div>
  );
}

function SignalRow({ signal }: { signal: BacktestSignal }) {
  return (
    <tr className="border-b border-(--neo-line) last:border-b-0 align-top">
      <td className="px-3 py-2 whitespace-nowrap font-mono text-zinc-500 dark:text-zinc-400">
        {formatDate(signal.signalDate)}
      </td>
      <td className="px-3 py-2 whitespace-nowrap font-bold text-zinc-900 dark:text-zinc-100">{signal.ticker}</td>
      <td className="px-3 py-2 whitespace-nowrap text-right font-mono tabular-nums">{formatRupiah(signal.entry)}</td>
      <td className="px-3 py-2 whitespace-nowrap text-right font-mono tabular-nums">
        {formatRupiah(signal.tp1)}
        <span className="text-zinc-400 dark:text-zinc-600"> / {formatRupiah(signal.tp2)}</span>
      </td>
      <td className="px-3 py-2 whitespace-nowrap text-right font-mono tabular-nums text-rose-600 dark:text-rose-400">
        {formatRupiah(signal.sl)}
      </td>
      <td className="px-3 py-2 whitespace-nowrap font-mono text-zinc-500 dark:text-zinc-400">
        {formatDate(signal.resolvedDate)}
      </td>
      <td className="px-3 py-2 whitespace-nowrap">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 border border-(--neo-line) px-2 py-0.5 text-[10px] font-bold tracking-wide',
            STATUS_STYLES[signal.status]
          )}
        >
          {STATUS_LABEL[signal.status]}
        </span>
      </td>
      <td
        className={cn(
          'px-3 py-2 whitespace-nowrap text-right font-mono tabular-nums',
          signal.gainLossPct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
        )}
      >
        {formatPercent(signal.gainLossPct)}
      </td>
      <td className="px-3 py-2 whitespace-nowrap text-right font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
        {signal.daysHeld}
      </td>
    </tr>
  );
}
