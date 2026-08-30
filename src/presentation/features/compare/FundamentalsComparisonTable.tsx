import { ArrowDown, ArrowUp } from 'lucide-react';
import { StockSummary } from '@/domain/models/Stock';
import { FundamentalDetail } from '@/domain/models/Fundamentals';
import { cn, formatCompact } from '@/lib/format';

type Direction = 'higher-better' | 'lower-better';

interface CombinedData {
  summary: StockSummary;
  fundamentals: FundamentalDetail | null;
}

interface MetricRow {
  key: string;
  label: string;
  description: string;
  direction?: Direction;
  /** Value used only to decide which side "wins" (an unfavorable/missing value is normalized to Infinity so it never wins). */
  compareValue?: (d: CombinedData) => number;
  format?: (d: CombinedData) => string;
}

const METRICS: MetricRow[] = [
  {
    key: 'marketCap',
    label: 'Market Cap',
    description: 'Total nilai pasar perusahaan',
    direction: 'higher-better',
    compareValue: (d) => d.summary.capitalization,
    format: (d) => formatCompact(d.summary.capitalization),
  },
  {
    key: 'per',
    label: 'PER',
    description: 'Price to Earnings Ratio',
    direction: 'lower-better',
    compareValue: (d) => (d.summary.per > 0 ? d.summary.per : Infinity),
    format: (d) => (d.summary.per > 0 ? `${d.summary.per.toFixed(1)}×` : 'N/A'),
  },
  {
    key: 'pbv',
    label: 'PBV',
    description: 'Price to Book Value',
    direction: 'lower-better',
    compareValue: (d) => (d.summary.pbv > 0 ? d.summary.pbv : Infinity),
    format: (d) => (d.summary.pbv > 0 ? `${d.summary.pbv.toFixed(2)}×` : 'N/A'),
  },
  {
    key: 'roe',
    label: 'ROE',
    description: 'Return on Equity',
    direction: 'higher-better',
    compareValue: (d) => d.summary.roe,
    format: (d) => (d.summary.roe !== 0 ? `${d.summary.roe.toFixed(2)}%` : 'N/A'),
  },
  {
    key: 'netMargin',
    label: 'Net Margin',
    description: 'Profit margin',
    direction: 'higher-better',
    compareValue: (d) => d.fundamentals?.netMargin ?? Infinity,
    format: (d) => (d.fundamentals?.netMargin != null ? `${d.fundamentals.netMargin.toFixed(2)}%` : 'N/A'),
  },
  {
    key: 'dividendYield',
    label: 'Dividend Yield',
    description: 'Annual dividend yield',
    direction: 'higher-better',
    compareValue: (d) => d.fundamentals?.dividendYield ?? Infinity,
    format: (d) => (d.fundamentals?.dividendYield != null ? `${d.fundamentals.dividendYield.toFixed(2)}%` : 'N/A'),
  },
  {
    key: 'revenueGrowth',
    label: 'Revenue Growth (YoY)',
    description: 'Year-over-year revenue growth',
    direction: 'higher-better',
    compareValue: (d) => d.fundamentals?.revenueGrowth ?? Infinity,
    format: (d) => (d.fundamentals?.revenueGrowth != null ? `${d.fundamentals.revenueGrowth.toFixed(2)}%` : 'N/A'),
  },
  {
    key: 'currentRatio',
    label: 'Current Ratio',
    description: 'Liquidity ratio',
    direction: 'higher-better',
    compareValue: (d) => d.fundamentals?.currentRatio ?? Infinity,
    format: (d) => (d.fundamentals?.currentRatio != null ? `${d.fundamentals.currentRatio.toFixed(2)}×` : 'N/A'),
  },
  {
    key: 'der',
    label: 'Debt to Equity Ratio (DER)',
    description: 'Debt to equity ratio',
    direction: 'lower-better',
    // debtToEquity arrives from Yahoo already scaled as a percentage (18.1 == 0.181x)
    compareValue: (d) => (d.fundamentals?.debtToEquity != null ? d.fundamentals.debtToEquity / 100 : Infinity),
    format: (d) => (d.fundamentals?.debtToEquity != null ? `${(d.fundamentals.debtToEquity / 100).toFixed(2)}×` : 'N/A'),
  },
];

function winner(direction: Direction, valueA: number, valueB: number): 'a' | 'b' | null {
  if (!Number.isFinite(valueA) || !Number.isFinite(valueB) || valueA === valueB) return null;
  const aWins = direction === 'higher-better' ? valueA > valueB : valueA < valueB;
  return aWins ? 'a' : 'b';
}

function MetricValue({ text, trend }: { text: string; trend: 'up' | 'down' | null }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 font-mono text-sm font-bold tabular-nums',
      trend === 'up' ? 'text-emerald-600 dark:text-emerald-400' : trend === 'down' ? 'text-rose-600 dark:text-rose-400' : 'text-zinc-700 dark:text-zinc-200'
    )}>
      {trend === 'up' && <ArrowUp className="size-3.5" strokeWidth={3} />}
      {trend === 'down' && <ArrowDown className="size-3.5" strokeWidth={3} />}
      {text}
    </span>
  );
}

interface FundamentalsComparisonTableProps {
  summaryA: StockSummary;
  summaryB: StockSummary;
  fundamentalsA?: FundamentalDetail | null;
  fundamentalsB?: FundamentalDetail | null;
}

export function FundamentalsComparisonTable({
  summaryA,
  summaryB,
  fundamentalsA = null,
  fundamentalsB = null,
}: FundamentalsComparisonTableProps) {
  const dataA: CombinedData = { summary: summaryA, fundamentals: fundamentalsA };
  const dataB: CombinedData = { summary: summaryB, fundamentals: fundamentalsB };

  return (
    <div className="neo-border neo-shadow bg-white dark:bg-zinc-900 overflow-hidden">
      <div className="px-5 py-4 border-b-[3px] border-(--neo-line)">
        <h2 className="font-bold uppercase tracking-wide text-zinc-800 dark:text-zinc-100">Fundamentals Comparison</h2>
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Key financial metrics side by side</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b-2 border-(--neo-line) text-left text-[11px] font-bold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              <th className="px-5 py-2.5">Metric</th>
              <th className="px-3 py-2.5 text-right">{summaryA.ticker}</th>
              <th className="px-2 py-2.5 text-center">vs</th>
              <th className="px-3 py-2.5">{summaryB.ticker}</th>
              <th className="px-5 py-2.5">Description</th>
            </tr>
          </thead>
          <tbody>
            {METRICS.map((metric) => {
              const textA = metric.format ? metric.format(dataA) : 'N/A';
              const textB = metric.format ? metric.format(dataB) : 'N/A';
              let trendA: 'up' | 'down' | null = null;
              let trendB: 'up' | 'down' | null = null;

              if (metric.direction && metric.compareValue) {
                const w = winner(metric.direction, metric.compareValue(dataA), metric.compareValue(dataB));
                if (w === 'a') { trendA = 'up'; trendB = 'down'; }
                else if (w === 'b') { trendA = 'down'; trendB = 'up'; }
              }

              return (
                <tr key={metric.key} className="border-b border-zinc-100 dark:border-zinc-800 last:border-b-0">
                  <td className="px-5 py-3 font-semibold text-zinc-700 dark:text-zinc-300">{metric.label}</td>
                  <td className="px-3 py-3 text-right"><MetricValue text={textA} trend={trendA} /></td>
                  <td className="px-2 py-3 text-center text-xs font-semibold text-zinc-300 dark:text-zinc-600">vs</td>
                  <td className="px-3 py-3"><MetricValue text={textB} trend={trendB} /></td>
                  <td className="px-5 py-3 text-xs text-zinc-500 dark:text-zinc-400">{metric.description}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
