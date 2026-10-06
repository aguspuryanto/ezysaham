'use client';

/** Shared tones, emoji and layout primitives for the EzySaham AI (Decision Engine v3) report. */

import { ReactNode } from 'react';
import { Decision, Level } from '@/domain/analysis/decisionEngineV3';
import { Check, MomentumSignal, RiskLevel } from '@/domain/analysis/momentumSpeculation';
import { cn } from '@/lib/format';
import { Tone } from '../../format';
import { Badge } from '../ui';

export const DECISION_TONE: Record<Decision, Tone> = { BUY: 'positive', WAIT: 'warning', AVOID: 'negative' };
export const DECISION_EMOJI: Record<Decision, string> = { BUY: '🟢', WAIT: '🟡', AVOID: '🔴' };
export const LEVEL_TONE: Record<Level, Tone> = { LOW: 'positive', MEDIUM: 'warning', HIGH: 'negative' };
export const LEVEL_EMOJI: Record<Level, string> = { LOW: '🟢', MEDIUM: '🟡', HIGH: '🔴' };
export const SIGNAL_EMOJI: Record<MomentumSignal, string> = { green: '🟢', yellow: '🟡', red: '🔴', na: '⚪' };
export const SIGNAL_TONE: Record<MomentumSignal, Tone> = { green: 'positive', yellow: 'warning', red: 'negative', na: 'neutral' };
export const riskLevelOf = (l: RiskLevel): Level | null => (l === 'NA' ? null : l);

export const scoreTone = (v: number | null): Tone => (v == null ? 'neutral' : v >= 65 ? 'positive' : v >= 40 ? 'warning' : 'negative');

export function DecisionBadge({ status, className }: { status: Decision; className?: string }) {
  return <Badge tone={DECISION_TONE[status]} className={className}>{DECISION_EMOJI[status]} {status}</Badge>;
}

export function LevelBadge({ level, children }: { level: Level | null; children?: ReactNode }) {
  if (level == null) return <Badge tone="neutral">⚪ {children ?? 'N/A'}</Badge>;
  return <Badge tone={LEVEL_TONE[level]}>{LEVEL_EMOJI[level]} {children ?? level}</Badge>;
}

export function Caption({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('text-[11px] font-semibold uppercase tracking-wide text-(--sv-muted)', className)}>{children}</p>;
}

export function Section({ title, verdict, children }: { title: string; verdict?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border border-(--sv-border) bg-(--sv-bg)/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-(--sv-text)">{title}</h3>
        {verdict}
      </div>
      {children}
    </section>
  );
}

export function Stat({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-(--sv-surface) px-3 py-2 text-sm">
      <span className="text-(--sv-muted)">{label}</span>
      {children}
    </div>
  );
}

export function Bullets({ items, className }: { items: string[]; className?: string }) {
  return (
    <ul className={cn('space-y-1 text-sm', className)}>
      {items.map((s) => (
        <li key={s} className="flex items-start gap-2">
          <span className="mt-2 size-1 shrink-0 rounded-full bg-current opacity-60" />
          {s}
        </li>
      ))}
    </ul>
  );
}

/** ✅ / ⏳ rule list. */
export function RuleList({ rules, className }: { rules: Array<{ label: string; ok: boolean }>; className?: string }) {
  return (
    <ul className={cn('grid gap-1 text-sm sm:grid-cols-2', className)}>
      {rules.map((r) => (
        <li key={r.label} className={cn('flex items-start gap-2', !r.ok && 'text-(--sv-muted)')}>
          <span>{r.ok ? '✅' : '⏳'}</span>{r.label}
        </li>
      ))}
    </ul>
  );
}

/** Indicator check rows (v2 evidence: VWAP / EMA / RVOL / valuation). */
export function CheckList({ checks }: { checks: Check[] }) {
  return (
    <ul className="divide-y divide-(--sv-border)/70 text-sm">
      {checks.map((c) => (
        <li key={c.label} className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-start sm:gap-3">
          <span className="shrink-0 text-(--sv-muted) sm:w-36">{SIGNAL_EMOJI[c.signal]} {c.label}</span>
          <span className="min-w-0 flex-1">
            <span className="font-medium tabular-nums text-(--sv-text)">{c.value}</span>
            <span className="block text-xs text-(--sv-muted)">{c.note}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

const CALLOUT: Record<'warning' | 'negative' | 'positive', string> = {
  warning: 'border-amber-200 bg-amber-50/60 text-amber-900 dark:border-amber-400/25 dark:bg-amber-400/5 dark:text-amber-200',
  negative: 'border-rose-200 bg-rose-50/60 text-rose-800 dark:border-rose-400/25 dark:bg-rose-400/5 dark:text-rose-200',
  positive: 'border-emerald-200 bg-emerald-50/60 text-emerald-900 dark:border-emerald-400/25 dark:bg-emerald-400/5 dark:text-emerald-200',
};

export function Callout({ tone, children, className }: { tone: keyof typeof CALLOUT; children: ReactNode; className?: string }) {
  return <div className={cn('rounded-lg border p-3 text-sm', CALLOUT[tone], className)}>{children}</div>;
}
