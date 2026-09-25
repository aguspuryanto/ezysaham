'use client';

/**
 * StockAnalysisPage.tsx
 *
 * Comprehensive Stock Analysis Page combining:
 * 1. Fundamental Screening (PER, PBV, ROE, Market Cap, Solvency)
 * 2. Technical Screening (Trend, EMA, S/R, Price Action, RVOL, Indicators)
 * 3. News & Market Sentiment Analysis (Live RSS / Google News / Yahoo Finance)
 * 4. AI Decision Engine (AI Buy/Avoid Advisor with Reasons to Buy & Reasons to Avoid)
 * 5. High-Performance Instant Cache (0ms page load for cached analysis)
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
  Copy,
  Crosshair,
  ExternalLink,
  Eye,
  HelpCircle,
  History,
  Loader2,
  Newspaper,
  NotebookPen,
  PieChart,
  RefreshCw,
  Rocket,
  Settings2,
  Share2,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  XCircle,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LINKS } from '@/lib/site';
import { StockSummary } from '@/domain/models/Stock';
import { OHLCVBar } from '@/domain/models/History';
import {
  CandlePattern,
  EntryType,
  IndicatorAnalysis,
  PriceActionAnalysis,
  SupportResistanceAnalysis,
  TradingPlanAnalysis,
  TrendEmaAnalysis,
  VolumeAnalysis,
} from '@/domain/models/StockAnalysis';
import { classifyOversoldRisk, classifyRsiOverbought, classifyRvol, classifyFundamentalRisk, evaluateRiskGate, BuyPermission, EntryStatus, FundamentalRiskLevel, RiskGateStatus, TradeStatus } from '@/domain/analysis/riskGate';
import { classifyZoneStatus, DEFAULT_SL_PCT, DEFAULT_TP1_PCT, DEFAULT_TP2_PCT, DefaultTargetPlan, isEntryConfirmed, isPriceAtEntryTrigger, isSetupInvalidated, ZoneStatus } from '@/domain/analysis/tradeValidation';
import { computeSwingSuitability, detectSwingSetup, SWING_SETUP_LABEL, SwingSuitabilityResult } from '@/domain/analysis/swingSuitability';
import { buildTenSecondReview, REVIEW_STRATEGY_LABEL } from '@/domain/analysis/tenSecondReview';
import { BULLISH_PHASE_LABEL, BullishPhase, buildSimpleEntryReview, BuyPermission as SimpleBuyPermission, FOMO_RISK_LABEL, formatSimpleEntryReview, MOMENTUM_STATE_LABEL, MomentumState, PRICE_ACTION_LABEL, PriceActionSignal, SIMPLE_ENTRY_LABEL, SIMPLE_FUNDAMENTAL_LABEL, SIMPLE_VOLUME_LABEL, SimpleEntry, SimpleEntryReview, SimpleFundamental, SimpleVolume, TREND_STATE_LABEL, TrendState } from '@/domain/analysis/simpleEntryReview';
import { buildEarlyBullishReview, BUYER_CLASS_LABEL, BuyerClass, EbDecision, ebDecisionLine, ENTRY_CLASS_LABEL, EntryClass, formatEarlyBullishReview, HierarchyScore, MOMENTUM_CLASS_LABEL, MomentumClass, PRICE_ACTION_CLASS_LABEL, PriceActionClass, RiskGateStatus as EbRiskGateStatus, TECHNICAL_STAGE_LABEL, TechnicalStage, TREND_CLASS_LABEL, TrendClass } from '@/domain/analysis/earlyBullishReview';
import { applyFundamentalFilter, buildFundamentalPillars, FUNDAMENTAL_FILTER_LABEL, FundamentalFilter, FundamentalPillars, HEALTH_VERDICT_LABEL, HealthVerdict, VALUATION_VERDICT_LABEL, ValuationVerdict } from '@/domain/analysis/fundamentalPillars';
import { buildTodayMoveAnalysis, CATALYST_STATUS_LABEL, describeClosePosition, EVIDENCE_KIND_LABEL, EvidenceKind, formatTodayMoveAnalysis, MOVE_TYPE_LABEL, MoveType, TODAY_TRADE_STATUS_LABEL, TodayMoveAnalysis, TodayTradeStatus } from '@/domain/analysis/todayMoveAnalysis';
import { atr, atrPercent } from '@/domain/indicators/atr';
import { MarketRegimeResult } from '@/domain/analysis/marketRegimeEngine';
import { useMarketRegime } from './useMarketRegime';
import { StockNewsItem, NewsSentimentSummary, AiStockAdvisor } from '@/domain/models/News';
import { FundamentalDetail } from '@/domain/models/Fundamentals';
import { IntradayResponse } from '@/domain/models/Intraday';
import { getStockIntraday } from '@/data/repositories/StockRepository';
import { vwap } from '@/domain/indicators/vwap';
import { BrokerActivityDetail, BrokerSummaryRow } from '@/domain/models/BrokerSummary';
import { FundamentalScreeningResult, gateAdvisorVerdict } from '@/domain/analysis/aiStockEngine';
import { computeTechnicalScore } from '@/domain/analysis/technicalScore';
import { computeBandarScore, getMarketCyclePhase } from '@/domain/analysis/bandarScore';
import { computeEntryTiming } from '@/domain/analysis/entryTiming';
import { roundToTick } from '@/domain/analysis/idxTick';
import { computeObjectiveConclusion, ConclusionTone, ObjectiveConclusionResult } from '@/domain/analysis/objectiveConclusion';
import { computeQuickDecisionSnapshot, QuickDecisionFactor, QuickDecisionSnapshotResult, QuickVerdict } from '@/domain/analysis/quickDecisionSnapshot';
import { BreakoutScores } from '@/domain/screener/presets';
import { DataFreshness } from '@/domain/analysis/dataFreshness';
import { rsi } from '@/domain/indicators/rsi';
import { macd } from '@/domain/indicators/macd';
import { closes as barCloses, ema, lastValid } from '@/domain/indicators/movingAverages';
import { cn, formatCompact, formatPercent, formatRupiah } from '@/lib/format';
import { SITE_NAME } from '@/lib/site';
import { useWatchlist } from '@/presentation/features/screener/hooks/useWatchlist';
import { useJournal } from '@/presentation/features/journal/hooks/useJournal';
import { PhilosophyBanner } from '@/presentation/features/screener/components/PhilosophyBanner';
import { useStockAnalysis } from './useStockAnalysis';
import { AnalisisReasearchReport } from './AnalisisReasearchReport';
import { DataFreshnessPill, DataFreshnessStaleBanner } from './DataFreshnessBanner';
import { OHLCVChart } from './OHLCVChart';
import { useTradingStyle } from './useTradingStyle';
import { applyTradingStyle } from '@/domain/analysis/tradingStyleAdjuster';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtRp(n: number): string {
  if (Number.isNaN(n) || n === 0) return '–';
  return formatRupiah(n);
}
function fmtN(n: number, dec = 2): string {
  if (Number.isNaN(n)) return '–';
  return n.toFixed(dec);
}

// ─── Pill ─────────────────────────────────────────────────────────────────────
function Pill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: 'green' | 'red' | 'amber' | 'blue' | 'zinc';
}) {
  const map = {
    green: 'bg-emerald-50 text-emerald-700 border-2 border-(--neo-line) dark:bg-emerald-400/10 dark:text-emerald-300',
    red: 'bg-rose-50 text-rose-700 border-2 border-(--neo-line) dark:bg-rose-400/10 dark:text-rose-300',
    amber: 'bg-amber-50 text-amber-700 border-2 border-(--neo-line) dark:bg-amber-400/10 dark:text-amber-300',
    blue: 'bg-blue-50 text-blue-700 border-2 border-(--neo-line) dark:bg-blue-400/10 dark:text-blue-300',
    zinc: 'bg-zinc-100 text-zinc-600 border-2 border-(--neo-line) dark:bg-zinc-800 dark:text-zinc-300',
  };
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 text-sm font-bold', map[tone])}>
      {children}
    </span>
  );
}

// ─── Section Card ─────────────────────────────────────────────────────────────
function SectionCard({
  number,
  title,
  icon,
  accentClass,
  children,
  collapsible = false,
  defaultOpen = true,
  headerAction,
}: {
  number?: number | string;
  title: string;
  icon: React.ReactNode;
  accentClass: string;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  headerAction?: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const showBody = !collapsible || isOpen;

  const titleRow = (
    <>
      <span className={cn('flex size-9 shrink-0 items-center justify-center neo-border text-white text-sm', accentClass)}>
        {icon}
      </span>
      <h2 className="font-bold uppercase tracking-wide text-zinc-800 dark:text-zinc-100 flex items-center gap-1.5 flex-1 min-w-0">
        {number !== undefined && <span className="text-zinc-400 dark:text-zinc-600 mr-1.5">{number}.</span>}
        {title}
      </h2>
      {collapsible && (
        <ChevronDown className={cn('size-4 shrink-0 text-zinc-400 transition-transform', isOpen && 'rotate-180')} strokeWidth={2.5} />
      )}
    </>
  );

  return (
    <section className="neo-border neo-shadow overflow-hidden bg-white dark:bg-zinc-900">
      <div className="flex items-center gap-3 px-5 py-4 border-b-[3px] border-(--neo-line)">
        {collapsible ? (
          <button type="button" onClick={() => setIsOpen((v) => !v)} aria-expanded={isOpen} className="flex items-center gap-3 flex-1 min-w-0 text-left">
            {titleRow}
          </button>
        ) : titleRow}
        {headerAction}
      </div>
      {showBody && <div className="px-5 py-4">{children}</div>}
    </section>
  );
}

// ─── Key-Value Row ─────────────────────────────────────────────────────────────
function KV({ label, value, valueClass, suffix, suffixClass }: {
  label: string;
  value: React.ReactNode;
  valueClass?: string;
  suffix?: string;
  suffixClass?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm py-1">
      <span className="text-zinc-500 dark:text-zinc-400 shrink-0">{label}</span>
      <span className="flex items-baseline gap-1 text-right">
        <span className={cn('font-mono tabular-nums text-zinc-800 dark:text-zinc-200', valueClass)}>
          {value}
        </span>
        {suffix && (
          <span className={cn('font-mono tabular-nums', suffixClass)}>{suffix}</span>
        )}
      </span>
    </div>
  );
}

// ─── Bullet note ──────────────────────────────────────────────────────────────
function Note({ text, tone = 'zinc' }: { text: string; tone?: 'green' | 'red' | 'zinc' }) {
  const colors = {
    green: 'text-emerald-700 dark:text-emerald-400',
    red: 'text-rose-700 dark:text-rose-400',
    zinc: 'text-zinc-600 dark:text-zinc-400',
  };
  return (
    <li className={cn('flex gap-2 text-sm leading-relaxed', colors[tone])}>
      <span className="mt-1 shrink-0 opacity-40">•</span>
      <span>{text}</span>
    </li>
  );
}

// ─── TRADE LEVEL RULE: Default Target block (Current Price basis, -7%/+5%/+10%) ────────────────
// Shared by Section 6 (Rencana Aksi) and the sidebar Trading Plan card. The numbers here are fixed
// per the rule — technical mismatches are surfaced as notes, never used to change sl/tp1/tp2.
function DefaultTargetPlanBlock({ target, isLong }: { target: DefaultTargetPlan; isLong: boolean }) {
  const slSign = isLong ? '-' : '+';
  const tpSign = isLong ? '+' : '-';
  return (
    <div className="neo-border border-(--neo-line) bg-zinc-50 dark:bg-zinc-800/60 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Default Target (Current Price)
        </span>
        <span className="text-[10px] font-mono text-zinc-400 shrink-0">
          SL {slSign}{DEFAULT_SL_PCT}% · TP1 {tpSign}{DEFAULT_TP1_PCT}% · TP2 {tpSign}{DEFAULT_TP2_PCT}%
        </span>
      </div>
      <div className="grid gap-1">
        <KV
          label="Stop Loss"
          value={fmtRp(target.sl)}
          valueClass="text-rose-600 dark:text-rose-400"
          suffix={`${slSign}${DEFAULT_SL_PCT}%`}
          suffixClass="text-rose-500 dark:text-rose-500 text-xs font-semibold"
        />
        <KV
          label="TP 1"
          value={fmtRp(target.tp1)}
          valueClass="text-emerald-600 dark:text-emerald-400"
          suffix={`${tpSign}${DEFAULT_TP1_PCT}%`}
          suffixClass="text-emerald-500 dark:text-emerald-500 text-xs font-semibold"
        />
        <KV
          label="TP 2"
          value={fmtRp(target.tp2)}
          valueClass="text-emerald-600 dark:text-emerald-400"
          suffix={`${tpSign}${DEFAULT_TP2_PCT}%`}
          suffixClass="text-emerald-500 dark:text-emerald-500 text-xs font-semibold"
        />
      </div>
      <div className="flex items-center justify-between border-t-2 border-(--neo-line) pt-1.5">
        <span className="text-[10px] font-bold uppercase text-zinc-400">R:R vs TP1 / TP2</span>
        <span className="font-mono text-xs font-bold text-zinc-700 dark:text-zinc-300">
          1:{fmtN(target.riskRewardRatio1, 2)} · 1:{fmtN(target.riskRewardRatio2, 2)}
        </span>
      </div>
      {!target.stopLossValidation.ok && (
        <div className="space-y-1 pt-1">
          <span className="text-[10px] font-bold uppercase text-amber-700 dark:text-amber-400">⚠️ Stop Loss Validation</span>
          <ul className="space-y-1">
            {target.stopLossValidation.notes.map((note) => (
              <li key={note} className="flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-400 leading-snug">
                <TriangleAlert className="size-3 mt-0.5 shrink-0" strokeWidth={2.5} />
                {note}
              </li>
            ))}
          </ul>
        </div>
      )}
      {!target.targetValidation.ok && (
        <div className="space-y-1 pt-1">
          <span className="text-[10px] font-bold uppercase text-amber-700 dark:text-amber-400">⚠️ Target Validation</span>
          <ul className="space-y-1">
            {target.targetValidation.notes.map((note) => (
              <li key={note} className="flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-400 leading-snug">
                <TriangleAlert className="size-3 mt-0.5 shrink-0" strokeWidth={2.5} />
                {note}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Price level row ──────────────────────────────────────────────────────────
function LevelRow({ label, price, description, tone }: {
  label: string; price: number; description: string; tone: 'red' | 'green';
}) {
  const bg = tone === 'red'
    ? 'bg-rose-50 dark:bg-rose-400/10'
    : 'bg-emerald-50 dark:bg-emerald-400/10';
  const labelColor = tone === 'red'
    ? 'text-rose-600 dark:text-rose-400'
    : 'text-emerald-600 dark:text-emerald-400';
  return (
    <div className={cn('flex items-center justify-between gap-4 neo-border px-4 py-2.5', bg)}>
      <div className="flex items-center gap-3">
        <span className={cn('w-7 text-center text-sm font-bold', labelColor)}>{label}</span>
        <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{description}</span>
      </div>
      <span className="font-mono text-base tabular-nums font-bold text-zinc-800 dark:text-zinc-200">
        {fmtRp(price)}
      </span>
    </div>
  );
}

// ─── RSI Bar ──────────────────────────────────────────────────────────────────
function RsiBar({ value }: { value: number }) {
  if (Number.isNaN(value)) return null;
  const pct = Math.min(100, Math.max(0, value));
  const color =
    value < 30 ? 'bg-rose-500' :
      value > 80 ? 'bg-red-600' :
        value > 70 ? 'bg-amber-500' :
          value >= 55 ? 'bg-emerald-500' : 'bg-blue-400';
  return (
    <div className="space-y-1.5">
      <div className="h-3.5 w-full overflow-hidden border-2 border-(--neo-line) bg-zinc-100 dark:bg-zinc-800 relative">
        <div className="absolute inset-y-0 left-[30%] w-0.5 bg-zinc-400 dark:bg-zinc-500" />
        <div className="absolute inset-y-0 left-[55%] w-0.5 bg-zinc-400 dark:bg-zinc-500" />
        <div className="absolute inset-y-0 left-[70%] w-0.5 bg-zinc-400 dark:bg-zinc-500" />
        <div className={cn('h-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-[11px] font-bold text-zinc-400 dark:text-zinc-500 px-0.5">
        <span>0</span><span>30 OS</span><span>55</span><span>70 OB</span><span>100</span>
      </div>
    </div>
  );
}

// ─── Mini Sparklines (MA / RSI / MACD) ─────────────────────────────────────────
function Sparkline({ data, bands, height = 32, toneClass = 'text-blue-500' }: {
  data: number[]; bands?: number[]; height?: number; toneClass?: string;
}) {
  const valid = data.filter((v) => !Number.isNaN(v));
  if (valid.length < 2) return null;
  const min = Math.min(...valid, ...(bands ?? []));
  const max = Math.max(...valid, ...(bands ?? []));
  const range = max - min || 1;
  const width = 100;
  const step = width / (valid.length - 1);
  const toY = (v: number) => height - ((v - min) / range) * height;
  const points = valid.map((v, i) => `${i * step},${toY(v)}`).join(' ');
  const areaPoints = `0,${height} ${points} ${width},${height}`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className={cn('w-full', toneClass)} style={{ height }}>
      {bands?.map((b) => (
        <line key={b} x1={0} y1={toY(b)} x2={width} y2={toY(b)} stroke="currentColor" strokeOpacity={0.25} strokeDasharray="2,2" />
      ))}
      <polygon points={areaPoints} fill="currentColor" fillOpacity={0.12} stroke="none" />
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function HistogramSparkline({ data, height = 32 }: { data: number[]; height?: number }) {
  const valid = data.filter((v) => !Number.isNaN(v));
  if (valid.length < 2) return null;
  const maxAbs = Math.max(...valid.map((v) => Math.abs(v))) || 1;
  const width = 100;
  const barW = width / valid.length;
  const mid = height / 2;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
      <line x1={0} y1={mid} x2={width} y2={mid} stroke="currentColor" strokeOpacity={0.15} className="text-zinc-400" />
      {valid.map((v, i) => {
        const h = Math.max((Math.abs(v) / maxAbs) * mid, 0.6);
        const y = v >= 0 ? mid - h : mid;
        return (
          <rect key={i} x={i * barW + barW * 0.15} y={y} width={barW * 0.7} height={h} className={v >= 0 ? 'fill-emerald-500' : 'fill-rose-500'} />
        );
      })}
    </svg>
  );
}

function PriceEmaSparkline({ closesArr, emaArr, height = 40 }: { closesArr: number[]; emaArr: number[]; height?: number }) {
  const n = Math.min(closesArr.length, emaArr.length);
  if (n < 2) return null;
  const cs = closesArr.slice(-n);
  const es = emaArr.slice(-n);
  const validAll = [...cs, ...es].filter((v) => !Number.isNaN(v));
  if (validAll.length < 2) return null;
  const min = Math.min(...validAll);
  const max = Math.max(...validAll);
  const range = max - min || 1;
  const width = 100;
  const step = width / (n - 1);
  const toY = (v: number) => height - ((v - min) / range) * height;
  const priceLine = (i: number, v: number) => Number.isNaN(v) ? null : `${i * step},${toY(v)}`;
  const pricePoints = cs.map((v, i) => priceLine(i, v)).filter(Boolean).join(' ');
  const emaPoints = es.map((v, i) => priceLine(i, v)).filter(Boolean).join(' ');
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
      <polyline points={emaPoints} fill="none" stroke="currentColor" strokeWidth={2} vectorEffect="non-scaling-stroke" className="text-blue-400 opacity-70" />
      <polyline points={pricePoints} fill="none" stroke="currentColor" strokeWidth={2} vectorEffect="non-scaling-stroke" className="text-zinc-700 dark:text-zinc-200" />
    </svg>
  );
}

// ─── Scenario Card ────────────────────────────────────────────────────────────
function ScenarioCard({ type, entry, avgDown, tp1, tp2, sl, rr, notes }: {
  type: 'bullish' | 'bearish';
  entry: number; avgDown?: number; tp1: number; tp2: number; sl: number; rr: number; notes: string;
}) {
  const isBull = type === 'bullish';
  const Icon = isBull ? TrendingUp : TrendingDown;
  const headerBg = isBull ? 'bg-emerald-500' : 'bg-rose-500';

  return (
    <div className="neo-border neo-shadow overflow-hidden bg-white dark:bg-zinc-900">
      <div className={cn('flex items-center gap-2 px-4 py-3 border-b-[3px] border-(--neo-line) text-white font-bold uppercase tracking-wide', headerBg)}>
        <Icon className="size-4" strokeWidth={2.5} />
        Skenario {isBull ? 'Bullish ✓' : 'Bearish ✗'}
      </div>
      <div className="divide-y-2 divide-(--neo-line)">
        <div className="px-4 py-3 space-y-1">
          <KV label="Entry" value={fmtRp(entry)} />
          {avgDown != null && <KV label="Add / AVGD" value={fmtRp(avgDown)} valueClass="text-amber-600 dark:text-amber-400" />}
          <KV label="TP 1" value={fmtRp(tp1)} valueClass="text-emerald-600 dark:text-emerald-400" suffix={`+${(((tp1 - entry) / entry) * 100).toFixed(1)}%`} suffixClass="text-emerald-500 dark:text-emerald-500 text-xs font-semibold" />
          <KV label="TP 2" value={fmtRp(tp2)} valueClass="text-emerald-600 dark:text-emerald-400" suffix={`+${(((tp2 - entry) / entry) * 100).toFixed(1)}%`} suffixClass="text-emerald-500 dark:text-emerald-500 text-xs font-semibold" />
          <KV label="Stop Loss" value={fmtRp(sl)} valueClass="text-rose-600 dark:text-rose-400" suffix={`${(((sl - entry) / entry) * 100).toFixed(1)}%`} suffixClass="text-rose-500 dark:text-rose-500 text-xs font-semibold" />
        </div>
        <div className="px-4 py-3 flex items-center gap-3">
          <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">Risk / Reward</span>
          <span className={cn(
            'text-lg font-bold tabular-nums',
            rr >= 2 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
          )}>
            1 : {fmtN(rr, 1)}
          </span>
        </div>
        <div className="px-4 py-3">
          <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">{notes}</p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 🤖 AI STOCK ADVISOR HERO CARD (Penjelasan Alasan Beli vs Hindari)
// ─────────────────────────────────────────────────────────────────────────────
function AiStockAdvisorSidebar({ advisor }: { advisor: AiStockAdvisor }) {
  const [showBuyReasons, setShowBuyReasons] = useState(true);
  const [showAvoidReasons, setShowAvoidReasons] = useState(true);
  const [showExecutiveSummary, setShowExecutiveSummary] = useState(true);
  const verdictBgMap = {
    green: 'bg-emerald-50 dark:bg-emerald-500/10',
    amber: 'bg-amber-50 dark:bg-amber-500/10',
    red: 'bg-rose-50 dark:bg-rose-500/10',
    blue: 'bg-blue-50 dark:bg-blue-500/10',
  };

  const badgeBgMap = {
    green: 'bg-emerald-600 text-white',
    amber: 'bg-amber-500 text-white',
    red: 'bg-rose-600 text-white',
    blue: 'bg-blue-600 text-white',
  };

  const scoreItems = [
    { label: 'Fundamental', score: advisor.fundamentalScore, weight: '30%' },
    { label: 'Teknikal', score: advisor.technicalScore, weight: '35%' },
    { label: 'Sentimen Berita', score: advisor.newsScore, weight: '15%' },
    { label: 'Breakout Hunter', score: advisor.breakoutScore, weight: '20%' },
  ];

  return (
    <div className={cn('neo-border neo-shadow p-4 space-y-4', verdictBgMap[advisor.verdictTone])}>
      {/* Header & Verdict Badge */}
      <div className="space-y-2.5 border-b-[3px] border-(--neo-line) pb-3">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center neo-border bg-emerald-500 text-white shrink-0">
            <Sparkles className="size-4" strokeWidth={2.5} />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-900 dark:text-zinc-100 leading-tight">AI Stock Advisor</h2>
            {/* <p className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 leading-tight truncate">
              Fundamental · Teknikal · Berita · Breakout
            </p> */}
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className={cn('neo-border px-3 py-1 text-sm font-bold tracking-wide', badgeBgMap[advisor.verdictTone])}>
            {advisor.verdictLabel}
          </span>
          <div className="text-right">
            <div className="text-[10px] font-bold uppercase text-zinc-400">Confidence</div>
            <div className="font-mono text-sm font-bold text-zinc-800 dark:text-zinc-200">{advisor.confidenceScore}%</div>
          </div>
        </div>
        {/* <div className="flex items-center justify-between text-[11px]">
          <span className="font-bold uppercase text-zinc-400">Risk Score</span>
          <span className={cn(
            'font-mono font-bold',
            advisor.riskLevel === 'HIGH' ? 'text-rose-600 dark:text-rose-400' : advisor.riskLevel === 'MEDIUM' ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
          )}>
            {advisor.riskScore}/100 · {advisor.riskLevel}
          </span>
        </div> */}
      </div>

      {/* Scores Breakdown, stacked */}
      {/* <div className="space-y-2.5">
        {scoreItems.map((item) => (
          <div key={item.label}>
            <div className="flex justify-between items-baseline text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
              <span className="truncate">{item.label} <span className="opacity-60">({item.weight})</span></span>
              <span className={cn(
                'font-mono text-sm font-bold shrink-0',
                item.score >= 70 ? 'text-emerald-600 dark:text-emerald-400' : item.score >= 45 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'
              )}>
                {item.score}/100
              </span>
            </div>
            <div className="h-2 w-full border-2 border-(--neo-line) bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
              <div
                className={cn(
                  'h-full transition-all',
                  item.score >= 70 ? 'bg-emerald-500' : item.score >= 45 ? 'bg-amber-400' : 'bg-rose-500'
                )}
                style={{ width: `${item.score}%` }}
              />
            </div>
          </div>
        ))}
      </div> */}

      {/* Reasons to Buy (collapsible, default hidden) */}
      <div className="neo-border bg-emerald-50 dark:bg-emerald-500/10 p-3 space-y-2">
        <button
          type="button"
          onClick={() => setShowBuyReasons((v) => !v)}
          aria-expanded={showBuyReasons}
          className="flex w-full items-center justify-between gap-1.5 text-emerald-700 dark:text-emerald-400 font-bold uppercase text-sm"
        >
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="size-3.5 shrink-0" strokeWidth={2.5} />
            Alasan Membeli
          </span>
          <ChevronDown className={cn('size-3.5 shrink-0 transition-transform', showBuyReasons && 'rotate-180')} strokeWidth={2.5} />
        </button>
        {showBuyReasons && (
          <ul className="space-y-1.5">
            {advisor.buyReasons.map((reason, idx) => (
              <li key={idx} className="flex items-start gap-1.5 text-sm text-zinc-700 dark:text-zinc-300 leading-snug">
                <span className="shrink-0 text-emerald-600 dark:text-emerald-400 font-bold">✓</span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Reasons to Avoid (collapsible, default hidden) */}
      <div className="neo-border bg-rose-50 dark:bg-rose-500/10 p-3 space-y-2">
        <button
          type="button"
          onClick={() => setShowAvoidReasons((v) => !v)}
          aria-expanded={showAvoidReasons}
          className="flex w-full items-center justify-between gap-1.5 text-rose-700 dark:text-rose-400 font-bold uppercase text-sm"
        >
          <span className="flex items-center gap-1.5">
            <XCircle className="size-3.5 shrink-0" strokeWidth={2.5} />
            Alasan Menghindari
          </span>
          <ChevronDown className={cn('size-3.5 shrink-0 transition-transform', showAvoidReasons && 'rotate-180')} strokeWidth={2.5} />
        </button>
        {showAvoidReasons && (
          <ul className="space-y-1.5">
            {advisor.avoidReasons.map((reason, idx) => (
              <li key={idx} className="flex items-start gap-1.5 text-sm text-zinc-700 dark:text-zinc-300 leading-snug">
                <span className="shrink-0 text-rose-600 dark:text-rose-400 font-bold">⚠️</span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Executive Summary & Actionable Trade Plan (collapsible, default hidden) */}
      {/* <div className="neo-border bg-white dark:bg-zinc-900 p-3 space-y-2">
        <button
          type="button"
          onClick={() => setShowExecutiveSummary((v) => !v)}
          aria-expanded={showExecutiveSummary}
          className="flex w-full items-center justify-between gap-1.5"
        >
          <span className="text-[10px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Rangkuman Eksekutif
          </span>
          <ChevronDown className={cn('size-3.5 shrink-0 text-zinc-400 transition-transform', showExecutiveSummary && 'rotate-180')} strokeWidth={2.5} />
        </button>
        {showExecutiveSummary && (
          <>
            <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
              {advisor.executiveSummary}
            </p>
            <div className="pt-2 border-t-2 border-(--neo-line) flex items-start gap-1.5">
              <Target className="size-3.5 text-emerald-500 mt-0.5 shrink-0" strokeWidth={2.5} />
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 leading-relaxed">
                {advisor.tradingRecommendation}
              </p>
            </div>
          </>
        )}
      </div> */}

    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 📐 SCORING CARD — Sistem Scoring "7-Confirmation IDX" (EMA200/50/20, RSI, MACD, Volume)
// ─────────────────────────────────────────────────────────────────────────────
function ScoringCard({
  price,
  trendEma,
  indicators,
  volume,
}: {
  price: number;
  trendEma: TrendEmaAnalysis;
  indicators: IndicatorAnalysis;
  volume: VolumeAnalysis;
}) {
  const { total: totalScore, max: maxScore, factors, classification } = useMemo(
    () => computeTechnicalScore(price, trendEma, indicators, volume),
    [price, trendEma, indicators, volume]
  );

  const badgeToneClass = {
    green: 'bg-emerald-600 text-white',
    amber: 'bg-amber-500 text-white',
    red: 'bg-rose-600 text-white',
  };
  const barToneClass = {
    green: 'bg-emerald-500',
    amber: 'bg-amber-400',
    red: 'bg-rose-500',
  };

  return (
    <div className="neo-border neo-shadow bg-white dark:bg-zinc-900 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
          <Activity className="size-4 text-zinc-400" strokeWidth={2.5} />
          Scoring
        </h3>
        <span className={cn('neo-border px-2.5 py-0.5 text-[11px] font-bold', badgeToneClass[classification.tone])}>
          {classification.label}
        </span>
      </div>

      <div className="flex items-end justify-between">
        <span className="text-[10px] font-bold uppercase text-zinc-400">Total Skor</span>
        <span className={cn(
          'font-mono text-xl font-bold tabular-nums',
          classification.tone === 'green' ? 'text-emerald-600 dark:text-emerald-400' : classification.tone === 'amber' ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'
        )}>
          {totalScore}/{maxScore}
        </span>
      </div>
      <div className="h-2.5 w-full border-2 border-(--neo-line) bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
        <div
          className={cn('h-full transition-all', barToneClass[classification.tone])}
          style={{ width: `${Math.min(100, Math.max(0, (totalScore / maxScore) * 100))}%` }}
        />
      </div>

      {/* <div className="space-y-2.5 pt-1">
        {factors.map((f) => (
          <div key={f.label}>
            <div className="flex justify-between items-baseline text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
              <span className="truncate">{f.label} <span className="opacity-60">(maks {f.max})</span></span>
              <span className={cn(
                'font-mono text-sm font-bold shrink-0',
                f.score <= 0 ? 'text-rose-600 dark:text-rose-400' : f.score >= f.max * 0.7 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
              )}>
                {f.score > 0 ? `+${f.score}` : f.score}
              </span>
            </div>
            <div className="h-2 w-full border-2 border-(--neo-line) bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
              <div
                className={cn(
                  'h-full transition-all',
                  f.score <= 0 ? 'bg-rose-500' : f.score >= f.max * 0.7 ? 'bg-emerald-500' : 'bg-amber-400'
                )}
                style={{ width: `${Math.min(100, Math.max(0, (f.score / f.max) * 100))}%` }}
              />
            </div>
            <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug">{f.detail}</p>
          </div>
        ))}
      </div> */}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 🕵️ BANDAR DETECTOR (Price + Volume + OBV Wyckoff proxy — no real broker/foreign data)
// ─────────────────────────────────────────────────────────────────────────────
function BandarDetectorCard({
  summary,
  bars,
  brokerActivity,
  brokerActivityLoading,
}: {
  summary: StockSummary;
  bars: OHLCVBar[];
  brokerActivity?: BrokerActivityDetail | null;
  brokerActivityLoading?: boolean;
}) {
  const { total, max, factors, classification, phaseLabel, hiddenDistributionWarning, dataNotes } = useMemo(
    () => computeBandarScore(summary, bars),
    [summary, bars]
  );

  const badgeToneClass = {
    green: 'bg-emerald-600 text-white',
    amber: 'bg-amber-500 text-white',
    orange: 'bg-orange-500 text-white',
    red: 'bg-rose-600 text-white',
  };
  const barToneClass = {
    green: 'bg-emerald-500',
    amber: 'bg-amber-400',
    orange: 'bg-orange-400',
    red: 'bg-rose-500',
  };
  const textToneClass = {
    green: 'text-emerald-600 dark:text-emerald-400',
    amber: 'text-amber-600 dark:text-amber-400',
    orange: 'text-orange-600 dark:text-orange-400',
    red: 'text-rose-600 dark:text-rose-400',
  };

  return (
    <div className="neo-border neo-shadow bg-white dark:bg-zinc-900 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
          <Eye className="size-4 text-zinc-400" strokeWidth={2.5} />
          Bandar Detector
        </h3>
        <span className={cn('neo-border px-2.5 py-0.5 text-[11px] font-bold', badgeToneClass[classification.tone])}>
          {classification.label}
        </span>
      </div>

      <div className="flex items-end justify-between gap-2">
        <span className="text-[10px] font-bold uppercase text-zinc-400 truncate">Fase: {phaseLabel}</span>
        <span className={cn('font-mono text-xl font-bold tabular-nums shrink-0', textToneClass[classification.tone])}>
          {total}/{max}
        </span>
      </div>
      <div className="h-2.5 w-full border-2 border-(--neo-line) bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
        <div
          className={cn('h-full transition-all', barToneClass[classification.tone])}
          style={{ width: `${Math.min(100, Math.max(0, (total / max) * 100))}%` }}
        />
      </div>

      {hiddenDistributionWarning && (
        <div className="neo-border border-rose-400 bg-rose-50 dark:bg-rose-400/10 px-3 py-2">
          <p className="text-[11px] font-bold text-rose-700 dark:text-rose-400">⚠️ Indikasi Hidden Distribution</p>
          <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">
            Harga naik/flat tapi OBV melemah — smart money bisa jadi menjual ke pembeli baru yang masuk karena melihat harga masih kuat.
          </p>
        </div>
      )}

      {/* <div className="space-y-2.5 pt-1">
        {factors.map((f) => (
          <div key={f.label}>
            <div className="flex justify-between items-baseline text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
              <span className="truncate">{f.label} <span className="opacity-60">(maks {f.max})</span></span>
              <span className={cn(
                'font-mono text-sm font-bold shrink-0',
                f.score <= 0 ? 'text-rose-600 dark:text-rose-400' : f.score >= f.max * 0.7 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
              )}>
                {f.score}
              </span>
            </div>
            <div className="h-2 w-full border-2 border-(--neo-line) bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
              <div
                className={cn(
                  'h-full transition-all',
                  f.score <= 0 ? 'bg-rose-500' : f.score >= f.max * 0.7 ? 'bg-emerald-500' : 'bg-amber-400'
                )}
                style={{ width: `${Math.min(100, Math.max(0, (f.score / f.max) * 100))}%` }}
              />
            </div>
            <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug">{f.detail}</p>
          </div>
        ))}
      </div> */}

      {/* <ul className="space-y-1 pt-1 border-t-2 border-(--neo-line)">
        {dataNotes.map((note) => (
          <Note key={note} text={note} tone="zinc" />
        ))}
      </ul> */}

      {brokerActivityLoading && (
        <div className="flex items-center gap-2 pt-2 border-t-2 border-(--neo-line) text-[11px] font-semibold text-zinc-400">
          <Loader2 className="size-3.5 animate-spin" strokeWidth={2.5} /> Memuat data broker riil…
        </div>
      )}

      {!brokerActivityLoading && brokerActivity && (
        <BrokerActivityPanel activity={brokerActivity} />
      )}
    </div>
  );
}

// ─── Broker Summary Riil (Index Alpha) — real per-broker net buy/sell + foreign flow ──
function BrokerActivityPanel({ activity }: { activity: BrokerActivityDetail }) {
  const BrokerRow = ({ row, tone }: { row: BrokerSummaryRow; tone: 'green' | 'red' }) => (
    <div className="flex items-center justify-between gap-2 text-[11px]">
      <span className="font-mono font-bold text-zinc-700 dark:text-zinc-300">{row.code}</span>
      <span className={cn('font-mono font-bold', tone === 'green' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
        {tone === 'green' ? '+' : ''}Rp{formatCompact(row.netValue)}
      </span>
    </div>
  );

  const foreignFlow = activity.foreignFlow;
  const foreignNet = foreignFlow?.netForeign ?? null;

  return (
    <div className="pt-2 border-t-2 border-(--neo-line) space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-[11px] font-bold uppercase tracking-wide text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
          📡 Broker Summary Riil
        </h4>
        <span className="text-[10px] font-semibold text-zinc-400">via Index Alpha</span>
      </div>
      <p className="text-[10px] text-zinc-400">
        {activity.rangeFrom} – {activity.rangeTo}
      </p>

      {foreignNet != null && (
        <div className={cn(
          'neo-border px-3 py-2 flex items-center justify-between gap-2',
          foreignNet >= 0 ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'bg-rose-50 dark:bg-rose-500/10'
        )}>
          <span className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">Net Foreign Flow</span>
          <span className={cn('font-mono text-sm font-bold', foreignNet >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
            {foreignNet >= 0 ? '+' : ''}Rp{formatCompact(foreignNet)}
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">Top Net Buyer</p>
          {activity.topBuyers.length > 0
            ? activity.topBuyers.map((row) => <BrokerRow key={row.code} row={row} tone="green" />)
            : <p className="text-[11px] text-zinc-400">–</p>}
        </div>
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold uppercase text-rose-600 dark:text-rose-400">Top Net Seller</p>
          {activity.topSellers.length > 0
            ? activity.topSellers.map((row) => <BrokerRow key={row.code} row={row} tone="red" />)
            : <p className="text-[11px] text-zinc-400">–</p>}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 🎯 TRADING PLAN SUMMARY (sidebar, compact single-column version of ScenarioCard)
// ─────────────────────────────────────────────────────────────────────────────
function TradingPlanSidebarCard({ plan }: { plan: TradingPlanAnalysis }) {
  const { prefs, setPrefs } = useTradingStyle();
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Input state (string agar bisa ketik angka bebas sebelum di-commit)
  const [clInput, setClInput] = useState(String(prefs.maxClPct));
  const [tp1Input, setTp1Input] = useState(String(prefs.minTp1Pct));
  const [tp2Input, setTp2Input] = useState(String(prefs.minTp2Pct));

  // Sync input values ketika prefs di-hydrate dari localStorage setelah mount
  const prevPrefsRef = useRef(prefs);
  if (prevPrefsRef.current !== prefs) {
    prevPrefsRef.current = prefs;
    // Tidak setState di sini — sync dilakukan saat buka settings panel
  }

  // Pastikan input ter-sync dengan prefs saat pertama buka settings
  const handleSettingsToggle = () => {
    if (!settingsOpen) {
      setClInput(String(prefs.maxClPct));
      setTp1Input(String(prefs.minTp1Pct));
      setTp2Input(String(prefs.minTp2Pct));
    }
    setSettingsOpen((v) => !v);
  };

  const commitCl = () => {
    const v = parseFloat(clInput);
    if (!Number.isNaN(v)) setPrefs({ maxClPct: v });
    else setClInput(String(prefs.maxClPct));
  };
  const commitTp1 = () => {
    const v = parseFloat(tp1Input);
    if (!Number.isNaN(v)) setPrefs({ minTp1Pct: v });
    else setTp1Input(String(prefs.minTp1Pct));
  };
  const commitTp2 = () => {
    const v = parseFloat(tp2Input);
    if (!Number.isNaN(v)) setPrefs({ minTp2Pct: v });
    else setTp2Input(String(prefs.minTp2Pct));
  };

  // Terapkan preferensi gaya trading ke plan
  const adjusted = useMemo(() => applyTradingStyle(plan, prefs), [plan, prefs]);

  const bias = adjusted.recommendedBias === 'bearish' ? 'bearish' : 'bullish';
  const scenario = adjusted[bias];
  const isBull = bias === 'bullish';
  const Icon = isBull ? TrendingUp : TrendingDown;

  const anyAdjusted = scenario.slAdjusted || scenario.tp1Adjusted || scenario.tp2Adjusted;

  return (
    <div className="neo-border neo-shadow bg-white dark:bg-zinc-900 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
          <Crosshair className="size-4 text-zinc-400" strokeWidth={2.5} />
          Trading Plan
        </h3>
        <span className={cn(
          'inline-flex items-center gap-1 border border-(--neo-line) px-2 py-0.5 text-[11px] font-bold',
          isBull ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400'
        )}>
          <Icon className="size-3" strokeWidth={2.5} />
          {adjusted.recommendedBias === 'neutral' ? 'Netral' : isBull ? 'Bullish' : 'Bearish'}
        </span>
      </div>

      {/* ── Settings Panel ─────────────────────────────────── */}
      <div className="neo-border border-(--neo-line) overflow-hidden">
        <button
          type="button"
          onClick={handleSettingsToggle}
          aria-expanded={settingsOpen}
          className="flex w-full items-center justify-between gap-2 px-3 py-2 bg-zinc-50 dark:bg-zinc-800/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            <Settings2 className="size-3" strokeWidth={2.5} />
            Gaya Trading Saya
          </span>
          <div className="flex items-center gap-1.5">
            {anyAdjusted && (
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">● disesuaikan</span>
            )}
            <ChevronDown className={cn('size-3.5 text-zinc-400 transition-transform shrink-0', settingsOpen && 'rotate-180')} strokeWidth={2.5} />
          </div>
        </button>

        {settingsOpen && (
          <div className="px-3 py-3 space-y-3 border-t-2 border-(--neo-line) bg-white dark:bg-zinc-900">
            {/* CL Input */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase text-zinc-500 dark:text-zinc-400 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  ✂️ Cut Loss maks
                  {scenario.slAdjusted && (
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 ml-1">↑ aktif</span>
                  )}
                </span>
                <span className="text-rose-500 font-mono">{prefs.maxClPct}%</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  id="tp-cl-range"
                  min={1}
                  max={20}
                  step={0.5}
                  value={prefs.maxClPct}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setClInput(String(v));
                    setPrefs({ maxClPct: v });
                  }}
                  className="flex-1 accent-rose-500 h-1.5"
                />
                <input
                  type="number"
                  id="tp-cl-input"
                  min={1}
                  max={20}
                  step={0.5}
                  value={clInput !== '' ? clInput : prefs.maxClPct}
                  onChange={(e) => setClInput(e.target.value)}
                  onBlur={commitCl}
                  onKeyDown={(e) => e.key === 'Enter' && commitCl()}
                  className="w-14 text-center font-mono text-sm font-bold border-2 border-(--neo-line) bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 py-0.5 focus:outline-none focus:border-rose-400 dark:focus:border-rose-500"
                />
                <span className="text-xs font-bold text-zinc-400">%</span>
              </div>
            </div>

            {/* TP1 Input */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase text-zinc-500 dark:text-zinc-400 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  🎯 TP 1 minimal
                  {scenario.tp1Adjusted && (
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 ml-1">↑ aktif</span>
                  )}
                </span>
                <span className="text-emerald-600 dark:text-emerald-400 font-mono">{prefs.minTp1Pct}%</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  id="tp-tp1-range"
                  min={3}
                  max={50}
                  step={0.5}
                  value={prefs.minTp1Pct}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setTp1Input(String(v));
                    setPrefs({ minTp1Pct: v });
                  }}
                  className="flex-1 accent-emerald-500 h-1.5"
                />
                <input
                  type="number"
                  id="tp-tp1-input"
                  min={3}
                  max={50}
                  step={0.5}
                  value={tp1Input !== '' ? tp1Input : prefs.minTp1Pct}
                  onChange={(e) => setTp1Input(e.target.value)}
                  onBlur={commitTp1}
                  onKeyDown={(e) => e.key === 'Enter' && commitTp1()}
                  className="w-14 text-center font-mono text-sm font-bold border-2 border-(--neo-line) bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 py-0.5 focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-500"
                />
                <span className="text-xs font-bold text-zinc-400">%</span>
              </div>
            </div>

            {/* TP2 Input */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase text-zinc-500 dark:text-zinc-400 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  🚀 TP 2 minimal
                  {scenario.tp2Adjusted && (
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 ml-1">↑ aktif</span>
                  )}
                </span>
                <span className="text-emerald-600 dark:text-emerald-400 font-mono">{prefs.minTp2Pct}%</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  id="tp-tp2-range"
                  min={5}
                  max={100}
                  step={1}
                  value={prefs.minTp2Pct}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setTp2Input(String(v));
                    setPrefs({ minTp2Pct: v });
                  }}
                  className="flex-1 accent-emerald-500 h-1.5"
                />
                <input
                  type="number"
                  id="tp-tp2-input"
                  min={5}
                  max={100}
                  step={1}
                  value={tp2Input !== '' ? tp2Input : prefs.minTp2Pct}
                  onChange={(e) => setTp2Input(e.target.value)}
                  onBlur={commitTp2}
                  onKeyDown={(e) => e.key === 'Enter' && commitTp2()}
                  className="w-14 text-center font-mono text-sm font-bold border-2 border-(--neo-line) bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 py-0.5 focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-500"
                />
                <span className="text-xs font-bold text-zinc-400">%</span>
              </div>
            </div>

            {/* Indikator penyesuaian */}
            {anyAdjusted && (
              <div className="pt-2 border-t-2 border-(--neo-line) space-y-1">
                {scenario.slAdjusted && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 leading-snug">
                    ⚠️ SL engine ({fmtN(Math.abs(((plan[bias].sl - plan[bias].entry) / plan[bias].entry) * 100), 1)}%) &gt; batas CL Anda → di-cap ke -{prefs.maxClPct}%
                  </p>
                )}
                {scenario.tp1Adjusted && (
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 leading-snug">
                    ✅ TP1 engine ({fmtN(((plan[bias].tp1 - plan[bias].entry) / plan[bias].entry) * 100, 1)}%) &lt; target Anda → didorong ke +{prefs.minTp1Pct}%
                  </p>
                )}
                {scenario.tp2Adjusted && (
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 leading-snug">
                    ✅ TP2 engine ({fmtN(((plan[bias].tp2 - plan[bias].entry) / plan[bias].entry) * 100, 1)}%) &lt; target Anda → didorong ke +{prefs.minTp2Pct}%
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Levels ─────────────────────────────────────────── */}
      <div className="grid gap-2 text-sm">
        <KV label="Entry" value={fmtRp(scenario.entry)} />
        {scenario.avgDown != null && (
          <KV label="Add / AVGD" value={fmtRp(scenario.avgDown)} valueClass="text-amber-600 dark:text-amber-400" />
        )}
        <KV
          label="TP 1"
          value={fmtRp(scenario.tp1)}
          valueClass="text-emerald-600 dark:text-emerald-400"
          suffix={`+${(((scenario.tp1 - scenario.entry) / scenario.entry) * 100).toFixed(1)}%`}
          suffixClass="text-emerald-500 dark:text-emerald-500 text-xs font-semibold"
        />
        <KV
          label="TP 2"
          value={fmtRp(scenario.tp2)}
          valueClass="text-emerald-600 dark:text-emerald-400"
          suffix={`+${(((scenario.tp2 - scenario.entry) / scenario.entry) * 100).toFixed(1)}%`}
          suffixClass="text-emerald-500 dark:text-emerald-500 text-xs font-semibold"
        />
        <KV
          label="Stop Loss"
          value={fmtRp(scenario.sl)}
          valueClass={cn('text-rose-600 dark:text-rose-400', scenario.slAdjusted && 'font-bold')}
          suffix={`${(((scenario.sl - scenario.entry) / scenario.entry) * 100).toFixed(1)}%`}
          suffixClass="text-rose-500 dark:text-rose-500 text-xs font-semibold"
        />
      </div>

      <div className="flex items-center justify-between border-2 border-(--neo-line) bg-zinc-50 dark:bg-zinc-800/60 px-3 py-2">
        <span className="text-[11px] font-bold uppercase text-zinc-500 dark:text-zinc-400">Risk / Reward</span>
        <span className={cn(
          'font-mono text-sm font-bold',
          scenario.riskRewardRatio >= 2 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
        )}>
          1 : {fmtN(scenario.riskRewardRatio, 1)}
        </span>
      </div>

      <DefaultTargetPlanBlock target={scenario.defaultTarget} isLong={isBull} />

      <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">{scenario.notes}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 🧭 SIMILAR STOCKS (sidebar) — same sector, ranked by closest market cap
// ─────────────────────────────────────────────────────────────────────────────
function SimilarStocksSidebarCard({ current, stocks }: { current: StockSummary; stocks: StockSummary[] }) {
  if (stocks.length === 0) return null;

  return (
    <div className="neo-border neo-shadow bg-white dark:bg-zinc-900 p-4 space-y-3">
      <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
        <PieChart className="size-4 text-zinc-400" strokeWidth={2.5} />
        Saham Sejenis
      </h3>

      {/* Ratio comparison table — scroll horizontal di mobile */}
      {/* <div className="-mx-1 overflow-x-auto">
        <table className="w-full min-w-[280px] text-xs">
          <thead>
            <tr className="text-zinc-400 dark:text-zinc-500 border-b-2 border-(--neo-line)">
              <th className="text-left font-bold uppercase py-1.5 pr-2">Ticker</th>
              <th className="text-right font-bold uppercase py-1.5 px-1">PER</th>
              <th className="text-right font-bold uppercase py-1.5 px-1">PBV</th>
              <th className="text-right font-bold uppercase py-1.5 pl-1">ROE</th>
            </tr>
          </thead>
          <tbody>
            {[current, ...stocks].map((s) => {
              const isCurrent = s.ticker === current.ticker;
              return (
                <tr
                  key={s.ticker}
                  className={cn(
                    'border-b border-zinc-100 dark:border-zinc-800 last:border-0',
                    isCurrent && 'bg-emerald-50 dark:bg-emerald-500/10'
                  )}
                >
                  <td className={cn('py-1.5 pr-2', isCurrent && 'font-bold')}>
                    {isCurrent ? (
                      <span className="text-zinc-900 dark:text-zinc-100">{s.ticker}</span>
                    ) : (
                      <Link href={`/screener/${s.ticker}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                        {s.ticker}
                      </Link>
                    )}
                  </td>
                  <td className={cn('text-right font-mono tabular-nums py-1.5 px-1', isCurrent && 'font-bold')}>
                    {s.per > 0 ? `${s.per.toFixed(1)}×` : '–'}
                  </td>
                  <td className={cn('text-right font-mono tabular-nums py-1.5 px-1', isCurrent && 'font-bold')}>
                    {s.pbv > 0 ? `${s.pbv.toFixed(2)}×` : '–'}
                  </td>
                  <td className={cn('text-right font-mono tabular-nums py-1.5 pl-1', isCurrent && 'font-bold')}>
                    {s.roe !== 0 ? `${s.roe.toFixed(1)}%` : '–'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div> */}

      <ul className="space-y-1.5 pt-1 border-t-2 border-(--neo-line)">
        {stocks.map((s) => {
          const up = s.percentChange1D >= 0;
          return (
            <li key={s.ticker}>
              <Link
                href={`/screener/${s.ticker}`}
                className="flex items-center justify-between gap-2 border-2 border-(--neo-line) px-2 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors"
              >
                <div className="min-w-0">
                  <div className="text-sm font-bold text-zinc-800 dark:text-zinc-100">{s.ticker}</div>
                  <div className="text-[10px] font-medium text-zinc-400 truncate">{s.name}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono text-sm font-semibold text-zinc-700 dark:text-zinc-300">{formatRupiah(s.lastClose)}</div>
                  <div className={cn(
                    'text-[10px] font-mono font-bold',
                    up ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                  )}>
                    {formatPercent(s.percentChange1D)}
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 💹 FAIR VALUE CALCULATOR (shared state/hook) — dipakai oleh kartu Kalkulator
// Nilai Wajar (di atas tab) & bagian Rangkuman Valuasi + Verdict (tab Fundamental)
// ─────────────────────────────────────────────────────────────────────────────
type FairValueTone = 'green' | 'amber' | 'red' | 'zinc';
type FairValueRow = { key: string; label: string; fv: number | null };

interface FairValueCalculation {
  price: number;
  eps: number | null;
  bvps: number | null;
  meanPerInput: string;
  setMeanPerInput: (v: string) => void;
  meanPbvInput: string;
  setMeanPbvInput: (v: string) => void;
  growthInput: string;
  setGrowthInput: (v: string) => void;
  useGrowthGraham: boolean;
  setUseGrowthGraham: React.Dispatch<React.SetStateAction<boolean>>;
  rows: FairValueRow[];
  upside: (fv: number | null) => number | null;
  statusOf: (u: number | null) => { label: string; tone: FairValueTone };
  consensus: number | null;
  consensusUpside: number | null;
  verdict: { label: string; tone: FairValueTone };
  perDiffLabel: string | null;
  pbvDiffLabel: string | null;
  riskNotes: string[];
}

function useFairValueCalculator(summary: StockSummary | null, fundamentals: FundamentalDetail | null): FairValueCalculation {
  const price = summary?.lastClose ?? 0;
  const eps = summary && summary.per > 0 ? price / summary.per : null;
  const bvps = summary && summary.pbv > 0 ? price / summary.pbv : null;

  const [meanPerInput, setMeanPerInput] = useState('15');
  const [meanPbvInput, setMeanPbvInput] = useState('1.5');
  const [growthInput, setGrowthInput] = useState('8');
  const [useGrowthGraham, setUseGrowthGraham] = useState(false);

  // Sinkronkan input rata-rata P/E & PBV dengan PER/PBV berjalan begitu data emiten
  // tersedia/berganti ticker — pola "adjust state on prop change" (bukan efek terpisah),
  // sebelumnya ini adalah initial state per-mount saat kartu ini masih mount belakangan.
  const [syncedTicker, setSyncedTicker] = useState<string | null>(null);
  if (summary && summary.ticker !== syncedTicker) {
    setSyncedTicker(summary.ticker);
    setMeanPerInput(summary.per > 0 ? summary.per.toFixed(1) : '15');
    setMeanPbvInput(summary.pbv > 0 ? summary.pbv.toFixed(2) : '1.5');
  }

  const meanPer = parseFloat(meanPerInput);
  const meanPbv = parseFloat(meanPbvInput);
  const g = parseFloat(growthInput);

  const fvPe = eps != null && eps > 0 && !Number.isNaN(meanPer) ? eps * meanPer : null;
  const fvPbv = bvps != null && bvps > 0 && !Number.isNaN(meanPbv) ? bvps * meanPbv : null;
  const fvGraham =
    eps == null || eps <= 0 ? null :
      useGrowthGraham
        ? (!Number.isNaN(g) ? eps * (8.5 + 2 * g) : null)
        : (bvps != null && bvps > 0 ? Math.sqrt(22.5 * eps * bvps) : null);

  const upside = (fv: number | null) => (fv != null && price > 0 ? ((fv - price) / price) * 100 : null);
  const statusOf = (u: number | null): { label: string; tone: FairValueTone } => {
    if (u == null) return { label: '–', tone: 'zinc' };
    if (u >= 15) return { label: 'Undervalued', tone: 'green' };
    if (u <= -15) return { label: 'Overvalued', tone: 'red' };
    return { label: 'Fair Value', tone: 'amber' };
  };

  const rows: FairValueRow[] = [
    { key: 'pe', label: 'P/E Ratio', fv: fvPe },
    { key: 'pbv', label: 'PBV Ratio', fv: fvPbv },
    { key: 'graham', label: 'Graham Value', fv: fvGraham },
  ];
  const validFvs = rows.map((r) => r.fv).filter((v): v is number => v != null);
  const consensus = validFvs.length > 0 ? validFvs.reduce((a, b) => a + b, 0) / validFvs.length : null;
  const consensusUpside = upside(consensus);

  const verdict: { label: string; tone: FairValueTone } =
    consensusUpside == null ? { label: '–', tone: 'zinc' } :
      consensusUpside >= 25 ? { label: 'DEEPLY UNDERVALUED', tone: 'green' } :
        consensusUpside <= -15 ? { label: 'OVERVALUED', tone: 'red' } : { label: 'FAIR VALUE', tone: 'amber' };

  const perDiffLabel = summary && summary.per > 0 && !Number.isNaN(meanPer)
    ? `PER saat ini ${fmtIdNum(summary.per, 1)}× ${summary.per < meanPer ? 'lebih rendah' : 'lebih tinggi'} dibanding rata-rata input Anda (${fmtIdNum(meanPer, 1)}×).`
    : null;
  const pbvDiffLabel = summary && summary.pbv > 0 && !Number.isNaN(meanPbv)
    ? `PBV saat ini ${fmtIdNum(summary.pbv, 2)}× ${summary.pbv < meanPbv ? 'lebih rendah' : 'lebih tinggi'} dibanding rata-rata input Anda (${fmtIdNum(meanPbv, 2)}×).`
    : null;

  const riskNotes: string[] = [];
  if (eps == null || eps <= 0) riskNotes.push('EPS negatif/tidak tersedia — metode P/E dan Graham tidak valid untuk emiten ini.');
  if (bvps == null || bvps <= 0) riskNotes.push('BVPS negatif/tidak tersedia — metode PBV dan Graham tidak valid untuk emiten ini.');
  if (fundamentals?.debtToEquity != null && fundamentals.debtToEquity > 100) {
    riskNotes.push(`DER ${fmtIdNum(fundamentals.debtToEquity, 1)}% tergolong tinggi — cek beban bunga & risiko solvabilitas sebelum mengandalkan valuasi ini.`);
  }
  if (fundamentals?.revenueGrowth != null && fundamentals.revenueGrowth < 0) {
    riskNotes.push(`Pertumbuhan pendapatan YoY negatif (${fmtIdNum(fundamentals.revenueGrowth, 1)}%) — verifikasi tren laba sebelum memakai asumsi pertumbuhan di atas.`);
  }
  riskNotes.push('Rata-rata P/E & PBV historis di atas adalah input manual Anda, bukan data historis 5 tahun yang diambil otomatis — verifikasi dengan data riil sebelum mengambil keputusan.');

  return {
    price, eps, bvps,
    meanPerInput, setMeanPerInput,
    meanPbvInput, setMeanPbvInput,
    growthInput, setGrowthInput,
    useGrowthGraham, setUseGrowthGraham,
    rows, upside, statusOf,
    consensus, consensusUpside, verdict,
    perDiffLabel, pbvDiffLabel, riskNotes,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 📊 FUNDAMENTAL SCREENING SECTION
// ─────────────────────────────────────────────────────────────────────────────
function FundamentalSection({
  summary,
  screening,
  fundamentals,
  fundamentalsLoading,
  fv,
}: {
  summary: StockSummary;
  screening: FundamentalScreeningResult;
  fundamentals: FundamentalDetail | null;
  fundamentalsLoading: boolean;
  fv: FairValueCalculation;
}) {
  const { per, pbv, roe } = summary;

  const toneBg = {
    green: 'bg-emerald-50 dark:bg-emerald-400/10',
    amber: 'bg-amber-50 dark:bg-amber-400/10',
    red: 'bg-rose-50 dark:bg-rose-400/10',
  };
  const toneText = {
    green: 'text-emerald-700 dark:text-emerald-300',
    amber: 'text-amber-700 dark:text-amber-300',
    red: 'text-rose-700 dark:text-rose-300',
  };

  const statusList = [screening.perStatus, screening.pbvStatus, screening.roeStatus, screening.capStatus];
  const [showDetails, setShowDetails] = useState(false);

  return (
    <SectionCard title="Screening & Analisis Fundamental" icon={<PieChart className="size-4" />} accentClass="bg-indigo-500">
      {/* Screening Status Banner */}
      <div className={cn(
        'neo-border p-4 mb-4 flex items-center justify-between gap-3',
        screening.passed
          ? 'bg-emerald-50 dark:bg-emerald-500/10'
          : 'bg-amber-50 dark:bg-amber-500/10'
      )}>
        <div className="flex items-center gap-3">
          <span className={cn('text-2xl', screening.passed ? 'text-emerald-500' : 'text-amber-500')}>
            {screening.passed ? '✅' : '⚠️'}
          </span>
          <div>
            <h3 className={cn('font-bold text-sm sm:text-base', screening.passed ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300')}>
              {screening.statusText}
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Skor Kelayakan Fundamental: <strong>{screening.score}/100</strong>
            </p>
          </div>
        </div>
        <span className={cn(
          'font-mono text-xl font-bold tabular-nums',
          screening.score >= 70 ? 'text-emerald-600 dark:text-emerald-400' : screening.score >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'
        )}>
          {screening.score} Pts
        </span>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4 sm:grid-cols-4">
        <div className="neo-border bg-zinc-50 dark:bg-zinc-900/60 px-4 py-3 text-center">
          <div className="text-sm font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">Market Cap</div>
          <div className="mt-1 font-mono text-sm font-bold text-zinc-800 dark:text-zinc-100">{formatCompact(summary.capitalization)}</div>
        </div>
        <div className="neo-border bg-zinc-50 dark:bg-zinc-900/60 px-4 py-3 text-center">
          <div className="text-sm font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">PER (Valuasi)</div>
          <div className="mt-1 font-mono text-sm font-bold text-zinc-800 dark:text-zinc-100">{per > 0 ? `${per.toFixed(1)}×` : '–'}</div>
        </div>
        <div className="neo-border bg-zinc-50 dark:bg-zinc-900/60 px-4 py-3 text-center">
          <div className="text-sm font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">PBV (Rasio Aset)</div>
          <div className="mt-1 font-mono text-sm font-bold text-zinc-800 dark:text-zinc-100">{pbv > 0 ? `${pbv.toFixed(2)}×` : '–'}</div>
        </div>
        <div className="neo-border bg-zinc-50 dark:bg-zinc-900/60 px-4 py-3 text-center">
          <div className="text-sm font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">ROE (Profitabilitas)</div>
          <div className="mt-1 font-mono text-sm font-bold text-zinc-800 dark:text-zinc-100">{roe !== 0 ? `${roe.toFixed(1)}%` : '–'}</div>
        </div>
      </div>

      {/* Detail Screening Rows */}
      <div className="space-y-2.5 mb-4">
        {statusList.map((item) => (
          <div key={item.label} className={cn('neo-border px-4 py-3', toneBg[item.tone])}>
            <div className="flex justify-between items-center">
              <span className={cn('text-sm font-bold', toneText[item.tone])}>{item.label}</span>
            </div>
            <p className="text-sm mt-1 text-zinc-600 dark:text-zinc-400 leading-relaxed">{item.detail}</p>
          </div>
        ))}
      </div>

      {/* Detail Lainnya (accordion): Dividen & Riwayat — rasio sekunder disembunyikan by default */}
      <div className="border-t-2 border-(--neo-line) pt-3">
        <button
          type="button"
          onClick={() => setShowDetails((v) => !v)}
          aria-expanded={showDetails}
          className="flex w-full items-center justify-between gap-2 py-1"
        >
          <span className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-zinc-700 dark:text-zinc-300">
            <History className="size-4 text-zinc-400" strokeWidth={2.5} />
            Lihat Detail Lainnya (Dividen & Riwayat)
          </span>
          <ChevronDown className={cn('size-4 shrink-0 text-zinc-400 transition-transform', showDetails && 'rotate-180')} strokeWidth={2.5} />
        </button>

        {showDetails && (fundamentalsLoading ? (
          <div className="flex items-center gap-2 py-3 text-sm font-semibold text-zinc-400">
            <Loader2 className="size-4 animate-spin" strokeWidth={2.5} /> Memuat data dividen…
          </div>
        ) : (
          <div className="pt-3">
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="neo-border bg-zinc-50 dark:bg-zinc-900/60 px-3 py-3 text-center">
                <div className="text-sm font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">Dividen (TTM)</div>
                <div className="mt-1 font-mono text-sm font-bold text-zinc-800 dark:text-zinc-100">
                  {fundamentals?.dividendPerShareTtm != null ? fmtRp(fundamentals.dividendPerShareTtm) : '–'}
                </div>
              </div>
              <div className="neo-border bg-zinc-50 dark:bg-zinc-900/60 px-3 py-3 text-center">
                <div className="text-sm font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">Dividend Yield</div>
                <div className="mt-1 font-mono text-sm font-bold text-zinc-800 dark:text-zinc-100">
                  {fundamentals?.dividendYield != null ? `${fundamentals.dividendYield.toFixed(2)}%` : '–'}
                </div>
              </div>
              <div className="neo-border bg-zinc-50 dark:bg-zinc-900/60 px-3 py-3 text-center">
                <div className="text-sm font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">Payout Ratio</div>
                <div className="mt-1 font-mono text-sm font-bold text-zinc-800 dark:text-zinc-100">
                  {fundamentals?.dividendPayoutRatio != null ? `${fundamentals.dividendPayoutRatio.toFixed(1)}%` : '–'}
                </div>
              </div>
            </div>

            {fundamentals?.dividendHistory && fundamentals.dividendHistory.length > 0 ? (
              <div className="neo-border divide-y-2 divide-(--neo-line) bg-white dark:bg-zinc-900">
                {fundamentals.dividendHistory.slice(0, 8).map((entry) => (
                  <div key={entry.date} className="flex items-center justify-between px-4 py-2 text-sm">
                    <span className="text-zinc-500 dark:text-zinc-400">
                      {new Date(entry.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                    <span className="font-mono font-semibold text-zinc-800 dark:text-zinc-200">{fmtRp(entry.amount)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-2 text-sm font-semibold text-zinc-400">
                {fundamentals ? 'Tidak ada riwayat dividen tercatat untuk emiten ini.' : 'Data dividen tidak tersedia saat ini.'}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="h-[2px] bg-(--neo-line) mt-4" />

      {/* 📊 Rangkuman Valuasi (dari Kalkulator Nilai Wajar) */}
      <div className="mt-4">
        <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-800 dark:text-zinc-200 mb-2">
          📊 Rangkuman Valuasi (Fair Value)
        </h3>
        <div className="overflow-x-auto -mx-1">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="text-zinc-400 dark:text-zinc-500 border-b-2 border-(--neo-line) text-left">
                <th className="font-bold uppercase py-1.5 pr-2 text-xs">Metode</th>
                <th className="font-bold uppercase py-1.5 px-2 text-xs text-right">Harga Wajar</th>
                <th className="font-bold uppercase py-1.5 px-2 text-xs">Status Valuasi</th>
                <th className="font-bold uppercase py-1.5 pl-2 text-xs text-right">Upside/Downside</th>
              </tr>
            </thead>
            <tbody>
              {fv.rows.map((r) => {
                const u = fv.upside(r.fv);
                const s = fv.statusOf(u);
                return (
                  <tr key={r.key} className="border-b border-zinc-100 dark:border-zinc-800">
                    <td className="py-1.5 pr-2 font-semibold text-zinc-700 dark:text-zinc-300">{r.label}</td>
                    <td className="py-1.5 px-2 text-right font-mono">{r.fv != null ? fmtRp(r.fv) : '–'}</td>
                    <td className="py-1.5 px-2"><Pill tone={s.tone}>{s.label}</Pill></td>
                    <td className={cn('py-1.5 pl-2 text-right font-mono font-bold', u != null && u >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
                      {u != null ? fmtIdPct(u) : '–'}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-teal-50 dark:bg-teal-500/10 font-bold">
                <td className="py-2 pr-2 text-zinc-900 dark:text-zinc-100">Rata-Rata Konsensus</td>
                <td className="py-2 px-2 text-right font-mono text-zinc-900 dark:text-zinc-100">{fv.consensus != null ? fmtRp(fv.consensus) : '–'}</td>
                <td className="py-2 px-2"><Pill tone={fv.verdict.tone}>{fv.verdict.label}</Pill></td>
                <td className={cn('py-2 pl-2 text-right font-mono', fv.consensusUpside != null && fv.consensusUpside >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
                  {fv.consensusUpside != null ? fmtIdPct(fv.consensusUpside) : '–'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="h-[2px] bg-(--neo-line) mt-4" />

      {/* 🎯 Kesimpulan & Catatan Risiko (Verdict) */}
      <div className="mt-4">
        <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-800 dark:text-zinc-200 mb-2">
          🎯 Kesimpulan & Catatan Risiko (Verdict)
        </h3>
        <ul className="space-y-1.5 text-sm">
          <li className="flex items-center gap-2">
            <span className="text-zinc-500 dark:text-zinc-400 shrink-0">Status Valuasi Utama:</span>
            <Pill tone={fv.verdict.tone}>{fv.verdict.label}</Pill>
          </li>
          {(fv.perDiffLabel || fv.pbvDiffLabel) && (
            <li className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
              <strong className="text-zinc-800 dark:text-zinc-200">Poin Kunci:</strong>{' '}
              {[fv.perDiffLabel, fv.pbvDiffLabel].filter(Boolean).join(' ')}
            </li>
          )}
          <li className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
            <strong className="text-zinc-800 dark:text-zinc-200">Catatan Risiko:</strong>
            <ul className="mt-1 space-y-1">
              {fv.riskNotes.map((note, i) => (
                <Note key={i} text={note} tone="zinc" />
              ))}
            </ul>
          </li>
        </ul>
      </div>
    </SectionCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 📰 NEWS & SENTIMENT ANALYSIS SECTION
// ─────────────────────────────────────────────────────────────────────────────
function NewsSection({
  newsItems,
  newsSummary,
  loading,
}: {
  newsItems: StockNewsItem[];
  newsSummary: NewsSentimentSummary;
  loading: boolean;
}) {
  const sentimentMeterColor =
    newsSummary.netSentimentScore >= 60 ? 'bg-emerald-500' : newsSummary.netSentimentScore <= 40 ? 'bg-rose-500' : 'bg-amber-400';

  return (
    <SectionCard title="Analisis Berita & Sentimen Pasar" icon={<Newspaper className="size-4" />} accentClass="bg-blue-500">
      {/* Sentiment Overview Banner */}
      <div className="neo-border bg-zinc-50 dark:bg-zinc-900/60 p-4 mb-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-800 dark:text-zinc-200">
              Meteran Sentimen Publik & Berita
            </h3>
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Berdasarkan {newsSummary.totalNews} artikel berita pasar modal terkini
            </p>
          </div>
          <Pill tone={newsSummary.overallSentiment === 'bullish' ? 'green' : newsSummary.overallSentiment === 'bearish' ? 'red' : 'amber'}>
            Sentimen: {newsSummary.overallSentiment.toUpperCase()} ({newsSummary.netSentimentScore}%)
          </Pill>
        </div>

        {/* Meter progress bar */}
        <div className="space-y-1">
          <div className="h-3 w-full border-2 border-(--neo-line) bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
            <div className={cn('h-full transition-all', sentimentMeterColor)} style={{ width: `${newsSummary.netSentimentScore}%` }} />
          </div>
          <div className="flex justify-between text-[11px] font-bold text-zinc-400">
            <span>0% Bearish</span>
            <span>50% Neutral</span>
            <span>100% Bullish</span>
          </div>
        </div>

        {/* News breakdown counts */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t-2 border-(--neo-line) text-center">
          <div>
            <div className="text-sm text-emerald-600 dark:text-emerald-400 font-bold">🟢 Bullish</div>
            <div className="font-mono text-sm font-bold text-zinc-800 dark:text-zinc-200">{newsSummary.bullishCount} Artikel</div>
          </div>
          <div>
            <div className="text-sm text-amber-600 dark:text-amber-400 font-bold">🟡 Netral</div>
            <div className="font-mono text-sm font-bold text-zinc-800 dark:text-zinc-200">{newsSummary.neutralCount} Artikel</div>
          </div>
          <div>
            <div className="text-sm text-rose-600 dark:text-rose-400 font-bold">🔴 Bearish</div>
            <div className="font-mono text-sm font-bold text-zinc-800 dark:text-zinc-200">{newsSummary.bearishCount} Artikel</div>
          </div>
        </div>
      </div>

      {/* News Feed List */}
      {loading ? (
        <div className="flex items-center justify-center py-8 gap-2 text-zinc-400 text-sm font-semibold">
          <Loader2 className="size-4 animate-spin text-blue-500" strokeWidth={2.5} /> Memuat berita emiten…
        </div>
      ) : newsItems.length === 0 ? (
        <p className="text-sm font-semibold text-zinc-400 py-4 text-center">Tidak ada berita ditemukan untuk emiten ini.</p>
      ) : (
        <div className="space-y-3">
          {newsItems.map((item) => (
            <div
              key={item.id}
              className="neo-border p-4 bg-white dark:bg-zinc-900 hover:neo-shadow-sm hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Pill tone={item.sentiment === 'bullish' ? 'green' : item.sentiment === 'bearish' ? 'red' : 'amber'}>
                      {item.sentiment.toUpperCase()}
                    </Pill>
                    <span className="text-sm text-zinc-400">{item.publisher} • {item.publishedAt}</span>
                  </div>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-sm sm:text-base text-zinc-900 dark:text-zinc-100 hover:text-blue-500 transition-colors flex items-center gap-1.5"
                  >
                    {item.title} <ExternalLink className="size-3.5 shrink-0 opacity-60" />
                  </a>
                  <p className="text-sm sm:text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2">
                    {item.snippet}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 📈 TECHNICAL SECTIONS
// ─────────────────────────────────────────────────────────────────────────────
function TrendEmaSection({ number, trendEma, isBullish, isBearish, bars }: {
  number: number; trendEma: TrendEmaAnalysis; isBullish: boolean; isBearish: boolean; bars: OHLCVBar[];
}) {
  const priceEma = useMemo(() => {
    const N = 40;
    const cls = barCloses(bars);
    const ema20Series = ema(cls, 20);
    return { closes: cls.slice(-N), ema20: ema20Series.slice(-N) };
  }, [bars]);

  return (
    <SectionCard number={number} title="Trend & EMA" icon={<TrendingUp className="size-4" />} accentClass="bg-blue-500">
      <div className="neo-border bg-zinc-50 dark:bg-zinc-900/60 px-3 pt-2 pb-1 mb-4">
        <div className="flex items-center justify-between text-[10px] font-bold uppercase text-zinc-400 mb-1">
          <span>Harga vs EMA20 (40 bar terakhir)</span>
          <span className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-zinc-600 dark:text-zinc-300"><span className="size-2 bg-zinc-600 dark:bg-zinc-300" />Close</span>
            <span className="inline-flex items-center gap-1 text-blue-400"><span className="size-2 bg-blue-400" />EMA20</span>
          </span>
        </div>
        <PriceEmaSparkline closesArr={priceEma.closes} emaArr={priceEma.ema20} />
      </div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: 'EMA 20', value: fmtRp(trendEma.ema20) },
          { label: 'EMA 50', value: fmtRp(trendEma.ema50) },
          { label: 'EMA 200', value: fmtRp(trendEma.ema200) },
        ].map(({ label, value }) => (
          <div key={label} className="neo-border bg-zinc-50 dark:bg-zinc-900/60 px-4 py-3 text-center">
            <div className="text-sm font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">{label}</div>
            <div className="mt-1 font-mono text-sm font-bold text-zinc-800 dark:text-zinc-100">{value}</div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 mb-3">
        <Pill tone={trendEma.priceVsEma20 === 'above' ? 'green' : 'red'}>
          Close {trendEma.priceVsEma20 === 'above' ? '>' : '<'} EMA20
        </Pill>
        <Pill tone={trendEma.priceVsEma50 === 'above' ? 'green' : 'red'}>
          Close {trendEma.priceVsEma50 === 'above' ? '>' : '<'} EMA50
        </Pill>
        <Pill tone={isBullish ? 'green' : isBearish ? 'red' : 'amber'}>
          Tren {isBullish ? 'Bullish 🟢' : isBearish ? 'Bearish 🔴' : 'Sideways 🟡'}
        </Pill>
        {trendEma.higherLows && <Pill tone="green">Higher Low ✓</Pill>}
      </div>
      <ul className="space-y-1.5">
        <Note text={trendEma.trendDescription} tone={isBullish ? 'green' : isBearish ? 'red' : 'zinc'} />
        {trendEma.higherLows && (
          <Note text="Terbentuk pola higher low — sinyal akumulasi bertahap yang positif." tone="green" />
        )}
      </ul>
    </SectionCard>
  );
}

function PriceActionSection({ number, priceAction }: { number: number; priceAction: PriceActionAnalysis }) {
  return (
    <SectionCard number={number} title="Price Action" icon={<Activity className="size-4" />} accentClass="bg-emerald-500">
      <div className="flex flex-wrap gap-2 mb-3">
        <Pill tone={priceAction.lastCandleColor === 'green' ? 'green' : priceAction.lastCandleColor === 'red' ? 'red' : 'zinc'}>
          Candle {priceAction.lastCandleColor === 'green' ? '🟢 Hijau' : priceAction.lastCandleColor === 'red' ? '🔴 Merah' : '⚪ Doji'}
        </Pill>
        {priceAction.pattern !== 'none' && (
          <Pill tone={
            ['bullish_engulfing', 'hammer', 'marubozu_bullish'].includes(priceAction.pattern) ? 'green' :
              ['bearish_engulfing', 'shooting_star', 'marubozu_bearish'].includes(priceAction.pattern) ? 'red' : 'zinc'
          }>
            {priceAction.patternLabel}
          </Pill>
        )}
        <Pill tone={priceAction.aboveEma20 ? 'green' : 'red'}>
          {priceAction.aboveEma20 ? 'Di atas EMA20' : 'Di bawah EMA20'}
        </Pill>
        <Pill tone={priceAction.aboveEma50 ? 'green' : 'red'}>
          {priceAction.aboveEma50 ? 'Di atas EMA50' : 'Di bawah EMA50'}
        </Pill>
      </div>
      <ul className="space-y-1.5">
        {priceAction.notes.map((note, i) => <Note key={i} text={note} />)}
      </ul>
    </SectionCard>
  );
}

function VolumeSection({ number, volume }: { number: number; volume: VolumeAnalysis }) {
  return (
    <SectionCard number={number} title="Volume & RVOL" icon={<BarChart2 className="size-4" />} accentClass="bg-cyan-500">
      <div className="grid grid-cols-2 gap-3 mb-4 sm:grid-cols-4">
        {[
          { label: 'Volume Hari Ini', value: new Intl.NumberFormat('id-ID').format(volume.lastVolume) },
          { label: 'Volume MA20', value: Number.isNaN(volume.volumeMa20) ? '–' : new Intl.NumberFormat('id-ID').format(Math.round(volume.volumeMa20)) },
          { label: 'RVOL', value: Number.isNaN(volume.relativeVolume) ? '–' : `${volume.relativeVolume.toFixed(2)}×` },
          { label: 'Tren Volume', value: volume.volumeTrend === 'increasing' ? '📈 Naik' : volume.volumeTrend === 'decreasing' ? '📉 Turun' : '➡️ Normal' },
        ].map(({ label, value }) => (
          <div key={label} className="neo-border bg-zinc-50 dark:bg-zinc-900/60 px-4 py-3 text-center">
            <div className="text-sm text-zinc-400 dark:text-zinc-500 uppercase tracking-wide leading-tight">{label}</div>
            <div className="mt-1 font-mono text-sm font-semibold text-zinc-800 dark:text-zinc-100">{value}</div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 mb-3">
        <Pill tone={volume.isHighVolume ? 'green' : 'amber'}>
          {volume.isHighVolume ? '✅ Volume Tinggi' : '⚠️ Volume Kurang'}
        </Pill>
      </div>
      <ul className="space-y-1.5">
        {volume.notes.map((note, i) => (
          <Note key={i} text={note} tone={volume.isHighVolume ? 'green' : 'zinc'} />
        ))}
      </ul>
    </SectionCard>
  );
}

function IndicatorsSection({ number, indicators, bars }: { number: number; indicators: IndicatorAnalysis; bars: OHLCVBar[] }) {
  const rsiSeries = useMemo(() => rsi(bars, 14).slice(-40), [bars]);
  const macdHistSeries = useMemo(() => macd(bars).histogram.slice(-40), [bars]);

  return (
    <SectionCard number={number} title="Indikator Teknikal" icon={<Zap className="size-4" />} accentClass="bg-amber-500">
      <div className="space-y-5">
        {/* RSI */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold uppercase text-zinc-700 dark:text-zinc-300">RSI (14)</h3>
            <Pill tone={
              indicators.rsiZone === 'oversold' ? 'green' :
                indicators.rsiZone === 'overbought' || indicators.rsiZone === 'overbought_risk' ? 'red' :
                  indicators.rsiZone === 'bullish_zone' ? 'green' : 'zinc'
            }>
              {fmtN(indicators.rsi14, 1)}
            </Pill>
          </div>
          <RsiBar value={indicators.rsi14} />
          <div className="mt-2 neo-border bg-zinc-50 dark:bg-zinc-900/60 px-3 pt-2 pb-1">
            <div className="text-[10px] font-bold uppercase text-zinc-400 mb-1">RSI 40 bar terakhir</div>
            <Sparkline data={rsiSeries} bands={[30, 70]} toneClass="text-amber-500" />
          </div>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{indicators.rsiNote}</p>
        </div>

        <div className="h-[3px] bg-(--neo-line)" />

        {/* MACD */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold uppercase text-zinc-700 dark:text-zinc-300">MACD (12, 26, 9)</h3>
            <Pill tone={
              indicators.macdSignalType === 'bullish_crossover' || indicators.macdSignalType === 'bullish' ? 'green' :
                indicators.macdSignalType === 'bearish_crossover' || indicators.macdSignalType === 'bearish' ? 'red' : 'zinc'
            }>
              {indicators.macdSignalType.replace(/_/g, ' ')}
            </Pill>
          </div>
          <div className="neo-border bg-zinc-50 dark:bg-zinc-900/60 px-3 pt-2 pb-1 mb-2">
            <div className="text-[10px] font-bold uppercase text-zinc-400 mb-1">Histogram MACD 40 bar terakhir</div>
            <HistogramSparkline data={macdHistSeries} />
          </div>
          <div className="grid grid-cols-3 gap-3 mb-2">
            <div className="neo-border bg-zinc-50 dark:bg-zinc-900/60 px-3 py-2 text-center">
              <div className="text-sm text-zinc-400 dark:text-zinc-500">MACD</div>
              <div className="font-mono text-sm font-semibold text-zinc-800 dark:text-zinc-100 mt-0.5">{fmtN(indicators.macdValue)}</div>
            </div>
            <div className="neo-border bg-zinc-50 dark:bg-zinc-900/60 px-3 py-2 text-center">
              <div className="text-sm text-zinc-400 dark:text-zinc-500">Signal</div>
              <div className="font-mono text-sm font-semibold text-zinc-800 dark:text-zinc-100 mt-0.5">{fmtN(indicators.macdSignal)}</div>
            </div>
            <div className="neo-border bg-zinc-50 dark:bg-zinc-900/60 px-3 py-2 text-center">
              <div className="text-sm text-zinc-400 dark:text-zinc-500">Histogram</div>
              <div className={cn(
                'font-mono text-sm font-semibold mt-0.5',
                indicators.macdHistogram >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              )}>
                {fmtN(indicators.macdHistogram)}
              </div>
            </div>
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{indicators.macdNote}</p>
        </div>
      </div>
    </SectionCard>
  );
}

// ─── Breakout Hunter section ────────────────────────────────────────────────────
function BreakoutHunterSection({ ticker, scores }: { ticker: string; scores: BreakoutScores }) {
  const dimensions = [
    { icon: '🌀', label: 'Compression Score', weight: 20, value: scores.compression },
    { icon: '🏦', label: 'Smart Money Score', weight: 20, value: scores.smartMoney },
    { icon: '💰', label: 'Liquidity Score', weight: 15, value: scores.likuiditas },
    { icon: '📊', label: 'Volume Expansion', weight: 15, value: scores.volumeExpansion },
    { icon: '🎯', label: 'Breakout Position', weight: 10, value: scores.breakoutPosition },
    { icon: '🔥', label: 'Momentum Score', weight: 10, value: scores.momentum },
    { icon: '📐', label: 'Historical Volatility', weight: 5, value: scores.historicalVolatility },
    { icon: '🧭', label: 'Historical Beta', weight: 5, value: scores.historicalBeta },
  ];

  return (
    <SectionCard title="Breakout Hunter AI Score" icon={<Rocket className="size-4" />} accentClass="bg-rose-500">
      <div className="flex flex-wrap items-center justify-between gap-3 neo-border px-4 py-3 mb-5 text-white bg-rose-600">
        <span className="text-sm font-bold uppercase tracking-wide">Status: {scores.status}</span>
        <span className="font-mono text-lg font-bold tabular-nums">Composite {scores.composite}/100</span>
      </div>

      <p className="text-sm font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3">
        8 Dimensi Skor AI Breakout
      </p>
      <div className="space-y-4 mb-5">
        {dimensions.map((d) => (
          <div key={d.label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">
                {d.icon} {d.label} <span className="text-zinc-400 dark:text-zinc-500">({d.weight}%)</span>
              </span>
              <span className="font-mono text-sm font-bold text-zinc-800 dark:text-zinc-100">{d.value}/100</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden border-2 border-(--neo-line) bg-zinc-100 dark:bg-zinc-800">
              <div className="h-full transition-all bg-emerald-500" style={{ width: `${d.value}%` }} />
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

// ─── Indonesian-style comma-decimal number formatter (khusus kartu ini) ────────
function fmtIdNum(n: number, dec = 1): string {
  if (Number.isNaN(n)) return '–';
  return n.toLocaleString('id-ID', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
function fmtIdPct(n: number, dec = 1): string {
  if (Number.isNaN(n)) return '–';
  const sign = n > 0 ? '+' : '';
  return `${sign}${fmtIdNum(n, dec)}%`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 💹 FAIR VALUE CALCULATOR — P/E Expansion, PBV Band, Graham Formula
// ─────────────────────────────────────────────────────────────────────────────
function FairValueCalculatorCard({
  summary,
  fv,
}: {
  summary: StockSummary;
  fv: FairValueCalculation;
}) {
  return (
    <SectionCard title="Kalkulator Nilai Wajar (Fair Value)" icon={<Crosshair className="size-4" />} accentClass="bg-teal-600" collapsible defaultOpen>
      <div className="space-y-5">
        {/* 1. Data Dasar Emiten */}
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-800 dark:text-zinc-200 mb-2">
            📌 1. Data Dasar Emiten
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-3">
            <div className="neo-border bg-zinc-50 dark:bg-zinc-900/60 px-3 py-2.5 text-center">
              <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Harga Saat Ini</div>
              <div className="mt-1 font-mono text-sm font-bold text-zinc-800 dark:text-zinc-100">{fmtRp(fv.price)}</div>
            </div>
            <div className="neo-border bg-zinc-50 dark:bg-zinc-900/60 px-3 py-2.5 text-center">
              <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">EPS (TTM, estimasi)</div>
              <div className="mt-1 font-mono text-sm font-bold text-zinc-800 dark:text-zinc-100">{fv.eps != null ? fmtRp(fv.eps) : '–'}</div>
            </div>
            <div className="neo-border bg-zinc-50 dark:bg-zinc-900/60 px-3 py-2.5 text-center">
              <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">BVPS (estimasi)</div>
              <div className="mt-1 font-mono text-sm font-bold text-zinc-800 dark:text-zinc-100">{fv.bvps != null ? fmtRp(fv.bvps) : '–'}</div>
            </div>
            <div className="neo-border bg-zinc-50 dark:bg-zinc-900/60 px-3 py-2.5 text-center">
              <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">PER / PBV Saat Ini</div>
              <div className="mt-1 font-mono text-sm font-bold text-zinc-800 dark:text-zinc-100">
                {summary.per > 0 ? `${fmtIdNum(summary.per, 1)}×` : '–'} / {summary.pbv > 0 ? `${fmtIdNum(summary.pbv, 2)}×` : '–'}
              </div>
            </div>
          </div>
          <p className="text-[11px] text-zinc-400 mb-3">
            EPS & BVPS di atas diestimasi dari Harga ÷ PER dan Harga ÷ PBV berjalan (data real-time), bukan angka laporan keuangan langsung.
          </p>

          {/* Input: Mean P/E & PBV 5Y + growth assumption */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="space-y-1">
              <span className="block text-[11px] font-bold uppercase text-zinc-500 dark:text-zinc-400">Rata-Rata P/E 5Y</span>
              <input
                type="number"
                step={0.1}
                value={fv.meanPerInput}
                onChange={(e) => fv.setMeanPerInput(e.target.value)}
                className="w-full text-center font-mono text-sm font-bold border-2 border-(--neo-line) bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 py-1.5 focus:outline-none focus:border-teal-400 dark:focus:border-teal-500"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-[11px] font-bold uppercase text-zinc-500 dark:text-zinc-400">Rata-Rata PBV 5Y</span>
              <input
                type="number"
                step={0.01}
                value={fv.meanPbvInput}
                onChange={(e) => fv.setMeanPbvInput(e.target.value)}
                className="w-full text-center font-mono text-sm font-bold border-2 border-(--neo-line) bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 py-1.5 focus:outline-none focus:border-teal-400 dark:focus:border-teal-500"
              />
            </label>
            <label className="space-y-1">
              <span className="flex items-center justify-between text-[11px] font-bold uppercase text-zinc-500 dark:text-zinc-400">
                <span>Asumsi Growth (g%)</span>
                <button
                  type="button"
                  onClick={() => fv.setUseGrowthGraham((v) => !v)}
                  className={cn('text-[10px] px-1.5 py-0.5 border-2 border-(--neo-line) font-bold', fv.useGrowthGraham ? 'bg-teal-500 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500')}
                >
                  {fv.useGrowthGraham ? 'Dipakai' : 'Graham Klasik'}
                </button>
              </span>
              <input
                type="number"
                step={0.5}
                value={fv.growthInput}
                onChange={(e) => fv.setGrowthInput(e.target.value)}
                disabled={!fv.useGrowthGraham}
                className="w-full text-center font-mono text-sm font-bold border-2 border-(--neo-line) bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 py-1.5 focus:outline-none focus:border-teal-400 dark:focus:border-teal-500 disabled:opacity-40"
              />
            </label>
          </div>
        </div>

        <div className="h-[2px] bg-(--neo-line)" />

        {/* 2. Rincian Perhitungan Harga Wajar */}
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-800 dark:text-zinc-200 mb-2">
            🧮 2. Rincian Perhitungan Harga Wajar
          </h3>
          <ul className="space-y-1.5 text-sm">
            {fv.rows.map((r) => {
              const u = fv.upside(r.fv);
              return (
                <li key={r.key} className="flex flex-wrap items-center gap-2">
                  <span className="text-zinc-500 dark:text-zinc-400 shrink-0">Metode {r.label}:</span>
                  <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">{r.fv != null ? fmtRp(r.fv) : '–'}</span>
                  {u != null && (
                    <span className={cn('text-xs font-bold', u >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
                      [{u >= 0 ? 'Upside' : 'Downside'} {fmtIdPct(u)}]
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="text-[11px] text-zinc-400 mt-2">
            Rangkuman valuasi lengkap & catatan risiko ada di tab <strong>Fundamental</strong>.
          </p>
        </div>
      </div>
    </SectionCard>
  );
}

// ─── Copy-as-text share button ─────────────────────────────────────────────────
function CopyShareButton({ getText }: { getText: () => string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      const url = typeof window !== 'undefined' ? window.location.href : '';
      await navigator.clipboard.writeText(`${getText()}\n\nSumber: ${SITE_NAME}${url ? ` — ${url}` : ''}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable */ }
  }, [getText]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="neo-press flex items-center gap-1 px-2.5 py-1.5 neo-border neo-shadow-sm bg-white text-xs font-bold text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 shrink-0"
    >
      {copied ? <CheckCircle2 className="size-3.5" strokeWidth={2.5} /> : <Copy className="size-3.5" strokeWidth={2.5} />}
      <span className="hidden sm:inline">{copied ? 'Disalin!' : 'Salin Teks'}</span>
    </button>
  );
}

// ─── Equity Research Report V2 (fixes: tick-valid SL, explicit RRR, PER-band valuation, ──
// ─── strategy-consistent scoring — see features_bandarmology.md evaluation notes) ────────
const ROUND_TRIP_FEE_PCT = 0.35; // approx. combined buy+sell broker fee, IDX retail avg

// entryType is the deterministic source of truth for "Strategi" — it comes straight from
// direction-aware scenario math in stockAnalysisEngine.ts, so strategy can never contradict
// direction (features_inkonsistensi.md §15/§16: strategy and direction must not conflict).
const ENTRY_TYPE_LABEL: Record<EntryType, string> = {
  BUY_ON_SUPPORT: 'Buy on Support',
  BUY_ON_PULLBACK: 'Buy on Pullback',
  BUY_ON_BREAKOUT: 'Buy on Breakout',
  SHORT_ON_REJECTION: 'Short on Rejection',
  SHORT_ON_BREAKDOWN: 'Short on Breakdown',
  WAIT_CONFIRMATION: 'Wait for Confirmation',
  NO_TRADE: 'No Trade / Avoid',
};

const TRADE_STATUS_STYLE: Record<TradeStatus, { label: string; tone: 'green' | 'red' | 'amber' | 'blue' | 'zinc' }> = {
  BUY: { label: 'BUY NOW', tone: 'green' },
  SHORT_SETUP: { label: 'SHORT SETUP', tone: 'blue' },
  WAIT: { label: 'WAIT', tone: 'amber' },
  WAIT_FOR_PULLBACK: { label: 'WAIT FOR PULLBACK', tone: 'amber' },
  NO_TRADE: { label: 'NO TRADE', tone: 'red' },
};

// Swing Suitability is a composite condition score, never a BUY signal (features_kontradiktif.md's
// Swing 1–5 Day prompt: "Swing Suitability bukan BUY signal") — a SWING_CANDIDATE stock can still
// resolve to WAIT/WAIT_FOR_PULLBACK once Zone Status / Entry Confirmation / Risk Gate run.
const SWING_SUITABILITY_STYLE: Record<SwingSuitabilityResult['classification'], { label: string; tone: 'green' | 'red' | 'amber' | 'blue' | 'zinc' }> = {
  SWING_CANDIDATE: { label: 'SWING CANDIDATE', tone: 'green' },
  WATCHLIST: { label: 'WATCHLIST', tone: 'blue' },
  LOW_QUALITY_SETUP: { label: 'LOW QUALITY SETUP', tone: 'amber' },
  NO_TRADE: { label: 'NO TRADE', tone: 'red' },
};

// Zone Status is its own pill, not folded into "distance to entry" text — a LONG buy-on-support
// plan with price ABOVE_ZONE must never be shown as an actionable BUY regardless of how bullish
// MACD/VWAP/RVOL look (features_kontradiktif.md rule 3, TRUE's price 67 vs entry zone 52–53).
const ZONE_STATUS_STYLE: Record<ZoneStatus, { label: string; tone: 'green' | 'red' | 'amber' | 'blue' | 'zinc' }> = {
  ABOVE_ZONE: { label: 'ABOVE ZONE', tone: 'red' },
  IN_ZONE: { label: 'IN ZONE', tone: 'green' },
  BELOW_ZONE: { label: 'BELOW ZONE', tone: 'amber' },
};

// Fundamental Risk is a risk modifier, never an automatic BUY/SELL — a score of 40/100 alone reads
// "just weak", but stacked with DER 151% (leverage) and ROE -22.2% (negative profitability) it
// escalates to HIGH (features_kontradiktif.md rule 6, riskGate.classifyFundamentalRisk).
const FUNDAMENTAL_RISK_STYLE: Record<FundamentalRiskLevel, { label: string; tone: 'green' | 'red' | 'amber' | 'blue' | 'zinc' }> = {
  LOW: { label: 'LOW', tone: 'green' },
  MODERATE: { label: 'MODERATE', tone: 'amber' },
  MODERATE_HIGH: { label: 'MODERATE HIGH', tone: 'amber' },
  HIGH: { label: 'HIGH', tone: 'red' },
};

// Replaces the old bare "Buy Allowed: TRUE/FALSE" pill, which answered three different questions
// at once — features_kontradiktif.md's TRUE case (sideways + weak fundamental + extreme
// overbought, none individually a hard blocker) could still read a plain "TRUE" next to a report
// full of warnings. Each question now gets its own field/pill; see riskGate.ts.
const RISK_GATE_STATUS_STYLE: Record<RiskGateStatus, { label: string; tone: 'green' | 'red' | 'amber' | 'blue' | 'zinc' }> = {
  CLEAR: { label: 'CLEAR', tone: 'green' },
  CONDITIONAL: { label: 'CONDITIONAL', tone: 'amber' },
  BLOCKED: { label: 'BLOCKED', tone: 'red' },
};
const BUY_PERMISSION_STYLE: Record<BuyPermission, { label: string; tone: 'green' | 'red' | 'amber' | 'blue' | 'zinc' }> = {
  TRUE: { label: 'TRUE', tone: 'green' },
  CONDITIONAL: { label: 'CONDITIONAL', tone: 'amber' },
  FALSE: { label: 'FALSE', tone: 'red' },
};
const ENTRY_STATUS_STYLE: Record<EntryStatus, { label: string; tone: 'green' | 'red' | 'amber' | 'blue' | 'zinc' }> = {
  NOT_READY: { label: 'NOT READY', tone: 'zinc' },
  WATCH: { label: 'WATCH', tone: 'amber' },
  CONFIRMED: { label: 'CONFIRMED', tone: 'green' },
  INVALIDATED: { label: 'INVALIDATED', tone: 'red' },
};

const VALIDATION_ERROR_LABEL: Record<string, string> = {
  ERROR_INVALID_PRICE: 'Data harga tidak valid (Entry/SL/TP kosong atau ≤ 0).',
  ERROR_INVALID_LONG_SL: 'Stop Loss tidak valid untuk LONG — SL harus di bawah Entry.',
  ERROR_INVALID_SHORT_SL: 'Stop Loss tidak valid untuk SHORT — SL harus di atas Entry.',
  ERROR_INVALID_TP_STRUCTURE: 'Struktur Target Profit tidak valid untuk arah posisi ini.',
};

// "Undervalued"/"Overvalued" implies a benchmark comparison (sector, historical) this function
// doesn't actually make — it only reads a PER band in isolation. features_analisa.md rule 9: "Jangan
// menyebut 'Undervalued' tanpa benchmark sektor/historis. Jika hanya berdasarkan PER/PBV → gunakan
// 'Valuation Relatively Low/High'."
function valuationFromPer(per: number): { label: string; tone: 'green' | 'red' | 'amber' | 'blue' | 'zinc' } {
  if (!(per > 0)) return { label: 'Data Tidak Tersedia', tone: 'zinc' };
  if (per <= 12) return { label: 'Valuasi Relatif Rendah (PER)', tone: 'green' };
  if (per <= 20) return { label: 'Wajar (Fair Value)', tone: 'green' };
  if (per <= 35) return { label: 'Premium', tone: 'amber' };
  return { label: 'Valuasi Relatif Tinggi (PER)', tone: 'red' };
}

function EquityResearchReportCard2({
  summary,
  bars,
  advisor,
  trendEma,
  indicators,
  supportResistance,
  fundamentalScreening,
  fundamentals,
  fundamentalsLoading,
  newsItems,
  tradingPlan,
  volume,
  priceAction,
  snapshot,
  marketRegime,
}: {
  summary: StockSummary;
  bars: OHLCVBar[];
  advisor: AiStockAdvisor;
  trendEma: TrendEmaAnalysis;
  indicators: IndicatorAnalysis;
  supportResistance: SupportResistanceAnalysis;
  fundamentalScreening: FundamentalScreeningResult;
  fundamentals: FundamentalDetail | null;
  fundamentalsLoading: boolean;
  newsItems: StockNewsItem[];
  tradingPlan: TradingPlanAnalysis;
  volume: VolumeAnalysis;
  priceAction: PriceActionAnalysis;
  /** Same Risk Gate inputs/logic as this card's own "Status Transaksi" (riskGate.ts), computed once
   * at the page level (see quickDecisionSnapshot useMemo) so "Ringkasan Faktor Keputusan" can never
   * disagree with the report above it for the same stock (features_kontradiktif.md). */
  snapshot: QuickDecisionSnapshotResult | null;
  /** IHSG regime (useMarketRegime, fetched once at the page level) — one of Swing Suitability's
   * factors. Data still loading reads null and is scored neutral, never penalized. */
  marketRegime: MarketRegimeResult | null;
}) {
  const bandarScore = useMemo(() => computeBandarScore(summary, bars ?? []), [summary, bars]);
  const entryTiming = useMemo(() => computeEntryTiming(bandarScore, indicators), [bandarScore, indicators]);
  const marketCyclePhase = useMemo(() => getMarketCyclePhase(bandarScore, indicators), [bandarScore, indicators]);
  type Tone = 'green' | 'red' | 'amber' | 'blue' | 'zinc';

  // Session VWAP from live 1-minute bars (Yahoo, delayed quote) — fetched separately from the
  // rest of this card since it's the only piece backed by real intraday data; everything else
  // here comes from the already-loaded daily analysis. Same source IntradayChart.tsx uses.
  const [intraday, setIntraday] = useState<IntradayResponse | null>(null);
  useEffect(() => {
    let cancelled = false;
    setIntraday(null);
    getStockIntraday(summary.ticker).then((result) => {
      if (!cancelled) setIntraday(result);
    });
    return () => {
      cancelled = true;
    };
  }, [summary.ticker]);
  const sessionVwap = intraday?.ok ? vwap(intraday.bars) : null;
  const vwapTone: Tone =
    sessionVwap == null ? 'zinc' : summary.lastClose >= sessionVwap * 1.002 ? 'green' : summary.lastClose <= sessionVwap * 0.998 ? 'red' : 'amber';

  // Intraday EMA9/EMA21 from the same 1-minute feed — needs at least 21 minutes into the
  // session before EMA21 has enough bars to seed; ema() returns NaN until then.
  const intradayPrices = intraday?.ok ? intraday.bars.map((b) => b.price) : [];
  const intradayEma9 = lastValid(ema(intradayPrices, 9));
  const intradayEma21 = lastValid(ema(intradayPrices, 21));
  const hasIntradayEma = !Number.isNaN(intradayEma9) && !Number.isNaN(intradayEma21);
  const emaTone: Tone = !hasIntradayEma ? 'zinc' : intradayEma9 > intradayEma21 ? 'green' : intradayEma9 < intradayEma21 ? 'red' : 'amber';

  // Market Status must reflect the technical trend, not the AI's composite buy/avoid verdict.
  // Conflating the two (the old `advisor.verdictTone`-based label) is exactly how a BEARISH/oversold
  // stock could show a "BULLISH"-toned status while the trading plan below was a SHORT setup — see
  // the UDNG case in features_inkonsistensi.md. Trade Status (below, from the Risk Gate) is the
  // field that actually says whether to act.
  const marketStatus: { label: string; tone: Tone } =
    trendEma.trend === 'bullish' ? { label: 'BULLISH', tone: 'green' } :
      trendEma.trend === 'bearish' ? { label: 'BEARISH', tone: 'red' } : { label: 'SIDEWAYS', tone: 'amber' };

  const trenLabel = trendEma.trend === 'bullish' ? 'Uptrend' : trendEma.trend === 'bearish' ? 'Downtrend' : 'Sideways';
  const trenTone: Tone = trendEma.trend === 'bullish' ? 'green' : trendEma.trend === 'bearish' ? 'red' : 'amber';

  // Oversold is tinted amber, not green — it's a warning condition ("kondisi, bukan sinyal beli
  // otomatis", see riskGate.ts's classifyOversoldRisk), not a bullish confirmation.
  // RSI 96.6 read as a plain "Overbought" pill is indistinguishable from RSI 71
  // (features_kontradiktif.md §4) — classifyRsiOverbought adds the EXTREME_OVERBOUGHT /
  // VERY_HIGH-chasing-risk tier on top of the coarser rsiZone used for scoring elsewhere.
  const rsiOverboughtInfo = classifyRsiOverbought(indicators.rsi14);
  const rsiStatus: { label: string; tone: Tone } =
    indicators.rsiZone === 'oversold' ? { label: 'Oversold', tone: 'amber' } :
      rsiOverboughtInfo.status === 'EXTREME_OVERBOUGHT' ? { label: 'Extreme Overbought', tone: 'red' } :
        indicators.rsiZone === 'overbought' || indicators.rsiZone === 'overbought_risk' ? { label: 'Overbought', tone: 'red' } :
          { label: 'Neutral', tone: 'zinc' };

  const macdStatus: { label: string; tone: Tone } =
    indicators.macdSignalType === 'bullish_crossover' ? { label: 'Golden Cross', tone: 'green' } :
      indicators.macdSignalType === 'bearish_crossover' ? { label: 'Death Cross', tone: 'red' } :
        indicators.macdSignalType === 'bullish' ? { label: 'Bullish', tone: 'green' } :
          indicators.macdSignalType === 'bearish' ? { label: 'Bearish', tone: 'red' } : { label: 'Neutral', tone: 'zinc' };

  const price = summary.lastClose;
  const aboveMa50 = price > trendEma.ema50;
  const aboveMa200 = price > trendEma.ema200;
  const maLabel = `${aboveMa50 ? 'Di atas' : 'Di bawah'} MA50 · ${aboveMa200 ? 'Di atas' : 'Di bawah'} MA200`;
  // Primary Trend Risk is its own field, separate from Risk Gate (features_analisa.md rule 8: "Jangan
  // otomatis membuat RiskGate=BLOCK kecuali rule risk memang memblokir. Pisahkan RiskGate dan
  // PrimaryTrendRisk.") — EMA200/EMA50 still feed Risk Gate as one of several hard reasons, but this
  // gives the primary-trend read its own explicit label instead of only surfacing buried inside a
  // Risk Gate reasons list.
  const primaryTrendRisk: 'BELOW_EMA200' | 'BELOW_EMA50' | 'NONE' =
    !aboveMa200 ? 'BELOW_EMA200' : !aboveMa50 ? 'BELOW_EMA50' : 'NONE';

  const nearestResistance = supportResistance.resistances[0];
  const nearestSupport = supportResistance.supports[0];

  // Fix 2A: derive valuation label from actual PER band (matches evaluateFundamentalScreening's
  // own thresholds) instead of collapsing every "green" tone into "Cheap" — a PER of 19.8x sits in
  // the 12–20x "Fair Value" band, not "Undervalued", even though its screening tone is green.
  const valuation = valuationFromPer(summary.per);

  const der = fundamentals?.debtToEquity ?? null;
  const solvencyLabel = der == null ? null : der <= 100 ? 'Solvent' : 'Berisiko (Risky)';
  const solvencyTone: Tone = der == null ? 'zinc' : der <= 100 ? 'green' : 'red';

  // UNRELATED items (a different company's news) must never be shown as this ticker's sentiment
  // headline — same rule that already excludes them from netSentimentScore (features_analisa.md
  // "FINAL PATCH" rule 4).
  const topBullishNews = newsItems.find((n) => n.sentiment === 'bullish' && n.relevance !== 'UNRELATED');
  const topBearishNews = newsItems.find((n) => n.sentiment === 'bearish' && n.relevance !== 'UNRELATED');

  // Checklist Swing vs Intraday — separates "this looks bullish" (swing, built from EOD data
  // this app already has) from "this is a confirmed intraday entry" (needs VWAP/EMA9-21/real-time
  // RVOL, which EzySaham does not compute — no intraday/minute data source). Surfacing that gap
  // explicitly stops a high swing score from being misread as a scalping green light.
  type ChecklistItem = { label: string; value: string; tone: Tone };
  const sentimentChecklist: { value: string; tone: Tone } = topBullishNews
    ? { value: 'Ada sentimen positif', tone: 'green' }
    : topBearishNews
      ? { value: 'Ada sentimen negatif', tone: 'red' }
      : { value: 'Belum signifikan', tone: 'amber' };
  const technicalScoreTone: Tone = advisor.technicalScore >= 70 ? 'green' : advisor.technicalScore >= 50 ? 'amber' : 'red';
  const breakoutScoreTone: Tone = advisor.breakoutScore >= 70 ? 'green' : advisor.breakoutScore >= 50 ? 'amber' : 'zinc';
  // RVOL answers "how much activity", not "which direction" — a high-RVOL red candle is
  // distribution/panic-selling, not a bullish signal. Pair it with the last candle's color instead
  // of treating "high volume" alone as green (features_kontradiktif.md §7: "Volume tinggi ≠
  // bullish"). A doji or missing high-volume read falls back to the old magnitude-only tone.
  // RVOL exactly 0/NaN usually means the volume feed hasn't populated, not "very low volume" — flag
  // it NO_DATA (zinc) instead of red so it doesn't read as a bearish signal (features_analisa.md
  // rule 4: "RVOL=0 → NO_DATA, bukan volume rendah").
  const rvolClass = classifyRvol(volume.relativeVolume);
  const rvolTone: Tone = rvolClass.tier === 'NO_DATA'
    ? 'zinc'
    : !volume.isHighVolume
      ? (volume.relativeVolume >= 1 ? 'amber' : 'red')
      : priceAction.lastCandleColor === 'red' ? 'red' : priceAction.lastCandleColor === 'green' ? 'green' : 'amber';
  const volumeTrendLabel = volume.volumeTrend === 'increasing' ? 'Meningkat' : volume.volumeTrend === 'decreasing' ? 'Menurun' : 'Normal';
  const volumeTrendTone: Tone = volume.volumeTrend === 'increasing' ? 'green' : volume.volumeTrend === 'decreasing' ? 'red' : 'zinc';
  const structureTone: Tone = trendEma.higherLows ? "green" : "amber";

  const swingChecklist: ChecklistItem[] = [
    { label: 'Trend', value: trenLabel, tone: trenTone },
    { label: 'RSI', value: `${fmtN(indicators.rsi14, 1)} (${rsiStatus.label})`, tone: rsiStatus.tone },
    { label: 'MACD', value: macdStatus.label, tone: macdStatus.tone },
    { label: 'Support', value: nearestSupport ? fmtRp(nearestSupport.price) : '–', tone: nearestSupport ? 'green' : 'zinc' },
    { label: 'Resistance', value: nearestResistance ? fmtRp(nearestResistance.price) : '–', tone: nearestResistance ? 'green' : 'zinc' },
    { label: 'Fundamental', value: `${valuation.label} (PER ${summary.per > 0 ? `${summary.per.toFixed(1)}×` : '–'})`, tone: valuation.tone },
    { label: 'Sentimen', value: sentimentChecklist.value, tone: sentimentChecklist.tone },
    { label: 'Technical Score', value: `${advisor.technicalScore}/100`, tone: technicalScoreTone },
  ];

  const vwapLabel =
    intraday === null
      ? 'Memuat data intraday…'
      : sessionVwap == null
        ? 'Data intraday tidak tersedia (sesi tertutup / tidak ada data)'
        : `${fmtRp(sessionVwap)} (harga ${summary.lastClose >= sessionVwap ? 'di atas' : 'di bawah'} VWAP)`;

  const emaLabel =
    intraday === null
      ? 'Memuat data intraday…'
      : !hasIntradayEma
        ? 'Data belum cukup (menunggu ≥21 menit sesi berjalan)'
        : `${fmtRp(intradayEma9)} / ${fmtRp(intradayEma21)} (${intradayEma9 > intradayEma21 ? 'EMA9 > EMA21' : intradayEma9 < intradayEma21 ? 'EMA9 < EMA21' : 'EMA9 = EMA21'})`;

  const intradayChecklist: ChecklistItem[] = [
    { label: 'VWAP', value: vwapLabel, tone: vwapTone },
    { label: 'EMA9 / EMA21', value: emaLabel, tone: emaTone },
    { label: 'RVOL', value: `${fmtN(volume.relativeVolume, 2)}× (${rvolClass.label})`, tone: rvolTone },
    { label: 'Volume', value: volumeTrendLabel, tone: volumeTrendTone },
    { label: 'RSI', value: `${fmtN(indicators.rsi14, 1)} (${rsiStatus.label})`, tone: rsiStatus.tone },
    { label: 'Struktur Harga', value: trendEma.higherLows ? 'Higher-low (harian)' : 'Belum ada pola higher-low', tone: structureTone },
    { label: 'Breakout Hunter', value: `${advisor.breakoutScore}/100`, tone: breakoutScoreTone },
  ];

  const bias = tradingPlan.recommendedBias === 'bearish' ? 'bearish' : 'bullish';
  const scenario = tradingPlan[bias];
  const isLong = scenario.direction === 'LONG';

  // strategiLabel now comes straight from entryType — a value stockAnalysisEngine.ts derives
  // together with direction/entry/SL/TP — instead of the AI composite verdict. The old
  // verdict-based mapping could show "Buy on Weakness" next to a SHORT scenario whenever the
  // composite score happened to read BELI/SANGAT_BELI, contradicting the plan below it
  // (features_inkonsistensi.md §15/§16: strategy must not conflict with direction).
  const strategiLabel = ENTRY_TYPE_LABEL[scenario.entryType];

  // Risk Gate + Oversold classification (riskGate.ts) — the "Consistency & Risk Gate" layer from
  // features_inkonsistensi.md. It never recomputes Entry/SL/TP (that stays deterministic above);
  // it only decides whether the resulting scenario may be presented as BUY/SHORT_SETUP right now,
  // or must be downgraded to WAIT/NO_TRADE (bearish trend + weak fundamentals + strong distribution
  // + deep oversold + price under EMA50/200 stacking up, or price not actually at the entry trigger
  // yet — see priceAtEntryTrigger below).
  const isStrongDistribution = bandarScore.classification.label === 'Strong Distribution';
  const isDistributionRisk = bandarScore.classification.label === 'Distribution Risk';
  // Entry Condition: is `price` actually on the actionable side of this scenario's trigger, and has
  // it not already blown through the invalidation line? A small % gap on the wrong side of the
  // trigger (AYLS ~9% above its buy-on-support zone, MMLP ~1% above its pullback zone) is still
  // "not there yet" — gating on raw distance-% alone let both show BUY before price actually pulled
  // back (features_riskgate.md).
  const priceAtEntryTrigger = isPriceAtEntryTrigger(scenario.direction, price, scenario.entry);
  const setupInvalidated = isSetupInvalidated(scenario.direction, price, scenario.sl);

  // Fix 1A: every actionable order price shown here — Entry, both targets, and the Stop Loss —
  // must snap to a valid IDX tick before display. JATS rejects raw fractions like Rp 31.840 or
  // Rp 31.343 for a stock trading above Rp 5.000 (valid tick there is Rp 25).
  //
  // The Entry Zone's lower bound may only ever come from "support" for a LONG buy-on-support plan.
  // A SHORT scenario has no such zone — its entry is a single rejection-trigger price at
  // resistance; pairing it with a support price (the old, direction-blind behaviour) produced a
  // nonsensical "zone" that mixed a bullish level into a bearish setup — the UDNG bug.
  const entryPrice = roundToTick(scenario.entry);
  const entryZoneLow = isLong && nearestSupport ? roundToTick(nearestSupport.price) : entryPrice;
  const entryZoneHigh = entryPrice;
  // Zone Status is its own explicit field, computed from the exact same entryZoneLow/High shown on
  // screen — never implied by a distance percentage or folded straight into "BUY"
  // (features_kontradiktif.md rule 1/3: TRUE at price 67 vs entry zone 52–53 is ABOVE_ZONE, full
  // stop, regardless of how bullish MACD/VWAP/RVOL look).
  const zoneStatus: ZoneStatus = classifyZoneStatus(price, entryZoneLow, entryZoneHigh);
  const fundamentalRisk = classifyFundamentalRisk(fundamentalScreening.score, der, summary.roe);

  // Entry Confirmation is a deterministic checklist, not price location alone (Swing 1–5 Day
  // prompt): support/retest reached + not breaking down + a reversal candle in this scenario's
  // favor + supportive volume + an intact trend. Reaching the entry trigger by price alone only
  // ever earns WATCH inside riskGate.ts — this is what actually promotes it to CONFIRMED.
  const lastBarForEntry = bars[bars.length - 1];
  const isDownCandleForEntry = !!lastBarForEntry && lastBarForEntry.close < lastBarForEntry.open;
  const bullishReversalCandle = priceAction.lastCandleColor === 'green' ||
    priceAction.pattern === 'bullish_engulfing' || priceAction.pattern === 'hammer' || priceAction.pattern === 'marubozu_bullish';
  const bearishReversalCandle = priceAction.lastCandleColor === 'red' ||
    priceAction.pattern === 'bearish_engulfing' || priceAction.pattern === 'shooting_star' || priceAction.pattern === 'marubozu_bearish';
  const reversalConfirmed = isLong ? bullishReversalCandle : bearishReversalCandle;
  const volumeSupportive = volume.relativeVolume >= 1;
  const trendValid = isLong ? trendEma.trend !== 'bearish' : trendEma.trend !== 'bullish';
  const entryConfirmed = isEntryConfirmed({
    priceAtEntryTrigger,
    setupInvalidated,
    trendValid,
    reversalConfirmed,
    volumeSupportive,
  });

  const riskGate = evaluateRiskGate({
    direction: scenario.direction,
    trend: trendEma.trend,
    rsi14: indicators.rsi14,
    fundamentalScore: fundamentalScreening.score,
    isStrongDistribution,
    priceBelowEma50: !aboveMa50,
    priceBelowEma200: !aboveMa200,
    priceAtEntryTrigger,
    setupInvalidated,
    extremeDistanceWarning: scenario.extremeDistanceWarning,
    isDistributionRisk,
    zoneStatus,
    der,
    roe: summary.roe,
    entryConfirmed,
  });

  // Swing Suitability (features_kontradiktif.md's EOD Swing 1–5 Day prompt) — a composite 0–100
  // read on whether this stock's current condition is swing-worthy at all. It is NOT a BUY signal:
  // a SWING_CANDIDATE can still resolve to WAIT/WAIT_FOR_PULLBACK below once Zone Status / Entry
  // Confirmation / Risk Gate run — this score never feeds into or overrides tradeStatus.
  const atr14 = lastValid(atr(bars, 14));
  const atrPct = atrPercent(atr14, price);
  const swingSuitability: SwingSuitabilityResult = computeSwingSuitability({
    price,
    trendEma,
    indicators,
    volume,
    isDownCandle: isDownCandleForEntry,
    nearestResistance,
    atrPct,
    fundamentalRisk,
    marketRegime: marketRegime?.regime ?? null,
    capitalization: summary.capitalization,
    value: summary.value,
    percentChange1M: summary.percentChange1M,
  });
  // Breakout Level is the same resistance shown elsewhere on this report (Area Kunci / Resistance) —
  // BREAKOUT can only be confirmed once price has actually reached/cleared it, never just from a
  // high Breakout Hunter score, bullish MACD/EMA, or high RVOL alone (features_analisa.md "FINAL
  // PATCH" rule 1/3). No resistance overhead at all (ATH) means there's nothing left to confirm
  // against, so it reads confirmed by default.
  const breakoutLevel = nearestResistance?.price ?? null;
  const breakoutPriceConfirmed = breakoutLevel == null || price >= breakoutLevel;
  const swingSetup = detectSwingSetup({
    direction: scenario.direction,
    entryType: scenario.entryType,
    canContinueUp: priceAction.canContinueUp,
    volumeConfirmed: volume.isHighVolume,
    breakoutPriceConfirmed,
  });
  // Unify "Strategi" with the new Setup concept for LONG (Buy on Pullback / Buy on Support /
  // Breakout / Breakout Watch) instead of showing two labels that could read differently for the
  // same scenario; SHORT scenarios keep the existing entryType-derived label since swingSetup only
  // classifies LONG.
  const strategiDisplay = isLong ? SWING_SETUP_LABEL[swingSetup] : strategiLabel;
  // Gaya Sinyal must never contradict the Setup pill right next to it (features_analisa.md rule 12:
  // Setup/Strategi and its "style" description must stay consistent) — it used to be a bare
  // isLong ternary unrelated to swingSetup, so a support-anchored entry could still show "Breakout"
  // as Setup while Gaya Sinyal said "Mean Reversion / Buy on Support" (or vice versa).
  const gayaLabel = !isLong
    ? 'Breakdown / Short on Rejection'
    : swingSetup === 'BREAKOUT'
      ? 'Momentum / Breakout Continuation'
      : swingSetup === 'BREAKOUT_WATCH'
        ? 'Momentum / Menunggu Konfirmasi Breakout'
        : 'Mean Reversion / Buy on Support';

  // Main Risk — the single most material warning right now, prioritized so the report never buries
  // a hard blocker under a list of minor notes. Falls back to the first Risk Gate reason, then a
  // clean "no major risk" note.
  const mainRisk =
    fundamentalRisk === 'HIGH' ? `Fundamental Risk HIGH — leverage tinggi (DER ${der != null ? `${der.toFixed(0)}%` : '–'}) & profitabilitas negatif (ROE ${summary.roe.toFixed(1)}%)` :
      rsiOverboughtInfo.chasingRisk === 'VERY_HIGH' ? `Chasing Risk VERY_HIGH — ${rsiOverboughtInfo.label}` :
        isStrongDistribution ? 'Bandar terindikasi Strong Distribution' :
          isDistributionRisk ? 'Bandar terindikasi Distribution Risk' :
            riskGate.reasons[0] ?? 'Tidak ada risk mayor terdeteksi saat ini';

  // Exit Condition — combines the invalidation rule with partial-profit-taking and a trend-flip
  // exit, so "when do I get out" never has to be inferred from separate SL/TP lines.
  const exitCondition = isLong
    ? `${scenario.invalidationRule}; pertimbangkan take-profit sebagian di TP1 (${fmtRp(roundToTick(scenario.tp1))}), sisanya di TP2 (${fmtRp(roundToTick(scenario.tp2))}); keluar juga jika trend berbalik bearish sebelum SL/TP tersentuh.`
    : `${scenario.invalidationRule}; keluar juga jika muncul reversal bullish kuat sebelum SL/TP tersentuh.`;
  // "NO VALIDATION = NO SIGNAL": if the engine's own math validation failed (SL/TP ordering vs
  // direction), this must never be presented as an actionable BUY/SHORT regardless of what the
  // Risk Gate says.
  const hasSetupErrors = scenario.validationErrors.length > 0;
  const tradeStatus: TradeStatus = hasSetupErrors ? 'NO_TRADE' : riskGate.tradeStatus;
  const tradeStatusStyle = TRADE_STATUS_STYLE[tradeStatus];
  // Risk Gate / Buy Permission / Entry Status are shown as three separate fields, not one bare
  // "Buy Allowed" boolean (features_kontradiktif.md) — WAIT on a SHORT scenario means a bearish
  // setup is being watched, not that a BUY is pending approval, and a CONDITIONAL Risk Gate must
  // stay visible instead of collapsing into a plain TRUE.
  const riskGateStatus: RiskGateStatus = riskGate.riskGateStatus;
  const buyPermission: BuyPermission = hasSetupErrors ? 'FALSE' : riskGate.buyPermission;
  const entryStatus: EntryStatus = riskGate.entryStatus;
  // "Chasing Risk" (features_riskgate.md's AYLS case): price already extended past the entry zone
  // while RSI is overbought — the setup is technically bullish but entering here means paying up
  // for an already-extended move, not the pullback the strategy is named for.
  const chasingRisk = isLong && !priceAtEntryTrigger && indicators.rsi14 >= 70;
  // A WAIT scenario is watching a setup, not waiting on a BUY — spell out which one so it can't be
  // misread as "waiting to buy" (features_riskgate.md §3, §AYLS/§MMLP). WAIT_FOR_PULLBACK is its
  // own tradeStatus (Zone Status ABOVE_ZONE) — never re-derived from a chasing-risk heuristic here.
  const tradeStatusLabel =
    tradeStatus === 'WAIT_FOR_PULLBACK' ? `WAIT — ${chasingRisk ? 'CHASING RISK, TUNGGU PULLBACK' : 'TUNGGU PULLBACK'}` :
      tradeStatus === 'WAIT' ? (isLong ? 'WAIT — MENUNGGU KONFIRMASI ENTRY' : 'WAIT — SHORT SETUP WATCH') :
        tradeStatusStyle.label;

  // "Oversold ≠ BUY" (features_inkonsistensi.md §7): RSI < 30 is a condition, never an automatic
  // reversal signal on its own. breakoutConfirmedWithVolume proxies "breakout + volume" off the
  // existing Wyckoff phase read (markup/momentum) rather than adding a new indicator.
  const breakoutConfirmedWithVolume =
    (marketCyclePhase.number === 2 || marketCyclePhase.number === 3) && volume.isHighVolume;
  const oversoldRisk = classifyOversoldRisk({
    rsi14: indicators.rsi14,
    trend: trendEma.trend,
    higherLows: trendEma.higherLows,
    macdBullish: indicators.macdSignalType === 'bullish' || indicators.macdSignalType === 'bullish_crossover',
    breakoutConfirmedWithVolume,
  });

  // Single source of truth for the "why" behind Trade Status — shown in the section 6 banner AND
  // reused verbatim in buildShareText, so the copied report can never drift from what's on screen
  // (it did, once, after setupInvalidated/chasingRisk were added only to the on-screen banner).
  const statusNote = hasSetupErrors
    ? 'Data Entry/SL/TP tidak konsisten — tidak dipublikasikan.'
    : setupInvalidated
      ? (isLong
        ? 'Harga sudah menembus Stop Loss — setup ini sudah tidak valid.'
        : 'Harga sudah menembus level invalidasi SHORT — setup ini sudah tidak valid.')
      : tradeStatus === 'NO_TRADE'
        ? isLong
          ? 'BUY diblokir oleh Risk Gate — lihat alasan di Ringkasan Instan.'
          : 'Risiko ekstrem terdeteksi (lihat alasan di Ringkasan Instan) — hindari transaksi apa pun untuk saat ini, termasuk short, sampai ada konfirmasi reversal.'
        : tradeStatus === 'WAIT_FOR_PULLBACK'
          ? chasingRisk
            ? `Harga (${fmtRp(price)}) sudah jauh di atas entry zone ${fmtRp(entryZoneLow)}–${fmtRp(entryZoneHigh)} dan RSI ${fmtN(indicators.rsi14, 1)} overbought — risiko mengejar (chasing) tinggi, tunggu pullback ke ${fmtRp(entryZoneHigh)} atau di bawahnya.`
            : `Harga (${fmtRp(price)}) masih di atas entry zone ${fmtRp(entryZoneLow)}–${fmtRp(entryZoneHigh)} (ZoneStatus: ABOVE_ZONE) — tunggu pullback, bukan sinyal beli meski MACD/VWAP/RVOL bullish.`
          : tradeStatus === 'WAIT'
            ? isLong
              ? 'Harga sudah berada di/dekat entry zone, namun trigger entry belum terkonfirmasi — tunggu konfirmasi sebelum eksekusi.'
              : `Bearish setup sedang dipantau, bukan menunggu BUY — harga (${fmtRp(price)}) belum rebound ke rejection trigger ${fmtRp(entryPrice)}.`
            : isLong
              ? 'Setup memenuhi syarat minimum Risk Gate untuk BUY.'
              : 'Setup SHORT aktif — tetap tunggu konfirmasi rejection sebelum eksekusi.';
  const slPrice = roundToTick(scenario.sl);
  const tp1Price = roundToTick(scenario.tp1);
  const tp2Price = roundToTick(scenario.tp2);

  // Reward must flip sign with direction: LONG profits when price rises above entry, SHORT profits
  // when price falls below entry. Using a LONG-only formula for both (the old bug) is exactly how
  // a SHORT's target ended up labeled "Gain" instead of "Potential Short Profit".
  const rewardLabel = isLong ? 'Gain' : 'Potential Short Profit';
  const rewardPct = (target: number) =>
    Math.max(0, isLong ? ((target - entryPrice) / entryPrice) * 100 : ((entryPrice - target) / entryPrice) * 100);
  const netRewardPct = (target: number) => Math.max(0, rewardPct(target) - ROUND_TRIP_FEE_PCT);
  // Risk is always a positive distance from Entry to SL regardless of direction — displayed as a
  // plain positive percentage, never with a leading "-" (features_analisa.md rule 5: "Risk % = ABS(entry
  // - SL) / entry × 100. Jangan tampilkan -0.5% atau -1.5%." — a negative-looking risk number reads
  // as a loss already realized rather than the magnitude being risked).
  const riskPctFromEntry = Math.abs(((slPrice - entryPrice) / entryPrice) * 100);
  const riskPctFromLow = isLong ? Math.abs(((slPrice - entryZoneLow) / entryZoneLow) * 100) : riskPctFromEntry;
  const riskRangeLabel =
    isLong && Math.abs(riskPctFromLow - riskPctFromEntry) >= 0.05
      ? `${fmtN(riskPctFromLow, 1)}% s.d. ${fmtN(riskPctFromEntry, 1)}%`
      : `${fmtN(riskPctFromEntry, 1)}%`;

  const buildShareText = () => {
    const faseBandarLabel = `${bandarScore.classification.label} (${bandarScore.phaseLabel})`;
    const faseSiklusLabel = marketCyclePhase.number != null ? `Fase ${marketCyclePhase.number} — ${marketCyclePhase.label}` : marketCyclePhase.label;

    const entryLines: string[] = [];
    if (hasSetupErrors) {
      entryLines.push(
        '🔴 SETUP TIDAK VALID — data Entry/SL/TP tidak konsisten dengan direction, angka tidak ditampilkan.',
        `Kode: ${scenario.validationErrors.map((code) => VALIDATION_ERROR_LABEL[code] ?? code).join('; ')}`
      );
    } else {
      if (setupInvalidated) {
        entryLines.push(`🔴 ${statusNote}`);
      }
      if (isLong && scenario.tp1AlreadyReached) {
        entryLines.push('⚠️ Target lama sudah terlampaui harga saat ini — TP1/TP2 di bawah sudah dihitung ulang ke resistance berikutnya (Target Validation Engine).');
      }
      if (isLong) {
        entryLines.push(
          `🔹 Entry Zone    : ${fmtRp(entryZoneLow)} - ${fmtRp(entryZoneHigh)}`,
          `🔹 Target Price 1: ${fmtRp(tp1Price)} (${rewardLabel}: +${fmtN(rewardPct(tp1Price), 1)}% · Net setelah fee: +${fmtN(netRewardPct(tp1Price), 1)}%)`,
          `🔹 Target Price 2: ${fmtRp(tp2Price)} (${rewardLabel}: +${fmtN(rewardPct(tp2Price), 1)}% · Net setelah fee: +${fmtN(netRewardPct(tp2Price), 1)}%)`,
          `🔹 Stop Loss     : ${fmtRp(slPrice)} (Risk: ${riskRangeLabel}) -> ${scenario.invalidationRule}`
        );
      } else {
        entryLines.push(
          `🔹 Rejection Zone (bukan entry sekarang): ${fmtRp(entryPrice)}`,
          `🔹 Entry Trigger : Short HANYA jika harga rebound/retest ke ${fmtRp(entryPrice)} dan gagal breakout (bearish rejection terkonfirmasi).`,
          `🔹 Target Price 1: ${fmtRp(tp1Price)} (${rewardLabel}: +${fmtN(rewardPct(tp1Price), 1)}% · Net setelah fee: +${fmtN(netRewardPct(tp1Price), 1)}%)`,
          `🔹 Target Price 2: ${fmtRp(tp2Price)} (${rewardLabel}: +${fmtN(rewardPct(tp2Price), 1)}% · Net setelah fee: +${fmtN(netRewardPct(tp2Price), 1)}%)`,
          `🔹 Stop Loss     : ${fmtRp(slPrice)} (Risk: ${riskRangeLabel}) -> ${scenario.invalidationRule}`
        );
      }
      if (!setupInvalidated && tradeStatus === 'NO_TRADE') {
        entryLines.push(`🔴 ${statusNote}`);
      } else if (tradeStatus === 'WAIT') {
        entryLines.push(`⏳ ${statusNote}`);
      }
      if (scenario.extremeDistanceWarning) {
        entryLines.push(`⚠️ Entry berjarak ${fmtN(scenario.entryDistancePct, 1)}% dari harga saat ini — bukan entry segera, tunggu retest/rebound.`);
      }
      if (scenario.extremeRRWarning) {
        entryLines.push(`⚠️ R:R ekstrem (1:${fmtN(scenario.riskRewardRatio, 2)}) — kemungkinan tidak actionable secara praktis, jangan anggap otomatis sebagai setup bagus.`);
      }
      const dt = scenario.defaultTarget;
      entryLines.push(
        '',
        `🎯 Default Target (Current Price Rp${fmtN(price, 0)}): SL ${fmtRp(dt.sl)} (${isLong ? '-' : '+'}${DEFAULT_SL_PCT}%) | TP1 ${fmtRp(dt.tp1)} (${isLong ? '+' : '-'}${DEFAULT_TP1_PCT}%) | TP2 ${fmtRp(dt.tp2)} (${isLong ? '+' : '-'}${DEFAULT_TP2_PCT}%) | R:R 1:${fmtN(dt.riskRewardRatio1, 2)} / 1:${fmtN(dt.riskRewardRatio2, 2)}`
      );
      if (!dt.stopLossValidation.ok) {
        entryLines.push(`⚠️ Stop Loss Validation: ${dt.stopLossValidation.notes.join('; ')}`);
      }
      if (!dt.targetValidation.ok) {
        entryLines.push(`⚠️ Target Validation: ${dt.targetValidation.notes.join('; ')}`);
      }
    }

    return [
      `🚨 [EQUITY RESEARCH REPORT] - $${summary.ticker}`,
      `Market Status: ${marketStatus.label} | Trade Status: ${tradeStatusLabel}`,
      `Swing Suitability: ${swingSuitability.score}/100 — ${SWING_SUITABILITY_STYLE[swingSuitability.classification].label} (bukan sinyal BUY)`,
      `Risk Gate: ${RISK_GATE_STATUS_STYLE[riskGateStatus].label} | Buy Permission: ${BUY_PERMISSION_STYLE[buyPermission].label} | Entry Status: ${ENTRY_STATUS_STYLE[entryStatus].label}${isLong ? ` | Zone Status: ${ZONE_STATUS_STYLE[zoneStatus].label}` : ''} | Primary Trend Risk: ${primaryTrendRisk}`,
      '',
      `📌 Strategi (Setup): ${strategiDisplay}${isLong && breakoutLevel != null && (swingSetup === 'BREAKOUT' || swingSetup === 'BREAKOUT_WATCH') ? ` (Breakout Level: ${fmtRp(breakoutLevel)}, Breakout Confirmed: ${breakoutPriceConfirmed ? 'YES' : 'NO'})` : ''} (Gaya: ${gayaLabel})`,
      `Expected Holding: 1–5 Hari (Swing) | Position Risk: ${riskRangeLabel} | Main Risk: ${mainRisk}`,
      `Exit Condition: ${exitCondition}`,
      '--------------------------------------------------',
      ...entryLines,
      '',
      '📊 Analisis Alignment:',
      `1. Technical    : Tren ${trenLabel}, RSI ${fmtN(indicators.rsi14, 1)} (${rsiStatus.label})${oversoldRisk.status !== 'NONE' ? ` — ${oversoldRisk.label}` : ''}, MACD ${macdStatus.label}. Area kunci: Support ${nearestSupport ? fmtRp(nearestSupport.price) : '–'} | Resistance ${nearestResistance ? fmtRp(nearestResistance.price) : '–'}.`,
      `2. Fundamental  : Valuasi ${valuation.label} (PER ${summary.per > 0 ? `${summary.per.toFixed(1)}x` : '–'} · PBV ${summary.pbv > 0 ? `${summary.pbv.toFixed(2)}x` : '–'}) · Skor Fundamental AI ${fundamentalScreening.score}/100${solvencyLabel ? `, ${solvencyLabel} (DER ${der != null ? `${der.toFixed(1)}%` : '–'} · ROE ${summary.roe !== 0 ? `${summary.roe.toFixed(1)}%` : '–'})` : ''} · Fundamental Risk ${FUNDAMENTAL_RISK_STYLE[fundamentalRisk].label}.`,
      `3. Bandar & Entry Timing: Fase Bandar ${faseBandarLabel} · Fase Siklus Pasar ${faseSiklusLabel} · Entry Timing ${entryTiming.label} — ${entryTiming.headline}${bandarScore.hiddenDistributionWarning ? ' ⚠️ Waspada hidden distribution (harga naik, OBV melemah).' : ''}`,
      `4. Checklist Intraday: VWAP ${vwapLabel} · EMA9/EMA21 ${emaLabel} · RVOL ${fmtN(volume.relativeVolume, 2)}× (${rvolClass.label}, Volume ${volumeTrendLabel})`,
      `5. Sentimen     : ${topBullishNews ? `Positif — ${topBullishNews.title} [${topBullishNews.relevance ?? '–'}/${topBullishNews.ageBucket ?? '–'}]` : 'Belum ada sentimen positif signifikan'}${topBearishNews ? ` | Negatif — ${topBearishNews.title} [${topBearishNews.relevance ?? '–'}/${topBearishNews.ageBucket ?? '–'}]` : ''}`,
      '',
      `🚦 Risk Gate: ${RISK_GATE_STATUS_STYLE[riskGateStatus].label} · Buy Permission: ${BUY_PERMISSION_STYLE[buyPermission].label} · Entry Status: ${ENTRY_STATUS_STYLE[entryStatus].label}${isLong ? ` · Zone Status: ${ZONE_STATUS_STYLE[zoneStatus].label}` : ''}${riskGate.reasons.length > 0 ? ` — ${riskGate.reasons.join('; ')}.` : '.'}`,
      '',
      '⚠️ Catatan Manajemen Risiko:',
      `- Skor AI: ${advisor.compositeScore}/100 — ${advisor.executiveSummary}`,
      '- Sesuaikan alokasi modal dengan profil risiko & disiplin cut loss di level Stop Loss.',
      '- Checklist Swing dihitung dari data EOD; VWAP/EMA9-21 intraday adalah kuotasi tertunda (bukan real-time) — konfirmasi manual di chart sebelum entry presisi.',
      '',
      '⚠️ Disclaimer:',
      'Analisis ini bertujuan untuk memberikan gambaran teknikal dan fundamental dasar. Keputusan investasi dan manajemen risiko sepenuhnya menjadi tanggung jawab masing-masing investor.',
    ].join('\n');
  };

  return (
    <SectionCard
      title="Equity Research Report"
      icon={<Sparkles className="size-4" />}
      accentClass="bg-violet-600"
      headerAction={<CopyShareButton getText={buildShareText} />}
    >

      {snapshot && <QuickDecisionSnapshotSection snapshot={snapshot} />}

      <div className="space-y-5">
        {/* 1. Ringkasan Instan */}
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-800 dark:text-zinc-200 mb-2">
            📊 1. Ringkasan Instan
          </h3>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-zinc-500 dark:text-zinc-400 shrink-0">Status Utama (Market):</span>
              <Pill tone={marketStatus.tone}>{marketStatus.label}</Pill>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-zinc-500 dark:text-zinc-400 shrink-0">Swing Suitability (1–5 Hari):</span>
              <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">{swingSuitability.score}/100</span>
              <Pill tone={SWING_SUITABILITY_STYLE[swingSuitability.classification].tone}>{SWING_SUITABILITY_STYLE[swingSuitability.classification].label}</Pill>
              <span className="text-[11px] text-zinc-400">bukan sinyal BUY</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-zinc-500 dark:text-zinc-400 shrink-0">Setup:</span>
              <Pill tone={swingSetup === 'NO_SETUP' ? 'zinc' : swingSetup === 'BREAKOUT' ? 'blue' : 'amber'}>{SWING_SETUP_LABEL[swingSetup]}</Pill>
              {isLong && breakoutLevel != null && (swingSetup === 'BREAKOUT' || swingSetup === 'BREAKOUT_WATCH') && (
                <>
                  <span className="text-xs text-zinc-400">Breakout Level: {fmtRp(breakoutLevel)}</span>
                  <Pill tone={breakoutPriceConfirmed ? 'green' : 'amber'}>Breakout Confirmed: {breakoutPriceConfirmed ? 'YES' : 'NO'}</Pill>
                </>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-zinc-500 dark:text-zinc-400 shrink-0">Status Transaksi:</span>
              <Pill tone={tradeStatusStyle.tone}>{tradeStatusLabel}</Pill>
              {hasSetupErrors && (
                <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">Setup tidak konsisten — angka Entry/SL/TP tidak ditampilkan.</span>
              )}
            </div>
            {/* Risk Gate / Buy Permission / Entry Status replace the old bare "Buy Allowed: TRUE/FALSE"
                pill — each answers a different question, so a CONDITIONAL risk picture (e.g. sideways +
                weak fundamental + extreme overbought, none individually a hard blocker) stays visible
                instead of collapsing into a plain TRUE (features_kontradiktif.md). */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-zinc-500 dark:text-zinc-400 shrink-0">Risk Gate:</span>
                <Pill tone={RISK_GATE_STATUS_STYLE[riskGateStatus].tone}>{RISK_GATE_STATUS_STYLE[riskGateStatus].label}</Pill>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-zinc-500 dark:text-zinc-400 shrink-0">Buy Permission:</span>
                <Pill tone={BUY_PERMISSION_STYLE[buyPermission].tone}>{BUY_PERMISSION_STYLE[buyPermission].label}</Pill>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-zinc-500 dark:text-zinc-400 shrink-0">Entry Status:</span>
                <Pill tone={ENTRY_STATUS_STYLE[entryStatus].tone}>{ENTRY_STATUS_STYLE[entryStatus].label}</Pill>
              </div>
              {isLong && (
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500 dark:text-zinc-400 shrink-0">Zone Status:</span>
                  <Pill tone={ZONE_STATUS_STYLE[zoneStatus].tone}>{ZONE_STATUS_STYLE[zoneStatus].label}</Pill>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-zinc-500 dark:text-zinc-400 shrink-0">Fundamental Risk:</span>
                <Pill tone={FUNDAMENTAL_RISK_STYLE[fundamentalRisk].tone}>{FUNDAMENTAL_RISK_STYLE[fundamentalRisk].label}</Pill>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-zinc-500 dark:text-zinc-400 shrink-0">Primary Trend Risk:</span>
                <Pill tone={primaryTrendRisk === 'NONE' ? 'green' : primaryTrendRisk === 'BELOW_EMA200' ? 'red' : 'amber'}>{primaryTrendRisk}</Pill>
              </div>
            </div>
            {buyPermission !== 'TRUE' && (
              <p className="text-xs text-zinc-400">
                {!isLong
                  ? 'Laporan ini adalah setup SHORT, bukan ajakan beli — Buy Permission tidak berlaku untuk arah ini.'
                  : buyPermission === 'FALSE'
                    ? 'BUY diblokir oleh Risk Gate.'
                    : 'BUY diperbolehkan bersyarat — Risk Gate mendeteksi beberapa peringatan, kurangi ukuran posisi / naikkan kehati-hatian.'}
              </p>
            )}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-zinc-500 dark:text-zinc-400 shrink-0">Skor AI:</span>
              <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">{advisor.compositeScore}/100</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-zinc-500 dark:text-zinc-400 shrink-0">Gaya Sinyal:</span>
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">{gayaLabel}</span>
            </div>
            <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
              <strong>Highlight:</strong> {advisor.executiveSummary}
            </p>
            {(oversoldRisk.status !== 'NONE' || riskGate.reasons.length > 0) && (
              <div className="mt-1.5 space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-400/20 dark:bg-amber-400/5">
                {oversoldRisk.status !== 'NONE' && (
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">⚠️ {oversoldRisk.label}</p>
                )}
                {riskGate.reasons.length > 0 && (
                  <ul className="space-y-0.5">
                    {riskGate.reasons.map((r) => (
                      <li key={r} className="flex items-start gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                        <span className="mt-1 size-1 shrink-0 rounded-full bg-zinc-400 dark:bg-zinc-600" />
                        {r}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <details className="mt-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-800/40">
              <summary className="cursor-pointer font-semibold text-zinc-600 dark:text-zinc-300">Rincian Swing Suitability ({swingSuitability.score}/100)</summary>
              <ul className="mt-1.5 space-y-1">
                {swingSuitability.factors.map((f) => (
                  <li key={f.key} className="flex items-center justify-between gap-2 text-zinc-500 dark:text-zinc-400">
                    <span>{f.label} — {f.detail}</span>
                    <span className="font-mono shrink-0">{f.score}/{f.max}</span>
                  </li>
                ))}
              </ul>
            </details>
          </div>
        </div>

        <div className="h-[2px] bg-(--neo-line)" />

        {/* 2. Analisis Teknikal */}
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-800 dark:text-zinc-200 mb-2">
            📈 2. Analisis Teknikal
          </h3>
          <ul className="space-y-1.5 text-sm">
            <li className="flex items-center gap-2">
              <span className="text-zinc-500 dark:text-zinc-400 shrink-0">Tren Utama:</span>
              <Pill tone={trenTone}>{trenLabel}</Pill>
            </li>
            <li className="flex flex-wrap items-center gap-2">
              <span className="text-zinc-500 dark:text-zinc-400 shrink-0">RSI:</span>
              <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">{fmtN(indicators.rsi14, 1)}</span>
              <Pill tone={rsiStatus.tone}>{rsiStatus.label}</Pill>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-zinc-500 dark:text-zinc-400 shrink-0">MACD:</span>
              <Pill tone={macdStatus.tone}>{macdStatus.label}</Pill>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-zinc-500 dark:text-zinc-400 shrink-0">Moving Average:</span>
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">{maLabel}</span>
            </li>
            <li className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-zinc-500 dark:text-zinc-400 shrink-0">Area Kunci:</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                Support {nearestSupport ? fmtRp(nearestSupport.price) : '–'}
              </span>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <span className="font-semibold text-rose-600 dark:text-rose-400">
                Resistance {nearestResistance ? fmtRp(nearestResistance.price) : '–'}
              </span>
            </li>
          </ul>
        </div>

        <div className="h-[2px] bg-(--neo-line)" />

        {/* 3. Analisis Fundamental & Valuasi */}
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-800 dark:text-zinc-200 mb-2">
            🏢 3. Analisis Fundamental & Valuasi
          </h3>
          <ul className="space-y-1.5 text-sm">
            <li className="flex flex-wrap items-center gap-2">
              <span className="text-zinc-500 dark:text-zinc-400 shrink-0">Valuasi:</span>
              <Pill tone={valuation.tone}>{valuation.label}</Pill>
              <span className="text-xs text-zinc-400">
                (PER {summary.per > 0 ? `${summary.per.toFixed(1)}×` : '–'} · PBV {summary.pbv > 0 ? `${summary.pbv.toFixed(2)}×` : '–'})
              </span>
            </li>
            <li className="flex flex-wrap items-center gap-2">
              <span className="text-zinc-500 dark:text-zinc-400 shrink-0">Skor Fundamental AI:</span>
              <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">{fundamentalScreening.score}/100</span>
              <Pill tone={FUNDAMENTAL_RISK_STYLE[fundamentalRisk].tone}>Fundamental Risk: {FUNDAMENTAL_RISK_STYLE[fundamentalRisk].label}</Pill>
            </li>
            <li className="flex flex-wrap items-center gap-2">
              <span className="text-zinc-500 dark:text-zinc-400 shrink-0">Kesehatan Finansial:</span>
              {fundamentalsLoading ? (
                <span className="text-xs text-zinc-400">Memuat…</span>
              ) : solvencyLabel ? (
                <Pill tone={solvencyTone}>{solvencyLabel}</Pill>
              ) : (
                <span className="text-xs text-zinc-400">Data DER tidak tersedia</span>
              )}
              <span className="text-xs text-zinc-400">
                (DER {der != null ? `${der.toFixed(1)}%` : '–'} · ROE {summary.roe !== 0 ? `${summary.roe.toFixed(1)}%` : '–'})
              </span>
            </li>
            <li className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              <strong className="text-zinc-800 dark:text-zinc-200">Kunci Fundamental:</strong> {fundamentalScreening.roeStatus.detail}
            </li>
          </ul>
        </div>

        <div className="h-[2px] bg-(--neo-line)" />

        {/* 4. Akumulasi Bandar & Entry Timing */}
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-800 dark:text-zinc-200 mb-2">
            🐋 4. Akumulasi Bandar &amp; Entry Timing
          </h3>
          <ul className="space-y-1.5 text-sm">
            <li className="flex flex-wrap items-center gap-2">
              <span className="text-zinc-500 dark:text-zinc-400 shrink-0">Fase Bandar:</span>
              <Pill tone={bandarScore.classification.tone === 'red' ? 'red' : bandarScore.classification.tone === 'orange' ? 'amber' : bandarScore.classification.tone === 'green' ? 'green' : 'amber'}>
                {bandarScore.classification.label}
              </Pill>
              <span className="text-xs text-zinc-400">{bandarScore.phaseLabel}</span>
            </li>
            <li className="flex flex-wrap items-center gap-2">
              <span className="text-zinc-500 dark:text-zinc-400 shrink-0">Fase Siklus Pasar:</span>
              <Pill tone={marketCyclePhase.tone === 'red' ? 'red' : marketCyclePhase.tone === 'orange' ? 'amber' : marketCyclePhase.tone === 'green' ? 'green' : marketCyclePhase.tone === 'blue' ? 'blue' : 'amber'}>
                {marketCyclePhase.number != null ? `Fase ${marketCyclePhase.number} — ${marketCyclePhase.label}` : marketCyclePhase.label}
              </Pill>
            </li>
            <li className="flex flex-wrap items-center gap-2">
              <span className="text-zinc-500 dark:text-zinc-400 shrink-0">Entry Timing:</span>
              <Pill tone={entryTiming.tone}>{entryTiming.label}</Pill>
            </li>
            <li className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {entryTiming.headline}
            </li>
            <li className="space-y-1 pt-0.5">
              {entryTiming.reasons.map((r) => (
                <div key={r} className="flex items-start gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="mt-1 size-1 shrink-0 rounded-full bg-zinc-400 dark:bg-zinc-600" />
                  {r}
                </div>
              ))}
            </li>
            {bandarScore.hiddenDistributionWarning && (
              <li className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/5 dark:text-rose-300">
                ⚠️ Waspada hidden distribution — harga naik namun OBV melemah, indikasi smart money bisa jadi menjual ke pembeli baru.
              </li>
            )}
          </ul>
        </div>

        <div className="h-[2px] bg-(--neo-line)" />

        {/* 5. Sentimen & Isu Terkini */}
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-800 dark:text-zinc-200 mb-2">
            📰 5. Sentimen &amp; Isu Terkini
          </h3>
          <ul className="space-y-1.5 text-sm">
            <li className="flex items-start gap-2">
              <Pill tone="green">Positif</Pill>
              <span className="text-zinc-600 dark:text-zinc-400 leading-snug">
                {topBullishNews ? topBullishNews.title : 'Belum ada berita positif signifikan terdeteksi.'}
                {topBullishNews && (
                  <span className="ml-1 text-xs text-zinc-400">[{topBullishNews.relevance ?? '–'} · {topBullishNews.ageBucket ?? '–'}]</span>
                )}
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Pill tone="red">Negatif</Pill>
              <span className="text-zinc-600 dark:text-zinc-400 leading-snug">
                {topBearishNews ? topBearishNews.title : 'Tidak ada isu negatif signifikan terdeteksi.'}
                {topBearishNews && (
                  <span className="ml-1 text-xs text-zinc-400">[{topBearishNews.relevance ?? '–'} · {topBearishNews.ageBucket ?? '–'}]</span>
                )}
              </span>
            </li>
          </ul>
        </div>

        <div className="h-[2px] bg-(--neo-line)" />

        {/* 6. Rencana Aksi */}
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-800 dark:text-zinc-200 mb-2">
            🎯 6. Rencana Aksi (Actionable Takeaways)
          </h3>
          <div className={cn(
            'mb-3 flex items-center gap-2 rounded-lg border px-3 py-2',
            tradeStatusStyle.tone === 'green' ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-400/20 dark:bg-emerald-400/5' :
              tradeStatusStyle.tone === 'red' ? 'border-rose-200 bg-rose-50 dark:border-rose-400/20 dark:bg-rose-400/5' :
                tradeStatusStyle.tone === 'blue' ? 'border-blue-200 bg-blue-50 dark:border-blue-400/20 dark:bg-blue-400/5' :
                  'border-amber-200 bg-amber-50 dark:border-amber-400/20 dark:bg-amber-400/5'
          )}>
            <Pill tone={tradeStatusStyle.tone}>{tradeStatusLabel}</Pill>
            <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">{statusNote}</span>
          </div>
          {hasSetupErrors ? (
            <ul className="space-y-1">
              {scenario.validationErrors.map((code) => (
                <li key={code} className="flex items-start gap-1.5 text-sm text-rose-600 dark:text-rose-400">
                  <span className="mt-1 size-1 shrink-0 rounded-full bg-rose-500" />
                  {VALIDATION_ERROR_LABEL[code] ?? code}
                </li>
              ))}
            </ul>
          ) : (
            <ul className="space-y-1.5 text-sm">
              <li className="flex items-center gap-2">
                <span className="text-zinc-500 dark:text-zinc-400 shrink-0">Strategi (Setup):</span>
                <span className="font-bold text-zinc-900 dark:text-zinc-100">{strategiDisplay}</span>
                <span className="text-xs text-zinc-400">({gayaLabel})</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-zinc-500 dark:text-zinc-400 shrink-0">Current Price:</span>
                <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">{fmtRp(price)}</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-zinc-500 dark:text-zinc-400 shrink-0">{isLong ? 'Area Entry Ideal:' : 'Rejection Zone (Trigger):'}</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {isLong ? `${fmtRp(entryZoneLow)} – ${fmtRp(entryZoneHigh)}` : fmtRp(entryPrice)}
                </span>
                {isLong && <Pill tone={ZONE_STATUS_STYLE[zoneStatus].tone}>{ZONE_STATUS_STYLE[zoneStatus].label}</Pill>}
              </li>
              {isLong && (
                <li className="text-xs text-zinc-500 dark:text-zinc-400">
                  Distance to Entry: harga {fmtRp(price)} vs batas atas {fmtRp(entryZoneHigh)} ({price > entryZoneHigh ? '+' : ''}{fmtN(((price - entryZoneHigh) / entryZoneHigh) * 100, 1)}%) · vs batas bawah {fmtRp(entryZoneLow)} ({price > entryZoneLow ? '+' : ''}{fmtN(((price - entryZoneLow) / entryZoneLow) * 100, 1)}%)
                </li>
              )}
              <li className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                <span className="font-semibold text-zinc-600 dark:text-zinc-300">Entry Trigger — </span>
                {entryConfirmed ? 'Terkonfirmasi: retest/support bertahan, reversal candle, volume mendukung, trend intact.' : 'Belum terkonfirmasi, tunggu: '}
                {!entryConfirmed && (
                  <>
                    {priceAtEntryTrigger ? '✅' : '⬜'} harga di zona ·{' '}
                    {reversalConfirmed ? '✅' : '⬜'} candle reversal ·{' '}
                    {volumeSupportive ? '✅' : '⬜'} volume mendukung ·{' '}
                    {trendValid ? '✅' : '⬜'} trend intact
                  </>
                )}
              </li>
              {!isLong && (
                <li className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  Bukan entry sekarang. Short hanya aktif JIKA harga rebound/retest ke level ini dan gagal breakout (bearish rejection terkonfirmasi).
                </li>
              )}
              {scenario.extremeDistanceWarning && (
                <li className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                  <TriangleAlert className="size-3.5 mt-0.5 shrink-0" strokeWidth={2.5} />
                  Entry berjarak {fmtN(scenario.entryDistancePct, 1)}% dari harga saat ini — bukan entry segera.
                </li>
              )}
              <li className="flex items-center gap-2">
                <span className="text-zinc-500 dark:text-zinc-400 shrink-0">Stop Loss:</span>
                <span className="font-mono font-bold text-rose-600 dark:text-rose-400">{fmtRp(slPrice)}</span>
                <span className="text-xs text-zinc-400">(Risk: {riskRangeLabel})</span>
              </li>
              <li className="text-xs text-zinc-500 dark:text-zinc-400">
                <span className="font-semibold text-zinc-600 dark:text-zinc-300">Invalidation — </span>{scenario.invalidationRule}
              </li>
              {isLong && scenario.tp1AlreadyReached && (
                <li className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                  <TriangleAlert className="size-3.5 mt-0.5 shrink-0" strokeWidth={2.5} />
                  Target lama sudah terlampaui harga saat ini — TP1/TP2 di bawah sudah dihitung ulang ke resistance berikutnya (Target Validation Engine).
                </li>
              )}
              <li className="flex flex-wrap items-center gap-3">
                <span className="text-zinc-500 dark:text-zinc-400 shrink-0">Target:</span>
                <span className="font-mono text-sm text-zinc-700 dark:text-zinc-300">
                  TP1 {fmtRp(tp1Price)} <span className="text-emerald-600 dark:text-emerald-400">+{fmtN(rewardPct(tp1Price), 1)}%</span>
                  <span className="text-zinc-400"> (net +{fmtN(netRewardPct(tp1Price), 1)}%)</span>
                </span>
              </li>
              <li className="flex flex-wrap items-center gap-3">
                <span className="text-zinc-500 dark:text-zinc-400 shrink-0 opacity-0 select-none">Target:</span>
                <span className="font-mono text-sm text-zinc-700 dark:text-zinc-300">
                  TP2 {fmtRp(tp2Price)} <span className="text-emerald-600 dark:text-emerald-400">+{fmtN(rewardPct(tp2Price), 1)}%</span>
                  <span className="text-zinc-400"> (net +{fmtN(netRewardPct(tp2Price), 1)}%)</span>
                </span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-zinc-500 dark:text-zinc-400 shrink-0">Risk : Reward:</span>
                <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">1 : {fmtN(scenario.riskRewardRatio, 2)}</span>
                {scenario.extremeRRWarning && (
                  <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                    R:R ekstrem — kemungkinan tidak actionable secara praktis, jangan anggap otomatis sebagai setup bagus.
                  </span>
                )}
              </li>
              <li className="pt-1">
                <DefaultTargetPlanBlock target={scenario.defaultTarget} isLong={isLong} />
              </li>
              <li className="text-xs text-zinc-400 leading-relaxed pt-0.5">
                {rewardLabel} dihitung dari {isLong ? 'batas atas Entry Zone (skenario entry paling konservatif)' : 'harga Entry/Rejection Trigger'} dan sudah memperhitungkan estimasi fee round-trip ~{fmtN(ROUND_TRIP_FEE_PCT, 2)}% pada kolom &quot;net&quot;. Stop Loss dibulatkan ke fraksi harga (tick) IDX yang valid.
              </li>
              <li className="flex items-center gap-2 pt-1">
                <span className="text-zinc-500 dark:text-zinc-400 shrink-0">Expected Holding:</span>
                <span className="font-semibold text-zinc-700 dark:text-zinc-300">1–5 Hari (Swing)</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-zinc-500 dark:text-zinc-400 shrink-0">Position Risk:</span>
                <span className="font-semibold text-zinc-700 dark:text-zinc-300">{riskRangeLabel} dari modal pada trade ini</span>
              </li>
              <li className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                <span className="font-semibold text-zinc-600 dark:text-zinc-300">Main Risk — </span>{mainRisk}
              </li>
              <li className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                <span className="font-semibold text-zinc-600 dark:text-zinc-300">Exit Condition — </span>{exitCondition}
              </li>
            </ul>
          )}
        </div>

        <div className="h-[2px] bg-(--neo-line)" />

        {/* 7. Checklist Swing vs Intraday */}
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-800 dark:text-zinc-200 mb-2">
            ✅ 7. Checklist Swing vs Intraday
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <span className="text-[11px] font-bold uppercase text-zinc-500 dark:text-zinc-400">Swing</span>
              <ul className="space-y-1.5 text-sm mt-1.5">
                {swingChecklist.map((item) => (
                  <li key={item.label} className="flex flex-wrap items-center gap-2">
                    <span className="text-zinc-500 dark:text-zinc-400 shrink-0 w-28">{item.label}:</span>
                    {item.tone === 'zinc' ? (
                      <span className="text-xs text-zinc-400">{item.value}</span>
                    ) : (
                      <Pill tone={item.tone}>{item.value}</Pill>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase text-zinc-500 dark:text-zinc-400">Intraday</span>
              <ul className="space-y-1.5 text-sm mt-1.5">
                {intradayChecklist.map((item) => (
                  <li key={item.label} className="flex flex-wrap items-center gap-2">
                    <span className="text-zinc-500 dark:text-zinc-400 shrink-0 w-28">{item.label}:</span>
                    {item.tone === 'zinc' && item.value.startsWith('Data intraday') ? (
                      <span className="text-xs text-zinc-400">{item.value}</span>
                    ) : (
                      <Pill tone={item.tone}>{item.value}</Pill>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed pt-2">
            Checklist Swing dihitung penuh dari data harian (EOD) yang tersedia. VWAP dan EMA9/EMA21 dihitung dari data intraday 1 menit (Yahoo Finance, kuotasi tertunda) sejak awal sesi berjalan/terakhir — bukan real-time, dan EMA9/EMA21 baru muncul setelah ±21 menit sesi berjalan. RVOL, tren volume, RSI, dan struktur harga pada kolom Intraday adalah proxy dari data harian, bukan pengganti konfirmasi intraday real-time. Skor Swing yang tinggi tidak otomatis berarti setup ini layak untuk entry scalping/intraday — konfirmasi manual di chart intraday (retest breakout, RVOL live) sebelum entry presisi.
          </p>
        </div>
      </div>
    </SectionCard>
  );
}

// ─── Equity Research Report V3 — "EzySaham 10-Second Review" ───────────────────
// Same Risk Gate / Zone / Entry Confirmation inputs as EquityResearchReportCard2 (so the two can
// never disagree for the same stock), collapsed into one beginner-readable verdict by
// tenSecondReview.ts. No AI score, R:R, TP/SL or raw indicator dump.
const TODAY_STATUS_STYLE: Record<TodayTradeStatus, { emoji: string; tone: 'green' | 'red' | 'amber'; box: string }> = {
  BUY: { emoji: '🟢', tone: 'green', box: 'border-emerald-400 bg-emerald-50 dark:bg-emerald-400/10' },
  WAIT: { emoji: '🟡', tone: 'amber', box: 'border-amber-400 bg-amber-50 dark:bg-amber-400/10' },
  NO_TRADE: { emoji: '🔴', tone: 'red', box: 'border-rose-400 bg-rose-50 dark:bg-rose-400/10' },
};

const MOVE_TYPE_TONE: Record<MoveType, 'green' | 'red' | 'amber' | 'blue' | 'zinc'> = {
  NORMAL: 'zinc',
  PRICE_VOLUME_EXPANSION: 'amber',
  BREAKOUT: 'green',
  ACCUMULATION: 'blue',
  EVENT: 'blue',
  REOPENING: 'red',
  UNKNOWN: 'red',
};

const EVIDENCE_KIND_CLASS: Record<EvidenceKind, string> = {
  FAKTA: 'bg-blue-50 text-blue-700 dark:bg-blue-400/10 dark:text-blue-300',
  INDIKASI: 'bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300',
  BELUM_TERVERIFIKASI: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
};

function MoveRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <li className="flex flex-wrap items-center gap-2">
      <span className="text-zinc-500 dark:text-zinc-400 shrink-0 w-36">{label}:</span>
      {children}
    </li>
  );
}

function MoveHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-800 dark:text-zinc-200 mb-2">{children}</h3>;
}

function MoveDivider() {
  return <div className="h-[2px] bg-(--neo-line)" />;
}

interface EquityReportProps {
  summary: StockSummary;
  bars: OHLCVBar[];
  trendEma: TrendEmaAnalysis;
  indicators: IndicatorAnalysis;
  supportResistance: SupportResistanceAnalysis;
  fundamentalScreening: FundamentalScreeningResult;
  fundamentals: FundamentalDetail | null;
  tradingPlan: TradingPlanAnalysis;
  volume: VolumeAnalysis;
  priceAction: PriceActionAnalysis;
  newsItems: StockNewsItem[];
  brokerActivity: BrokerActivityDetail | null;
}

// Shared by v3 and v4 so both cards read the exact same Risk Gate / Zone / Today-Move inputs and can
// never disagree for the same stock: 10-second review (riskGate.ts + tradeValidation.ts) first, then
// the today-vs-previous-close read layered on top of it.
function useEquityReportReview({
  summary,
  bars,
  trendEma,
  indicators,
  supportResistance,
  fundamentalScreening,
  fundamentals,
  tradingPlan,
  volume,
  priceAction,
  newsItems,
  brokerActivity,
}: EquityReportProps) {
  const bandarScore = useMemo(() => computeBandarScore(summary, bars ?? []), [summary, bars]);

  const review = useMemo(() => {
    const price = summary.lastClose;
    const aboveMa50 = price > trendEma.ema50;
    const aboveMa200 = price > trendEma.ema200;
    const nearestResistance = supportResistance.resistances[0];
    const nearestSupport = supportResistance.supports[0];
    const der = fundamentals?.debtToEquity ?? null;

    const bias = tradingPlan.recommendedBias === 'bearish' ? 'bearish' : 'bullish';
    const scenario = tradingPlan[bias];
    const isLong = scenario.direction === 'LONG';
    const isStrongDistribution = bandarScore.classification.label === 'Strong Distribution';
    const isDistributionRisk = bandarScore.classification.label === 'Distribution Risk';

    const priceAtEntryTrigger = isPriceAtEntryTrigger(scenario.direction, price, scenario.entry);
    const setupInvalidated = isSetupInvalidated(scenario.direction, price, scenario.sl);
    const entryPrice = roundToTick(scenario.entry);
    const entryZoneLow = isLong && nearestSupport ? roundToTick(nearestSupport.price) : entryPrice;
    const entryZoneHigh = entryPrice;
    const zoneStatus = classifyZoneStatus(price, entryZoneLow, entryZoneHigh);
    const fundamentalRisk = classifyFundamentalRisk(fundamentalScreening.score, der, summary.roe);

    const bullishReversalCandle = priceAction.lastCandleColor === 'green' ||
      priceAction.pattern === 'bullish_engulfing' || priceAction.pattern === 'hammer' || priceAction.pattern === 'marubozu_bullish';
    const bearishReversalCandle = priceAction.lastCandleColor === 'red' ||
      priceAction.pattern === 'bearish_engulfing' || priceAction.pattern === 'shooting_star' || priceAction.pattern === 'marubozu_bearish';
    const entryConfirmed = isEntryConfirmed({
      priceAtEntryTrigger,
      setupInvalidated,
      trendValid: isLong ? trendEma.trend !== 'bearish' : trendEma.trend !== 'bullish',
      reversalConfirmed: isLong ? bullishReversalCandle : bearishReversalCandle,
      volumeSupportive: volume.relativeVolume >= 1,
    });

    const riskGate = evaluateRiskGate({
      direction: scenario.direction,
      trend: trendEma.trend,
      rsi14: indicators.rsi14,
      fundamentalScore: fundamentalScreening.score,
      isStrongDistribution,
      priceBelowEma50: !aboveMa50,
      priceBelowEma200: !aboveMa200,
      priceAtEntryTrigger,
      setupInvalidated,
      extremeDistanceWarning: scenario.extremeDistanceWarning,
      isDistributionRisk,
      zoneStatus,
      der,
      roe: summary.roe,
      entryConfirmed,
    });

    const breakoutPriceConfirmed = nearestResistance == null || price >= nearestResistance.price;
    const swingSetup = detectSwingSetup({
      direction: scenario.direction,
      entryType: scenario.entryType,
      canContinueUp: priceAction.canContinueUp,
      volumeConfirmed: volume.isHighVolume,
      breakoutPriceConfirmed,
    });
    const hasSetupErrors = scenario.validationErrors.length > 0;

    const tenSecond = buildTenSecondReview({
      ticker: summary.ticker,
      price,
      trend: trendEma.trend,
      rsi14: indicators.rsi14,
      macdBullish: indicators.macdSignalType === 'bullish' || indicators.macdSignalType === 'bullish_crossover',
      macdBearish: indicators.macdSignalType === 'bearish' || indicators.macdSignalType === 'bearish_crossover',
      relativeVolume: volume.relativeVolume,
      lastCandleColor: priceAction.lastCandleColor,
      support: nearestSupport?.price ?? null,
      resistance: nearestResistance?.price ?? null,
      direction: scenario.direction,
      swingSetup,
      entryZoneLow,
      entryZoneHigh,
      zoneStatus,
      tradeStatus: hasSetupErrors ? 'NO_TRADE' : riskGate.tradeStatus,
      entryConfirmed,
      setupInvalidated,
      breakoutConfirmed: swingSetup === 'BREAKOUT',
      aboveEma50: aboveMa50,
      aboveEma200: aboveMa200,
      fundamentalRisk,
      isStrongDistribution,
      isDistributionRisk,
      hiddenDistribution: bandarScore.hiddenDistributionWarning,
      hasSetupErrors,
    });
    return { ...tenSecond, entryZoneLow, entryZoneHigh, setupInvalidated, fundamentalRisk, isStrongDistribution };
  }, [summary, trendEma, indicators, supportResistance, fundamentalScreening, fundamentals, tradingPlan, volume, priceAction, bandarScore]);

  // Today-vs-previous-close read layered on top of the 10-second review: move type + catalyst come
  // first, and the review's status is only ever capped (never upgraded) by chase/event risk.
  const move = useMemo(() => buildTodayMoveAnalysis({
    summary,
    bars: bars ?? [],
    newsItems,
    brokerActivity,
    trend: trendEma.trend,
    ema50: trendEma.ema50,
    ema200: trendEma.ema200,
    rsi14: indicators.rsi14,
    macdSignalType: indicators.macdSignalType,
    macdHistogram: indicators.macdHistogram,
    support: review.support,
    resistance: review.resistance,
    fundamentalRisk: review.fundamentalRisk,
    isStrongDistribution: review.isStrongDistribution,
    isDistributionRisk: bandarScore.classification.label === 'Distribution Risk',
    hiddenDistribution: bandarScore.hiddenDistributionWarning,
    baseStatus: review.status,
    baseScenario: review.scenario,
  }), [summary, bars, newsItems, brokerActivity, trendEma, indicators, bandarScore, review]);

  return { review, move };
}

function EquityResearchReportCardv3(props: EquityReportProps) {
  const { summary } = props;
  const { review, move } = useEquityReportReview(props);

  const statusStyle = TODAY_STATUS_STYLE[move.tradeStatus];
  const riskTone = (r: 'LOW' | 'MEDIUM' | 'HIGH'): 'green' | 'amber' | 'red' => (r === 'HIGH' ? 'red' : r === 'MEDIUM' ? 'amber' : 'green');
  const positive = move.changePct >= 0;
  const fmtVol = (n: number | null) => (n == null ? '–' : `${formatCompact(n)} lbr`);
  const fmtX = (n: number | null) => (n == null || Number.isNaN(n) ? '–' : `${n.toFixed(2)}×`);
  const fmtPct = (n: number | null, dec = 1) => (n == null || Number.isNaN(n) ? '–' : `${n >= 0 ? '+' : ''}${n.toFixed(dec)}%`);

  return (
    <SectionCard
      title={`Equity Research Analysis`}
      icon={<Sparkles className="size-4" />}
      accentClass="bg-violet-600"
      headerAction={<CopyShareButton getText={() => formatTodayMoveAnalysis(summary.ticker, move)} />}
    >
      <div className="space-y-4">
        {/* Header: previous close → today close */}
        <div className={cn('neo-border px-4 py-3', statusStyle.box)}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm text-zinc-500 dark:text-zinc-400">
              <span>Prev Close: <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">{fmtRp(move.prevClose)}</span></span>
              <span>Today Close: <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">{fmtRp(move.close)}</span></span>
              <span className={cn('font-mono font-bold', positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
                {fmtPct(move.changePct, 2)}
              </span>
            </div>
            <Pill tone={statusStyle.tone}>{statusStyle.emoji} {TODAY_TRADE_STATUS_LABEL[move.tradeStatus]}</Pill>
          </div>
          {move.explosive && (
            <p className="mt-2 flex items-start gap-1.5 text-xs font-bold text-rose-700 dark:text-rose-400">
              <TriangleAlert className="size-3.5 mt-0.5 shrink-0" strokeWidth={2.5} />
              EXPLOSIVE MOVE TERDETEKSI — kenaikan besar hari ini tidak otomatis berarti entry masih layak.
            </p>
          )}
        </div>

        {/* 📊 Price & Volume */}
        <div>
          <MoveHeading>📊 Price &amp; Volume</MoveHeading>
          <ul className="space-y-1.5 text-sm">
            <MoveRow label="O / H / L / C">
              <span className="font-mono text-zinc-800 dark:text-zinc-200">
                {move.open != null ? fmtRp(move.open) : '–'} / {fmtRp(move.high)} / {fmtRp(move.low)} / {fmtRp(move.close)}
              </span>
            </MoveRow>
            <MoveRow label="Price Change">
              <Pill tone={Math.abs(move.changePct) >= 5 ? (positive ? 'green' : 'red') : 'zinc'}>{fmtPct(move.changePct, 2)}</Pill>
              {move.gapPct != null && Math.abs(move.gapPct) >= 1 && (
                <span className="text-xs text-zinc-500">gap open {fmtPct(move.gapPct)}</span>
              )}
            </MoveRow>
            <MoveRow label="Volume Change">
              <span className="font-mono text-zinc-800 dark:text-zinc-200">{fmtVol(move.volume)} vs {fmtVol(move.prevVolume)}</span>
              {move.volumeChangePct != null && (
                <Pill tone={move.volumeChangePct >= 100 ? 'green' : move.volumeChangePct <= -30 ? 'amber' : 'zinc'}>{fmtPct(move.volumeChangePct, 0)}</Pill>
              )}
            </MoveRow>
            <MoveRow label="RVOL">
              <Pill tone={move.rvol == null ? 'zinc' : move.rvol >= 2 ? 'green' : move.rvol >= 1 ? 'blue' : 'amber'}>{fmtX(move.rvol)}</Pill>
              {move.avgVolume20 != null && <span className="text-xs text-zinc-500">avg 20D {fmtVol(move.avgVolume20)}</span>}
            </MoveRow>
            <MoveRow label="Range Expansion">
              <Pill tone={move.rangeExpansion == null ? 'zinc' : move.rangeExpansion >= 1.5 ? 'amber' : 'zinc'}>{fmtX(move.rangeExpansion)}</Pill>
            </MoveRow>
            <MoveRow label="Close Position">
              <span className="text-zinc-700 dark:text-zinc-300">{describeClosePosition(move.closePosition)}</span>
            </MoveRow>
          </ul>
        </div>

        <MoveDivider />

        {/* 🚨 Move Type */}
        <div>
          <MoveHeading>🚨 Move Type</MoveHeading>
          <Pill tone={MOVE_TYPE_TONE[move.moveType]}>{MOVE_TYPE_LABEL[move.moveType]}</Pill>
          <p className="mt-1.5 text-sm text-zinc-700 dark:text-zinc-300">{move.moveTypeReason}</p>
        </div>

        <MoveDivider />

        {/* 🔎 Catalyst */}
        <div>
          <MoveHeading>🔎 Catalyst</MoveHeading>
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={move.catalystStatus === 'VERIFIED' ? 'blue' : move.catalystStatus === 'SUSPECTED' ? 'amber' : 'zinc'}>
              {CATALYST_STATUS_LABEL[move.catalystStatus]}
            </Pill>
          </div>
          <p className="mt-1.5 text-sm text-zinc-700 dark:text-zinc-300">{move.catalystSummary}</p>
          {move.evidence.length > 0 && (
            <ul className="mt-2 space-y-1">
              {move.evidence.map((e) => (
                <li key={e.text} className="flex items-start gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                  <span className={cn('shrink-0 px-1.5 py-px font-bold border-2 border-(--neo-line)', EVIDENCE_KIND_CLASS[e.kind])}>
                    {EVIDENCE_KIND_LABEL[e.kind]}
                  </span>
                  {e.url
                    ? <a href={e.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{e.text}</a>
                    : <span>{e.text}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>

        <MoveDivider />

        {/* 📈 Technical */}
        <div>
          <MoveHeading>📈 Technical</MoveHeading>
          <ul className="space-y-1.5 text-sm">
            <MoveRow label="Trend"><span className="text-zinc-800 dark:text-zinc-200">{move.trendLabel}</span></MoveRow>
            <MoveRow label="Momentum">
              <Pill tone={move.momentumLabel === 'Positif' ? 'green' : move.momentumLabel === 'Lemah' ? 'red' : 'amber'}>{move.momentumLabel}</Pill>
            </MoveRow>
            <MoveRow label="RSI"><span className="text-zinc-800 dark:text-zinc-200">{move.rsiLabel}</span></MoveRow>
            <MoveRow label="MACD"><span className="text-zinc-800 dark:text-zinc-200">{move.macdLabel}</span></MoveRow>
            <MoveRow label="EMA9 / EMA21">
              <span className="font-mono text-zinc-800 dark:text-zinc-200">
                {move.ema9 != null ? fmtRp(Math.round(move.ema9)) : '–'} / {move.ema21 != null ? fmtRp(Math.round(move.ema21)) : '–'}
              </span>
            </MoveRow>
            <MoveRow label="EMA200"><span className="text-zinc-800 dark:text-zinc-200">{move.ema200Label}</span></MoveRow>
            <MoveRow label="Support"><span className="font-semibold text-emerald-600 dark:text-emerald-400">{move.support ? fmtRp(move.support) : '–'}</span></MoveRow>
            <MoveRow label="Resistance"><span className="font-semibold text-rose-600 dark:text-rose-400">{move.resistance ? fmtRp(move.resistance) : '–'}</span></MoveRow>
          </ul>
        </div>

        <MoveDivider />

        {/* ⚠️ Risk */}
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-400/20 dark:bg-amber-400/5">
          <h3 className="text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300 mb-2">⚠️ Risk</h3>
          <ul className="space-y-2 text-sm">
            {([
              ['Chase Risk', move.chaseRisk, move.chaseRiskNote],
              ['Event Risk', move.eventRisk, move.eventRiskNote],
              ['Primary Trend Risk', move.primaryTrendRisk, move.primaryTrendRiskNote],
            ] as const).map(([label, level, note]) => (
              <li key={label} className="flex flex-wrap items-start gap-2">
                <span className="text-zinc-500 dark:text-zinc-400 shrink-0 w-36">{label}:</span>
                <Pill tone={riskTone(level)}>{level}</Pill>
                <span className="text-xs text-zinc-600 dark:text-zinc-400 basis-full sm:basis-auto sm:flex-1">{note}</span>
              </li>
            ))}
          </ul>
          {move.otherRisks.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {move.otherRisks.map((r) => <Pill key={r} tone="red">{r}</Pill>)}
            </div>
          )}
        </div>

        {/* 🎯 Trade Status */}
        <div>
          <MoveHeading>🎯 Trade Status</MoveHeading>
          <ul className="space-y-1.5 text-sm">
            <MoveRow label="Status"><Pill tone={statusStyle.tone}>{statusStyle.emoji} {TODAY_TRADE_STATUS_LABEL[move.tradeStatus]}</Pill></MoveRow>
            <MoveRow label="Buy Permission">
              <Pill tone={move.buyPermission === 'YES' ? 'green' : move.buyPermission === 'CONDITIONAL' ? 'amber' : 'red'}>{move.buyPermission}</Pill>
            </MoveRow>
          </ul>
          <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
            <span className="font-semibold">Entry Status:</span> {move.entryStatus}
          </p>
          {review.strategy && (
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Strategi: {REVIEW_STRATEGY_LABEL[review.strategy]} · Konfirmasi: {review.confirmation}
            </p>
          )}
        </div>

        {/* 🧠 Kesimpulan 10 detik */}
        <div className={cn('neo-border px-4 py-3', statusStyle.box)}>
          <p className="text-xs font-bold uppercase tracking-wide text-zinc-600 dark:text-zinc-300 mb-1">🧠 Kesimpulan 10 Detik</p>
          <p className="text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed">{move.conclusion}</p>
        </div>

        <p className="text-xs text-zinc-400 leading-relaxed">
          Katalis hanya ditandai FAKTA jika berasal dari data harga/volume atau berita langsung ≤7 hari yang menyebut event tersebut.
          Aliran broker/asing dan berita tanpa kata kunci event hanya INDIKASI. Selalu cek keterbukaan informasi IDX sebelum mengambil keputusan.
        </p>
      </div>
    </SectionCard>
  );
}

// ─── Equity Research Report V4 / V5 — shared sections ─────────────────────────────
// V4: 1. Ringkasan Eksekutif → 2. Pergerakan Harian & Volume → 3. Dashboard Teknikal → 4. Risiko & Buy Trigger.
// V5 reuses DailyMoveSection only; its own 6-component read lives in earlyBullishReview.ts.
// Decision comes from simpleEntryReview.ts (Trend → Momentum → Volume → Price Action → Entry Distance →
// FOMO) on top of the same shared review as v3 (a NO TRADE there is never upgraded here); the daily
// move, catalyst and risk reads are the v3 todayMoveAnalysis.ts data. Never chase a flown stock.
const SIMPLE_ENTRY_STYLE: Record<SimpleEntry, { emoji: string; tone: 'green' | 'red' | 'amber' | 'blue'; box: string }> = {
  BUY: { emoji: '🟢', tone: 'green', box: 'border-emerald-400 bg-emerald-50 dark:bg-emerald-400/10' },
  WAIT: { emoji: '🟡', tone: 'amber', box: 'border-amber-400 bg-amber-50 dark:bg-amber-400/10' },
  TAKE_PROFIT: { emoji: '💰', tone: 'blue', box: 'border-sky-400 bg-sky-50 dark:bg-sky-400/10' },
  SELL: { emoji: '🔻', tone: 'red', box: 'border-rose-400 bg-rose-50 dark:bg-rose-400/10' },
  NO_TRADE: { emoji: '🔴', tone: 'red', box: 'border-rose-400 bg-rose-50 dark:bg-rose-400/10' },
};
type V4Tone = 'green' | 'red' | 'amber' | 'zinc';
const PHASE_TONE: Record<BullishPhase, V4Tone> = { EARLY_BULLISH: 'green', BULLISH: 'green', EXTENDED: 'red', WAIT: 'amber', NO_TRADE: 'red' };
const FUNDAMENTAL_TONE: Record<SimpleFundamental, V4Tone> = { GOOD: 'green', ACCEPTABLE: 'amber', WEAK: 'red' };
const TREND_TONE: Record<TrendState, V4Tone> = { TURNING_UP: 'green', UPTREND: 'green', SIDEWAYS: 'amber', DOWNTREND: 'red' };
const MOMENTUM_TONE: Record<MomentumState, V4Tone> = { TURNING_UP: 'green', STRONG: 'green', NEUTRAL: 'amber', WEAK: 'red' };
const VOLUME_TONE: Record<SimpleVolume, V4Tone> = { SUPPORTIVE: 'green', NEUTRAL: 'zinc', SELLING: 'red' };
const PRICE_ACTION_TONE: Record<PriceActionSignal, V4Tone> = { BREAKOUT_RETEST: 'green', BREAKOUT: 'green', REVERSAL: 'green', HIGHER_LOW: 'green', NONE: 'zinc', BREAKDOWN: 'red' };
const RISK3_TONE: Record<'LOW' | 'MEDIUM' | 'HIGH', V4Tone> = { LOW: 'green', MEDIUM: 'amber', HIGH: 'red' };
const BUY_PERMISSION_TONE: Record<SimpleBuyPermission, V4Tone> = { YES: 'green', CONDITIONAL: 'amber', NO: 'red' };
const HEALTH_TONE: Record<HealthVerdict, V4Tone> = { SEHAT: 'green', CUKUP: 'amber', LEMAH: 'red', DATA_KURANG: 'zinc' };
const VALUATION_TONE: Record<ValuationVerdict, V4Tone> = { UNDERVALUED: 'green', WAJAR: 'green', PREMIUM: 'amber', OVERVALUED: 'red', TIDAK_DAPAT_DINILAI: 'zinc' };
const FILTER_TONE: Record<FundamentalFilter, V4Tone> = { PASS: 'green', CAUTION: 'amber', FAIL: 'red' };

const v4Pct = (n: number | null, dec = 1) => (n == null || Number.isNaN(n) ? '–' : `${n >= 0 ? '+' : ''}${n.toFixed(dec)}%`);

function V4Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-zinc-600 dark:text-zinc-300 mb-0.5">{label}</p>
      <div className="text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed">{children}</div>
    </div>
  );
}

/** Shared by v4 and v5: the EARLY BULLISH read on top of the same Risk Gate / Today-Move review. */
function useSimpleEntryReview(props: EquityReportProps) {
  const { summary, bars, trendEma, indicators, priceAction, volume } = props;
  const { review, move } = useEquityReportReview(props);

  const simple = useMemo(() => buildSimpleEntryReview({
    bars: bars ?? [],
    price: summary.lastClose,
    changePct: move.changePct,
    percentChange1M: summary.percentChange1M,
    rvol: move.rvol,
    volume: move.volume,
    prevVolume: move.prevVolume,
    volumeMa20: volume.volumeMa20,
    trend: trendEma.trend,
    higherLows: trendEma.higherLows,
    rsi14: indicators.rsi14,
    macdSignalType: indicators.macdSignalType,
    macdValue: indicators.macdValue,
    macdSignal: indicators.macdSignal,
    macdHistogram: indicators.macdHistogram,
    candlePattern: priceAction.pattern,
    ema20: trendEma.ema20,
    ema50: trendEma.ema50,
    ema200: trendEma.ema200,
    support: review.support,
    resistance: review.resistance,
    moveType: move.moveType,
    catalystStatus: move.catalystStatus,
    entryZoneLow: review.entryZoneLow,
    entryZoneHigh: review.entryZoneHigh,
    fundamentalRisk: review.fundamentalRisk,
    chaseRisk: move.chaseRisk,
    eventRisk: move.eventRisk,
    isStrongDistribution: review.isStrongDistribution,
    setupInvalidated: review.setupInvalidated,
    baseTradeStatus: move.tradeStatus,
  }), [summary, bars, move, review, trendEma, indicators, priceAction, volume]);

  const zoneTxt = review.entryZoneLow > 0 && review.entryZoneLow !== review.entryZoneHigh
    ? `${fmtRp(review.entryZoneLow)} – ${fmtRp(review.entryZoneHigh)}`
    : review.entryZoneHigh > 0 ? fmtRp(review.entryZoneHigh) : '–';

  return { review, move, simple, zoneTxt };
}

function ReportSummarySection({ price, simple, move, zoneTxt, children }: {
  price: number; simple: SimpleEntryReview; move: TodayMoveAnalysis; zoneTxt: string; children?: React.ReactNode;
}) {
  const entryStyle = SIMPLE_ENTRY_STYLE[simple.decision];
  const positive = move.changePct >= 0;
  return (
    <div className={cn('neo-border px-4 py-3 space-y-3', entryStyle.box)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <span className="font-mono text-lg font-bold text-zinc-900 dark:text-zinc-100">{fmtRp(price)}</span>
          <span className={cn('font-mono font-bold text-sm', positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
            {v4Pct(move.changePct, 2)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone={entryStyle.tone}>{entryStyle.emoji} {SIMPLE_ENTRY_LABEL[simple.decision]}</Pill>
          <Pill tone={PHASE_TONE[simple.phase]}>{BULLISH_PHASE_LABEL[simple.phase]}</Pill>
        </div>
      </div>
      <V4Block label="🧠 Insight">{simple.insight}</V4Block>
      <V4Block label="💡 Why">{simple.why}</V4Block>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">⚠️ FOMO Risk</span>
        <Pill tone={RISK3_TONE[simple.fomoRisk]}>{FOMO_RISK_LABEL[simple.fomoRisk]}</Pill>
        {simple.distanceFromZonePct != null && (
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {v4Pct(simple.distanceFromZonePct)} dari area beli {zoneTxt}
          </span>
        )}
      </div>
      {children}
      {move.explosive && (
        <p className="flex items-start gap-1.5 text-xs font-bold text-rose-700 dark:text-rose-400">
          <TriangleAlert className="size-3.5 mt-0.5 shrink-0" strokeWidth={2.5} />
          EXPLOSIVE MOVE — kenaikan besar hari ini tidak otomatis berarti entry masih layak.
        </p>
      )}
    </div>
  );
}

/** `badge` = the card's own buyer/volume verdict, shown next to RVOL. */
function DailyMoveSection({ move, badge }: { move: TodayMoveAnalysis; badge?: React.ReactNode }) {
  const positive = move.changePct >= 0;
  const fmtVol = (n: number | null) => (n == null ? '–' : `${formatCompact(n)} lbr`);
  const fmtX = (n: number | null) => (n == null || Number.isNaN(n) ? '–' : `${n.toFixed(2)}×`);
  return (
    <div>
      <MoveHeading>📊 Pergerakan Harian &amp; Volume</MoveHeading>
      <ul className="space-y-1.5 text-sm">
        <MoveRow label="O / H / L / C">
          <span className="font-mono text-zinc-800 dark:text-zinc-200">
            {move.open != null ? fmtRp(move.open) : '–'} / {fmtRp(move.high)} / {fmtRp(move.low)} / {fmtRp(move.close)}
          </span>
          <Pill tone={Math.abs(move.changePct) >= 5 ? (positive ? 'green' : 'red') : 'zinc'}>{v4Pct(move.changePct, 2)}</Pill>
        </MoveRow>
        <MoveRow label="Volume vs MA20">
          <span className="font-mono text-zinc-800 dark:text-zinc-200">{fmtVol(move.volume)} vs {fmtVol(move.avgVolume20)}</span>
        </MoveRow>
        <MoveRow label="RVOL">
          <Pill tone={move.rvol == null ? 'zinc' : move.rvol >= 1.5 ? 'green' : move.rvol >= 1 ? 'blue' : 'amber'}>{fmtX(move.rvol)}</Pill>
          {badge}
        </MoveRow>
        <MoveRow label="Close Position">
          <span className="text-zinc-700 dark:text-zinc-300">{describeClosePosition(move.closePosition)}</span>
        </MoveRow>
        <MoveRow label="Move Type">
          <Pill tone={MOVE_TYPE_TONE[move.moveType]}>{MOVE_TYPE_LABEL[move.moveType]}</Pill>
        </MoveRow>
      </ul>
      <p className="mt-1.5 text-sm text-zinc-700 dark:text-zinc-300">{move.moveTypeReason}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-zinc-500 dark:text-zinc-400">🔎 Katalis:</span>
        <Pill tone={move.catalystStatus === 'VERIFIED' ? 'blue' : move.catalystStatus === 'SUSPECTED' ? 'amber' : 'zinc'}>
          {CATALYST_STATUS_LABEL[move.catalystStatus]}
        </Pill>
        <span className="text-zinc-700 dark:text-zinc-300">{move.catalystSummary}</span>
      </div>
      {move.evidence.length > 0 && (
        <ul className="mt-2 space-y-1">
          {move.evidence.map((e) => (
            <li key={e.text} className="flex items-start gap-2 text-xs text-zinc-600 dark:text-zinc-400">
              <span className={cn('shrink-0 px-1.5 py-px font-bold border-2 border-(--neo-line)', EVIDENCE_KIND_CLASS[e.kind])}>
                {EVIDENCE_KIND_LABEL[e.kind]}
              </span>
              {e.url
                ? <a href={e.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{e.text}</a>
                : <span>{e.text}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** `children` renders extra indicator rows (v5: EMA200 position, Stochastic) under MACD. */
function TechnicalSection({ simple, move, trendEma, zoneTxt, showFundamental, children }: {
  simple: SimpleEntryReview; move: TodayMoveAnalysis; trendEma: TrendEmaAnalysis; zoneTxt: string;
  showFundamental: boolean; children?: React.ReactNode;
}) {
  return (
    <div>
      <MoveHeading>📈 Dashboard Teknikal</MoveHeading>
      <ul className="space-y-1.5 text-sm">
        <MoveRow label="Trend Utama">
          <Pill tone={TREND_TONE[simple.trend]}>{TREND_STATE_LABEL[simple.trend]}</Pill>
          <span className="font-mono text-xs text-zinc-700 dark:text-zinc-300">{simple.emaStack}</span>
        </MoveRow>
        <li className="text-xs text-zinc-600 dark:text-zinc-400 sm:pl-38">{simple.emaStackNote}</li>
        <MoveRow label="EMA20 / 50 / 200">
          <span className="font-mono text-zinc-800 dark:text-zinc-200">
            {fmtRp(Math.round(trendEma.ema20))} / {fmtRp(Math.round(trendEma.ema50))} / {fmtRp(Math.round(trendEma.ema200))}
          </span>
        </MoveRow>
        <MoveRow label="Momentum">
          <Pill tone={MOMENTUM_TONE[simple.momentum]}>{MOMENTUM_STATE_LABEL[simple.momentum]}</Pill>
        </MoveRow>
        <MoveRow label="RSI 14"><span className="text-zinc-800 dark:text-zinc-200">{simple.rsiText}</span></MoveRow>
        <MoveRow label="MACD"><span className="text-zinc-800 dark:text-zinc-200">{simple.macdText}</span></MoveRow>
        {children}
        <MoveRow label="Price Action">
          <Pill tone={PRICE_ACTION_TONE[simple.priceAction]}>{PRICE_ACTION_LABEL[simple.priceAction]}</Pill>
        </MoveRow>
        <MoveRow label="Support"><span className="font-semibold text-emerald-600 dark:text-emerald-400">{move.support ? fmtRp(move.support) : '–'}</span></MoveRow>
        <MoveRow label="Resistance"><span className="font-semibold text-rose-600 dark:text-rose-400">{move.resistance ? fmtRp(move.resistance) : '–'}</span></MoveRow>
        <MoveRow label="Area Beli"><span className="font-mono text-zinc-800 dark:text-zinc-200">{zoneTxt}</span></MoveRow>
        {showFundamental && (
          <MoveRow label="Fundamental">
            <Pill tone={FUNDAMENTAL_TONE[simple.fundamental]}>{SIMPLE_FUNDAMENTAL_LABEL[simple.fundamental]}</Pill>
          </MoveRow>
        )}
      </ul>
    </div>
  );
}

/** `children` renders extra action-plan content (v5: Area Buy / Stop Loss / Target) inside the trigger box. */
function RiskTriggerSection({ simple, move, title, children }: {
  simple: SimpleEntryReview; move: TodayMoveAnalysis; title: string; children?: React.ReactNode;
}) {
  const entryStyle = SIMPLE_ENTRY_STYLE[simple.decision];
  return (
    <div className="space-y-3">
      <MoveHeading>{title}</MoveHeading>
      <ul className="space-y-2 text-sm">
        {([
          ['Chase Risk', move.chaseRisk, move.chaseRiskNote],
          ['Event Risk', move.eventRisk, move.eventRiskNote],
          ['Primary Trend Risk', move.primaryTrendRisk, move.primaryTrendRiskNote],
        ] as const).map(([label, level, note]) => (
          <li key={label} className="flex flex-wrap items-start gap-2">
            <span className="text-zinc-500 dark:text-zinc-400 shrink-0 w-36">{label}:</span>
            <Pill tone={RISK3_TONE[level]}>{level}</Pill>
            <span className="text-xs text-zinc-600 dark:text-zinc-400 basis-full sm:basis-auto sm:flex-1">{note}</span>
          </li>
        ))}
        <li className="flex flex-wrap items-start gap-2">
          <span className="text-zinc-500 dark:text-zinc-400 shrink-0 w-36">FOMO Risk:</span>
          <Pill tone={RISK3_TONE[simple.fomoRisk]}>{FOMO_RISK_LABEL[simple.fomoRisk]}</Pill>
        </li>
      </ul>
      {move.otherRisks.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {move.otherRisks.map((r) => <Pill key={r} tone="red">{r}</Pill>)}
        </div>
      )}

      <div className={cn('neo-border px-4 py-3 space-y-2', entryStyle.box)}>
        <V4Block label="⏳ Buy Trigger">{simple.buyTrigger}</V4Block>
        {children}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">🎯 Keputusan</span>
          <Pill tone={entryStyle.tone}>{entryStyle.emoji} {SIMPLE_ENTRY_LABEL[simple.decision]}</Pill>
          <span className="text-xs font-bold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">Buy Permission</span>
          <Pill tone={BUY_PERMISSION_TONE[simple.buyPermission]}>{simple.buyPermission}</Pill>
        </div>
        <p className="text-sm text-zinc-700 dark:text-zinc-300">{simple.buyPermissionReason}</p>
      </div>
    </div>
  );
}

function EquityResearchReportCardv4(props: EquityReportProps) {
  const { summary, trendEma } = props;
  const { move, simple, zoneTxt } = useSimpleEntryReview(props);

  return (
    <SectionCard
      title="Equity Research Report"
      icon={<Sparkles className="size-4" />}
      accentClass="bg-violet-600"
      headerAction={<CopyShareButton getText={() => formatSimpleEntryReview(summary.ticker, simple, move)} />}
    >
      <div className="space-y-4">
        <ReportSummarySection price={summary.lastClose} simple={simple} move={move} zoneTxt={zoneTxt} />
        <DailyMoveSection move={move} badge={<Pill tone={VOLUME_TONE[simple.volume]}>{SIMPLE_VOLUME_LABEL[simple.volume]}</Pill>} />
        <MoveDivider />
        <TechnicalSection simple={simple} move={move} trendEma={trendEma} zoneTxt={zoneTxt} showFundamental />
        <MoveDivider />
        <RiskTriggerSection simple={simple} move={move} title="⚠️ Manajemen Risiko & Buy Trigger" />
        <p className="text-xs text-zinc-400 leading-relaxed">
          Cari saham yang mulai bullish ketika entry masih masuk akal, bukan membeli setelah harga sudah terbang.
          Katalis FAKTA hanya dari data harga/volume atau berita langsung ≤7 hari — selalu cek keterbukaan informasi IDX.
        </p>
      </div>
    </SectionCard>
  );
}

// ─── Equity Research Report V5 — Analisis Teknikal Konsisten (6 komponen) ──────────
// Trend → Momentum → Buyer/Volume → Price Action → Entry → Risk from earlyBullishReview.ts, on top of the
// same shared review as v3/v4 (a NO TRADE there is never upgraded). Decision follows the confirmation
// hierarchy SETUP → CONFIRMATION (≥3) → RISK GATE → BUY PERMISSION; bullish signal ≠ buy permission.
// The 3 Pilar Fundamental (fundamentalPillars.ts) are only a quality filter that can cap the decision.
const EB_DECISION_STYLE: Record<EbDecision, { emoji: string; tone: 'green' | 'red' | 'amber'; box: string }> = {
  BUY: { emoji: '🟢', tone: 'green', box: 'border-emerald-400 bg-emerald-50 dark:bg-emerald-400/10' },
  WAIT: { emoji: '🟡', tone: 'amber', box: 'border-amber-400 bg-amber-50 dark:bg-amber-400/10' },
  NO_TRADE: { emoji: '🔴', tone: 'red', box: 'border-rose-400 bg-rose-50 dark:bg-rose-400/10' },
};
const TREND_CLASS_TONE: Record<TrendClass, V4Tone> = { BEARISH: 'red', STABILIZING: 'amber', EARLY_BULLISH: 'green', BULLISH: 'green', EXTENDED: 'red', UNKNOWN: 'zinc' };
const MOMENTUM_CLASS_TONE: Record<MomentumClass, V4Tone> = { MEMBAIK: 'green', BULLISH: 'green', NETRAL: 'amber', MELEMAH: 'red', UNKNOWN: 'zinc' };
const BUYER_CLASS_TONE: Record<BuyerClass, V4Tone> = { BUYER_DOMINAN: 'green', NETRAL: 'amber', SELLER_DOMINAN: 'red', UNKNOWN: 'zinc' };
const PRICE_ACTION_CLASS_TONE: Record<PriceActionClass, V4Tone> = {
  BREAKOUT_RETEST: 'green', BREAKOUT: 'green', REVERSAL: 'green', HIGHER_LOW: 'green', REJECTION: 'red', LOWER_HIGH_LOW: 'red', BREAKDOWN: 'red', NONE: 'zinc', UNKNOWN: 'zinc',
};
const ENTRY_CLASS_TONE: Record<EntryClass, V4Tone> = { VALID: 'green', CAUTION: 'amber', EXTENDED: 'red', UNKNOWN: 'zinc' };
const STAGE_TONE: Record<TechnicalStage, V4Tone> = { CONFIRMED_BULLISH: 'green', EARLY_BULLISH: 'amber', WAIT: 'zinc', INVALIDATED: 'red' };
const RISK_GATE_TONE: Record<EbRiskGateStatus, V4Tone> = { PASS: 'green', CAUTION: 'amber', BLOCK: 'red' };

function HierarchyScoreList({ title, score }: { title: string; score: HierarchyScore }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-bold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">{title}</span>
        <Pill tone={score.valid ? 'green' : score.score >= score.required ? 'amber' : 'zinc'}>{score.score}/{score.max}</Pill>
        <span className="text-[11px] text-zinc-500 dark:text-zinc-400">min {score.required}</span>
      </div>
      {[true, false].map((ok) => {
        const items = score.checks.filter((c) => c.ok === ok);
        if (items.length === 0) return null;
        return (
          <div key={String(ok)} className="mt-1">
            <p className={cn('text-[11px] font-bold uppercase', ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
              {ok ? '✓ Terpenuhi' : '✗ Masih kurang'}
            </p>
            <ul className="space-y-0.5">
              {items.map((c) => (
                <li key={c.label} className={cn('text-sm', ok ? 'text-zinc-800 dark:text-zinc-200' : 'text-zinc-500 dark:text-zinc-400')}>
                  {c.label}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function PillarHeading({ n, title, verdict, tone }: { n: string; title: string; verdict?: string; tone?: V4Tone }) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-2">
      <h4 className="text-xs font-bold uppercase tracking-wide text-zinc-700 dark:text-zinc-200">{n} {title}</h4>
      {verdict && tone && <Pill tone={tone}>{verdict}</Pill>}
    </div>
  );
}

function FundamentalPillarsSection({ pillars }: { pillars: FundamentalPillars }) {
  const { business, health, valuation } = pillars;
  return (
    <div className="space-y-4">
      <div>
        <PillarHeading n="🏢" title="Pahami Bisnisnya" />
        <ul className="space-y-1.5 text-sm">
          <MoveRow label="Emiten"><span className="text-zinc-800 dark:text-zinc-200">{business.name}</span></MoveRow>
          <MoveRow label="Sektor / Sub-sektor"><span className="text-zinc-800 dark:text-zinc-200">{business.sector} / {business.subSector}</span></MoveRow>
          <MoveRow label="Free Float"><span className="font-mono text-zinc-800 dark:text-zinc-200">{business.freeFloat}</span></MoveRow>
        </ul>
        <p className="mt-1.5 text-sm text-zinc-700 dark:text-zinc-300">{business.sizeNote}</p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{business.note}</p>
      </div>

      <div>
        <PillarHeading n="💰" title="Cek Kesehatan Keuangan" verdict={HEALTH_VERDICT_LABEL[health.verdict]} tone={HEALTH_TONE[health.verdict]} />
        <ul className="space-y-1.5 text-sm">
          {health.metrics.map((m) => (
            <MoveRow key={m.label} label={m.label}>
              <Pill tone={m.tone}>{m.value}</Pill>
              <span className="text-xs text-zinc-600 dark:text-zinc-400">{m.note}</span>
            </MoveRow>
          ))}
        </ul>
        <p className="mt-1.5 text-sm text-zinc-700 dark:text-zinc-300">{health.summary}</p>
      </div>

      <div>
        <PillarHeading n="⚖️" title="Nilai Kewajaran Harga" verdict={VALUATION_VERDICT_LABEL[valuation.verdict]} tone={VALUATION_TONE[valuation.verdict]} />
        <ul className="space-y-1.5 text-sm">
          <MoveRow label="PER / PBV"><span className="font-mono text-zinc-800 dark:text-zinc-200">{valuation.per} / {valuation.pbv}</span></MoveRow>
          {valuation.methods.map((m) => (
            <MoveRow key={m.label} label={m.label}>
              <span className="font-mono text-zinc-800 dark:text-zinc-200">{m.fairValue != null ? fmtRp(Math.round(m.fairValue)) : '–'}</span>
            </MoveRow>
          ))}
          <MoveRow label="Nilai Wajar (median)">
            <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">{valuation.fairValue != null ? fmtRp(Math.round(valuation.fairValue)) : '–'}</span>
            {valuation.upsidePct != null && <Pill tone={valuation.upsidePct >= 0 ? 'green' : 'red'}>{v4Pct(valuation.upsidePct, 0)}</Pill>}
          </MoveRow>
          {valuation.accumulationLow != null && valuation.accumulationHigh != null && (
            <MoveRow label="Area Akumulasi">
              <span className="font-mono text-emerald-700 dark:text-emerald-400">
                {fmtRp(Math.round(valuation.accumulationLow))} – {fmtRp(Math.round(valuation.accumulationHigh))}
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">margin of safety 10–20%</span>
            </MoveRow>
          )}
        </ul>
        <p className="mt-1.5 text-sm text-zinc-700 dark:text-zinc-300">{valuation.summary}</p>
      </div>
    </div>
  );
}

function EbComponentRow({ icon, label, status, tone, reason }: { icon: string; label: string; status: string; tone: V4Tone; reason: string }) {
  return (
    <li className="grid grid-cols-[8.5rem_1fr] gap-x-3 gap-y-1 items-start py-2 border-b border-zinc-200 dark:border-zinc-800 last:border-b-0">
      <span className="text-xs font-bold uppercase tracking-wide text-zinc-600 dark:text-zinc-300 pt-0.5">{icon} {label}</span>
      <div className="min-w-0">
        <Pill tone={tone}>{status}</Pill>
        <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">{reason}</p>
      </div>
    </li>
  );
}

function V5Details({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group neo-border px-4 py-2.5">
      <summary className="cursor-pointer list-none flex items-center justify-between gap-2 text-sm font-bold text-zinc-800 dark:text-zinc-200">
        {title}
        <span className="text-xs text-zinc-500 group-open:rotate-180 transition-transform">▼</span>
      </summary>
      <div className="mt-3 space-y-3">{children}</div>
    </details>
  );
}

function EquityResearchReportCardv5(props: EquityReportProps) {
  const { summary, bars, trendEma, indicators, priceAction, volume, fundamentals, fundamentalScreening, tradingPlan } = props;
  const { review, move } = useEquityReportReview(props);

  // Action plan comes from the LONG scenario of the shared trading plan — never recomputed here.
  const price = summary.lastClose;
  const longPlan = tradingPlan.bullish.direction === 'LONG' ? tradingPlan.bullish : null;
  const stopLoss = longPlan && longPlan.sl > 0 ? longPlan.sl : null;
  const target = longPlan && longPlan.tp1 > price ? longPlan.tp1 : null;

  const technical = useMemo(() => buildEarlyBullishReview({
    bars: bars ?? [],
    price: summary.lastClose,
    changePct: move.changePct,
    rvol: move.rvol,
    volumeMa20: volume.volumeMa20,
    closePosition: move.closePosition,
    rsi14: indicators.rsi14,
    macdSignalType: indicators.macdSignalType,
    macdValue: indicators.macdValue,
    macdSignal: indicators.macdSignal,
    candlePattern: priceAction.pattern,
    higherLows: trendEma.higherLows,
    ema20: trendEma.ema20,
    ema50: trendEma.ema50,
    ema200: trendEma.ema200,
    support: review.support,
    resistance: review.resistance,
    moveType: move.moveType,
    entryZoneLow: review.entryZoneLow,
    entryZoneHigh: review.entryZoneHigh,
    chaseRisk: move.chaseRisk,
    eventRisk: move.eventRisk,
    trendRisk: move.primaryTrendRisk,
    isStrongDistribution: review.isStrongDistribution,
    setupInvalidated: review.setupInvalidated,
    baseTradeStatus: move.tradeStatus,
    stopLoss,
    target,
  }), [summary, bars, move, review, trendEma, indicators, priceAction, volume, stopLoss, target]);

  const pillars = useMemo(
    () => buildFundamentalPillars(summary, fundamentals, fundamentalScreening),
    [summary, fundamentals, fundamentalScreening],
  );
  const eb = useMemo(() => applyFundamentalFilter(technical, pillars), [technical, pillars]);

  const style = EB_DECISION_STYLE[eb.decision];
  const positive = move.changePct >= 0;
  const zoneTxt = review.entryZoneLow > 0 && review.entryZoneLow !== review.entryZoneHigh
    ? `${fmtRp(review.entryZoneLow)} – ${fmtRp(review.entryZoneHigh)}`
    : review.entryZoneHigh > 0 ? fmtRp(review.entryZoneHigh) : '–';

  const riskPct = stopLoss != null && price > 0 ? ((price - stopLoss) / price) * 100 : null;
  const planShown = eb.decision !== 'NO_TRADE';
  const planLines = planShown ? [
    `Area Buy: ${zoneTxt}`,
    `Stop Loss / Invalidasi: ${stopLoss != null ? `${fmtRp(stopLoss)}${riskPct != null ? ` (risiko ${riskPct.toFixed(1)}%)` : ''}` : '–'}`,
    `Target 1: ${target != null ? fmtRp(target) : '–'}`,
  ] : [];

  const ema200Txt = eb.hasEma200
    ? `${fmtRp(Math.round(trendEma.ema200))} (harga ${price >= trendEma.ema200 ? 'di atas' : 'di bawah'}, ${v4Pct(((price - trendEma.ema200) / trendEma.ema200) * 100)})`
    : 'UNKNOWN — riwayat < 200 bar';
  const stochTxt = Number.isFinite(indicators.stochK) && Number.isFinite(indicators.stochD)
    ? `%K ${indicators.stochK.toFixed(1)} / %D ${indicators.stochD.toFixed(1)} — ${indicators.stochZone === 'neutral' ? 'netral' : indicators.stochZone}${indicators.stochZone === 'oversold' ? ' (bukan sinyal beli)' : ''}`
    : 'UNKNOWN';

  const buildShareText = () => formatEarlyBullishReview(summary.ticker, eb, [
    ...planLines,
    ...(planLines.length ? [''] : []),
    `🧱 Filter Fundamental: ${FUNDAMENTAL_FILTER_LABEL[pillars.filter]} — ${pillars.filterReason}`,
    '',
    'Prinsip: Jangan mencari saham yang sudah bullish. Cari saham yang sedang mulai bullish ketika entry masih masuk akal.',
    '⚠️ Edukasi, bukan ajakan jual/beli. Keputusan investasi sepenuhnya tanggung jawab masing-masing investor.',
  ]);

  const components = [
    { icon: '📈', label: 'Trend', status: TREND_CLASS_LABEL[eb.trend.status], tone: TREND_CLASS_TONE[eb.trend.status], reason: eb.trend.reason },
    { icon: '⚡', label: 'Momentum', status: MOMENTUM_CLASS_LABEL[eb.momentum.status], tone: MOMENTUM_CLASS_TONE[eb.momentum.status], reason: eb.momentum.reason },
    { icon: '📊', label: 'Buyer / Volume', status: BUYER_CLASS_LABEL[eb.buyer.status], tone: BUYER_CLASS_TONE[eb.buyer.status], reason: eb.buyer.reason },
    { icon: '📐', label: 'Price Action', status: PRICE_ACTION_CLASS_LABEL[eb.priceAction.status], tone: PRICE_ACTION_CLASS_TONE[eb.priceAction.status], reason: eb.priceAction.reason },
    { icon: '🎯', label: 'Entry', status: ENTRY_CLASS_LABEL[eb.entry.status], tone: ENTRY_CLASS_TONE[eb.entry.status], reason: eb.entry.reason },
    {
      icon: '⚠️', label: 'Risk', status: eb.risk.level, tone: RISK3_TONE[eb.risk.level],
      reason: `FOMO ${eb.fomo}${eb.risk.reasons.length ? ` · ${eb.risk.reasons.join(', ')}` : ' · tidak ada risiko menonjol'}.`,
    },
  ];

  return (
    <SectionCard
      title="Equity Research Report"
      icon={<Sparkles className="size-4" />}
      accentClass="bg-violet-600"
      headerAction={<CopyShareButton getText={buildShareText} />}
    >
      <div className="space-y-4">
        {/* Header: price + decision */}
        <div className={cn('neo-border px-4 py-3 space-y-2', style.box)}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-baseline gap-x-3">
              <span className="font-bold text-zinc-900 dark:text-zinc-100">{summary.ticker}</span>
              <span className="font-mono text-lg font-bold text-zinc-900 dark:text-zinc-100">{fmtRp(price)}</span>
              <span className={cn('font-mono font-bold text-sm', positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
                {v4Pct(move.changePct, 2)}
              </span>
            </div>
            <Pill tone={style.tone}>{style.emoji} {ebDecisionLine(eb)}</Pill>
          </div>
          <p className="text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed">{eb.why}</p>
          {move.explosive && (
            <p className="flex items-start gap-1.5 text-xs font-bold text-rose-700 dark:text-rose-400">
              <TriangleAlert className="size-3.5 mt-0.5 shrink-0" strokeWidth={2.5} />
              EXPLOSIVE MOVE — kenaikan besar hari ini tidak otomatis berarti entry masih layak.
            </p>
          )}
        </div>

        {/* Confirmation hierarchy: Setup → Confirmation → Risk Gate → Buy Permission */}
        <div className="neo-border px-4 py-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">🪜 Confirmation Hierarchy</span>
            <Pill tone={STAGE_TONE[eb.stage]}>Stage: {TECHNICAL_STAGE_LABEL[eb.stage]}</Pill>
            <Pill tone={eb.buyPermission ? 'green' : 'red'}>Buy Permission: {eb.buyPermission ? 'YES' : 'NO'}</Pill>
            <Pill tone={RISK_GATE_TONE[eb.riskGate.status]}>Risk Gate: {eb.riskGate.status}</Pill>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <HierarchyScoreList title="Setup Score" score={eb.setup} />
            <HierarchyScoreList title="Confirmation Score" score={eb.confirmation} />
          </div>
          {(eb.riskGate.block.length > 0 || eb.riskGate.caution.length > 0) && (
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              <span className="font-bold">Risk Gate:</span>{' '}
              {[...eb.riskGate.block.map((r) => `⛔ ${r}`), ...eb.riskGate.caution.map((r) => `⚠️ ${r}`)].join(' · ')}
            </p>
          )}
          <ul className="space-y-1.5 text-sm">
            <MoveRow label="Invalidation">
              <span className="font-mono font-semibold text-rose-600 dark:text-rose-400">{eb.invalidationLevel != null ? fmtRp(eb.invalidationLevel) : '–'}</span>
              {eb.riskRewardRatio != null && <span className="text-xs text-zinc-500 dark:text-zinc-400">R/R 1:{eb.riskRewardRatio.toFixed(1)}</span>}
            </MoveRow>
          </ul>
          {eb.missingTriggers.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-zinc-600 dark:text-zinc-300 mb-1">Trigger yang masih kurang</p>
              <ul className="space-y-1">
                {eb.missingTriggers.map((t) => (
                  <li key={t} className="flex items-start gap-1.5 text-sm text-zinc-700 dark:text-zinc-300">
                    <span className="mt-1.5 size-1 shrink-0 rounded-full bg-zinc-400 dark:bg-zinc-600" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Bullish signal ≠ Buy Permission.</p>
        </div>

        {/* 6 komponen */}
        <ul>
          {components.map((c) => <EbComponentRow key={c.label} {...c} />)}
        </ul>

        {/* Decision + Buy Trigger + Action Plan */}
        <div className={cn('neo-border px-4 py-3 space-y-2', style.box)}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">🎯 Decision</span>
            <Pill tone={style.tone}>{style.emoji} {ebDecisionLine(eb)}</Pill>
            {eb.triggerType && <Pill tone="green">Trigger: {eb.triggerType}</Pill>}
          </div>
          <V4Block label="⏳ Buy Trigger">{eb.buyTrigger}</V4Block>
          {planShown && (
            <ul className="space-y-1.5 text-sm pt-1">
              <MoveRow label="Area Buy"><span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">{zoneTxt}</span></MoveRow>
              <MoveRow label="Stop Loss / Invalidasi">
                <span className="font-mono font-semibold text-rose-600 dark:text-rose-400">{stopLoss != null ? fmtRp(stopLoss) : '–'}</span>
                {riskPct != null && <span className="text-xs text-zinc-500 dark:text-zinc-400">risiko {riskPct.toFixed(1)}% dari harga</span>}
              </MoveRow>
              <MoveRow label="Target 1"><span className="font-mono text-zinc-800 dark:text-zinc-200">{target != null ? fmtRp(target) : '–'}</span></MoveRow>
            </ul>
          )}
        </div>

        {/* Fundamental = filter kualitas, bukan trigger */}
        <div className={cn('neo-border px-4 py-2.5 flex flex-wrap items-center gap-2',
          pillars.filter === 'PASS' ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-400/10'
            : pillars.filter === 'FAIL' ? 'border-rose-400 bg-rose-50 dark:bg-rose-400/10'
              : 'border-amber-400 bg-amber-50 dark:bg-amber-400/10')}>
          <span className="text-xs font-bold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">🧱 Filter Fundamental</span>
          <Pill tone={FILTER_TONE[pillars.filter]}>{FUNDAMENTAL_FILTER_LABEL[pillars.filter]}</Pill>
          <Pill tone={HEALTH_TONE[pillars.health.verdict]}>Keuangan {HEALTH_VERDICT_LABEL[pillars.health.verdict]}</Pill>
          <Pill tone={VALUATION_TONE[pillars.valuation.verdict]}>{VALUATION_VERDICT_LABEL[pillars.valuation.verdict]}</Pill>
          <span className="basis-full text-sm text-zinc-700 dark:text-zinc-300">{pillars.filterReason}</span>
        </div>

        <V5Details title="🧱 Detail 3 Pilar Fundamental">
          <FundamentalPillarsSection pillars={pillars} />
        </V5Details>

        <V5Details title="📊 Detail Data Harian & Indikator">
          <DailyMoveSection move={move} badge={<Pill tone={BUYER_CLASS_TONE[eb.buyer.status]}>{BUYER_CLASS_LABEL[eb.buyer.status]}</Pill>} />
          <MoveDivider />
          <ul className="space-y-1.5 text-sm">
            <MoveRow label="EMA20 / EMA50">
              <span className="font-mono text-zinc-800 dark:text-zinc-200">
                {trendEma.ema20 > 0 ? fmtRp(Math.round(trendEma.ema20)) : 'UNKNOWN'} / {trendEma.ema50 > 0 ? fmtRp(Math.round(trendEma.ema50)) : 'UNKNOWN'}
              </span>
            </MoveRow>
            <MoveRow label="EMA200"><span className="font-mono text-zinc-800 dark:text-zinc-200">{ema200Txt}</span></MoveRow>
            <MoveRow label="RSI 14"><span className="text-zinc-800 dark:text-zinc-200">{Number.isFinite(indicators.rsi14) ? indicators.rsi14.toFixed(1) : 'UNKNOWN'}</span></MoveRow>
            <MoveRow label="MACD / Signal">
              <span className="font-mono text-zinc-800 dark:text-zinc-200">
                {Number.isFinite(indicators.macdValue) ? `${indicators.macdValue.toFixed(2)} / ${indicators.macdSignal.toFixed(2)}` : 'UNKNOWN'}
              </span>
            </MoveRow>
            <MoveRow label="Stochastic"><span className="text-zinc-800 dark:text-zinc-200">{stochTxt}</span></MoveRow>
            <MoveRow label="Support"><span className="font-semibold text-emerald-600 dark:text-emerald-400">{move.support ? fmtRp(move.support) : 'UNKNOWN'}</span></MoveRow>
            <MoveRow label="Resistance"><span className="font-semibold text-rose-600 dark:text-rose-400">{move.resistance ? fmtRp(move.resistance) : 'UNKNOWN'}</span></MoveRow>
          </ul>
          {eb.missingData.length > 0 && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Data tidak tersedia: {eb.missingData.join(', ')}.</p>
          )}
        </V5Details>

        <p className="text-xs text-zinc-400 leading-relaxed">
          Prinsip: jangan mencari saham yang sudah bullish — cari saham yang sedang mulai bullish ketika entry masih masuk akal.
          RSI, MACD cross-up, volume besar, atau harga naik saja bukan alasan BUY; fundamental hanya filter kualitas.
          Edukasi, bukan ajakan jual/beli.
        </p>
      </div>
    </SectionCard>
  );
}

// ─── Kesimpulan Objektif (cross-check: price move + divergence + Bandar + regulator) ──
const QUICK_VERDICT_STYLES: Record<QuickVerdict, { emoji: string; label: string; border: string; bg: string; text: string }> = {
  TRADE: { emoji: '🟢', label: 'TRADE', border: 'border-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-400/10', text: 'text-emerald-700 dark:text-emerald-400' },
  WAIT: { emoji: '🟡', label: 'WAIT', border: 'border-amber-400', bg: 'bg-amber-50 dark:bg-amber-400/10', text: 'text-amber-700 dark:text-amber-400' },
  NO_TRADE: { emoji: '🔴', label: 'NO TRADE', border: 'border-rose-400', bg: 'bg-rose-50 dark:bg-rose-400/10', text: 'text-rose-700 dark:text-rose-400' },
};

function QuickDecisionFactorRow({ factor }: { factor: QuickDecisionFactor }) {
  return (
    <li className="flex flex-wrap items-center gap-2">
      <span className="text-zinc-500 dark:text-zinc-400 shrink-0 w-28">{factor.label}:</span>
      <Pill tone={factor.tone}>{factor.value}</Pill>
    </li>
  );
}

function QuickDecisionSnapshotSection({ snapshot }: { snapshot: QuickDecisionSnapshotResult }) {
  const v = QUICK_VERDICT_STYLES[snapshot.verdict];
  return (
    <div className="mb-4 border-b-2 border-(--neo-line) pb-4">
      <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-800 dark:text-zinc-200 mb-2">
        🧭 Ringkasan Faktor Keputusan
      </h3>
      <ul className="space-y-1.5 text-sm">
        <QuickDecisionFactorRow factor={snapshot.market} />
        <QuickDecisionFactorRow factor={snapshot.trend} />
        {snapshot.momentum.map((f) => (
          <QuickDecisionFactorRow key={f.label} factor={f} />
        ))}
        <QuickDecisionFactorRow factor={snapshot.volume} />
        <QuickDecisionFactorRow factor={snapshot.bandar} />
        <QuickDecisionFactorRow factor={snapshot.location} />
        <QuickDecisionFactorRow factor={snapshot.trigger} />
      </ul>

      <div className={cn('neo-border mt-4 px-4 py-3', v.bg, v.border)}>
        <p className={cn('font-bold text-sm mb-2', v.text)}>{v.emoji} FINAL DECISION — {v.label}</p>
        <ul className="space-y-1">
          {snapshot.reasons.map((r) => (
            <li key={r} className="flex items-start gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
              <span className="mt-1 size-1 shrink-0 rounded-full bg-zinc-400 dark:bg-zinc-600" />
              {r}
            </li>
          ))}
        </ul>
      </div>
      <p className="text-xs text-zinc-400 leading-relaxed pt-2">
        Ringkasan ini adalah snapshot berbasis aturan sementara (belum termasuk Market Regime IHSG, Risk/SL, dan validasi statistik historis) — bukan pengganti Decision Engine penuh EzySaham 2.0.
      </p>
    </div>
  );
}

function ObjectiveConclusionCard({ conclusion }: { conclusion: ObjectiveConclusionResult }) {
  const toneStyles: Record<ConclusionTone, { border: string; bg: string; badge: string; text: string; bullet: string }> = {
    caution: {
      border: 'border-rose-400',
      bg: 'bg-rose-50 dark:bg-rose-400/10',
      badge: 'bg-rose-600',
      text: 'text-rose-700 dark:text-rose-400',
      bullet: '⚠️',
    },
    neutral: {
      border: 'border-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-400/10',
      badge: 'bg-amber-500',
      text: 'text-amber-700 dark:text-amber-400',
      bullet: '•',
    },
    supportive: {
      border: 'border-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-400/10',
      badge: 'bg-emerald-600',
      text: 'text-emerald-700 dark:text-emerald-400',
      bullet: '✓',
    },
  };
  const t = toneStyles[conclusion.tone];

  return (
    <SectionCard title="Kesimpulan Objektif" icon={<Crosshair className="size-4" />} accentClass={t.badge}>
      <div className={cn('neo-border px-4 py-3 mb-4', t.bg, t.border)}>
        <p className={cn('font-bold text-sm mb-1.5', t.text)}>{conclusion.headline}</p>
        <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">{conclusion.summary}</p>
      </div>

      <ul className="space-y-2.5">
        {conclusion.flags.map((f) => (
          <li key={f.key} className="flex gap-2.5 text-sm">
            <span className="mt-0.5 shrink-0">{toneStyles[f.tone].bullet}</span>
            <span className="text-zinc-600 dark:text-zinc-400">
              <strong className="text-zinc-800 dark:text-zinc-200">{f.label}:</strong> {f.detail}
            </span>
          </li>
        ))}
      </ul>

      {conclusion.regulatoryNews.length > 0 && (
        <div className="mt-4 border-t-2 border-(--neo-line) pt-3 space-y-1.5">
          <p className="text-[11px] font-bold uppercase text-zinc-400">Berita terkait sinyal regulator</p>
          {conclusion.regulatoryNews.map((n) => (
            <a
              key={n.url}
              href={n.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              {n.title} <span className="text-zinc-400 dark:text-zinc-500 text-xs">— {n.publisher}</span>
            </a>
          ))}
        </div>
      )}

      {/* <div className="neo-border mt-4 px-4 py-3 bg-amber-50 dark:bg-amber-400/10 border-amber-400">
        <p className="font-bold text-sm mb-1 text-amber-700 dark:text-amber-400">⚠️ Disclaimer</p>
        <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
          Analisis ini bertujuan untuk memberikan gambaran teknikal dan fundamental dasar. Keputusan investasi dan
          manajemen risiko sepenuhnya menjadi tanggung jawab masing-masing investor.
        </p>
      </div> */}
    </SectionCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 🌡️ HEALTH SCORE / MARKET TEMPERATURE TOP BAR
// ─────────────────────────────────────────────────────────────────────────────
function HealthScoreBar({
  advisor,
  fundamentalScreening,
  trendEma,
  indicators,
  volume,
  freshness,
}: {
  advisor: AiStockAdvisor;
  fundamentalScreening: FundamentalScreeningResult;
  trendEma: TrendEmaAnalysis;
  indicators: IndicatorAnalysis;
  volume: VolumeAnalysis;
  freshness: DataFreshness | null;
}) {
  const toneBg = {
    green: 'bg-emerald-500',
    amber: 'bg-amber-500',
    red: 'bg-rose-500',
    blue: 'bg-blue-500',
  };
  const toneSoftBg = {
    green: 'bg-emerald-50 dark:bg-emerald-500/10',
    amber: 'bg-amber-50 dark:bg-amber-500/10',
    red: 'bg-rose-50 dark:bg-rose-500/10',
    blue: 'bg-blue-50 dark:bg-blue-500/10',
  };
  const riskToneClass =
    advisor.riskLevel === 'HIGH' ? 'text-rose-600 dark:text-rose-400' :
      advisor.riskLevel === 'MEDIUM' ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400';

  type Tone = 'green' | 'red' | 'amber' | 'blue' | 'zinc';
  // Oversold is amber (warning condition), not green — matches rsiStatus in
  // EquityResearchReportCard2 and the "oversold ≠ sinyal beli" copy in riskGate.ts.
  const rsiBadge: { label: string; tone: Tone } =
    indicators.rsiZone === 'oversold' ? { label: 'RSI Oversold', tone: 'amber' } :
      indicators.rsiZone === 'overbought' ? { label: 'RSI Overbought', tone: 'red' } :
        indicators.rsiZone === 'overbought_risk' ? { label: 'RSI Rawan Overbought', tone: 'amber' } :
          indicators.rsiZone === 'bullish_zone' ? { label: 'RSI Bullish', tone: 'green' } :
            { label: 'RSI Netral', tone: 'zinc' };

  const valuationBadge: { label: string; tone: Tone } = {
    label:
      fundamentalScreening.perStatus.tone === 'green' ? 'Valuasi Menarik' :
        fundamentalScreening.perStatus.tone === 'red' ? 'Valuasi Mahal' : 'Valuasi Wajar',
    tone: fundamentalScreening.perStatus.tone,
  };

  const trendBadge: { label: string; tone: Tone } =
    trendEma.trend === 'bullish' ? { label: 'Tren Bullish', tone: 'green' } :
      trendEma.trend === 'bearish' ? { label: 'Tren Bearish', tone: 'red' } : { label: 'Tren Sideways', tone: 'amber' };

  const badges: { label: string; tone: Tone }[] = [
    trendBadge,
    rsiBadge,
    valuationBadge,
    ...(volume.isHighVolume ? [{ label: 'Volume Tinggi', tone: 'green' as Tone }] : []),
  ];

  return (
    <div className={cn('sm:neo-border sm:neo-shadow px-4 py-3 sm:px-5 sm:py-4 space-y-3 border-b border-zinc-100 dark:border-zinc-800 sm:border-b-0', toneSoftBg[advisor.verdictTone])}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn('flex flex-col items-center justify-center size-14 sm:size-16 neo-border shrink-0 text-white', toneBg[advisor.verdictTone])}>
            <span className="font-mono text-lg sm:text-xl font-bold leading-none">{advisor.compositeScore}</span>
            <span className="text-[9px] font-bold uppercase opacity-80">/100</span>
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Skor Kesehatan Saham</div>
            <div className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100 leading-tight truncate">{advisor.verdictLabel}</div>
            <div className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
              Risk: <span className={riskToneClass}>{advisor.riskLevel}</span>
              {' · '}Confidence {advisor.confidenceScore}%
            </div>
          </div>
        </div>
        {freshness && (
          <div className="hidden sm:block shrink-0 text-zinc-500 dark:text-zinc-400">
            <DataFreshnessPill freshness={freshness} />
          </div>
        )}
      </div>

      <div className="-mx-4 sm:mx-0 overflow-x-auto">
        <div className="flex items-center gap-1.5 px-4 sm:px-0 min-w-max sm:min-w-0 sm:flex-wrap">
          {badges.map((b) => (
            <Pill key={b.label} tone={b.tone}>{b.label}</Pill>
          ))}
          {freshness && (
            <span className="sm:hidden shrink-0 text-[11px] font-semibold text-zinc-400 ml-1">
              <DataFreshnessPill freshness={freshness} />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
type AnalysisTab = 'teknikal' | 'fundamental' | 'berita' | 'breakout';

const ANALYSIS_TABS: { key: AnalysisTab; label: string; icon: React.ReactNode }[] = [
  { key: 'teknikal', label: 'Screening Teknikal', icon: <TrendingUp className="size-4" /> },
  { key: 'fundamental', label: 'Screening Fundamental', icon: <PieChart className="size-4" /> },
  { key: 'berita', label: 'Analisis Berita', icon: <Newspaper className="size-4" /> },
];


// ─────────────────────────────────────────────────────────────────────────────
// 💀 SKELETON LOADER (menggantikan teks "Menganalisis...")
// ─────────────────────────────────────────────────────────────────────────────
function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn('animate-pulse bg-zinc-200 dark:bg-zinc-800', className)} />;
}

function StockAnalysisSkeleton({ ticker }: { ticker: string }) {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <span className="sr-only">Menganalisis {ticker.toUpperCase()} (Teknikal, Fundamental, Berita & AI)…</span>

      <header className="sticky top-0 z-30 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-3 py-2.5 sm:px-6 sm:py-3">
          <SkeletonBlock className="h-4 w-14 rounded" />
          <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-700" />
          <SkeletonBlock className="h-4 w-20 rounded" />
          <div className="ml-auto flex items-center gap-2">
            <SkeletonBlock className="h-8 w-16 rounded-lg" />
            <SkeletonBlock className="size-8 rounded-lg" />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-0 sm:px-4 lg:px-6 sm:pt-4">
        <SkeletonBlock className="h-24 sm:h-20 w-full sm:neo-border" />
      </div>

      <main className="mx-auto max-w-6xl px-0 sm:px-4 sm:py-4 lg:px-6 lg:py-6 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-0 sm:gap-5">
        <div className="min-w-0 space-y-4 px-4 pt-4 sm:px-0 sm:pt-0">
          <div className="space-y-3 sm:neo-border sm:p-5">
            <SkeletonBlock className="h-5 w-2/3 rounded" />
            <SkeletonBlock className="h-3 w-1/3 rounded" />
            <SkeletonBlock className="h-9 w-1/2 rounded" />
            <div className="flex gap-3 overflow-hidden">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonBlock key={i} className="h-10 w-16 shrink-0 rounded" />
              ))}
            </div>
          </div>
          <SkeletonBlock className="h-64 w-full sm:neo-border" />
          <SkeletonBlock className="h-28 w-full sm:neo-border" />
          <div className="space-y-2">
            <SkeletonBlock className="h-9 w-full rounded" />
            <SkeletonBlock className="h-40 w-full sm:neo-border" />
            <SkeletonBlock className="h-40 w-full sm:neo-border" />
          </div>
        </div>
        <div className="hidden lg:block space-y-5">
          <SkeletonBlock className="h-72 w-full neo-border" />
          <SkeletonBlock className="h-56 w-full neo-border" />
          <SkeletonBlock className="h-56 w-full neo-border" />
        </div>
      </main>
    </div>
  );
}

export function StockAnalysisPage({ ticker }: { ticker: string }) {
  const {
    status,
    summary,
    analysis,
    bars,
    newsItems,
    newsSummary,
    newsLoading,
    allSummaries,
    breakoutScores,
    freshness,
    advisor,
    fundamentalScreening,
    technicalScreening,
    fundamentals,
    fundamentalsLoading,
    brokerActivity,
    brokerActivityLoading,
    reload: load,
  } = useStockAnalysis(ticker);
  const [justCopied, setJustCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<AnalysisTab>('teknikal');
  // IHSG regime — one of Swing Suitability's factors (features_kontradiktif.md's Swing 1–5 Day
  // prompt). Fetched once here rather than inside EquityResearchReportCard2 so re-renders of that
  // card don't refetch it.
  const { regime: marketRegime } = useMarketRegime();
  const watchlist = useWatchlist();
  const journal = useJournal();
  const fairValue = useFairValueCalculator(summary, fundamentals);
  const [addingToJournal, setAddingToJournal] = useState(false);
  const [journalStatus, setJournalStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleAddToJournal = useCallback(async () => {
    if (!summary || !analysis) return;
    setAddingToJournal(true);
    setJournalStatus(null);
    try {
      const scenario =
        analysis.tradingPlan.recommendedBias === 'bearish' ? analysis.tradingPlan.bearish : analysis.tradingPlan.bullish;
      const res = await journal.addEntries([
        {
          ticker: summary.ticker,
          presetId: null,
          entry: scenario.entry,
          tp1: scenario.tp1,
          tp2: scenario.tp2,
          sl: scenario.sl,
          riskRewardPlanned: scenario.riskRewardRatio,
          reasonBuy: analysis.conclusion.summary,
          reasonAvoid: analysis.conclusion.watchOut,
        },
      ]);
      setJournalStatus(
        res.ok
          ? { type: 'success', text: `${summary.ticker} ditambahkan ke Jurnal.` }
          : { type: 'error', text: res.message ?? 'Gagal menyimpan ke Jurnal.' }
      );
    } finally {
      setAddingToJournal(false);
      setTimeout(() => setJournalStatus(null), 3000);
    }
  }, [summary, analysis, journal]);

  const handleShare = useCallback(async () => {
    if (!summary) return;
    const url = window.location.href;
    const shareData = { title: `${summary.ticker} — ${summary.name}`, text: 'Analisis saham & AI Advisor', url };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch { /* cancelled */ }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setJustCopied(true);
      setTimeout(() => setJustCopied(false), 2000);
    } catch { /* clipboard unavailable */ }
  }, [summary]);

  // Saham lain di sektor yang sama, diurutkan berdasarkan kapitalisasi pasar paling mendekati
  const similarStocks = useMemo(() => {
    if (!summary || allSummaries.length === 0) return [];
    return allSummaries
      .filter((s) => s.ticker !== summary.ticker && s.sector === summary.sector)
      .sort((a, b) => Math.abs(a.capitalization - summary.capitalization) - Math.abs(b.capitalization - summary.capitalization))
      .slice(0, 5);
  }, [allSummaries, summary]);

  const objectiveConclusion = useMemo(() => {
    if (!summary || !fundamentalScreening || !technicalScreening) return null;
    const bandarScore = computeBandarScore(summary, bars);
    return computeObjectiveConclusion({ summary, bars, fundamentalScreening, technicalScreening, bandarScore, newsItems });
  }, [summary, bars, fundamentalScreening, technicalScreening, newsItems]);

  const quickDecisionSnapshot = useMemo(() => {
    if (!summary || !analysis || !fundamentalScreening) return null;
    const bandarScore = computeBandarScore(summary, bars);
    const marketCyclePhase = getMarketCyclePhase(bandarScore, analysis.indicators);
    const entryTiming = computeEntryTiming(bandarScore, analysis.indicators);

    // Same Risk Gate inputs/logic as EquityResearchReportCard2's "Status Transaksi" (riskGate.ts),
    // computed here too so this card's FINAL DECISION can never disagree with that one for the
    // same stock (features_kontradiktif.md).
    const bias = analysis.tradingPlan.recommendedBias === 'bearish' ? 'bearish' : 'bullish';
    const scenario = analysis.tradingPlan[bias];
    const isLong = scenario.direction === 'LONG';
    const price = summary.lastClose;
    const isStrongDistribution = bandarScore.classification.label === 'Strong Distribution';
    const isDistributionRisk = bandarScore.classification.label === 'Distribution Risk';
    const priceAtEntryTrigger = isPriceAtEntryTrigger(scenario.direction, price, scenario.entry);
    const setupInvalidated = isSetupInvalidated(scenario.direction, price, scenario.sl);
    const nearestSupport = analysis.supportResistance.supports[0];
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

    return computeQuickDecisionSnapshot({
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
  }, [summary, bars, analysis, fundamentalScreening, fundamentals]);

  // AI Stock Advisor vs "Ringkasan Faktor Keputusan" sync: the advisor's composite-score verdict
  // is computed independently of Zone Status / Entry Confirmation / Risk Gate, so a bullish score
  // could show "LAYAK BELI" right next to a report that says WAIT / WAIT_FOR_PULLBACK / NO_TRADE
  // for the same stock. gateAdvisorVerdict caps (never upgrades) the displayed verdict by the exact
  // TradeStatus quickDecisionSnapshot already uses, so every card that shows advisor.verdictLabel
  // agrees with Status Transaksi / FINAL DECISION.
  const gatedAdvisor: AiStockAdvisor | null = useMemo(() => {
    if (!advisor) return null;
    if (!quickDecisionSnapshot) return advisor;
    return gateAdvisorVerdict(advisor, quickDecisionSnapshot.tradeStatus);
  }, [advisor, quickDecisionSnapshot]);

  if (status === 'loading') {
    return <StockAnalysisSkeleton ticker={ticker} />;
  }

  if (status === 'error' || !analysis || !summary || !advisor || !fundamentalScreening || !technicalScreening || !breakoutScores) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white dark:bg-zinc-950 px-4">
        <AlertTriangle className="size-10 text-amber-400" />
        <p className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">Data tidak tersedia</p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center max-w-xs">
          Ticker <strong>{ticker.toUpperCase()}</strong> tidak ditemukan atau gagal dimuat.
        </p>
        <Link
          href="/screener"
          className="neo-press inline-flex items-center gap-2 neo-border neo-shadow-sm bg-emerald-400 px-4 py-2 text-sm font-bold text-black"
        >
          <ArrowLeft className="size-4" strokeWidth={2.5} /> Kembali ke Screener
        </Link>
      </div>
    );
  }

  // Non-null: `advisor` is guaranteed above, and gatedAdvisor only ever returns null when advisor is null.
  const displayAdvisor = gatedAdvisor ?? advisor;

  const { trendEma, supportResistance, priceAction, volume, indicators, tradingPlan } = analysis;
  const isBullish = trendEma.trend === 'bullish';
  const isBearish = trendEma.trend === 'bearish';
  const positiveDay = summary.percentChange1D >= 0;
  const isWatched = watchlist.has(summary.ticker);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* ── Sticky Header ──────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm border-b border-zinc-200 dark:border-zinc-800 neo-border border-x-0 border-t-0">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-2.5 sm:px-6 sm:py-3">
          {/* Back button */}
          <Link
            href="/screener"
            className="flex shrink-0 items-center gap-1 text-sm font-bold text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            aria-label="Kembali ke screener"
          >
            <ArrowLeft className="size-4" strokeWidth={2.5} />
            <span className="hidden sm:inline text-xs uppercase tracking-wide">Screener</span>
          </Link>

          <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-700" />

          {/* Ticker name */}
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className="font-bold text-zinc-900 dark:text-zinc-100 text-base">{summary.ticker}</span>
            <span className="hidden sm:inline truncate text-xs font-medium text-zinc-400 dark:text-zinc-500">{summary.name}</span>
          </div>

          {/* Mobile: inline price + change in header */}
          <div className="flex items-center gap-1.5 shrink-0 sm:hidden">
            <span className="font-mono text-sm font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
              {formatRupiah(summary.lastClose)}
            </span>
            <span className={cn(
              'inline-flex items-center gap-0.5 text-xs font-mono font-bold tabular-nums px-1.5 py-0.5 rounded-md',
              positiveDay
                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400'
                : 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400'
            )}>
              {positiveDay ? <TrendingUp className="size-3" strokeWidth={2.5} /> : <TrendingDown className="size-3" strokeWidth={2.5} />}
              {formatPercent(summary.percentChange1D)}
            </span>
          </div>

          {/* Desktop: nav links */}
          <nav className="hidden sm:flex items-center gap-1">
            {LINKS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold uppercase tracking-wide text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <Icon className="size-3.5" strokeWidth={2.5} />
                <span>{label}</span>
              </Link>
            ))}
          </nav>

          {/* Tambah ke Jurnal */}
          <button
            type="button"
            onClick={handleAddToJournal}
            disabled={addingToJournal}
            title="Tambah ke Jurnal"
            className="neo-press flex shrink-0 size-8 items-center justify-center neo-border neo-shadow-sm bg-white text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 rounded-lg sm:rounded-none sm:size-9 disabled:opacity-50"
          >
            {addingToJournal ? (
              <Loader2 className="size-3.5 sm:size-4 animate-spin" strokeWidth={2.5} />
            ) : (
              <NotebookPen className="size-3.5 sm:size-4" strokeWidth={2.5} />
            )}
          </button>

          {/* Reload */}
          <button
            type="button"
            onClick={() => load(true)}
            title="Perbarui & muat ulang data"
            className="neo-press flex shrink-0 size-8 items-center justify-center neo-border neo-shadow-sm bg-white text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 rounded-lg sm:rounded-none sm:size-9"
          >
            <RefreshCw className="size-3.5 sm:size-4" strokeWidth={2.5} />
          </button>
        </div>
      </header>

      {journalStatus && (
        <div
          className={cn(
            'fixed inset-x-0 top-16 z-40 mx-auto w-fit max-w-xs neo-border neo-shadow-sm px-3 py-2 text-center text-xs font-bold',
            journalStatus.type === 'success'
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-300'
              : 'bg-rose-100 text-rose-800 dark:bg-rose-400/10 dark:text-rose-300'
          )}
        >
          {journalStatus.text}
        </div>
      )}

      {/* ── Health Score / Market Temperature Top Bar ───────────────────────── */}
      <div className="mx-auto max-w-6xl px-0 sm:px-4 lg:px-6 sm:pt-4">
        <HealthScoreBar
          advisor={displayAdvisor}
          fundamentalScreening={fundamentalScreening}
          trendEma={trendEma}
          indicators={indicators}
          volume={volume}
          freshness={freshness}
        />
      </div>

      {/* ── Main Content ────────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-6xl px-0 sm:px-4 sm:py-4 lg:px-6 lg:py-6 pb-16 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-0 sm:gap-5 lg:items-start">

        {/* ── LEFT / MAIN COLUMN ─────────────────────────────────────────── */}
        <div className="min-w-0 space-y-0 sm:space-y-4">

          {/* ── Hero Price Block ────────────────────────────────────────── */}
          <div className="bg-white dark:bg-zinc-900 px-4 pt-4 pb-3 sm:neo-border sm:neo-shadow sm:px-5 sm:py-5 border-b border-zinc-100 dark:border-zinc-800 sm:border-b-0">
            {/* Company name + sector */}
            <div className="flex items-start gap-2 mb-3">
              <div className="flex-1 min-w-0">
                <h1 className="text-base sm:text-xl font-bold text-zinc-900 dark:text-zinc-100 leading-tight truncate">
                  {summary.name}
                </h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500">{summary.ticker}</span>
                  {summary.sector && (
                    <>
                      <span className="text-zinc-300 dark:text-zinc-700">·</span>
                      <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500 truncate">{summary.sector}</span>
                    </>
                  )}
                  {freshness && <DataFreshnessPill freshness={freshness} />}
                </div>
              </div>
            </div>

            {/* Price + change — large on desktop, medium on mobile (header has it small) */}
            <div className="flex items-end justify-between gap-3">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="font-mono text-2xl sm:text-3xl font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                  {formatRupiah(summary.lastClose)}
                </span>
                <span className={cn(
                  'hidden sm:inline-flex items-center gap-1 text-base font-mono tabular-nums font-bold',
                  positiveDay ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                )}>
                  {positiveDay ? <TrendingUp className="size-5" strokeWidth={2.5} /> : <TrendingDown className="size-5" strokeWidth={2.5} />}
                  {formatPercent(summary.percentChange1D)}
                </span>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleShare}
                  className="neo-press flex items-center gap-1 px-2.5 py-1.5 neo-border neo-shadow-sm bg-white text-xs font-bold text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 rounded-lg sm:rounded-none sm:px-3"
                >
                  <Share2 className="size-3.5" strokeWidth={2.5} />
                  <span className="hidden sm:inline">{justCopied ? 'Disalin!' : 'Bagikan'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => watchlist.toggle(summary.ticker)}
                  className={cn(
                    'neo-press flex items-center gap-1 px-2.5 py-1.5 neo-border neo-shadow-sm text-xs font-bold transition-colors rounded-lg sm:rounded-none sm:px-3',
                    isWatched ? 'bg-amber-300 text-black' : 'bg-white text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300'
                  )}
                >
                  {isWatched ? <BookmarkCheck className="size-3.5" strokeWidth={2.5} /> : <Bookmark className="size-3.5" strokeWidth={2.5} />}
                  <span className="hidden sm:inline">{isWatched ? 'Watching' : 'Watch'}</span>
                </button>
              </div>
            </div>

            {/* ── Horizontal Stats Bar ─────────────────────────────────── */}
            <div className="mt-3 -mx-4 sm:mx-0 overflow-x-auto">
              <div className="flex items-stretch gap-0 px-4 sm:px-0 sm:gap-4 sm:flex-wrap min-w-max sm:min-w-0">
                {[
                  { label: 'Mkt Cap', value: formatCompact(summary.capitalization) },
                  { label: 'Vol 20D', value: `${formatCompact(volume.volumeMa20)} lbr` },
                  { label: 'RVOL', value: Number.isNaN(volume.relativeVolume) ? '–' : `${volume.relativeVolume.toFixed(2)}×` },
                  { label: 'PER', value: summary.per != null ? `${summary.per.toFixed(1)}×` : '–' },
                  { label: 'PBV', value: summary.pbv != null ? `${summary.pbv.toFixed(2)}×` : '–' },
                  { label: 'ROE', value: summary.roe != null ? `${summary.roe.toFixed(1)}%` : '–' },
                ].map((stat, i) => (
                  <div
                    key={stat.label}
                    className={cn(
                      'flex flex-col items-center justify-center px-3 py-1.5 shrink-0',
                      i > 0 && 'border-l border-zinc-100 dark:border-zinc-800 sm:border-0 sm:pl-0'
                    )}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wide text-zinc-400 dark:text-zinc-500 whitespace-nowrap">{stat.label}</span>
                    <span className="text-xs font-mono font-bold text-zinc-800 dark:text-zinc-200 whitespace-nowrap mt-0.5">{stat.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── OHLCV Chart ─────────────────────────────────────────────── */}
          {bars.length > 0 && (
            <div className="sm:neo-border sm:neo-shadow">
              <OHLCVChart bars={bars} currentClose={summary.lastClose} ticker={summary.ticker} prevClose={summary.prevClose} />
            </div>
          )}

          {/* ── Kalkulator Nilai Wajar (Fair Value) ───────────────────────── */}
          {/* <div className="px-3 sm:px-0">
            <FairValueCalculatorCard summary={summary} fv={fairValue} />
          </div> */}

          {/* ── Kesimpulan Objektif ──────────────────────────────────────── */}
          <div className="px-0 sm:px-0">
            {objectiveConclusion && (
              <ObjectiveConclusionCard conclusion={objectiveConclusion} />
            )}
          </div>

          {/* Data Freshness warning */}
          {freshness && <DataFreshnessStaleBanner freshness={freshness} />}

          {/* ── MOBILE SIDEBAR CARDS ─────────────────────────────────────
              On mobile: AI Advisor, Scoring, Bandar, Trading Plan appear
              here (after chart, before tabs). On lg+ they move to the
              right sticky sidebar via CSS order. */}
          <div className="lg:hidden space-y-3 px-3 sm:px-0">
            <AiStockAdvisorSidebar advisor={displayAdvisor} />
            <TradingPlanSidebarCard plan={tradingPlan} />
            {/* <ScoringCard price={summary.lastClose} trendEma={trendEma} indicators={indicators} volume={volume} /> */}
            {/* <BandarDetectorCard summary={summary} bars={bars} brokerActivity={brokerActivity} brokerActivityLoading={brokerActivityLoading} /> */}
          </div>

          {/* ── Quick Stat Cards ─────────────────────────────────────────── */}
          {/* <div className="px-3 sm:px-0">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
              <button
                onClick={() => setActiveTab('berita')}
                className={cn(
                  'neo-press p-3 sm:p-4 neo-border neo-shadow-sm bg-white dark:bg-zinc-900 text-left space-y-1 rounded-xl sm:rounded-none transition-colors',
                  activeTab === 'berita' && 'bg-zinc-50 dark:bg-zinc-800'
                )}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] sm:text-xs font-bold uppercase text-zinc-500">Berita</span>
                  <span className="text-xs sm:text-sm font-bold text-blue-600">{newsSummary.netSentimentScore}%</span>
                </div>
                <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 font-semibold leading-tight">
                  {newsSummary.totalNews} artikel
                </p>
                <p className="text-[10px] font-medium text-zinc-400 uppercase">{newsSummary.overallSentiment}</p>
              </button>

              <button
                onClick={() => setActiveTab('fundamental')}
                className={cn(
                  'neo-press p-3 sm:p-4 neo-border neo-shadow-sm bg-white dark:bg-zinc-900 text-left space-y-1 rounded-xl sm:rounded-none transition-colors',
                  activeTab === 'fundamental' && 'bg-zinc-50 dark:bg-zinc-800'
                )}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] sm:text-xs font-bold uppercase text-zinc-500">Fundamental</span>
                  <span className={cn('text-xs sm:text-sm font-bold', fundamentalScreening.passed ? 'text-emerald-600' : 'text-amber-600')}>
                    {fundamentalScreening.score}/100
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 font-semibold leading-tight">
                  {fundamentalScreening.statusText}
                </p>
              </button>

              <button
                onClick={() => setActiveTab('teknikal')}
                className={cn(
                  'neo-press p-3 sm:p-4 neo-border neo-shadow-sm bg-white dark:bg-zinc-900 text-left space-y-1 rounded-xl sm:rounded-none col-span-2 sm:col-span-1 transition-colors',
                  activeTab === 'teknikal' && 'bg-zinc-50 dark:bg-zinc-800'
                )}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] sm:text-xs font-bold uppercase text-zinc-500">Teknikal</span>
                  <span className={cn('text-xs sm:text-sm font-bold', technicalScreening.passed ? 'text-emerald-600' : 'text-amber-600')}>
                    {technicalScreening.score}/100
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 font-semibold leading-tight">
                  {technicalScreening.statusText}
                </p>
              </button>
            </div>
          </div> */}

          {/* ── Sticky Tab Bar ───────────────────────────────────────────── */}
          <div className="sticky top-[49px] sm:top-[57px] z-20 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm border-y border-zinc-200 dark:border-zinc-800 sm:border-0 sm:neo-border sm:neo-shadow-sm sm:rounded-none" role="tablist">
            <div className="flex overflow-x-auto scrollbar-hide">
              {ANALYSIS_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    'flex shrink-0 items-center justify-center gap-1.5 px-3 py-3 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-bold uppercase tracking-wide transition-all whitespace-nowrap border-b-2 sm:border-b-0 sm:flex-1',
                    activeTab === tab.key
                      ? 'border-b-emerald-500 text-emerald-600 dark:text-emerald-400 sm:border-b-0 sm:bg-(--neo-accent) sm:text-black'
                      : 'border-b-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                  )}
                >
                  <span className="size-4 sm:size-4">{tab.icon}</span>
                  {/* Label: hidden on very small screens, show from sm */}
                  <span className="hidden xs:inline sm:inline">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── TAB CONTENT ─────────────────────────────────────────────── */}
          <div className="px-3 sm:px-0">

            {/* Tab: Screening & Analisis Teknikal (+ Equity Research Report sebagai ringkasan) */}
            {activeTab === 'teknikal' && (
              <div className="space-y-4 sm:space-y-5">
                {/* <EquityResearchReportCard2
                  summary={summary}
                  bars={bars}
                  advisor={displayAdvisor}
                  trendEma={trendEma}
                  indicators={indicators}
                  supportResistance={supportResistance}
                  fundamentalScreening={fundamentalScreening}
                  fundamentals={fundamentals}
                  fundamentalsLoading={fundamentalsLoading}
                  newsItems={newsItems}
                  tradingPlan={tradingPlan}
                  volume={volume}
                  priceAction={priceAction}
                  snapshot={quickDecisionSnapshot}
                  marketRegime={marketRegime}
                /> */}

                {/* <EquityResearchReportCardv3
                  summary={summary}
                  bars={bars}
                  trendEma={trendEma}
                  indicators={indicators}
                  supportResistance={supportResistance}
                  fundamentalScreening={fundamentalScreening}
                  fundamentals={fundamentals}
                  tradingPlan={tradingPlan}
                  volume={volume}
                  priceAction={priceAction}
                  newsItems={newsItems}
                  brokerActivity={brokerActivity}
                /> */}

                {/* <EquityResearchReportCardv4
                  summary={summary}
                  bars={bars}
                  trendEma={trendEma}
                  indicators={indicators}
                  supportResistance={supportResistance}
                  fundamentalScreening={fundamentalScreening}
                  fundamentals={fundamentals}
                  tradingPlan={tradingPlan}
                  volume={volume}
                  priceAction={priceAction}
                  newsItems={newsItems}
                  brokerActivity={brokerActivity}
                /> */}

                <EquityResearchReportCardv5
                  summary={summary}
                  bars={bars}
                  trendEma={trendEma}
                  indicators={indicators}
                  supportResistance={supportResistance}
                  fundamentalScreening={fundamentalScreening}
                  fundamentals={fundamentals}
                  tradingPlan={tradingPlan}
                  volume={volume}
                  priceAction={priceAction}
                  newsItems={newsItems}
                  brokerActivity={brokerActivity}
                />

                <div className={cn(
                  'neo-border neo-shadow-sm p-3 sm:p-4 flex items-center justify-between gap-3 rounded-xl sm:rounded-none',
                  technicalScreening.passed
                    ? 'bg-emerald-50 dark:bg-emerald-500/10'
                    : 'bg-amber-50 dark:bg-amber-500/10'
                )}>
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 leading-tight">{technicalScreening.statusText}</h3>
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mt-0.5 leading-snug">
                      Evaluasi Tren, Momentum MACD/RSI, Price Action & Volume
                    </p>
                  </div>
                  <span className="font-mono text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400 shrink-0">
                    {technicalScreening.score}/100
                  </span>
                </div>

                <TrendEmaSection number={1} trendEma={trendEma} isBullish={isBullish} isBearish={isBearish} bars={bars} />

                <SectionCard number={2} title="Level Penting (Resistance & Support)" icon={<Crosshair className="size-4" />} accentClass="bg-violet-500">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <p className="text-xs sm:text-sm font-semibold uppercase tracking-wide text-rose-600 dark:text-rose-400 mb-2">Resistance</p>
                      {supportResistance.resistances.length > 0
                        ? supportResistance.resistances.map((r) => (
                          <LevelRow key={r.label} label={r.label} price={r.price} description={r.description} tone="red" />
                        ))
                        : <p className="text-sm text-zinc-400">Tidak terdeteksi.</p>}
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs sm:text-sm font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 mb-2">Support</p>
                      {supportResistance.supports.length > 0
                        ? supportResistance.supports.map((s) => (
                          <LevelRow key={s.label} label={s.label} price={s.price} description={s.description} tone="green" />
                        ))
                        : <p className="text-sm text-zinc-400">Tidak terdeteksi.</p>}
                    </div>
                  </div>
                </SectionCard>

                <PriceActionSection number={3} priceAction={priceAction} />
                <VolumeSection number={4} volume={volume} />
                <IndicatorsSection number={5} indicators={indicators} bars={bars} />

                <SectionCard number={6} title="Rencana Trading" icon={<Target className="size-4" />} accentClass="bg-rose-500">
                  <div className="grid gap-4 sm:grid-cols-2 mb-4">
                    <ScenarioCard
                      type="bullish"
                      entry={tradingPlan.bullish.entry}
                      avgDown={tradingPlan.bullish.avgDown}
                      tp1={tradingPlan.bullish.tp1}
                      tp2={tradingPlan.bullish.tp2}
                      sl={tradingPlan.bullish.sl}
                      rr={tradingPlan.bullish.riskRewardRatio}
                      notes={tradingPlan.bullish.notes}
                    />
                    <ScenarioCard
                      type="bearish"
                      entry={tradingPlan.bearish.entry}
                      tp1={tradingPlan.bearish.tp1}
                      tp2={tradingPlan.bearish.tp2}
                      sl={tradingPlan.bearish.sl}
                      rr={tradingPlan.bearish.riskRewardRatio}
                      notes={tradingPlan.bearish.notes}
                    />
                  </div>
                </SectionCard>
              </div>
            )}

            {/* Tab: Screening & Analisis Fundamental */}
            {activeTab === 'fundamental' && (
              <div className="space-y-4 sm:space-y-5">
                <FundamentalSection
                  summary={summary}
                  screening={fundamentalScreening}
                  fundamentals={fundamentals}
                  fundamentalsLoading={fundamentalsLoading}
                  fv={fairValue}
                />
              </div>
            )}

            {/* Tab: Analisis Berita & Sentimen */}
            {activeTab === 'berita' && (
              <NewsSection newsItems={newsItems} newsSummary={newsSummary} loading={newsLoading} />
            )}

            {/* Tab: Breakout Hunter AI */}
            {activeTab === 'breakout' && (
              <BreakoutHunterSection ticker={summary.ticker} scores={breakoutScores} />
            )}
          </div>

          {/* Philosophy Banner */}
          {/* <div className="px-3 sm:px-0">
            <PhilosophyBanner />
          </div> */}

          {/* Disclaimer */}
          <div className="mx-3 sm:mx-0 flex gap-2.5 neo-border bg-amber-50 dark:bg-amber-400/10 px-3 sm:px-4 py-3 rounded-xl sm:rounded-none">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-500" strokeWidth={2.5} />
            <p className="text-xs sm:text-sm text-amber-800 dark:text-amber-300 leading-relaxed">
              <strong>Disclaimer:</strong> Analisis AI ini mengombinasikan screening fundamental, teknikal, dan berita untuk tujuan edukasi. <strong>Bukan merupakan rekomendasi finansial langsung.</strong> Selalu terapkan manajemen risiko ketat dan pertimbangkan kondisi pasar sebelum mengambil keputusan investasi.
            </p>
          </div>

          {/* Footer Links */}
          <div className="flex items-center justify-center gap-3 pt-1 pb-4 text-xs font-semibold text-zinc-400 dark:text-zinc-600 flex-wrap">
            <a href={`https://finance.yahoo.com/quote/${summary.ticker}.JK`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-blue-500 transition-colors">
              Yahoo Finance <ExternalLink className="size-3" strokeWidth={2.5} />
            </a>
            <span>·</span>
            <a href={`https://www.idx.co.id/id/data-pasar/data-saham/daftar-saham/?kodeEmiten=${summary.ticker}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-blue-500 transition-colors">
              IDX.co.id <ExternalLink className="size-3" strokeWidth={2.5} />
            </a>
            <span>·</span>
            <span>{SITE_NAME}</span>
          </div>
        </div>

        {/* ── RIGHT SIDEBAR (desktop only — lg+) ──────────────────────── */}
        <aside className="hidden lg:block space-y-5 lg:sticky lg:top-20">
          <AiStockAdvisorSidebar advisor={displayAdvisor} />
          {/* <ScoringCard price={summary.lastClose} trendEma={trendEma} indicators={indicators} volume={volume} /> */}
          {/* <BandarDetectorCard summary={summary} bars={bars} brokerActivity={brokerActivity} brokerActivityLoading={brokerActivityLoading} /> */}
          <TradingPlanSidebarCard plan={tradingPlan} />
          <SimilarStocksSidebarCard current={summary} stocks={similarStocks} />
        </aside>

        {/* ── SIMILAR STOCKS (mobile — below main content) ────────────── */}
        {similarStocks.length > 0 && (
          <div className="lg:hidden px-3 sm:px-0 pb-4">
            <SimilarStocksSidebarCard current={summary} stocks={similarStocks} />
          </div>
        )}
      </main>
    </div>
  );
}
