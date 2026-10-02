'use client';

/**
 * Trading1MinutesReport.tsx
 *
 * "1 Minute Stock Analysis" (features_1menit_analisa.md, versi lengkap) for the detail page's `.sv-theme`.
 * Eight sections: Bisnis · Fundamental 1Y · Harga 1Y · Valuasi · Fundamental Change vs Price Lag
 * (features_fundamental_acceleration.md) · Teknikal · Trading Plan (Intraday / Swing 1–5 hari / Investing) · Final 10-second review + Key Level + Risk Gate + kesimpulan.
 * Reuses the same engines as TradingModesReport (tradingModesReview.ts + fundamentalPillars.ts) so the
 * decisions never disagree between the two reports. DATA rows show raw values only; verdicts are labelled
 * INTERPRETASI. Anything the data feed does not carry renders "DATA TIDAK TERSEDIA" — never a guessed number.
 */

import { Loader2, Timer } from 'lucide-react';
import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { getStockIntraday } from '@/data/repositories/StockRepository';
import { FundamentalScreeningResult } from '@/domain/analysis/aiStockEngine';
import {
  AccelSignal,
  buildFundamentalAcceleration,
  FUNDAMENTAL_CHANGE_LABEL,
  FundamentalAccelerationResult,
  PRICE_LAG_LABEL,
  RERATING_STATUS_LABEL,
  ReratingStatus,
  TECHNICAL_STAGE_LABEL,
  ValuationSignal,
} from '@/domain/analysis/fundamentalAcceleration';
import {
  buildFundamentalPillars,
  FundamentalPillars,
  HealthVerdict,
  isFinancial,
  ValuationVerdict,
} from '@/domain/analysis/fundamentalPillars';
import {
  buildIntradayModeReview,
  buildInvestingModeReview,
  buildSwingModeReview,
  isTechnicalBearish,
  ModeDecision,
  ModeField,
  ModeReview,
  NA,
  pickTargets,
  PlanQaCheck,
  planQaChecks,
  validatePlanLevels,
} from '@/domain/analysis/tradingModesReview';
import { ema, lastValid } from '@/domain/indicators/movingAverages';
import { vwap as sessionVwap } from '@/domain/indicators/vwap';
import { FundamentalDetail } from '@/domain/models/Fundamentals';
import { OHLCVBar } from '@/domain/models/History';
import { IntradayResponse } from '@/domain/models/Intraday';
import { StockSummary } from '@/domain/models/Stock';
import { StockAnalysis, Trend } from '@/domain/models/StockAnalysis';
import { cn } from '@/lib/format';
import { fmtMultiple, fmtNum, fmtPct, fmtPctPlain, fmtRp, Tone } from '../format';
import { CopyShareButton } from './TradingModesReport';
import { Badge, Card, PanelTitle, Skeleton, TONE_TEXT } from './ui';

const NO_DATA = 'DATA TIDAK TERSEDIA';

// ─── Verdict vocabularies (features_1menit_analisa.md) ──────────────────────────

type Signal3 = 'green' | 'yellow' | 'red' | 'na';
type TradeStatus = 'BUY' | 'WAIT' | 'NO TRADE' | 'INVALID PLAN';
/** "WAIT / HOLD EXISTING": belum punya → tunggu; sudah punya → hold. Never plain "HOLD" — we don't know if the user holds a position. */
type InvestStatus = 'ACCUMULATE' | 'ACCUMULATE BERTAHAP' | 'WAIT / HOLD EXISTING' | 'WAIT' | 'AVOID';
type Momentum = 'Strong' | 'Normal' | 'Weak';

/** One labelled entry type in Key Level — investor, swing, breakout and deep-support entries are never merged. */
interface EntryType {
  icon: string;
  label: string;
  zone: string;
  basis: string;
  invalidation: string;
  note: string | null;
  tone: Tone;
}

/** YoY growth at/above this (%) is treated as unproven (low base / one-off) → ACCUMULATE BERTAHAP, not ACCUMULATE. */
const EXTREME_GROWTH_PCT = 100;

const SIGNAL_EMOJI: Record<Signal3, string> = { green: '🟢', yellow: '🟡', red: '🔴', na: '⚪' };
const SIGNAL_TONE: Record<Signal3, Tone> = { green: 'positive', yellow: 'warning', red: 'negative', na: 'neutral' };
const RERATING_TONE: Record<ReratingStatus, Tone> = { RERATING_CANDIDATE: 'positive', EARLY_WATCH: 'info', WAIT_CONFIRMATION: 'warning', NO_TRADE: 'neutral' };
const VALUATION_TO_ACCEL: Record<ValuationVerdict, ValuationSignal> = {
  UNDERVALUED: 'cheap', WAJAR: 'fair', PREMIUM: 'expensive', OVERVALUED: 'expensive', TIDAK_DAPAT_DINILAI: 'na',
};

const TRADE_TONE: Record<TradeStatus, Tone> = { BUY: 'positive', WAIT: 'warning', 'NO TRADE': 'neutral', 'INVALID PLAN': 'negative' };
const INVEST_TONE: Record<InvestStatus, Tone> = { ACCUMULATE: 'positive', 'ACCUMULATE BERTAHAP': 'positive', 'WAIT / HOLD EXISTING': 'info', WAIT: 'warning', AVOID: 'negative' };
const TREND_TONE: Record<Trend, Tone> = { bullish: 'positive', sideways: 'warning', bearish: 'negative' };
const TREND_LABEL: Record<Trend, string> = { bullish: 'Bullish', sideways: 'Sideways', bearish: 'Bearish' };
const MOMENTUM_TONE: Record<Momentum, Tone> = { Strong: 'positive', Normal: 'warning', Weak: 'negative' };

/**
 * INTRADAY/SWING engines never return WATCHLIST, but map it defensively to WAIT.
 * Hard validation wins over the engine decision: any LONG plan with TP ≤ Entry / TP2 ≤ TP1 / SL ≥ Entry → INVALID PLAN.
 */
const toTradeStatus = (r: ModeReview): TradeStatus => (validatePlanLevels(r.levels).length > 0 ? 'INVALID PLAN'
  : r.decision === 'BUY' ? 'BUY' : r.decision === 'NO_TRADE' ? 'NO TRADE' : 'WAIT');
/** INVESTING: BUY = akumulasi, WATCHLIST = bisnis bagus tapi harga/trend belum pas (belum punya: tunggu · sudah punya: hold), NO TRADE = hindari. */
const toInvestStatus = (d: ModeDecision): InvestStatus =>
  d === 'BUY' ? 'ACCUMULATE' : d === 'WATCHLIST' ? 'WAIT / HOLD EXISTING' : d === 'NO_TRADE' ? 'AVOID' : 'WAIT';

const HEALTH_SIGNAL: Record<HealthVerdict, { signal: Signal3; label: string }> = {
  SEHAT: { signal: 'green', label: 'Sehat' },
  CUKUP: { signal: 'yellow', label: 'Perlu perhatian' },
  LEMAH: { signal: 'red', label: 'Lemah' },
  DATA_KURANG: { signal: 'na', label: NO_DATA },
};

const VALUATION_SIGNAL: Record<ValuationVerdict, { signal: Signal3; label: string; short: string }> = {
  UNDERVALUED: { signal: 'green', label: 'Undervalued', short: 'undervalued' },
  WAJAR: { signal: 'yellow', label: 'Fair Value', short: 'fair' },
  PREMIUM: { signal: 'red', label: 'Overvalued (premium)', short: 'overvalued' },
  OVERVALUED: { signal: 'red', label: 'Overvalued', short: 'overvalued' },
  TIDAK_DAPAT_DINILAI: { signal: 'na', label: NO_DATA, short: 'data tidak tersedia' },
};

// ─── Helpers ────────────────────────────────────────────────────────────────────

const valid = (n: number | null | undefined): n is number => n != null && Number.isFinite(n) && n > 0;
const finite = (n: number | null | undefined): n is number => n != null && Number.isFinite(n);
const rpOr = (n: number | null | undefined) => (valid(n) ? fmtRp(n) : NO_DATA);
const fieldText = (f: ModeField | undefined) => {
  if (!f) return NO_DATA;
  const text = Array.isArray(f.value) ? f.value.join(' ') : f.value;
  return !text || text === NA ? NO_DATA : text.replaceAll(NA, NO_DATA);
};
const findField = (r: ModeReview, label: string) => r.fields.find((f) => f.label === label);
const invalidRow = (errors: string[]): Array<[string, string, Tone]> =>
  (errors.length > 0 ? [['Validasi', `INVALID PLAN — ${errors.join(' · ')}. Plan tidak boleh dieksekusi.`, 'negative']] : []);

/** Business outlook from YoY growth only — an INTERPRETASI, not a forecast. */
function businessOutlook(f: FundamentalDetail | null): { signal: Signal3; label: string; reason: string } {
  const rg = f?.revenueGrowth ?? null;
  const eg = f?.earningsGrowth ?? null;
  if (rg == null && eg == null) {
    return { signal: 'na', label: NO_DATA, reason: 'Pertumbuhan pendapatan & laba tidak tersedia di sumber data.' };
  }
  const pos = [rg, eg].filter((x): x is number => x != null && x > 0).length;
  const neg = [rg, eg].filter((x): x is number => x != null && x < 0).length;
  const growth = `pendapatan ${rg != null ? fmtPct(rg, 1) : NO_DATA} & laba ${eg != null ? fmtPct(eg, 1) : NO_DATA} YoY`;
  if (pos >= 1 && neg === 0) return { signal: 'green', label: 'Positif', reason: `Kinerja terbaru bertumbuh (${growth}) — prospek mendukung selama tren berlanjut.` };
  if (neg >= 1 && pos === 0) return { signal: 'red', label: 'Negatif', reason: `Kinerja terbaru menurun (${growth}) — prospek tertekan sampai ada perbaikan.` };
  return { signal: 'yellow', label: 'Netral', reason: `Kinerja campuran (${growth}) — belum ada arah prospek yang jelas.` };
}

function pricePosition(price: number, low: number, high: number): string {
  if (!valid(price) || !valid(low) || !valid(high) || high <= low) return NO_DATA;
  const pos = (price - low) / (high - low);
  const pctTxt = `${fmtNum(pos * 100, 0)}% dari range 1Y`;
  if (pos <= 0.33) return `Dekat support / low 1Y (${pctTxt})`;
  if (pos >= 0.67) return `Dekat high 1Y (${pctTxt})`;
  return `Tengah range (${pctTxt})`;
}

interface MomentumFactor { label: string; vote: 1 | 0 | -1 | null; text: string }

/**
 * Momentum = Price vs VWAP + EMA structure + candle + MACD + RSI + RVOL (features_rule_engine.md §7) — never one indicator.
 * RVOL carries no direction by itself (§6): high RVOL only votes with the candle (green = konfirmasi, red = tekanan jual).
 * Strong needs ≥ 4 net bullish votes with no red candle; Weak = net ≤ −2. Missing inputs are skipped, not guessed.
 */
function momentumOf(i: {
  price: number; vwap: number | null; ema20: number; ema50: number;
  candle: 'green' | 'red' | 'doji'; macdHist: number; rsi: number; rvol: number;
}): { momentum: Momentum; score: number; factors: MomentumFactor[] } {
  const highRvol = finite(i.rvol) && i.rvol >= 1.2;
  const factors: MomentumFactor[] = [
    i.vwap != null
      ? { label: 'VWAP', vote: i.price > i.vwap ? 1 : i.price < i.vwap ? -1 : 0, text: i.price > i.vwap ? 'harga > VWAP' : i.price < i.vwap ? 'harga < VWAP' : 'harga = VWAP' }
      : { label: 'VWAP', vote: null, text: NO_DATA },
    valid(i.ema20) && valid(i.ema50)
      ? (i.price > i.ema20 && i.ema20 > i.ema50 ? { label: 'EMA', vote: 1, text: 'harga > EMA20 > EMA50' }
        : i.price < i.ema20 && i.ema20 < i.ema50 ? { label: 'EMA', vote: -1, text: 'harga < EMA20 < EMA50' }
          : { label: 'EMA', vote: 0, text: 'EMA campur' })
      : { label: 'EMA', vote: null, text: NO_DATA },
    { label: 'Candle', vote: i.candle === 'green' ? 1 : i.candle === 'red' ? -1 : 0, text: i.candle === 'green' ? 'hijau' : i.candle === 'red' ? 'merah' : 'doji' },
    finite(i.macdHist)
      ? { label: 'MACD', vote: i.macdHist > 0 ? 1 : i.macdHist < 0 ? -1 : 0, text: `hist ${fmtNum(i.macdHist, 2)}` }
      : { label: 'MACD', vote: null, text: NO_DATA },
    finite(i.rsi)
      ? { label: 'RSI', vote: i.rsi >= 55 ? 1 : i.rsi <= 45 ? -1 : 0, text: fmtNum(i.rsi, 1) }
      : { label: 'RSI', vote: null, text: NO_DATA },
    !finite(i.rvol) ? { label: 'RVOL', vote: null, text: NO_DATA }
      : !highRvol ? { label: 'RVOL', vote: 0, text: `${fmtMultiple(i.rvol, 2)} — aktivitas normal` }
        : i.candle === 'green' ? { label: 'RVOL', vote: 1, text: `${fmtMultiple(i.rvol, 2)} + candle hijau — konfirmasi positif` }
          : i.candle === 'red' ? { label: 'RVOL', vote: -1, text: `${fmtMultiple(i.rvol, 2)} + candle merah — tekanan jual` }
            : { label: 'RVOL', vote: 0, text: `${fmtMultiple(i.rvol, 2)} + doji — aktivitas tinggi, arah belum jelas` },
  ];
  const score = factors.reduce((sum, f) => sum + (f.vote ?? 0), 0);
  const momentum: Momentum = score >= 4 && i.candle !== 'red' ? 'Strong' : score <= -2 ? 'Weak' : 'Normal';
  return { momentum, score, factors };
}

/** Compact QA line: "✓ Entry < TP1 · ✗ SL < Entry · – TP2 < TP3". */
const qaText = (checks: PlanQaCheck[]) =>
  (checks.length === 0 ? NO_DATA : checks.map((c) => `${c.ok == null ? '–' : c.ok ? '✓' : '✗'} ${c.label}`).join(' · '));

const changeSignal = (c: FundamentalAccelerationResult['change']): AccelSignal =>
  (c === 'POSITIF' ? 'green' : c === 'NEGATIF' ? 'red' : c === 'NETRAL' ? 'yellow' : 'na');
const lagSignal = (l: FundamentalAccelerationResult['lag']): AccelSignal =>
  (l === 'TINGGI' ? 'green' : l === 'SEDANG' ? 'yellow' : l === 'RENDAH' ? 'red' : 'na');

// ─── Small layout primitives ────────────────────────────────────────────────────

function Section({ n, title, verdict, children }: { n: string; title: string; verdict?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border border-(--sv-border) bg-(--sv-bg)/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-(--sv-text)">{n} {title}</h3>
        {verdict}
      </div>
      {children}
    </section>
  );
}

function DataList({ rows }: { rows: Array<[string, ReactNode]> }) {
  return (
    <dl className="grid gap-x-4 gap-y-0.5 text-sm sm:grid-cols-2">
      {rows.map(([label, value]) => {
        const missing = typeof value === 'string' && value.startsWith(NO_DATA);
        return (
          <div key={label} className="flex justify-between gap-3 border-b border-(--sv-border)/70 py-1.5">
            <dt className="shrink-0 text-(--sv-muted)">{label}</dt>
            <dd className={cn('min-w-0 text-right font-medium tabular-nums', missing ? 'text-xs text-(--sv-muted)' : 'text-(--sv-text)')}>{value}</dd>
          </div>
        );
      })}
    </dl>
  );
}

function PlanList({ rows }: { rows: Array<[string, string, Tone?]> }) {
  return (
    <dl className="space-y-1.5 text-sm">
      {rows.map(([label, value, tone]) => (
        <div key={label} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
          <dt className="shrink-0 text-(--sv-muted) sm:w-32">{label}</dt>
          <dd className={cn(
            'min-w-0 font-medium',
            value.startsWith(NO_DATA) ? 'text-(--sv-muted)'
              : tone === 'positive' ? 'text-emerald-700 dark:text-emerald-400'
                : tone === 'negative' ? 'text-rose-600 dark:text-rose-400'
                  : 'text-(--sv-text)',
          )}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Interpretation({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg bg-(--sv-surface) p-3 text-sm leading-relaxed text-(--sv-text)">
      <span className="mr-1.5 text-[11px] font-semibold uppercase tracking-wide text-(--sv-muted)">Interpretasi</span>
      {children}
    </div>
  );
}

function SignalBadge({ signal, label }: { signal: Signal3; label: string }) {
  return <Badge tone={SIGNAL_TONE[signal]}>{SIGNAL_EMOJI[signal]} {label}</Badge>;
}

function PlanCard({ title, badge, children }: { title: string; badge: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-2 rounded-lg border border-(--sv-border) bg-(--sv-surface) p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-(--sv-text)">{title}</h4>
        {badge}
      </div>
      {children}
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────────

export function Trading1MinutesReport({
  summary,
  bars,
  analysis,
  fundamentals,
  fundamentalScreening,
}: {
  summary: StockSummary;
  bars: OHLCVBar[];
  analysis: StockAnalysis;
  fundamentals: FundamentalDetail | null;
  fundamentalScreening: FundamentalScreeningResult;
}) {
  const { trendEma, indicators, volume, priceAction, supportResistance, tradingPlan } = analysis;
  const ticker = summary.ticker;
  const price = summary.lastClose;

  // Yahoo 1-minute feed for VWAP + INTRADAY plan; keyed by ticker so a stale response is ignored.
  const [intradayState, setIntradayState] = useState<{ ticker: string; data: IntradayResponse } | null>(null);
  useEffect(() => {
    let cancelled = false;
    getStockIntraday(ticker).then((data) => {
      if (!cancelled) setIntradayState({ ticker, data });
    });
    return () => { cancelled = true; };
  }, [ticker]);
  const intraday = intradayState?.ticker === ticker ? intradayState.data : null;
  const intradayBars = intraday?.ok ? intraday.bars : null;

  const pillars: FundamentalPillars = useMemo(
    () => buildFundamentalPillars(summary, fundamentals, fundamentalScreening),
    [summary, fundamentals, fundamentalScreening],
  );

  const supports = useMemo(() => supportResistance.supports.map((s) => s.price), [supportResistance]);
  const resistances = useMemo(() => supportResistance.resistances.map((r) => r.price), [supportResistance]);

  const [intradayReview, swingReview, investingReview] = useMemo(() => [
    buildIntradayModeReview({
      bars: intradayBars,
      lastClose: price,
      lastPrice: intraday?.ok ? intraday.lastPrice : null,
      resistances,
    }),
    buildSwingModeReview({
      bars,
      price,
      ema20: trendEma.ema20,
      ema50: trendEma.ema50,
      ema200: trendEma.ema200,
      rsi14: indicators.rsi14,
      macdHistogram: indicators.macdHistogram,
      relativeVolume: volume.relativeVolume,
      lastCandleColor: priceAction.lastCandleColor,
      supports,
      resistances,
    }),
    buildInvestingModeReview({
      price,
      per: summary.per,
      pbv: summary.pbv,
      roe: summary.roe,
      earningsGrowth: fundamentals?.earningsGrowth ?? null,
      revenueGrowth: fundamentals?.revenueGrowth ?? null,
      debtToEquity: fundamentals?.debtToEquity ?? null,
      netMargin: fundamentals?.netMargin ?? null,
      operatingCashFlow: null,
      isFinancial: isFinancial(summary),
      fairValue: pillars.valuation.fairValue,
      accumulationLow: pillars.valuation.accumulationLow,
      accumulationHigh: pillars.valuation.accumulationHigh,
      technicalBearish: isTechnicalBearish({ price, ema20: trendEma.ema20, ema50: trendEma.ema50, ema200: trendEma.ema200 }),
    }),
  ], [intradayBars, intraday, price, resistances, bars, trendEma, indicators, volume, priceAction, supports, summary, fundamentals, pillars]);

  // EMA9 isn't part of StockAnalysis — derive from the same daily closes. EMA20/50/200 come from the engine (the same
  // EMA20 the swing plan uses, so the Teknikal section and the Trading Plan never quote two different "EMA20/21" levels).
  const ema9 = useMemo(() => lastValid(ema(bars.map((b) => b.close), 9)), [bars]);
  const ema20 = trendEma.ema20;
  const vwap = intradayBars && intradayBars.length > 0 ? sessionVwap(intradayBars) : null;

  const accel = useMemo(() => buildFundamentalAcceleration({
    price,
    annualHigh: summary.annualHigh,
    return3M: summary.percentChange3M,
    return6M: summary.percentChange6M,
    return1Y: summary.percentChange1Y,
    revenueGrowth: fundamentals?.revenueGrowth ?? null,
    earningsGrowth: fundamentals?.earningsGrowth ?? null,
    roe: summary.roe,
    netMargin: fundamentals?.netMargin ?? null,
    debtToEquity: fundamentals?.debtToEquity ?? null,
    isFinancial: isFinancial(summary),
    per: summary.per,
    pbv: summary.pbv,
    valuation: VALUATION_TO_ACCEL[pillars.valuation.verdict],
    fairValue: pillars.valuation.fairValue,
    tradedValue: summary.value,
    ema20: trendEma.ema20,
    ema50: trendEma.ema50,
    trend: trendEma.trend,
    rsi14: finite(indicators.rsi14) ? indicators.rsi14 : null,
    macdSignalType: indicators.macdSignalType,
  }), [price, summary, fundamentals, pillars, trendEma, indicators]);
  const changeTone = SIGNAL_TONE[changeSignal(accel.change)];
  const lagTone = SIGNAL_TONE[lagSignal(accel.lag)];

  const report = useMemo(() => {
    const outlook = businessOutlook(fundamentals);
    const health = HEALTH_SIGNAL[pillars.health.verdict];
    const valuation = VALUATION_SIGNAL[pillars.valuation.verdict];
    const trend = trendEma.trend;
    const momentumRead = momentumOf({
      price, vwap, ema20, ema50: trendEma.ema50, candle: priceAction.lastCandleColor,
      macdHist: indicators.macdHistogram, rsi: indicators.rsi14, rvol: volume.relativeVolume,
    });
    const momentum = momentumRead.momentum;
    const intradayStatus = toTradeStatus(intradayReview);
    const swingStatus = toTradeStatus(swingReview);
    const baseInvestStatus = toInvestStatus(investingReview.decision);

    const support = supports.find((s) => valid(s) && s < price) ?? null;
    const resistance = resistances.find((r) => valid(r) && r > price) ?? null;
    const long = tradingPlan.bullish;
    const longValid = long.validationErrors.length === 0 && valid(long.entry) && valid(long.sl) && long.sl < long.entry;
    const intradayErrors = validatePlanLevels(intradayReview.levels);
    const swingErrors = validatePlanLevels(swingReview.levels);

    // LONG level hierarchy: R1 = breakout trigger → EMA20 = konfirmasi (reclaim) bila masih di atas harga →
    // TP1/TP2 = resistance di atas level konfirmasi tertinggi. Target never sits at/below the entry trigger.
    const emaReclaim = valid(ema20) && ema20 > price ? ema20 : null;
    const keyEntry = Math.max(resistance ?? 0, emaReclaim ?? 0) || null;
    // Targets: validated resistances strictly above the trigger, de-duplicated, never padded (§1–2).
    const keyTargets = valid(keyEntry) ? pickTargets(resistances, keyEntry) : [];
    const keyTp1 = keyTargets[0] ?? null;
    const keyTp2 = keyTargets[1] ?? null;
    const keyTp3 = keyTargets[2] ?? null;

    const accZone = valid(pillars.valuation.accumulationLow) && valid(pillars.valuation.accumulationHigh)
      ? `${fmtRp(pillars.valuation.accumulationLow)} – ${fmtRp(pillars.valuation.accumulationHigh)}`
      : NO_DATA;

    // Extreme YoY growth (low base / one-off) must be proven sustainable before sizing up — never "growth tinggi = accumulate agresif".
    const rg = fundamentals?.revenueGrowth ?? null;
    const eg = fundamentals?.earningsGrowth ?? null;
    const growthUnproven = (rg != null && rg >= EXTREME_GROWTH_PCT) || (eg != null && eg >= EXTREME_GROWTH_PCT);
    const investStatus: InvestStatus = baseInvestStatus === 'ACCUMULATE' && growthUnproven ? 'ACCUMULATE BERTAHAP' : baseInvestStatus;
    const growthNote = growthUnproven
      ? `Growth ekstrem (pendapatan ${rg != null ? fmtPct(rg, 1) : NO_DATA}, laba ${eg != null ? fmtPct(eg, 1) : NO_DATA} YoY) belum terbukti sustainable — bisa karena basis rendah/one-off. Akumulasi bertahap (mis. 3 tahap), tambah posisi hanya bila 1–2 laporan kuartal berikutnya mengonfirmasi growth berlanjut.`
      : null;

    // Four distinct entry types — each with its own basis and invalidation, never merged into one "entry ideal".
    const deepLow = longValid ? Math.min(long.entry, long.avgDown ?? long.entry) : support;
    const deepHigh = longValid ? long.entry : support;
    const deepZone = valid(deepLow) && valid(deepHigh) && deepHigh < price
      ? (Math.round(deepLow) === Math.round(deepHigh) ? fmtRp(deepHigh) : `${fmtRp(deepLow)} – ${fmtRp(deepHigh)}`)
      : NO_DATA;
    const deepSl = longValid ? long.sl : null;
    const keyLevels = { side: 'LONG' as const, entry: keyEntry, tp1: keyTp1, tp2: keyTp2, tp3: keyTp3, sl: deepSl ?? support, breakout: resistance };
    const keyErrors = validatePlanLevels(keyLevels);
    const qa: Array<{ name: string; checks: PlanQaCheck[] }> = [
      { name: '⚡ Intraday', checks: planQaChecks(intradayReview.levels) },
      { name: '📈 Swing', checks: planQaChecks(swingReview.levels) },
      { name: '🎯 Key Level', checks: planQaChecks(keyLevels) },
    ];
    const fundamentalBroken = health.signal === 'red' || baseInvestStatus === 'AVOID';
    const entries: EntryType[] = [
      {
        icon: '💎', label: 'Investor Accumulation', zone: accZone, basis: 'Fundamental-based (area valuasi)',
        invalidation: 'Thesis batal bila laba turun > 20% YoY, ROE < 5%, atau DER > 2×.',
        note: investStatus === 'ACCUMULATE BERTAHAP' ? 'Bertahap — growth perlu dibuktikan sustainable.'
          : investStatus === 'ACCUMULATE' ? null : `Belum berlaku — Investing ${investStatus}.`,
        tone: 'positive',
      },
      {
        icon: '⚡', label: 'Swing Entry',
        zone: swingStatus !== 'BUY' && emaReclaim != null
          ? `Close > ${fmtRp(emaReclaim)} (reclaim EMA20) + RVOL ≥ 1× + candle hijau`
          : fieldText(findField(swingReview, 'Entry')),
        basis: 'Technical confirmation (reclaim EMA20)',
        invalidation: fieldText(findField(swingReview, 'SL/Invalidation')),
        note: swingStatus === 'INVALID PLAN' ? `INVALID PLAN — ${swingErrors.join(' · ')}.`
          : swingStatus === 'BUY' ? null
            : `Swing ${swingStatus} — tunggu konfirmasi, jangan antisipasi.${emaReclaim != null && valid(resistance) && resistance < emaReclaim ? ` Urutan: breakout > ${fmtRp(resistance)} dulu, lalu close > EMA20 ${fmtRp(emaReclaim)}.` : ''}`,
        tone: 'info',
      },
      {
        icon: '🚀', label: 'Technical Breakout',
        zone: valid(resistance)
          ? `Trigger: Close > ${fmtRp(resistance)} + RVOL ≥ 1,5×${emaReclaim != null && emaReclaim > resistance ? ` → Konfirmasi: Close > EMA20 ${fmtRp(emaReclaim)}` : ''}`
          : NO_DATA,
        basis: 'Technical breakout — bukan konfirmasi fundamental rerating',
        invalidation: valid(resistance) ? `Close kembali < ${fmtRp(resistance)} (false breakout).` : NO_DATA,
        note: keyErrors.length > 0 ? `INVALID PLAN — ${keyErrors.join(' · ')}.`
          : valid(keyTp1) ? `Target ${[keyTp1, keyTp2, keyTp3].filter(valid).map(fmtRp).join(' → ')} (resistance di atas level ${fmtRp(keyEntry)}).`
            : valid(keyEntry) ? `Target ${NO_DATA} — tidak ada resistance di atas ${fmtRp(keyEntry)}.` : null,
        tone: 'positive',
      },
      {
        icon: '🛡️', label: 'Deep Value / Support', zone: deepZone,
        basis: 'Support teknikal — hanya jika fundamental tetap valid',
        invalidation: valid(deepSl) ? `Close < ${fmtRp(deepSl)} (support jebol).` : NO_DATA,
        note: fundamentalBroken ? 'Tidak berlaku — fundamental lemah (risiko value trap).' : 'Tunggu harga turun ke area ini; jangan beli bila turun karena berita fundamental buruk.',
        tone: 'warning',
      },
    ];

    const businessShort = outlook.signal === 'green' && health.signal !== 'red' ? 'bagus'
      : outlook.signal === 'red' || health.signal === 'red' ? 'lemah'
        : outlook.signal === 'na' && health.signal === 'na' ? 'data tidak tersedia' : 'netral';

    const riskGate = [
      swingStatus !== 'BUY' && emaReclaim != null ? `swing: harga belum close > EMA20 ${fmtRp(emaReclaim)} dengan RVOL ≥ 1×` : null,
      intradayErrors.length > 0 || swingErrors.length > 0 || keyErrors.length > 0 ? 'level plan INVALID (TP ≤ Entry / SL ≥ Entry)' : null,
      vwap != null ? `intraday: harga < VWAP ${fmtRp(vwap)}` : null,
      valid(deepSl) ? `close < ${fmtRp(deepSl)} (support jebol — semua setup teknikal batal)` : null,
      `harga sudah lari > 3% di atas level entry tanpa pullback${valid(resistance) ? ` (jangan kejar menuju ${fmtRp(resistance)})` : ''}`,
      growthUnproven ? 'investor: menambah posisi besar sekaligus sebelum growth terbukti sustainable' : null,
    ].filter(Boolean).join(', atau ');

    const attractive = swingStatus === 'BUY' || investStatus === 'ACCUMULATE' || investStatus === 'ACCUMULATE BERTAHAP'
      || (investStatus === 'WAIT / HOLD EXISTING' && trend !== 'bearish')
      || (trend === 'bullish' && health.signal !== 'red' && valuation.signal !== 'red');
    const reasons = [
      health.signal !== 'na' && `fundamental ${health.label.toLowerCase()}`,
      `trend ${TREND_LABEL[trend].toLowerCase()}`,
      valuation.signal !== 'na' && `valuasi ${valuation.short}`,
    ].filter(Boolean).join(', ');
    const trigger = swingStatus === 'BUY'
      ? `harga bertahan di area entry swing ${fieldText(findField(swingReview, 'Entry'))} dengan volume`
      : fieldText(findField(swingReview, 'Entry')).replace(/^Tunggu:\s*/, '').replace(/\.$/, '');
    const conclusion = `${ticker} ${attractive ? 'menarik' : 'tidak menarik'} karena ${reasons}${growthUnproven ? ' (growth ekstrem perlu dibuktikan sustainable)' : ''}, tetapi entry teknikal hanya valid jika ${trigger}.`;

    return {
      outlook, health, valuation, trend, momentum, momentumRead, qa, keyTp3, intradayStatus, swingStatus, investStatus, growthNote,
      support, resistance, long, longValid, emaReclaim, keyEntry, keyTp1, keyTp2, keyErrors, intradayErrors, swingErrors,
      accZone, entries, businessShort, riskGate, conclusion,
    };
  }, [fundamentals, pillars, trendEma, indicators, volume, priceAction, intradayReview, swingReview, investingReview, supports, resistances, price, tradingPlan, vwap, ticker, ema20]);

  const fundamentalChanges = pillars.health.summary || NO_DATA;
  const { fundamentalRows, intradayPlan, swingPlan, investingPlan } = useMemo(() => {
    const fundamentalRows: Array<[string, string]> = [
      ['Revenue (nominal)', NO_DATA],
      ['Pertumbuhan revenue', finite(fundamentals?.revenueGrowth) ? `${fmtPct(fundamentals!.revenueGrowth, 1)} YoY` : NO_DATA],
      ['Laba bersih (nominal)', NO_DATA],
      ['Net margin', finite(fundamentals?.netMargin) ? fmtPctPlain(fundamentals!.netMargin) : NO_DATA],
      ['Pertumbuhan laba', finite(fundamentals?.earningsGrowth) ? `${fmtPct(fundamentals!.earningsGrowth, 1)} YoY` : NO_DATA],
      ['ROE', finite(summary.roe) && summary.roe !== 0 ? fmtPctPlain(summary.roe) : NO_DATA],
      ['DER', finite(fundamentals?.debtToEquity) ? fmtMultiple(fundamentals!.debtToEquity / 100, 2) : isFinancial(summary) ? `${NO_DATA} (bank/keuangan)` : NO_DATA],
      ['Arus kas operasi', NO_DATA],
    ];

    const swingInvalidation = report.longValid ? report.long.invalidationRule : fieldText(findField(swingReview, 'SL/Invalidation'));
    const intradayPlan: Array<[string, string, Tone?]> = [
      ['Entry', fieldText(findField(intradayReview, 'Entry')), 'positive'],
      ['TP', fieldText(findField(intradayReview, 'Target'))],
      ['SL', fieldText(findField(intradayReview, 'Invalidation')), 'negative'],
      ['Trigger', fieldText(findField(intradayReview, 'Confirmation'))],
      ['Risk utama', fieldText(findField(intradayReview, 'Risk'))],
      ...invalidRow(report.intradayErrors),
    ];
    const swingPlan: Array<[string, string, Tone?]> = [
      ['Entry', fieldText(findField(swingReview, 'Entry')), 'positive'],
      ['TP1', fieldText(findField(swingReview, 'TP1'))],
      ...(valid(swingReview.levels?.tp2) ? [['TP2', fieldText(findField(swingReview, 'TP2'))] as [string, string]] : []),
      ...(valid(swingReview.levels?.tp3) ? [['TP3', `${fmtRp(swingReview.levels!.tp3!)} (resistance ketiga)`] as [string, string]] : []),
      ['SL', fieldText(findField(swingReview, 'SL/Invalidation')), 'negative'],
      ['Invalidation', swingInvalidation, 'negative'],
      ['Catalyst', `${NO_DATA} — cek tab Berita & Aksi Korporasi.`],
      ...invalidRow(report.swingErrors),
    ];
    const accHigh = pillars.valuation.accumulationHigh;
    const positionNote = report.investStatus === 'WAIT / HOLD EXISTING' || report.investStatus === 'WAIT'
      ? `Belum punya: WAIT${valid(accHigh) && price > accHigh ? ` — harga ${fmtRp(price)} masih di atas area akumulasi (${fmtPct((price / accHigh - 1) * 100, 0)})` : ''}, tunggu harga masuk area akumulasi. Sudah punya: HOLD selama thesis valid.`
      : null;
    const investingPlan: Array<[string, string, Tone?]> = [
      ...(positionNote ? [['Posisi', positionNote] as [string, string]] : []),
      ['Area akumulasi (valuasi)', report.accZone, 'positive'],
      ...(report.growthNote ? [['Catatan growth', report.growthNote, 'negative'] as [string, string, Tone]] : []),
      ['Target valuasi', valid(pillars.valuation.fairValue) ? `${fmtRp(pillars.valuation.fairValue)} (gap ${fmtPct(pillars.valuation.upsidePct, 0)})` : NO_DATA],
      ['Risiko fundamental', fieldText(findField(investingReview, 'Risk')), 'negative'],
      ['Thesis', fieldText(findField(investingReview, 'Thesis'))],
      ['Horizon', '1–3 tahun (evaluasi tiap rilis laporan keuangan kuartalan)'],
    ];
    return { fundamentalRows, intradayPlan, swingPlan, investingPlan };
  }, [fundamentals, summary, report, intradayReview, swingReview, investingReview, pillars, price]);

  // Technical breakout (price vs resistance) is reported apart from fundamental rerating — one never implies the other.
  const technicalBreakout = valid(report.resistance) ? `Belum — trigger close > ${fmtRp(report.resistance)}` : NO_DATA;

  const getShareText = useCallback(() => {
    const lines = (rows: Array<[string, string, Tone?]> | Array<[string, string]>) => rows.map(([l, v]) => `${l}: ${v}`).join('\n');
    return [
      `📊 ${ticker} — 1 MINUTE STOCK ANALYSIS`,
      [
        '1️⃣ BISNIS',
        `• Sektor: ${summary.sector || NO_DATA}${summary.subSector ? ` / ${summary.subSector}` : ''}`,
        `• Bisnis utama: ${NO_DATA}`,
        `• Sumber pendapatan: ${NO_DATA}`,
        `• Pengendali/pemegang saham utama: ${NO_DATA} (free float ${pillars.business.freeFloat})`,
        `• Prospek bisnis 1–3 tahun: ${SIGNAL_EMOJI[report.outlook.signal]} ${report.outlook.label}`,
        `Alasan: ${report.outlook.reason}`,
      ].join('\n'),
      ['2️⃣ FUNDAMENTAL — 1 TAHUN', ...fundamentalRows.map(([l, v]) => `• ${l}: ${v}`), `• Perubahan penting: ${fundamentalChanges}`,
        `→ Fundamental: ${SIGNAL_EMOJI[report.health.signal]} ${report.health.label}`].join('\n'),
      [
        '3️⃣ HARGA SAHAM — 1 TAHUN',
        `• Harga sekarang: ${rpOr(price)}`,
        `• High 1Y: ${rpOr(summary.annualHigh)}`,
        `• Low 1Y: ${rpOr(summary.annualLow)}`,
        `• Return 1Y: ${finite(summary.percentChange1Y) ? fmtPct(summary.percentChange1Y, 1) : NO_DATA}`,
        `• Posisi harga: ${pricePosition(price, summary.annualLow, summary.annualHigh)}`,
        `• Trend: ${TREND_LABEL[report.trend]}`,
      ].join('\n'),
      [
        '4️⃣ VALUASI',
        `• PER: ${pillars.valuation.per}`,
        `• PBV: ${pillars.valuation.pbv}`,
        ...pillars.valuation.methods.map((m) => `• ${m.label}: ${rpOr(m.fairValue)}`),
        `• Estimasi nilai wajar: ${rpOr(pillars.valuation.fairValue)}`,
        `• Harga sekarang: ${rpOr(price)}`,
        `→ ${SIGNAL_EMOJI[report.valuation.signal]} ${report.valuation.label}`,
      ].join('\n'),
      [
        '5️⃣ FUNDAMENTAL CHANGE vs PRICE LAG',
        ...accel.lines.map((l) => `• ${l.label}: ${l.value} ${SIGNAL_EMOJI[l.signal]}`),
        `• Fundamental Score: ${accel.fundamentalScore != null ? `${accel.fundamentalScore}/100` : NO_DATA}`,
        `• Earnings vs Price: ${accel.earningsVsPrice}`,
        `• Technical Stage: ${TECHNICAL_STAGE_LABEL[accel.stage]}`,
        `• Fundamental Rerating Potential: ${SIGNAL_EMOJI[accel.reratingPotential.signal]} ${accel.reratingPotential.label}`,
        ...(accel.risks.length ? [`• Risk: ${accel.risks.join(' · ')}`] : []),
        `• Syarat rerating: ${accel.requirements.join(' ')}`,
        `→ Fundamental Change: ${SIGNAL_EMOJI[changeSignal(accel.change)]} ${FUNDAMENTAL_CHANGE_LABEL[accel.change]}`,
        `→ Price Lag: ${SIGNAL_EMOJI[lagSignal(accel.lag)]} ${PRICE_LAG_LABEL[accel.lag]}`,
        `→ Status: ${RERATING_STATUS_LABEL[accel.status]} — ${accel.reason}`,
      ].join('\n'),
      [
        '6️⃣ TEKNIKAL',
        `• EMA 9/20/50/200: ${rpOr(ema9)} / ${rpOr(ema20)} / ${rpOr(trendEma.ema50)} / ${rpOr(trendEma.ema200)}`,
        `• RSI14: ${finite(indicators.rsi14) ? fmtNum(indicators.rsi14, 1) : NO_DATA}`,
        `• MACD hist: ${finite(indicators.macdHistogram) ? fmtNum(indicators.macdHistogram, 2) : NO_DATA}`,
        `• RVOL: ${valid(volume.relativeVolume) ? fmtMultiple(volume.relativeVolume, 2) : NO_DATA}`,
        `• Support: ${rpOr(report.support)} · Resistance: ${rpOr(report.resistance)}`,
        `• VWAP: ${vwap != null ? fmtRp(vwap) : NO_DATA}`,
        `• Price Action: ${priceAction.patternLabel}`,
        `→ Trend: ${TREND_LABEL[report.trend]} · Momentum: ${report.momentum} (skor ${report.momentumRead.score}: ${report.momentumRead.factors.map((f) => `${f.label} ${f.text}`).join(', ')})`,
      ].join('\n'),
      [
        '7️⃣ TRADING PLAN',
        `⚡ INTRADAY — Status: ${report.intradayStatus}\n${lines(intradayPlan)}`,
        `📈 SWING 1–5 HARI — Status: ${report.swingStatus}\n${lines(swingPlan)}`,
        `💰 INVESTING — Status: ${report.investStatus}\n${lines(investingPlan)}`,
      ].join('\n\n'),
      [
        '8️⃣ FINAL 10-SECOND REVIEW',
        `🏢 Bisnis: ${report.businessShort}`,
        `📈 Trend: ${TREND_LABEL[report.trend].toLowerCase()}`,
        `🔥 Momentum: ${report.momentum === 'Strong' ? 'kuat' : report.momentum === 'Weak' ? 'lemah' : 'normal'}`,
        `💰 Valuasi: ${report.valuation.short}`,
        `⚡ Intraday: ${report.intradayStatus}`,
        `📈 Swing: ${report.swingStatus}`,
        `💎 Investing: ${report.investStatus}`,
        `🚀 Technical Breakout: ${technicalBreakout}`,
        `🧬 Fundamental Rerating: ${RERATING_STATUS_LABEL[accel.status]}`,
        '',
        '🎯 KEY LEVEL:',
        `Support: ${rpOr(report.support)}`,
        `Resistance (breakout trigger): ${rpOr(report.resistance)}`,
        ...(report.emaReclaim != null ? [`Konfirmasi (reclaim EMA20): ${fmtRp(report.emaReclaim)}`] : []),
        `TP1: ${rpOr(report.keyTp1)}${valid(report.keyTp2) ? ` · TP2: ${fmtRp(report.keyTp2)}` : ''}${valid(report.keyTp3) ? ` · TP3: ${fmtRp(report.keyTp3)}` : ''}`,
        ...(report.keyErrors.length > 0 ? [`Status: INVALID PLAN — ${report.keyErrors.join(' · ')}`] : []),
        '',
        ...report.entries.flatMap((e) => [
          `${e.icon} ${e.label.toUpperCase()}`,
          e.zone,
          `→ ${e.basis}`,
          `Invalidasi: ${e.invalidation}`,
          ...(e.note ? [e.note] : []),
          '',
        ]),
        `✅ FINAL QA VALIDATOR:\n${report.qa.map((q) => `${q.name}: ${qaText(q.checks)}`).join('\n')}`,
        '',
        `🚨 RISK GATE:\nJangan entry jika ${report.riskGate}.`,
        '',
        `KESIMPULAN 1 KALIMAT:\n"${report.conclusion}"`,
      ].join('\n'),
      '⚠️ Jangan FOMO. Buy Area ≠ otomatis BUY. Entry hanya setelah konfirmasi. Target adalah proyeksi, bukan janji profit. Edukasi, bukan ajakan jual/beli.',
    ].join('\n\n');
  }, [ticker, summary, pillars, report, fundamentalRows, fundamentalChanges, price, ema9, ema20, trendEma, indicators, volume, vwap, priceAction, intradayPlan, swingPlan, investingPlan, accel, technicalBreakout]);

  const rsi = finite(indicators.rsi14) ? indicators.rsi14 : null;
  const macd = finite(indicators.macdHistogram) ? indicators.macdHistogram : null;

  return (
    <Card aria-labelledby="one-minute-title">
      <PanelTitle icon={Timer} id="one-minute-title" action={<CopyShareButton getText={getShareText} />}>
        📊 {ticker} — 1 Minute Stock Analysis
      </PanelTitle>

      <div className="space-y-4 p-4">
        {intraday === null && (
          <p className="flex items-center gap-1.5 text-xs text-(--sv-muted)">
            <Loader2 className="size-3.5 animate-spin" /> Memuat data intraday…
          </p>
        )}

        {/* 1️⃣ BISNIS */}
        <Section n="1️⃣" title="Bisnis" verdict={<SignalBadge signal={report.outlook.signal} label={`Prospek ${report.outlook.label}`} />}>
          <DataList rows={[
            ['Emiten', summary.name || NO_DATA],
            ['Sektor', summary.sector ? `${summary.sector}${summary.subSector ? ` · ${summary.subSector}` : ''}` : NO_DATA],
            ['Bisnis utama', NO_DATA],
            ['Sumber pendapatan', NO_DATA],
            ['Pengendali / pemegang utama', NO_DATA],
            ['Free float', pillars.business.freeFloat],
            ['Ukuran', pillars.business.sizeNote],
          ]} />
          <Interpretation>
            Prospek 1–3 tahun: <strong>{SIGNAL_EMOJI[report.outlook.signal]} {report.outlook.label}</strong>. {report.outlook.reason}
          </Interpretation>
        </Section>

        {/* 2️⃣ FUNDAMENTAL */}
        <Section n="2️⃣" title="Fundamental — 1 Tahun" verdict={<SignalBadge signal={report.health.signal} label={report.health.label} />}>
          <DataList rows={fundamentalRows} />
          <Interpretation>
            <strong>{SIGNAL_EMOJI[report.health.signal]} {report.health.label}.</strong> Perubahan penting: {fundamentalChanges}
          </Interpretation>
        </Section>

        {/* 3️⃣ HARGA 1Y */}
        <Section n="3️⃣" title="Harga Saham — 1 Tahun" verdict={<Badge tone={TREND_TONE[report.trend]}>{TREND_LABEL[report.trend]}</Badge>}>
          <DataList rows={[
            ['Harga sekarang', rpOr(price)],
            ['High 1Y', rpOr(summary.annualHigh)],
            ['Low 1Y', rpOr(summary.annualLow)],
            ['Return 1Y', finite(summary.percentChange1Y) ? fmtPct(summary.percentChange1Y, 1) : NO_DATA],
            ['Return YTD', finite(summary.percentChangeYtd) ? fmtPct(summary.percentChangeYtd, 1) : NO_DATA],
            ['Return 3M', finite(summary.percentChange3M) ? fmtPct(summary.percentChange3M, 1) : NO_DATA],
          ]} />
          <Interpretation>
            Posisi harga: <strong>{pricePosition(price, summary.annualLow, summary.annualHigh)}</strong>. Trend: <strong>{TREND_LABEL[report.trend]}</strong> — {trendEma.trendDescription}
          </Interpretation>
        </Section>

        {/* 4️⃣ VALUASI */}
        <Section n="4️⃣" title="Valuasi" verdict={<SignalBadge signal={report.valuation.signal} label={report.valuation.label} />}>
          <DataList rows={[
            ['PER', pillars.valuation.per],
            ['PBV', pillars.valuation.pbv],
            ...pillars.valuation.methods.map((m): [string, string] => [m.label, rpOr(m.fairValue)]),
            ['Estimasi nilai wajar', rpOr(pillars.valuation.fairValue)],
            ['Harga sekarang', rpOr(price)],
            ['Historical / peer', NO_DATA],
          ]} />
          <Interpretation>
            <strong>{SIGNAL_EMOJI[report.valuation.signal]} {report.valuation.label}.</strong> {pillars.valuation.summary}
          </Interpretation>
        </Section>

        {/* 5️⃣ FUNDAMENTAL CHANGE vs PRICE LAG */}
        <Section
          n="5️⃣"
          title="Fundamental Change vs Price Lag"
          verdict={<Badge tone={RERATING_TONE[accel.status]}>{RERATING_STATUS_LABEL[accel.status]}</Badge>}
        >
          <dl className="grid gap-x-4 gap-y-0.5 text-sm sm:grid-cols-2">
            {accel.lines.map((l) => (
              <div key={l.label} className="flex justify-between gap-3 border-b border-(--sv-border)/70 py-1.5">
                <dt className="shrink-0 text-(--sv-muted)">{l.label}</dt>
                <dd className={cn('min-w-0 text-right font-medium tabular-nums', l.value.startsWith(NO_DATA) ? 'text-xs text-(--sv-muted)' : 'text-(--sv-text)')}>
                  {l.value} <span aria-hidden="true">{SIGNAL_EMOJI[l.signal]}</span>
                </dd>
              </div>
            ))}
          </dl>

          <div className="grid gap-2 text-sm sm:grid-cols-2">
            {([
              [
                'Fundamental Score',
                accel.fundamentalScore != null ? `${accel.fundamentalScore}/100` : NO_DATA,
                accel.fundamentalScore == null ? 'neutral' : accel.fundamentalScore >= 60 ? 'positive' : accel.fundamentalScore >= 40 ? 'warning' : 'negative',
              ],
              ['Fundamental Change', `${SIGNAL_EMOJI[changeSignal(accel.change)]} ${FUNDAMENTAL_CHANGE_LABEL[accel.change]}`, changeTone],
              ['Price Lag', `${SIGNAL_EMOJI[lagSignal(accel.lag)]} ${PRICE_LAG_LABEL[accel.lag]}`, lagTone],
              [
                'Technical Stage',
                TECHNICAL_STAGE_LABEL[accel.stage],
                accel.stage === 'UPTREND' ? 'positive' : accel.stage === 'DOWNTREND' ? 'negative' : accel.stage === 'DATA_KURANG' ? 'neutral' : 'warning',
              ],
              ['Fundamental Rerating Potential', `${SIGNAL_EMOJI[accel.reratingPotential.signal]} ${accel.reratingPotential.label}`, SIGNAL_TONE[accel.reratingPotential.signal]],
              ['Status', RERATING_STATUS_LABEL[accel.status], RERATING_TONE[accel.status]],
            ] as Array<[string, string, Tone]>).map(([label, value, tone]) => (
              <div key={label} className="flex items-center justify-between gap-2 rounded-lg bg-(--sv-surface) px-3 py-2">
                <span className="text-(--sv-muted)">{label}</span>
                <Badge tone={tone}>{value}</Badge>
              </div>
            ))}
          </div>

          <Interpretation>
            <strong>{accel.earningsVsPrice}.</strong> {accel.reason}
            {accel.risks.length > 0 && (
              <ul className="mt-2 space-y-1 text-rose-700 dark:text-rose-300">
                {accel.risks.map((r) => <li key={r}>{r}</li>)}
              </ul>
            )}
            <span className="mt-2 block text-[11px] font-semibold uppercase tracking-wide text-(--sv-muted)">Syarat agar rerating terjadi</span>
            <ul className="mt-1 space-y-1">
              {accel.requirements.map((r) => (
                <li key={r} className="flex items-start gap-2">
                  <span className="mt-2 size-1 shrink-0 rounded-full bg-(--sv-muted)" />
                  {r}
                </li>
              ))}
            </ul>
            <span className="mt-2 block text-xs text-(--sv-muted)">Bukan kepastian harga naik — rerating hanya terjadi bila syarat di atas terpenuhi. Technical breakout ≠ fundamental rerating: breakout harga tanpa perbaikan fundamental bukan rerating.</span>
          </Interpretation>
        </Section>

        {/* 6️⃣ TEKNIKAL */}
        <Section
          n="6️⃣"
          title="Teknikal"
          verdict={(
            <div className="flex flex-wrap gap-1.5">
              <Badge tone={TREND_TONE[report.trend]}>Trend {TREND_LABEL[report.trend]}</Badge>
              <Badge tone={MOMENTUM_TONE[report.momentum]}>Momentum {report.momentum}</Badge>
            </div>
          )}
        >
          <DataList rows={[
            ['EMA 9 / 20', `${rpOr(ema9)} / ${rpOr(ema20)}`],
            ['EMA 50 / 200', `${rpOr(trendEma.ema50)} / ${rpOr(trendEma.ema200)}`],
            ['RSI 14', rsi != null ? fmtNum(rsi, 1) : NO_DATA],
            ['MACD hist', macd != null ? `${fmtNum(macd, 2)} (${indicators.macdSignalType.replace('_', ' ')})` : NO_DATA],
            ['Volume / RVOL', valid(volume.relativeVolume) ? `${fmtMultiple(volume.relativeVolume, 2)} MA20 · ${volume.volumeTrend}` : NO_DATA],
            ['VWAP (intraday)', vwap != null ? fmtRp(vwap) : NO_DATA],
            ['Support', supports.filter((s) => valid(s) && s < price).slice(0, 2).map(fmtRp).join(' · ') || NO_DATA],
            ['Resistance', resistances.filter((r) => valid(r) && r > price).slice(0, 2).map(fmtRp).join(' · ') || NO_DATA],
            ['Price action', priceAction.patternLabel || NO_DATA],
          ]} />
          <Interpretation>
            <ul className="mt-1 space-y-1">
              {[
                valid(ema9) && valid(ema20)
                  ? (price > ema9 && ema9 > ema20 ? 'Harga > EMA9 > EMA20 — momentum jangka pendek naik.' : price < ema9 && ema9 < ema20 ? 'Harga < EMA9 < EMA20 — momentum jangka pendek turun.' : 'EMA9/20 campur — jangka pendek konsolidasi.')
                  : null,
                `Momentum ${report.momentum} (skor ${report.momentumRead.score >= 0 ? '+' : ''}${report.momentumRead.score}) — ${report.momentumRead.factors.map((f) => `${f.label}: ${f.text}`).join(' · ')}.`,
                indicators.rsiNote,
                indicators.macdNote,
                ...volume.notes.slice(0, 1),
                ...priceAction.notes.slice(0, 2),
              ].filter((x): x is string => Boolean(x)).map((s) => (
                <li key={s} className="flex items-start gap-2">
                  <span className="mt-2 size-1 shrink-0 rounded-full bg-(--sv-muted)" />
                  {s}
                </li>
              ))}
            </ul>
          </Interpretation>
        </Section>

        {/* 7️⃣ TRADING PLAN */}
        <Section n="7️⃣" title="Trading Plan">
          <div className="grid gap-3">
            <PlanCard title="⚡ Intraday" badge={<Badge tone={TRADE_TONE[report.intradayStatus]}>{report.intradayStatus}</Badge>}>
              <PlanList rows={intradayPlan} />
              <p className="text-xs text-(--sv-muted)">{intradayReview.reason}</p>
            </PlanCard>
            <PlanCard title="📈 Swing 1–5 Hari" badge={<Badge tone={TRADE_TONE[report.swingStatus]}>{report.swingStatus}</Badge>}>
              <PlanList rows={swingPlan} />
              <p className="text-xs text-(--sv-muted)">{swingReview.reason}</p>
            </PlanCard>
            <PlanCard title="💰 Investing" badge={<Badge tone={INVEST_TONE[report.investStatus]}>{report.investStatus}</Badge>}>
              <PlanList rows={investingPlan} />
              <p className="text-xs text-(--sv-muted)">{investingReview.reason}</p>
            </PlanCard>
          </div>
        </Section>

        {/* 8️⃣ FINAL REVIEW */}
        <Section n="8️⃣" title="Final 10-Second Review">
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            {([
              ['🏢 Bisnis', report.businessShort, report.businessShort === 'bagus' ? 'positive' : report.businessShort === 'lemah' ? 'negative' : 'warning'],
              ['📈 Trend', TREND_LABEL[report.trend].toLowerCase(), TREND_TONE[report.trend]],
              ['🔥 Momentum', report.momentum === 'Strong' ? 'kuat' : report.momentum === 'Weak' ? 'lemah' : 'normal', MOMENTUM_TONE[report.momentum]],
              ['💰 Valuasi', report.valuation.short, SIGNAL_TONE[report.valuation.signal]],
              ['⚡ Intraday', report.intradayStatus, TRADE_TONE[report.intradayStatus]],
              ['📈 Swing', report.swingStatus, TRADE_TONE[report.swingStatus]],
              ['💎 Investing', report.investStatus, INVEST_TONE[report.investStatus]],
              ['🚀 Technical Breakout', technicalBreakout, valid(report.resistance) ? 'warning' : 'neutral'],
              ['🧬 Fundamental Rerating', RERATING_STATUS_LABEL[accel.status], RERATING_TONE[accel.status]],
            ] as Array<[string, string, Tone]>).map(([label, value, tone]) => (
              <div key={label} className="flex items-center justify-between gap-2 rounded-lg bg-(--sv-surface) px-3 py-2">
                <span className="text-(--sv-muted)">{label}</span>
                <Badge tone={tone}>{value}</Badge>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-(--sv-border) bg-(--sv-surface) p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-(--sv-muted)">🎯 Key Level</p>
            <DataList rows={[
              ['Support', rpOr(report.support)],
              ['Resistance (breakout trigger)', rpOr(report.resistance)],
              ...(report.emaReclaim != null ? [['Konfirmasi (reclaim EMA20)', fmtRp(report.emaReclaim)] as [string, string]] : []),
              ['TP1', rpOr(report.keyTp1)],
              ...(valid(report.keyTp2) ? [['TP2', fmtRp(report.keyTp2)] as [string, string]] : []),
              ...(valid(report.keyTp3) ? [['TP3', fmtRp(report.keyTp3)] as [string, string]] : []),
              ...(report.keyErrors.length > 0 ? [['Status', `INVALID PLAN — ${report.keyErrors.join(' · ')}`] as [string, string]] : []),
            ]} />
            <p className="mt-3 mb-2 text-[11px] font-semibold uppercase tracking-wide text-(--sv-muted)">Entry berdasarkan tipe — label berbeda, jangan dicampur</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {report.entries.map((e) => (
                <div key={e.label} className="space-y-1 rounded-lg border border-(--sv-border) p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-(--sv-text)">{e.icon} {e.label}</span>
                  </div>
                  <p className={cn('font-semibold tabular-nums', e.zone.startsWith(NO_DATA) ? 'text-xs text-(--sv-muted)' : TONE_TEXT[e.tone])}>{e.zone}</p>
                  <p className="text-xs text-(--sv-muted)">→ {e.basis}</p>
                  <p className="text-xs text-rose-600 dark:text-rose-400">Invalidasi: {e.invalidation}</p>
                  {e.note && <p className="text-xs text-(--sv-muted)">{e.note}</p>}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-(--sv-border) bg-(--sv-surface) p-3 text-sm">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-(--sv-muted)">✅ Final QA Validator</p>
            <div className="space-y-2">
              {report.qa.map((q) => (
                <div key={q.name} className="flex flex-col gap-1 sm:flex-row sm:gap-3">
                  <span className="shrink-0 font-medium text-(--sv-text) sm:w-28">{q.name}</span>
                  {q.checks.length === 0 ? (
                    <span className="text-xs text-(--sv-muted)">Tidak ada plan (NO TRADE / {NO_DATA})</span>
                  ) : (
                    <ul className="flex flex-wrap gap-1.5">
                      {q.checks.map((c) => (
                        <li key={c.label}>
                          <Badge tone={c.ok == null ? 'neutral' : c.ok ? 'positive' : 'negative'}>
                            {c.ok == null ? '–' : c.ok ? '✓' : '✗'} {c.label}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-(--sv-muted)">✗ = INVALID PLAN (tidak boleh dieksekusi) · – = level tidak tersedia, tidak dikarang.</p>
          </div>

          <div className="rounded-lg border border-rose-200 bg-rose-50/60 p-3 text-sm text-rose-800 dark:border-rose-400/25 dark:bg-rose-400/5 dark:text-rose-200">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide">🚨 Risk Gate</p>
            Jangan entry jika {report.riskGate}.
          </div>

          <div className="rounded-lg border border-(--sv-primary)/30 bg-(--sv-surface) p-3 text-sm">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-(--sv-muted)">Kesimpulan 1 kalimat</p>
            <p className="font-medium leading-relaxed text-(--sv-text)">&ldquo;{report.conclusion}&rdquo;</p>
          </div>
        </Section>

        <p className="text-xs leading-relaxed text-(--sv-muted)">
          Aturan: jangan FOMO · Buy Area ≠ otomatis BUY · entry hanya setelah konfirmasi · jangan kejar harga yang sudah jauh dari entry ·
          prioritaskan Risk/Reward. Data bisnis/pengendali/nominal laporan keuangan belum ada di sumber data sehingga ditulis &ldquo;{NO_DATA}&rdquo;.
          Data intraday adalah kuotasi tertunda. Target adalah proyeksi, bukan janji profit. Edukasi, bukan ajakan jual/beli.
        </p>
      </div>
    </Card>
  );
}

export function Trading1MinutesReportSkeleton() {
  return (
    <Card as="div" className="space-y-4 p-4">
      <Skeleton className="h-5 w-72" />
      {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-40" />)}
    </Card>
  );
}
