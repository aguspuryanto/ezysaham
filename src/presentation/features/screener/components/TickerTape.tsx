import { StockSummary } from '@/domain/models/Stock';
import { cn, formatPercent, formatRupiah } from '@/lib/format';

export function TickerTape({ movers }: { movers: StockSummary[] }) {
  if (movers.length === 0) return null;

  // Duplicated so the marquee loops seamlessly at translateX(-50%).
  const loopItems = [...movers, ...movers];

  return (
    <div className="overflow-hidden border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="animate-marquee motion-reduce:animate-none flex w-max gap-6 whitespace-nowrap py-2">
        {loopItems.map((s, i) => (
          <span key={`${s.ticker}-${i}`} className="flex items-center gap-1.5 px-2 text-xs">
            <span className="font-semibold text-zinc-700 dark:text-zinc-200">{s.ticker}</span>
            <span className="font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
              {formatRupiah(s.lastClose)}
            </span>
            <span
              className={cn(
                'font-mono tabular-nums',
                s.percentChange1D >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              )}
            >
              {formatPercent(s.percentChange1D)}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
