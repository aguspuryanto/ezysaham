import { Lightbulb, Table2, Trophy } from 'lucide-react';
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
import { Card, PanelTitle } from '@/presentation/features/screener/detail/components/ui';

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
  green: 'border-emerald-200 bg-emerald-50 dark:border-emerald-400/25 dark:bg-emerald-400/10',
  amber: 'border-amber-200 bg-amber-50 dark:border-amber-400/25 dark:bg-amber-400/10',
  red: 'border-rose-200 bg-rose-50 dark:border-rose-400/25 dark:bg-rose-400/10',
};
const EXPLANATION_TONE_TEXT: Record<Tone, string> = {
  green: 'text-emerald-700 dark:text-emerald-300',
  amber: 'text-amber-700 dark:text-amber-300',
  red: 'text-rose-700 dark:text-rose-300',
};

function WinnerBadge({ ticker }: { ticker: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/25">
      <Trophy className="size-3.5" strokeWidth={2} />
      {ticker}
    </span>
  );
}

function MetricCell({ text, isWinner }: { text: string; isWinner: boolean }) {
  return (
    <span className={cn(
      'text-sm tabular-nums',
      isWinner ? 'font-bold text-(--sv-text)' : 'text-(--sv-muted)'
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
    <Card>
      <PanelTitle icon={Table2}>Perbandingan Fundamental</PanelTitle>

      {/* Desktop / tablet: full table with a dedicated Winner column */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-(--sv-border) bg-(--sv-bg) text-left text-xs font-semibold text-(--sv-muted)">
              <th className="px-4 py-2.5">Metrik</th>
              <th className="px-3 py-2.5 text-right">{summaryA.ticker}</th>
              <th className="px-2 py-2.5 text-center">vs</th>
              <th className="px-3 py-2.5">{summaryB.ticker}</th>
              <th className="px-3 py-2.5">Unggul</th>
              <th className="px-4 py-2.5">Keterangan</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ metric, textA, textB, w }) => (
              <tr key={metric.key} className="border-b border-(--sv-border) last:border-b-0 hover:bg-(--sv-bg)">
                <td className="px-4 py-3 font-medium text-(--sv-text)">{metric.label}</td>
                <td className="px-3 py-3 text-right"><MetricCell text={textA} isWinner={w === 'a'} /></td>
                <td className="px-2 py-3 text-center text-xs text-(--sv-muted)">vs</td>
                <td className="px-3 py-3"><MetricCell text={textB} isWinner={w === 'b'} /></td>
                <td className="px-3 py-3">
                  {w === 'a' ? <WinnerBadge ticker={summaryA.ticker} /> : w === 'b' ? <WinnerBadge ticker={summaryB.ticker} /> : <span className="text-xs text-(--sv-muted)">—</span>}
                </td>
                <td className="px-4 py-3 text-xs text-(--sv-muted)">{metric.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: stacked cards — a wide 5-column table does not fit 320-430px screens */}
      <div className="divide-y divide-(--sv-border) sm:hidden">
        {rows.map(({ metric, textA, textB, w }) => (
          <div key={metric.key} className="px-4 py-3">
            <div className="text-xs font-semibold text-(--sv-muted)">{metric.label}</div>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              <div>
                <div className="text-[11px] text-(--sv-muted)">{summaryA.ticker}</div>
                <MetricCell text={textA} isWinner={w === 'a'} />
                {w === 'a' && <div className="mt-1"><WinnerBadge ticker={summaryA.ticker} /></div>}
              </div>
              <div>
                <div className="text-[11px] text-(--sv-muted)">{summaryB.ticker}</div>
                <MetricCell text={textB} isWinner={w === 'b'} />
                {w === 'b' && <div className="mt-1"><WinnerBadge ticker={summaryB.ticker} /></div>}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2.5 border-t border-(--sv-border) p-4">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-(--sv-text)">
          <Lightbulb className="size-4 text-amber-500" strokeWidth={2} />
          Penjelasan Metrik — kenapa unggul?
        </h3>
        {explanations.map((e) => (
          <div key={e.key} className={cn('rounded-lg border px-4 py-3', EXPLANATION_TONE_BG[e.tone])}>
            <span className={cn('text-sm font-semibold', EXPLANATION_TONE_TEXT[e.tone])}>{e.label}</span>
            <p className="mt-1 text-sm leading-relaxed text-(--sv-text)">{e.detail}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
