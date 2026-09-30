'use client';

import { TradePlan as TradePlanData } from '@/domain/models/Signal';
import { cn } from '@/lib/format';
import { fmtNum } from '../../screener/detail/format';
import { fmtRR } from '../signalUi';

function Cell({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-(--sv-bg) px-2.5 py-2">
      <div className="text-[11px] font-medium uppercase tracking-wide text-(--sv-muted)">{label}</div>
      <div className={cn('mt-0.5 truncate text-sm font-semibold tabular-nums text-(--sv-text)', valueClass)}>{value}</div>
    </div>
  );
}

export function TradePlan({ plan, compact }: { plan: TradePlanData | null; compact?: boolean }) {
  if (!plan) {
    return (
      <p className="rounded-lg bg-(--sv-bg) px-3 py-2.5 text-sm text-(--sv-muted)">
        Tidak ada trade plan — sinyal ini tidak merekomendasikan entry.
      </p>
    );
  }

  return (
    <div className={cn('grid gap-2', compact ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-3')}>
      <Cell label="Entry" value={`${fmtNum(plan.entryLow)}–${fmtNum(plan.entryHigh)}`} valueClass="text-(--sv-primary)" />
      <Cell label="TP1" value={fmtNum(plan.tp1)} valueClass="text-emerald-600 dark:text-emerald-400" />
      <Cell label="TP2" value={fmtNum(plan.tp2)} valueClass="text-emerald-600 dark:text-emerald-400" />
      <Cell label="Stop Loss" value={fmtNum(plan.stopLoss)} valueClass="text-rose-600 dark:text-rose-400" />
      <Cell label="Risk/Reward" value={fmtRR(plan.riskReward)} />
      <Cell label="Holding" value={plan.holdingPeriod} />
    </div>
  );
}
