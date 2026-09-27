'use client';

/**
 * ScreenerTable.tsx
 *
 * Screener results — desktop table (sticky header + sticky identity columns) and a mobile card
 * list. Hierarchy: PRIMARY (Kode, Harga, Fair Value, Upside, Valuation) is bold/large, SECONDARY
 * (Phase, Trend, Fundamental, Momentum, Volume) are small chips, TERTIARY (Risk) is dot + text.
 * Presentation only: every value comes from StockSummary or the row's ScreenerVerdict.
 */

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  FlaskConical,
  GitCompare,
  History,
  MoreHorizontal,
  SearchX,
  Sparkles,
  Star,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ScreenerVerdict } from '@/domain/analysis/screenerVerdict';
import { buildScreenerInsight } from '@/domain/analysis/screenerInsight';
import { cn, formatCompact, formatPercent, formatRupiah } from '@/lib/format';
import { SCREENER_GLOSSARY } from '../screenerGlossary';
import { InfoTip, Popover } from './Popover';
import { ScreenerResult } from './ResultsTable';
import {
  ChipSkeleton,
  FundamentalBadge,
  MarketPhaseBadge,
  MomentumBadge,
  NotAvailable,
  RiskBadge,
  TrendBadge,
  ValuationBadge,
  VolumeBadge,
} from './ScreenerBadges';

export type ScreenerSortKey = 'ticker' | 'change' | 'price' | 'volume' | 'fundamental' | 'upside';
export interface ScreenerSort { key: ScreenerSortKey; dir: 'asc' | 'desc' }
/** Sort keys that need a row's verdict (lazy) rather than StockSummary. */
export const VERDICT_SORT_KEYS: ScreenerSortKey[] = ['fundamental', 'upside'];

interface RowActions {
  isWatchlisted: (ticker: string) => boolean;
  onToggleWatchlist: (ticker: string) => void;
  isCompareSelected: (ticker: string) => boolean;
  onToggleCompare: (ticker: string) => void;
}

const upsideClass = (n: number | null) =>
  n == null ? 'text-(--sv-muted)' : n >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400';
const pctTxt = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2).replace('.', ',')}%`;

// ── Header ───────────────────────────────────────────────────────────────────
function Th({ children, className, sortKey, sort, onSort, tip, align = 'left' }: {
  children: React.ReactNode; className?: string; sortKey?: ScreenerSortKey; sort?: ScreenerSort; onSort?: (k: ScreenerSortKey) => void;
  tip?: { term: string; text: string }; align?: 'left' | 'right';
}) {
  const active = sortKey != null && sort?.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort!.dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : undefined}
      className={cn('sticky top-0 z-10 whitespace-nowrap border-b border-(--sv-border) bg-(--sv-surface) px-3 py-3 text-xs font-semibold text-(--sv-muted)', align === 'right' && 'text-right', className)}
    >
      <span className={cn('inline-flex items-center gap-1', align === 'right' && 'justify-end')}>
        {sortKey && onSort ? (
          <button type="button" onClick={() => onSort(sortKey)} className={cn('inline-flex items-center gap-1 hover:text-(--sv-text)', active && 'text-(--sv-text)')}>
            {children}
            <Icon className={cn('size-3.5', !active && 'opacity-40')} strokeWidth={2} />
          </button>
        ) : children}
        {tip && <InfoTip term={tip.term} text={tip.text} />}
      </span>
    </th>
  );
}

// ── Shared cells ─────────────────────────────────────────────────────────────
function FairValueCell({ v }: { v?: ScreenerVerdict }) {
  if (!v) return <ChipSkeleton w="w-24" />;
  const { fairLow, fairHigh, fairMedian } = v.valuation;
  if (fairMedian == null) return <NotAvailable />;
  return (
    <div className="leading-tight">
      <p className="whitespace-nowrap text-sm font-semibold tabular-nums text-(--sv-text)">
        {fairLow != null && fairHigh != null && fairLow !== fairHigh
          ? `${formatRupiah(Math.round(fairLow))} – ${formatRupiah(Math.round(fairHigh)).replace('Rp', '').trim()}`
          : formatRupiah(Math.round(fairMedian))}
      </p>
      <p className="text-xs tabular-nums text-(--sv-muted)">Median {formatRupiah(Math.round(fairMedian))}</p>
    </div>
  );
}

function UpsideCell({ v, large }: { v?: ScreenerVerdict; large?: boolean }) {
  if (!v) return <ChipSkeleton w="w-14" />;
  const u = v.valuation.upsidePct;
  if (u == null) return <NotAvailable />;
  return <span className={cn('font-bold tabular-nums', large ? 'text-base' : 'text-sm', upsideClass(u))}>{pctTxt(u)}</span>;
}

function InsightButton({ v, reasons }: { v?: ScreenerVerdict; reasons: string[] }) {
  if (!v) return <span className="inline-flex size-8 items-center justify-center text-(--sv-muted) opacity-40"><Sparkles className="size-4" /></span>;
  const insight = buildScreenerInsight(v);
  return (
    <Popover
      label="AI Insight"
      width={300}
      trigger={<Sparkles className="size-4" strokeWidth={2} />}
      triggerClassName="size-8 rounded-lg text-(--sv-primary) hover:bg-(--sv-primary-soft)"
    >
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-(--sv-primary)">
        <Sparkles className="size-3.5" /> AI Insight
      </p>
      <dl className="mt-2 space-y-1.5">
        <div><dt className="text-[11px] font-semibold uppercase text-(--sv-muted)">Teknikal</dt><dd>{insight.technical}</dd></div>
        <div><dt className="text-[11px] font-semibold uppercase text-(--sv-muted)">Valuasi</dt><dd>{insight.valuation}</dd></div>
        <div><dt className="text-[11px] font-semibold uppercase text-(--sv-muted)">Risiko</dt><dd>{insight.risk}</dd></div>
        {reasons.length > 0 && (
          <div><dt className="text-[11px] font-semibold uppercase text-(--sv-muted)">Kriteria preset terpenuhi</dt><dd>{reasons.slice(0, 4).join(' · ')}</dd></div>
        )}
      </dl>
      <p className="mt-2 border-t border-(--sv-border) pt-2 text-[11px] text-(--sv-muted)">Bukan rekomendasi beli/jual.</p>
    </Popover>
  );
}

function ActionsMenu({ ticker, actions }: { ticker: string; actions: RowActions }) {
  const watch = actions.isWatchlisted(ticker);
  const compare = actions.isCompareSelected(ticker);
  const item = 'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-(--sv-text) hover:bg-(--sv-bg)';
  return (
    <Popover
      mode="click"
      label={`Aksi untuk ${ticker}`}
      width={200}
      className="p-1.5"
      trigger={<MoreHorizontal className="size-4" strokeWidth={2} />}
      triggerClassName="size-8 rounded-lg text-(--sv-muted) hover:bg-(--sv-bg) hover:text-(--sv-text)"
    >
      {(close) => (
        <div className="flex flex-col">
          <Link href={`/screener/${ticker}`} className={item}><BarChart3 className="size-4" /> Analisis detail</Link>
          <Link href={`/history/${ticker}`} className={item}><History className="size-4" /> Riwayat teknikal</Link>
          <Link href={`/backtest/${ticker}`} className={item}><FlaskConical className="size-4" /> Backtest</Link>
          <button type="button" className={item} onClick={() => { actions.onToggleCompare(ticker); close(); }}>
            <GitCompare className="size-4" /> {compare ? 'Batal bandingkan' : 'Bandingkan'}
          </button>
          <button type="button" className={item} onClick={() => { actions.onToggleWatchlist(ticker); close(); }}>
            <Star className={cn('size-4', watch && 'fill-amber-400 text-amber-500')} /> {watch ? 'Hapus dari watchlist' : 'Tambah ke watchlist'}
          </button>
        </div>
      )}
    </Popover>
  );
}

function WatchStar({ ticker, actions }: { ticker: string; actions: RowActions }) {
  const active = actions.isWatchlisted(ticker);
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); actions.onToggleWatchlist(ticker); }}
      aria-label={active ? `Hapus ${ticker} dari watchlist` : `Tambah ${ticker} ke watchlist`}
      aria-pressed={active}
      className="flex size-8 items-center justify-center rounded-lg text-(--sv-muted) hover:bg-(--sv-bg)"
    >
      <Star className={cn('size-4', active && 'fill-amber-400 text-amber-500')} strokeWidth={2} />
    </button>
  );
}

// ── Desktop row ──────────────────────────────────────────────────────────────
const STICKY_BG = 'bg-(--sv-surface) group-hover:bg-slate-50 dark:group-hover:bg-slate-800/40';

function Row({ result, index, v, actions }: { result: ScreenerResult; index: number; v?: ScreenerVerdict; actions: RowActions }) {
  const router = useRouter();
  const { summary: s, evaluation } = result;
  const selected = actions.isCompareSelected(s.ticker);
  const stale = evaluation.freshness && evaluation.freshness.tier !== 'fresh' ? evaluation.freshness : null;

  return (
    <tr
      onClick={() => router.push(`/screener/${s.ticker}`)}
      className="group cursor-pointer border-b border-(--sv-border) last:border-b-0 hover:bg-slate-50 dark:hover:bg-slate-800/40"
    >
      <td className={cn('sticky left-0 z-[1] w-10 min-w-10 max-w-10 px-3 py-3.5', STICKY_BG)} onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={selected}
          onChange={() => actions.onToggleCompare(s.ticker)}
          aria-label={`Pilih ${s.ticker} untuk dibandingkan`}
          className="size-4 cursor-pointer rounded accent-(--sv-primary)"
        />
      </td>
      <td className={cn('sticky left-10 z-[1] w-10 min-w-10 max-w-10 px-1 py-3.5 text-xs tabular-nums text-(--sv-muted)', STICKY_BG)}>{index}</td>
      <td className={cn('sticky left-20 z-[1] min-w-44 border-r border-(--sv-border) px-3 py-3.5', STICKY_BG)}>
        <Link href={`/screener/${s.ticker}`} onClick={(e) => e.stopPropagation()} className="text-[15px] font-bold text-(--sv-text) hover:text-(--sv-primary)">
          {s.ticker}
        </Link>
        <p className="max-w-40 truncate text-xs text-(--sv-muted)" title={s.name}>{s.name}</p>
      </td>
      <td className="px-2.5 py-3.5 text-right">
        <p className="whitespace-nowrap text-[15px] font-bold tabular-nums text-(--sv-text)">{formatRupiah(s.lastClose)}</p>
        <p className={cn('text-xs font-medium tabular-nums', s.percentChange1D >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
          {formatPercent(s.percentChange1D)}
        </p>
        {stale && <p className="text-[11px] text-amber-700 dark:text-amber-400">EOD H-{stale.ageInTradingDays}</p>}
      </td>
      <td className="px-2.5 py-3.5"><FairValueCell v={v} /></td>
      <td className="px-2.5 py-3.5 text-right"><UpsideCell v={v} /></td>
      <td className="px-2.5 py-3.5">{v ? <ValuationBadge verdict={v.valuation.verdict} /> : <ChipSkeleton w="w-24" />}</td>
      <td className="px-2.5 py-3.5">{v ? <MarketPhaseBadge phase={v.marketPhase} /> : <ChipSkeleton />}</td>
      <td className="px-2.5 py-3.5">{v ? <TrendBadge trend={v.trend} /> : <ChipSkeleton w="w-14" />}</td>
      <td className="px-2.5 py-3.5">{v ? <FundamentalBadge score={v.fundamentalScore} /> : <ChipSkeleton />}</td>
      <td className="px-2.5 py-3.5">{v ? <MomentumBadge momentum={v.momentum} /> : <ChipSkeleton w="w-14" />}</td>
      <td className="px-2.5 py-3.5">{v ? <VolumeBadge volume={v.volume} rvol={v.relativeVolume} /> : <ChipSkeleton w="w-14" />}</td>
      <td className="px-2.5 py-3.5">{v ? <RiskBadge risk={v.risk} reasons={v.riskReasons} /> : <ChipSkeleton w="w-12" />}</td>
      <td className="px-2 py-3.5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-0.5">
          <InsightButton v={v} reasons={evaluation.reasons} />
          <WatchStar ticker={s.ticker} actions={actions} />
          <ActionsMenu ticker={s.ticker} actions={actions} />
        </div>
      </td>
    </tr>
  );
}

function SkeletonRows({ count = 8 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <tr key={i} className="border-b border-(--sv-border)">
          {Array.from({ length: 14 }, (__, j) => (
            <td key={j} className="px-3 py-4">
              <span className={cn('block h-4 animate-pulse rounded bg-slate-200/70 dark:bg-slate-700/50', j < 2 ? 'w-4' : j === 2 ? 'w-24' : 'w-16')} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ── Mobile card ──────────────────────────────────────────────────────────────
function MobileCard({ result, v, actions }: { result: ScreenerResult; v?: ScreenerVerdict; actions: RowActions }) {
  const { summary: s } = result;
  return (
    <li className="rounded-xl border border-(--sv-border) bg-(--sv-surface) shadow-(--sv-shadow)">
      <Link href={`/screener/${s.ticker}`} className="block p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-base font-bold text-(--sv-text)">{s.ticker}</p>
            <p className="truncate text-xs text-(--sv-muted)">{s.name}</p>
          </div>
          <div className="text-right">
            <p className="text-base font-bold tabular-nums text-(--sv-text)">{formatRupiah(s.lastClose)}</p>
            <p className={cn('text-xs font-medium tabular-nums', s.percentChange1D >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
              {formatPercent(s.percentChange1D)}
            </p>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-(--sv-bg) px-3 py-2">
          <div>
            <p className="text-[11px] text-(--sv-muted)">Upside ke median fair value</p>
            <UpsideCell v={v} large />
          </div>
          {v ? <ValuationBadge verdict={v.valuation.verdict} /> : <ChipSkeleton w="w-24" />}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {v ? <TrendBadge trend={v.trend} /> : <ChipSkeleton w="w-14" />}
          {v ? <RiskBadge risk={v.risk} reasons={v.riskReasons} /> : <ChipSkeleton w="w-12" />}
          {v?.marketPhase && <MarketPhaseBadge phase={v.marketPhase} />}
        </div>
        {v && <p className="mt-2.5 text-xs leading-relaxed text-(--sv-muted)">{buildScreenerInsight(v).summary}</p>}
      </Link>
      <div className="flex items-center justify-between border-t border-(--sv-border) px-2 py-1">
        <span className="px-2 text-xs text-(--sv-muted)">Vol {formatCompact(s.volume)}</span>
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => actions.onToggleCompare(s.ticker)}
            aria-pressed={actions.isCompareSelected(s.ticker)}
            aria-label={`Bandingkan ${s.ticker}`}
            className={cn('flex size-9 items-center justify-center rounded-lg hover:bg-(--sv-bg)', actions.isCompareSelected(s.ticker) ? 'text-(--sv-primary)' : 'text-(--sv-muted)')}
          >
            <GitCompare className="size-4" />
          </button>
          <WatchStar ticker={s.ticker} actions={actions} />
          <ActionsMenu ticker={s.ticker} actions={actions} />
        </div>
      </div>
    </li>
  );
}

// ── Pagination ───────────────────────────────────────────────────────────────
function pageList(page: number, pages: number): (number | '…')[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const set = new Set([1, pages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pages));
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push('…');
    out.push(p);
  });
  return out;
}

export function ScreenerPagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const btn = 'flex h-9 min-w-9 items-center justify-center rounded-lg border px-2 text-sm tabular-nums disabled:opacity-40';
  return (
    <nav aria-label="Halaman hasil" className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-sm text-(--sv-muted)">Menampilkan <b className="text-(--sv-text)">{from}–{to}</b> dari <b className="text-(--sv-text)">{total}</b> saham</p>
      <div className="flex items-center gap-1">
        <button type="button" className={cn(btn, 'border-(--sv-border) bg-(--sv-surface)')} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Halaman sebelumnya">
          <ChevronLeft className="size-4" />
        </button>
        {pageList(page, pages).map((p, i) => p === '…'
          ? <span key={`e${i}`} className="px-1 text-(--sv-muted)">…</span>
          : (
            <button
              key={p}
              type="button"
              onClick={() => onPage(p)}
              aria-current={p === page ? 'page' : undefined}
              className={cn(btn, p === page ? 'border-(--sv-primary) bg-(--sv-primary) font-semibold text-(--sv-primary-fg)' : 'border-(--sv-border) bg-(--sv-surface) text-(--sv-text) hover:bg-(--sv-bg)')}
            >
              {p}
            </button>
          ))}
        <button type="button" className={cn(btn, 'border-(--sv-border) bg-(--sv-surface)')} disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Halaman berikutnya">
          <ChevronRight className="size-4" />
        </button>
      </div>
    </nav>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export function ScreenerTable({
  rows,
  startIndex,
  verdictByTicker,
  loading,
  sort,
  onSort,
  emptyHint,
  onResetFilters,
  ...actions
}: RowActions & {
  rows: ScreenerResult[];
  startIndex: number;
  verdictByTicker: Record<string, ScreenerVerdict>;
  loading: boolean;
  sort: ScreenerSort;
  onSort: (key: ScreenerSortKey) => void;
  emptyHint: string;
  onResetFilters?: () => void;
}) {
  if (!loading && rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-(--sv-border) bg-(--sv-surface) px-6 py-14 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-(--sv-primary-soft) text-(--sv-primary)">
          <SearchX className="size-6" strokeWidth={2} />
        </span>
        <p className="text-base font-semibold text-(--sv-text)">Tidak ada saham yang cocok</p>
        <p className="max-w-sm text-sm text-(--sv-muted)">{emptyHint}</p>
        {onResetFilters && (
          <button type="button" onClick={onResetFilters} className="mt-1 rounded-lg border border-(--sv-border) px-3.5 py-2 text-sm font-medium text-(--sv-text) hover:bg-(--sv-bg)">
            Reset filter
          </button>
        )}
      </div>
    );
  }

  const G = SCREENER_GLOSSARY;
  return (
    <>
      <div className="hidden max-h-[calc(100vh-9rem)] overflow-auto rounded-xl border border-(--sv-border) bg-(--sv-surface) shadow-(--sv-shadow) md:block">
        <table className="w-full min-w-[1120px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 top-0 z-20 w-10 min-w-10 max-w-10 border-b border-(--sv-border) bg-(--sv-surface) px-3 py-3"><span className="sr-only">Pilih</span></th>
              <th scope="col" className="sticky left-10 top-0 z-20 w-10 min-w-10 max-w-10 border-b border-(--sv-border) bg-(--sv-surface) px-1 py-3 text-left text-xs font-semibold text-(--sv-muted)">#</th>
              <Th className="left-20 z-20 border-r" sortKey="ticker" sort={sort} onSort={onSort}>Kode / Emiten</Th>
              <Th sortKey="price" sort={sort} onSort={onSort} align="right">Harga</Th>
              <Th tip={{ term: 'Fair Value', text: G.fairValue }}>Fair Value</Th>
              <Th sortKey="upside" sort={sort} onSort={onSort} align="right" tip={{ term: 'Upside', text: G.upside }}>Upside</Th>
              <Th tip={{ term: 'Valuation', text: G.valuation }}>Valuation</Th>
              <Th tip={{ term: 'Market Phase', text: G.marketPhase }}>Market Phase</Th>
              <Th tip={{ term: 'Trend', text: G.trend }}>Trend</Th>
              <Th sortKey="fundamental" sort={sort} onSort={onSort} tip={{ term: 'Fundamental', text: G.fundamental }}>Fundamental</Th>
              <Th tip={{ term: 'Momentum', text: G.momentum }}>Momentum</Th>
              <Th tip={{ term: 'Volume', text: G.volume }}>Volume</Th>
              <Th tip={{ term: 'Risk', text: G.risk }}>Risk</Th>
              <Th align="right" tip={{ term: 'AI Insight', text: G.aiInsight }}>Aksi</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? <SkeletonRows /> : rows.map((r, i) => (
              <Row key={r.summary.ticker} result={r} index={startIndex + i + 1} v={verdictByTicker[r.summary.ticker]} actions={actions} />
            ))}
          </tbody>
        </table>
      </div>

      <ul className="grid gap-3 md:hidden">
        {loading
          ? Array.from({ length: 4 }, (_, i) => <li key={i} className="h-40 animate-pulse rounded-xl border border-(--sv-border) bg-(--sv-surface)" />)
          : rows.map((r) => <MobileCard key={r.summary.ticker} result={r} v={verdictByTicker[r.summary.ticker]} actions={actions} />)}
      </ul>
    </>
  );
}
