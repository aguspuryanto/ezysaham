import { AlertTriangle, CheckCircle2, Trophy } from 'lucide-react';
import { AiVerdict } from '@/domain/compare/decisionEngine';

interface AiVerdictCardProps {
  tickerA: string;
  tickerB: string;
  verdict: AiVerdict;
}

export function AiVerdictCard({ tickerA, tickerB, verdict }: AiVerdictCardProps) {
  const winnerTicker = verdict.winner === 'a' ? tickerA : verdict.winner === 'b' ? tickerB : null;
  const loserTicker = verdict.winner === 'a' ? tickerB : verdict.winner === 'b' ? tickerA : null;

  return (
    <div className="neo-border neo-shadow bg-white dark:bg-zinc-900 overflow-hidden">
      <div className="px-5 py-4 border-b-[3px] border-(--neo-line)">
        <h2 className="font-bold uppercase tracking-wide text-zinc-800 dark:text-zinc-100">EzySaham AI Verdict</h2>
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Mana yang lebih menarik dan kenapa</p>
      </div>

      <div className="p-5 space-y-4">
        {winnerTicker ? (
          <div>
            <div className="flex items-center gap-2">
              <Trophy className="size-5 text-amber-500" strokeWidth={2.5} />
              <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                {winnerTicker} — {verdict.winnerOverall}/100
              </span>
            </div>
            <p className="mt-1 text-sm italic text-zinc-600 dark:text-zinc-400">
              &ldquo;{winnerTicker} lebih unggul secara keseluruhan.&rdquo;
            </p>
          </div>
        ) : (
          <p className="text-sm font-bold text-zinc-700 dark:text-zinc-200">
            Skor kedua saham seimbang — pilihan terbaik bergantung pada profil investor Anda.
          </p>
        )}

        {winnerTicker && verdict.winnerStrengths.length > 0 && (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Alasan</h3>
            <ul className="mt-1.5 space-y-1.5">
              {verdict.winnerStrengths.map((s) => (
                <li key={s} className="flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="size-4 shrink-0" strokeWidth={2.5} />
                  {s} lebih kuat
                </li>
              ))}
            </ul>
          </div>
        )}

        {loserTicker && verdict.loserStrengths.length > 0 && (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">{loserTicker} unggul pada</h3>
            <ul className="mt-1.5 space-y-1.5">
              {verdict.loserStrengths.map((s) => (
                <li key={s} className="flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="size-4 shrink-0" strokeWidth={2.5} />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {verdict.risks.length > 0 && (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Risk</h3>
            <ul className="mt-1.5 space-y-1.5">
              {verdict.risks.map((r) => (
                <li key={r} className="flex items-start gap-1.5 text-sm text-rose-700 dark:text-rose-400">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" strokeWidth={2.5} />
                  {r}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
