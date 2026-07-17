'use client';

/**
 * StockDetailPanel.tsx
 *
 * Expandable 7-aspect analysis panel — inspired by the reference handwritten
 * analysis card (BBCA Daily, Azam Ismul style).
 *
 * Sections:
 *   1. Trend & EMA
 *   2. Level Penting (Resistance & Support)
 *   3. Price Action
 *   4. Volume
 *   5. Indikator
 *   6. Rencana Trading (Bullish & Bearish scenario)
 *   7. Kesimpulan
 */

import {
  Activity,
  AlertTriangle,
  BarChart2,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Loader2,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { useCallback, useState } from 'react';
import { cn, formatRupiah } from '@/lib/format';
import { StockAnalysis } from '@/domain/models/StockAnalysis';

// ── tiny utilities ─────────────────────────────────────────────────────────────
function fmt(n: number): string {
  if (Number.isNaN(n) || n === 0) return '–';
  return n.toLocaleString('id-ID');
}

function fmtRp(n: number): string {
  if (Number.isNaN(n) || n === 0) return '–';
  return formatRupiah(n);
}

function fmtN(n: number, dec = 2): string {
  if (Number.isNaN(n)) return '–';
  return n.toFixed(dec);
}

// ── Section wrapper ────────────────────────────────────────────────────────────
interface SectionProps {
  id: string;
  title: string;
  icon: React.ReactNode;
  accent: string; // border-l color class
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function Section({ id, title, icon, accent, children, defaultOpen = true }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={cn('rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden')} id={id}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-zinc-800 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <span className={cn('flex size-6 shrink-0 items-center justify-center rounded-md text-white', accent)}>
            {icon}
          </span>
          {title}
        </span>
        {open ? <ChevronUp className="size-4 text-zinc-400" /> : <ChevronDown className="size-4 text-zinc-400" />}
      </button>
      {open && (
        <div className={cn('border-t border-zinc-100 dark:border-zinc-800/80 px-4 pb-4 pt-3 space-y-2')}>
          {children}
        </div>
      )}
    </div>
  );
}

// ── Pill ──────────────────────────────────────────────────────────────────────
function Pill({ children, tone }: { children: React.ReactNode; tone: 'green' | 'red' | 'amber' | 'blue' | 'zinc' }) {
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

// ── KV row ────────────────────────────────────────────────────────────────────
function KV({ label, value, valueClass }: { label: string; value: React.ReactNode; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-zinc-500 dark:text-zinc-400 shrink-0">{label}</span>
      <span className={cn('font-mono tabular-nums text-zinc-800 dark:text-zinc-200 text-right', valueClass)}>
        {value}
      </span>
    </div>
  );
}

// ── Bullet note ───────────────────────────────────────────────────────────────
function Note({ text, tone = 'zinc' }: { text: string; tone?: 'green' | 'red' | 'zinc' }) {
  const colors = {
    green: 'text-emerald-700 dark:text-emerald-400',
    red: 'text-rose-700 dark:text-rose-400',
    zinc: 'text-zinc-600 dark:text-zinc-400',
  };
  return (
    <li className={cn('flex gap-2 text-xs leading-relaxed', colors[tone])}>
      <span className="mt-0.5 shrink-0 opacity-50">•</span>
      <span>{text}</span>
    </li>
  );
}

// ── Price level chip ──────────────────────────────────────────────────────────
function LevelRow({
  label,
  price,
  description,
  tone,
}: {
  label: string;
  price: number;
  description: string;
  tone: 'red' | 'green';
}) {
  const bg =
    tone === 'red'
      ? 'bg-rose-50 border-rose-200 dark:bg-rose-400/5 dark:border-rose-400/20'
      : 'bg-emerald-50 border-emerald-200 dark:bg-emerald-400/5 dark:border-emerald-400/20';
  const labelColor = tone === 'red' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400';
  return (
    <div className={cn('flex items-center justify-between gap-3 rounded-lg border px-3 py-2', bg)}>
      <div className="flex items-center gap-2">
        <span className={cn('w-7 text-center text-xs font-bold', labelColor)}>{label}</span>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">{description}</span>
      </div>
      <span className="font-mono text-sm tabular-nums font-semibold text-zinc-800 dark:text-zinc-200">
        {fmtRp(price)}
      </span>
    </div>
  );
}

// ── Scenario card ─────────────────────────────────────────────────────────────
function ScenarioCard({
  type,
  entry,
  tp1,
  tp2,
  sl,
  rr,
  notes,
}: {
  type: 'bullish' | 'bearish';
  entry: number;
  tp1: number;
  tp2: number;
  sl: number;
  rr: number;
  notes: string;
}) {
  const isBull = type === 'bullish';
  const headerBg = isBull
    ? 'bg-emerald-500 dark:bg-emerald-600'
    : 'bg-rose-500 dark:bg-rose-600';
  const borderColor = isBull
    ? 'border-emerald-200 dark:border-emerald-400/20'
    : 'border-rose-200 dark:border-rose-400/20';
  const Icon = isBull ? TrendingUp : TrendingDown;

  return (
    <div className={cn('rounded-xl border overflow-hidden', borderColor)}>
      <div className={cn('flex items-center gap-2 px-3 py-2 text-white text-xs font-semibold', headerBg)}>
        <Icon className="size-3.5" />
        Skenario {isBull ? 'Bullish ✓' : 'Bearish ✗'}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 px-3 py-3">
        <KV label="Entry" value={fmtRp(entry)} />
        <KV label="TP 1" value={fmtRp(tp1)} valueClass="text-emerald-600 dark:text-emerald-400" />
        <KV label="TP 2" value={fmtRp(tp2)} valueClass="text-emerald-600 dark:text-emerald-400" />
        <KV label="SL" value={fmtRp(sl)} valueClass="text-rose-600 dark:text-rose-400" />
      </div>
      <div className="border-t border-zinc-100 dark:border-zinc-800 px-3 pb-3 pt-2">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">Risk/Reward</span>
          <span className={cn('text-xs font-bold', rr >= 2 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400')}>
            1 : {fmtN(rr, 1)}
          </span>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">{notes}</p>
      </div>
    </div>
  );
}

// ── RSI bar ───────────────────────────────────────────────────────────────────
function RsiBar({ value }: { value: number }) {
  if (Number.isNaN(value)) return null;
  const pct = Math.min(100, Math.max(0, value));
  const color =
    value < 30 ? 'bg-rose-500' :
    value > 80 ? 'bg-red-600' :
    value > 70 ? 'bg-amber-500' :
    value >= 55 ? 'bg-emerald-500' :
    'bg-blue-400';
  return (
    <div className="space-y-1">
      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div
          className={cn('h-full rounded-full transition-all', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-zinc-400">
        <span>0</span><span>30</span><span>55</span><span>70</span><span>100</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main panel
// ─────────────────────────────────────────────────────────────────────────────
interface StockDetailPanelProps {
  analysis: StockAnalysis | null;
  isLoading: boolean;
}

export function StockDetailPanel({ analysis, isLoading }: StockDetailPanelProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-sm text-zinc-500 dark:text-zinc-400">
        <Loader2 className="size-4 animate-spin" />
        Menganalisis data teknikal...
      </div>
    );
  }

  if (!analysis) return null;

  const { trendEma, supportResistance, priceAction, volume, indicators, tradingPlan, conclusion } = analysis;

  // convenience booleans for color mapping
  const isBullish = trendEma.trend === 'bullish';
  const isBearish = trendEma.trend === 'bearish';

  return (
    <div className="space-y-3 pt-1">
      {/* ── 1. Trend & EMA ─────────────────────────────────────────────── */}
      <Section
        id={`detail-trend-${analysis.ticker}`}
        title="1. Trend & EMA"
        icon={<TrendingUp className="size-3.5" />}
        accent="bg-blue-500"
      >
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { label: 'EMA 20', value: fmtRp(trendEma.ema20) },
            { label: 'EMA 50', value: fmtRp(trendEma.ema50) },
            { label: 'EMA 200', value: fmtRp(trendEma.ema200) },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg bg-zinc-50 dark:bg-zinc-900/60 px-3 py-2 text-center">
              <div className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">{label}</div>
              <div className="mt-0.5 font-mono text-xs font-semibold text-zinc-800 dark:text-zinc-100">{value}</div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5 mb-2">
          <Pill tone={trendEma.priceVsEma20 === 'above' ? 'green' : 'red'}>
            Close {trendEma.priceVsEma20 === 'above' ? '>' : '<'} EMA20
          </Pill>
          <Pill tone={trendEma.priceVsEma50 === 'above' ? 'green' : 'red'}>
            Close {trendEma.priceVsEma50 === 'above' ? '>' : '<'} EMA50
          </Pill>
          <Pill tone={isBullish ? 'green' : isBearish ? 'red' : 'amber'}>
            Tren: {isBullish ? 'Bullish 🟢' : isBearish ? 'Bearish 🔴' : 'Sideways 🟡'}
          </Pill>
          {trendEma.higherLows && <Pill tone="green">Higher Low ✓</Pill>}
        </div>
        <ul className="space-y-1">
          <Note text={trendEma.trendDescription} tone={isBullish ? 'green' : isBearish ? 'red' : 'zinc'} />
          {trendEma.higherLows && <Note text="Terbentuk pola higher low — sinyal akumulasi bertahap." tone="green" />}
        </ul>
      </Section>

      {/* ── 2. Level Penting ────────────────────────────────────────────── */}
      <Section
        id={`detail-levels-${analysis.ticker}`}
        title="2. Level Penting (Resistance & Support)"
        icon={<Crosshair className="size-3.5" />}
        accent="bg-violet-500"
      >
        {supportResistance.resistances.length > 0 ? (
          <div className="space-y-1.5 mb-3">
            <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wide">Resistance</p>
            {supportResistance.resistances.map((r) => (
              <LevelRow key={r.label} label={r.label} price={r.price} description={r.description} tone="red" />
            ))}
          </div>
        ) : (
          <p className="text-xs text-zinc-400 mb-2">Tidak ada resistance yang terdeteksi.</p>
        )}
        {supportResistance.supports.length > 0 ? (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Support</p>
            {supportResistance.supports.map((s) => (
              <LevelRow key={s.label} label={s.label} price={s.price} description={s.description} tone="green" />
            ))}
          </div>
        ) : (
          <p className="text-xs text-zinc-400">Tidak ada support yang terdeteksi.</p>
        )}
      </Section>

      {/* ── 3. Price Action ─────────────────────────────────────────────── */}
      <Section
        id={`detail-pa-${analysis.ticker}`}
        title="3. Price Action"
        icon={<Activity className="size-3.5" />}
        accent="bg-emerald-500"
      >
        <div className="flex flex-wrap gap-1.5 mb-2">
          <Pill tone={priceAction.lastCandleColor === 'green' ? 'green' : priceAction.lastCandleColor === 'red' ? 'red' : 'zinc'}>
            Candle {priceAction.lastCandleColor === 'green' ? 'Hijau 🟢' : priceAction.lastCandleColor === 'red' ? 'Merah 🔴' : 'Doji ⚪'}
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
        </div>
        <ul className="space-y-1">
          {priceAction.notes.map((note, i) => (
            <Note key={i} text={note} />
          ))}
        </ul>
      </Section>

      {/* ── 4. Volume ───────────────────────────────────────────────────── */}
      <Section
        id={`detail-volume-${analysis.ticker}`}
        title="4. Volume"
        icon={<BarChart2 className="size-3.5" />}
        accent="bg-cyan-500"
      >
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900/60 px-3 py-2">
            <div className="text-[10px] text-zinc-500 uppercase tracking-wide">Volume Hari Ini</div>
            <div className="mt-0.5 font-mono text-xs font-semibold text-zinc-800 dark:text-zinc-100">
              {new Intl.NumberFormat('id-ID').format(volume.lastVolume)}
            </div>
          </div>
          <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900/60 px-3 py-2">
            <div className="text-[10px] text-zinc-500 uppercase tracking-wide">Volume MA20</div>
            <div className="mt-0.5 font-mono text-xs font-semibold text-zinc-800 dark:text-zinc-100">
              {Number.isNaN(volume.volumeMa20) ? '–' : new Intl.NumberFormat('id-ID').format(Math.round(volume.volumeMa20))}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-2">
          <Pill tone={volume.isHighVolume ? 'green' : 'amber'}>
            RVOL {fmtN(volume.relativeVolume, 2)}×
          </Pill>
          <Pill tone={volume.volumeTrend === 'increasing' ? 'green' : volume.volumeTrend === 'decreasing' ? 'red' : 'zinc'}>
            Volume {volume.volumeTrend === 'increasing' ? 'Naik 📈' : volume.volumeTrend === 'decreasing' ? 'Turun 📉' : 'Normal'}
          </Pill>
        </div>
        <ul className="space-y-1">
          {volume.notes.map((note, i) => (
            <Note key={i} text={note} tone={volume.isHighVolume ? 'green' : 'zinc'} />
          ))}
        </ul>
        {!Number.isNaN(volume.idealBreakoutVolume) && (
          <div className="mt-2 rounded-lg bg-amber-50 dark:bg-amber-400/5 border border-amber-200 dark:border-amber-400/20 px-3 py-2">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Volume Ideal Breakout</p>
            <p className="text-xs text-amber-600 dark:text-amber-300 mt-0.5">
              {'>'} {new Intl.NumberFormat('id-ID').format(Math.round(volume.idealBreakoutVolume))} saham saat break resistance
            </p>
          </div>
        )}
      </Section>

      {/* ── 5. Indikator ────────────────────────────────────────────────── */}
      <Section
        id={`detail-indicator-${analysis.ticker}`}
        title="5. Indikator Teknikal"
        icon={<Zap className="size-3.5" />}
        accent="bg-amber-500"
      >
        {/* RSI */}
        <div className="space-y-1 mb-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">RSI (14)</span>
            <Pill tone={
              indicators.rsiZone === 'oversold' ? 'green' :
              indicators.rsiZone === 'overbought' || indicators.rsiZone === 'overbought_risk' ? 'red' :
              indicators.rsiZone === 'bullish_zone' ? 'green' : 'zinc'
            }>
              {fmtN(indicators.rsi14, 1)}
            </Pill>
          </div>
          <RsiBar value={indicators.rsi14} />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{indicators.rsiNote}</p>
        </div>

        {/* MACD */}
        <div className="space-y-1 mb-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">MACD (12,26,9)</span>
            <Pill tone={
              indicators.macdSignalType === 'bullish_crossover' || indicators.macdSignalType === 'bullish' ? 'green' :
              indicators.macdSignalType === 'bearish_crossover' || indicators.macdSignalType === 'bearish' ? 'red' : 'zinc'
            }>
              {indicators.macdSignalType.replace('_', ' ')}
            </Pill>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <KV label="MACD" value={fmtN(indicators.macdValue)} />
            <KV label="Signal" value={fmtN(indicators.macdSignal)} />
            <KV
              label="Histogram"
              value={fmtN(indicators.macdHistogram)}
              valueClass={indicators.macdHistogram >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}
            />
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{indicators.macdNote}</p>
        </div>

        {/* Stochastic */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Stochastic (14,3,3)</span>
            <Pill tone={
              indicators.stochZone === 'oversold' ? 'green' :
              indicators.stochZone === 'overbought' ? 'red' : 'zinc'
            }>
              {fmtN(indicators.stochK, 1)} / {fmtN(indicators.stochD, 1)}
            </Pill>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{indicators.stochNote}</p>
        </div>
      </Section>

      {/* ── 6. Rencana Trading ──────────────────────────────────────────── */}
      <Section
        id={`detail-plan-${analysis.ticker}`}
        title="6. Rencana Trading"
        icon={<Target className="size-3.5" />}
        accent="bg-rose-500"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2 bg-zinc-50 dark:bg-zinc-900/40">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">Bias rekomendasi:</span>
          <Pill tone={tradingPlan.recommendedBias === 'bullish' ? 'green' : tradingPlan.recommendedBias === 'bearish' ? 'red' : 'amber'}>
            {tradingPlan.recommendedBias === 'bullish' ? '🟢 Bullish' : tradingPlan.recommendedBias === 'bearish' ? '🔴 Bearish' : '🟡 Netral'}
          </Pill>
        </div>
      </Section>

      {/* ── 7. Kesimpulan ───────────────────────────────────────────────── */}
      <Section
        id={`detail-conclusion-${analysis.ticker}`}
        title="7. Kesimpulan"
        icon={<BookOpen className="size-3.5" />}
        accent="bg-zinc-600"
        defaultOpen={true}
      >
        <div className={cn(
          'rounded-xl border px-4 py-3 mb-3',
          conclusion.overallBias === 'bullish'
            ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-400/20 dark:bg-emerald-400/5'
            : conclusion.overallBias === 'bearish'
            ? 'border-rose-200 bg-rose-50 dark:border-rose-400/20 dark:bg-rose-400/5'
            : 'border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/40'
        )}>
          <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">{conclusion.summary}</p>
        </div>
        <div className="space-y-2">
          <div className="rounded-lg border border-blue-200 dark:border-blue-400/20 bg-blue-50 dark:bg-blue-400/5 px-3 py-2">
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-0.5">🔑 Level Kunci</p>
            <p className="text-xs text-blue-600 dark:text-blue-300 leading-relaxed">{conclusion.keyLevel}</p>
          </div>
          <div className="rounded-lg border border-amber-200 dark:border-amber-400/20 bg-amber-50 dark:bg-amber-400/5 px-3 py-2">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-0.5">
              <AlertTriangle className="inline size-3 mr-0.5" />
              Waspadai
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-300 leading-relaxed">{conclusion.watchOut}</p>
          </div>
        </div>
        <p className="mt-3 text-[10px] text-zinc-400 dark:text-zinc-600 italic">
          ⚠️ Analisis ini bersifat edukatif berbasis data EOD, bukan rekomendasi beli/jual. Selalu lakukan riset mandiri dan manajemen risiko.
        </p>
      </Section>
    </div>
  );
}
