'use client';

import { Flame, Search } from 'lucide-react';
import { POTENTIAL_FILTERS, potentialTargetOf, SIGNAL_ACTION_LABEL, SIGNAL_ACTIONS, SIGNAL_PATTERNS, SignalFilterState } from '@/domain/models/Signal';
import { cn } from '@/lib/format';

const SCORE_OPTIONS = [0, 50, 60, 70, 80] as const;

const FIELD = 'h-9 rounded-lg border border-(--sv-border) bg-(--sv-surface) px-3 text-sm text-(--sv-text) outline-none focus:border-(--sv-primary) focus:ring-2 focus:ring-(--sv-primary)/15';
const LABEL = 'text-[11px] font-semibold uppercase tracking-wide text-(--sv-muted)';

export function SignalFilters({
  value,
  onChange,
  maxDate,
}: {
  value: SignalFilterState;
  onChange: (next: SignalFilterState) => void;
  maxDate: string;
}) {
  const set = <K extends keyof SignalFilterState>(key: K, v: SignalFilterState[K]) => onChange({ ...value, [key]: v });
  const potential = potentialTargetOf(value.action) != null;

  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label="Filter signal" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        {(['ALL', ...SIGNAL_ACTIONS] as const).map((a) => {
          const active = value.action === a;
          return (
            <button
              key={a}
              type="button"
              aria-pressed={active}
              onClick={() => set('action', a)}
              className={cn(
                'shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                active
                  ? 'border-(--sv-primary) bg-(--sv-primary) text-(--sv-primary-fg)'
                  : 'border-(--sv-border) bg-(--sv-surface) text-(--sv-text) hover:bg-(--sv-bg)',
              )}
            >
              {a === 'ALL' ? 'ALL' : SIGNAL_ACTION_LABEL[a]}
            </button>
          );
        })}
        <span className="mx-0.5 w-px shrink-0 self-stretch bg-(--sv-border)" aria-hidden="true" />
        {POTENTIAL_FILTERS.map((f) => {
          const active = value.action === f;
          const target = potentialTargetOf(f);
          return (
            <button
              key={f}
              type="button"
              aria-pressed={active}
              onClick={() => set('action', active ? 'ALL' : f)}
              title={`Screener saham Rp50–999 dengan momentum & ruang teknikal ≥${target}% ke target berikutnya`}
              className={cn(
                'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                active
                  ? 'border-orange-500 bg-orange-500 text-white'
                  : 'border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100 dark:border-orange-400/40 dark:bg-orange-400/10 dark:text-orange-300',
              )}
            >
              <Flame className="size-3.5" strokeWidth={2.25} /> POTENTIAL {target}%
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <label className="flex flex-col gap-1">
          <span className={LABEL}>Tanggal</span>
          <input type="date" value={value.date} max={maxDate} onChange={(e) => e.target.value && set('date', e.target.value)} className={FIELD} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={LABEL}>Pattern</span>
          <select value={value.pattern} onChange={(e) => set('pattern', e.target.value as SignalFilterState['pattern'])} disabled={potential} title={potential ? 'Tidak berlaku untuk Potential 25%' : undefined} className={cn(FIELD, 'disabled:opacity-50')}>
            <option value="ALL">Semua pattern</option>
            {SIGNAL_PATTERNS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={LABEL}>Min. Score</span>
          <select value={value.minScore} onChange={(e) => set('minScore', Number(e.target.value))} className={FIELD}>
            {SCORE_OPTIONS.map((s) => <option key={s} value={s}>{s === 0 ? 'Semua score' : `≥ ${s}`}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={LABEL}>Cari ticker</span>
          <span className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-(--sv-muted)" strokeWidth={2} />
            <input
              type="search"
              value={value.search}
              onChange={(e) => set('search', e.target.value)}
              placeholder="BBRI, TLKM…"
              className={cn(FIELD, 'w-full pl-9')}
            />
          </span>
        </label>
      </div>
    </div>
  );
}
