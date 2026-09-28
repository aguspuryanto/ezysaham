'use client';

import { LucideIcon } from 'lucide-react';
import { ReactNode } from 'react';
import { cn } from '@/lib/format';
import { Tone } from '../format';

/** Semantic text colors (green = bullish, red = bearish, amber = warning, blue = info). */
export const TONE_TEXT: Record<Tone, string> = {
  positive: 'text-emerald-600 dark:text-emerald-400',
  negative: 'text-rose-600 dark:text-rose-400',
  warning: 'text-amber-600 dark:text-amber-400',
  info: 'text-blue-600 dark:text-blue-400',
  neutral: 'text-(--sv-text)',
};

const TONE_BADGE: Record<Tone, string> = {
  positive: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/25',
  negative: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-400/10 dark:text-rose-300 dark:ring-rose-400/25',
  warning: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/25',
  info: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-400/10 dark:text-blue-300 dark:ring-blue-400/25',
  neutral: 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-400/10 dark:text-slate-300 dark:ring-slate-400/25',
};

export const TONE_ICON_BG: Record<Tone, string> = {
  positive: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-400',
  negative: 'bg-rose-50 text-rose-600 dark:bg-rose-400/10 dark:text-rose-400',
  warning: 'bg-amber-50 text-amber-600 dark:bg-amber-400/10 dark:text-amber-400',
  info: 'bg-blue-50 text-blue-600 dark:bg-blue-400/10 dark:text-blue-400',
  neutral: 'bg-slate-100 text-slate-500 dark:bg-slate-400/10 dark:text-slate-400',
};

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset', TONE_BADGE[tone], className)}>
      {children}
    </span>
  );
}

export function Card({ children, className, as: As = 'section', ...rest }: {
  children: ReactNode;
  className?: string;
  as?: 'section' | 'div';
  'aria-labelledby'?: string;
}) {
  return (
    <As className={cn('rounded-xl border border-(--sv-border) bg-(--sv-surface) shadow-(--sv-shadow)', className)} {...rest}>
      {children}
    </As>
  );
}

/** Title row for the right-panel insight cards. */
export function PanelTitle({ icon: Icon, id, children, action }: { icon: LucideIcon; id?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-(--sv-border) px-4 py-3">
      <h2 id={id} className="flex items-center gap-2 text-[15px] font-semibold text-(--sv-text)">
        <Icon className="size-4.5 text-(--sv-primary)" strokeWidth={2} />
        {children}
      </h2>
      {action}
    </div>
  );
}

/** Label / value row used by Snapshot, Key Levels and Ownership cards. */
export function KeyValueRow({ label, children, labelClassName }: { label: ReactNode; children: ReactNode; labelClassName?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
      <span className={cn('text-(--sv-muted)', labelClassName)}>{label}</span>
      <span className="text-right font-semibold tabular-nums text-(--sv-text)">{children}</span>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-slate-200/80 dark:bg-slate-700/60', className)} />;
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="px-4 py-6 text-center text-sm text-(--sv-muted)">{children}</p>;
}
