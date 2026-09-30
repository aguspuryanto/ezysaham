'use client';

/**
 * SectorCards.tsx
 *
 * Presentational pieces of the /sektor page in the Screener's `.sv-theme`
 * visual language (same Card / Badge / Skeleton primitives as Detail Emiten).
 */

import {
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  ChevronRight,
  Cpu,
  Factory,
  Flame,
  HeartPulse,
  Home,
  Landmark,
  LucideIcon,
  Mountain,
  RadioTower,
  ShoppingBag,
  ShoppingCart,
  Truck,
} from 'lucide-react';
import Link from 'next/link';
import { createElement } from 'react';
import { StockSummary } from '@/domain/models/Stock';
import { cn, formatCompact, formatPercent } from '@/lib/format';
import { Card, Skeleton } from '../../screener/detail/components/ui';
import { Breadth, SectorGroup } from '../sectorGroups';

const SECTOR_ICONS: Array<[pattern: RegExp, icon: LucideIcon]> = [
  [/energi|energy/i, Flame],
  [/baku|basic|material|tambang/i, Mountain],
  [/industri|industrial/i, Factory],
  [/non[- ]?primer|non[- ]?cyclical|cyclical/i, ShoppingBag],
  [/primer|konsumen|consumer/i, ShoppingCart],
  [/kesehatan|health/i, HeartPulse],
  [/keuangan|financ|bank/i, Landmark],
  [/properti|property|real estat/i, Home],
  [/teknologi|technolog/i, Cpu],
  [/infrastruktur|infrastructure/i, RadioTower],
  [/transport|logisti/i, Truck],
];

function SectorIcon({ sector, className }: { sector: string; className?: string }) {
  const icon = SECTOR_ICONS.find(([re]) => re.test(sector))?.[1] ?? Building2;
  return createElement(icon, { className, strokeWidth: 2 });
}

export function changeTone(value: number): string {
  return value > 0 ? 'text-emerald-600 dark:text-emerald-400' : value < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-(--sv-muted)';
}

export function ChangeText({ value, className }: { value: number; className?: string }) {
  const Icon = value >= 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn('inline-flex items-center gap-0.5 font-semibold tabular-nums', changeTone(value), className)}>
      {value !== 0 && <Icon className="size-[1.1em]" strokeWidth={2.25} />}
      {formatPercent(value)}
    </span>
  );
}

/** Advancers / unchanged / decliners as a stacked bar with counts. */
export function BreadthBar({ breadth, className }: { breadth: Breadth; className?: string }) {
  const total = Math.max(1, breadth.up + breadth.flat + breadth.down);
  const pct = (n: number) => `${(n / total) * 100}%`;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" aria-hidden="true">
        <div className="bg-emerald-500" style={{ width: pct(breadth.up) }} />
        <div className="bg-slate-400/70" style={{ width: pct(breadth.flat) }} />
        <div className="bg-rose-500" style={{ width: pct(breadth.down) }} />
      </div>
      <div className="flex justify-between text-xs tabular-nums text-(--sv-muted)">
        <span><b className="font-semibold text-emerald-600 dark:text-emerald-400">{breadth.up}</b> naik</span>
        <span><b className="font-semibold text-(--sv-text)">{breadth.flat}</b> tetap</span>
        <span><b className="font-semibold text-rose-600 dark:text-rose-400">{breadth.down}</b> turun</span>
      </div>
    </div>
  );
}

function MoverLink({ label, stock }: { label: string; stock: StockSummary | null }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-(--sv-muted)">{label}</div>
      {stock ? (
        <Link href={`/screener/${stock.ticker}`} className="flex items-baseline gap-1.5 text-sm hover:underline">
          <span className="font-semibold text-(--sv-text)">{stock.ticker}</span>
          <ChangeText value={stock.percentChange1D} className="text-xs" />
        </Link>
      ) : (
        <span className="text-sm text-(--sv-muted)">—</span>
      )}
    </div>
  );
}

export function SectorCard({ group, onSelect }: { group: SectorGroup; onSelect: (sector: string) => void }) {
  return (
    <Card as="div" className="flex flex-col transition-shadow hover:border-(--sv-primary)/40 hover:shadow-md">
      <button
        type="button"
        onClick={() => onSelect(group.sector)}
        className="flex items-start gap-3 rounded-t-xl p-4 pb-3 text-left focus-visible:outline-2 focus-visible:outline-(--sv-primary)"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-(--sv-primary-soft) text-(--sv-primary)">
          <SectorIcon sector={group.sector} className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold text-(--sv-text)">{group.sector}</span>
          <span className="block text-xs text-(--sv-muted)">
            {group.stocks.length} saham{group.subSectorCount > 0 && ` · ${group.subSectorCount} sub-sektor`}
          </span>
        </span>
        <ChangeText value={group.avgChange1D} className="shrink-0 text-sm" />
      </button>

      <div className="grid grid-cols-2 gap-3 border-t border-(--sv-border) px-4 py-3 text-sm">
        <div>
          <div className="text-[11px] text-(--sv-muted)">Market Cap</div>
          <div className="font-semibold tabular-nums text-(--sv-text)">{formatCompact(group.totalCapitalization)}</div>
        </div>
        <div>
          <div className="text-[11px] text-(--sv-muted)">Porsi Pasar</div>
          <div className="font-semibold tabular-nums text-(--sv-text)">{group.capShare.toFixed(1)}%</div>
        </div>
        <BreadthBar breadth={group.breadth} className="col-span-2" />
      </div>

      <div className="grid grid-cols-2 gap-3 border-t border-(--sv-border) px-4 py-3">
        <MoverLink label="Top gainer" stock={group.topGainer} />
        <MoverLink label="Top loser" stock={group.topLoser} />
      </div>

      <button
        type="button"
        onClick={() => onSelect(group.sector)}
        className="mt-auto flex items-center justify-center gap-1 rounded-b-xl border-t border-(--sv-border) px-4 py-2.5 text-sm font-medium text-(--sv-primary) hover:bg-(--sv-bg)"
      >
        Lihat {group.stocks.length} saham <ChevronRight className="size-4" />
      </button>
    </Card>
  );
}

export function SectorCardSkeleton() {
  return (
    <Card as="div" className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-lg" />
        <div className="flex-1 space-y-1.5"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-1/3" /></div>
      </div>
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-1.5 w-full" />
      <Skeleton className="h-8 w-full" />
    </Card>
  );
}

function StatTile({ label, children, hint }: { label: string; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <Card as="div" className="flex min-w-0 flex-col gap-1 p-4">
      <span className="text-xs font-medium text-(--sv-muted)">{label}</span>
      <div className="min-w-0 truncate text-lg font-bold text-(--sv-text)">{children}</div>
      {hint && <div className="text-xs text-(--sv-muted)">{hint}</div>}
    </Card>
  );
}

/** Market-wide KPI strip on the sector overview. */
export function SectorStats({ groups, stockCount, breadth }: { groups: SectorGroup[]; stockCount: number; breadth: Breadth }) {
  const byChange = [...groups].sort((a, b) => b.avgChange1D - a.avgChange1D);
  const strongest = byChange[0];
  const weakest = byChange[byChange.length - 1];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatTile label="Jumlah Sektor" hint={`${stockCount} saham tercatat`}>
        <span className="tabular-nums">{groups.length}</span>
      </StatTile>
      <StatTile label="Sektor Terkuat" hint={strongest && <ChangeText value={strongest.avgChange1D} />}>
        {strongest?.sector ?? '—'}
      </StatTile>
      <StatTile label="Sektor Terlemah" hint={weakest && <ChangeText value={weakest.avgChange1D} />}>
        {weakest?.sector ?? '—'}
      </StatTile>
      <Card as="div" className="flex flex-col gap-2 p-4">
        <span className="text-xs font-medium text-(--sv-muted)">Market Breadth</span>
        <BreadthBar breadth={breadth} className="mt-auto" />
      </Card>
    </div>
  );
}

export function SectorStatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: 4 }, (_, i) => (
        <Card as="div" key={i} className="space-y-2 p-4"><Skeleton className="h-3 w-1/2" /><Skeleton className="h-6 w-3/4" /></Card>
      ))}
    </div>
  );
}

/** Hero card of a single sector — mirrors StockHeader on Detail Emiten. */
export function SectorHeader({ group }: { group: SectorGroup }) {
  return (
    <Card className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-(--sv-primary) text-(--sv-primary-fg)">
          <SectorIcon sector={group.sector} className="size-7" />
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold text-(--sv-text) sm:text-3xl">{group.sector}</h1>
          <p className="mt-0.5 text-sm text-(--sv-muted)">
            {group.stocks.length} saham{group.subSectorCount > 0 && ` · ${group.subSectorCount} sub-sektor`} · rata-rata perubahan harian{' '}
            <ChangeText value={group.avgChange1D} />
          </p>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4 lg:w-[34rem] lg:shrink-0">
        <div>
          <dt className="text-xs text-(--sv-muted)">Market Cap</dt>
          <dd className="font-semibold tabular-nums text-(--sv-text)">{formatCompact(group.totalCapitalization)}</dd>
        </div>
        <div>
          <dt className="text-xs text-(--sv-muted)">Porsi Pasar</dt>
          <dd className="font-semibold tabular-nums text-(--sv-text)">{group.capShare.toFixed(1)}%</dd>
        </div>
        <div className="col-span-2">
          <dt className="mb-1.5 text-xs text-(--sv-muted)">Market Breadth</dt>
          <dd><BreadthBar breadth={group.breadth} /></dd>
        </div>
      </dl>
    </Card>
  );
}

export function SectorHeaderSkeleton() {
  return (
    <Card className="flex items-center gap-4 p-5">
      <Skeleton className="size-14 rounded-lg" />
      <div className="flex-1 space-y-2"><Skeleton className="h-7 w-1/3" /><Skeleton className="h-4 w-1/2" /></div>
    </Card>
  );
}

export function SectorBreadcrumb({ sector, onBack }: { sector: string | null; onBack: () => void }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm">
      <ol className="flex flex-wrap items-center gap-1.5 text-(--sv-muted)">
        <li>
          <Link href="/" aria-label="Beranda" className="flex items-center hover:text-(--sv-text)">
            <Home className="size-4" strokeWidth={2} />
          </Link>
        </li>
        <ChevronRight className="size-3.5" aria-hidden="true" />
        {sector ? (
          <>
            <li>
              <button type="button" onClick={onBack} className="hover:text-(--sv-text)">Sektor</button>
            </li>
            <ChevronRight className="size-3.5" aria-hidden="true" />
            <li aria-current="page" className="font-medium text-(--sv-text)">{sector}</li>
          </>
        ) : (
          <li aria-current="page" className="font-medium text-(--sv-text)">Sektor</li>
        )}
      </ol>
    </nav>
  );
}
