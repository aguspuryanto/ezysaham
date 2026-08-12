import { PatternSetupResult } from '@/domain/models/TechnicalHistory';
import { cn } from '@/lib/format';

function fmtSigned(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

function SetupCard({ setup }: { setup: PatternSetupResult }) {
  return (
    <div className="neo-border neo-shadow bg-white dark:bg-zinc-900 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b-[3px] border-(--neo-line)">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-800 dark:text-zinc-100">{setup.label}</h3>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{setup.description}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {setup.matchesToday && (
            <span className="neo-border bg-emerald-400 px-2.5 py-1 text-xs font-bold text-black">Match hari ini ✅</span>
          )}
          <span className="font-mono text-sm font-bold text-zinc-700 dark:text-zinc-200">{setup.occurrences}× kejadian</span>
        </div>
      </div>

      {setup.occurrences === 0 ? (
        <p className="px-4 py-4 text-sm font-semibold text-zinc-400">Belum ditemukan kejadian serupa pada data historis yang tersedia.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-(--neo-line) text-left text-xs font-bold uppercase text-zinc-400 dark:text-zinc-500">
                <th className="px-4 py-2 font-bold">Horizon</th>
                <th className="px-4 py-2 font-bold text-right">Win Rate</th>
                <th className="px-4 py-2 font-bold text-right">Avg Return</th>
                <th className="px-4 py-2 font-bold text-right">Max Gain</th>
                <th className="px-4 py-2 font-bold text-right">Max Drawdown</th>
              </tr>
            </thead>
            <tbody>
              {setup.horizons.map((h) => (
                <tr key={h.label} className="border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                  <td className="px-4 py-2 font-bold text-zinc-700 dark:text-zinc-200">{h.label}</td>
                  <td className={cn('px-4 py-2 text-right font-mono font-bold', h.winRate >= 60 ? 'text-emerald-600 dark:text-emerald-400' : h.winRate >= 45 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400')}>
                    {h.winRate}%
                  </td>
                  <td className={cn('px-4 py-2 text-right font-mono font-bold', h.avgReturn >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
                    {fmtSigned(h.avgReturn)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-zinc-600 dark:text-zinc-300">{fmtSigned(h.maxGain)}</td>
                  <td className="px-4 py-2 text-right font-mono text-zinc-600 dark:text-zinc-300">{fmtSigned(h.maxDrawdown)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {setup.lowSample && setup.occurrences > 0 && (
        <p className="px-4 py-2.5 text-xs font-medium text-amber-600 dark:text-amber-400 border-t-2 border-(--neo-line) bg-amber-50 dark:bg-amber-500/10">
          ⚠️ Sampel kecil ({setup.occurrences} kejadian) — interpretasikan dengan hati-hati.
        </p>
      )}
    </div>
  );
}

export function HistoricalPatternPanel({ setups }: { setups: PatternSetupResult[] }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
        Setiap setup di bawah dipindai pada seluruh data historis yang tersedia. Angka win rate & rata-rata return
        dihitung dari kejadian serupa di masa lalu — bukan prediksi harga masa depan.
      </p>
      {setups.map((setup) => (
        <SetupCard key={setup.key} setup={setup} />
      ))}
    </div>
  );
}
