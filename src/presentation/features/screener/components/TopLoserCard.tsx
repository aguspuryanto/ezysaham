import { Snowflake } from 'lucide-react';
import Link from 'next/link';
import { StockSummary } from '@/domain/models/Stock';
import { formatPercent, formatRupiah } from '@/lib/format';

export function TopLoserCard({ summaries }: { summaries: StockSummary[] }) {
  const topLosers = [...summaries]
    .sort((a, b) => a.percentChange1D - b.percentChange1D)
    .slice(0, 5);

  if (topLosers.length === 0) return null;

  return (
    <div className="neo-border neo-shadow bg-white p-4 dark:bg-zinc-900">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-zinc-800 dark:text-zinc-100">
          <Snowflake className="size-4 text-blue-500" strokeWidth={2.5} />
          Top 5 Loser Hari Ini
        </span>
        <Link
          href="/losers"
          className="text-xs font-bold uppercase tracking-wide text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-200"
        >
          Lihat Semua →
        </Link>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {topLosers.map((s, i) => (
          <Link
            key={s.ticker}
            href={`/screener/${s.ticker}`}
            className="neo-press flex flex-col gap-1 border-2 border-(--neo-line) bg-rose-50 px-3 py-2 hover:bg-rose-100 dark:bg-rose-400/10 dark:hover:bg-rose-400/20"
          >
            <span className="flex items-center justify-between gap-1">
              <span className="text-xs font-bold text-zinc-800 dark:text-zinc-100">{s.ticker}</span>
              <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500">#{i + 1}</span>
            </span>
            <span className="font-mono text-xs font-semibold tabular-nums text-zinc-600 dark:text-zinc-300">
              {formatRupiah(s.lastClose)}
            </span>
            <span className="font-mono text-sm font-bold tabular-nums text-rose-600 dark:text-rose-400">
              {formatPercent(s.percentChange1D)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
