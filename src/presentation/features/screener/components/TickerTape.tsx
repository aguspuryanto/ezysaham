import { StockSummary } from '@/domain/models/Stock';
import { cn, formatPercent, formatRupiah } from '@/lib/format';

export function TickerTape({ movers }: { movers: StockSummary[] }) {
  if (movers.length === 0) return null;

  // Duplicated so the marquee loops seamlessly at translateX(-50%).
  const loopItems = [...movers, ...movers];

  return (
    <div className="overflow-hidden neo-border border-x-0 border-t-0 bg-(--neo-accent)">
      <div className="animate-marquee motion-reduce:animate-none flex w-max gap-6 whitespace-nowrap py-2">
        {loopItems.map((s, i) => (
          <span key={`${s.ticker}-${i}`} className="flex items-center gap-1.5 px-2 text-xs">
            <span className="font-bold text-black">{s.ticker}</span>
            <span className="font-mono font-semibold tabular-nums text-black/70">
              {formatRupiah(s.lastClose)}
            </span>
            <span
              className={cn(
                'font-mono font-bold tabular-nums',
                s.percentChange1D >= 0 ? 'text-emerald-700' : 'text-rose-700'
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
