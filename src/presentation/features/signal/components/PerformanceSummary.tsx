'use client';

import { Activity, LucideIcon, Radar, Target, TrendingUp } from 'lucide-react';
import { SignalPerformanceSummary } from '@/domain/models/Signal';
import { cn } from '@/lib/format';
import { Card, Skeleton, TONE_ICON_BG, TONE_TEXT } from '../../screener/detail/components/ui';
import { fmtNum, fmtPct, Tone, toneOf } from '../../screener/detail/format';

function Stat({ icon: Icon, label, value, tone, hint }: { icon: LucideIcon; label: string; value: string; tone: Tone; hint: string }) {
  return (
    <Card as="div" className="flex items-center gap-3 p-4">
      <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', TONE_ICON_BG[tone])}>
        <Icon className="size-5" strokeWidth={2} />
      </span>
      <div className="min-w-0">
        <div className="text-xs text-(--sv-muted)">{label}</div>
        <div className={cn('text-xl font-bold tabular-nums', tone === 'neutral' || tone === 'info' ? 'text-(--sv-text)' : TONE_TEXT[tone])}>{value}</div>
        <div className="truncate text-[11px] text-(--sv-muted)">{hint}</div>
      </div>
    </Card>
  );
}

export function PerformanceSummary({ data }: { data: SignalPerformanceSummary }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat icon={Radar} label="Signals" value={fmtNum(data.totalSignals)} tone="info" hint={data.periodLabel} />
      <Stat icon={Target} label="Win Rate" value={`${fmtNum(data.winRate, 1)}%`} tone={data.winRate >= 50 ? 'positive' : 'warning'} hint="Hit TP1 sebelum SL" />
      <Stat icon={TrendingUp} label="Avg Return" value={fmtPct(data.avgReturn, 1)} tone={toneOf(data.avgReturn)} hint="Per sinyal selesai" />
      <Stat icon={Activity} label="Active Signals" value={fmtNum(data.activeSignals)} tone="info" hint="Belum TP / SL" />
    </div>
  );
}

export function PerformanceSummarySkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: 4 }, (_, i) => (
        <Card as="div" key={i} className="flex items-center gap-3 p-4">
          <Skeleton className="size-10 rounded-lg" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-5 w-20" />
          </div>
        </Card>
      ))}
    </div>
  );
}
