'use client';

/**
 * SetupTableParts.tsx
 *
 * Building blocks shared by the trade-setup result tables (DayTradingTable, SwingTradingTable):
 * N/A placeholder, numeric cells, status chip, score breakdown popover, check list, identity
 * cells (compare checkbox / # / ticker), skeleton rows and empty state. Presentation only.
 */

import { CheckCircle2, SearchX, XCircle } from 'lucide-react';
import Link from 'next/link';
import { DATA_NA, SetupCheck } from '@/domain/screener/setupUtils';
import { cn, formatRupiah } from '@/lib/format';
import { Popover } from './Popover';
import { Chip, ChipTone } from './ScreenerBadges';
import { RowActions } from './ScreenerTable';

export const STICKY_BG = 'bg-(--sv-surface) group-hover:bg-slate-50 dark:group-hover:bg-slate-800/40';
export const TD = 'px-2.5 py-3 text-right text-sm text-(--sv-text)';

export const NA = () => <span className="text-[11px] font-medium text-(--sv-muted)" title={DATA_NA}>N/A</span>;
export const pct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2).replace('.', ',')}%`;
export const pctClass = (n: number) => (n > 0 ? 'text-emerald-600 dark:text-emerald-400' : n < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-(--sv-muted)');

export function Num({ v, digits = 0, rupiah, suffix }: { v: number | null; digits?: number; rupiah?: boolean; suffix?: string }) {
  if (v == null) return <NA />;
  return <span className="tabular-nums">{rupiah ? formatRupiah(Math.round(v)) : `${v.toFixed(digits).replace('.', ',')}${suffix ?? ''}`}</span>;
}

export function PctCell({ v }: { v: number | null }) {
  if (v == null) return <NA />;
  return <span className={cn('font-medium tabular-nums', pctClass(v))}>{pct(v)}</span>;
}

export type SetupTone = 'positive' | 'warning' | 'negative';
const TONE_ICON: Record<SetupTone, string> = { positive: '🟢', warning: '🟡', negative: '🔴' };

export function SetupStatusChip({ tone, label }: { tone: SetupTone; label: string }) {
  return <Chip tone={tone as ChipTone} strong>{TONE_ICON[tone]} {label}</Chip>;
}

/** Score coloured by the preset's own BUY/WAIT thresholds. */
export function ScoreCell({ total, rows, good, fair }: {
  total: number;
  rows: Array<[label: string, value: number, weight: string]>;
  good: number;
  fair: number;
}) {
  const cls = total >= good ? 'text-emerald-600 dark:text-emerald-400' : total >= fair ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400';
  return (
    <Popover
      label={`Rincian skor ${total}`}
      width={230}
      trigger={<span className={cn('text-[15px] font-bold tabular-nums', cls)}>{total}</span>}
      triggerClassName="rounded-md px-1.5 py-0.5 hover:bg-(--sv-bg)"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-(--sv-muted)">Rincian skor</p>
      <dl className="mt-2 space-y-1">
        {rows.map(([label, value, weight]) => (
          <div key={label} className="flex items-center justify-between gap-2 text-sm">
            <dt className="text-(--sv-muted)">{label} <span className="text-[11px]">({weight})</span></dt>
            <dd className="font-semibold tabular-nums text-(--sv-text)">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 border-t border-(--sv-border) pt-2 text-[11px] text-(--sv-muted)">Skor tinggi saja bukan sinyal BUY — status juga menuntut setup/trigger valid.</p>
    </Popover>
  );
}

export function CheckList({ title, checks }: { title: string; checks: SetupCheck[] }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase text-(--sv-muted)">{title}</p>
      <ul className="mt-1 space-y-0.5">
        {checks.map((c) => (
          <li key={c.label} className="flex items-start gap-1.5 text-xs">
            {c.ok
              ? <CheckCircle2 className={cn('mt-px size-3.5 shrink-0', c.missing ? 'text-(--sv-muted)' : 'text-emerald-600')} />
              : <XCircle className={cn('mt-px size-3.5 shrink-0', c.missing ? 'text-(--sv-muted)' : 'text-rose-600')} />}
            <span className={cn(c.missing && 'text-(--sv-muted)')}>{c.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Sticky compare-checkbox, row number and ticker cells. */
export function IdentityCells({ ticker, name, index, actions }: { ticker: string; name: string; index: number; actions: RowActions }) {
  return (
    <>
      <td className={cn('sticky left-0 z-[1] w-10 min-w-10 max-w-10 px-3 py-3', STICKY_BG)} onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={actions.isCompareSelected(ticker)}
          onChange={() => actions.onToggleCompare(ticker)}
          aria-label={`Pilih ${ticker} untuk dibandingkan`}
          className="size-4 cursor-pointer rounded accent-(--sv-primary)"
        />
      </td>
      <td className={cn('sticky left-10 z-[1] w-10 min-w-10 max-w-10 px-1 py-3 text-xs tabular-nums text-(--sv-muted)', STICKY_BG)}>{index}</td>
      <td className={cn('sticky left-20 z-[1] min-w-32 border-r border-(--sv-border) px-3 py-3', STICKY_BG)}>
        <Link href={`/screener/${ticker}`} onClick={(e) => e.stopPropagation()} className="text-[15px] font-bold text-(--sv-text) hover:text-(--sv-primary)">
          {ticker}
        </Link>
        <p className="max-w-28 truncate text-xs text-(--sv-muted)" title={name}>{name}</p>
      </td>
    </>
  );
}

/** Header cells matching IdentityCells. Render before the preset's own <Th> columns. */
export function IdentityHeadCells() {
  return (
    <>
      <th scope="col" className="sticky left-0 top-0 z-20 w-10 min-w-10 max-w-10 border-b border-(--sv-border) bg-(--sv-surface) px-3 py-3"><span className="sr-only">Pilih</span></th>
      <th scope="col" className="sticky left-10 top-0 z-20 w-10 min-w-10 max-w-10 border-b border-(--sv-border) bg-(--sv-surface) px-1 py-3 text-left text-xs font-semibold text-(--sv-muted)">#</th>
    </>
  );
}

export function SetupSkeletonRows({ columns, count = 8 }: { columns: number; count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <tr key={i} className="border-b border-(--sv-border)">
          {Array.from({ length: columns }, (__, j) => (
            <td key={j} className="px-3 py-4">
              <span className={cn('block h-4 animate-pulse rounded bg-slate-200/70 dark:bg-slate-700/50', j < 2 ? 'w-4' : j === 2 ? 'w-20' : 'w-12')} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function SetupEmptyState({ title, hint, onResetFilters }: { title: string; hint: string; onResetFilters?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-(--sv-border) bg-(--sv-surface) px-6 py-14 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-(--sv-primary-soft) text-(--sv-primary)">
        <SearchX className="size-6" strokeWidth={2} />
      </span>
      <p className="text-base font-semibold text-(--sv-text)">{title}</p>
      <p className="max-w-sm text-sm text-(--sv-muted)">{hint}</p>
      {onResetFilters && (
        <button type="button" onClick={onResetFilters} className="mt-1 rounded-lg border border-(--sv-border) px-3.5 py-2 text-sm font-medium text-(--sv-text) hover:bg-(--sv-bg)">
          Reset filter
        </button>
      )}
    </div>
  );
}
