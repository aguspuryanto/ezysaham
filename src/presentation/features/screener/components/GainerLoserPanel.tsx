import { ArrowDownRight, ArrowUpRight, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import { StockSummary } from '@/domain/models/Stock';
import { cn, formatPercent, formatRupiah } from '@/lib/format';

function MoverList({ title, href, rows, positive }: { title: string; href: string; rows: StockSummary[]; positive: boolean }) {
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="rounded-xl border border-(--sv-border) bg-(--sv-surface) shadow-(--sv-shadow)">
      <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-(--sv-text)">
          <span className={cn('flex size-6 items-center justify-center rounded-md', positive ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10' : 'bg-rose-50 text-rose-600 dark:bg-rose-400/10')}>
            <Icon className="size-4" strokeWidth={2.25} />
          </span>
          {title}
        </h3>
        <Link href={href} className="flex items-center text-xs font-medium text-(--sv-primary) hover:underline">
          Lihat semua <ChevronRight className="size-3.5" />
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 pb-4 text-sm text-(--sv-muted)">Data belum tersedia.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-(--sv-muted)">
              <th className="px-4 py-1.5 text-left font-medium">Kode</th>
              <th className="px-2 py-1.5 text-right font-medium">Harga</th>
              <th className="px-4 py-1.5 text-right font-medium">% Chg</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.ticker} className="border-t border-(--sv-border) hover:bg-(--sv-bg)">
                <td className="px-4 py-2">
                  <Link href={`/screener/${s.ticker}`} className="font-semibold text-(--sv-text) hover:text-(--sv-primary)">{s.ticker}</Link>
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-(--sv-text)">{formatRupiah(s.lastClose)}</td>
                <td className={cn('px-4 py-2 text-right font-semibold tabular-nums', positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
                  {formatPercent(s.percentChange1D)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function GainerLoserPanel({ summaries }: { summaries: StockSummary[] }) {
  const { gainers, losers } = useMemo(() => {
    const sorted = [...summaries].sort((a, b) => b.percentChange1D - a.percentChange1D);
    return {
      gainers: sorted.filter((s) => s.percentChange1D > 0).slice(0, 5),
      losers: sorted.filter((s) => s.percentChange1D < 0).reverse().slice(0, 5),
    };
  }, [summaries]);

  return (
    <>
      <MoverList title="Top 5 Gainer" href="/gainers" rows={gainers} positive />
      <MoverList title="Top 5 Loser" href="/losers" rows={losers} positive={false} />
    </>
  );
}
