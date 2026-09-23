/**
 * ResultsTableNew.tsx
 *
 * Replacement for ResultsTable.tsx's single opaque "Skor" column — splits the read into four
 * independent signals per features_screener_split.md-style request: Market Phase (technical
 * condition, from marketPhase.ts), Fundamental (quality, from presets.ts's
 * computeFundamentalScore — untouched formula), Setup (entry-readiness label, from
 * screenerVerdict.ts's phase→setup mapping) and Trade Status (BUY/WAIT/NO_TRADE, from
 * riskGate.ts via screenerVerdict.ts). None of these are recomputed here — this file is
 * presentation only, reusing the exact cells/atoms ResultsTable.tsx already exports plus the
 * new screenerVerdict.ts aggregator for the three new columns.
 *
 * Old ResultsTable.tsx is left in place (still used nowhere else is fine) — ScreenerPage.tsx
 * just points at this component instead.
 */

import { ChevronRight, Loader2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { PresetEvaluation } from '@/domain/screener/presets';
import { ScreenerVerdict, SetupLabel, SwingTradeStatus } from '@/domain/analysis/screenerVerdict';
import { cn, formatCompact, formatRupiah } from '@/lib/format';
import {
  ChangeBadge,
  CompareToggle,
  compositeScoreInfo,
  EmptyState,
  FreshnessBadge,
  FUNDAMENTAL_STATUS_STYLES,
  PhaseBadge,
  ResultsView,
  ScreenerResult,
  SortableHeader,
  TickerAvatar,
  WatchlistStar,
} from './ResultsTable';

// ── Setup badge ────────────────────────────────────────────────────────────────
const SETUP_STYLES: Record<SetupLabel, string> = {
  'BOW/BOS': 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300',
  BOB: 'bg-blue-50 text-blue-700 dark:bg-blue-400/10 dark:text-blue-300',
  BOS: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300',
  'NO CHASE': 'bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300',
  'NO TRADE': 'bg-rose-50 text-rose-700 dark:bg-rose-400/10 dark:text-rose-300',
  '—': 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-600',
};

// ── Trade Status badge ────────────────────────────────────────────────────────
const TRADE_STATUS_STYLES: Record<SwingTradeStatus, string> = {
  BUY: 'bg-emerald-500 text-white dark:bg-emerald-600',
  WAIT: 'bg-amber-400 text-white dark:bg-amber-500',
  NO_TRADE: 'bg-zinc-300 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300',
};

const BADGE_BASE = 'inline-flex items-center gap-1 border border-(--neo-line) px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap';

function LoadingDash() {
  return <Loader2 className="size-3.5 animate-spin text-zinc-300 dark:text-zinc-700" strokeWidth={2.5} />;
}
function NoDataDash() {
  return <span className="text-zinc-300 dark:text-zinc-700">—</span>;
}

// ── Market Phase cell ─────────────────────────────────────────────────────────
function MarketPhaseCell({ verdict }: { verdict?: ScreenerVerdict }) {
  if (!verdict) return <LoadingDash />;
  if (!verdict.marketPhase) return <NoDataDash />;
  return <PhaseBadge phase={verdict.marketPhase} />;
}

// ── Fundamental cell — preset composite (compositeScoreInfo) takes priority, falls back to a
//    plain computeFundamentalScore() read for presets that don't attach a composite (e.g. "Semua").
//    Never blended into one number — see screenerVerdict.ts's docstring. ─────────────────────────
function FundamentalCell({ evaluation, verdict }: { evaluation: PresetEvaluation; verdict?: ScreenerVerdict }) {
  const composite = compositeScoreInfo(evaluation);
  if (composite) {
    return (
      <div className="flex flex-col items-start gap-1">
        <span className={cn(BADGE_BASE, composite.className)}>{composite.label}</span>
        <span className="font-mono text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">{composite.composite}/100</span>
      </div>
    );
  }
  if (!verdict) return <LoadingDash />;
  const f = verdict.fundamentalScore;
  return (
    <div className="flex flex-col items-start gap-1">
      <span className={cn(BADGE_BASE, FUNDAMENTAL_STATUS_STYLES[f.status])}>{f.status}</span>
      <span className="font-mono text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">{f.composite}/100</span>
    </div>
  );
}

// ── Setup cell ─────────────────────────────────────────────────────────────────
function SetupCell({ verdict }: { verdict?: ScreenerVerdict }) {
  if (!verdict) return <LoadingDash />;
  return <span className={cn(BADGE_BASE, SETUP_STYLES[verdict.setup])}>{verdict.setup}</span>;
}

// ── Trade Status cell ────────────────────────────────────────────────────────
function TradeStatusCell({ verdict }: { verdict?: ScreenerVerdict }) {
  if (!verdict) return <LoadingDash />;
  if (verdict.tradeStatus === null) return <NoDataDash />;
  return (
    <span className={cn(BADGE_BASE, TRADE_STATUS_STYLES[verdict.tradeStatus])}>
      {verdict.tradeStatus === 'NO_TRADE' ? 'NO TRADE' : verdict.tradeStatus}
    </span>
  );
}

export type ColumnSortKeyNew = 'ticker' | 'fundamental' | 'change' | 'price' | 'volume' | 'cap';
export type ColumnSortDirNew = 'asc' | 'desc';
export interface ColumnSortNew { key: ColumnSortKeyNew; dir: ColumnSortDirNew }

function fundamentalSortValue(evaluation: PresetEvaluation, verdict?: ScreenerVerdict): number {
  return compositeScoreInfo(evaluation)?.composite ?? verdict?.fundamentalScore.composite ?? -1;
}

interface ResultsTableNewProps {
  results: ScreenerResult[];
  view: ResultsView;
  isWatchlisted: (ticker: string) => boolean;
  onToggleWatchlist: (ticker: string) => void;
  isCompareSelected: (ticker: string) => boolean;
  onToggleCompare: (ticker: string) => void;
  /** Per-ticker verdict (Market Phase / Setup / Trade Status / fallback Fundamental) — undefined
   *  means this row hasn't been fetched yet (lazy, visible-rows-only, see ScreenerPage.tsx). */
  verdictByTicker?: Record<string, ScreenerVerdict>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Card — mobile / grid view
// ─────────────────────────────────────────────────────────────────────────────
function StockCardNew({
  result,
  isWatchlisted,
  onToggleWatchlist,
  isCompareSelected,
  onToggleCompare,
  verdict,
}: {
  result: ScreenerResult;
  isWatchlisted: boolean;
  onToggleWatchlist: () => void;
  isCompareSelected: boolean;
  onToggleCompare: () => void;
  verdict?: ScreenerVerdict;
}) {
  const { summary, evaluation } = result;
  const positive = summary.percentChange1D >= 0;

  return (
    <Link
      href={`/screener/${summary.ticker}`}
      className={cn(
        'group relative flex flex-col neo-border neo-shadow bg-white p-4 transition-transform duration-150 dark:bg-zinc-900',
        'hover:-translate-x-0.5 hover:-translate-y-0.5 hover:neo-shadow-lg'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <TickerAvatar ticker={summary.ticker} />
          <div>
            <div className="font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
              {summary.ticker}
            </div>
            <div className="max-w-[9rem] truncate text-xs font-medium text-zinc-500 dark:text-zinc-400">{summary.name}</div>
            {summary.sector && <span className="mt-1 inline-block max-w-[9rem] truncate border border-(--neo-line) bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">{summary.sector}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <div className="text-right">
            <div className="font-mono text-sm font-bold tabular-nums text-zinc-800 dark:text-zinc-200">{formatRupiah(summary.lastClose)}</div>
            <ChangeBadge value={summary.percentChange1D} />
            {evaluation.freshness && (
              <div className="mt-0.5 flex justify-end">
                <FreshnessBadge freshness={evaluation.freshness} />
              </div>
            )}
          </div>
          <CompareToggle active={isCompareSelected} onToggle={onToggleCompare} ticker={summary.ticker} />
          <WatchlistStar active={isWatchlisted} onToggle={onToggleWatchlist} ticker={summary.ticker} />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 border-t-2 border-(--neo-line) pt-3">
        <div>
          <div className="mb-1 text-[10px] font-bold uppercase text-zinc-400 dark:text-zinc-500">Market Phase</div>
          <MarketPhaseCell verdict={verdict} />
        </div>
        <div>
          <div className="mb-1 text-[10px] font-bold uppercase text-zinc-400 dark:text-zinc-500">Fundamental</div>
          <FundamentalCell evaluation={evaluation} verdict={verdict} />
        </div>
        <div>
          <div className="mb-1 text-[10px] font-bold uppercase text-zinc-400 dark:text-zinc-500">Setup</div>
          <SetupCell verdict={verdict} />
        </div>
        <div>
          <div className="mb-1 text-[10px] font-bold uppercase text-zinc-400 dark:text-zinc-500">Trade Status</div>
          <TradeStatusCell verdict={verdict} />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t-2 border-(--neo-line) pt-3 text-xs font-semibold text-zinc-400 dark:text-zinc-500">
        <span>Vol {formatCompact(summary.volume)}</span>
        {summary.capitalization > 0 && <span>Cap {formatCompact(summary.capitalization)}</span>}
        <span className="ml-auto flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity font-bold">
          Analisis <ChevronRight className="size-3.5" strokeWidth={2.5} />
        </span>
      </div>

      <div
        className={cn(
          'absolute bottom-0 left-4 right-4 h-1 opacity-0 group-hover:opacity-100 transition-opacity',
          positive ? 'bg-emerald-400' : 'bg-rose-400'
        )}
      />
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Table row
// ─────────────────────────────────────────────────────────────────────────────
function StockTableRowNew({
  result,
  isWatchlisted,
  onToggleWatchlist,
  isCompareSelected,
  onToggleCompare,
  verdict,
}: {
  result: ScreenerResult;
  isWatchlisted: boolean;
  onToggleWatchlist: () => void;
  isCompareSelected: boolean;
  onToggleCompare: () => void;
  verdict?: ScreenerVerdict;
}) {
  const { summary, evaluation } = result;

  return (
    <tr className="group transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/40">
      <td className="px-3 py-3">
        <div className="flex items-center gap-0.5">
          <CompareToggle active={isCompareSelected} onToggle={onToggleCompare} ticker={summary.ticker} />
          <WatchlistStar active={isWatchlisted} onToggle={onToggleWatchlist} ticker={summary.ticker} />
        </div>
      </td>

      <td className="px-4 py-3">
        <Link href={`/screener/${summary.ticker}`} className="flex items-center gap-3">
          <TickerAvatar ticker={summary.ticker} />
          <div>
            <div className="font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
              {summary.ticker}
            </div>
            <div className="max-w-[12rem] truncate text-xs text-zinc-500 dark:text-zinc-400">{summary.name}</div>
          </div>
        </Link>
      </td>

      <td className="px-4 py-3"><MarketPhaseCell verdict={verdict} /></td>
      <td className="px-4 py-3"><FundamentalCell evaluation={evaluation} verdict={verdict} /></td>
      {/* <td className="px-4 py-3"><SetupCell verdict={verdict} /></td> */}
      {/* <td className="px-4 py-3"><TradeStatusCell verdict={verdict} /></td> */}

      <td className="px-4 py-3"><ChangeBadge value={summary.percentChange1D} /></td>

      <td className="px-4 py-3 font-mono tabular-nums text-zinc-800 dark:text-zinc-200">
        {formatRupiah(summary.lastClose)}
        {evaluation.freshness && (
          <div className="mt-0.5">
            <FreshnessBadge freshness={evaluation.freshness} />
          </div>
        )}
      </td>

      <td className="px-4 py-3 font-mono tabular-nums text-zinc-600 dark:text-zinc-300">{formatCompact(summary.volume)}</td>

      <td className="px-4 py-3 font-mono tabular-nums text-zinc-600 dark:text-zinc-300">
        {summary.capitalization > 0 ? (
          <>{formatCompact(summary.capitalization)}<span className="ml-1 text-[10px] text-zinc-400">IDR</span></>
        ) : (
          <NoDataDash />
        )}
      </td>

      <td className="px-4 py-3">
        {summary.sector ? (
          <Link
            href={`/sektor?sector=${encodeURIComponent(summary.sector)}`}
            title={`Lihat semua saham sektor ${summary.sector}`}
            className="inline-block max-w-[9rem] truncate border border-(--neo-line) bg-zinc-100 px-2 py-0.5 text-[11px] font-bold text-zinc-600 transition-colors hover:bg-zinc-200 hover:text-zinc-900 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
          >
            {summary.sector}
          </Link>
        ) : (
          <NoDataDash />
        )}
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────
export function ResultsTableNew({
  results,
  view,
  isWatchlisted,
  onToggleWatchlist,
  isCompareSelected,
  onToggleCompare,
  verdictByTicker,
}: ResultsTableNewProps) {
  const [columnSort, setColumnSort] = useState<ColumnSortNew | null>(null);

  const handleSort = (key: ColumnSortKeyNew) => {
    setColumnSort((prev) => {
      if (prev?.key === key) return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
      return { key, dir: key === 'ticker' ? 'asc' : 'desc' };
    });
  };

  const sortedResults = useMemo(() => {
    if (!columnSort) return results;
    const { key, dir } = columnSort;
    const mul = dir === 'asc' ? 1 : -1;
    return [...results].sort((a, b) => {
      switch (key) {
        case 'ticker':
          return mul * a.summary.ticker.localeCompare(b.summary.ticker);
        case 'fundamental':
          return mul * (
            fundamentalSortValue(a.evaluation, verdictByTicker?.[a.summary.ticker]) -
            fundamentalSortValue(b.evaluation, verdictByTicker?.[b.summary.ticker])
          );
        case 'change':
          return mul * (a.summary.percentChange1D - b.summary.percentChange1D);
        case 'price':
          return mul * (a.summary.lastClose - b.summary.lastClose);
        case 'volume':
          return mul * (a.summary.volume - b.summary.volume);
        case 'cap':
          return mul * (a.summary.capitalization - b.summary.capitalization);
        default:
          return 0;
      }
    });
  }, [results, columnSort, verdictByTicker]);

  if (results.length === 0) return <EmptyState />;

  if (view === 'grid') {
    return (
      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {results.map((result) => (
          <StockCardNew
            key={result.summary.ticker}
            result={result}
            isWatchlisted={isWatchlisted(result.summary.ticker)}
            onToggleWatchlist={() => onToggleWatchlist(result.summary.ticker)}
            isCompareSelected={isCompareSelected(result.summary.ticker)}
            onToggleCompare={() => onToggleCompare(result.summary.ticker)}
            verdict={verdictByTicker?.[result.summary.ticker]}
          />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="hidden overflow-x-auto overflow-hidden neo-border neo-shadow md:block">
        <table className="w-full min-w-[880px] text-sm">
          <thead className="border-b-[3px] border-(--neo-line) bg-(--neo-accent) text-left text-xs font-bold uppercase tracking-wide text-black">
            <tr>
              <th className="w-16 px-3 py-3" />
              <SortableHeader label="Simbol" colKey="ticker" sort={columnSort} onSort={handleSort} />
              <th className="px-4 py-3">Market Phase</th>
              <SortableHeader label="Fundamental" colKey="fundamental" sort={columnSort} onSort={handleSort} />
              {/* <th className="px-4 py-3">Setup</th> */}
              {/* <th className="px-4 py-3">Trade Status</th> */}
              <SortableHeader label="Perubahan" colKey="change" sort={columnSort} onSort={handleSort} />
              <SortableHeader label="Harga" colKey="price" sort={columnSort} onSort={handleSort} />
              <SortableHeader label="Vol" colKey="volume" sort={columnSort} onSort={handleSort} />
              <SortableHeader label="Kap pasar" colKey="cap" sort={columnSort} onSort={handleSort} />
              <th className="px-4 py-3">Sektor</th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-(--neo-line) bg-white dark:bg-zinc-900">
            {sortedResults.map((result) => (
              <StockTableRowNew
                key={result.summary.ticker}
                result={result}
                isWatchlisted={isWatchlisted(result.summary.ticker)}
                onToggleWatchlist={() => onToggleWatchlist(result.summary.ticker)}
                isCompareSelected={isCompareSelected(result.summary.ticker)}
                onToggleCompare={() => onToggleCompare(result.summary.ticker)}
                verdict={verdictByTicker?.[result.summary.ticker]}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-2.5 md:hidden">
        {sortedResults.map((result) => (
          <StockCardNew
            key={result.summary.ticker}
            result={result}
            isWatchlisted={isWatchlisted(result.summary.ticker)}
            onToggleWatchlist={() => onToggleWatchlist(result.summary.ticker)}
            isCompareSelected={isCompareSelected(result.summary.ticker)}
            onToggleCompare={() => onToggleCompare(result.summary.ticker)}
            verdict={verdictByTicker?.[result.summary.ticker]}
          />
        ))}
      </div>
    </>
  );
}
