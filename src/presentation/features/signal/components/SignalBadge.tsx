'use client';

import { CircleCheck, CircleX } from 'lucide-react';
import { SIGNAL_ACTION_LABEL, SignalAction } from '@/domain/models/Signal';
import { cn } from '@/lib/format';
import { Badge, TONE_TEXT } from '../../screener/detail/components/ui';
import { ACTION_TONE, SCORE_BAR, scoreTone } from '../signalUi';

export function SignalBadge({ action, className }: { action: SignalAction; className?: string }) {
  return (
    <Badge tone={ACTION_TONE[action]} className={cn('whitespace-nowrap tracking-wide', className)}>
      {SIGNAL_ACTION_LABEL[action]}
    </Badge>
  );
}

/** Horizontal 0–100 progress bar, colored by strength. */
export function ScoreBar({ score, className }: { score: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, score));
  return (
    <div
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className={cn('h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700', className)}
    >
      <div className={cn('h-full rounded-full', SCORE_BAR[scoreTone(pct)])} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** "82/100" with its bar underneath. */
export function SaraScore({ score, size = 'md' }: { score: number; size?: 'md' | 'lg' }) {
  return (
    <div className="min-w-0">
      <div className="flex items-baseline gap-1">
        <span className={cn('font-bold tabular-nums', TONE_TEXT[scoreTone(score)], size === 'lg' ? 'text-3xl' : 'text-xl')}>{score}</span>
        <span className="text-xs text-(--sv-muted)">/100</span>
      </div>
      <ScoreBar score={score} className="mt-1.5" />
    </div>
  );
}

/** The single answer to "Boleh entry?". */
export function BuyAllowedPill({ allowed, compact }: { allowed: boolean; compact?: boolean }) {
  const Icon = allowed ? CircleCheck : CircleX;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg font-bold',
        compact ? 'px-2 py-0.5 text-xs' : 'px-3 py-1.5 text-sm',
        allowed
          ? 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950'
          : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
      )}
    >
      <Icon className={compact ? 'size-3.5' : 'size-4'} strokeWidth={2.5} />
      {compact ? (allowed ? 'YES' : 'NO') : `BUY ALLOWED: ${allowed ? 'YES' : 'NO'}`}
    </span>
  );
}
