import { CategoryScores, CATEGORY_LABELS, CATEGORY_WEIGHTS } from '@/domain/compare/decisionEngine';
import { cn } from '@/lib/format';

const CATEGORY_ORDER: (keyof CategoryScores)[] = ['quality', 'value', 'growth', 'dividend', 'momentum', 'risk'];

function ScoreBar({ ticker, value, isWinner }: { ticker: string; value: number | null; isWinner: boolean }) {
  const width = value == null ? 0 : Math.max(2, Math.min(100, value));
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 truncate text-[10px] font-bold text-zinc-500 dark:text-zinc-400">{ticker}</span>
      <div className="h-2 flex-1 overflow-hidden border border-(--neo-line) bg-zinc-100 dark:bg-zinc-800">
        <div
          className={cn(
            'h-full transition-all',
            value == null ? 'bg-zinc-300 dark:bg-zinc-700' : isWinner ? 'bg-emerald-500' : 'bg-zinc-400 dark:bg-zinc-600'
          )}
          style={{ width: `${width}%` }}
        />
      </div>
      <span className="w-8 shrink-0 text-right font-mono text-xs font-bold tabular-nums text-zinc-700 dark:text-zinc-300">
        {value == null ? '–' : value}
      </span>
    </div>
  );
}

interface ScoreBreakdownProps {
  tickerA: string;
  tickerB: string;
  scoresA: CategoryScores;
  scoresB: CategoryScores;
  overallA: number;
  overallB: number;
}

export function ScoreBreakdown({ tickerA, tickerB, scoresA, scoresB, overallA, overallB }: ScoreBreakdownProps) {
  return (
    <div className="neo-border neo-shadow bg-white dark:bg-zinc-900 overflow-hidden">
      <div className="px-5 py-4 border-b-[3px] border-(--neo-line)">
        <h2 className="font-bold uppercase tracking-wide text-zinc-800 dark:text-zinc-100">Score Breakdown</h2>
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Bobot penilaian per kategori</p>
      </div>

      <div className="px-5 py-4 space-y-4">
        {CATEGORY_ORDER.map((key) => {
          const a = scoresA[key];
          const b = scoresB[key];
          const catWinner = a == null || b == null || a === b ? null : a > b ? 'a' : 'b';
          return (
            <div key={key} className="space-y-1">
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                <span>{CATEGORY_LABELS[key]}</span>
                <span>{CATEGORY_WEIGHTS[key]}%</span>
              </div>
              <ScoreBar ticker={tickerA} value={a} isWinner={catWinner === 'a'} />
              <ScoreBar ticker={tickerB} value={b} isWinner={catWinner === 'b'} />
            </div>
          );
        })}

        <div className="pt-3 border-t-2 border-(--neo-line) space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Overall</div>
          <ScoreBar ticker={tickerA} value={overallA} isWinner={overallA > overallB} />
          <ScoreBar ticker={tickerB} value={overallB} isWinner={overallB > overallA} />
        </div>
      </div>
    </div>
  );
}
