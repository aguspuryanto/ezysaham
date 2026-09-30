import { Scale, Trophy } from 'lucide-react';
import { Card, PanelTitle } from '@/presentation/features/screener/detail/components/ui';
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
  colorA: string;
  colorB: string;
}

export function ComparisonResultCard({ tickerA, tickerB, overallA, overallB, winner, winnerStrengths, colorA, colorB }: ComparisonResultCardProps) {
  const winnerTicker = winner === 'a' ? tickerA : winner === 'b' ? tickerB : null;
  const subtext = winnerTicker
    ? winnerStrengths.length > 0
      ? `Unggul pada ${joinList(winnerStrengths)}.`
      : 'Unggul tipis secara keseluruhan, tanpa kategori yang menonjol jauh.'
    : 'Skor kedua saham berimbang di seluruh kategori utama.';

  const sides = [
    { ticker: tickerA, score: overallA, isWinner: winner === 'a', color: colorA },
    { ticker: tickerB, score: overallB, isWinner: winner === 'b', color: colorB },
  ];

  return (
    <Card>
      <PanelTitle icon={Scale}>Hasil Perbandingan</PanelTitle>
      <p className="px-4 pt-3 text-xs text-(--sv-muted)">Skor keseluruhan berbobot dari 6 kategori penilaian.</p>

      <div className="flex flex-col gap-3 p-4">
        {sides.map((side) => (
          <div key={side.ticker} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="inline-flex items-center gap-1.5 font-semibold text-(--sv-text)">
                <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: side.color }} aria-hidden="true" />
                {side.ticker}
                {side.isWinner && <Trophy className="size-4 text-amber-500" strokeWidth={2} />}
              </span>
              <span className={cn('tabular-nums', side.isWinner ? 'text-lg font-bold text-(--sv-text)' : 'font-semibold text-(--sv-muted)')}>
                {side.score}<span className="text-xs font-medium text-(--sv-muted)">/100</span>
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, side.score))}%`, backgroundColor: side.color }} />
            </div>
            <span className="text-[11px] text-(--sv-muted)">{winner == null ? 'Skor seimbang' : side.isWinner ? 'Overall winner' : 'Runner up'}</span>
          </div>
        ))}
      </div>

      <div className={cn(
        'rounded-b-xl border-t px-4 py-3',
        winnerTicker ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-400/25 dark:bg-emerald-400/10' : 'border-(--sv-border) bg-(--sv-bg)',
      )}>
        <p className={cn('text-sm font-semibold', winnerTicker ? 'text-emerald-700 dark:text-emerald-300' : 'text-(--sv-text)')}>
          {winnerTicker ? `${winnerTicker} lebih unggul` : 'Skor seimbang'}
        </p>
        <p className="mt-0.5 text-sm text-(--sv-muted)">{subtext}</p>
      </div>
    </Card>
  );
}
