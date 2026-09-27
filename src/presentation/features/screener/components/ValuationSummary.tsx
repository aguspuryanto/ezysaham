import { Scale } from 'lucide-react';
import { useMemo } from 'react';
import { ScreenerVerdict } from '@/domain/analysis/screenerVerdict';

/** Counts only rows whose verdict has been computed — says so instead of extrapolating. */
export function ValuationSummary({ tickers, verdictByTicker }: { tickers: string[]; verdictByTicker: Record<string, ScreenerVerdict> }) {
  const stats = useMemo(() => {
    let analyzed = 0, under = 0, fair = 0, over = 0, na = 0;
    for (const t of tickers) {
      const v = verdictByTicker[t];
      if (!v) continue;
      analyzed++;
      const verdict = v.valuation.verdict;
      if (verdict === 'UNDERVALUED') under++;
      else if (verdict === 'WAJAR') fair++;
      else if (verdict === 'PREMIUM' || verdict === 'OVERVALUED') over++;
      else na++;
    }
    return { analyzed, under, fair, over, na };
  }, [tickers, verdictByTicker]);

  const pct = (n: number) => (stats.analyzed ? ` (${((n / stats.analyzed) * 100).toFixed(1).replace('.', ',')}%)` : '');
  const rows = [
    { label: 'Undervalued', value: stats.under, cls: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Fair Value', value: stats.fair, cls: 'text-(--sv-primary)' },
    { label: 'Premium / Overvalued', value: stats.over, cls: 'text-rose-600 dark:text-rose-400' },
    { label: 'Tidak dapat dinilai', value: stats.na, cls: 'text-(--sv-muted)' },
  ];

  return (
    <div className="rounded-xl border border-(--sv-border) bg-(--sv-surface) p-4 shadow-(--sv-shadow)">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-(--sv-text)">
        <Scale className="size-4 text-(--sv-primary)" strokeWidth={2} />
        Ringkasan Valuasi
      </h3>
      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex justify-between border-b border-(--sv-border) pb-2">
          <dt className="text-(--sv-muted)">Jumlah emiten</dt>
          <dd className="font-semibold tabular-nums text-(--sv-text)">{tickers.length}</dd>
        </div>
        {rows.map((r) => (
          <div key={r.label} className="flex justify-between">
            <dt className={r.cls}>{r.label}</dt>
            <dd className="font-semibold tabular-nums text-(--sv-text)">{stats.analyzed ? `${r.value}${pct(r.value)}` : '--'}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-[11px] leading-snug text-(--sv-muted)">
        Dari {stats.analyzed} emiten yang sudah dianalisis. Buka halaman berikutnya atau pakai filter Valuation untuk menganalisis lebih banyak.
      </p>
    </div>
  );
}
