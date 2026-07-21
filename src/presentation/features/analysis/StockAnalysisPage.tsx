'use client';

/**
 * StockAnalysisPage.tsx
 *
 * Full-page technical analysis for a single ticker.
 * Route: /screener/[ticker]
 *
 * Sections (matching the handwritten reference card):
 *   1. Trend & EMA
 *   2. Level Penting (Resistance & Support)
 *   3. Price Action
 *   4. Volume
 *   5. Indikator Teknikal
 *   6. Rencana Trading (Bullish & Bearish)
 *   7. Kesimpulan
 */

import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart2,
  Bookmark,
  BookmarkCheck,
  BookOpen,
  Crosshair,
  ExternalLink,
  HelpCircle,
  Loader2,
  PieChart,
  RefreshCw,
  Rocket,
  Share2,
  Target,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import { OHLCVBar } from '@/domain/models/History';
import { StockSummary } from '@/domain/models/Stock';
import {
  IndicatorAnalysis,
  PriceActionAnalysis,
  StockAnalysis,
  TrendEmaAnalysis,
  VolumeAnalysis,
} from '@/domain/models/StockAnalysis';
import { computeStockAnalysis } from '@/domain/analysis/stockAnalysisEngine';
import { BreakoutScores, computeBreakoutScores } from '@/domain/screener/presets';
import { getStockHistory, getStockSummaries } from '@/data/repositories/StockRepository';
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

// ─── Section card ─────────────────────────────────────────────────────────────
function SectionCard({
  number,
  title,
  icon,
  accentClass,
  children,
}: {
  number: number;
  title: string;
  icon: React.ReactNode;
  accentClass: string; // tailwind bg color class
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-900/40">
      <div className={cn('flex items-center gap-3 px-5 py-4 border-b border-zinc-100 dark:border-zinc-800')}>
        <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-xl text-white text-sm', accentClass)}>
          {icon}
        </span>
        <h2 className="font-semibold text-zinc-800 dark:text-zinc-100">
          <span className="text-zinc-400 dark:text-zinc-600 mr-1.5">{number}.</span>
          {title}
        </h2>
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

// ─── KV row ───────────────────────────────────────────────────────────────────
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

// ─── RSI bar ──────────────────────────────────────────────────────────────────
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
        {/* zone markers */}
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

// ─── Scenario card ────────────────────────────────────────────────────────────
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
// "Layak Dibeli?" helper
// ─────────────────────────────────────────────────────────────────────────────
type CheckTone = 'green' | 'amber' | 'red';
interface CheckPoint { icon: string; tone: CheckTone; label: string; detail: string; }

function buildLayakBeli(
  summary: StockSummary,
  analysis: StockAnalysis
): { points: CheckPoint[]; verdict: string; verdictTone: CheckTone } {
  const { trendEma, supportResistance, volume, indicators } = analysis;
  const points: CheckPoint[] = [];

  // 1. Likuiditas
  const val = summary.value;
  if (val >= 10_000_000_000) {
    points.push({ icon: '✅', tone: 'green', label: 'Likuiditas sangat baik', detail: `Nilai transaksi ${new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 }).format(val)} — mudah masuk & keluar` });
  } else if (val >= 1_000_000_000) {
    points.push({ icon: '⚠️', tone: 'amber', label: 'Likuiditas cukup', detail: `Nilai transaksi ${new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 }).format(val)} — perhatikan spread` });
  } else {
    points.push({ icon: '❌', tone: 'red', label: 'Likuiditas rendah', detail: `Nilai transaksi ${new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 }).format(val)} — risiko illiquid tinggi` });
  }

  // 2. Trend
  if (trendEma.trend === 'bullish') {
    points.push({ icon: '✅', tone: 'green', label: 'Tren naik terkonfirmasi', detail: `EMA20 (${fmtRp(trendEma.ema20)}) > EMA50 (${fmtRp(trendEma.ema50)})` });
  } else if (trendEma.trend === 'sideways') {
    points.push({ icon: '⚠️', tone: 'amber', label: 'Tren sideways / konsolidasi', detail: 'EMA belum memberikan sinyal arah yang jelas' });
  } else {
    points.push({ icon: '❌', tone: 'red', label: 'Tren turun', detail: `Harga di bawah EMA20 & EMA50 — hindari beli kecuali ada reversal` });
  }

  // 3. Momentum (MACD + RSI)
  const macdBull = indicators.macdSignalType === 'bullish' || indicators.macdSignalType === 'bullish_crossover';
  const rsiBull = indicators.rsiZone === 'bullish_zone';
  const rsiOB = indicators.rsiZone === 'overbought' || indicators.rsiZone === 'overbought_risk';
  if (macdBull && rsiBull) {
    points.push({ icon: '✅', tone: 'green', label: 'Momentum kuat', detail: `MACD bullish, RSI ${fmtN(indicators.rsi14, 1)} (zona bullish)` });
  } else if (rsiOB) {
    points.push({ icon: '⚠️', tone: 'amber', label: 'Momentum overbought', detail: `RSI ${fmtN(indicators.rsi14, 1)} — potensi profit taking / konsolidasi jangka pendek` });
  } else if (macdBull) {
    points.push({ icon: '⚠️', tone: 'amber', label: 'Momentum mulai membaik', detail: `MACD bullish, RSI ${fmtN(indicators.rsi14, 1)} — belum optimal` });
  } else {
    points.push({ icon: '❌', tone: 'red', label: 'Momentum lemah / bearish', detail: `MACD bearish, RSI ${fmtN(indicators.rsi14, 1)}` });
  }

  // 4. Volume
  if (volume.isHighVolume) {
    points.push({ icon: '✅', tone: 'green', label: 'Volume mengkonfirmasi', detail: `RVOL ${fmtN(volume.relativeVolume, 2)}× — di atas rata-rata, pergerakan valid` });
  } else {
    points.push({ icon: '⚠️', tone: 'amber', label: 'Volume masih kurang', detail: `RVOL ${Number.isNaN(volume.relativeVolume) ? '–' : fmtN(volume.relativeVolume, 2)}× — butuh konfirmasi volume lebih tinggi` });
  }

  // 5. Jarak ke resistance terdekat
  const r1 = supportResistance.resistances[0];
  if (r1) {
    const upside = ((r1.price - summary.lastClose) / summary.lastClose) * 100;
    if (upside > 5) {
      points.push({ icon: '✅', tone: 'green', label: 'Ruang naik masih luas', detail: `Resistance terdekat ${fmtRp(r1.price)} — potensi upside ~${upside.toFixed(1)}%` });
    } else if (upside > 1.5) {
      points.push({ icon: '⚠️', tone: 'amber', label: 'Sudah dekat resistance', detail: `${r1.label} di ${fmtRp(r1.price)} — potensi upside tinggal ~${upside.toFixed(1)}%` });
    } else {
      points.push({ icon: '❌', tone: 'red', label: 'Hampir di resistance', detail: `${r1.label} ${fmtRp(r1.price)} — upside sangat terbatas (${upside.toFixed(1)}%), risiko reversal` });
    }
  }

  // Verdict
  const greens = points.filter((p) => p.tone === 'green').length;
  const reds = points.filter((p) => p.tone === 'red').length;
  let verdict: string;
  let verdictTone: CheckTone;
  if (greens >= 4 && reds === 0) {
    verdict = 'Sangat layak dipertimbangkan untuk swing trading. Konfirmasi selalu dengan volume breakout.';
    verdictTone = 'green';
  } else if (greens >= 3 && reds <= 1) {
    verdict = 'Cukup layak untuk swing, kurang ideal untuk scalping. Pantau volume dan level kunci.';
    verdictTone = 'green';
  } else if (reds >= 3) {
    verdict = 'Kurang layak saat ini. Tunggu konfirmasi reversal atau tren yang lebih jelas.';
    verdictTone = 'red';
  } else {
    verdict = 'Sinyal campuran — netral. Tunggu konfirmasi lebih lanjut sebelum entry.';
    verdictTone = 'amber';
  }

  return { points, verdict, verdictTone };
}

// ─── Trend & EMA section ───────────────────────────────────────────────────────
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

// ─── Price Action section ──────────────────────────────────────────────────────
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

// ─── Volume section ─────────────────────────────────────────────────────────────
function VolumeSection({ number, volume }: { number: number; volume: VolumeAnalysis }) {
  return (
    <SectionCard number={number} title="Volume" icon={<BarChart2 className="size-4" />} accentClass="bg-cyan-500">
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
      {!Number.isNaN(volume.idealBreakoutVolume) && (
        <div className="mt-4 rounded-xl border border-amber-200 dark:border-amber-400/20 bg-amber-50 dark:bg-amber-400/5 px-4 py-3">
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">📌 Volume Ideal Breakout</p>
          <p className="text-sm text-amber-600 dark:text-amber-300 mt-1">
            {'>'} {new Intl.NumberFormat('id-ID').format(Math.round(volume.idealBreakoutVolume))} saham saat menembus resistance
          </p>
        </div>
      )}
    </SectionCard>
  );
}

// ─── Indikator Teknikal section ────────────────────────────────────────────────
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

        <div className="h-px bg-zinc-100 dark:bg-zinc-800" />

        {/* Stochastic */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Stochastic (14, 3, 3)</h3>
            <Pill tone={indicators.stochZone === 'oversold' ? 'green' : indicators.stochZone === 'overbought' ? 'red' : 'zinc'}>
              %K {fmtN(indicators.stochK, 1)} / %D {fmtN(indicators.stochD, 1)}
            </Pill>
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{indicators.stochNote}</p>
        </div>
      </div>
    </SectionCard>
  );
}

// ─── Fundamental Analysis section ──────────────────────────────────────────────
function FundamentalSection({ summary }: { summary: StockSummary }) {
  const { per, pbv, roe } = summary;

  const perNote: { tone: CheckTone; text: string } =
    per <= 0
      ? { tone: 'red', text: 'Perusahaan mencatat rugi atau data PER tidak berlaku.' }
      : per < 10
        ? { tone: 'green', text: 'PER relatif rendah — potensi undervalued, cek juga tren pertumbuhan laba.' }
        : per <= 20
          ? { tone: 'amber', text: 'PER berada di kisaran wajar untuk saham di BEI pada umumnya.' }
          : { tone: 'red', text: 'PER cukup tinggi — pasar menghargai ekspektasi pertumbuhan besar, risiko koreksi lebih tinggi.' };

  const pbvNote: { tone: CheckTone; text: string } =
    pbv <= 0
      ? { tone: 'amber', text: 'Data PBV tidak tersedia.' }
      : pbv < 1
        ? { tone: 'green', text: 'Harga di bawah nilai buku — secara aset tergolong murah.' }
        : pbv <= 3
          ? { tone: 'amber', text: 'PBV berada dalam rentang wajar.' }
          : { tone: 'red', text: 'PBV tinggi — pasar membayar premium jauh di atas nilai buku perusahaan.' };

  const roeNote: { tone: CheckTone; text: string } =
    roe <= 0
      ? { tone: 'red', text: 'ROE rendah atau negatif — efisiensi menghasilkan laba dari ekuitas masih lemah.' }
      : roe < 10
        ? { tone: 'amber', text: 'ROE cukup, namun belum unggul dibanding rata-rata pasar.' }
        : { tone: 'green', text: 'ROE baik — perusahaan cukup efisien menghasilkan laba dari ekuitas pemegang saham.' };

  const metrics = [
    { label: 'P/E Ratio (PER)', value: per > 0 ? `${per.toFixed(1)}×` : '–', note: perNote },
    { label: 'P/BV Ratio', value: pbv > 0 ? `${pbv.toFixed(2)}×` : '–', note: pbvNote },
    { label: 'ROE', value: roe !== 0 ? `${roe.toFixed(1)}%` : '–', note: roeNote },
  ];

  const toneBg: Record<CheckTone, string> = {
    green: 'border-emerald-200 bg-emerald-50 dark:border-emerald-400/20 dark:bg-emerald-400/5',
    amber: 'border-amber-200 bg-amber-50 dark:border-amber-400/20 dark:bg-amber-400/5',
    red: 'border-rose-200 bg-rose-50 dark:border-rose-400/20 dark:bg-rose-400/5',
  };
  const toneText: Record<CheckTone, string> = {
    green: 'text-emerald-700 dark:text-emerald-300',
    amber: 'text-amber-700 dark:text-amber-300',
    red: 'text-rose-700 dark:text-rose-300',
  };
  const verdictBg: Record<CheckTone, string> = {
    green: 'bg-emerald-600 dark:bg-emerald-600',
    amber: 'bg-amber-500 dark:bg-amber-600',
    red: 'bg-rose-600 dark:bg-rose-600',
  };

  const greens = metrics.filter((m) => m.note.tone === 'green').length;
  const reds = metrics.filter((m) => m.note.tone === 'red').length;
  let verdict: string;
  let verdictTone: CheckTone;
  if (greens >= 2 && reds === 0) {
    verdict = 'Secara valuasi & profitabilitas tergolong menarik. Tetap bandingkan dengan rata-rata sektor.';
    verdictTone = 'green';
  } else if (reds >= 2) {
    verdict = 'Secara fundamental kurang menarik saat ini — valuasi mahal atau profitabilitas lemah.';
    verdictTone = 'red';
  } else {
    verdict = 'Fundamental campuran — perlu dibandingkan lebih jauh dengan rata-rata sektor.';
    verdictTone = 'amber';
  }

  return (
    <SectionCard number={1} title="Rasio Fundamental" icon={<PieChart className="size-4" />} accentClass="bg-indigo-500">
      <div className="grid grid-cols-2 gap-3 mb-4 sm:grid-cols-4">
        <div className="rounded-xl bg-zinc-50 dark:bg-zinc-900/60 px-4 py-3 text-center">
          <div className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">Market Cap</div>
          <div className="mt-1 font-mono text-sm font-semibold text-zinc-800 dark:text-zinc-100">{formatCompact(summary.capitalization)}</div>
        </div>
        {metrics.map((m) => (
          <div key={m.label} className="rounded-xl bg-zinc-50 dark:bg-zinc-900/60 px-4 py-3 text-center">
            <div className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">{m.label}</div>
            <div className="mt-1 font-mono text-sm font-semibold text-zinc-800 dark:text-zinc-100">{m.value}</div>
          </div>
        ))}
      </div>
      <div className="space-y-2 mb-4">
        {metrics.map((m) => (
          <div key={m.label} className={cn('rounded-xl border px-4 py-3', toneBg[m.note.tone])}>
            <span className={cn('text-sm font-semibold', toneText[m.note.tone])}>{m.label}</span>
            <p className="text-xs mt-0.5 text-zinc-600 dark:text-zinc-400 leading-relaxed">{m.note.text}</p>
          </div>
        ))}
      </div>
      <div className={cn('rounded-xl px-4 py-3 text-white', verdictBg[verdictTone])}>
        <p className="text-xs font-semibold uppercase tracking-wide opacity-80 mb-0.5">Kesimpulan Fundamental</p>
        <p className="text-sm font-medium leading-relaxed">{verdict}</p>
      </div>
      <p className="mt-4 text-xs text-zinc-400 dark:text-zinc-600 italic leading-relaxed">
        Ambang batas di atas bersifat umum dan belum disesuaikan per sektor. Bandingkan selalu dengan rata-rata PER/PBV/ROE sektor {summary.sector || '–'} sebelum mengambil keputusan.
      </p>
    </SectionCard>
  );
}

// ─── Breakout Hunter section ────────────────────────────────────────────────────
const BREAKOUT_STATUS_LABEL: Record<BreakoutScores['status'], string> = {
  BUY_WATCH: '🚀 BUY WATCH',
  WATCH: '👀 WATCH',
  SKIP: '⏭️ SKIP',
};
const BREAKOUT_STATUS_BG: Record<BreakoutScores['status'], string> = {
  BUY_WATCH: 'bg-emerald-600 dark:bg-emerald-600',
  WATCH: 'bg-amber-500 dark:bg-amber-600',
  SKIP: 'bg-zinc-500 dark:bg-zinc-600',
};

function scoreBarColor(value: number): string {
  return value >= 70 ? 'bg-emerald-500' : value >= 45 ? 'bg-amber-400' : 'bg-rose-400';
}

function BreakoutScoreRow({ icon, label, weight, value }: {
  icon: string; label: string; weight: number; value: number;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-zinc-600 dark:text-zinc-300">
          {icon} {label} <span className="text-zinc-400 dark:text-zinc-500">({weight}%)</span>
        </span>
        <span className="font-mono text-sm font-semibold text-zinc-800 dark:text-zinc-100">{value}/100</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div className={cn('h-full rounded-full transition-all', scoreBarColor(value))} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

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
    <SectionCard number={1} title="Breakout Hunter Score" icon={<Rocket className="size-4" />} accentClass="bg-rose-500">
      <div className={cn('flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3 mb-5 text-white', BREAKOUT_STATUS_BG[scores.status])}>
        <span className="text-sm font-semibold uppercase tracking-wide">{BREAKOUT_STATUS_LABEL[scores.status]}</span>
        <span className="font-mono text-lg font-bold tabular-nums">Composite {scores.composite}/100</span>
      </div>

      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3">
        8 Dimensi Skor AI
      </p>
      <div className="space-y-4 mb-5">
        {dimensions.map((d) => (
          <BreakoutScoreRow key={d.label} icon={d.icon} label={d.label} weight={d.weight} value={d.value} />
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 mb-4">
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-400/20 bg-emerald-50 dark:bg-emerald-400/5 px-4 py-3">
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-0.5">📈 Prob. Naik &gt;10% (1-3 hari)</p>
          <p className="font-mono text-lg font-bold text-emerald-600 dark:text-emerald-300">{scores.probUp}%</p>
        </div>
        <div className="rounded-xl border border-rose-200 dark:border-rose-400/20 bg-rose-50 dark:bg-rose-400/5 px-4 py-3">
          <p className="text-xs font-semibold text-rose-700 dark:text-rose-400 mb-0.5">📉 Prob. Turun &gt;3%</p>
          <p className="font-mono text-lg font-bold text-rose-600 dark:text-rose-300">{scores.probDown}%</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Pill tone={scores.distributionRisk < 50 ? 'green' : 'red'}>
          ⚠️ Distribution Risk {scores.distributionRisk}/100
        </Pill>
        <Pill tone={scores.openingConfirmation >= 40 ? 'green' : 'amber'}>
          🌅 Opening Confirmation {scores.openingConfirmation}/100
        </Pill>
      </div>

      <p className="text-xs text-zinc-400 dark:text-zinc-600 italic leading-relaxed">
        Distribution Risk & Opening Confirmation berfungsi sebagai safety gate (bukan bagian bobot Composite Score).
        Historical Beta adalah proxy ekspansi ATR — {ticker} tidak dibandingkan terhadap IHSG karena data historis
        indeks belum tersedia. Skor ini menekankan pola &quot;compressed before explosive move&quot; sehingga saham
        dengan tren EMA masih bearish tetap bisa mendapat skor tinggi jika kompresi volatilitas dan smart money
        inflow-nya kuat — bukan jaminan ARA, melainkan probabilitas pergerakan eksplosif jika ada katalis.
      </p>
    </SectionCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page Component
// ─────────────────────────────────────────────────────────────────────────────
type PageStatus = 'loading' | 'ready' | 'error';
type AnalysisTab = 'indikator' | 'technical' | 'fundamental' | 'breakout';

const ANALYSIS_TABS: { key: AnalysisTab; label: string }[] = [
  { key: 'indikator', label: 'Technical Analysis' },
  // { key: 'technical', label: 'Technical Analysis' },
  { key: 'fundamental', label: 'Fundamental Analysis' },
  { key: 'breakout', label: 'Breakout Hunter' },
];

export function StockAnalysisPage({ ticker }: { ticker: string }) {
  const [status, setStatus] = useState<PageStatus>('loading');
  const [summary, setSummary] = useState<StockSummary | null>(null);
  const [analysis, setAnalysis] = useState<StockAnalysis | null>(null);
  const [bars, setBars] = useState<OHLCVBar[]>([]);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
  const [justCopied, setJustCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<AnalysisTab>('indikator');
  const watchlist = useWatchlist();

  const handleShare = useCallback(async () => {
    if (!summary) return;
    const url = window.location.href;
    const shareData = { title: `${summary.ticker} — ${summary.name}`, text: 'Analisis teknikal saham', url };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch { /* user cancelled */ }
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
    setAnalysis(null);
    try {
      const [summaries, bars] = await Promise.all([
        getStockSummaries(),
        getStockHistory(ticker),
      ]);
      const found = summaries.find((s) => s.ticker === ticker.toUpperCase());
      if (!found) throw new Error('Ticker tidak ditemukan');
      setSummary(found);
      setBars(bars);
      const result = computeStockAnalysis(found, bars);
      setAnalysis(result);
      setGeneratedAt(new Date());
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [ticker]);

  useEffect(() => { load(); }, [load]);

  // ── Loading ──
  if (status === 'loading') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white dark:bg-zinc-950">
        <div className="flex items-center gap-3">
          <Loader2 className="size-6 animate-spin text-emerald-500" />
          <span className="text-zinc-500 dark:text-zinc-400">Menganalisis {ticker.toUpperCase()}…</span>
        </div>
      </div>
    );
  }

  // ── Error ──
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
  const { trendEma, supportResistance, priceAction, volume, indicators, tradingPlan, conclusion } = analysis;
  const isBullish = trendEma.trend === 'bullish';
  const isBearish = trendEma.trend === 'bearish';
  const positiveDay = summary.percentChange1D >= 0;
  const isWatched = watchlist.has(summary.ticker);
  const todayDateLabel = generatedAt
    ? generatedAt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
    : '–';
  const lastBarDateLabel = bars.length > 0
    ? new Date(bars[bars.length - 1].date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
    : todayDateLabel;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* ── Top bar ───────────────────────────────────────────────────────── */}
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
              title="Muat ulang analisis"
              className="flex size-8 items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
            >
              <RefreshCw className="size-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 space-y-4 pb-16">

        {/* Hero summary card */}
        <div className={cn(
          'rounded-2xl border p-5 space-y-4',
          isBullish
            ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-400/20 dark:bg-emerald-400/5'
            : isBearish
              ? 'border-rose-200 bg-rose-50 dark:border-rose-400/20 dark:bg-rose-400/5'
              : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/40'
        )}>
          {/* Action row */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={load}
              title="Muat ulang analisis"
              className="flex size-8 items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
            >
              <RefreshCw className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={handleShare}
              title="Bagikan"
              className="flex size-8 items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
            >
              <Share2 className="size-3.5" />
            </button>
            {justCopied && (
              <span className="text-xs text-zinc-400 dark:text-zinc-500">Tautan disalin</span>
            )}
            <button
              type="button"
              onClick={() => watchlist.toggle(summary.ticker)}
              className={cn(
                'flex items-center gap-1.5 text-sm font-medium transition-colors',
                isWatched ? 'text-amber-500' : 'text-zinc-400 dark:text-zinc-500 hover:text-amber-500'
              )}
            >
              {isWatched ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />}
              {isWatched ? 'Watching' : 'Watch'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
            {/* Left: identity */}
            <div className="space-y-2 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                  {summary.name} ({summary.ticker})
                </h1>
                <Pill tone="zinc">{summary.sector || '–'}</Pill>
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-zinc-500 dark:text-zinc-400">
                <span><span className="font-semibold text-zinc-600 dark:text-zinc-300">Market Cap:</span> {formatCompact(summary.capitalization)}</span>
                <span>
                  <span className="font-semibold text-zinc-600 dark:text-zinc-300">Avg Daily Volume:</span>{' '}
                  {Number.isNaN(volume.volumeMa20) ? '–' : `${formatCompact(volume.volumeMa20)} lembar`}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Pill tone={isBullish ? 'green' : isBearish ? 'red' : 'amber'}>
                  {isBullish ? '🟢 Bullish' : isBearish ? '🔴 Bearish' : '🟡 Sideways'}
                </Pill>
                {summary.per > 0 && <Pill tone="zinc">P/E {summary.per.toFixed(1)}</Pill>}
                {summary.pbv > 0 && <Pill tone="zinc">P/BV {summary.pbv.toFixed(2)}</Pill>}
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-xl">
                {conclusion.summary}
              </p>
            </div>

            {/* Right: price */}
            <div className="hidden sm:block text-right space-y-1">
              <div className="flex items-center justify-end gap-2">
                <span className="font-mono text-2xl sm:text-3xl font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                  {formatRupiah(summary.lastClose)}
                </span>
                <span className={cn(
                  'rounded-full px-3 py-1 text-sm font-semibold text-white',
                  positiveDay ? 'bg-emerald-600' : 'bg-rose-600'
                )}>
                  {formatPercent(summary.percentChange1D)}
                </span>
              </div>
              {generatedAt && (
                <p className="text-xs text-zinc-400 dark:text-zinc-500">
                  Last close: {lastBarDateLabel} • Vol: {new Intl.NumberFormat('id-ID').format(summary.volume)}
                </p>
              )}
            </div>
          </div>
        </div>

        {bars.length > 0 && (
          <OHLCVChart bars={bars} currentClose={summary.lastClose} />
        )}

        {/* ── Tabs ─────────────────────────────────────────────────────────── */}
        <div className="flex gap-1 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-1" role="tablist">
          {ANALYSIS_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex-1 rounded-lg px-3 py-2 text-sm font-medium text-center transition-colors',
                activeTab === tab.key
                  ? 'bg-emerald-600 text-white'
                  : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Tab: 7 Indikator ─────────────────────────────────────────────── */}
        {activeTab === 'indikator' && (
          <>
            <TrendEmaSection number={1} trendEma={trendEma} isBullish={isBullish} isBearish={isBearish} />

            {/* ── 2. Level Penting ────────────────────────────────────────── */}
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

            {/* ── 6. Rencana Trading ──────────────────────────────────────── */}
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
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/40 px-4 py-3">
                <span className="text-sm text-zinc-500 dark:text-zinc-400">Bias rekomendasi:</span>
                <Pill tone={tradingPlan.recommendedBias === 'bullish' ? 'green' : tradingPlan.recommendedBias === 'bearish' ? 'red' : 'amber'}>
                  {tradingPlan.recommendedBias === 'bullish' ? '🟢 Bullish' : tradingPlan.recommendedBias === 'bearish' ? '🔴 Bearish' : '🟡 Netral'}
                </Pill>
                <span className="text-xs text-zinc-400 dark:text-zinc-500">
                  Selalu konfirmasi dengan analisis mandiri Anda.
                </span>
              </div>
            </SectionCard>

            {/* ── 7. Kesimpulan ───────────────────────────────────────────── */}
            <SectionCard number={7} title="Kesimpulan" icon={<BookOpen className="size-4" />} accentClass="bg-zinc-600">
              {/* Ringkasan singkat */}
              <div className={cn(
                'rounded-xl border px-4 py-4 mb-5',
                conclusion.overallBias === 'bullish'
                  ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-400/20 dark:bg-emerald-400/5'
                  : conclusion.overallBias === 'bearish'
                    ? 'border-rose-200 bg-rose-50 dark:border-rose-400/20 dark:bg-rose-400/5'
                    : 'border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/40'
              )}>
                <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{conclusion.summary}</p>
              </div>

              {/* ── "Apakah layak dibeli hari ini?" ───────────────────────── */}
              {(() => {
                const { points, verdict, verdictTone } = buildLayakBeli(summary, analysis);
                const verdictBg = {
                  green: 'border-emerald-300 bg-emerald-600 dark:bg-emerald-600',
                  amber: 'border-amber-300 bg-amber-500 dark:bg-amber-600',
                  red: 'border-rose-300 bg-rose-600 dark:bg-rose-600',
                };
                const pointBg: Record<CheckTone, string> = {
                  green: 'border-emerald-200 bg-emerald-50 dark:border-emerald-400/20 dark:bg-emerald-400/5',
                  amber: 'border-amber-200 bg-amber-50 dark:border-amber-400/20 dark:bg-amber-400/5',
                  red: 'border-rose-200 bg-rose-50 dark:border-rose-400/20 dark:bg-rose-400/5',
                };
                const labelColor: Record<CheckTone, string> = {
                  green: 'text-emerald-700 dark:text-emerald-300',
                  amber: 'text-amber-700 dark:text-amber-300',
                  red: 'text-rose-700 dark:text-rose-300',
                };
                const detailColor: Record<CheckTone, string> = {
                  green: 'text-emerald-600/80 dark:text-emerald-400/70',
                  amber: 'text-amber-600/80 dark:text-amber-400/70',
                  red: 'text-rose-600/80 dark:text-rose-400/70',
                };
                return (
                  <div className="mb-5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3">
                      Apakah {summary.ticker} layak dibeli hari ini?
                    </p>
                    <div className="space-y-2 mb-4">
                      {points.map((pt) => (
                        <div key={pt.label} className={cn('flex items-start gap-3 rounded-xl border px-4 py-3', pointBg[pt.tone])}>
                          <span className="shrink-0 text-base leading-none mt-0.5">{pt.icon}</span>
                          <div>
                            <span className={cn('text-sm font-semibold', labelColor[pt.tone])}>{pt.label}</span>
                            <p className={cn('text-xs mt-0.5 leading-relaxed', detailColor[pt.tone])}>{pt.detail}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Verdict chip */}
                    <div className={cn('flex items-start gap-3 rounded-xl px-4 py-3 text-white', verdictBg[verdictTone])}>
                      <span className="shrink-0 text-base leading-none mt-0.5">💬</span>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide opacity-80 mb-0.5">Kesimpulan</p>
                        <p className="text-sm font-medium leading-relaxed">{verdict}</p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Level kunci & Waspadai */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-blue-200 dark:border-blue-400/20 bg-blue-50 dark:bg-blue-400/5 px-4 py-3">
                  <p className="text-sm font-semibold text-blue-700 dark:text-blue-400 mb-1">🔑 Level Kunci</p>
                  <p className="text-sm text-blue-600 dark:text-blue-300 leading-relaxed">{conclusion.keyLevel}</p>
                </div>
                <div className="rounded-xl border border-amber-200 dark:border-amber-400/20 bg-amber-50 dark:bg-amber-400/5 px-4 py-3">
                  <p className="text-sm font-semibold text-amber-700 dark:text-amber-400 mb-1">
                    <AlertTriangle className="inline size-3.5 mr-1" />Waspadai
                  </p>
                  <p className="text-sm text-amber-600 dark:text-amber-300 leading-relaxed">{conclusion.watchOut}</p>
                </div>
              </div>
            </SectionCard>
          </>
        )}

        {/* ── Tab: Technical Analysis ──────────────────────────────────────── */}
        {activeTab === 'technical' && (
          <>
            {bars.length > 0 && (
              <OHLCVChart bars={bars} currentClose={summary.lastClose} />
            )}
            <TrendEmaSection number={1} trendEma={trendEma} isBullish={isBullish} isBearish={isBearish} />
            <PriceActionSection number={2} priceAction={priceAction} />
            <VolumeSection number={3} volume={volume} />
            <IndicatorsSection number={4} indicators={indicators} />
          </>
        )}

        {/* ── Tab: Fundamental Analysis ────────────────────────────────────── */}
        {activeTab === 'fundamental' && (
          <FundamentalSection summary={summary} />
        )}

        {/* ── Tab: Breakout Hunter ─────────────────────────────────────────── */}
        {activeTab === 'breakout' && (
          <BreakoutHunterSection ticker={summary.ticker} scores={breakoutScores} />
        )}

        {/* ── Cara Membaca Analisis Ini ────────────────────────────────── */}
        <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-900/40">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-100 dark:border-zinc-800">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-indigo-500 text-white text-sm">
              <HelpCircle className="size-4" />
            </span>
            <h2 className="font-semibold text-zinc-800 dark:text-zinc-100">Cara Membaca Analisis Ini</h2>
          </div>
          <div className="px-5 py-4 space-y-3">
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Setiap bagian di atas menjawab satu sudut pandang berbeda. Baca dari atas ke bawah, lalu bandingkan
              apakah sinyalnya searah (semua bullish/bearish) atau saling bertentangan — itulah yang menentukan
              seberapa yakin sebuah sinyal layak ditindaklanjuti.
            </p>
            <ul className="space-y-1.5">
              <Note text="Trend & EMA — arah tren utama. Harga di atas EMA20 & EMA50 menandakan tren naik yang lebih sehat untuk swing." />
              <Note text="Level Penting — batas resistance (atap) dan support (lantai) sebagai acuan area beli/jual dan penentu stop loss." />
              <Note text="Price Action — candle & pola terakhir, menunjukkan siapa yang sedang menguasai: pembeli atau penjual." />
              <Note text="Volume — validasi gerakan harga. Kenaikan harga tanpa volume tinggi lebih rawan gagal (fake breakout)." />
              <Note text="Indikator Teknikal — RSI/MACD/Stochastic mengukur momentum dan potensi jenuh beli (overbought) atau jenuh jual (oversold)." />
              <Note text="Rencana Trading — contoh skenario entry, target profit, dan stop loss lengkap dengan rasio risk/reward." />
              <Note text="Kesimpulan — rangkuman semua faktor di atas jadi satu jawaban sederhana: layak dibeli atau belum." />
            </ul>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Gunakan semua ini sebagai satu alat bantu, bukan satu-satunya dasar keputusan. Tetap kombinasikan
              dengan manajemen risiko (ukuran posisi & stop loss) dan kondisi pasar secara keseluruhan.
            </p>
          </div>
        </section>

        {/* ── Filosofi ─────────────────────────────────────────────────── */}
        <PhilosophyBanner />

        {/* ── Disclaimer ───────────────────────────────────────────────── */}
        <div className="flex gap-2.5 rounded-xl border border-amber-200 dark:border-amber-400/20 bg-amber-50 dark:bg-amber-400/5 px-4 py-3">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-500" strokeWidth={2} />
          <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
            <strong>Disclaimer:</strong> Analisis ini bersifat <strong>edukatif</strong> dan dihasilkan dari data
            historis EOD (End-of-Day). <strong>Bukan merupakan rekomendasi beli/jual.</strong> Selalu lakukan riset
            mandiri, konsultasikan dengan penasihat keuangan terdaftar, dan terapkan manajemen risiko yang ketat
            sebelum mengambil keputusan investasi.
          </p>
        </div>

        {/* External link footer */}
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
