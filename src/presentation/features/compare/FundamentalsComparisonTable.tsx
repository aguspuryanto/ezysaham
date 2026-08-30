import { Trophy } from 'lucide-react';
import { StockSummary } from '@/domain/models/Stock';
import { FundamentalDetail } from '@/domain/models/Fundamentals';
import {
  CombinedStockData,
  MetricConfig,
  getSectorCategory,
  resolveComparisonMetrics,
  winner,
} from '@/domain/compare/metricConfig';
import { cn } from '@/lib/format';

// ─── Metric explanations ───────────────────────────────────────────────────
// Qualitative read of each raw value, independent of who "wins" the row —
// two undervalued stocks can both be 'good' even though one edges out the other.
type Tone = 'green' | 'amber' | 'red';
type Bucket = 'good' | 'fair' | 'poor' | 'na';
interface Profile { bucket: Bucket; phrase: string; }

const PROFILES: Record<string, (value: number | null) => Profile> = {
  marketCap: (v) => {
    if (v == null) return { bucket: 'na', phrase: 'data tidak tersedia' };
    if (v >= 50_000_000_000_000) return { bucket: 'good', phrase: 'likuiditas sangat solid (big cap)' };
    if (v >= 5_000_000_000_000) return { bucket: 'good', phrase: 'likuiditas cukup baik (mid cap)' };
    if (v >= 500_000_000_000) return { bucket: 'fair', phrase: 'small cap dengan transaksi mencukupi' };
    return { bucket: 'poor', phrase: 'likuiditas rendah, rawan volatilitas tinggi' };
  },
  per: (v) => {
    if (v == null) return { bucket: 'poor', phrase: 'mencatat kerugian (PER negatif)' };
    if (v <= 12) return { bucket: 'good', phrase: 'sangat murah (undervalued)' };
    if (v <= 20) return { bucket: 'good', phrase: 'wajar (fair value)' };
    if (v <= 35) return { bucket: 'fair', phrase: 'cukup premium' };
    return { bucket: 'poor', phrase: 'sangat mahal' };
  },
  pbv: (v) => {
    if (v == null) return { bucket: 'na', phrase: 'data tidak tersedia' };
    if (v < 1) return { bucket: 'good', phrase: 'di bawah nilai buku (diskon aset)' };
    if (v <= 2.5) return { bucket: 'good', phrase: 'sehat terhadap aset bersih' };
    if (v <= 5) return { bucket: 'fair', phrase: 'premium aset cukup tinggi' };
    return { bucket: 'poor', phrase: 'sangat mahal terhadap aset' };
  },
  roe: (v) => {
    if (v == null) return { bucket: 'poor', phrase: 'profitabilitas lemah / ekuitas tergerus rugi' };
    if (v >= 15) return { bucket: 'good', phrase: 'sangat efisien mencetak laba dari ekuitas' };
    if (v >= 10) return { bucket: 'good', phrase: 'profitabilitas di atas rata-rata' };
    if (v > 0) return { bucket: 'fair', phrase: 'profitabilitas moderat' };
    return { bucket: 'poor', phrase: 'profitabilitas lemah / ekuitas tergerus rugi' };
  },
  netMargin: (v) => {
    if (v == null) return { bucket: 'na', phrase: 'data tidak tersedia' };
    if (v >= 20) return { bucket: 'good', phrase: 'margin laba sangat tebal' };
    if (v >= 10) return { bucket: 'good', phrase: 'margin laba sehat' };
    if (v > 0) return { bucket: 'fair', phrase: 'margin laba tipis' };
    return { bucket: 'poor', phrase: 'merugi di level laba bersih' };
  },
  dividendYield: (v) => {
    if (v == null) return { bucket: 'na', phrase: 'data tidak tersedia' };
    if (v >= 5) return { bucket: 'good', phrase: 'imbal hasil dividen tinggi' };
    if (v >= 2) return { bucket: 'good', phrase: 'imbal hasil dividen menarik' };
    if (v > 0) return { bucket: 'fair', phrase: 'imbal hasil dividen kecil' };
    return { bucket: 'fair', phrase: 'tidak/jarang membagikan dividen' };
  },
  revenueGrowth: (v) => {
    if (v == null) return { bucket: 'na', phrase: 'data tidak tersedia' };
    if (v >= 15) return { bucket: 'good', phrase: 'pertumbuhan pendapatan tinggi' };
    if (v >= 5) return { bucket: 'good', phrase: 'pertumbuhan pendapatan solid' };
    if (v >= 0) return { bucket: 'fair', phrase: 'pendapatan cenderung stagnan' };
    return { bucket: 'poor', phrase: 'pendapatan menyusut (YoY negatif)' };
  },
  currentRatio: (v) => {
    if (v == null) return { bucket: 'na', phrase: 'data tidak tersedia' };
    if (v >= 2) return { bucket: 'good', phrase: 'sangat likuid untuk kewajiban jangka pendek' };
    if (v >= 1.5) return { bucket: 'good', phrase: 'likuiditas jangka pendek sehat' };
    if (v >= 1) return { bucket: 'fair', phrase: 'likuiditas jangka pendek cukup' };
    return { bucket: 'poor', phrase: 'rawan kesulitan bayar kewajiban jangka pendek' };
  },
  der: (v) => {
    if (v == null) return { bucket: 'na', phrase: 'data tidak tersedia' };
    if (v <= 0.3) return { bucket: 'good', phrase: 'struktur modal sangat konservatif' };
    if (v <= 0.6) return { bucket: 'good', phrase: 'struktur modal sehat' };
    if (v <= 1.0) return { bucket: 'fair', phrase: 'beban utang moderat' };
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
  metric: MetricConfig,
  tickerA: string,
  tickerB: string,
  valueA: number | null,
  valueB: number | null
): MetricExplanation | null {
  const profileFn = PROFILES[metric.key];
  if (!profileFn) return null;

  const pa = profileFn(valueA);
  const pb = profileFn(valueB);
  const textA = valueA != null ? metric.format(valueA) : 'N/A';
  const textB = valueB != null ? metric.format(valueB) : 'N/A';

  if (pa.bucket === 'na' && pb.bucket === 'na') {
    return { key: metric.key, label: metric.label, tone: 'amber', detail: `Data tidak tersedia untuk ${tickerA} maupun ${tickerB}.` };
  }
  if (pa.bucket === 'na') {
    return { key: metric.key, label: metric.label, tone: 'amber', detail: `${tickerB} ${textB} — ${pb.phrase}. Data ${tickerA} tidak tersedia untuk metrik ini.` };
  }
  if (pb.bucket === 'na') {
    return { key: metric.key, label: metric.label, tone: 'amber', detail: `${tickerA} ${textA} — ${pa.phrase}. Data ${tickerB} tidak tersedia untuk metrik ini.` };
  }

  const w = winner(metric.direction, valueA, valueB);

  let tone: Tone;
  let verdict: string;
  if (w === 'a') {
    tone = bucketTone(pa.bucket);
    verdict = `Why ${tickerA} wins: ${pa.phrase}, sementara ${tickerB} ${pb.phrase}.`;
  } else if (w === 'b') {
    tone = bucketTone(pb.bucket);
    verdict = `Why ${tickerB} wins: ${pb.phrase}, sementara ${tickerA} ${pa.phrase}.`;
  } else {
    tone = pa.bucket === 'good' && pb.bucket === 'good' ? 'green' : pa.bucket === 'poor' && pb.bucket === 'poor' ? 'red' : 'amber';
    verdict = 'Keduanya berada di level yang setara — bukan faktor pembeda.';
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

function WinnerBadge({ ticker }: { ticker: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400">
      <Trophy className="size-3.5" strokeWidth={2.5} />
      {ticker}
    </span>
  );
}

function MetricCell({ text, isWinner }: { text: string; isWinner: boolean }) {
  return (
    <span className={cn(
      'font-mono text-sm tabular-nums',
      isWinner ? 'font-bold text-zinc-900 dark:text-zinc-50' : 'text-zinc-500 dark:text-zinc-400'
    )}>
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
  const dataA: CombinedStockData = { summary: summaryA, fundamentals: fundamentalsA };
  const dataB: CombinedStockData = { summary: summaryB, fundamentals: fundamentalsB };

  const sectorA = getSectorCategory(summaryA.sector, summaryA.subSector);
  const sectorB = getSectorCategory(summaryB.sector, summaryB.subSector);
  const metrics = resolveComparisonMetrics(sectorA, sectorB);

  const rows = metrics.map((metric) => {
    const valueA = metric.getValue(dataA);
    const valueB = metric.getValue(dataB);
    const textA = valueA != null ? metric.format(valueA) : 'N/A';
    const textB = valueB != null ? metric.format(valueB) : 'N/A';
    const w = winner(metric.direction, valueA, valueB);
    return { metric, valueA, valueB, textA, textB, w };
  });

  const explanations = rows
    .map((r) => explainMetric(r.metric, summaryA.ticker, summaryB.ticker, r.valueA, r.valueB))
    .filter((e): e is MetricExplanation => e !== null);

  return (
    <div className="neo-border neo-shadow bg-white dark:bg-zinc-900 overflow-hidden">
      <div className="px-5 py-4 border-b-[3px] border-(--neo-line)">
        <h2 className="font-bold uppercase tracking-wide text-zinc-800 dark:text-zinc-100">Fundamentals Comparison</h2>
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Key financial metrics side by side</p>
      </div>

      {/* Desktop / tablet: full table with a dedicated Winner column */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b-2 border-(--neo-line) text-left text-[11px] font-bold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              <th className="px-5 py-2.5">Metric</th>
              <th className="px-3 py-2.5 text-right">{summaryA.ticker}</th>
              <th className="px-2 py-2.5 text-center">vs</th>
              <th className="px-3 py-2.5">{summaryB.ticker}</th>
              <th className="px-3 py-2.5">Winner</th>
              <th className="px-5 py-2.5">Description</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ metric, textA, textB, w }) => (
              <tr key={metric.key} className="border-b border-zinc-100 dark:border-zinc-800 last:border-b-0">
                <td className="px-5 py-3 font-semibold text-zinc-700 dark:text-zinc-300">{metric.label}</td>
                <td className="px-3 py-3 text-right"><MetricCell text={textA} isWinner={w === 'a'} /></td>
                <td className="px-2 py-3 text-center text-xs font-semibold text-zinc-300 dark:text-zinc-600">vs</td>
                <td className="px-3 py-3"><MetricCell text={textB} isWinner={w === 'b'} /></td>
                <td className="px-3 py-3">
                  {w === 'a' ? <WinnerBadge ticker={summaryA.ticker} /> : w === 'b' ? <WinnerBadge ticker={summaryB.ticker} /> : <span className="text-xs text-zinc-300 dark:text-zinc-600">—</span>}
                </td>
                <td className="px-5 py-3 text-xs text-zinc-500 dark:text-zinc-400">{metric.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: stacked cards — a wide 5-column table doesn't fit 320-430px screens */}
      <div className="sm:hidden divide-y divide-zinc-100 dark:divide-zinc-800">
        {rows.map(({ metric, textA, textB, w }) => (
          <div key={metric.key} className="px-4 py-3">
            <div className="text-xs font-bold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">{metric.label}</div>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              <div>
                <div className="text-[10px] font-bold text-zinc-400">{summaryA.ticker}</div>
                <MetricCell text={textA} isWinner={w === 'a'} />
                {w === 'a' && <div className="mt-0.5"><WinnerBadge ticker={summaryA.ticker} /></div>}
              </div>
              <div>
                <div className="text-[10px] font-bold text-zinc-400">{summaryB.ticker}</div>
                <MetricCell text={textB} isWinner={w === 'b'} />
                {w === 'b' && <div className="mt-0.5"><WinnerBadge ticker={summaryB.ticker} /></div>}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t-[3px] border-(--neo-line) px-5 py-4 space-y-2.5">
        <h3 className="text-xs font-bold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Penjelasan Metrik — Why Win?</h3>
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
