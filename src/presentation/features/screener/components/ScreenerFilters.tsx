'use client';

import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/format';
import {
  CAP_OPTIONS,
  countActiveFilters,
  FilterOption,
  FUNDAMENTAL_OPTIONS,
  MOMENTUM_OPTIONS,
  PHASE_OPTIONS,
  PRICE_OPTIONS,
  RISK_OPTIONS,
  ScreenerFilterState,
  TREND_OPTIONS,
  VALUATION_OPTIONS,
  VOLUME_OPTIONS,
} from '../screenerFilters';

function Select<V extends string>({ label, value, options, onChange }: {
  label: string; value: V; options: FilterOption<V>[]; onChange: (v: V) => void;
}) {
  const active = value !== 'all';
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-(--sv-muted)">{label}</span>
      <span className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as V)}
          className={cn(
            'h-9 w-full appearance-none rounded-lg border bg-(--sv-surface) pl-3 pr-8 text-sm text-(--sv-text) outline-none focus:ring-2 focus:ring-(--sv-primary)/15',
            active ? 'border-(--sv-primary) font-medium' : 'border-(--sv-border)',
          )}
        >
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-(--sv-muted)" strokeWidth={2} />
      </span>
    </label>
  );
}

export function ScreenerFilters({
  draft,
  onChange,
  sectors,
  onApply,
  onReset,
  dirty,
}: {
  draft: ScreenerFilterState;
  onChange: (next: ScreenerFilterState) => void;
  sectors: string[];
  onApply: () => void;
  onReset: () => void;
  /** Draft differs from the applied filters. */
  dirty: boolean;
}) {
  const set = <K extends keyof ScreenerFilterState>(k: K) => (v: ScreenerFilterState[K]) => onChange({ ...draft, [k]: v });
  const active = countActiveFilters(draft);
  const sectorOptions: FilterOption<string>[] = [{ value: 'all', label: 'Semua Sektor' }, ...sectors.map((s) => ({ value: s, label: s }))];

  return (
    <section aria-label="Filter screener" className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-(--sv-text)">
          <SlidersHorizontal className="size-4" strokeWidth={2} />
          Filter Screener
          {active > 0 && <span className="rounded-full bg-(--sv-primary) px-1.5 text-[11px] text-(--sv-primary-fg) tabular-nums">{active}</span>}
        </h2>
        <button type="button" onClick={onReset} className="text-xs font-semibold text-(--sv-primary) hover:underline">
          Reset
        </button>
      </div>

      <Select label="Sektor" value={draft.sector} options={sectorOptions} onChange={set('sector')} />
      <div className="grid grid-cols-2 gap-2.5">
        <Select label="Market Cap" value={draft.cap} options={CAP_OPTIONS} onChange={set('cap')} />
        <Select label="Harga" value={draft.price} options={PRICE_OPTIONS} onChange={set('price')} />
      </div>
      <Select label="Volume" value={draft.volume} options={VOLUME_OPTIONS} onChange={set('volume')} />

      <div className="mt-1 border-t border-(--sv-border) pt-3">
        <p className="mb-2.5 text-[11px] leading-snug text-(--sv-muted)">
          Filter di bawah menganalisis setiap kandidat (riwayat harga + fundamental), jadi butuh waktu memuat.
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          <Select label="Market Phase" value={draft.phase} options={PHASE_OPTIONS} onChange={set('phase')} />
          <Select label="Trend" value={draft.trend} options={TREND_OPTIONS} onChange={set('trend')} />
          <Select label="Fundamental" value={draft.fundamental} options={FUNDAMENTAL_OPTIONS} onChange={set('fundamental')} />
          <Select label="Momentum" value={draft.momentum} options={MOMENTUM_OPTIONS} onChange={set('momentum')} />
          <Select label="Valuation" value={draft.valuation} options={VALUATION_OPTIONS} onChange={set('valuation')} />
          <Select label="Risk" value={draft.risk} options={RISK_OPTIONS} onChange={set('risk')} />
        </div>
      </div>

      <button
        type="button"
        onClick={onApply}
        disabled={!dirty}
        className="mt-1 h-10 rounded-lg bg-(--sv-primary) text-sm font-semibold text-(--sv-primary-fg) transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        Terapkan Filter
      </button>
    </section>
  );
}
