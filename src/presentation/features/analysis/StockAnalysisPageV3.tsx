'use client';

/**
 * StockAnalysisPageV3.tsx
 *
 * "10-Second Review" — an ultra-terse swing-trading (1–5 day holding) verdict
 * card, built to the exact output spec: STATUS, Entry/TP/SL, 4 technical
 * components (Trend/Momentum/Volume/Level), one biggest risk, one action.
 * Deliberately shows nothing else (no full indicator list, no scoring
 * breakdown, no news, no fundamental metrics) — the whole point is a page
 * readable in ~10 seconds.
 *
 * Status/Entry/SL/TP come straight from the existing EOD engine
 * (riskGate.ts / tradeValidation.ts / stockAnalysisEngine.ts via
 * useStockAnalysis) — no new calculation engine, just a much terser mapping
 * of the same fields StockAnalysisPageNew.tsx / V2 already use.
 */

import {
  AlertTriangle,
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Loader2,
  NotebookPen,
  RefreshCw,
  Share2,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { cn, formatPercent, formatRupiah } from '@/lib/format';
import { SITE_NAME } from '@/lib/site';
import { EntryType, IndicatorAnalysis } from '@/domain/models/StockAnalysis';
import {
  classifyRsiOverbought,
  classifyRvol,
  evaluateRiskGate,
  BuyPermission,
  ChasingRisk,
  RiskGateStatus,
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
import { roundToTick } from '@/domain/analysis/idxTick';
import { useWatchlist } from '@/presentation/features/screener/hooks/useWatchlist';
import { useJournal } from '@/presentation/features/journal/hooks/useJournal';
import { useStockAnalysis } from './useStockAnalysis';
import { OHLCVChart } from './OHLCVChart';

type Tone = 'green' | 'red' | 'amber' | 'zinc';
type SwingStatus = 'BUY' | 'WAIT' | 'NO_TRADE';

function fmtRp(n: number): string {
  if (Number.isNaN(n) || n === 0) return '–';
  return formatRupiah(n);
}

const TONE_TEXT: Record<Tone, string> = {
  green: 'text-emerald-700 dark:text-emerald-400', red: 'text-rose-700 dark:text-rose-400',
  amber: 'text-amber-700 dark:text-amber-400', zinc: 'text-zinc-600 dark:text-zinc-400',
};
const TONE_SOFT_BG: Record<Tone, string> = {
  green: 'bg-emerald-50 dark:bg-emerald-500/10', red: 'bg-rose-50 dark:bg-rose-500/10',
  amber: 'bg-amber-50 dark:bg-amber-500/10', zinc: 'bg-zinc-100 dark:bg-zinc-800/60',
};
/** SHORT_SETUP has no place in a long-only 1–5D beginner-swing view — it reads as NO_TRADE, same
 * rationale as "Trend bearish" being a NO_TRADE condition in the spec's STATUS rules. */
function deriveSwingStatus(tradeStatus: TradeStatus): SwingStatus {
  if (tradeStatus === 'BUY') return 'BUY';
  if (tradeStatus === 'NO_TRADE' || tradeStatus === 'SHORT_SETUP') return 'NO_TRADE';
  return 'WAIT';
}

function statusEmoji(status: SwingStatus): string {
  return status === 'BUY' ? '🟢' : status === 'NO_TRADE' ? '🔴' : '🟡';
}
function statusTone(status: SwingStatus): Tone {
  return status === 'BUY' ? 'green' : status === 'NO_TRADE' ? 'red' : 'amber';
}
function statusHeadline(status: SwingStatus, zoneStatus: ZoneStatus): string {
  if (status === 'BUY') return 'BUY — SETUP TERKONFIRMASI';
  if (status === 'NO_TRADE') return 'NO TRADE — HINDARI DULU';
  if (zoneStatus === 'ABOVE_ZONE') return 'WAIT — JANGAN CHASE';
  if (zoneStatus === 'BELOW_ZONE') return 'WAIT — TUNGGU KONFIRMASI';
  return 'WAIT — TUNGGU BREAKOUT CONFIRMATION';
}

function deriveSetupLabel(entryType: EntryType, zoneStatus: ZoneStatus, status: SwingStatus): string {
  if (status === 'WAIT' && zoneStatus === 'ABOVE_ZONE') return 'Breakout Watch';
  switch (entryType) {
    case 'BUY_ON_BREAKOUT': return 'Breakout';
    case 'BUY_ON_PULLBACK': return 'Pullback';
    case 'BUY_ON_SUPPORT': return 'Support Bounce';
    case 'SHORT_ON_REJECTION': return 'Reversal (Bearish)';
    case 'SHORT_ON_BREAKDOWN': return 'Breakdown';
    case 'WAIT_CONFIRMATION': return 'Momentum Watch';
    default: return 'No Setup';
  }
}

type MomentumLabel = 'Strong' | 'Healthy' | 'Weak' | 'Overbought Risk';
function classifyMomentumLabel(indicators: IndicatorAnalysis): { label: MomentumLabel; tone: Tone } {
  if (indicators.rsi14 >= 80) return { label: 'Overbought Risk', tone: 'amber' };
  const macdBullish = indicators.macdSignalType === 'bullish_crossover' || indicators.macdSignalType === 'bullish';
  const macdBearish = indicators.macdSignalType === 'bearish_crossover' || indicators.macdSignalType === 'bearish';
  if (macdBullish && indicators.rsi14 >= 55) return { label: 'Strong', tone: 'green' };
  if (macdBearish && indicators.rsi14 <= 45) return { label: 'Weak', tone: 'red' };
  if (macdBullish || (indicators.rsi14 > 45 && indicators.rsi14 < 70)) return { label: 'Healthy', tone: 'green' };
  return { label: 'Weak', tone: 'red' };
}

type VolumeLabel = 'HIGH' | 'NORMAL' | 'LOW';
function classifyVolumeLabel(relativeVolume: number): { label: VolumeLabel; tone: Tone } {
  const rvol = classifyRvol(relativeVolume);
  if (rvol.tier === 'HIGH' || rvol.tier === 'VERY_HIGH' || rvol.tier === 'ELEVATED') return { label: 'HIGH', tone: 'green' };
  if (rvol.tier === 'NORMAL') return { label: 'NORMAL', tone: 'zinc' };
  return { label: 'LOW', tone: 'amber' };
}

function deriveTopRisk(params: {
  riskGateStatus: RiskGateStatus;
  zoneStatus: ZoneStatus;
  belowEma200: boolean;
  chasingRisk: ChasingRisk;
  nearestResistance?: number;
  price: number;
  trend: 'bullish' | 'bearish' | 'sideways';
  momentumLabel: MomentumLabel;
  volumeLabel: VolumeLabel;
  fundamentalScore: number;
}): string {
  const { riskGateStatus, zoneStatus, belowEma200, chasingRisk, nearestResistance, price, trend, momentumLabel, volumeLabel, fundamentalScore } = params;

  if (riskGateStatus === 'BLOCKED') {
    return 'Risk Gate memblokir sinyal beli — beberapa faktor risiko (tren, fundamental, distribusi) menumpuk bersamaan.';
  }
  if (zoneStatus === 'ABOVE_ZONE') {
    return `Harga sudah jauh di atas Entry Zone${belowEma200 ? ' + masih di bawah EMA200.' : '.'}`;
  }
  if (chasingRisk === 'HIGH' || chasingRisk === 'VERY_HIGH') {
    return 'RSI sudah sangat tinggi (overbought) — risiko mengejar harga (chasing) meningkat.';
  }
  if (zoneStatus === 'BELOW_ZONE') {
    return 'Harga sudah menembus di bawah level support/stop loss — setup ini berisiko breakdown lanjutan.';
  }
  if (nearestResistance && price < nearestResistance && (nearestResistance - price) / price <= 0.02) {
    return `Harga sudah dekat resistance ${fmtRp(nearestResistance)} — ruang naik terbatas sebelum breakout benar-benar terkonfirmasi.`;
  }
  if (belowEma200) {
    return 'Harga masih di bawah EMA200 — risiko tren utama, bukan bullish penuh.';
  }
  if (trend === 'bearish') {
    return 'Tren utama masih bearish — tekanan turun berpotensi berlanjut.';
  }
  if (momentumLabel === 'Weak') {
    return 'Momentum belum cukup kuat untuk mendukung kelanjutan kenaikan.';
  }
  if (volumeLabel === 'LOW') {
    return 'Volume rendah — pergerakan harga belum didukung minat beli yang cukup, breakout kurang meyakinkan.';
  }
  if (fundamentalScore < 50) {
    return `Fundamental tergolong lemah (skor ${fundamentalScore}/100) — kurang mendukung untuk holding lebih lama dari rencana.`;
  }
  return 'Belum ada risiko besar yang teridentifikasi — tetap gunakan stop loss dan disiplin rencana.';
}

function buildActionLines(params: {
  status: SwingStatus;
  zoneStatus: ZoneStatus;
  entryZoneLow: number;
  entryZoneHigh: number;
  nearestResistance?: number;
  price: number;
  belowEma200: boolean;
  sl: number;
}): string[] {
  const { status, zoneStatus, entryZoneLow, entryZoneHigh, nearestResistance, price, belowEma200, sl } = params;

  if (status === 'BUY') {
    return [
      `BUY sesuai rencana di area ${fmtRp(entryZoneLow)}–${fmtRp(entryZoneHigh)}.`,
      `Jaga stop loss di ${fmtRp(sl)}, ambil untung bertahap di TP1/TP2.`,
    ];
  }
  if (status === 'NO_TRADE') {
    const reason = belowEma200 ? 'trend di bawah EMA200' : 'risiko terlalu tinggi saat ini';
    return [`NO TRADE karena ${reason}.`, 'Hindari entry baru sampai kondisi membaik.'];
  }
  const lines: string[] = [];
  if (zoneStatus === 'ABOVE_ZONE') {
    lines.push(`Tunggu pullback ke ${fmtRp(entryZoneLow)}–${fmtRp(entryZoneHigh)}.`);
    if (nearestResistance) lines.push(`Alternatif: tunggu breakout ${fmtRp(nearestResistance)} dengan volume kuat.`);
    lines.push(`❌ Jangan mengejar ${fmtRp(price)}.`);
  } else if (zoneStatus === 'BELOW_ZONE') {
    lines.push('Tunggu struktur harga baru terbentuk sebelum mempertimbangkan entry lagi.');
  } else {
    lines.push(`Tunggu konfirmasi candle & volume di area ${fmtRp(entryZoneLow)}–${fmtRp(entryZoneHigh)} sebelum entry.`);
  }
  return lines;
}

// ─── UI blocks ──────────────────────────────────────────────────────────────
function Row({ label, value, valueClass }: { label: string; value: React.ReactNode; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className={cn('font-mono font-bold tabular-nums text-zinc-800 dark:text-zinc-100', valueClass)}>{value}</span>
    </div>
  );
}

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

// ─── Main component ─────────────────────────────────────────────────────────
export function StockAnalysisPageV3({ ticker }: { ticker: string }) {
  const { status, summary, analysis, bars, fundamentalScreening, fundamentals, reload } = useStockAnalysis(ticker);

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
      try { await navigator.share({ title: `${summary.ticker} — ${summary.name}`, text: '10-Second Review — EzySaham', url }); } catch { /* cancelled */ }
      return;
    }
    try { await navigator.clipboard.writeText(url); setJustCopied(true); setTimeout(() => setJustCopied(false), 2000); } catch { /* clipboard unavailable */ }
  }, [summary]);

  // ── Decision pipeline: same fields/order as riskGate.ts's contract used throughout the app
  // (StockAnalysisPage.tsx / StockAnalysisPageNew.tsx / V2) — no new calculation engine.
  const decision = useMemo(() => {
    if (!summary || !analysis || !fundamentalScreening) return null;
    const bandarScore = computeBandarScore(summary, bars);
    const marketCyclePhase = getMarketCyclePhase(bandarScore, analysis.indicators);
    computeEntryTiming(bandarScore, analysis.indicators); // computed for parity; not surfaced in this terse view
    void marketCyclePhase;

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

    return {
      scenario, isLong, price, nearestSupport, nearestResistance, entryZoneLow, entryZoneHigh,
      zoneStatus, riskGate, tradeStatus, buyPermission,
    };
  }, [summary, bars, analysis, fundamentals, fundamentalScreening]);

  if (status === 'loading') return <LoadingState ticker={ticker} />;
  if (status === 'error' || !analysis || !summary || !fundamentalScreening || !decision) {
    return <ErrorState ticker={ticker} />;
  }

  const { trendEma, indicators, volume } = analysis;
  const { scenario, nearestSupport, nearestResistance, entryZoneLow, entryZoneHigh, zoneStatus, riskGate } = decision;
  const positiveDay = summary.percentChange1D >= 0;
  const isWatched = watchlist.has(summary.ticker);

  const swingStatus = deriveSwingStatus(decision.tradeStatus);
  const belowEma200 = summary.lastClose < trendEma.ema200;
  const momentum = classifyMomentumLabel(indicators);
  const volumeInfo = classifyVolumeLabel(volume.relativeVolume);
  const chasingRisk = classifyRsiOverbought(indicators.rsi14).chasingRisk;
  const setupLabel = deriveSetupLabel(scenario.entryType, zoneStatus, swingStatus);

  const topRisk = deriveTopRisk({
    riskGateStatus: riskGate.riskGateStatus, zoneStatus, belowEma200, chasingRisk,
    nearestResistance: nearestResistance?.price, price: summary.lastClose, trend: trendEma.trend,
    momentumLabel: momentum.label, volumeLabel: volumeInfo.label, fundamentalScore: fundamentalScreening.score,
  });

  const actionLines = buildActionLines({
    status: swingStatus, zoneStatus, entryZoneLow, entryZoneHigh, nearestResistance: nearestResistance?.price,
    price: summary.lastClose, belowEma200, sl: scenario.sl,
  });

  const tone = statusTone(swingStatus);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm neo-border border-x-0 border-t-0">
        <div className="mx-auto flex max-w-xl items-center gap-2 px-3 py-2.5 sm:px-6 sm:py-3">
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

      <main className="mx-auto max-w-xl px-3 py-4 sm:px-6 sm:py-6 pb-16 space-y-4">

        {/* ── 🚨 10-SECOND REVIEW card ─────────────────────────────────── */}
        <div className="neo-border neo-shadow bg-white dark:bg-zinc-900 overflow-hidden">

          <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-3 border-b-2 border-(--neo-line) bg-zinc-900 dark:bg-zinc-950">
            <span className="text-xs font-bold uppercase tracking-wide text-white flex items-center gap-1.5">🚨 10-Second Review — ${summary.ticker}</span>
            <div className="flex items-center gap-1.5 shrink-0">
              <button type="button" onClick={handleShare} className="neo-press flex items-center gap-1 px-2 py-1 neo-border border-zinc-700 bg-zinc-800 text-[11px] font-bold text-zinc-200 rounded-md">
                <Share2 className="size-3" strokeWidth={2.5} />{justCopied ? 'Disalin' : 'Bagikan'}
              </button>
              <button type="button" onClick={() => watchlist.toggle(summary.ticker)}
                className={cn('neo-press flex items-center gap-1 px-2 py-1 neo-border border-zinc-700 text-[11px] font-bold rounded-md', isWatched ? 'bg-amber-300 text-black' : 'bg-zinc-800 text-zinc-200')}>
                {isWatched ? <BookmarkCheck className="size-3" strokeWidth={2.5} /> : <Bookmark className="size-3" strokeWidth={2.5} />}
              </button>
            </div>
          </div>

          {/* STATUS */}
          <div className={cn('px-4 sm:px-5 py-4 flex items-center gap-3', TONE_SOFT_BG[tone])}>
            <span className="text-2xl shrink-0">{statusEmoji(swingStatus)}</span>
            <span className={cn('text-xl sm:text-2xl font-black tracking-tight', TONE_TEXT[tone])}>{statusHeadline(swingStatus, zoneStatus)}</span>
          </div>

          <div className="divide-y-2 divide-(--neo-line)">
            {/* Harga + Setup */}
            <div className="px-4 sm:px-5 py-3 flex items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase text-zinc-400 block">Harga</span>
                <span className="font-mono text-lg font-bold text-zinc-900 dark:text-zinc-100">{fmtRp(summary.lastClose)}</span>
                <span className={cn('ml-2 text-xs font-mono font-bold', positiveDay ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
                  {formatPercent(summary.percentChange1D)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold uppercase text-zinc-400 block">Setup</span>
                <span className="text-sm font-bold text-zinc-800 dark:text-zinc-100">{setupLabel}</span>
              </div>
            </div>

            {/* Entry */}
            <div className="px-4 sm:px-5 py-3">
              <span className="text-[10px] font-bold uppercase text-zinc-400 block mb-1">📍 Entry</span>
              <span className="font-mono text-base font-bold text-zinc-800 dark:text-zinc-100">{fmtRp(entryZoneLow)} – {fmtRp(entryZoneHigh)}</span>
            </div>

            {/* Target + SL */}
            <div className="px-4 sm:px-5 py-3 grid grid-cols-2 gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase text-zinc-400 block mb-1">🎯 Target</span>
                <Row label="TP1" value={fmtRp(scenario.tp1)} valueClass="text-emerald-600 dark:text-emerald-400" />
                <Row label="TP2" value={fmtRp(scenario.tp2)} valueClass="text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-zinc-400 block mb-1">🛑 Stop Loss</span>
                <span className="font-mono text-base font-bold text-rose-600 dark:text-rose-400">{fmtRp(scenario.sl)}</span>
              </div>
            </div>

            {/* Teknikal */}
            <div className="px-4 sm:px-5 py-3 space-y-1">
              <span className="text-[10px] font-bold uppercase text-zinc-400 block mb-1">📊 Teknikal</span>
              <Row label="Trend" value={trendEma.trend === 'bullish' ? 'Bullish' : trendEma.trend === 'bearish' ? 'Bearish' : 'Neutral'}
                valueClass={trendEma.trend === 'bullish' ? 'text-emerald-600 dark:text-emerald-400' : trendEma.trend === 'bearish' ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'} />
              <Row label="Momentum" value={momentum.label} valueClass={TONE_TEXT[momentum.tone]} />
              <Row label="Volume" value={volumeInfo.label} valueClass={TONE_TEXT[volumeInfo.tone]} />
              <Row label="Level" value={`S ${nearestSupport ? fmtRp(nearestSupport.price) : '–'} | R ${nearestResistance ? fmtRp(nearestResistance.price) : '–'}`} />
              {belowEma200 && (
                <p className="text-xs font-bold text-rose-600 dark:text-rose-400 pt-1">⚠️ Di bawah EMA200 — risiko trend utama.</p>
              )}
            </div>

            {/* Risiko Utama */}
            <div className="px-4 sm:px-5 py-3">
              <span className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400 block mb-1">⚠️ Risiko Utama</span>
              <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">{topRisk}</p>
            </div>

            {/* Action */}
            <div className={cn('px-4 sm:px-5 py-3', TONE_SOFT_BG[tone])}>
              <span className="text-[10px] font-bold uppercase text-zinc-500 dark:text-zinc-400 block mb-1.5">💡 Action</span>
              <ul className="space-y-1">
                {actionLines.map((line, i) => (
                  <li key={i} className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 leading-snug">{line}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Price action tetap ditampilkan — bukan bagian dari "seluruh indikator" yang dihindari */}
        {bars.length > 0 && (
          <div className="neo-border neo-shadow overflow-hidden">
            <OHLCVChart bars={bars} currentClose={summary.lastClose} ticker={summary.ticker} prevClose={summary.prevClose} />
          </div>
        )}

        <p className="text-[11px] text-zinc-400 text-center">{SITE_NAME} — bukan rekomendasi beli/jual, bukan jaminan profit.</p>
      </main>
    </div>
  );
}
