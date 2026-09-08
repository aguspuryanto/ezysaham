'use client';

import { ArrowLeft, Loader2, NotebookPen, RefreshCw, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import { JournalEntry, JournalStatus } from '@/domain/models/JournalEntry';
import { cn, formatPercent, formatRupiah } from '@/lib/format';
import { useJournal } from './hooks/useJournal';

const STATUS_STYLES: Record<JournalStatus, string> = {
  open: 'bg-amber-400 text-white dark:bg-amber-500',
  tp_hit: 'bg-emerald-500 text-white dark:bg-emerald-600',
  sl_hit: 'bg-rose-500 text-white dark:bg-rose-600',
  sideways: 'bg-zinc-300 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300',
};

const STATUS_LABEL: Record<JournalStatus, string> = {
  open: 'Open',
  tp_hit: 'Exit TP',
  sl_hit: 'Exit SL',
  sideways: 'Sideways',
};

function hasilLabel(status: JournalStatus): string {
  if (status === 'tp_hit') return 'WIN';
  if (status === 'sl_hit') return 'LOSS';
  return '–';
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function JournalPage() {
  const { entries, loading, refresh, removeEntry } = useJournal();

  const sorted = useMemo(
    () => [...entries].sort((a, b) => b.addedAt.localeCompare(a.addedAt)),
    [entries]
  );

  const stats = useMemo(() => {
    const resolved = entries.filter((e) => e.status !== 'open');
    const wins = resolved.filter((e) => e.status === 'tp_hit');
    const gains = resolved.map((e) => e.gainLossPct ?? 0);
    const avgGainLoss = gains.length > 0 ? gains.reduce((a, b) => a + b, 0) / gains.length : 0;
    return {
      total: entries.length,
      resolved: resolved.length,
      winRate: resolved.length > 0 ? (wins.length / resolved.length) * 100 : null,
      avgGainLoss,
    };
  }, [entries]);

  const handleDelete = async (id: string, ticker: string) => {
    if (!confirm(`Hapus entri jurnal ${ticker}?`)) return;
    await removeEntry(id);
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
            <NotebookPen className="size-4 text-zinc-500" strokeWidth={2.5} />
            <span className="font-bold text-zinc-900 dark:text-zinc-100 text-base">Jurnal Trading</span>
          </div>
          <button
            type="button"
            onClick={() => refresh()}
            disabled={loading}
            title="Refresh Outcomes"
            className="neo-press flex shrink-0 items-center gap-1.5 size-8 sm:size-auto sm:px-3 sm:py-1.5 justify-center neo-border neo-shadow-sm bg-white text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 rounded-lg text-xs font-bold uppercase tracking-wide disabled:opacity-50"
          >
            <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} strokeWidth={2.5} />
            <span className="hidden sm:inline">Refresh Outcomes</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-3 py-4 sm:px-6 sm:py-6 space-y-4">
        {/* Summary stat row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatCard label="Total Entri" value={String(stats.total)} />
          <StatCard label="Selesai" value={`${stats.resolved} dari ${stats.total}`} />
          <StatCard label="Win Rate" value={stats.winRate !== null ? formatPercent(stats.winRate) : '–'} />
          <StatCard
            label="Avg Gain/Loss"
            value={stats.resolved > 0 ? formatPercent(stats.avgGainLoss) : '–'}
            positive={stats.avgGainLoss >= 0}
          />
        </div>

        {loading && entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-zinc-400">
            <Loader2 className="size-6 animate-spin" />
            <span className="text-sm font-medium">Memuat jurnal...</span>
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center px-4">
            <NotebookPen className="size-8 text-zinc-300 dark:text-zinc-700" />
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 max-w-xs">
              Belum ada entri jurnal — tambahkan dari Screener (Day Trading / Swing Hunter) atau halaman Analisa saham.
            </p>
          </div>
        ) : (
          <div className="neo-border neo-shadow-sm bg-white dark:bg-zinc-900 overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="border-b-2 border-(--neo-line) text-left text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  <th className="px-3 py-2 whitespace-nowrap">Tanggal</th>
                  <th className="px-3 py-2 whitespace-nowrap">Ticker</th>
                  <th className="px-3 py-2 whitespace-nowrap text-right">Entry</th>
                  <th className="px-3 py-2 whitespace-nowrap text-right">TP1 / TP2</th>
                  <th className="px-3 py-2 whitespace-nowrap text-right">SL</th>
                  <th className="px-3 py-2 whitespace-nowrap">Status Exit</th>
                  <th className="px-3 py-2 whitespace-nowrap">Hasil</th>
                  <th className="px-3 py-2 whitespace-nowrap text-right">Gain/Loss %</th>
                  <th className="px-3 py-2 min-w-[200px]">Alasan Membeli</th>
                  <th className="px-3 py-2 min-w-[200px]">Alasan Menghindari</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((entry) => (
                  <JournalRow key={entry.id} entry={entry} onDelete={() => handleDelete(entry.id, entry.ticker)} />
                ))}
              </tbody>
            </table>
          </div>
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

function JournalRow({ entry, onDelete }: { entry: JournalEntry; onDelete: () => void }) {
  const gain = entry.gainLossPct;
  return (
    <tr className="border-b border-(--neo-line) last:border-b-0 align-top">
      <td className="px-3 py-2 whitespace-nowrap font-mono text-zinc-500 dark:text-zinc-400">{formatDate(entry.addedAt)}</td>
      <td className="px-3 py-2 whitespace-nowrap font-bold text-zinc-900 dark:text-zinc-100">{entry.ticker}</td>
      <td className="px-3 py-2 whitespace-nowrap text-right font-mono tabular-nums">{formatRupiah(entry.entry)}</td>
      <td className="px-3 py-2 whitespace-nowrap text-right font-mono tabular-nums">
        {formatRupiah(entry.tp1)}
        <span className="text-zinc-400 dark:text-zinc-600"> / {formatRupiah(entry.tp2)}</span>
      </td>
      <td className="px-3 py-2 whitespace-nowrap text-right font-mono tabular-nums text-rose-600 dark:text-rose-400">{formatRupiah(entry.sl)}</td>
      <td className="px-3 py-2 whitespace-nowrap">
        <span className={cn('inline-flex items-center gap-1.5 border border-(--neo-line) px-2 py-0.5 text-[10px] font-bold tracking-wide', STATUS_STYLES[entry.status])}>
          {STATUS_LABEL[entry.status]}
        </span>
      </td>
      <td className={cn(
        'px-3 py-2 whitespace-nowrap font-bold',
        entry.status === 'sl_hit' ? 'text-rose-600 dark:text-rose-400' : entry.status === 'tp_hit' ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400'
      )}>
        {hasilLabel(entry.status)}
      </td>
      <td className={cn(
        'px-3 py-2 whitespace-nowrap text-right font-mono tabular-nums',
        gain === null ? 'text-zinc-400' : gain >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
      )}>
        {gain === null ? '–' : formatPercent(gain)}
      </td>
      <td className="px-3 py-2 text-zinc-600 dark:text-zinc-300">{entry.reasonBuy || '–'}</td>
      <td className="px-3 py-2 text-zinc-600 dark:text-zinc-300">{entry.reasonAvoid || '–'}</td>
      <td className="px-3 py-2 whitespace-nowrap">
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Hapus entri ${entry.ticker}`}
          className="neo-press flex size-7 items-center justify-center neo-border bg-white text-zinc-400 hover:text-rose-600 dark:bg-zinc-900 dark:hover:text-rose-400"
        >
          <Trash2 className="size-3.5" strokeWidth={2.5} />
        </button>
      </td>
    </tr>
  );
}
