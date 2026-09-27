/**
 * ScreenerBadges.tsx
 *
 * Clean chip badges for the Screener table. Colour rule: green = positive, red = negative,
 * amber = warning only, slate = neutral, navy = informational. Labels map existing domain values.
 */

import { MarketPhase, MarketPhaseResult } from '@/domain/analysis/marketPhase';
import { ValuationVerdict } from '@/domain/analysis/fundamentalPillars';
import { MomentumLevel, RiskLevel, VolumeLevel } from '@/domain/analysis/screenerVerdict';
import { FundamentalScore } from '@/domain/screener/presets';
import { Trend } from '@/domain/models/StockAnalysis';
import { cn } from '@/lib/format';

export type ChipTone = 'positive' | 'negative' | 'warning' | 'neutral' | 'info';

const TONE_CLASS: Record<ChipTone, string> = {
  positive: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/20',
  negative: 'bg-rose-50 text-rose-700 ring-rose-600/15 dark:bg-rose-400/10 dark:text-rose-300 dark:ring-rose-400/20',
  warning: 'bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/20',
  neutral: 'bg-slate-100 text-slate-600 ring-slate-500/10 dark:bg-slate-400/10 dark:text-slate-300 dark:ring-slate-400/20',
  info: 'bg-(--sv-primary-soft) text-(--sv-primary) ring-(--sv-primary)/15',
};

export function Chip({ tone, children, strong, className }: { tone: ChipTone; children: React.ReactNode; strong?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 text-xs ring-1 ring-inset',
        strong ? 'font-bold tracking-wide' : 'font-medium',
        TONE_CLASS[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Placeholder while a row's verdict is still loading. */
export function ChipSkeleton({ w = 'w-16' }: { w?: string }) {
  return <span className={cn('inline-block h-5 animate-pulse rounded-md bg-slate-200/70 dark:bg-slate-700/50', w)} />;
}

export function NotAvailable() {
  return <span className="text-sm text-(--sv-muted)">N/A</span>;
}

const PHASE_TONE: Record<MarketPhase, ChipTone> = {
  BULLISH_AWAL: 'positive',
  BREAKOUT: 'positive',
  PULLBACK: 'info',
  EXTENDED: 'warning',
  DISTRIBUTION: 'negative',
  BEARISH: 'negative',
  NEUTRAL: 'neutral',
};

export function MarketPhaseBadge({ phase }: { phase: MarketPhaseResult | null }) {
  if (!phase) return <NotAvailable />;
  return <Chip tone={PHASE_TONE[phase.phase]}>{phase.label}</Chip>;
}

const TREND_META: Record<Trend, { label: string; tone: ChipTone }> = {
  bullish: { label: 'Bullish', tone: 'positive' },
  sideways: { label: 'Sideways', tone: 'neutral' },
  bearish: { label: 'Bearish', tone: 'negative' },
};

export function TrendBadge({ trend }: { trend: Trend | null }) {
  if (!trend) return <NotAvailable />;
  const m = TREND_META[trend];
  return <Chip tone={m.tone}>{m.label}</Chip>;
}

const FUNDAMENTAL_META: Record<FundamentalScore['status'], { label: string; tone: ChipTone }> = {
  EXCELLENT: { label: 'Excellent', tone: 'positive' },
  GOOD: { label: 'Good', tone: 'positive' },
  FAIR: { label: 'Neutral', tone: 'neutral' },
  WEAK: { label: 'Weak', tone: 'negative' },
};

export function FundamentalBadge({ score }: { score: FundamentalScore }) {
  const m = FUNDAMENTAL_META[score.status];
  return (
    <span title={`Skor fundamental ${score.composite}/100`}>
      <Chip tone={m.tone}>{m.label}</Chip>
    </span>
  );
}

const MOMENTUM_META: Record<MomentumLevel, { label: string; tone: ChipTone }> = {
  STRONG: { label: 'Strong', tone: 'positive' },
  MODERATE: { label: 'Moderate', tone: 'neutral' },
  WEAK: { label: 'Weak', tone: 'negative' },
};

export function MomentumBadge({ momentum }: { momentum: MomentumLevel | null }) {
  if (!momentum) return <NotAvailable />;
  const m = MOMENTUM_META[momentum];
  return <Chip tone={m.tone}>{m.label}</Chip>;
}

const VOLUME_META: Record<VolumeLevel, { label: string; tone: ChipTone }> = {
  HIGH: { label: 'High', tone: 'info' },
  MEDIUM: { label: 'Medium', tone: 'neutral' },
  LOW: { label: 'Low', tone: 'neutral' },
};

export function VolumeBadge({ volume, rvol }: { volume: VolumeLevel | null; rvol: number | null }) {
  if (!volume) return <NotAvailable />;
  const m = VOLUME_META[volume];
  return (
    <span title={rvol != null ? `RVOL ${rvol.toFixed(2)}× rata-rata 20 hari` : undefined}>
      <Chip tone={m.tone}>{m.label}</Chip>
    </span>
  );
}

export const VALUATION_META: Record<ValuationVerdict, { label: string; tone: ChipTone }> = {
  UNDERVALUED: { label: 'UNDERVALUED', tone: 'positive' },
  WAJAR: { label: 'FAIR VALUE', tone: 'info' },
  PREMIUM: { label: 'PREMIUM', tone: 'warning' },
  OVERVALUED: { label: 'OVERVALUED', tone: 'negative' },
  TIDAK_DAPAT_DINILAI: { label: 'N/A', tone: 'neutral' },
};

export function ValuationBadge({ verdict }: { verdict: ValuationVerdict }) {
  const m = VALUATION_META[verdict];
  return <Chip tone={m.tone} strong>{m.label}</Chip>;
}

const RISK_META: Record<RiskLevel, { label: string; dot: string; text: string }> = {
  LOW: { label: 'Low', dot: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-300' },
  MEDIUM: { label: 'Medium', dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-300' },
  HIGH: { label: 'High', dot: 'bg-rose-500', text: 'text-rose-700 dark:text-rose-300' },
};

/** Tertiary read — dot + text rather than a filled chip, so it never competes with valuation. */
export function RiskBadge({ risk, reasons = [] }: { risk: RiskLevel | null; reasons?: string[] }) {
  if (!risk) return <NotAvailable />;
  const m = RISK_META[risk];
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', m.text)} title={reasons.length ? reasons.join(' · ') : undefined}>
      <span className={cn('size-1.5 rounded-full', m.dot)} />
      {m.label}
    </span>
  );
}
