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

// ─── Metric explanations ───────────────────────────────────────────────────
// Qualitative read of each raw value, independent of who "wins" the row —
// two undervalued stocks can both be 'good' even though one edges out the other.
type Tone = 'green' | 'amber' | 'red';
type Bucket = 'good' | 'fair' | 'poor' | 'na';
interface Profile { bucket: Bucket; phrase: string; }

const PROFILES: Record<string, (d: CombinedData) => Profile> = {
  marketCap: (d) => {
    const { capitalization, value } = d.summary;
    if (capitalization >= 50_000_000_000_000 || value >= 20_000_000_000)
      return { bucket: 'good', phrase: 'likuiditas sangat solid (big cap)' };
    if (capitalization >= 5_000_000_000_000 || value >= 3_000_000_000)
      return { bucket: 'good', phrase: 'likuiditas cukup baik (mid cap)' };
    if (value >= 1_000_000_000) return { bucket: 'fair', phrase: 'small cap dengan transaksi mencukupi' };
    return { bucket: 'poor', phrase: 'likuiditas rendah, rawan volatilitas tinggi' };
  },
  per: (d) => {
    const per = d.summary.per;
    if (per <= 0) return { bucket: 'poor', phrase: 'mencatat kerugian (PER negatif)' };
    if (per <= 12) return { bucket: 'good', phrase: 'sangat murah (undervalued)' };
    if (per <= 20) return { bucket: 'good', phrase: 'wajar (fair value)' };
    if (per <= 35) return { bucket: 'fair', phrase: 'cukup premium' };
    return { bucket: 'poor', phrase: 'sangat mahal' };
  },
  pbv: (d) => {
    const pbv = d.summary.pbv;
    if (pbv <= 0) return { bucket: 'na', phrase: 'data tidak tersedia' };
    if (pbv < 1) return { bucket: 'good', phrase: 'di bawah nilai buku (diskon aset)' };
    if (pbv <= 2.5) return { bucket: 'good', phrase: 'sehat terhadap aset bersih' };
    if (pbv <= 5) return { bucket: 'fair', phrase: 'premium aset cukup tinggi' };
    return { bucket: 'poor', phrase: 'sangat mahal terhadap aset' };
  },
  roe: (d) => {
    const roe = d.summary.roe;
    if (roe >= 15) return { bucket: 'good', phrase: 'sangat efisien mencetak laba dari ekuitas' };
    if (roe >= 10) return { bucket: 'good', phrase: 'profitabilitas di atas rata-rata' };
    if (roe > 0) return { bucket: 'fair', phrase: 'profitabilitas moderat' };
    return { bucket: 'poor', phrase: 'profitabilitas lemah / ekuitas tergerus rugi' };
  },
  netMargin: (d) => {
    const nm = d.fundamentals?.netMargin;
    if (nm == null) return { bucket: 'na', phrase: 'data tidak tersedia' };
    if (nm >= 20) return { bucket: 'good', phrase: 'margin laba sangat tebal' };
    if (nm >= 10) return { bucket: 'good', phrase: 'margin laba sehat' };
    if (nm > 0) return { bucket: 'fair', phrase: 'margin laba tipis' };
    return { bucket: 'poor', phrase: 'merugi di level laba bersih' };
  },
  dividendYield: (d) => {
    const dy = d.fundamentals?.dividendYield;
    if (dy == null) return { bucket: 'na', phrase: 'data tidak tersedia' };
    if (dy >= 5) return { bucket: 'good', phrase: 'imbal hasil dividen tinggi' };
    if (dy >= 2) return { bucket: 'good', phrase: 'imbal hasil dividen menarik' };
    if (dy > 0) return { bucket: 'fair', phrase: 'imbal hasil dividen kecil' };
    return { bucket: 'fair', phrase: 'tidak/jarang membagikan dividen' };
  },
  revenueGrowth: (d) => {
    const rg = d.fundamentals?.revenueGrowth;
    if (rg == null) return { bucket: 'na', phrase: 'data tidak tersedia' };
    if (rg >= 15) return { bucket: 'good', phrase: 'pertumbuhan pendapatan tinggi' };
    if (rg >= 5) return { bucket: 'good', phrase: 'pertumbuhan pendapatan solid' };
    if (rg >= 0) return { bucket: 'fair', phrase: 'pendapatan cenderung stagnan' };
    return { bucket: 'poor', phrase: 'pendapatan menyusut (YoY negatif)' };
  },
  currentRatio: (d) => {
    const cr = d.fundamentals?.currentRatio;
    if (cr == null) return { bucket: 'na', phrase: 'data tidak tersedia' };
    if (cr >= 2) return { bucket: 'good', phrase: 'sangat likuid untuk kewajiban jangka pendek' };
    if (cr >= 1.5) return { bucket: 'good', phrase: 'likuiditas jangka pendek sehat' };
    if (cr >= 1) return { bucket: 'fair', phrase: 'likuiditas jangka pendek cukup' };
    return { bucket: 'poor', phrase: 'rawan kesulitan bayar kewajiban jangka pendek' };
  },
  der: (d) => {
    const der = d.fundamentals?.debtToEquity != null ? d.fundamentals.debtToEquity / 100 : null;
    if (der == null) return { bucket: 'na', phrase: 'data tidak tersedia' };
    if (der <= 0.3) return { bucket: 'good', phrase: 'struktur modal sangat konservatif' };
    if (der <= 0.6) return { bucket: 'good', phrase: 'struktur modal sehat' };
    if (der <= 1.0) return { bucket: 'fair', phrase: 'beban utang moderat' };
    return { bucket: 'poor', phrase: 'beban utang tinggi, risiko keuangan meningkat' };
  },
};

interface MetricExplanation {
  key: string;
  label: string;
  tone: Tone;
  detail: string;
}

function bucketTone(bucket: Bucket): Tone {
  return bucket === 'good' ? 'green' : bucket === 'poor' ? 'red' : 'amber';
}

function explainMetric(
  metric: MetricRow,
  tickerA: string,
  tickerB: string,
  dataA: CombinedData,
  dataB: CombinedData
): MetricExplanation | null {
  const profileFn = PROFILES[metric.key];
  if (!profileFn || !metric.format) return null;

  const pa = profileFn(dataA);
  const pb = profileFn(dataB);
  const textA = metric.format(dataA);
  const textB = metric.format(dataB);

  if (pa.bucket === 'na' && pb.bucket === 'na') {
    return { key: metric.key, label: metric.label, tone: 'amber', detail: `Data tidak tersedia untuk ${tickerA} maupun ${tickerB}.` };
  }
  if (pa.bucket === 'na') {
    return { key: metric.key, label: metric.label, tone: 'amber', detail: `${tickerB} ${textB} — ${pb.phrase}. Data ${tickerA} tidak tersedia untuk metrik ini.` };
  }
  if (pb.bucket === 'na') {
    return { key: metric.key, label: metric.label, tone: 'amber', detail: `${tickerA} ${textA} — ${pa.phrase}. Data ${tickerB} tidak tersedia untuk metrik ini.` };
  }

  const w = metric.direction && metric.compareValue ? winner(metric.direction, metric.compareValue(dataA), metric.compareValue(dataB)) : null;

  let tone: Tone;
  let verdict: string;
  if (w === 'a') {
    tone = bucketTone(pa.bucket);
    verdict = `${tickerA} lebih unggul pada metrik ini.`;
  } else if (w === 'b') {
    tone = bucketTone(pb.bucket);
    verdict = `${tickerB} lebih unggul pada metrik ini.`;
  } else {
    tone = pa.bucket === 'good' && pb.bucket === 'good' ? 'green' : pa.bucket === 'poor' && pb.bucket === 'poor' ? 'red' : 'amber';
    verdict = 'Keduanya berada di level yang setara.';
  }

  return {
    key: metric.key,
    label: metric.label,
    tone,
    detail: `${tickerA} ${textA} — ${pa.phrase}. ${tickerB} ${textB} — ${pb.phrase}. ${verdict}`,
  };
}

const EXPLANATION_TONE_BG: Record<Tone, string> = {
  green: 'bg-emerald-50 dark:bg-emerald-400/10',
  amber: 'bg-amber-50 dark:bg-amber-400/10',
  red: 'bg-rose-50 dark:bg-rose-400/10',
};
const EXPLANATION_TONE_TEXT: Record<Tone, string> = {
  green: 'text-emerald-700 dark:text-emerald-300',
  amber: 'text-amber-700 dark:text-amber-300',
  red: 'text-rose-700 dark:text-rose-300',
};

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

  const explanations = METRICS
    .map((metric) => explainMetric(metric, summaryA.ticker, summaryB.ticker, dataA, dataB))
    .filter((e): e is MetricExplanation => e !== null);

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

      <div className="border-t-[3px] border-(--neo-line) px-5 py-4 space-y-2.5">
        <h3 className="text-xs font-bold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Penjelasan Metrik</h3>
        {explanations.map((e) => (
          <div key={e.key} className={cn('neo-border px-4 py-3', EXPLANATION_TONE_BG[e.tone])}>
            <span className={cn('text-sm font-bold', EXPLANATION_TONE_TEXT[e.tone])}>{e.label}</span>
            <p className="text-sm mt-1 text-zinc-600 dark:text-zinc-400 leading-relaxed">{e.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
