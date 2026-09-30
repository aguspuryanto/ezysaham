import Link from 'next/link';
import { AlertCircle, ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import { StockSummary } from '@/domain/models/Stock';
import { AiStockAdvisor } from '@/domain/models/News';
import { StockAnalysisStatus } from '@/presentation/features/analysis/useStockAnalysis';
import { Badge, Card, Skeleton } from '@/presentation/features/screener/detail/components/ui';
import { Tone } from '@/presentation/features/screener/detail/format';
import { cn, formatCompact, formatPercent, formatRupiah } from '@/lib/format';

const VERDICT_TONE: Record<AiStockAdvisor['verdictTone'], Tone> = {
  green: 'positive',
  amber: 'warning',
  red: 'negative',
  blue: 'info',
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
  /** Series colour of this side in the price chart. */
  color: string;
}

export function StockSummaryCard({ status, summary, advisor, color }: StockSummaryCardProps) {
  if (status === 'error') {
    return (
      <Card className="flex min-h-44 flex-col items-center justify-center gap-2 p-5 text-center">
        <AlertCircle className="size-6 text-rose-500" />
        <p className="text-sm text-(--sv-muted)">Data saham tidak tersedia.</p>
      </Card>
    );
  }

  if (status === 'loading' || !summary) {
    return (
      <Card className="flex min-h-44 flex-col gap-4 p-5">
        <div className="flex items-center gap-3">
          <Skeleton className="size-12 rounded-lg" />
          <div className="flex-1 space-y-1.5"><Skeleton className="h-5 w-1/3" /><Skeleton className="h-3.5 w-2/3" /></div>
        </div>
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-4 w-1/3" />
      </Card>
    );
  }

  const change = summary.percentChange1D;
  const up = change >= 0;
  const ChangeIcon = up ? ArrowUpRight : ArrowDownRight;

  return (
    <Card className="relative flex min-h-44 flex-col gap-4 overflow-hidden p-5">
      <span className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: color }} aria-hidden="true" />
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-(--sv-primary) text-base font-bold text-(--sv-primary-fg)">
            {summary.ticker.slice(0, 2)}
          </span>
          <div className="min-w-0">
            <h3 className="text-xl font-bold text-(--sv-text)">{summary.ticker}</h3>
            <p className="truncate text-sm text-(--sv-muted)">{summary.name}</p>
          </div>
        </div>
        {advisor && <Badge tone={VERDICT_TONE[advisor.verdictTone]} className="shrink-0">{shortSignalLabel(advisor)}</Badge>}
      </div>

      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-2xl font-bold tabular-nums text-(--sv-text)">{formatRupiah(summary.lastClose)}</span>
        <span className={cn('inline-flex items-center gap-0.5 text-sm font-semibold tabular-nums', up ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
          <ChangeIcon className="size-4" strokeWidth={2.25} />
          {formatPercent(change)}
        </span>
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-(--sv-border) pt-3 text-xs text-(--sv-muted)">
        <span>{summary.sector || 'Sektor BEI'} · Cap <b className="font-semibold text-(--sv-text)">{formatCompact(summary.capitalization)}</b></span>
        <Link href={`/screener/${summary.ticker}`} className="inline-flex items-center gap-1 text-sm font-medium text-(--sv-primary) hover:underline">
          Lihat analisis <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </Card>
  );
}
