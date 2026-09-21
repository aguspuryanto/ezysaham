'use client';

/**
 * StockAnalysisPageV2.tsx
 *
 * "Technical Stock Review" dashboard — a second redesign of the stock detail
 * page, structured as a modern, clean, card-based dashboard rather than the
 * minimal single-column review in StockAnalysisPageNew.tsx. Same engine/data
 * (useStockAnalysis + riskGate/quickDecisionSnapshot/bandarScore pipeline) —
 * no backend/API/calculation-engine changes. Bollinger Bands is the one net-new
 * number on this page; it's a standard SMA20 ± 2×stdev computed locally from
 * `bars` (already fetched), not a change to the existing engine.
 */

import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart2,
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  ChevronDown,
  Eye,
  Flame,
  Gauge,
  Globe,
  Loader2,
  NotebookPen,
  RefreshCw,
  Share2,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Waves,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { cn, formatCompact, formatPercent, formatRupiah } from '@/lib/format';
import { SITE_NAME } from '@/lib/site';
import { OHLCVBar } from '@/domain/models/History';
import { PriceLevel, TradeScenario } from '@/domain/models/StockAnalysis';
import { BrokerSummaryRow } from '@/domain/models/BrokerSummary';
import { StockNewsItem } from '@/domain/models/News';
import {
  classifyRsiOverbought,
  evaluateRiskGate,
  BuyPermission,
  TradeStatus,
} from '@/domain/analysis/riskGate';
import {
  classifyZoneStatus,
  isEntryConfirmed,
  isPriceAtEntryTrigger,
  isSetupInvalidated,
  ZoneStatus,
} from '@/domain/analysis/tradeValidation';
import { computeBandarScore, getMarketCyclePhase } from '@/domain/analysis/bandarScore';
import { computeEntryTiming } from '@/domain/analysis/entryTiming';
import { computeQuickDecisionSnapshot } from '@/domain/analysis/quickDecisionSnapshot';
import { gateAdvisorVerdict } from '@/domain/analysis/aiStockEngine';
import { roundToTick } from '@/domain/analysis/idxTick';
import { useWatchlist } from '@/presentation/features/screener/hooks/useWatchlist';
import { useJournal } from '@/presentation/features/journal/hooks/useJournal';
import { useStockAnalysis } from './useStockAnalysis';
import { DataFreshnessPill, DataFreshnessStaleBanner } from './DataFreshnessBanner';
import { OHLCVChart } from './OHLCVChart';

type Tone = 'green' | 'red' | 'amber' | 'blue' | 'zinc';
type SimpleStatus = 'BUY_SETUP' | 'WATCHLIST' | 'WAIT' | 'NO_TRADE';

function fmtRp(n: number): string {
  if (Number.isNaN(n) || n === 0) return '–';
  return formatRupiah(n);
}
function fmtN(n: number, dec = 1): string {
  if (Number.isNaN(n)) return '–';
  return n.toFixed(dec);
}

// ─── Tone maps ──────────────────────────────────────────────────────────────
const TONE_DOT: Record<Tone, string> = {
  green: 'bg-emerald-500', red: 'bg-rose-500', amber: 'bg-amber-400', blue: 'bg-blue-500', zinc: 'bg-zinc-400',
};
const TONE_TEXT: Record<Tone, string> = {
  green: 'text-emerald-700 dark:text-emerald-400', red: 'text-rose-700 dark:text-rose-400',
  amber: 'text-amber-700 dark:text-amber-400', blue: 'text-blue-700 dark:text-blue-400', zinc: 'text-zinc-600 dark:text-zinc-400',
};
const TONE_SOFT_BG: Record<Tone, string> = {
  green: 'bg-emerald-50 dark:bg-emerald-500/10', red: 'bg-rose-50 dark:bg-rose-500/10',
  amber: 'bg-amber-50 dark:bg-amber-500/10', blue: 'bg-blue-50 dark:bg-blue-500/10', zinc: 'bg-zinc-100 dark:bg-zinc-800/60',
};
/** Checklist section only recognizes 3 states (🟢/🟡/🔴) per the spec — blue/zinc fold into amber. */
function toEmoji(tone: Tone): string {
  if (tone === 'green') return '🟢';
  if (tone === 'red') return '🔴';
  return '🟡';
}

const STATUS_LABEL: Record<SimpleStatus, string> = {
  BUY_SETUP: 'BUY SETUP', WATCHLIST: 'WATCHLIST', WAIT: 'WAIT', NO_TRADE: 'NO TRADE',
};
/** Same mapping rationale as StockAnalysisPageNew.tsx: this app's beginner view is long-only, so a
 * SHORT_SETUP reads as WAIT rather than instructing a beginner to short; WAIT_FOR_PULLBACK is exactly
 * "keep watching". */
function deriveSimpleStatus(tradeStatus: TradeStatus): SimpleStatus {
  switch (tradeStatus) {
    case 'BUY': return 'BUY_SETUP';
    case 'WAIT_FOR_PULLBACK': return 'WATCHLIST';
    case 'SHORT_SETUP': return 'WAIT';
    case 'NO_TRADE': return 'NO_TRADE';
    default: return 'WAIT';
  }
}

function trendBig(trend: 'bullish' | 'bearish' | 'sideways'): { label: string; tone: Tone; emoji: string } {
  if (trend === 'bullish') return { label: 'BULLISH', tone: 'green', emoji: '🟢' };
  if (trend === 'bearish') return { label: 'BEARISH', tone: 'red', emoji: '🔴' };
  return { label: 'SIDEWAYS', tone: 'amber', emoji: '🟡' };
}

function classifyMomentum(macdSignalType: string, rsi14: number): { label: string; tone: Tone } {
  let score = 0;
  if (macdSignalType === 'bullish_crossover') score += 2;
  else if (macdSignalType === 'bullish') score += 1;
  else if (macdSignalType === 'bearish_crossover') score -= 2;
  else if (macdSignalType === 'bearish') score -= 1;
  if (rsi14 >= 55) score += 1;
  else if (rsi14 <= 45) score -= 1;
  if (score >= 2) return { label: 'Kuat', tone: 'green' };
  if (score <= -2) return { label: 'Lemah', tone: 'red' };
  return { label: 'Netral', tone: 'amber' };
}

function classifyVolumeCondition(relativeVolume: number): { label: string; tone: Tone } {
  if (Number.isNaN(relativeVolume) || relativeVolume === 0) return { label: 'Data Tidak Ada', tone: 'zinc' };
  if (relativeVolume >= 1.5) return { label: 'Tinggi', tone: 'blue' };
  if (relativeVolume >= 0.8) return { label: 'Normal', tone: 'zinc' };
  return { label: 'Rendah', tone: 'amber' };
}

function classifyForeignFlow(netForeign: number | null, loading: boolean): { label: string; tone: Tone; note: string } {
  if (loading) return { label: 'Memuat…', tone: 'zinc', note: 'Sedang memuat data foreign flow riil.' };
  if (netForeign == null) return { label: 'Data Tidak Tersedia', tone: 'zinc', note: 'Data foreign flow riil belum tersedia untuk saham ini.' };
  if (netForeign > 0) return { label: 'Net Buy Asing', tone: 'green', note: 'Investor asing net membeli — sentimen mendukung kenaikan harga.' };
  if (netForeign < 0) return { label: 'Net Sell Asing', tone: 'red', note: 'Investor asing net menjual — waspadai tekanan jual lanjutan.' };
  return { label: 'Netral', tone: 'amber', note: 'Aktivitas asing relatif seimbang, belum ada arah dominan.' };
}

function classifyRiskLevel(riskGateStatus: 'CLEAR' | 'CONDITIONAL' | 'BLOCKED'): { label: string; tone: Tone } {
  if (riskGateStatus === 'BLOCKED') return { label: 'Tinggi', tone: 'red' };
  if (riskGateStatus === 'CONDITIONAL') return { label: 'Sedang', tone: 'amber' };
  return { label: 'Rendah', tone: 'green' };
}

function classifyChasingRisk(chasingRisk: 'LOW' | 'MODERATE' | 'HIGH' | 'VERY_HIGH'): { label: string; tone: Tone } {
  if (chasingRisk === 'VERY_HIGH') return { label: 'Sangat Tinggi', tone: 'red' };
  if (chasingRisk === 'HIGH') return { label: 'Tinggi', tone: 'red' };
  if (chasingRisk === 'MODERATE') return { label: 'Sedang', tone: 'amber' };
  return { label: 'Rendah', tone: 'green' };
}

// ─── Bollinger Bands (new, local, presentation-only — SMA20 ± 2×stdev of closes) ─────────
interface BollingerBands { middle: number; upper: number; lower: number; }
function computeBollingerBands(bars: OHLCVBar[], period = 20, mult = 2): BollingerBands | null {
  if (bars.length < period) return null;
  const closes = bars.slice(-period).map((b) => b.close);
  const mean = closes.reduce((a, b) => a + b, 0) / period;
  const variance = closes.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
  const sd = Math.sqrt(variance);
  return { middle: mean, upper: mean + mult * sd, lower: mean - mult * sd };
}
function interpretBollinger(price: number, bb: BollingerBands): { label: string; tone: Tone; note: string } {
  const width = bb.upper - bb.lower || 1;
  const pctB = ((price - bb.lower) / width) * 100;
  if (pctB >= 100) return { label: 'Di Atas Upper Band', tone: 'red', note: 'Harga menembus upper band — momentum sangat kuat, tapi rawan koreksi jangka pendek.' };
  if (pctB <= 0) return { label: 'Di Bawah Lower Band', tone: 'amber', note: 'Harga menembus lower band — tekanan jual besar, berpotensi oversold bounce.' };
  if (pctB >= 80) return { label: 'Dekat Upper Band', tone: 'green', note: 'Harga mendekati upper band — momentum naik masih kuat.' };
  if (pctB <= 20) return { label: 'Dekat Lower Band', tone: 'amber', note: 'Harga mendekati lower band — momentum tertekan, waspadai breakdown lanjutan.' };
  return { label: 'Di Tengah Band', tone: 'zinc', note: 'Harga bergerak di tengah band — volatilitas normal, belum ada sinyal ekstrem.' };
}

function buildSummaryDescription(params: { trendLabel: string; momentumLabel: string; positionNote: string }): string {
  const { trendLabel, momentumLabel, positionNote } = params;
  const trendSentence =
    trendLabel === 'BULLISH' ? 'Trend sedang menguat.' : trendLabel === 'BEARISH' ? 'Trend masih lemah.' : 'Trend masih mendatar.';
  const momentumSentence =
    momentumLabel === 'Kuat' ? `Momentum ${momentumLabel.toLowerCase()} mendukung kelanjutan arah saat ini.`
      : momentumLabel === 'Lemah' ? `Momentum ${momentumLabel.toLowerCase()} belum memberikan konfirmasi pembalikan.`
        : 'Momentum belum satu arah, masih menunggu konfirmasi.';
  return `${trendSentence} ${positionNote} ${momentumSentence}`;
}

function buildFocusLine(simpleStatus: SimpleStatus, trendLabel: string): string {
  switch (simpleStatus) {
    case 'BUY_SETUP': return 'Fokus: jaga stop loss dan ambil untung bertahap sesuai rencana.';
    case 'WATCHLIST': return 'Fokus: tunggu pullback ke area support sebelum masuk.';
    case 'NO_TRADE': return 'Fokus: hindari dulu sampai sinyal risiko mereda.';
    default: return trendLabel === 'BEARISH' ? 'Fokus: tunggu breakout / rebound yang terkonfirmasi.' : 'Fokus: tunggu konfirmasi lebih lanjut sebelum masuk.';
  }
}

function buildReasons(params: {
  trendLabel: string;
  momentumLabel: string;
  volumeLabel: string;
  adLabel: string;
  foreignFlowLabel: string;
  nearestResistance?: number;
  nearestSupport?: number;
  price: number;
  rsi14: number;
}): string[] {
  const { trendLabel, momentumLabel, volumeLabel, adLabel, foreignFlowLabel, nearestResistance, nearestSupport, price, rsi14 } = params;
  const reasons: string[] = [];

  reasons.push(
    trendLabel === 'BULLISH' ? 'Harga bergerak di atas rata-rata jangka menengah (EMA) — struktur trend masih naik.'
      : trendLabel === 'BEARISH' ? 'Harga bergerak di bawah rata-rata jangka menengah (EMA) — struktur trend masih turun.'
        : 'Harga berada di kisaran rata-rata jangka menengah (EMA) — belum ada arah trend yang jelas.'
  );

  reasons.push(
    momentumLabel === 'Kuat' ? 'Momentum (RSI & MACD) kuat, mendukung kelanjutan arah harga saat ini.'
      : momentumLabel === 'Lemah' ? 'Momentum (RSI & MACD) lemah, belum ada tekanan beli yang cukup.'
        : 'Momentum (RSI & MACD) netral, sinyal belum satu arah.'
  );

  if (nearestResistance && price < nearestResistance) {
    reasons.push(`Harga masih tertahan di bawah resistance terdekat ${fmtRp(nearestResistance)}.`);
  } else if (nearestSupport && price <= nearestSupport * 1.03) {
    reasons.push(`Harga berada dekat area support ${fmtRp(nearestSupport)}, area ini biasanya jadi titik pantul.`);
  }

  reasons.push(
    volumeLabel === 'Tinggi' ? 'Volume transaksi di atas rata-rata — minat pasar sedang meningkat.'
      : volumeLabel === 'Rendah' ? 'Volume transaksi di bawah rata-rata — minat pasar masih sepi, sinyal belum kuat.'
        : 'Volume transaksi masih normal, belum ada lonjakan minat yang berarti.'
  );

  reasons.push(`Bandar Detector (Accumulation/Distribution) membaca kondisi "${adLabel}".`);

  if (foreignFlowLabel !== 'Data Tidak Tersedia' && foreignFlowLabel !== 'Memuat…') {
    reasons.push(`Aktivitas asing menunjukkan kondisi "${foreignFlowLabel}".`);
  }

  if (rsi14 >= 80) reasons.push(`RSI ${fmtN(rsi14)} sudah sangat tinggi (extreme overbought) — hati-hati risiko koreksi.`);

  return reasons.slice(0, 5);
}

interface IntradayScenario {
  type: 'bullish' | 'sideways' | 'bearish';
  title: string;
  trigger: string;
  area: string;
  konfirmasi: string;
  risiko: string;
}
function buildIntradayScenarios(price: number, resistance?: PriceLevel, support?: PriceLevel): IntradayScenario[] {
  const r = resistance?.price;
  const s = support?.price;
  return [
    {
      type: 'bullish',
      title: 'Skenario Bullish',
      trigger: r ? `Harga menembus (breakout) resistance ${fmtRp(r)}.` : 'Harga menembus resistance terdekat.',
      area: r ? `${fmtRp(r)} ke atas` : '–',
      konfirmasi: 'Candle closing di atas resistance, disertai volume di atas rata-rata (RVOL > 1.5×).',
      risiko: 'Jika breakout gagal (harga balik turun ke bawah level tersebut), waspadai false breakout — siapkan stop loss di bawah level breakout.',
    },
    {
      type: 'sideways',
      title: 'Skenario Sideways',
      trigger: r && s ? `Harga bertahan dalam range ${fmtRp(s)}–${fmtRp(r)} tanpa breakout yang jelas.` : 'Harga bergerak dalam range sempit.',
      area: r && s ? `${fmtRp(s)} – ${fmtRp(r)}` : '–',
      konfirmasi: 'Harga memantul di kedua batas range dengan volume relatif normal/rendah.',
      risiko: 'Sinyal palsu (whipsaw) lebih sering terjadi — hindari entry besar di tengah range, tunggu breakout/breakdown yang jelas.',
    },
    {
      type: 'bearish',
      title: 'Skenario Bearish',
      trigger: s ? `Harga menembus (breakdown) support ${fmtRp(s)}.` : 'Harga menembus support terdekat.',
      area: s ? `${fmtRp(s)} ke bawah` : '–',
      konfirmasi: 'Candle closing di bawah support, disertai volume di atas rata-rata.',
      risiko: 'Potensi penurunan lanjutan ke support berikutnya — hindari average down tanpa konfirmasi pembalikan arah.',
    },
  ];
}

// ─── Small building blocks ─────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, title, badge }: { icon: typeof Activity; title: string; badge?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-3">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-zinc-400" strokeWidth={2.5} />
        <h2 className="text-xs font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{title}</h2>
      </div>
      {badge}
    </div>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={cn('neo-border neo-shadow bg-white dark:bg-zinc-900 p-4 sm:p-5', className)}>{children}</section>;
}

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="neo-border border-zinc-200 dark:border-zinc-700 p-3 flex flex-col gap-1">
      <span className="text-[10px] font-bold uppercase tracking-wide text-zinc-400">{label}</span>
      <span className="font-mono text-sm sm:text-base font-bold text-zinc-800 dark:text-zinc-100">{value}</span>
      {sub && <span className="text-[11px] text-zinc-400">{sub}</span>}
    </div>
  );
}

function TonePill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold neo-border', TONE_SOFT_BG[tone], TONE_TEXT[tone])}>
      {children}
    </span>
  );
}

function IndicatorDetailCard({
  icon: Icon, title, badgeLabel, badgeTone, rows, note,
}: {
  icon: typeof Activity; title: string; badgeLabel: string; badgeTone: Tone; rows: { label: string; value: string }[]; note: string;
}) {
  return (
    <div className="neo-border bg-white dark:bg-zinc-900 p-4 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">
          <Icon className="size-3.5 text-zinc-400" strokeWidth={2.5} />
          {title}
        </span>
        <TonePill tone={badgeTone}>{badgeLabel}</TonePill>
      </div>
      <div className="space-y-1">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between text-sm">
            <span className="text-zinc-500 dark:text-zinc-400">{r.label}</span>
            <span className="font-mono font-bold tabular-nums text-zinc-800 dark:text-zinc-200">{r.value}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed border-t border-zinc-100 dark:border-zinc-800 pt-2">{note}</p>
    </div>
  );
}

function ConditionChip({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  return (
    <div className="neo-border border-zinc-200 dark:border-zinc-700 px-3 py-2 flex items-center justify-between gap-2">
      <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className={cn('flex items-center gap-1.5 text-xs font-bold', TONE_TEXT[tone])}>
        <span className={cn('size-2 shrink-0', TONE_DOT[tone])} />
        {value}
      </span>
    </div>
  );
}

function ChecklistRow({ label, tone, value }: { label: string; tone: Tone; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 py-2 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
      <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{label}</span>
      <span className="flex items-center gap-1.5 text-sm">
        <span>{toEmoji(tone)}</span>
        <span className={cn('font-bold', TONE_TEXT[tone])}>{value}</span>
      </span>
    </div>
  );
}

function LevelRow({ label, price, tone, distancePct, highlight }: {
  label: string; price: number; tone: 'up' | 'down' | 'flat'; distancePct?: number; highlight?: boolean;
}) {
  const toneClass = tone === 'up' ? 'text-amber-600 dark:text-amber-400' : tone === 'down' ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-800 dark:text-zinc-100';
  return (
    <div className={cn(
      'flex items-center justify-between gap-3 px-4 py-2.5 neo-border',
      highlight ? 'bg-zinc-900 dark:bg-white neo-shadow-sm' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700'
    )}>
      <span className={cn('text-xs font-bold uppercase tracking-wide', highlight ? 'text-white dark:text-zinc-900' : 'text-zinc-400')}>{label}</span>
      <div className="flex items-baseline gap-2">
        <span className={cn('font-mono text-sm font-bold tabular-nums', highlight ? 'text-white dark:text-zinc-900' : toneClass)}>{fmtRp(price)}</span>
        {distancePct != null && !highlight && (
          <span className="text-[10px] font-mono text-zinc-400">{distancePct >= 0 ? '+' : ''}{distancePct.toFixed(1)}%</span>
        )}
      </div>
    </div>
  );
}

function ScenarioCard({ scenario }: { scenario: IntradayScenario }) {
  const toneMap: Record<IntradayScenario['type'], { tone: Tone; icon: typeof TrendingUp }> = {
    bullish: { tone: 'green', icon: TrendingUp },
    sideways: { tone: 'amber', icon: Waves },
    bearish: { tone: 'red', icon: TrendingDown },
  };
  const { tone, icon: Icon } = toneMap[scenario.type];
  return (
    <div className="neo-border bg-white dark:bg-zinc-900 overflow-hidden">
      <div className={cn('flex items-center gap-2 px-4 py-2.5 border-b-2 border-(--neo-line) font-bold text-sm', TONE_SOFT_BG[tone], TONE_TEXT[tone])}>
        <Icon className="size-4" strokeWidth={2.5} />
        {scenario.title}
      </div>
      <div className="p-4 space-y-2.5 text-sm">
        <div><span className="text-[10px] font-bold uppercase text-zinc-400 block mb-0.5">Trigger</span><p className="text-zinc-700 dark:text-zinc-300 leading-snug">{scenario.trigger}</p></div>
        <div><span className="text-[10px] font-bold uppercase text-zinc-400 block mb-0.5">Area Harga</span><p className="font-mono font-bold text-zinc-800 dark:text-zinc-100">{scenario.area}</p></div>
        <div><span className="text-[10px] font-bold uppercase text-zinc-400 block mb-0.5">Konfirmasi</span><p className="text-zinc-700 dark:text-zinc-300 leading-snug">{scenario.konfirmasi}</p></div>
        <div><span className="text-[10px] font-bold uppercase text-zinc-400 block mb-0.5">Risiko</span><p className="text-zinc-500 dark:text-zinc-400 leading-snug">{scenario.risiko}</p></div>
      </div>
    </div>
  );
}

function Collapse({ title, icon: Icon, defaultOpen = false, children }: {
  title: string; icon: typeof BarChart2; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="neo-border bg-white dark:bg-zinc-900 overflow-hidden">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-left border-b-2 border-transparent data-[open=true]:border-(--neo-line)" data-open={open}>
        <Icon className="size-4 shrink-0 text-zinc-400" strokeWidth={2.5} />
        <span className="flex-1 text-sm font-bold uppercase tracking-wide text-zinc-800 dark:text-zinc-100">{title}</span>
        <ChevronDown className={cn('size-4 shrink-0 text-zinc-400 transition-transform', open && 'rotate-180')} strokeWidth={2.5} />
      </button>
      {open && <div className="px-4 py-4 border-t-2 border-(--neo-line) space-y-3">{children}</div>}
    </div>
  );
}

function MiniKV({ label, value, valueClass }: { label: string; value: React.ReactNode; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm py-1">
      <span className="text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className={cn('font-mono font-bold tabular-nums text-zinc-800 dark:text-zinc-200', valueClass)}>{value}</span>
    </div>
  );
}

function ScenarioMiniCard({ scenario, isBias }: { scenario: TradeScenario; isBias: boolean }) {
  const isLong = scenario.direction === 'LONG';
  return (
    <div className={cn('neo-border p-3 space-y-1.5', isLong ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'bg-rose-50 dark:bg-rose-500/10')}>
      {/* <div className="flex items-center justify-between">
        <span className={cn('text-xs font-bold uppercase', isLong ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400')}>
          {isLong ? 'Skenario Bullish' : 'Skenario Bearish'} {isBias && '· Rekomendasi'}
        </span>
        <span className="text-[10px] font-mono text-zinc-400">R:R 1:{fmtN(scenario.riskRewardRatio, 1)}</span>
      </div> */}
      <MiniKV label="Entry" value={fmtRp(scenario.entry)} />
      <MiniKV label="TP1 / TP2" value={`${fmtRp(scenario.tp1)} / ${fmtRp(scenario.tp2)}`} valueClass="text-emerald-600 dark:text-emerald-400" />
      <MiniKV label="Stop Loss" value={fmtRp(scenario.sl)} valueClass="text-rose-600 dark:text-rose-400" />
      <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed pt-1">{scenario.notes}</p>
    </div>
  );
}

function NewsRow({ item }: { item: StockNewsItem }) {
  const tone: Tone = item.sentiment === 'bullish' ? 'green' : item.sentiment === 'bearish' ? 'red' : 'zinc';
  return (
    <a href={item.url} target="_blank" rel="noopener noreferrer" className="block py-2 border-b border-zinc-100 dark:border-zinc-800 last:border-0 group">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 leading-snug group-hover:underline">{item.title}</p>
        <TonePill tone={tone}>{item.sentiment}</TonePill>
      </div>
      <p className="text-[11px] text-zinc-400 mt-1">{item.publisher} · {item.publishedAt}</p>
    </a>
  );
}

function BrokerRow({ row, tone }: { row: BrokerSummaryRow; tone: 'green' | 'red' }) {
  return (
    <div className="flex items-center justify-between gap-2 text-[11px]">
      <span className="font-mono font-bold text-zinc-700 dark:text-zinc-300">{row.code}</span>
      <span className={cn('font-mono font-bold', tone === 'green' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
        {tone === 'green' ? '+' : ''}Rp{formatCompact(row.netValue)}
      </span>
    </div>
  );
}

// ─── Loading / error states ─────────────────────────────────────────────────────
function LoadingState({ ticker }: { ticker: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-zinc-50 dark:bg-zinc-950">
      <Loader2 className="size-8 animate-spin text-zinc-400" strokeWidth={2.5} />
      <p className="text-sm font-semibold text-zinc-500">Memuat analisis {ticker.toUpperCase()}…</p>
    </div>
  );
}
function ErrorState({ ticker }: { ticker: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white dark:bg-zinc-950 px-4">
      <AlertTriangle className="size-10 text-amber-400" />
      <p className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">Data tidak tersedia</p>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center max-w-xs">
        Ticker <strong>{ticker.toUpperCase()}</strong> tidak ditemukan atau gagal dimuat.
      </p>
      <Link href="/screener" className="neo-press inline-flex items-center gap-2 neo-border neo-shadow-sm bg-emerald-400 px-4 py-2 text-sm font-bold text-black">
        <ArrowLeft className="size-4" strokeWidth={2.5} /> Kembali ke Screener
      </Link>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────────
export function StockAnalysisPageV2({ ticker }: { ticker: string }) {
  const {
    status, summary, analysis, bars, advisor, fundamentalScreening, technicalScreening,
    fundamentals, fundamentalsLoading, brokerActivity, brokerActivityLoading, newsItems, freshness, reload,
  } = useStockAnalysis(ticker);

  const watchlist = useWatchlist();
  const journal = useJournal();
  const [justCopied, setJustCopied] = useState(false);
  const [addingToJournal, setAddingToJournal] = useState(false);
  const [journalStatus, setJournalStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleAddToJournal = useCallback(async () => {
    if (!summary || !analysis) return;
    setAddingToJournal(true);
    setJournalStatus(null);
    try {
      const scenario = analysis.tradingPlan.recommendedBias === 'bearish' ? analysis.tradingPlan.bearish : analysis.tradingPlan.bullish;
      const res = await journal.addEntries([{
        ticker: summary.ticker, presetId: null, entry: scenario.entry, tp1: scenario.tp1, tp2: scenario.tp2, sl: scenario.sl,
        riskRewardPlanned: scenario.riskRewardRatio, reasonBuy: analysis.conclusion.summary, reasonAvoid: analysis.conclusion.watchOut,
      }]);
      setJournalStatus(res.ok ? { type: 'success', text: `${summary.ticker} ditambahkan ke Jurnal.` } : { type: 'error', text: res.message ?? 'Gagal menyimpan ke Jurnal.' });
    } finally {
      setAddingToJournal(false);
      setTimeout(() => setJournalStatus(null), 3000);
    }
  }, [summary, analysis, journal]);

  const handleShare = useCallback(async () => {
    if (!summary) return;
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: `${summary.ticker} — ${summary.name}`, text: 'Analisis saham EzySaham', url }); } catch { /* cancelled */ }
      return;
    }
    try { await navigator.clipboard.writeText(url); setJustCopied(true); setTimeout(() => setJustCopied(false), 2000); } catch { /* clipboard unavailable */ }
  }, [summary]);

  // ── Decision pipeline: identical inputs/order to StockAnalysisPage.tsx's quickDecisionSnapshot
  // memo — see riskGate.ts / quickDecisionSnapshot.ts for why each field exists.
  const decision = useMemo(() => {
    if (!summary || !analysis || !fundamentalScreening) return null;
    const bandarScore = computeBandarScore(summary, bars);
    const marketCyclePhase = getMarketCyclePhase(bandarScore, analysis.indicators);
    const entryTiming = computeEntryTiming(bandarScore, analysis.indicators);
    const bias = analysis.tradingPlan.recommendedBias === 'bearish' ? 'bearish' : 'bullish';
    const scenario = analysis.tradingPlan[bias];
    const isLong = scenario.direction === 'LONG';
    const price = summary.lastClose;
    const isStrongDistribution = bandarScore.classification.label === 'Strong Distribution';
    const isDistributionRisk = bandarScore.classification.label === 'Distribution Risk';
    const priceAtEntryTrigger = isPriceAtEntryTrigger(scenario.direction, price, scenario.entry);
    const setupInvalidated = isSetupInvalidated(scenario.direction, price, scenario.sl);
    const nearestSupport = analysis.supportResistance.supports[0];
    const nearestResistance = analysis.supportResistance.resistances[0];
    const entryPrice = roundToTick(scenario.entry);
    const entryZoneLow = isLong && nearestSupport ? roundToTick(nearestSupport.price) : entryPrice;
    const entryZoneHigh = entryPrice;
    const zoneStatus: ZoneStatus = classifyZoneStatus(price, entryZoneLow, entryZoneHigh);
    const der = fundamentals?.debtToEquity ?? null;
    const bullishReversalCandle = analysis.priceAction.lastCandleColor === 'green' ||
      analysis.priceAction.pattern === 'bullish_engulfing' || analysis.priceAction.pattern === 'hammer' || analysis.priceAction.pattern === 'marubozu_bullish';
    const bearishReversalCandle = analysis.priceAction.lastCandleColor === 'red' ||
      analysis.priceAction.pattern === 'bearish_engulfing' || analysis.priceAction.pattern === 'shooting_star' || analysis.priceAction.pattern === 'marubozu_bearish';
    const entryConfirmed = isEntryConfirmed({
      priceAtEntryTrigger, setupInvalidated,
      trendValid: isLong ? analysis.trendEma.trend !== 'bearish' : analysis.trendEma.trend !== 'bullish',
      reversalConfirmed: isLong ? bullishReversalCandle : bearishReversalCandle,
      volumeSupportive: analysis.volume.relativeVolume >= 1,
    });
    const riskGate = evaluateRiskGate({
      direction: scenario.direction, trend: analysis.trendEma.trend, rsi14: analysis.indicators.rsi14,
      fundamentalScore: fundamentalScreening.score, isStrongDistribution,
      priceBelowEma50: price <= analysis.trendEma.ema50, priceBelowEma200: price <= analysis.trendEma.ema200,
      priceAtEntryTrigger, setupInvalidated, entryConfirmed, extremeDistanceWarning: scenario.extremeDistanceWarning,
      isDistributionRisk, zoneStatus, der, roe: summary.roe,
    });
    const hasSetupErrors = scenario.validationErrors.length > 0;
    const tradeStatus: TradeStatus = hasSetupErrors ? 'NO_TRADE' : riskGate.tradeStatus;
    const buyPermission: BuyPermission = hasSetupErrors ? 'FALSE' : riskGate.buyPermission;
    const snapshot = computeQuickDecisionSnapshot({
      bars, trendEma: analysis.trendEma, indicators: analysis.indicators, volume: analysis.volume,
      supportResistance: analysis.supportResistance, bandarScore, marketCyclePhase, entryTiming,
      tradeStatus, buyPermission, riskGateReasons: riskGate.reasons,
    });
    return {
      bandarScore, marketCyclePhase, entryTiming, scenario, isLong, price, priceAtEntryTrigger,
      setupInvalidated, nearestSupport, nearestResistance, entryZoneLow, zoneStatus, entryConfirmed,
      riskGate, tradeStatus, buyPermission, snapshot,
    };
  }, [summary, bars, analysis, fundamentals, fundamentalScreening]);

  const gatedAdvisor = useMemo(() => {
    if (!advisor || !decision) return advisor;
    return gateAdvisorVerdict(advisor, decision.tradeStatus);
  }, [advisor, decision]);

  const bollinger = useMemo(() => computeBollingerBands(bars), [bars]);

  if (status === 'loading') return <LoadingState ticker={ticker} />;
  if (status === 'error' || !analysis || !summary || !fundamentalScreening || !technicalScreening || !decision) {
    return <ErrorState ticker={ticker} />;
  }

  const { trendEma, supportResistance, indicators, volume } = analysis;
  const { nearestSupport, nearestResistance, riskGate, setupInvalidated } = decision;
  const positiveDay = summary.percentChange1D >= 0;
  const isWatched = watchlist.has(summary.ticker);
  const lastBar = bars[bars.length - 1];
  const der = fundamentals?.debtToEquity ?? null;

  const simpleStatus = deriveSimpleStatus(decision.tradeStatus);
  const trend = trendBig(trendEma.trend);
  const momentum = classifyMomentum(indicators.macdSignalType, indicators.rsi14);
  const volumeCond = classifyVolumeCondition(volume.relativeVolume);
  const netForeign = brokerActivity?.foreignFlow?.netForeign ?? null;
  const foreignFlow = classifyForeignFlow(netForeign, brokerActivityLoading);
  const adTone: Tone = decision.bandarScore.classification.tone === 'orange' ? 'amber' : decision.bandarScore.classification.tone;

  const rsiOverbought = classifyRsiOverbought(indicators.rsi14);
  const chasingRisk = classifyChasingRisk(rsiOverbought.chasingRisk);
  const breakdownRiskFlag = setupInvalidated || decision.bandarScore.phase === 'markdown' ||
    (trendEma.trend === 'bearish' && nearestSupport != null && summary.lastClose < nearestSupport.price);
  const riskLevel = classifyRiskLevel(riskGate.riskGateStatus);

  const positionNote = nearestResistance && summary.lastClose < nearestResistance.price
    ? `Harga berada di bawah resistance ${fmtRp(nearestResistance.price)}.`
    : nearestSupport
      ? `Harga berada di sekitar area support ${fmtRp(nearestSupport.price)}.`
      : 'Level support/resistance belum sepenuhnya jelas.';
  const summaryDescription = buildSummaryDescription({ trendLabel: trend.label, momentumLabel: momentum.label, positionNote });
  const focusLine = buildFocusLine(simpleStatus, trend.label);

  const reasons = buildReasons({
    trendLabel: trend.label, momentumLabel: momentum.label, volumeLabel: volumeCond.label,
    adLabel: decision.bandarScore.classification.label, foreignFlowLabel: foreignFlow.label,
    nearestResistance: nearestResistance?.price, nearestSupport: nearestSupport?.price,
    price: summary.lastClose, rsi14: indicators.rsi14,
  });

  const scenarios = buildIntradayScenarios(summary.lastClose, nearestResistance, supportResistance.supports[0]);
  const relevantNews = newsItems.filter((n) => n.relevance !== 'UNRELATED').slice(0, 6);
  const bollingerInfo = bollinger ? interpretBollinger(summary.lastClose, bollinger) : null;

  const resistanceLevels = [supportResistance.resistances[2], supportResistance.resistances[1], supportResistance.resistances[0]].filter(Boolean) as PriceLevel[];
  const supportLevels = [supportResistance.supports[0], supportResistance.supports[1], supportResistance.supports[2]].filter(Boolean) as PriceLevel[];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* ── Sticky Header ──────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm neo-border border-x-0 border-t-0">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-2.5 sm:px-6 sm:py-3">
          <Link href="/screener" className="flex shrink-0 items-center gap-1 text-sm font-bold text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors" aria-label="Kembali ke screener">
            <ArrowLeft className="size-4" strokeWidth={2.5} />
            <span className="hidden sm:inline text-xs uppercase tracking-wide">Screener</span>
          </Link>
          <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-700" />
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className="font-bold text-zinc-900 dark:text-zinc-100 text-base">{summary.ticker}</span>
            <span className="hidden sm:inline truncate text-xs font-medium text-zinc-400 dark:text-zinc-500">{summary.name}</span>
          </div>
          <button type="button" onClick={handleAddToJournal} disabled={addingToJournal} title="Tambah ke Jurnal"
            className="neo-press flex shrink-0 size-8 items-center justify-center neo-border neo-shadow-sm bg-white text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 rounded-lg disabled:opacity-50">
            {addingToJournal ? <Loader2 className="size-3.5 animate-spin" strokeWidth={2.5} /> : <NotebookPen className="size-3.5" strokeWidth={2.5} />}
          </button>
          <button type="button" onClick={() => reload(true)} title="Perbarui data" className="neo-press flex shrink-0 size-8 items-center justify-center neo-border neo-shadow-sm bg-white text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 rounded-lg">
            <RefreshCw className="size-3.5" strokeWidth={2.5} />
          </button>
        </div>
      </header>

      {journalStatus && (
        <div className={cn('fixed inset-x-0 top-16 z-40 mx-auto w-fit max-w-xs neo-border neo-shadow-sm px-3 py-2 text-center text-xs font-bold',
          journalStatus.type === 'success' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-400/10 dark:text-rose-300')}>
          {journalStatus.text}
        </div>
      )}

      <main className="mx-auto max-w-6xl px-3 py-4 sm:px-6 sm:py-6 pb-16 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-4 sm:gap-5 lg:items-start">

        {/* ── LEFT / MAIN COLUMN — the core review ─────────────────────────── */}
        <div className="min-w-0 space-y-5">

          {freshness && <DataFreshnessStaleBanner freshness={freshness} />}

          {/* ── Summary Card ─────────────────────────────────────────────── */}
          <Card className={cn('space-y-2.5', TONE_SOFT_BG[trend.tone])}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{summary.ticker}</span>
                <span className="text-zinc-400">—</span>
                <span className="font-mono text-lg font-bold tabular-nums text-zinc-900 dark:text-zinc-100">{formatRupiah(summary.lastClose)}</span>
                <span className={cn('inline-flex items-center gap-0.5 text-xs font-mono font-bold tabular-nums', positiveDay ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
                  {positiveDay ? <TrendingUp className="size-3.5" strokeWidth={2.5} /> : <TrendingDown className="size-3.5" strokeWidth={2.5} />}
                  {formatPercent(summary.percentChange1D)}
                </span>
                {freshness && <DataFreshnessPill freshness={freshness} />}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button type="button" onClick={handleShare} className="neo-press flex items-center gap-1 px-2.5 py-1.5 neo-border neo-shadow-sm bg-white dark:bg-zinc-900 text-xs font-bold text-zinc-600 dark:text-zinc-300 rounded-lg">
                  <Share2 className="size-3.5" strokeWidth={2.5} /><span className="hidden sm:inline">{justCopied ? 'Disalin!' : 'Bagikan'}</span>
                </button>
                <button type="button" onClick={() => watchlist.toggle(summary.ticker)}
                  className={cn('neo-press flex items-center gap-1 px-2.5 py-1.5 neo-border neo-shadow-sm text-xs font-bold rounded-lg', isWatched ? 'bg-amber-300 text-black' : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300')}>
                  {isWatched ? <BookmarkCheck className="size-3.5" strokeWidth={2.5} /> : <Bookmark className="size-3.5" strokeWidth={2.5} />}
                  <span className="hidden sm:inline">{isWatched ? 'Watching' : 'Watch'}</span>
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl">{trend.emoji}</span>
              <span className={cn('text-xl sm:text-2xl font-black tracking-tight', TONE_TEXT[trend.tone])}>{trend.label}</span>
              <span className="text-zinc-400">—</span>
              <span className="text-base font-bold text-zinc-700 dark:text-zinc-300">{STATUS_LABEL[simpleStatus]}</span>
            </div>
            <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">{summaryDescription}</p>
            <p className="text-sm font-bold text-zinc-800 dark:text-zinc-100">{focusLine}</p>
          </Card>

          {/* ── Chart Candlestick (tetap elemen utama) ───────────────────── */}
          {bars.length > 0 && (
            <div className="neo-border neo-shadow overflow-hidden">
              <OHLCVChart bars={bars} currentClose={summary.lastClose} ticker={summary.ticker} prevClose={summary.prevClose} />
            </div>
          )}

          {/* ── 1. Data Hari Ini ─────────────────────────────────────────── */}
          <Card>
            <SectionHeader icon={Activity} title="Data Hari Ini" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <StatTile label="Open" value={lastBar ? fmtRp(lastBar.open) : '–'} />
              <StatTile label="High" value={lastBar ? fmtRp(lastBar.high) : '–'} />
              <StatTile label="Low" value={lastBar ? fmtRp(lastBar.low) : '–'} />
              <StatTile label="Close" value={fmtRp(summary.lastClose)} />
              <StatTile label="Perubahan %" value={formatPercent(summary.percentChange1D)} />
              <StatTile label="Volume" value={lastBar ? formatCompact(lastBar.volume) : '–'} />
              <StatTile label="MA20 Volume" value={formatCompact(volume.volumeMa20)} />
              <StatTile label="RVOL" value={Number.isNaN(volume.relativeVolume) ? '–' : `${volume.relativeVolume.toFixed(2)}×`} />
            </div>
          </Card>

          {/* ── 2. Indikator Utama ───────────────────────────────────────── */}
          <div>
            <SectionHeader icon={Gauge} title="Indikator Utama" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <IndicatorDetailCard
                icon={TrendingUp} title="EMA 20 / 50 / 200" badgeLabel={trend.label} badgeTone={trend.tone}
                rows={[
                  { label: 'EMA 20', value: fmtRp(trendEma.ema20) },
                  { label: 'EMA 50', value: fmtRp(trendEma.ema50) },
                  { label: 'EMA 200', value: fmtRp(trendEma.ema200) },
                ]}
                note={trendEma.trendDescription}
              />
              <IndicatorDetailCard
                icon={Waves} title="Bollinger Bands" badgeLabel={bollingerInfo?.label ?? 'Data Belum Cukup'} badgeTone={bollingerInfo?.tone ?? 'zinc'}
                rows={bollinger ? [
                  { label: 'Upper', value: fmtRp(bollinger.upper) },
                  { label: 'Middle (SMA20)', value: fmtRp(bollinger.middle) },
                  { label: 'Lower', value: fmtRp(bollinger.lower) },
                ] : [{ label: 'Upper / Middle / Lower', value: '–' }]}
                note={bollingerInfo?.note ?? 'Butuh minimal 20 hari data harga untuk menghitung Bollinger Bands.'}
              />
              <IndicatorDetailCard
                icon={Activity} title="RSI / Stochastic" badgeLabel={indicators.rsiZone === 'oversold' ? 'Oversold' : indicators.rsiZone === 'overbought' || indicators.rsiZone === 'overbought_risk' ? 'Overbought' : 'Netral'}
                badgeTone={indicators.rsiZone === 'oversold' ? 'amber' : indicators.rsiZone === 'overbought' || indicators.rsiZone === 'overbought_risk' ? 'red' : 'green'}
                rows={[
                  { label: 'RSI (14)', value: fmtN(indicators.rsi14) },
                  { label: 'Stochastic %K', value: fmtN(indicators.stochK) },
                  { label: 'Stochastic %D', value: fmtN(indicators.stochD) },
                ]}
                note={`${indicators.rsiNote} ${indicators.stochNote}`}
              />
              <IndicatorDetailCard
                icon={Sparkles} title="MACD" badgeLabel={indicators.macdSignalType.replace('_', ' ')}
                badgeTone={indicators.macdSignalType.includes('bullish') ? 'green' : indicators.macdSignalType.includes('bearish') ? 'red' : 'amber'}
                rows={[
                  { label: 'MACD', value: fmtN(indicators.macdValue, 2) },
                  { label: 'Signal', value: fmtN(indicators.macdSignal, 2) },
                  { label: 'Histogram', value: fmtN(indicators.macdHistogram, 2) },
                ]}
                note={indicators.macdNote}
              />
              <IndicatorDetailCard
                icon={Eye} title="Accumulation / Distribution" badgeLabel={decision.bandarScore.classification.label} badgeTone={adTone}
                rows={[
                  { label: 'Fase Wyckoff', value: decision.bandarScore.phaseLabel },
                  { label: 'Skor', value: `${decision.bandarScore.total}/${decision.bandarScore.max}` },
                ]}
                note={decision.bandarScore.hiddenDistributionWarning
                  ? 'Harga naik/flat tapi volume (OBV) melemah — indikasi hidden distribution, smart money bisa jadi mulai menjual.'
                  : 'Proksi akumulasi/distribusi dari pola harga & volume (Wyckoff) — bukan data broker riil.'}
              />
              <IndicatorDetailCard
                icon={Globe} title="Foreign Flow" badgeLabel={foreignFlow.label} badgeTone={foreignFlow.tone}
                rows={netForeign != null ? [{ label: 'Net Foreign', value: `${netForeign >= 0 ? '+' : ''}Rp${formatCompact(netForeign)}` }] : [{ label: 'Net Foreign', value: '–' }]}
                note={foreignFlow.note}
              />
            </div>
          </div>

          {/* ── 3. Tren & Kondisi ────────────────────────────────────────── */}
          <Card>
            <SectionHeader icon={TrendingUp} title="Tren & Kondisi" />
            <div className={cn('flex items-center gap-3 neo-border px-4 py-3 mb-3', TONE_SOFT_BG[trend.tone])}>
              <span className="text-2xl">{trend.emoji}</span>
              <span className={cn('text-2xl font-black tracking-tight', TONE_TEXT[trend.tone])}>{trend.label}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
              <ConditionChip label="Trend" value={trend.label} tone={trend.tone} />
              <ConditionChip label="Momentum" value={momentum.label} tone={momentum.tone} />
              <ConditionChip label="Volume" value={volumeCond.label} tone={volumeCond.tone} />
              <ConditionChip label="Foreign Flow" value={foreignFlow.label} tone={foreignFlow.tone} />
              <ConditionChip label="A/D" value={decision.bandarScore.classification.label} tone={adTone} />
            </div>
            <p className="text-xs font-bold uppercase text-zinc-400 mb-2">Kenapa kondisinya begini?</p>
            <ul className="space-y-2">
              {reasons.map((reason, i) => (
                <li key={i} className="flex gap-2.5 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                  <span className="shrink-0 flex size-5 items-center justify-center neo-border bg-zinc-100 dark:bg-zinc-800 text-[11px] font-bold text-zinc-500 mt-0.5">{i + 1}</span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </Card>

          {/* ── 4. Level Penting & 5. Manajemen Risiko ───────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 items-start">
            <Card>
              <SectionHeader icon={Target} title="Level Penting" />
              <div className="space-y-1.5">
                {resistanceLevels.map((r) => (
                  <LevelRow key={r.label} label={r.label} price={r.price} tone="up" distancePct={((r.price - summary.lastClose) / summary.lastClose) * 100} />
                ))}
                <LevelRow label="HARGA SEKARANG" price={summary.lastClose} tone="flat" highlight />
                {supportLevels.map((s) => (
                  <LevelRow key={s.label} label={s.label} price={s.price} tone="down" distancePct={((s.price - summary.lastClose) / summary.lastClose) * 100} />
                ))}
              </div>
            </Card>

            <Card>
              <SectionHeader icon={ShieldAlert} title="Manajemen Risiko" />
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-2.5 mb-3">
                <ConditionChip label="Risk Level" value={riskLevel.label} tone={riskLevel.tone} />
                <ConditionChip label="Chasing Risk" value={chasingRisk.label} tone={chasingRisk.tone} />
                <ConditionChip label="Breakdown Risk" value={breakdownRiskFlag ? 'Terdeteksi' : 'Tidak Terdeteksi'} tone={breakdownRiskFlag ? 'red' : 'green'} />
              </div>
              <div className="neo-border border-zinc-200 dark:border-zinc-700 px-3 py-2.5 mb-3">
                <span className="text-[11px] font-bold uppercase text-zinc-400 block mb-0.5">Area Invalidasi</span>
                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{decision.scenario.invalidationRule}</p>
              </div>
              <div className="flex gap-2.5 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed neo-border border-zinc-200 dark:border-zinc-700 px-3 py-2.5">
                <Flame className="size-3.5 shrink-0 text-zinc-400 mt-0.5" strokeWidth={2.5} />
                <p><strong className="text-zinc-700 dark:text-zinc-300">Catatan disiplin:</strong> selalu gunakan stop loss dan ukuran posisi yang wajar. Tidak ada indikator yang 100% akurat — analisis ini bukan jaminan/janji keuntungan, kelola risiko sendiri sebelum mengambil keputusan.</p>
              </div>
            </Card>
          </div>

          {/* ── 6. Indikator / Status (checklist) ────────────────────────── */}
          <Card>
            <SectionHeader icon={CheckCircle2} title="Indikator / Status" />
            <div>
              <ChecklistRow label="Trend" tone={trend.tone} value={trend.label} />
              <ChecklistRow label="Momentum" tone={momentum.tone} value={momentum.label} />
              <ChecklistRow label="Volume" tone={volumeCond.tone} value={volumeCond.label} />
              <ChecklistRow label="RSI / Stochastic" tone={indicators.rsiZone === 'overbought' || indicators.rsiZone === 'overbought_risk' ? 'red' : indicators.rsiZone === 'oversold' ? 'amber' : 'green'} value={fmtN(indicators.rsi14)} />
              <ChecklistRow label="MACD" tone={indicators.macdSignalType.includes('bullish') ? 'green' : indicators.macdSignalType.includes('bearish') ? 'red' : 'amber'} value={indicators.macdSignalType.replace('_', ' ')} />
              <ChecklistRow label="Foreign Flow" tone={foreignFlow.tone} value={foreignFlow.label} />
              <ChecklistRow label="Accumulation/Distribution" tone={adTone} value={decision.bandarScore.classification.label} />
            </div>
          </Card>

          {/* ── 7. Skenario Intraday ─────────────────────────────────────── */}
          <div>
            <SectionHeader icon={Waves} title="Skenario Intraday" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {scenarios.map((s) => <ScenarioCard key={s.type} scenario={s} />)}
            </div>
          </div>

          <p className="text-[11px] text-zinc-400 text-center pt-2">
            {SITE_NAME} — Analisis ini bukan rekomendasi beli/jual dan bukan jaminan keuntungan. Selalu terapkan manajemen risiko sendiri.
          </p>
        </div>

        {/* ── RIGHT SIDEBAR — Analisis Lanjutan ───────────────────────────── */}
        <aside className="space-y-2.5 lg:sticky lg:top-20">
          <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 px-1">Analisis Lanjutan</h2>

          <Collapse title="Rencana Trading" icon={Target}>
            <div className="grid grid-cols-1 sm:grid-cols-1 gap-3">
              <ScenarioMiniCard scenario={analysis.tradingPlan.bullish} isBias={analysis.tradingPlan.recommendedBias === 'bullish'} />
              {/* <ScenarioMiniCard scenario={analysis.tradingPlan.bearish} isBias={analysis.tradingPlan.recommendedBias === 'bearish'} /> */}
            </div>
            {riskGate.reasons.length > 0 && (
              <div className="pt-2 border-t-2 border-(--neo-line) space-y-1">
                <p className="text-[11px] font-bold uppercase text-zinc-400">Catatan Risk Gate</p>
                {riskGate.reasons.map((r) => (
                  <p key={r} className="text-xs text-zinc-500 dark:text-zinc-400 flex gap-1.5"><span className="shrink-0 opacity-40">•</span>{r}</p>
                ))}
              </div>
            )}
          </Collapse>

          {(brokerActivityLoading || brokerActivity) && (
            <Collapse title="Broker Summary & Foreign Flow (Detail)" icon={BarChart2}>
              {brokerActivityLoading && (
                <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400"><Loader2 className="size-3.5 animate-spin" strokeWidth={2.5} /> Memuat data broker riil…</div>
              )}
              {!brokerActivityLoading && brokerActivity && (
                <>
                  <p className="text-[11px] text-zinc-400">{brokerActivity.rangeFrom} – {brokerActivity.rangeTo} · via Index Alpha</p>
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">Top Net Buyer</p>
                      {brokerActivity.topBuyers.length > 0 ? brokerActivity.topBuyers.map((r) => <BrokerRow key={r.code} row={r} tone="green" />) : <p className="text-[11px] text-zinc-400">–</p>}
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-bold uppercase text-rose-600 dark:text-rose-400">Top Net Seller</p>
                      {brokerActivity.topSellers.length > 0 ? brokerActivity.topSellers.map((r) => <BrokerRow key={r.code} row={r} tone="red" />) : <p className="text-[11px] text-zinc-400">–</p>}
                    </div>
                  </div>
                </>
              )}
            </Collapse>
          )}

          <Collapse title="Fundamental" icon={Activity}>
            <MiniKV label="PER" value={summary.per > 0 ? `${summary.per.toFixed(1)}×` : '–'} />
            <MiniKV label="PBV" value={summary.pbv > 0 ? `${summary.pbv.toFixed(2)}×` : '–'} />
            <MiniKV label="ROE" value={`${summary.roe.toFixed(1)}%`} />
            <MiniKV label="Market Cap" value={formatCompact(summary.capitalization)} />
            <MiniKV label="Skor Fundamental" value={`${fundamentalScreening.score}/100`} />
            {fundamentalsLoading && <p className="text-xs text-zinc-400">Memuat detail fundamental…</p>}
            {fundamentals && (
              <>
                <MiniKV label="DER" value={der != null ? `${der.toFixed(0)}%` : '–'} />
                <MiniKV label="Dividend Yield" value={fundamentals.dividendYield != null ? `${fundamentals.dividendYield.toFixed(2)}%` : '–'} />
                <MiniKV label="Net Margin" value={fundamentals.netMargin != null ? `${fundamentals.netMargin.toFixed(1)}%` : '–'} />
              </>
            )}
          </Collapse>

          {relevantNews.length > 0 && (
            <Collapse title="Berita & Sentimen" icon={Sparkles}>
              {relevantNews.map((n) => <NewsRow key={n.id} item={n} />)}
            </Collapse>
          )}

          {gatedAdvisor && (
            <Collapse title="AI Stock Advisor (Composite)" icon={Sparkles}>
              <MiniKV label="Verdict" value={gatedAdvisor.verdictLabel} />
              <MiniKV label="Confidence" value={`${gatedAdvisor.confidenceScore}%`} />
              <MiniKV label="Fundamental / Teknikal / News / Breakout" value={`${gatedAdvisor.fundamentalScore} / ${gatedAdvisor.technicalScore} / ${gatedAdvisor.newsScore} / ${gatedAdvisor.breakoutScore}`} />
              <div className="pt-2 border-t-2 border-(--neo-line) space-y-1">
                {gatedAdvisor.buyReasons.slice(0, 3).map((r, i) => <p key={i} className="text-xs text-zinc-600 dark:text-zinc-300 flex gap-1.5"><span className="text-emerald-500 font-bold">✓</span>{r}</p>)}
                {gatedAdvisor.avoidReasons.slice(0, 3).map((r, i) => <p key={i} className="text-xs text-zinc-600 dark:text-zinc-300 flex gap-1.5"><span className="text-rose-500 font-bold">⚠</span>{r}</p>)}
              </div>
            </Collapse>
          )}
        </aside>

      </main>
    </div>
  );
}
