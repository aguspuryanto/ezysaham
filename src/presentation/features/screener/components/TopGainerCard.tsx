import { Flame } from 'lucide-react';
import Link from 'next/link';
import { StockSummary } from '@/domain/models/Stock';
import { formatPercent, formatRupiah } from '@/lib/format';

export function TopGainerCard({ summaries }: { summaries: StockSummary[] }) {
  const topGainers = [...summaries]
    .sort((a, b) => b.percentChange1D - a.percentChange1D)
    .slice(0, 5);

  if (topGainers.length === 0) return null;

  return (
    <div className="neo-border neo-shadow bg-white p-4 dark:bg-zinc-900">
      <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-zinc-800 dark:text-zinc-100">
        <Flame className="size-4 text-rose-500" strokeWidth={2.5} />
        Top 5 Gainer Hari Ini
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {topGainers.map((s, i) => (
          <Link
            key={s.ticker}
            href={`/screener/${s.ticker}`}
            className="neo-press flex flex-col gap-1 border-2 border-(--neo-line) bg-emerald-50 px-3 py-2 hover:bg-emerald-100 dark:bg-emerald-400/10 dark:hover:bg-emerald-400/20"
          >
            <span className="flex items-center justify-between gap-1">
              <span className="text-xs font-bold text-zinc-800 dark:text-zinc-100">{s.ticker}</span>
              <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500">#{i + 1}</span>
            </span>
            <span className="font-mono text-xs font-semibold tabular-nums text-zinc-600 dark:text-zinc-300">
              {formatRupiah(s.lastClose)}
            </span>
            <span className="font-mono text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {formatPercent(s.percentChange1D)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
