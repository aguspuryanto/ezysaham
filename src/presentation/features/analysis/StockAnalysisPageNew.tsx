'use client';

/**
 * StockAnalysisPageNew.tsx
 *
 * "EzySaham 10-Second Review" — a beginner-first redesign of the stock detail
 * page. Same engine/data as StockAnalysisPage.tsx (useStockAnalysis + the
 * riskGate/quickDecisionSnapshot/bandarScore pipeline), just presented so a
 * beginner can read status → why → what to wait for in ~10 seconds. Every
 * deep-dive metric (EMA/RSI/MACD/Wyckoff/Broker Summary/Fundamental/News)
 * still exists — it's moved into the collapsible "Analisis Lanjutan" section
 * at the bottom instead of being shown up front.
 */

import {
  AlertTriangle,
  ArrowLeft,
  BarChart2,
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  ChevronDown,
  Clock,
  Crosshair,
  Eye,
  Flame,
  Loader2,
  Minus,
  NotebookPen,
  RefreshCw,
  Rocket,
  Share2,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  XCircle,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { cn, formatCompact, formatPercent, formatRupiah } from '@/lib/format';
import { SITE_NAME } from '@/lib/site';
import { IndicatorAnalysis, PriceLevel, TradeScenario } from '@/domain/models/StockAnalysis';
import { BrokerSummaryRow } from '@/domain/models/BrokerSummary';
import { StockNewsItem } from '@/domain/models/News';
import {
  classifyRsiOverbought,
  classifyRvol,
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
import { computeTechnicalScore } from '@/domain/analysis/technicalScore';
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

// ─── Tone → Tailwind maps (shared by every small badge/card below) ────────────
const TONE_BG: Record<Tone, string> = {
  green: 'bg-emerald-500',
  red: 'bg-rose-500',
  amber: 'bg-amber-400',
  blue: 'bg-blue-500',
  zinc: 'bg-zinc-400',
};
const TONE_SOFT_BG: Record<Tone, string> = {
  green: 'bg-emerald-50 dark:bg-emerald-500/10',
  red: 'bg-rose-50 dark:bg-rose-500/10',
  amber: 'bg-amber-50 dark:bg-amber-500/10',
  blue: 'bg-blue-50 dark:bg-blue-500/10',
  zinc: 'bg-zinc-100 dark:bg-zinc-800/60',
};
const TONE_TEXT: Record<Tone, string> = {
  green: 'text-emerald-700 dark:text-emerald-400',
  red: 'text-rose-700 dark:text-rose-400',
  amber: 'text-amber-700 dark:text-amber-400',
  blue: 'text-blue-700 dark:text-blue-400',
  zinc: 'text-zinc-600 dark:text-zinc-400',
};

const STATUS_CONFIG: Record<SimpleStatus, { label: string; tone: Tone; icon: typeof Rocket; blurb: string }> = {
  BUY_SETUP: { label: 'BUY SETUP', tone: 'green', icon: Rocket, blurb: 'Kondisi teknikal mendukung — siap dieksekusi sesuai rencana & stop loss.' },
  WATCHLIST: { label: 'WATCHLIST', tone: 'blue', icon: Eye, blurb: 'Berpotensi bagus, tapi harga belum di titik masuk ideal — pantau dulu.' },
  WAIT: { label: 'WAIT', tone: 'amber', icon: Clock, blurb: 'Sinyal belum cukup kuat atau harga belum di posisi ideal — tunggu konfirmasi.' },
  NO_TRADE: { label: 'NO TRADE', tone: 'red', icon: XCircle, blurb: 'Risiko lebih besar dari peluang saat ini — sebaiknya dihindari dulu.' },
};

/** BUY maps 1:1. SHORT_SETUP is a bearish/short-only setup — this app's beginner view is long-only,
 * so it reads as WAIT rather than instructing a beginner to short. WAIT_FOR_PULLBACK means the setup
 * is real but price ran ahead of the entry zone — that's exactly what "keep watching" means. */
function deriveSimpleStatus(tradeStatus: TradeStatus): SimpleStatus {
  switch (tradeStatus) {
    case 'BUY': return 'BUY_SETUP';
    case 'WAIT_FOR_PULLBACK': return 'WATCHLIST';
    case 'SHORT_SETUP': return 'WAIT';
    case 'NO_TRADE': return 'NO_TRADE';
    default: return 'WAIT';
  }
}

function classifyTrend(trend: 'bullish' | 'bearish' | 'sideways'): { label: string; tone: Tone; icon: typeof TrendingUp } {
  if (trend === 'bullish') return { label: 'Bullish', tone: 'green', icon: TrendingUp };
  if (trend === 'bearish') return { label: 'Bearish', tone: 'red', icon: TrendingDown };
  return { label: 'Sideways', tone: 'amber', icon: Minus };
}

function classifyMomentum(indicators: IndicatorAnalysis): { label: string; tone: Tone } {
  let score = 0;
  if (indicators.macdSignalType === 'bullish_crossover') score += 2;
  else if (indicators.macdSignalType === 'bullish') score += 1;
  else if (indicators.macdSignalType === 'bearish_crossover') score -= 2;
  else if (indicators.macdSignalType === 'bearish') score -= 1;
  if (indicators.rsi14 >= 55) score += 1;
  else if (indicators.rsi14 <= 45) score -= 1;

  if (score >= 2) return { label: 'Strong', tone: 'green' };
  if (score <= -2) return { label: 'Weak', tone: 'red' };
  return { label: 'Neutral', tone: 'amber' };
}

function classifyVolumeSimple(relativeVolume: number): { label: string; tone: Tone } {
  const rvol = classifyRvol(relativeVolume);
  if (rvol.tier === 'NO_DATA') return { label: 'N/A', tone: 'zinc' };
  if (rvol.tier === 'HIGH' || rvol.tier === 'VERY_HIGH' || rvol.tier === 'ELEVATED') return { label: 'High', tone: 'blue' };
  if (rvol.tier === 'NORMAL') return { label: 'Normal', tone: 'zinc' };
  return { label: 'Low', tone: 'amber' };
}

function classifyPosition(price: number, support?: number, resistance?: number): { label: string; tone: Tone } {
  if (!support && !resistance) return { label: 'Tidak diketahui', tone: 'zinc' };
  const distSupportPct = support ? ((price - support) / price) * 100 : Infinity;
  const distResistancePct = resistance ? ((resistance - price) / price) * 100 : Infinity;
  if (support && distSupportPct <= 3) return { label: 'Near Support', tone: 'green' };
  if (resistance && distResistancePct <= 3) return { label: 'Near Resistance', tone: 'amber' };
  return { label: 'Middle', tone: 'zinc' };
}

function buildKesimpulan(params: {
  ticker: string;
  simpleStatus: SimpleStatus;
  trendLabel: string;
  momentumLabel: string;
}): string {
  const { ticker, simpleStatus, trendLabel, momentumLabel } = params;
  const trendPhrase =
    trendLabel === 'Bullish' ? 'sedang tren naik' : trendLabel === 'Bearish' ? 'sedang tren turun' : 'sedang bergerak mendatar';
  const base = `${ticker} ${trendPhrase} dengan momentum ${momentumLabel.toLowerCase()}`;
  switch (simpleStatus) {
    case 'BUY_SETUP':
      return `${base}, dan harga saat ini ada di titik masuk yang terkonfirmasi — kondisi ini tergolong BUY SETUP. Tetap pakai stop loss untuk menjaga risiko.`;
    case 'WATCHLIST':
      return `${base}, tapi harga masih terlalu jauh dari area entry ideal — masukkan ke WATCHLIST dan tunggu pullback.`;
    case 'WAIT':
      return `${base}, namun sinyal belum cukup kuat untuk masuk sekarang — sebaiknya WAIT dan pantau perkembangan berikutnya.`;
    case 'NO_TRADE':
      return `${base}, tapi ada beberapa sinyal risiko yang menumpuk — untuk saat ini kondisinya NO TRADE, sebaiknya dihindari dulu.`;
  }
}

function buildReasons(params: {
  trendLabel: string;
  momentumLabel: string;
  simpleStatus: SimpleStatus;
  positionLabel: string;
  nearestSupport?: number;
  nearestResistance?: number;
  riskReasonCount: number;
}): string[] {
  const { trendLabel, momentumLabel, simpleStatus, positionLabel, nearestSupport, nearestResistance, riskReasonCount } = params;
  const reasons: string[] = [];

  if (trendLabel === 'Bullish') reasons.push('Tren harga sedang naik — harga bergerak di atas rata-rata pergerakan jangka menengah (EMA).');
  else if (trendLabel === 'Bearish') reasons.push('Tren harga sedang turun — harga bergerak di bawah rata-rata pergerakan jangka menengah, tekanan jual masih dominan.');
  else reasons.push('Tren harga sedang mendatar — belum ada arah yang jelas, harga bergerak dalam rentang sempit.');

  if (momentumLabel === 'Strong') reasons.push('Momentum kuat — indikator MACD & RSI menunjukkan tekanan beli yang sehat.');
  else if (momentumLabel === 'Weak') reasons.push('Momentum lemah — indikator MACD & RSI belum menunjukkan tekanan beli yang cukup.');
  else reasons.push('Momentum netral — sinyal MACD & RSI belum satu arah, masih menunggu konfirmasi.');

  if (simpleStatus === 'NO_TRADE' && riskReasonCount > 0) {
    reasons.push(`Ada ${riskReasonCount} sinyal risiko yang menumpuk (lihat "Analisis Lanjutan") — sebaiknya dihindari dulu sampai kondisinya lebih jelas.`);
  } else if (positionLabel === 'Near Resistance' && nearestResistance) {
    reasons.push(`Harga sudah dekat area resistance ${fmtRp(nearestResistance)} — ruang naik terbatas sebelum breakout benar-benar terkonfirmasi.`);
  } else if (positionLabel === 'Near Support' && nearestSupport) {
    reasons.push(`Harga berada dekat area support ${fmtRp(nearestSupport)} — area ini biasanya jadi titik pantul kalau minat beli muncul.`);
  } else if (nearestSupport && nearestResistance) {
    reasons.push(`Harga masih di tengah antara support ${fmtRp(nearestSupport)} dan resistance ${fmtRp(nearestResistance)} — belum di titik entry yang ideal.`);
  } else {
    reasons.push('Level support/resistance belum cukup jelas untuk area saham ini — gunakan ukuran posisi yang kecil.');
  }

  return reasons.slice(0, 3);
}

interface TriggerItem {
  label: string;
  detail: string;
}

function buildTriggers(params: {
  simpleStatus: SimpleStatus;
  isLong: boolean;
  zoneStatus: ZoneStatus;
  entryConfirmed: boolean;
  setupInvalidated: boolean;
  entryZoneLow: number;
  nearestResistance?: number;
  relativeVolume: number;
  scenario: TradeScenario;
}): TriggerItem[] {
  const { simpleStatus, zoneStatus, entryConfirmed, setupInvalidated, entryZoneLow, nearestResistance, relativeVolume, scenario } = params;
  const items: TriggerItem[] = [];

  if (simpleStatus === 'BUY_SETUP') {
    items.push({ label: 'Jaga Stop Loss', detail: `Kalau harga closing tembus di bawah ${fmtRp(scenario.sl)}, keluar untuk membatasi kerugian.` });
    items.push({ label: 'Ambil Untung Bertahap', detail: `Rencana take profit di ${fmtRp(scenario.tp1)} (TP1) dan ${fmtRp(scenario.tp2)} (TP2).` });
    return items;
  }

  if (setupInvalidated) {
    items.push({ label: 'Tunggu Setup Baru', detail: 'Setup saat ini sudah tidak valid (harga sudah tembus batas risiko) — tunggu struktur harga baru terbentuk sebelum mempertimbangkan masuk lagi.' });
    return items;
  }

  if (zoneStatus === 'ABOVE_ZONE') {
    items.push({ label: 'Pullback ke Support', detail: `Tunggu harga turun mendekati area ${fmtRp(entryZoneLow)} — jangan mengejar harga di posisi sekarang (chasing).` });
  } else if (!entryConfirmed) {
    items.push({ label: 'Konfirmasi Candle & Volume', detail: 'Tunggu candle penutupan hijau (reversal) disertai volume di atas rata-rata sebelum masuk.' });
  }

  if (nearestResistance) {
    items.push({ label: 'Breakout Resistance', detail: `Atau tunggu harga menembus (breakout) ${fmtRp(nearestResistance)} dengan volume tinggi sebagai konfirmasi kekuatan naik.` });
  }

  if (relativeVolume < 1) {
    items.push({ label: 'Volume Meningkat', detail: 'Tunggu volume transaksi naik di atas rata-rata 20 hari sebagai tanda minat beli yang nyata.' });
  }

  if (items.length === 0) {
    items.push({ label: 'Pantau Perkembangan', detail: 'Belum ada trigger spesifik — pantau berita & pergerakan harga beberapa hari ke depan.' });
  }

  return items.slice(0, 3);
}

// ─── Small building blocks ─────────────────────────────────────────────────────
function Badge({ tone, children, className }: { tone: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold neo-border', TONE_SOFT_BG[tone], TONE_TEXT[tone], className)}>
      {children}
    </span>
  );
}

function IndicatorCard({ icon: Icon, label, value, tone }: { icon: typeof TrendingUp; label: string; value: string; tone: Tone }) {
  return (
    <div className="neo-border bg-white dark:bg-zinc-900 p-3 flex flex-col gap-2">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
        <Icon className="size-3.5" strokeWidth={2.5} />
        {label}
      </div>
      <span className={cn('inline-flex w-fit items-center px-2 py-1 text-sm font-bold neo-border', TONE_SOFT_BG[tone], TONE_TEXT[tone])}>
        {value}
      </span>
    </div>
  );
}

function Collapse({
  title,
  icon: Icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: typeof BarChart2;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="neo-border bg-white dark:bg-zinc-900 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-left border-b-2 border-transparent data-[open=true]:border-(--neo-line)"
        data-open={open}
      >
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
      <div className="flex items-center justify-between">
        <span className={cn('text-xs font-bold uppercase', isLong ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400')}>
          {isLong ? 'Skenario Bullish' : 'Skenario Bearish'} {isBias && '· Rekomendasi'}
        </span>
        <span className="text-[10px] font-mono text-zinc-400">R:R 1:{fmtN(scenario.riskRewardRatio, 1)}</span>
      </div>
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
        <Badge tone={tone} className="shrink-0">{item.sentiment}</Badge>
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

// ─── Support & Resistance visual ────────────────────────────────────────────────
function SupportResistanceVisual({ price, support, resistance }: { price: number; support?: PriceLevel; resistance?: PriceLevel }) {
  if (!support && !resistance) {
    return <p className="text-sm text-zinc-400">Level support/resistance belum teridentifikasi untuk saham ini.</p>;
  }
  const top = resistance ? resistance.price : price * 1.05;
  const bottom = support ? support.price : price * 0.95;
  const range = Math.max(top - bottom, 1);
  const pricePct = Math.min(96, Math.max(4, ((top - price) / range) * 100));

  return (
    <div className="space-y-0">
      <div className="flex items-center justify-between px-1 pb-1.5">
        <span className="text-[11px] font-bold uppercase text-amber-600 dark:text-amber-400">Resistance</span>
        <span className="font-mono text-sm font-bold text-zinc-800 dark:text-zinc-200">{resistance ? fmtRp(resistance.price) : '–'}</span>
      </div>
      <div className="relative h-32 neo-border bg-gradient-to-b from-amber-100 via-zinc-50 to-emerald-100 dark:from-amber-500/10 dark:via-zinc-800/40 dark:to-emerald-500/10">
        <div className="absolute inset-x-0 flex items-center gap-2 px-2" style={{ top: `${pricePct}%`, transform: 'translateY(-50%)' }}>
          <div className="h-0.5 flex-1 bg-zinc-800 dark:bg-zinc-200" />
          <span className="shrink-0 neo-border neo-shadow-sm bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 px-2 py-0.5 text-xs font-mono font-bold whitespace-nowrap">
            {fmtRp(price)}
          </span>
          <div className="h-0.5 flex-1 bg-zinc-800 dark:bg-zinc-200" />
        </div>
      </div>
      <div className="flex items-center justify-between px-1 pt-1.5">
        <span className="text-[11px] font-bold uppercase text-emerald-600 dark:text-emerald-400">Support</span>
        <span className="font-mono text-sm font-bold text-zinc-800 dark:text-zinc-200">{support ? fmtRp(support.price) : '–'}</span>
      </div>
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
export function StockAnalysisPageNew({ ticker }: { ticker: string }) {
  const {
    status,
    summary,
    analysis,
    bars,
    advisor,
    fundamentalScreening,
    technicalScreening,
    fundamentals,
    fundamentalsLoading,
    brokerActivity,
    brokerActivityLoading,
    newsItems,
    freshness,
    reload,
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
        ticker: summary.ticker,
        presetId: null,
        entry: scenario.entry,
        tp1: scenario.tp1,
        tp2: scenario.tp2,
        sl: scenario.sl,
        riskRewardPlanned: scenario.riskRewardRatio,
        reasonBuy: analysis.conclusion.summary,
        reasonAvoid: analysis.conclusion.watchOut,
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
    try {
      await navigator.clipboard.writeText(url);
      setJustCopied(true);
      setTimeout(() => setJustCopied(false), 2000);
    } catch { /* clipboard unavailable */ }
  }, [summary]);

  // ── Decision pipeline: identical inputs/order to StockAnalysisPage.tsx's quickDecisionSnapshot
  // memo, kept self-contained here so this component never has to import non-exported internals
  // from that file. See riskGate.ts / quickDecisionSnapshot.ts for why each field exists.
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
      priceAtEntryTrigger,
      setupInvalidated,
      trendValid: isLong ? analysis.trendEma.trend !== 'bearish' : analysis.trendEma.trend !== 'bullish',
      reversalConfirmed: isLong ? bullishReversalCandle : bearishReversalCandle,
      volumeSupportive: analysis.volume.relativeVolume >= 1,
    });
    const riskGate = evaluateRiskGate({
      direction: scenario.direction,
      trend: analysis.trendEma.trend,
      rsi14: analysis.indicators.rsi14,
      fundamentalScore: fundamentalScreening.score,
      isStrongDistribution,
      priceBelowEma50: price <= analysis.trendEma.ema50,
      priceBelowEma200: price <= analysis.trendEma.ema200,
      priceAtEntryTrigger,
      setupInvalidated,
      entryConfirmed,
      extremeDistanceWarning: scenario.extremeDistanceWarning,
      isDistributionRisk,
      zoneStatus,
      der,
      roe: summary.roe,
    });
    const hasSetupErrors = scenario.validationErrors.length > 0;
    const tradeStatus: TradeStatus = hasSetupErrors ? 'NO_TRADE' : riskGate.tradeStatus;
    const buyPermission: BuyPermission = hasSetupErrors ? 'FALSE' : riskGate.buyPermission;

    const snapshot = computeQuickDecisionSnapshot({
      bars,
      trendEma: analysis.trendEma,
      indicators: analysis.indicators,
      volume: analysis.volume,
      supportResistance: analysis.supportResistance,
      bandarScore,
      marketCyclePhase,
      entryTiming,
      tradeStatus,
      buyPermission,
      riskGateReasons: riskGate.reasons,
    });

    return {
      bandarScore, marketCyclePhase, entryTiming, scenario, isLong, price,
      priceAtEntryTrigger, setupInvalidated, nearestSupport, nearestResistance,
      entryZoneLow, zoneStatus, entryConfirmed, riskGate, tradeStatus, buyPermission, snapshot,
    };
  }, [summary, bars, analysis, fundamentals, fundamentalScreening]);

  const gatedAdvisor = useMemo(() => {
    if (!advisor || !decision) return advisor;
    return gateAdvisorVerdict(advisor, decision.tradeStatus);
  }, [advisor, decision]);

  const technicalScore = useMemo(() => {
    if (!summary || !analysis) return null;
    return computeTechnicalScore(summary.lastClose, analysis.trendEma, analysis.indicators, analysis.volume);
  }, [summary, analysis]);

  if (status === 'loading') return <LoadingState ticker={ticker} />;
  if (status === 'error' || !analysis || !summary || !fundamentalScreening || !technicalScreening || !decision) {
    return <ErrorState ticker={ticker} />;
  }

  const { trendEma, supportResistance, indicators, volume } = analysis;
  const { nearestSupport, nearestResistance, scenario, isLong, riskGate, entryConfirmed, zoneStatus, entryZoneLow, setupInvalidated } = decision;
  const positiveDay = summary.percentChange1D >= 0;
  const isWatched = watchlist.has(summary.ticker);

  const simpleStatus = deriveSimpleStatus(decision.tradeStatus);
  const statusCfg = STATUS_CONFIG[simpleStatus];
  const trendInfo = classifyTrend(trendEma.trend);
  const momentumInfo = classifyMomentum(indicators);
  const volumeInfo = classifyVolumeSimple(volume.relativeVolume);
  const positionInfo = classifyPosition(summary.lastClose, nearestSupport?.price, nearestResistance?.price);

  const kesimpulan = buildKesimpulan({ ticker: summary.ticker, simpleStatus, trendLabel: trendInfo.label, momentumLabel: momentumInfo.label });
  const reasons = buildReasons({
    trendLabel: trendInfo.label,
    momentumLabel: momentumInfo.label,
    simpleStatus,
    positionLabel: positionInfo.label,
    nearestSupport: nearestSupport?.price,
    nearestResistance: nearestResistance?.price,
    riskReasonCount: riskGate.reasons.length,
  });
  const triggers = buildTriggers({
    simpleStatus,
    isLong,
    zoneStatus,
    entryConfirmed,
    setupInvalidated,
    entryZoneLow,
    nearestResistance: nearestResistance?.price,
    relativeVolume: volume.relativeVolume,
    scenario,
  });

  const rsiOverbought = classifyRsiOverbought(indicators.rsi14);
  const chasingRisk = rsiOverbought.chasingRisk === 'HIGH' || rsiOverbought.chasingRisk === 'VERY_HIGH';
  const breakdownRisk = setupInvalidated || decision.bandarScore.phase === 'markdown' ||
    (trendEma.trend === 'bearish' && nearestSupport != null && summary.lastClose < nearestSupport.price);

  const relevantNews = newsItems.filter((n) => n.relevance !== 'UNRELATED').slice(0, 6);
  const der = fundamentals?.debtToEquity ?? null;

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

      {/* ── LEFT / MAIN COLUMN — the 10-second review ───────────────────── */}
      <div className="min-w-0 space-y-4">

        {freshness && <DataFreshnessStaleBanner freshness={freshness} />}

        {/* ── 1. Stock Header ─────────────────────────────────────────── */}
        <div className="neo-border neo-shadow bg-white dark:bg-zinc-900 p-4 sm:p-5 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100 leading-tight truncate">{summary.name}</h1>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500">{summary.ticker}</span>
                {summary.sector && (<><span className="text-zinc-300 dark:text-zinc-700">·</span><span className="text-xs font-medium text-zinc-400 dark:text-zinc-500">{summary.sector}</span></>)}
                {freshness && <DataFreshnessPill freshness={freshness} />}
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button type="button" onClick={handleShare} className="neo-press flex items-center gap-1 px-2.5 py-1.5 neo-border neo-shadow-sm bg-white text-xs font-bold text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 rounded-lg">
                <Share2 className="size-3.5" strokeWidth={2.5} /><span className="hidden sm:inline">{justCopied ? 'Disalin!' : 'Bagikan'}</span>
              </button>
              <button type="button" onClick={() => watchlist.toggle(summary.ticker)}
                className={cn('neo-press flex items-center gap-1 px-2.5 py-1.5 neo-border neo-shadow-sm text-xs font-bold rounded-lg', isWatched ? 'bg-amber-300 text-black' : 'bg-white text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300')}>
                {isWatched ? <BookmarkCheck className="size-3.5" strokeWidth={2.5} /> : <Bookmark className="size-3.5" strokeWidth={2.5} />}
                <span className="hidden sm:inline">{isWatched ? 'Watching' : 'Watch'}</span>
              </button>
            </div>
          </div>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-mono text-3xl sm:text-4xl font-bold tabular-nums text-zinc-900 dark:text-zinc-100">{formatRupiah(summary.lastClose)}</span>
            <span className={cn('inline-flex items-center gap-1 text-base font-mono tabular-nums font-bold', positiveDay ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
              {positiveDay ? <TrendingUp className="size-5" strokeWidth={2.5} /> : <TrendingDown className="size-5" strokeWidth={2.5} />}
              {formatPercent(summary.percentChange1D)}
            </span>
          </div>
        </div>

        {/* ── 9. Chart Candlestick ────────────────────────────────────── */}
        {bars.length > 0 && (
          <div className="neo-border neo-shadow overflow-hidden">
            <OHLCVChart bars={bars} currentClose={summary.lastClose} ticker={summary.ticker} prevClose={summary.prevClose} />
          </div>
        )}

        {/* ── 2. Status Utama ─────────────────────────────────────────── */}
        <div className={cn('neo-border neo-shadow p-5 flex items-center gap-4', TONE_SOFT_BG[statusCfg.tone])}>
          <span className={cn('flex size-14 shrink-0 items-center justify-center neo-border text-white', TONE_BG[statusCfg.tone])}>
            <statusCfg.icon className="size-7" strokeWidth={2.5} />
          </span>
          <div className="min-w-0">
            <span className={cn('text-2xl sm:text-3xl font-black tracking-tight', TONE_TEXT[statusCfg.tone])}>{statusCfg.label}</span>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-snug mt-0.5">{statusCfg.blurb}</p>
          </div>
        </div>

        {/* ── 3. 4 Indikator Sederhana ────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-2.5">
          <IndicatorCard icon={trendInfo.icon} label="Trend" value={trendInfo.label} tone={trendInfo.tone} />
          <IndicatorCard icon={Zap} label="Momentum" value={momentumInfo.label} tone={momentumInfo.tone} />
          <IndicatorCard icon={BarChart2} label="Volume" value={volumeInfo.label} tone={volumeInfo.tone} />
          <IndicatorCard icon={Crosshair} label="Position" value={positionInfo.label} tone={positionInfo.tone} />
        </div>

        {/* ── 4. Kesimpulan 10 Detik ──────────────────────────────────── */}
        <div className="neo-border neo-shadow bg-white dark:bg-zinc-900 p-4 sm:p-5">
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles className="size-4 text-emerald-500" strokeWidth={2.5} />
            <h2 className="text-xs font-bold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Kesimpulan 10 Detik</h2>
          </div>
          <p className="text-base font-semibold text-zinc-800 dark:text-zinc-100 leading-relaxed">{kesimpulan}</p>
        </div>

        {/* ── 5. Kenapa? ──────────────────────────────────────────────── */}
        <div className="neo-border neo-shadow bg-white dark:bg-zinc-900 p-4 sm:p-5">
          <h2 className="text-xs font-bold uppercase tracking-wide text-zinc-400 dark:text-zinc-500 mb-3">Kenapa?</h2>
          <ul className="space-y-2.5">
            {reasons.map((reason, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                <span className="shrink-0 flex size-5 items-center justify-center neo-border bg-zinc-100 dark:bg-zinc-800 text-[11px] font-bold text-zinc-500 mt-0.5">{i + 1}</span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* ── 6. Yang Perlu Ditunggu ──────────────────────────────────── */}
        <div className="neo-border neo-shadow bg-white dark:bg-zinc-900 p-4 sm:p-5">
          <div className="flex items-center gap-1.5 mb-3">
            <Clock className="size-4 text-blue-500" strokeWidth={2.5} />
            <h2 className="text-xs font-bold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Yang Perlu Ditunggu</h2>
          </div>
          <ul className="space-y-3">
            {triggers.map((t, i) => (
              <li key={i} className="flex gap-2.5">
                <Target className="size-4 shrink-0 text-blue-500 mt-0.5" strokeWidth={2.5} />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-zinc-800 dark:text-zinc-100">{t.label}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed mt-0.5">{t.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* ── 7. Support & Resistance ─────────────────────────────────── */}
        <div className="neo-border neo-shadow bg-white dark:bg-zinc-900 p-4 sm:p-5">
          <h2 className="text-xs font-bold uppercase tracking-wide text-zinc-400 dark:text-zinc-500 mb-3">Support &amp; Resistance</h2>
          <SupportResistanceVisual price={summary.lastClose} support={nearestSupport} resistance={nearestResistance} />
        </div>

        {/* ── 8. Warning ──────────────────────────────────────────────── */}
        {(chasingRisk || breakdownRisk) && (
          <div className="space-y-2.5">
            {chasingRisk && (
              <div className="neo-border bg-orange-50 dark:bg-orange-500/10 px-4 py-3 flex gap-2.5">
                <Flame className="size-4 shrink-0 text-orange-500 mt-0.5" strokeWidth={2.5} />
                <div>
                  <p className="text-sm font-bold text-orange-700 dark:text-orange-400">Chasing Risk</p>
                  <p className="text-xs text-orange-600 dark:text-orange-400 leading-relaxed mt-0.5">
                    RSI {fmtN(indicators.rsi14)} sudah overbought — harga sudah naik cukup jauh. Membeli sekarang berisiko &ldquo;beli di puncak&rdquo;, bukan sinyal jual otomatis, tapi hindari mengejar harga.
                  </p>
                </div>
              </div>
            )}
            {breakdownRisk && (
              <div className="neo-border bg-rose-50 dark:bg-rose-500/10 px-4 py-3 flex gap-2.5">
                <ShieldAlert className="size-4 shrink-0 text-rose-500 mt-0.5" strokeWidth={2.5} />
                <div>
                  <p className="text-sm font-bold text-rose-700 dark:text-rose-400">Breakdown Risk</p>
                  <p className="text-xs text-rose-600 dark:text-rose-400 leading-relaxed mt-0.5">
                    Struktur harga menunjukkan tekanan turun lanjutan{nearestSupport ? ` di bawah support ${fmtRp(nearestSupport.price)}` : ''} — waspadai potensi penurunan lebih dalam sebelum masuk.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        <p className="text-[11px] text-zinc-400 text-center pt-2 lg:hidden">
          {SITE_NAME} — Analisis ini bukan rekomendasi beli/jual. Selalu terapkan manajemen risiko sendiri.
        </p>
      </div>

      {/* ── RIGHT SIDEBAR — Analisis Lanjutan ───────────────────────────── */}
      <aside className="space-y-2.5 lg:sticky lg:top-20 lg:pb-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 px-1">Analisis Lanjutan</h2>

          <Collapse title="Trend & EMA" icon={TrendingUp}>
            <MiniKV label="EMA 20" value={fmtRp(trendEma.ema20)} />
            <MiniKV label="EMA 50" value={fmtRp(trendEma.ema50)} />
            <MiniKV label="EMA 200" value={fmtRp(trendEma.ema200)} />
            <MiniKV label="Harga vs EMA20" value={trendEma.priceVsEma20} />
            <MiniKV label="Higher Lows" value={trendEma.higherLows ? 'Ya' : 'Belum'} />
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed pt-1">{trendEma.trendDescription}</p>
          </Collapse>

          <Collapse title="RSI, MACD & Stochastic" icon={Zap}>
            <MiniKV label="RSI (14)" value={fmtN(indicators.rsi14)} />
            <p className="text-xs text-zinc-500 dark:text-zinc-400 -mt-1">{indicators.rsiNote}</p>
            <MiniKV label="MACD" value={fmtN(indicators.macdValue, 2)} />
            <MiniKV label="MACD Signal" value={indicators.macdSignalType} />
            <p className="text-xs text-zinc-500 dark:text-zinc-400 -mt-1">{indicators.macdNote}</p>
            <MiniKV label="Stochastic %K / %D" value={`${fmtN(indicators.stochK)} / ${fmtN(indicators.stochD)}`} />
            {technicalScore && <MiniKV label="Skor Teknikal (7-Confirmation)" value={`${technicalScore.total}/${technicalScore.max}`} />}
          </Collapse>

          <Collapse title="Support & Resistance Detail" icon={Crosshair}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase text-emerald-600 dark:text-emerald-400 mb-1">Support</p>
                {supportResistance.supports.length > 0
                  ? supportResistance.supports.map((s) => <MiniKV key={s.label} label={s.label} value={fmtRp(s.price)} />)
                  : <p className="text-xs text-zinc-400">–</p>}
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase text-amber-600 dark:text-amber-400 mb-1">Resistance</p>
                {supportResistance.resistances.length > 0
                  ? supportResistance.resistances.map((r) => <MiniKV key={r.label} label={r.label} value={fmtRp(r.price)} />)
                  : <p className="text-xs text-zinc-400">–</p>}
              </div>
            </div>
          </Collapse>

          <Collapse title="Volume Detail" icon={BarChart2}>
            <MiniKV label="Volume Terakhir" value={formatCompact(volume.lastVolume)} />
            <MiniKV label="Volume MA20" value={formatCompact(volume.volumeMa20)} />
            <MiniKV label="RVOL" value={Number.isNaN(volume.relativeVolume) ? '–' : `${volume.relativeVolume.toFixed(2)}×`} />
            <MiniKV label="Volume Trend" value={volume.volumeTrend} />
            {volume.notes.map((n) => <p key={n} className="text-xs text-zinc-500 dark:text-zinc-400">{n}</p>)}
          </Collapse>

          <Collapse title="Rencana Trading" icon={Target}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ScenarioMiniCard scenario={analysis.tradingPlan.bullish} isBias={analysis.tradingPlan.recommendedBias === 'bullish'} />
              <ScenarioMiniCard scenario={analysis.tradingPlan.bearish} isBias={analysis.tradingPlan.recommendedBias === 'bearish'} />
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

          <Collapse title="Bandar Detector (Wyckoff)" icon={Eye}>
            <MiniKV label="Fase" value={decision.bandarScore.phaseLabel} />
            <MiniKV label="Skor" value={`${decision.bandarScore.total}/${decision.bandarScore.max}`} />
            <MiniKV label="Klasifikasi" value={decision.bandarScore.classification.label} />
            {decision.bandarScore.hiddenDistributionWarning && (
              <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold pt-1">⚠️ Indikasi hidden distribution — harga naik/flat tapi OBV melemah.</p>
            )}
            {decision.bandarScore.dataNotes.map((n) => <p key={n} className="text-[11px] text-zinc-400 pt-1">{n}</p>)}
          </Collapse>

          {(brokerActivityLoading || brokerActivity) && (
            <Collapse title="Broker Summary & Foreign Flow" icon={BarChart2}>
              {brokerActivityLoading && (
                <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400"><Loader2 className="size-3.5 animate-spin" strokeWidth={2.5} /> Memuat data broker riil…</div>
              )}
              {!brokerActivityLoading && brokerActivity && (
                <>
                  <p className="text-[11px] text-zinc-400">{brokerActivity.rangeFrom} – {brokerActivity.rangeTo} · via Index Alpha</p>
                  {brokerActivity.foreignFlow?.netForeign != null && (
                    <div className={cn('neo-border px-3 py-2 flex items-center justify-between gap-2', brokerActivity.foreignFlow.netForeign >= 0 ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'bg-rose-50 dark:bg-rose-500/10')}>
                      <span className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">Net Foreign Flow</span>
                      <span className={cn('font-mono text-sm font-bold', brokerActivity.foreignFlow.netForeign >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
                        {brokerActivity.foreignFlow.netForeign >= 0 ? '+' : ''}Rp{formatCompact(brokerActivity.foreignFlow.netForeign)}
                      </span>
                    </div>
                  )}
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

          <Collapse title="Fundamental" icon={CheckCircle2}>
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
                <MiniKV label="Revenue Growth (YoY)" value={fundamentals.revenueGrowth != null ? `${fundamentals.revenueGrowth.toFixed(1)}%` : '–'} />
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

        <p className="text-[11px] text-zinc-400 text-center pt-2 hidden lg:block">
          {SITE_NAME} — Analisis ini bukan rekomendasi beli/jual. Selalu terapkan manajemen risiko sendiri.
        </p>
      </aside>

      </main>
    </div>
  );
}
