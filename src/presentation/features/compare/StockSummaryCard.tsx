import Link from 'next/link';
import { Loader2, TrendingDown, TrendingUp } from 'lucide-react';
import { StockSummary } from '@/domain/models/Stock';
import { AiStockAdvisor } from '@/domain/models/News';
import { StockAnalysisStatus } from '@/presentation/features/analysis/useStockAnalysis';
import { cn, formatPercent, formatRupiah } from '@/lib/format';

const VERDICT_BADGE_TONE: Record<AiStockAdvisor['verdictTone'], string> = {
  green: 'bg-emerald-600 text-white',
  amber: 'bg-amber-500 text-white',
  red: 'bg-rose-600 text-white',
  blue: 'bg-blue-600 text-white',
};

/** Short, mockup-style label derived from the full AI verdict (e.g. "SELL / AVOID", "HOLD"). */
function shortSignalLabel(advisor: AiStockAdvisor): string {
  switch (advisor.verdict) {
    case 'SANGAT_BELI': return 'STRONG BUY';
    case 'BELI': return 'BUY';
    case 'TAHAN': return 'HOLD';
    case 'HINDARI': return 'SELL / AVOID';
  }
}

interface StockSummaryCardProps {
  status: StockAnalysisStatus;
  summary: StockSummary | null;
  advisor: AiStockAdvisor | null;
}

export function StockSummaryCard({ status, summary, advisor }: StockSummaryCardProps) {
  if (status === 'loading' || !summary) {
    return (
      <div className="flex min-h-[168px] items-center justify-center gap-2 neo-border neo-shadow bg-white p-5 text-sm font-semibold text-zinc-400 dark:bg-zinc-900">
        <Loader2 className="size-4 animate-spin text-emerald-500" /> Memuat data saham…
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex min-h-[168px] items-center justify-center neo-border neo-shadow bg-white p-5 text-center text-sm font-semibold text-zinc-400 dark:bg-zinc-900">
        Data tidak tersedia.
      </div>
    );
  }

  const positive = summary.percentChange1D >= 0;

  return (
    <div className="neo-border neo-shadow bg-white p-5 space-y-3 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{summary.ticker}</h3>
          <p className="truncate text-xs font-medium text-zinc-500 dark:text-zinc-400">{summary.name}</p>
        </div>
        {advisor && (
          <span className={cn('shrink-0 neo-border px-2.5 py-1 text-[11px] font-bold tracking-wide', VERDICT_BADGE_TONE[advisor.verdictTone])}>
            {shortSignalLabel(advisor)}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Harga</p>
          <p className="font-mono text-base font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
            {formatRupiah(summary.lastClose)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Perubahan</p>
          <p className={cn(
            'flex items-center gap-1 font-mono text-base font-bold tabular-nums',
            positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
          )}>
            {positive ? <TrendingUp className="size-3.5" strokeWidth={2.5} /> : <TrendingDown className="size-3.5" strokeWidth={2.5} />}
            {formatPercent(summary.percentChange1D)}
          </p>
        </div>
      </div>

      <Link
        href={`/screener/${summary.ticker}`}
        className="inline-flex items-center gap-1 text-sm font-bold text-emerald-700 hover:underline dark:text-emerald-400"
      >
        Lihat Analisis →
      </Link>
    </div>
  );
}
