'use client';

/**
 * StockAnalysisPage.tsx
 *
 * Comprehensive Stock Analysis Page combining:
 * 1. Fundamental Screening (PER, PBV, ROE, Market Cap, Solvency)
 * 2. Technical Screening (Trend, EMA, S/R, Price Action, RVOL, Indicators)
 * 3. News & Market Sentiment Analysis (Live RSS / Google News / Yahoo Finance)
 * 4. AI Decision Engine (AI Buy/Avoid Advisor with Reasons to Buy & Reasons to Avoid)
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
  Crosshair,
  ExternalLink,
  HelpCircle,
  Loader2,
  Newspaper,
  PieChart,
  RefreshCw,
  Rocket,
  Share2,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  XCircle,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import { OHLCVBar } from '@/domain/models/History';
import { StockSummary } from '@/domain/models/Stock';
import {
  CandlePattern,
  IndicatorAnalysis,
  PriceActionAnalysis,
  StockAnalysis,
  TrendEmaAnalysis,
  VolumeAnalysis,
} from '@/domain/models/StockAnalysis';
import { computeStockAnalysis } from '@/domain/analysis/stockAnalysisEngine';
import { BreakoutScores, computeBreakoutScores } from '@/domain/screener/presets';
import { getStockHistory, getStockSummaries } from '@/data/repositories/StockRepository';
import { getStockNews } from '@/data/repositories/newsRepository';
import { StockNewsItem, NewsSentimentSummary, AiStockAdvisor } from '@/domain/models/News';
import {
  computeAiStockAdvisor,
  FundamentalScreeningResult,
  TechnicalScreeningResult,
} from '@/domain/analysis/aiStockEngine';
import { cn, formatCompact, formatPercent, formatRupiah } from '@/lib/format';
import { SITE_NAME } from '@/lib/site';
import { useWatchlist } from '@/presentation/features/screener/hooks/useWatchlist';
import { PhilosophyBanner } from '@/presentation/features/screener/components/PhilosophyBanner';
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
    green: 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-400/10 dark:text-emerald-300 dark:border-emerald-400/20',
    red: 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-400/10 dark:text-rose-300 dark:border-rose-400/20',
    amber: 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-400/10 dark:text-amber-300 dark:border-amber-400/20',
    blue: 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-400/10 dark:text-blue-300 dark:border-blue-400/20',
    zinc: 'bg-zinc-100 text-zinc-600 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700',
  };
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', map[tone])}>
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
    <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-900/40">
      <div className={cn('flex items-center gap-3 px-5 py-4 border-b border-zinc-100 dark:border-zinc-800')}>
        <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-xl text-white text-sm', accentClass)}>
          {icon}
        </span>
        <h2 className="font-semibold text-zinc-800 dark:text-zinc-100 flex items-center gap-1.5">
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
    ? 'bg-rose-50 border-rose-200 dark:bg-rose-400/5 dark:border-rose-400/20'
    : 'bg-emerald-50 border-emerald-200 dark:bg-emerald-400/5 dark:border-emerald-400/20';
  const labelColor = tone === 'red'
    ? 'text-rose-600 dark:text-rose-400'
    : 'text-emerald-600 dark:text-emerald-400';
  return (
    <div className={cn('flex items-center justify-between gap-4 rounded-xl border px-4 py-2.5', bg)}>
      <div className="flex items-center gap-3">
        <span className={cn('w-7 text-center text-sm font-bold', labelColor)}>{label}</span>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">{description}</span>
      </div>
      <span className="font-mono text-base tabular-nums font-semibold text-zinc-800 dark:text-zinc-200">
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
      <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800 relative">
        <div className="absolute inset-y-0 left-[30%] w-px bg-zinc-300/60 dark:bg-zinc-600/60" />
        <div className="absolute inset-y-0 left-[55%] w-px bg-zinc-300/60 dark:bg-zinc-600/60" />
        <div className="absolute inset-y-0 left-[70%] w-px bg-zinc-300/60 dark:bg-zinc-600/60" />
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-[11px] text-zinc-400 dark:text-zinc-500 px-0.5">
        <span>0</span><span>30 OS</span><span>55</span><span>70 OB</span><span>100</span>
      </div>
    </div>
  );
}

// ─── Scenario Card ────────────────────────────────────────────────────────────
function ScenarioCard({ type, entry, tp1, tp2, sl, rr, notes }: {
  type: 'bullish' | 'bearish';
  entry: number; tp1: number; tp2: number; sl: number; rr: number; notes: string;
}) {
  const isBull = type === 'bullish';
  const Icon = isBull ? TrendingUp : TrendingDown;
  const headerBg = isBull ? 'bg-emerald-500 dark:bg-emerald-600' : 'bg-rose-500 dark:bg-rose-600';
  const borderColor = isBull
    ? 'border-emerald-200 dark:border-emerald-400/20'
    : 'border-rose-200 dark:border-rose-400/20';

  return (
    <div className={cn('rounded-xl border overflow-hidden', borderColor)}>
      <div className={cn('flex items-center gap-2 px-4 py-3 text-white font-semibold', headerBg)}>
        <Icon className="size-4" />
        Skenario {isBull ? 'Bullish ✓' : 'Bearish ✗'}
      </div>
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        <div className="grid grid-cols-2 gap-x-6 px-4 py-3">
          <KV label="Entry" value={fmtRp(entry)} />
          <KV label="TP 1" value={fmtRp(tp1)} valueClass="text-emerald-600 dark:text-emerald-400" />
          <KV label="TP 2" value={fmtRp(tp2)} valueClass="text-emerald-600 dark:text-emerald-400" />
          <KV label="Stop Loss" value={fmtRp(sl)} valueClass="text-rose-600 dark:text-rose-400" />
        </div>
        <div className="px-4 py-3 flex items-center gap-3">
          <span className="text-sm text-zinc-500 dark:text-zinc-400">Risk / Reward</span>
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
function AiStockAdvisorHero({ advisor }: { advisor: AiStockAdvisor }) {
  const verdictBgMap = {
    green: 'border-emerald-300 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent dark:border-emerald-500/30',
    amber: 'border-amber-300 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent dark:border-amber-500/30',
    red: 'border-rose-300 bg-gradient-to-br from-rose-500/10 via-rose-500/5 to-transparent dark:border-rose-500/30',
    blue: 'border-blue-300 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent dark:border-blue-500/30',
  };

  const badgeBgMap = {
    green: 'bg-emerald-600 text-white',
    amber: 'bg-amber-500 text-white',
    red: 'bg-rose-600 text-white',
    blue: 'bg-blue-600 text-white',
  };

  return (
    <div className={cn('rounded-2xl border p-5 sm:p-6 space-y-5 transition-all shadow-sm', verdictBgMap[advisor.verdictTone])}>
      {/* Top Title & Verdict Badge */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200/80 dark:border-zinc-800 pb-4">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
            <Sparkles className="size-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              AI Decision & Stock Advisor
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Sintesis Multi-Dimensi: Fundamental, Teknikal, Berita & Breakout Hunter
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={cn('rounded-xl px-4 py-1.5 text-xs sm:text-sm font-bold tracking-wide shadow-sm', badgeBgMap[advisor.verdictTone])}>
            {advisor.verdictLabel}
          </span>
          <div className="text-right hidden sm:block">
            <div className="text-xs text-zinc-400">AI Confidence</div>
            <div className="font-mono text-sm font-bold text-zinc-800 dark:text-zinc-200">
              {advisor.confidenceScore}%
            </div>
          </div>
        </div>
      </div>

      {/* 4 Scores Breakdown Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Screening Fundamental', score: advisor.fundamentalScore, weight: '30%' },
          { label: 'Screening Teknikal', score: advisor.technicalScore, weight: '35%' },
          { label: 'Sentimen Berita', score: advisor.newsScore, weight: '15%' },
          { label: 'Breakout Hunter AI', score: advisor.breakoutScore, weight: '20%' },
        ].map((item) => (
          <div key={item.label} className="rounded-xl bg-white/80 dark:bg-zinc-900/70 border border-zinc-200/60 dark:border-zinc-800 p-3">
            <div className="flex justify-between items-center text-xs text-zinc-500 dark:text-zinc-400 mb-1">
              <span className="truncate">{item.label}</span>
              <span className="text-[10px] opacity-70">({item.weight})</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className={cn(
                'font-mono text-lg font-bold',
                item.score >= 70 ? 'text-emerald-600 dark:text-emerald-400' : item.score >= 45 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'
              )}>
                {item.score}<span className="text-xs text-zinc-400 font-normal">/100</span>
              </span>
            </div>
            <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden mt-1.5">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  item.score >= 70 ? 'bg-emerald-500' : item.score >= 45 ? 'bg-amber-400' : 'bg-rose-500'
                )}
                style={{ width: `${item.score}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* 2-Column: Reasons to Buy vs Reasons to Avoid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Reasons to Buy */}
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-500/5 p-4 space-y-3">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-semibold text-sm border-b border-emerald-200/60 dark:border-emerald-500/20 pb-2">
            <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            Alasan Mengapa Harus Membeli (Buy Catalysts)
          </div>
          <ul className="space-y-2">
            {advisor.buyReasons.map((reason, idx) => (
              <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                <span className="shrink-0 text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">✓</span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Reasons to Avoid */}
        <div className="rounded-xl border border-rose-200 dark:border-rose-500/20 bg-rose-50/50 dark:bg-rose-500/5 p-4 space-y-3">
          <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-semibold text-sm border-b border-rose-200/60 dark:border-rose-500/20 pb-2">
            <XCircle className="size-4 shrink-0 text-rose-600 dark:text-rose-400" />
            Alasan Mengapa Harus Menghindari (Bearish Risks)
          </div>
          <ul className="space-y-2">
            {advisor.avoidReasons.map((reason, idx) => (
              <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                <span className="shrink-0 text-rose-600 dark:text-rose-400 font-bold mt-0.5">⚠️</span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Executive Summary & Actionable Trade Plan */}
      <div className="rounded-xl bg-white/90 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 p-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Rangkuman Eksekutif & Rekomendasi Eksekusi
        </p>
        <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
          {advisor.executiveSummary}
        </p>
        <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-start gap-2">
          <Target className="size-4 text-emerald-500 mt-0.5 shrink-0" />
          <p className="text-xs sm:text-sm font-medium text-emerald-700 dark:text-emerald-400 leading-relaxed">
            {advisor.tradingRecommendation}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 📊 FUNDAMENTAL SCREENING SECTION
// ─────────────────────────────────────────────────────────────────────────────
function FundamentalSection({
  summary,
  screening,
}: {
  summary: StockSummary;
  screening: FundamentalScreeningResult;
}) {
  const { per, pbv, roe } = summary;

  const toneBg = {
    green: 'border-emerald-200 bg-emerald-50 dark:border-emerald-400/20 dark:bg-emerald-400/5',
    amber: 'border-amber-200 bg-amber-50 dark:border-amber-400/20 dark:bg-amber-400/5',
    red: 'border-rose-200 bg-rose-50 dark:border-rose-400/20 dark:bg-rose-400/5',
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
        'rounded-xl border p-4 mb-4 flex items-center justify-between gap-3',
        screening.passed
          ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/10'
          : 'border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/10'
      )}>
        <div className="flex items-center gap-3">
          <span className={cn('text-2xl', screening.passed ? 'text-emerald-500' : 'text-amber-500')}>
            {screening.passed ? '✅' : '⚠️'}
          </span>
          <div>
            <h3 className={cn('font-bold text-sm sm:text-base', screening.passed ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300')}>
              {screening.statusText}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
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
        <div className="rounded-xl bg-zinc-50 dark:bg-zinc-900/60 px-4 py-3 text-center border border-zinc-100 dark:border-zinc-800">
          <div className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">Market Cap</div>
          <div className="mt-1 font-mono text-sm font-semibold text-zinc-800 dark:text-zinc-100">{formatCompact(summary.capitalization)}</div>
        </div>
        <div className="rounded-xl bg-zinc-50 dark:bg-zinc-900/60 px-4 py-3 text-center border border-zinc-100 dark:border-zinc-800">
          <div className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">PER (Valuasi)</div>
          <div className="mt-1 font-mono text-sm font-semibold text-zinc-800 dark:text-zinc-100">{per > 0 ? `${per.toFixed(1)}×` : '–'}</div>
        </div>
        <div className="rounded-xl bg-zinc-50 dark:bg-zinc-900/60 px-4 py-3 text-center border border-zinc-100 dark:border-zinc-800">
          <div className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">PBV (Rasio Aset)</div>
          <div className="mt-1 font-mono text-sm font-semibold text-zinc-800 dark:text-zinc-100">{pbv > 0 ? `${pbv.toFixed(2)}×` : '–'}</div>
        </div>
        <div className="rounded-xl bg-zinc-50 dark:bg-zinc-900/60 px-4 py-3 text-center border border-zinc-100 dark:border-zinc-800">
          <div className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">ROE (Profitabilitas)</div>
          <div className="mt-1 font-mono text-sm font-semibold text-zinc-800 dark:text-zinc-100">{roe !== 0 ? `${roe.toFixed(1)}%` : '–'}</div>
        </div>
      </div>

      {/* Detail Screening Rows */}
      <div className="space-y-2.5 mb-4">
        {statusList.map((item) => (
          <div key={item.label} className={cn('rounded-xl border px-4 py-3', toneBg[item.tone])}>
            <div className="flex justify-between items-center">
              <span className={cn('text-sm font-semibold', toneText[item.tone])}>{item.label}</span>
            </div>
            <p className="text-xs mt-1 text-zinc-600 dark:text-zinc-400 leading-relaxed">{item.detail}</p>
          </div>
        ))}
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
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 p-4 mb-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
              Meteran Sentimen Publik & Berita
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Berdasarkan {newsSummary.totalNews} artikel berita pasar modal terkini
            </p>
          </div>
          <Pill tone={newsSummary.overallSentiment === 'bullish' ? 'green' : newsSummary.overallSentiment === 'bearish' ? 'red' : 'amber'}>
            Sentimen: {newsSummary.overallSentiment.toUpperCase()} ({newsSummary.netSentimentScore}%)
          </Pill>
        </div>

        {/* Meter progress bar */}
        <div className="space-y-1">
          <div className="h-2.5 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div className={cn('h-full rounded-full transition-all', sentimentMeterColor)} style={{ width: `${newsSummary.netSentimentScore}%` }} />
          </div>
          <div className="flex justify-between text-[11px] text-zinc-400">
            <span>0% Bearish</span>
            <span>50% Neutral</span>
            <span>100% Bullish</span>
          </div>
        </div>

        {/* News breakdown counts */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-zinc-200/60 dark:border-zinc-800 text-center">
          <div>
            <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">🟢 Bullish</div>
            <div className="font-mono text-sm font-bold text-zinc-800 dark:text-zinc-200">{newsSummary.bullishCount} Artikel</div>
          </div>
          <div>
            <div className="text-xs text-amber-600 dark:text-amber-400 font-semibold">🟡 Netral</div>
            <div className="font-mono text-sm font-bold text-zinc-800 dark:text-zinc-200">{newsSummary.neutralCount} Artikel</div>
          </div>
          <div>
            <div className="text-xs text-rose-600 dark:text-rose-400 font-semibold">🔴 Bearish</div>
            <div className="font-mono text-sm font-bold text-zinc-800 dark:text-zinc-200">{newsSummary.bearishCount} Artikel</div>
          </div>
        </div>
      </div>

      {/* News Feed List */}
      {loading ? (
        <div className="flex items-center justify-center py-8 gap-2 text-zinc-400 text-sm">
          <Loader2 className="size-4 animate-spin text-blue-500" /> Memuat berita emiten…
        </div>
      ) : newsItems.length === 0 ? (
        <p className="text-sm text-zinc-400 py-4 text-center">Tidak ada berita ditemukan untuk emiten ini.</p>
      ) : (
        <div className="space-y-3">
          {newsItems.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 bg-white dark:bg-zinc-900/60 hover:border-blue-400/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Pill tone={item.sentiment === 'bullish' ? 'green' : item.sentiment === 'bearish' ? 'red' : 'amber'}>
                      {item.sentiment.toUpperCase()}
                    </Pill>
                    <span className="text-xs text-zinc-400">{item.publisher} • {item.publishedAt}</span>
                  </div>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-sm sm:text-base text-zinc-900 dark:text-zinc-100 hover:text-blue-500 transition-colors flex items-center gap-1.5"
                  >
                    {item.title} <ExternalLink className="size-3.5 shrink-0 opacity-60" />
                  </a>
                  <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2">
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
          <div key={label} className="rounded-xl bg-zinc-50 dark:bg-zinc-900/60 px-4 py-3 text-center">
            <div className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">{label}</div>
            <div className="mt-1 font-mono text-sm font-semibold text-zinc-800 dark:text-zinc-100">{value}</div>
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
          <div key={label} className="rounded-xl bg-zinc-50 dark:bg-zinc-900/60 px-4 py-3 text-center">
            <div className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide leading-tight">{label}</div>
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
            <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">RSI (14)</h3>
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

        <div className="h-px bg-zinc-100 dark:bg-zinc-800" />

        {/* MACD */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">MACD (12, 26, 9)</h3>
            <Pill tone={
              indicators.macdSignalType === 'bullish_crossover' || indicators.macdSignalType === 'bullish' ? 'green' :
                indicators.macdSignalType === 'bearish_crossover' || indicators.macdSignalType === 'bearish' ? 'red' : 'zinc'
            }>
              {indicators.macdSignalType.replace(/_/g, ' ')}
            </Pill>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-2">
            <div className="rounded-xl bg-zinc-50 dark:bg-zinc-900/60 px-3 py-2 text-center">
              <div className="text-xs text-zinc-400 dark:text-zinc-500">MACD</div>
              <div className="font-mono text-sm font-semibold text-zinc-800 dark:text-zinc-100 mt-0.5">{fmtN(indicators.macdValue)}</div>
            </div>
            <div className="rounded-xl bg-zinc-50 dark:bg-zinc-900/60 px-3 py-2 text-center">
              <div className="text-xs text-zinc-400 dark:text-zinc-500">Signal</div>
              <div className="font-mono text-sm font-semibold text-zinc-800 dark:text-zinc-100 mt-0.5">{fmtN(indicators.macdSignal)}</div>
            </div>
            <div className="rounded-xl bg-zinc-50 dark:bg-zinc-900/60 px-3 py-2 text-center">
              <div className="text-xs text-zinc-400 dark:text-zinc-500">Histogram</div>
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
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3 mb-5 text-white bg-rose-600">
        <span className="text-sm font-semibold uppercase tracking-wide">Status: {scores.status}</span>
        <span className="font-mono text-lg font-bold tabular-nums">Composite {scores.composite}/100</span>
      </div>

      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3">
        8 Dimensi Skor AI Breakout
      </p>
      <div className="space-y-4 mb-5">
        {dimensions.map((d) => (
          <div key={d.label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-zinc-600 dark:text-zinc-300">
                {d.icon} {d.label} <span className="text-zinc-400 dark:text-zinc-500">({d.weight}%)</span>
              </span>
              <span className="font-mono text-sm font-semibold text-zinc-800 dark:text-zinc-100">{d.value}/100</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div className="h-full rounded-full transition-all bg-emerald-500" style={{ width: `${d.value}%` }} />
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
type PageStatus = 'loading' | 'ready' | 'error';
type AnalysisTab = 'ai_summary' | 'teknikal' | 'fundamental' | 'berita' | 'breakout';

const ANALYSIS_TABS: { key: AnalysisTab; label: string; icon: React.ReactNode }[] = [
  { key: 'ai_summary', label: 'AI Buy/Avoid Advisor', icon: <Sparkles className="size-4" /> },
  { key: 'teknikal', label: 'Screening Teknikal', icon: <TrendingUp className="size-4" /> },
  { key: 'fundamental', label: 'Screening Fundamental', icon: <PieChart className="size-4" /> },
  { key: 'berita', label: 'Analisis Berita', icon: <Newspaper className="size-4" /> },
  { key: 'breakout', label: 'Breakout Hunter', icon: <Rocket className="size-4" /> },
];

export function StockAnalysisPage({ ticker }: { ticker: string }) {
  const [status, setStatus] = useState<PageStatus>('loading');
  const [summary, setSummary] = useState<StockSummary | null>(null);
  const [analysis, setAnalysis] = useState<StockAnalysis | null>(null);
  const [bars, setBars] = useState<OHLCVBar[]>([]);
  const [newsItems, setNewsItems] = useState<StockNewsItem[]>([]);
  const [newsSummary, setNewsSummary] = useState<NewsSentimentSummary>({
    totalNews: 0,
    bullishCount: 0,
    bearishCount: 0,
    neutralCount: 0,
    netSentimentScore: 50,
    overallSentiment: 'neutral',
  });
  const [newsLoading, setNewsLoading] = useState(true);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
  const [justCopied, setJustCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<AnalysisTab>('ai_summary');
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

  const load = useCallback(async () => {
    setStatus('loading');
    setNewsLoading(true);
    setAnalysis(null);
    try {
      const [summaries, bars, newsData] = await Promise.all([
        getStockSummaries(),
        getStockHistory(ticker),
        getStockNews(ticker),
      ]);

      const found = summaries.find((s) => s.ticker === ticker.toUpperCase());
      if (!found) throw new Error('Ticker tidak ditemukan');

      setSummary(found);
      setBars(bars);
      const result = computeStockAnalysis(found, bars);
      setAnalysis(result);
      setNewsItems(newsData.items);
      setNewsSummary(newsData.summary);
      setNewsLoading(false);
      setGeneratedAt(new Date());
      setStatus('ready');
    } catch {
      setStatus('error');
      setNewsLoading(false);
    }
  }, [ticker]);

  useEffect(() => { load(); }, [load]);

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

  if (status === 'error' || !analysis || !summary) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white dark:bg-zinc-950 px-4">
        <AlertTriangle className="size-10 text-amber-400" />
        <p className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">Data tidak tersedia</p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center max-w-xs">
          Ticker <strong>{ticker.toUpperCase()}</strong> tidak ditemukan atau gagal dimuat.
        </p>
        <Link
          href="/screener"
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
        >
          <ArrowLeft className="size-4" /> Kembali ke Screener
        </Link>
      </div>
    );
  }

  const breakoutScores = computeBreakoutScores(summary, bars);
  const { advisor, fundamentalScreening, technicalScreening } = computeAiStockAdvisor(
    summary,
    analysis,
    newsSummary,
    breakoutScores
  );

  const { trendEma, supportResistance, priceAction, volume, indicators, tradingPlan } = analysis;
  const isBullish = trendEma.trend === 'bullish';
  const isBearish = trendEma.trend === 'bearish';
  const positiveDay = summary.percentChange1D >= 0;
  const isWatched = watchlist.has(summary.ticker);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header Bar */}
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link
            href="/screener"
            className="flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            aria-label="Kembali ke screener"
          >
            <ArrowLeft className="size-4" />
            <span className="hidden sm:inline">Screener</span>
          </Link>

          <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800" />

          <div className="flex items-center gap-2 min-w-0">
            <span className="font-bold text-zinc-900 dark:text-zinc-100 text-lg">{summary.ticker}</span>
            <span className="hidden truncate text-sm text-zinc-500 dark:text-zinc-400 sm:inline">{summary.name}</span>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <div className="text-right">
              <div className="font-mono text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                {formatRupiah(summary.lastClose)}
              </div>
              <span className={cn(
                'inline-flex items-center gap-1 text-xs font-mono tabular-nums',
                positiveDay ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              )}>
                {positiveDay ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                {formatPercent(summary.percentChange1D)}
              </span>
            </div>
            <button
              type="button"
              onClick={load}
              title="Muat ulang data"
              className="flex size-8 items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
            >
              <RefreshCw className="size-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 space-y-5 pb-16">
        {/* Ticker Identity Card */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                  {summary.name} ({summary.ticker})
                </h1>
                <Pill tone="zinc">{summary.sector || 'Sektor BEI'}</Pill>
              </div>
              <div className="flex flex-wrap gap-x-4 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                <span>Market Cap: <strong>{formatCompact(summary.capitalization)}</strong></span>
                <span>Avg Vol 20D: <strong>{formatCompact(volume.volumeMa20)} lembar</strong></span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleShare}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                <Share2 className="size-3.5" /> {justCopied ? 'Tautan Disalin!' : 'Bagikan'}
              </button>
              <button
                type="button"
                onClick={() => watchlist.toggle(summary.ticker)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors border',
                  isWatched ? 'bg-amber-50 text-amber-600 border-amber-200' : 'border-zinc-200 text-zinc-500 hover:bg-zinc-50'
                )}
              >
                {isWatched ? <BookmarkCheck className="size-3.5" /> : <Bookmark className="size-3.5" />}
                {isWatched ? 'Watching' : 'Watch'}
              </button>
            </div>
          </div>
        </div>

        {/* OHLCV Chart */}
        {bars.length > 0 && (
          <OHLCVChart bars={bars} currentClose={summary.lastClose} />
        )}

        {/* 🤖 Top Hero Card: AI Stock Advisor (Penjelasan Alasan Beli vs Hindari) */}
        <AiStockAdvisorHero advisor={advisor} />

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-1.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-1.5" role="tablist">
          {ANALYSIS_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex-1 min-w-[120px] flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs sm:text-sm font-medium transition-all',
                activeTab === tab.key
                  ? 'bg-emerald-600 text-white shadow-sm font-semibold'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── TAB CONTENT ─────────────────────────────────────────────────── */}

        {/* Tab 1: AI Summary & Buy/Avoid Advisor Details */}
        {activeTab === 'ai_summary' && (
          <div className="space-y-5">
            {/* Quick Link to Deep Dive Tabs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={() => setActiveTab('fundamental')}
                className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 text-left hover:border-indigo-400 transition-colors space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-500">1. Screening Fundamental</span>
                  <span className={cn('text-xs font-bold', fundamentalScreening.passed ? 'text-emerald-600' : 'text-amber-600')}>
                    {fundamentalScreening.score}/100
                  </span>
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-300 font-medium">
                  {fundamentalScreening.statusText}
                </p>
              </button>

              <button
                onClick={() => setActiveTab('teknikal')}
                className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 text-left hover:border-emerald-400 transition-colors space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-500">2. Screening Teknikal</span>
                  <span className={cn('text-xs font-bold', technicalScreening.passed ? 'text-emerald-600' : 'text-amber-600')}>
                    {technicalScreening.score}/100
                  </span>
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-300 font-medium">
                  {technicalScreening.statusText}
                </p>
              </button>

              <button
                onClick={() => setActiveTab('berita')}
                className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 text-left hover:border-blue-400 transition-colors space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-500">3. Sentimen Berita</span>
                  <span className="text-xs font-bold text-blue-600">
                    {newsSummary.netSentimentScore}%
                  </span>
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-300 font-medium">
                  {newsSummary.totalNews} Artikel ({newsSummary.overallSentiment.toUpperCase()})
                </p>
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Screening & Analisis Teknikal */}
        {activeTab === 'teknikal' && (
          <div className="space-y-5">
            {/* Technical Screening Status Header */}
            <div className={cn(
              'rounded-xl border p-4 flex items-center justify-between gap-3',
              technicalScreening.passed
                ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/10'
                : 'border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/10'
            )}>
              <div>
                <h3 className="font-bold text-sm sm:text-base text-zinc-900 dark:text-zinc-100">
                  {technicalScreening.statusText}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
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
                  <p className="text-xs font-semibold uppercase tracking-wide text-rose-600 dark:text-rose-400 mb-2">
                    Resistance
                  </p>
                  {supportResistance.resistances.length > 0
                    ? supportResistance.resistances.map((r) => (
                      <LevelRow key={r.label} label={r.label} price={r.price} description={r.description} tone="red" />
                    ))
                    : <p className="text-sm text-zinc-400">Tidak terdeteksi.</p>}
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 mb-2">
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
          <FundamentalSection summary={summary} screening={fundamentalScreening} />
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
        <div className="flex gap-2.5 rounded-xl border border-amber-200 dark:border-amber-400/20 bg-amber-50 dark:bg-amber-400/5 px-4 py-3">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-500" strokeWidth={2} />
          <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
            <strong>Disclaimer:</strong> Analisis AI ini mengombinasikan screening fundamental, teknikal, dan berita untuk tujuan edukasi. <strong>Bukan merupakan rekomendasi finansial langsung.</strong> Selalu terapkan manajemen risiko ketat dan pertimbangkan kondisi pasar sebelum mengambil keputusan investasi.
          </p>
        </div>

        {/* Footer Links */}
        <div className="flex items-center justify-center gap-3 pt-2 text-xs text-zinc-400 dark:text-zinc-600">
          <a
            href={`https://finance.yahoo.com/quote/${summary.ticker}.JK`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-blue-500 transition-colors"
          >
            Yahoo Finance <ExternalLink className="size-3" />
          </a>
          <span>·</span>
          <a
            href={`https://www.idx.co.id/id/data-pasar/data-saham/daftar-saham/?kodeEmiten=${summary.ticker}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-blue-500 transition-colors"
          >
            IDX.co.id <ExternalLink className="size-3" />
          </a>
          <span>·</span>
          <span>{SITE_NAME}</span>
        </div>
      </main>
    </div>
  );
}
