'use client';

import { Check, ChevronRight, TriangleAlert, X, Zap } from 'lucide-react';
import { SignalReason, StockSignal } from '@/domain/models/Signal';
import { cn } from '@/lib/format';
import { TONE_TEXT } from '../../screener/detail/components/ui';
import { fmtNum, fmtPct, toneOf } from '../../screener/detail/format';
import { BuyAllowedPill, SaraScore, SignalBadge } from './SignalBadge';
import { TradePlan } from './TradePlan';

const SECTION_TITLE = 'text-[11px] font-semibold uppercase tracking-wide text-(--sv-muted)';

export function WhyList({ reasons, limit }: { reasons: SignalReason[]; limit?: number }) {
  const shown = limit ? reasons.slice(0, limit) : reasons;
  const hidden = reasons.length - shown.length;
  return (
    <ul className="space-y-1">
      {shown.map((r) => (
        <li key={r.label} className="flex items-start gap-1.5 text-sm text-(--sv-text)">
          {r.passed
            ? <Check className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} />
            : <X className="mt-0.5 size-4 shrink-0 text-rose-500 dark:text-rose-400" strokeWidth={2.5} />}
          <span className={cn(!r.passed && 'text-(--sv-muted)')}>{r.label}</span>
        </li>
      ))}
      {hidden > 0 && <li className="pl-5.5 text-xs text-(--sv-muted)">+{hidden} alasan lainnya</li>}
    </ul>
  );
}

export function RiskList({ risks }: { risks: string[] }) {
  if (risks.length === 0) return <p className="text-sm text-(--sv-muted)">Tidak ada risiko utama tercatat.</p>;
  return (
    <ul className="space-y-1">
      {risks.map((r) => (
        <li key={r} className="flex items-start gap-1.5 text-sm text-(--sv-text)">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-500" strokeWidth={2} />
          {r}
        </li>
      ))}
    </ul>
  );
}

export function DecisionBlock({ signal }: { signal: StockSignal }) {
  const { buyAllowed, trigger } = signal.decision;
  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2.5',
        buyAllowed
          ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-400/25 dark:bg-emerald-400/5'
          : 'border-(--sv-border) bg-(--sv-bg)',
      )}
    >
      <BuyAllowedPill allowed={buyAllowed} />
      <p className="mt-2 flex items-start gap-1.5 text-sm text-(--sv-text)">
        <Zap className="mt-0.5 size-4 shrink-0 text-(--sv-primary)" strokeWidth={2} />
        <span><span className="text-(--sv-muted)">Trigger:</span> <span className="font-medium">{trigger}</span></span>
      </p>
    </div>
  );
}

export function SignalHeading({ signal }: { signal: StockSignal }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-(--sv-text)">{signal.ticker}</span>
          <SignalBadge action={signal.action} />
        </div>
        <p className="truncate text-xs text-(--sv-muted)">{signal.companyName}</p>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-lg font-bold tabular-nums text-(--sv-text)">Rp{fmtNum(signal.price)}</div>
        <div className={cn('text-xs font-semibold tabular-nums', TONE_TEXT[toneOf(signal.changePct)])}>{fmtPct(signal.changePct)}</div>
      </div>
    </div>
  );
}

/** Actionable summary card — answers "Boleh entry?" at a glance; click for full detail. */
export function SignalCard({ signal, onSelect }: { signal: StockSignal; onSelect: (s: StockSignal) => void }) {
  return (
    <article
      className="group flex cursor-pointer flex-col gap-4 rounded-xl border border-(--sv-border) bg-(--sv-surface) p-4 shadow-(--sv-shadow) transition-colors hover:border-(--sv-primary)/40"
      onClick={() => onSelect(signal)}
    >
      <SignalHeading signal={signal} />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className={SECTION_TITLE}>SARA Score</div>
          <div className="mt-1"><SaraScore score={signal.saraScore} /></div>
        </div>
        <div>
          <div className={SECTION_TITLE}>Confidence</div>
          <div className="mt-1 text-xl font-bold tabular-nums text-(--sv-text)">{signal.confidence}%</div>
          <div className="text-xs text-(--sv-muted)">{signal.pattern}</div>
        </div>
      </div>

      <DecisionBlock signal={signal} />

      <div>
        <div className={cn(SECTION_TITLE, 'mb-1.5')}>Trade Plan</div>
        <TradePlan plan={signal.tradePlan} compact />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <div className={cn(SECTION_TITLE, 'mb-1.5')}>Why</div>
          <WhyList reasons={signal.reasons} limit={4} />
        </div>
        <div>
          <div className={cn(SECTION_TITLE, 'mb-1.5')}>Risk</div>
          <RiskList risks={signal.risks} />
        </div>
      </div>

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onSelect(signal); }}
        className="mt-auto inline-flex items-center justify-center gap-1 rounded-lg border border-(--sv-border) py-2 text-sm font-medium text-(--sv-primary) group-hover:bg-(--sv-primary-soft)"
      >
        Lihat detail sinyal <ChevronRight className="size-4" strokeWidth={2} />
      </button>
    </article>
  );
}
