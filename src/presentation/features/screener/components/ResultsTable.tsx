import { Star, TrendingDown, TrendingUp, SearchX, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { StockSummary } from '@/domain/models/Stock';
import { PresetEvaluation } from '@/domain/screener/presets';
import { cn, formatCompact, formatPercent, formatRupiah } from '@/lib/format';

export interface ScreenerResult {
  summary: StockSummary;
  evaluation: PresetEvaluation;
}

export type ResultsView = 'table' | 'grid';

interface ResultsTableProps {
  results: ScreenerResult[];
  view: ResultsView;
  isWatchlisted: (ticker: string) => boolean;
  onToggleWatchlist: (ticker: string) => void;
}

// ── Avatar ────────────────────────────────────────────────────────────────────
const AVATAR_TONES = [
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300',
  'bg-blue-100 text-blue-700 dark:bg-blue-400/10 dark:text-blue-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300',
  'bg-violet-100 text-violet-700 dark:bg-violet-400/10 dark:text-violet-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-400/10 dark:text-rose-300',
  'bg-cyan-100 text-cyan-700 dark:bg-cyan-400/10 dark:text-cyan-300',
];

function avatarTone(ticker: string): string {
  const sum = [...ticker].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_TONES[sum % AVATAR_TONES.length];
}

function TickerAvatar({ ticker, size = 'md' }: { ticker: string; size?: 'sm' | 'md' }) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-semibold tracking-tight',
        size === 'md' ? 'size-9 text-xs' : 'size-7 text-[10px]',
        avatarTone(ticker)
      )}
    >
      {ticker.slice(0, 2)}
    </span>
  );
}

// ── Watchlist star ─────────────────────────────────────────────────────────────
function WatchlistStar({
  active,
  onToggle,
  ticker,
}: {
  active: boolean;
  onToggle: () => void;
  ticker: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggle(); }}
      aria-label={active ? `Hapus ${ticker} dari daftar pantau` : `Tambah ${ticker} ke daftar pantau`}
      aria-pressed={active}
      className={cn(
        'flex size-7 shrink-0 items-center justify-center rounded-full transition-colors',
        active ? 'text-amber-500' : 'text-zinc-300 hover:text-amber-400 dark:text-zinc-700'
      )}
    >
      <Star className="size-4" fill={active ? 'currentColor' : 'none'} strokeWidth={2} />
    </button>
  );
}

// ── ChangeBadge ────────────────────────────────────────────────────────────────
function ChangeBadge({ value }: { value: number }) {
  const positive = value >= 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-mono text-sm tabular-nums',
        positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
      )}
    >
      <Icon className="size-3.5" strokeWidth={2.5} />
      {formatPercent(value)}
    </span>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-zinc-300 px-6 py-14 text-center dark:border-zinc-800">
      <SearchX className="size-6 text-zinc-400 dark:text-zinc-600" strokeWidth={1.5} />
      <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">Belum ada saham yang lolos</p>
      <p className="max-w-xs text-sm text-zinc-400 dark:text-zinc-500">
        Tidak ada saham yang memenuhi kriteria preset ini hari ini. Coba preset lain atau pindai ulang besok.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Grid card — navigates to /screener/[ticker]
// ─────────────────────────────────────────────────────────────────────────────
function StockCard({
  result,
  isWatchlisted,
  onToggleWatchlist,
}: {
  result: ScreenerResult;
  isWatchlisted: boolean;
  onToggleWatchlist: () => void;
}) {
  const { summary } = result;
  const positive = summary.percentChange1D >= 0;

  return (
    <Link
      href={`/screener/${summary.ticker}`}
      className={cn(
        'group relative flex flex-col rounded-2xl border border-zinc-200 bg-white p-4 transition-all duration-200',
        'hover:border-emerald-300 hover:shadow-md hover:shadow-emerald-500/10 hover:-translate-y-0.5',
        'dark:border-zinc-800 dark:bg-zinc-900/30 dark:hover:border-emerald-500/40 dark:hover:shadow-emerald-400/10'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <TickerAvatar ticker={summary.ticker} />
          <div>
            <div className="font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
              {summary.ticker}
            </div>
            <div className="max-w-[9rem] truncate text-xs text-zinc-500 dark:text-zinc-400">{summary.name}</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <div className="text-right">
            <div className="font-mono text-sm tabular-nums text-zinc-800 dark:text-zinc-200">
              {formatRupiah(summary.lastClose)}
            </div>
            <ChangeBadge value={summary.percentChange1D} />
          </div>
          <WatchlistStar active={isWatchlisted} onToggle={onToggleWatchlist} ticker={summary.ticker} />
        </div>
      </div>

      {/* Footer meta */}
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-zinc-100 pt-3 text-xs text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        <span>Nilai {formatCompact(summary.value)}</span>
        {summary.per > 0 && <span>P/E {summary.per.toFixed(1)}</span>}
        <span className="ml-auto flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity font-medium">
          Analisis <ChevronRight className="size-3.5" />
        </span>
      </div>

      {/* Accent bar — change indicator */}
      <div
        className={cn(
          'absolute bottom-0 left-4 right-4 h-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity',
          positive ? 'bg-emerald-400' : 'bg-rose-400'
        )}
      />
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Table row — navigates to /screener/[ticker]
// ─────────────────────────────────────────────────────────────────────────────
function StockTableRow({
  result,
  isWatchlisted,
  onToggleWatchlist,
}: {
  result: ScreenerResult;
  isWatchlisted: boolean;
  onToggleWatchlist: () => void;
}) {
  const { summary } = result;

  return (
    <tr className="group transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/40">
      <td className="px-4 py-3">
        <WatchlistStar
          active={isWatchlisted}
          onToggle={onToggleWatchlist}
          ticker={summary.ticker}
        />
      </td>
      <td className="px-4 py-3">
        <Link href={`/screener/${summary.ticker}`} className="flex items-center gap-3">
          <TickerAvatar ticker={summary.ticker} />
          <div>
            <div className="font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
              {summary.ticker}
            </div>
            <div className="max-w-[14rem] truncate text-xs text-zinc-500 dark:text-zinc-400">
              {summary.name}
            </div>
          </div>
        </Link>
      </td>
      <td className="px-4 py-3 font-mono tabular-nums text-zinc-800 dark:text-zinc-200">
        {formatRupiah(summary.lastClose)}
      </td>
      <td className="px-4 py-3">
        <ChangeBadge value={summary.percentChange1D} />
      </td>
      <td className="px-4 py-3 font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
        {formatCompact(summary.value)}
      </td>
      <td className="px-4 py-3 font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
        {summary.per > 0 ? summary.per.toFixed(1) : '—'}
      </td>
      <td className="px-4 py-3">
        <Link
          href={`/screener/${summary.ticker}`}
          className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 dark:border-zinc-700 px-2.5 py-1 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:border-emerald-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
          aria-label={`Buka analisis detail ${summary.ticker}`}
        >
          Analisis <ChevronRight className="size-3" />
        </Link>
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────
export function ResultsTable({ results, view, isWatchlisted, onToggleWatchlist }: ResultsTableProps) {
  if (results.length === 0) return <EmptyState />;

  if (view === 'grid') {
    return (
      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {results.map((result) => (
          <StockCard
            key={result.summary.ticker}
            result={result}
            isWatchlisted={isWatchlisted(result.summary.ticker)}
            onToggleWatchlist={() => onToggleWatchlist(result.summary.ticker)}
          />
        ))}
      </div>
    );
  }

  // table view
  return (
    <>
      {/* Desktop / tablet: table */}
      <div className="hidden overflow-hidden rounded-2xl border border-zinc-200 md:block dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs font-medium uppercase tracking-wide text-zinc-500 dark:bg-zinc-900/60 dark:text-zinc-400">
            <tr>
              <th className="w-10 px-4 py-3" />
              <th className="px-4 py-3">Saham</th>
              <th className="px-4 py-3">Harga</th>
              <th className="px-4 py-3">1D</th>
              <th className="px-4 py-3">Nilai Transaksi</th>
              <th className="px-4 py-3">P/E</th>
              <th className="px-4 py-3">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {results.map((result) => (
              <StockTableRow
                key={result.summary.ticker}
                result={result}
                isWatchlisted={isWatchlisted(result.summary.ticker)}
                onToggleWatchlist={() => onToggleWatchlist(result.summary.ticker)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: stacked cards */}
      <div className="grid gap-2.5 md:hidden">
        {results.map((result) => (
          <StockCard
            key={result.summary.ticker}
            result={result}
            isWatchlisted={isWatchlisted(result.summary.ticker)}
            onToggleWatchlist={() => onToggleWatchlist(result.summary.ticker)}
          />
        ))}
      </div>
    </>
  );
}
