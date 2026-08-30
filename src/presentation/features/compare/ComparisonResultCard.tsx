import { Trophy } from 'lucide-react';
import { cn } from '@/lib/format';

function joinList(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} & ${items[items.length - 1]}`;
}

interface ComparisonResultCardProps {
  tickerA: string;
  tickerB: string;
  overallA: number;
  overallB: number;
  winner: 'a' | 'b' | null;
  winnerStrengths: string[];
}

export function ComparisonResultCard({ tickerA, tickerB, overallA, overallB, winner, winnerStrengths }: ComparisonResultCardProps) {
  const winnerTicker = winner === 'a' ? tickerA : winner === 'b' ? tickerB : null;
  const subtext = winnerTicker
    ? winnerStrengths.length > 0
      ? `Unggul pada ${joinList(winnerStrengths)}.`
      : 'Unggul tipis secara keseluruhan, tanpa kategori yang menonjol jauh.'
    : 'Skor kedua saham berimbang di seluruh kategori utama.';

  const sides = [
    { ticker: tickerA, score: overallA, isWinner: winner === 'a' },
    { ticker: tickerB, score: overallB, isWinner: winner === 'b' },
  ];

  return (
    <div className="neo-border neo-shadow bg-white dark:bg-zinc-900 overflow-hidden">
      <div className="px-5 py-4 border-b-[3px] border-(--neo-line)">
        <h2 className="font-bold uppercase tracking-wide text-zinc-800 dark:text-zinc-100">Comparison Result</h2>
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Skor keseluruhan berbobot dari 6 kategori penilaian</p>
      </div>

      <div className="grid grid-cols-2 divide-x-2 divide-(--neo-line)">
        {sides.map((side) => (
          <div key={side.ticker} className="px-4 py-5 text-center">
            <div className="flex items-center justify-center gap-1.5">
              <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{side.ticker}</span>
              {side.isWinner && <Trophy className="size-4 text-amber-500" strokeWidth={2.5} />}
            </div>
            <div className={cn(
              'mt-1 font-mono text-3xl font-bold tabular-nums',
              side.isWinner ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400 dark:text-zinc-500'
            )}>
              {side.score}<span className="text-sm font-semibold">/100</span>
            </div>
            <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              {winner == null ? 'Skor Seimbang' : side.isWinner ? 'Overall Winner' : 'Runner Up'}
            </div>
          </div>
        ))}
      </div>

      <div className={cn(
        'px-5 py-4 border-t-[3px] border-(--neo-line)',
        winnerTicker ? 'bg-emerald-50 dark:bg-emerald-400/10' : 'bg-zinc-50 dark:bg-zinc-800/60'
      )}>
        <p className={cn('text-sm font-bold', winnerTicker ? 'text-emerald-700 dark:text-emerald-300' : 'text-zinc-700 dark:text-zinc-200')}>
          {winnerTicker ? `🟢 ${winnerTicker} LEBIH UNGGUL` : 'SKOR SEIMBANG'}
        </p>
        <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">{subtext}</p>
      </div>
    </div>
  );
}
