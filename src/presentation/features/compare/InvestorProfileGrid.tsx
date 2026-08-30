import { Trophy } from 'lucide-react';
import { InvestorProfileResult } from '@/domain/compare/decisionEngine';

interface InvestorProfileGridProps {
  tickerA: string;
  tickerB: string;
  profiles: InvestorProfileResult[];
}

export function InvestorProfileGrid({ tickerA, tickerB, profiles }: InvestorProfileGridProps) {
  return (
    <div className="neo-border neo-shadow bg-white dark:bg-zinc-900 overflow-hidden">
      <div className="px-5 py-4 border-b-[3px] border-(--neo-line)">
        <h2 className="font-bold uppercase tracking-wide text-zinc-800 dark:text-zinc-100">Best For</h2>
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">&ldquo;Winner&rdquo; tergantung profil dan prioritas investor</p>
      </div>

      <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">
        {profiles.map((p) => {
          const winnerTicker = p.winner === 'a' ? tickerA : p.winner === 'b' ? tickerB : null;
          return (
            <div key={p.key} className="neo-border px-4 py-3 bg-zinc-50 dark:bg-zinc-900/60">
              <div className="text-xs font-bold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">{p.label}</div>
              <div className="mt-1.5 flex items-center gap-1.5">
                {winnerTicker ? (
                  <>
                    <Trophy className="size-4 text-amber-500" strokeWidth={2.5} />
                    <span className="text-base font-bold text-emerald-700 dark:text-emerald-400">{winnerTicker}</span>
                  </>
                ) : (
                  <span className="text-sm font-semibold text-zinc-400 dark:text-zinc-500">Seri</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
