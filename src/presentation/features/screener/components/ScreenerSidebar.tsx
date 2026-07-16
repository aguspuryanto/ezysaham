import { ListFilter, Star } from 'lucide-react';
import { StockSummary } from '@/domain/models/Stock';
import { cn, formatPercent } from '@/lib/format';

export function FilterInfoCard({
  label,
  description,
  criteria,
}: {
  label: string;
  description: string;
  criteria: string[];
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
        <ListFilter className="size-4 text-emerald-600 dark:text-emerald-400" />
        Filter Aktif — {label}
      </div>
      <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">{description}</p>
      {criteria.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {criteria.map((c) => (
            <li key={c} className="flex items-start gap-1.5 text-xs text-zinc-600 dark:text-zinc-300">
              <span className="mt-1 size-1 shrink-0 rounded-full bg-emerald-500" />
              {c}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function WatchlistCard({
  tickers,
  summaries,
  onRemove,
}: {
  tickers: string[];
  summaries: StockSummary[];
  onRemove: (ticker: string) => void;
}) {
  const items = tickers
    .map((t) => summaries.find((s) => s.ticker === t))
    .filter((s): s is StockSummary => !!s);

  return (
    <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
        <Star className="size-4 text-amber-500" fill="currentColor" strokeWidth={0} />
        Daftar Pantau ({items.length})
      </div>
      {items.length === 0 ? (
        <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
          Klik ikon bintang pada saham untuk menambahkannya ke daftar pantau.
        </p>
      ) : (
        <ul className="mt-3 max-h-72 space-y-0.5 overflow-y-auto">
          {items.map((s) => (
            <li
              key={s.ticker}
              className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-900"
            >
              <span className="font-semibold text-zinc-700 dark:text-zinc-200">{s.ticker}</span>
              <span
                className={cn(
                  'font-mono tabular-nums',
                  s.percentChange1D >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                )}
              >
                {formatPercent(s.percentChange1D)}
              </span>
              <button
                type="button"
                onClick={() => onRemove(s.ticker)}
                aria-label={`Hapus ${s.ticker} dari daftar pantau`}
                className="text-zinc-400 hover:text-rose-500"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
