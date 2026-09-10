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
import { useCallback, useMemo, useRef, useState } from 'react';
import { LINKS } from '@/lib/site';
import { StockSummary } from '@/domain/models/Stock';
import { OHLCVBar } from '@/domain/models/History';
import {
  CandlePattern,
  IndicatorAnalysis,
  PriceActionAnalysis,
  SupportResistanceAnalysis,
  TradingPlanAnalysis,
  TrendEmaAnalysis,
  VolumeAnalysis,
} from '@/domain/models/StockAnalysis';
import { StockNewsItem, NewsSentimentSummary, AiStockAdvisor } from '@/domain/models/News';
import { FundamentalDetail } from '@/domain/models/Fundamentals';
import { BrokerActivityDetail, BrokerSummaryRow } from '@/domain/models/BrokerSummary';
import { FundamentalScreeningResult } from '@/domain/analysis/aiStockEngine';
import { computeTechnicalScore } from '@/domain/analysis/technicalScore';
import { computeBandarScore } from '@/domain/analysis/bandarScore';
import { computeObjectiveConclusion, ConclusionTone, ObjectiveConclusionResult } from '@/domain/analysis/objectiveConclusion';
import { BreakoutScores } from '@/domain/screener/presets';
import { DataFreshness } from '@/domain/analysis/dataFreshness';
import { rsi } from '@/domain/indicators/rsi';
import { macd } from '@/domain/indicators/macd';
import { closes as barCloses, ema } from '@/domain/indicators/movingAverages';
import { cn, formatCompact, formatPercent, formatRupiah } from '@/lib/format';
import { SITE_NAME } from '@/lib/site';
import { useWatchlist } from '@/presentation/features/screener/hooks/useWatchlist';
import { useJournal } from '@/presentation/features/journal/hooks/useJournal';
import { PhilosophyBanner } from '@/presentation/features/screener/components/PhilosophyBanner';
import { useStockAnalysis } from './useStockAnalysis';
import { AiAnalystEngineCard } from './AiAnalystEngineCard';
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
}: {
  number?: number | string;
  title: string;
  icon: React.ReactNode;
  accentClass: string;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const showBody = !collapsible || isOpen;

  const header = (
    <div className={cn('flex items-center gap-3 px-5 py-4 border-b-[3px] border-(--neo-line)')}>
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
    </div>
  );

  return (
    <section className="neo-border neo-shadow overflow-hidden bg-white dark:bg-zinc-900">
      {collapsible ? (
        <button type="button" onClick={() => setIsOpen((v) => !v)} aria-expanded={isOpen} className="w-full text-left">
          {header}
        </button>
      ) : header}
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
            <p className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 leading-tight truncate">
              Fundamental · Teknikal · Berita · Breakout
            </p>
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
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-bold uppercase text-zinc-400">Risk Score</span>
          <span className={cn(
            'font-mono font-bold',
            advisor.riskLevel === 'HIGH' ? 'text-rose-600 dark:text-rose-400' : advisor.riskLevel === 'MEDIUM' ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
          )}>
            {advisor.riskScore}/100 · {advisor.riskLevel}
          </span>
        </div>
      </div>

      {/* Scores Breakdown, stacked */}
      <div className="space-y-2.5">
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
      </div>

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
      <div className="neo-border bg-white dark:bg-zinc-900 p-3 space-y-2">
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
      </div>

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

      <div className="space-y-2.5 pt-1">
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
      </div>
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

      <div className="space-y-2.5 pt-1">
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
      </div>

      <ul className="space-y-1 pt-1 border-t-2 border-(--neo-line)">
        {dataNotes.map((note) => (
          <Note key={note} text={note} tone="zinc" />
        ))}
      </ul>

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

// ─────────────────────────────────────────────────────────────────────────────
// 🧾 EQUITY RESEARCH REPORT — format 5 bagian, ringkas & scannable
// ─────────────────────────────────────────────────────────────────────────────
function EquityResearchReportCard({
  summary,
  advisor,
  trendEma,
  indicators,
  supportResistance,
  fundamentalScreening,
  fundamentals,
  fundamentalsLoading,
  newsItems,
  tradingPlan,
}: {
  summary: StockSummary;
  advisor: AiStockAdvisor;
  trendEma: TrendEmaAnalysis;
  indicators: IndicatorAnalysis;
  supportResistance: SupportResistanceAnalysis;
  fundamentalScreening: FundamentalScreeningResult;
  fundamentals: FundamentalDetail | null;
  fundamentalsLoading: boolean;
  newsItems: StockNewsItem[];
  tradingPlan: TradingPlanAnalysis;
}) {
  type Tone = 'green' | 'red' | 'amber' | 'blue' | 'zinc';

  const statusUtama: { label: string; tone: Tone } =
    advisor.verdictTone === 'green' ? { label: 'BULLISH', tone: 'green' } :
      advisor.verdictTone === 'red' ? { label: 'BEARISH', tone: 'red' } : { label: 'NEUTRAL', tone: 'amber' };

  const trenLabel = trendEma.trend === 'bullish' ? 'Uptrend' : trendEma.trend === 'bearish' ? 'Downtrend' : 'Sideways';
  const trenTone: Tone = trendEma.trend === 'bullish' ? 'green' : trendEma.trend === 'bearish' ? 'red' : 'amber';

  const rsiStatus: { label: string; tone: Tone } =
    indicators.rsiZone === 'oversold' ? { label: 'Oversold', tone: 'green' } :
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

  const nearestResistance = supportResistance.resistances[0];
  const nearestSupport = supportResistance.supports[0];

  const valuationTone = fundamentalScreening.perStatus.tone;
  const valuationLabel =
    valuationTone === 'green' ? 'Murah (Cheap)' : valuationTone === 'red' ? 'Mahal (Overvalued)' : 'Wajar (Fair Value)';

  const der = fundamentals?.debtToEquity ?? null;
  const solvencyLabel = der == null ? null : der <= 100 ? 'Solvent' : 'Berisiko (Risky)';
  const solvencyTone: Tone = der == null ? 'zinc' : der <= 100 ? 'green' : 'red';

  const topBullishNews = newsItems.find((n) => n.sentiment === 'bullish');
  const topBearishNews = newsItems.find((n) => n.sentiment === 'bearish');

  const bias = tradingPlan.recommendedBias === 'bearish' ? 'bearish' : 'bullish';
  const scenario = tradingPlan[bias];
  const strategiLabel =
    advisor.verdict === 'SANGAT_BELI' ? 'Buy on Weakness' :
      advisor.verdict === 'BELI' ? 'Accumulate Bertahap' :
        advisor.verdict === 'TAHAN' ? 'Wait and See' : 'Hindari / Take Profit';

  return (
    <SectionCard title="Equity Research Report" icon={<Sparkles className="size-4" />} accentClass="bg-violet-600">
      <div className="space-y-5">
        {/* 1. Ringkasan Instan */}
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-800 dark:text-zinc-200 mb-2">
            📊 1. Ringkasan Instan
          </h3>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-zinc-500 dark:text-zinc-400 shrink-0">Status Utama:</span>
              <Pill tone={statusUtama.tone}>{statusUtama.label}</Pill>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-zinc-500 dark:text-zinc-400 shrink-0">Skor AI:</span>
              <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">{advisor.compositeScore}/100</span>
            </div>
            <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
              <strong>Highlight:</strong> {advisor.executiveSummary}
            </p>
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
              <Pill tone={valuationTone}>{valuationLabel}</Pill>
              <span className="text-xs text-zinc-400">
                (PER {summary.per > 0 ? `${summary.per.toFixed(1)}×` : '–'} · PBV {summary.pbv > 0 ? `${summary.pbv.toFixed(2)}×` : '–'})
              </span>
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

        {/* 4. Sentimen & Isu Terkini */}
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-800 dark:text-zinc-200 mb-2">
            📰 4. Sentimen & Isu Terkini
          </h3>
          <ul className="space-y-1.5 text-sm">
            <li className="flex items-start gap-2">
              <Pill tone="green">Positif</Pill>
              <span className="text-zinc-600 dark:text-zinc-400 leading-snug">
                {topBullishNews ? topBullishNews.title : 'Belum ada berita positif signifikan terdeteksi.'}
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Pill tone="red">Negatif</Pill>
              <span className="text-zinc-600 dark:text-zinc-400 leading-snug">
                {topBearishNews ? topBearishNews.title : 'Tidak ada isu negatif signifikan terdeteksi.'}
              </span>
            </li>
          </ul>
        </div>

        <div className="h-[2px] bg-(--neo-line)" />

        {/* 5. Rencana Aksi */}
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-800 dark:text-zinc-200 mb-2">
            🎯 5. Rencana Aksi (Actionable Takeaways)
          </h3>
          <ul className="space-y-1.5 text-sm">
            <li className="flex items-center gap-2">
              <span className="text-zinc-500 dark:text-zinc-400 shrink-0">Strategi:</span>
              <span className="font-bold text-zinc-900 dark:text-zinc-100">{strategiLabel}</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-zinc-500 dark:text-zinc-400 shrink-0">Area Entry Ideal:</span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {fmtRp(nearestSupport ? nearestSupport.price : scenario.entry)} – {fmtRp(scenario.entry)}
              </span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-zinc-500 dark:text-zinc-400 shrink-0">Stop Loss (Risk Limit):</span>
              <span className="font-mono font-bold text-rose-600 dark:text-rose-400">{fmtRp(scenario.sl)}</span>
            </li>
          </ul>
        </div>
      </div>
    </SectionCard>
  );
}

// ─── Kesimpulan Objektif (cross-check: price move + divergence + Bandar + regulator) ──
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
  const rsiBadge: { label: string; tone: Tone } =
    indicators.rsiZone === 'oversold' ? { label: 'RSI Oversold', tone: 'green' } :
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
          advisor={advisor}
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
            {objectiveConclusion && <ObjectiveConclusionCard conclusion={objectiveConclusion} />}
          </div>

          {/* ── AI Analyst Engine (kecocokan profil Investor/Swing/Chasing) ── */}
          {/* <div className="px-3 sm:px-0">
            <AiAnalystEngineCard
              summary={summary}
              analysis={analysis}
              fundamentals={fundamentals}
              newsSummary={newsSummary}
              fundamentalScreening={fundamentalScreening}
              technicalScreening={technicalScreening}
            />
          </div> */}

          {/* Data Freshness warning */}
          {freshness && <DataFreshnessStaleBanner freshness={freshness} />}

          {/* ── MOBILE SIDEBAR CARDS ─────────────────────────────────────
              On mobile: AI Advisor, Scoring, Bandar, Trading Plan appear
              here (after chart, before tabs). On lg+ they move to the
              right sticky sidebar via CSS order. */}
          <div className="lg:hidden space-y-3 px-3 sm:px-0">
            <AiStockAdvisorSidebar advisor={advisor} />
            <TradingPlanSidebarCard plan={tradingPlan} />
            {/* <ScoringCard price={summary.lastClose} trendEma={trendEma} indicators={indicators} volume={volume} /> */}
            <BandarDetectorCard summary={summary} bars={bars} brokerActivity={brokerActivity} brokerActivityLoading={brokerActivityLoading} />
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
                <EquityResearchReportCard
                  summary={summary}
                  advisor={advisor}
                  trendEma={trendEma}
                  indicators={indicators}
                  supportResistance={supportResistance}
                  fundamentalScreening={fundamentalScreening}
                  fundamentals={fundamentals}
                  fundamentalsLoading={fundamentalsLoading}
                  newsItems={newsItems}
                  tradingPlan={tradingPlan}
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
          <div className="px-3 sm:px-0">
            <PhilosophyBanner />
          </div>

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
          <AiStockAdvisorSidebar advisor={advisor} />
          {/* <ScoringCard price={summary.lastClose} trendEma={trendEma} indicators={indicators} volume={volume} /> */}
          <BandarDetectorCard summary={summary} bars={bars} brokerActivity={brokerActivity} brokerActivityLoading={brokerActivityLoading} />
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
