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
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Compass,
  Crosshair,
  ExternalLink,
  Eye,
  HelpCircle,
  History,
  Info,
  Loader2,
  Newspaper,
  PieChart,
  RefreshCw,
  Rocket,
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
import { useCallback, useMemo, useState } from 'react';
import { StockSummary } from '@/domain/models/Stock';
import { OHLCVBar } from '@/domain/models/History';
import {
  CandlePattern,
  IndicatorAnalysis,
  PriceActionAnalysis,
  TradingPlanAnalysis,
  TrendEmaAnalysis,
  VolumeAnalysis,
} from '@/domain/models/StockAnalysis';
import { StockNewsItem, NewsSentimentSummary, AiStockAdvisor } from '@/domain/models/News';
import { FundamentalDetail } from '@/domain/models/Fundamentals';
import { FundamentalScreeningResult } from '@/domain/analysis/aiStockEngine';
import { computeTechnicalScore } from '@/domain/analysis/technicalScore';
import { computeBandarScore } from '@/domain/analysis/bandarScore';
import { computeObjectiveConclusion, ConclusionTone, ObjectiveConclusionResult } from '@/domain/analysis/objectiveConclusion';
import { BreakoutScores } from '@/domain/screener/presets';
import { cn, formatCompact, formatPercent, formatRupiah } from '@/lib/format';
import { SITE_NAME } from '@/lib/site';
import { useWatchlist } from '@/presentation/features/screener/hooks/useWatchlist';
import { PhilosophyBanner } from '@/presentation/features/screener/components/PhilosophyBanner';
import { useStockAnalysis } from './useStockAnalysis';
import { DataFreshnessPill, DataFreshnessStaleBanner } from './DataFreshnessBanner';
import { OHLCVChart } from './OHLCVChart';

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
}: {
  number?: number | string;
  title: string;
  icon: React.ReactNode;
  accentClass: string;
  children: React.ReactNode;
}) {
  return (
    <section className="neo-border neo-shadow overflow-hidden bg-white dark:bg-zinc-900">
      <div className={cn('flex items-center gap-3 px-5 py-4 border-b-[3px] border-(--neo-line)')}>
        <span className={cn('flex size-9 shrink-0 items-center justify-center neo-border text-white text-sm', accentClass)}>
          {icon}
        </span>
        <h2 className="font-bold uppercase tracking-wide text-zinc-800 dark:text-zinc-100 flex items-center gap-1.5">
          {number !== undefined && <span className="text-zinc-400 dark:text-zinc-600 mr-1.5">{number}.</span>}
          {title}
        </h2>
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

// ─── Key-Value Row ─────────────────────────────────────────────────────────────
function KV({ label, value, valueClass }: { label: string; value: React.ReactNode; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm py-1">
      <span className="text-zinc-500 dark:text-zinc-400 shrink-0">{label}</span>
      <span className={cn('font-mono tabular-nums text-zinc-800 dark:text-zinc-200 text-right', valueClass)}>
        {value}
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
        <div className="grid grid-cols-2 gap-x-6 px-4 py-3">
          <KV label="Entry" value={fmtRp(entry)} />
          {avgDown != null && <KV label="Add / AVGD" value={fmtRp(avgDown)} valueClass="text-amber-600 dark:text-amber-400" />}
          <KV label="TP 1" value={fmtRp(tp1)} valueClass="text-emerald-600 dark:text-emerald-400" />
          <KV label="TP 2" value={fmtRp(tp2)} valueClass="text-emerald-600 dark:text-emerald-400" />
          <KV label="Stop Loss" value={fmtRp(sl)} valueClass="text-rose-600 dark:text-rose-400" />
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
function BandarDetectorCard({ summary, bars }: { summary: StockSummary; bars: OHLCVBar[] }) {
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
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 🎯 TRADING PLAN SUMMARY (sidebar, compact single-column version of ScenarioCard)
// ─────────────────────────────────────────────────────────────────────────────
function TradingPlanSidebarCard({ plan }: { plan: TradingPlanAnalysis }) {
  const bias = plan.recommendedBias === 'bearish' ? 'bearish' : 'bullish';
  const scenario = plan[bias];
  const isBull = bias === 'bullish';
  const Icon = isBull ? TrendingUp : TrendingDown;

  return (
    <div className="neo-border neo-shadow bg-white dark:bg-zinc-900 p-4 space-y-3">
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
          {plan.recommendedBias === 'neutral' ? 'Netral' : isBull ? 'Bullish' : 'Bearish'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <KV label="Entry" value={fmtRp(scenario.entry)} />
        {scenario.avgDown != null && (
          <KV label="Add / AVGD" value={fmtRp(scenario.avgDown)} valueClass="text-amber-600 dark:text-amber-400" />
        )}
        <KV label="TP 1" value={fmtRp(scenario.tp1)} valueClass="text-emerald-600 dark:text-emerald-400" />
        <KV label="TP 2" value={fmtRp(scenario.tp2)} valueClass="text-emerald-600 dark:text-emerald-400" />
        <KV label="Stop Loss" value={fmtRp(scenario.sl)} valueClass="text-rose-600 dark:text-rose-400" />
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
function SimilarStocksSidebarCard({ stocks }: { stocks: StockSummary[] }) {
  if (stocks.length === 0) return null;

  return (
    <div className="neo-border neo-shadow bg-white dark:bg-zinc-900 p-4 space-y-2">
      <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
        <PieChart className="size-4 text-zinc-400" strokeWidth={2.5} />
        Saham Sejenis
      </h3>
      <ul className="space-y-1.5">
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
// 📊 FUNDAMENTAL SCREENING SECTION
// ─────────────────────────────────────────────────────────────────────────────
function FundamentalSection({
  summary,
  screening,
  fundamentals,
  fundamentalsLoading,
}: {
  summary: StockSummary;
  screening: FundamentalScreeningResult;
  fundamentals: FundamentalDetail | null;
  fundamentalsLoading: boolean;
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

      {/* Dividen */}
      <div className="border-t-2 border-(--neo-line) pt-4">
        <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-zinc-700 dark:text-zinc-300">
          <History className="size-4 text-zinc-400" strokeWidth={2.5} />
          Dividen
        </h3>

        {fundamentalsLoading ? (
          <div className="flex items-center gap-2 py-3 text-sm font-semibold text-zinc-400">
            <Loader2 className="size-4 animate-spin" strokeWidth={2.5} /> Memuat data dividen…
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 mb-3 sm:grid-cols-4">
              <div className="neo-border bg-zinc-50 dark:bg-zinc-900/60 px-3 py-3 text-center">
                <div className="text-sm font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">Forward Dividend & Yield</div>
                <div className="mt-1 font-mono text-sm font-bold text-zinc-800 dark:text-zinc-100">
                  {fundamentals?.dividendRate != null
                    ? `${fmtRp(fundamentals.dividendRate)}${fundamentals.dividendYield != null ? ` (${fundamentals.dividendYield.toFixed(2)}%)` : ''}`
                    : '–'}
                </div>
              </div>
              <div className="neo-border bg-zinc-50 dark:bg-zinc-900/60 px-3 py-3 text-center">
                <div className="text-sm font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">Ex-Dividend Date</div>
                <div className="mt-1 font-mono text-sm font-bold text-zinc-800 dark:text-zinc-100">
                  {fundamentals?.exDividendDate
                    ? new Date(fundamentals.exDividendDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
                    : '–'}
                </div>
              </div>
              <div className="neo-border bg-zinc-50 dark:bg-zinc-900/60 px-3 py-3 text-center">
                <div className="text-sm font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">Dividen (TTM)</div>
                <div className="mt-1 font-mono text-sm font-bold text-zinc-800 dark:text-zinc-100">
                  {fundamentals?.dividendPerShareTtm != null ? fmtRp(fundamentals.dividendPerShareTtm) : '–'}
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
          </>
        )}
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
function TrendEmaSection({ number, trendEma, isBullish, isBearish }: {
  number: number; trendEma: TrendEmaAnalysis; isBullish: boolean; isBearish: boolean;
}) {
  return (
    <SectionCard number={number} title="Trend & EMA" icon={<TrendingUp className="size-4" />} accentClass="bg-blue-500">
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

function IndicatorsSection({ number, indicators }: { number: number; indicators: IndicatorAnalysis }) {
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
// MAIN PAGE COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
type AnalysisTab = 'ai_summary' | 'teknikal' | 'fundamental' | 'berita' | 'breakout';

const ANALYSIS_TABS: { key: AnalysisTab; label: string; icon: React.ReactNode }[] = [
  { key: 'teknikal', label: 'Screening Teknikal', icon: <TrendingUp className="size-4" /> },
  { key: 'fundamental', label: 'Screening Fundamental', icon: <PieChart className="size-4" /> },
  { key: 'berita', label: 'Analisis Berita', icon: <Newspaper className="size-4" /> },
];

const LINKS = [
  { href: '/tutorial', label: 'Tutorial', icon: Compass },
  { href: '/panduan', label: 'Panduan', icon: BookOpen },
  { href: '/tentang', label: 'Tentang', icon: Info },
] as const;

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
    reload: load,
  } = useStockAnalysis(ticker);
  const [justCopied, setJustCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<AnalysisTab>('berita');
  const watchlist = useWatchlist();

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
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white dark:bg-zinc-950">
        <div className="flex items-center gap-3">
          <Loader2 className="size-6 animate-spin text-emerald-500" />
          <span className="text-zinc-500 dark:text-zinc-400">Menganalisis {ticker.toUpperCase()} (Teknikal, Fundamental, Berita & AI)…</span>
        </div>
      </div>
    );
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
      {/* Header Bar */}
      <header className="sticky top-0 z-20 neo-border border-x-0 border-t-0 bg-white dark:bg-zinc-950">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link
            href="/screener"
            className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            aria-label="Kembali ke screener"
          >
            <ArrowLeft className="size-4" strokeWidth={2.5} />
            <span className="hidden sm:inline">Screener</span>
          </Link>

          <div className="h-5 w-[3px] bg-(--neo-line)" />

          <div className="flex items-center gap-2 min-w-0">
            <span className="font-bold text-zinc-900 dark:text-zinc-100 text-lg">{summary.ticker}</span>
            <span className="hidden truncate text-sm font-medium text-zinc-500 dark:text-zinc-400 sm:inline">{summary.name}</span>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <nav className="flex items-center gap-1.5">
              {LINKS.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={'flex items-center gap-1.5 border-2 border-transparent px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-zinc-500 transition-colors hover:border-(--neo-line) dark:text-zinc-400'}
                >
                  <Icon className="size-3.5" strokeWidth={2.5} />
                  <span className="hidden sm:inline">{label}</span>
                </Link>
              ))}
            </nav>
            <button
              type="button"
              onClick={() => load(true)}
              title="Perbarui & muat ulang data"
              className="neo-press flex size-9 items-center justify-center neo-border neo-shadow-sm bg-white text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"
            >
              <RefreshCw className="size-4" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 pb-16 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6 lg:items-start">
        <div className="space-y-5 min-w-0">
          {/* Ticker Identity Card */}
          <div className="neo-border neo-shadow bg-white dark:bg-zinc-900 p-5 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                    {summary.name} ({summary.ticker})
                  </h1>
                  <Pill tone="zinc">{summary.sector || 'Sektor BEI'}</Pill>
                </div>
                <div className="flex flex-wrap gap-x-4 text-sm sm:text-sm font-medium text-zinc-500 dark:text-zinc-400 mt-1">
                  <span>Market Cap: <strong>{formatCompact(summary.capitalization)}</strong></span>
                  <span>Avg Vol 20D: <strong>{formatCompact(volume.volumeMa20)} lembar</strong></span>
                </div>
                {freshness && <DataFreshnessPill freshness={freshness} />}
              </div>

              <div className="flex flex-col items-end gap-2 shrink-0">
                <div className="flex items-center gap-2">
                  {/* <Link
                    href={`/history/${summary.ticker}`}
                    className="neo-press flex items-center gap-1.5 px-3 py-1.5 neo-border neo-shadow-sm bg-white text-sm font-bold text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"
                  >
                    <History className="size-3.5" strokeWidth={2.5} /> Riwayat Teknikal
                  </Link> */}
                  <button
                    type="button"
                    onClick={handleShare}
                    className="neo-press flex items-center gap-1.5 px-3 py-1.5 neo-border neo-shadow-sm bg-white text-sm font-bold text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"
                  >
                    <Share2 className="size-3.5" strokeWidth={2.5} /> {justCopied ? 'Tautan Disalin!' : 'Bagikan'}
                  </button>
                  <button
                    type="button"
                    onClick={() => watchlist.toggle(summary.ticker)}
                    className={cn(
                      'neo-press flex items-center gap-1.5 px-3 py-1.5 neo-border neo-shadow-sm text-sm font-bold transition-colors',
                      isWatched ? 'bg-amber-300 text-black' : 'bg-white text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300'
                    )}
                  >
                    {isWatched ? <BookmarkCheck className="size-3.5" strokeWidth={2.5} /> : <Bookmark className="size-3.5" strokeWidth={2.5} />}
                    {isWatched ? 'Watching' : 'Watch'}
                  </button>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-2xl sm:text-3xl font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                    {formatRupiah(summary.lastClose)}
                  </span>
                  <span className={cn(
                    'inline-flex items-center gap-1 text-base sm:text-lg font-mono tabular-nums font-bold',
                    positiveDay ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                  )}>
                    {positiveDay ? <TrendingUp className="size-5" strokeWidth={2.5} /> : <TrendingDown className="size-5" strokeWidth={2.5} />}
                    {formatPercent(summary.percentChange1D)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* OHLCV Chart */}
          {bars.length > 0 && (
            <OHLCVChart bars={bars} currentClose={summary.lastClose} ticker={summary.ticker} prevClose={summary.prevClose} />
          )}

          {/* Kesimpulan Objektif — cross-check di luar skor AI Advisor */}
          {objectiveConclusion && <ObjectiveConclusionCard conclusion={objectiveConclusion} />}

          {/* Data Freshness warning — shown only when the last available bar is 3+ trading days old */}
          {freshness && <DataFreshnessStaleBanner freshness={freshness} />}

          <div className="space-y-5">
            {/* Quick Link to Deep Dive Tabs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={() => setActiveTab('berita')}
                className="neo-press p-4 neo-border neo-shadow-sm bg-white dark:bg-zinc-900 text-left space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold uppercase text-zinc-500">1. Analisis Berita</span>
                  <span className="text-sm font-bold text-blue-600">
                    {newsSummary.netSentimentScore}%
                  </span>
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-300 font-semibold">
                  {newsSummary.totalNews} Artikel ({newsSummary.overallSentiment.toUpperCase()})
                </p>
              </button>

              <button
                onClick={() => setActiveTab('fundamental')}
                className="neo-press p-4 neo-border neo-shadow-sm bg-white dark:bg-zinc-900 text-left space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold uppercase text-zinc-500">2. Screening Fundamental</span>
                  <span className={cn('text-sm font-bold', fundamentalScreening.passed ? 'text-emerald-600' : 'text-amber-600')}>
                    {fundamentalScreening.score}/100
                  </span>
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-300 font-semibold">
                  {fundamentalScreening.statusText}
                </p>
              </button>

              <button
                onClick={() => setActiveTab('teknikal')}
                className="neo-press p-4 neo-border neo-shadow-sm bg-white dark:bg-zinc-900 text-left space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold uppercase text-zinc-500">3. Screening Teknikal</span>
                  <span className={cn('text-sm font-bold', technicalScreening.passed ? 'text-emerald-600' : 'text-amber-600')}>
                    {technicalScreening.score}/100
                  </span>
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-300 font-semibold">
                  {technicalScreening.statusText}
                </p>
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex flex-wrap gap-1.5 neo-border neo-shadow-sm bg-white dark:bg-zinc-900 p-1.5" role="tablist">
            {ANALYSIS_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'flex-1 min-w-[120px] flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm sm:text-sm font-bold uppercase tracking-wide transition-all',
                  activeTab === tab.key
                    ? 'bg-(--neo-accent) text-black'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── TAB CONTENT ─────────────────────────────────────────────────── */}

          {/* Tab 2: Screening & Analisis Teknikal */}
          {activeTab === 'teknikal' && (
            <div className="space-y-5">
              {/* Technical Screening Status Header */}
              <div className={cn(
                'neo-border neo-shadow-sm p-4 flex items-center justify-between gap-3',
                technicalScreening.passed
                  ? 'bg-emerald-50 dark:bg-emerald-500/10'
                  : 'bg-amber-50 dark:bg-amber-500/10'
              )}>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-zinc-900 dark:text-zinc-100">
                    {technicalScreening.statusText}
                  </h3>
                  <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                    Evaluasi Tren, Momentum MACD/RSI, Price Action & Volume Akumulasi
                  </p>
                </div>
                <span className="font-mono text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {technicalScreening.score}/100
                </span>
              </div>

              <TrendEmaSection number={1} trendEma={trendEma} isBullish={isBullish} isBearish={isBearish} />

              {/* Level Penting */}
              <SectionCard number={2} title="Level Penting (Resistance & Support)" icon={<Crosshair className="size-4" />} accentClass="bg-violet-500">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold uppercase tracking-wide text-rose-600 dark:text-rose-400 mb-2">
                      Resistance
                    </p>
                    {supportResistance.resistances.length > 0
                      ? supportResistance.resistances.map((r) => (
                        <LevelRow key={r.label} label={r.label} price={r.price} description={r.description} tone="red" />
                      ))
                      : <p className="text-sm text-zinc-400">Tidak terdeteksi.</p>}
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 mb-2">
                      Support
                    </p>
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
              <IndicatorsSection number={5} indicators={indicators} />

              {/* Rencana Trading */}
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

          {/* Tab 3: Screening & Analisis Fundamental */}
          {activeTab === 'fundamental' && (
            <FundamentalSection
              summary={summary}
              screening={fundamentalScreening}
              fundamentals={fundamentals}
              fundamentalsLoading={fundamentalsLoading}
            />
          )}

          {/* Tab 4: Analisis Berita & Sentimen */}
          {activeTab === 'berita' && (
            <NewsSection newsItems={newsItems} newsSummary={newsSummary} loading={newsLoading} />
          )}

          {/* Tab 5: Breakout Hunter AI */}
          {activeTab === 'breakout' && (
            <BreakoutHunterSection ticker={summary.ticker} scores={breakoutScores} />
          )}

          {/* Philosophy Banner */}
          <PhilosophyBanner />

          {/* Disclaimer */}
          <div className="flex gap-2.5 neo-border bg-amber-50 dark:bg-amber-400/10 px-4 py-3">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-500" strokeWidth={2.5} />
            <p className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed">
              <strong>Disclaimer:</strong> Analisis AI ini mengombinasikan screening fundamental, teknikal, dan berita untuk tujuan edukasi. <strong>Bukan merupakan rekomendasi finansial langsung.</strong> Selalu terapkan manajemen risiko ketat dan pertimbangkan kondisi pasar sebelum mengambil keputusan investasi.
            </p>
          </div>

          {/* Footer Links */}
          <div className="flex items-center justify-center gap-3 pt-2 text-sm font-semibold text-zinc-400 dark:text-zinc-600">
            <a
              href={`https://finance.yahoo.com/quote/${summary.ticker}.JK`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-blue-500 transition-colors"
            >
              Yahoo Finance <ExternalLink className="size-3" strokeWidth={2.5} />
            </a>
            <span>·</span>
            <a
              href={`https://www.idx.co.id/id/data-pasar/data-saham/daftar-saham/?kodeEmiten=${summary.ticker}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-blue-500 transition-colors"
            >
              IDX.co.id <ExternalLink className="size-3" strokeWidth={2.5} />
            </a>
            <span>·</span>
            <span>{SITE_NAME}</span>
          </div>
        </div>

        {/* Right Sidebar: AI Stock Advisor, Trading Plan Summary, Similar Stocks */}
        <aside className="space-y-5 lg:sticky lg:top-20">
          <AiStockAdvisorSidebar advisor={advisor} />
          <ScoringCard price={summary.lastClose} trendEma={trendEma} indicators={indicators} volume={volume} />
          <BandarDetectorCard summary={summary} bars={bars} />
          <TradingPlanSidebarCard plan={tradingPlan} />
          <SimilarStocksSidebarCard stocks={similarStocks} />
        </aside>
      </main>
    </div>
  );
}
