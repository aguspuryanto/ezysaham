import { GitCompare, Star, Target, TrendingDown, TrendingUp, SearchX, ChevronRight, Rocket, Zap } from 'lucide-react';
import Link from 'next/link';
import { StockSummary } from '@/domain/models/Stock';
import { AraProbabilityScore, BreakoutScores, PresetEvaluation, TradingPlanScore } from '@/domain/screener/presets';
import { DataFreshness } from '@/domain/analysis/dataFreshness';
import { cn, formatCompact, formatPercent, formatRupiah } from '@/lib/format';

export interface ScreenerResult {
  summary: StockSummary;
  evaluation: PresetEvaluation;
}

export type ResultsView = 'table' | 'grid';

interface ResultsTableProps {
  results: ScreenerResult[];
  view: ResultsView;
  isWatchlisted: (ticker: string) => boolean;
  onToggleWatchlist: (ticker: string) => void;
  isCompareSelected: (ticker: string) => boolean;
  onToggleCompare: (ticker: string) => void;
}

// ── Avatar ────────────────────────────────────────────────────────────────────
const AVATAR_TONES = [
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300',
  'bg-blue-100 text-blue-700 dark:bg-blue-400/10 dark:text-blue-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300',
  'bg-violet-100 text-violet-700 dark:bg-violet-400/10 dark:text-violet-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-400/10 dark:text-rose-300',
  'bg-cyan-100 text-cyan-700 dark:bg-cyan-400/10 dark:text-cyan-300',
];

function avatarTone(ticker: string): string {
  const sum = [...ticker].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_TONES[sum % AVATAR_TONES.length];
}

function TickerAvatar({ ticker, size = 'md' }: { ticker: string; size?: 'sm' | 'md' }) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center border-2 border-(--neo-line) font-bold tracking-tight',
        size === 'md' ? 'size-9 text-xs' : 'size-7 text-[10px]',
        avatarTone(ticker)
      )}
    >
      {ticker.slice(0, 2)}
    </span>
  );
}

// ── Watchlist star ─────────────────────────────────────────────────────────────
function WatchlistStar({
  active,
  onToggle,
  ticker,
}: {
  active: boolean;
  onToggle: () => void;
  ticker: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggle(); }}
      aria-label={active ? `Hapus ${ticker} dari daftar pantau` : `Tambah ${ticker} ke daftar pantau`}
      aria-pressed={active}
      className={cn(
        'flex size-7 shrink-0 items-center justify-center rounded-full transition-colors',
        active ? 'text-amber-500' : 'text-zinc-300 hover:text-amber-400 dark:text-zinc-700'
      )}
    >
      <Star className="size-4" fill={active ? 'currentColor' : 'none'} strokeWidth={2} />
    </button>
  );
}

// ── Compare toggle ────────────────────────────────────────────────────────────
function CompareToggle({
  active,
  onToggle,
  ticker,
}: {
  active: boolean;
  onToggle: () => void;
  ticker: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggle(); }}
      aria-label={active ? `Hapus ${ticker} dari pilihan bandingkan` : `Pilih ${ticker} untuk dibandingkan`}
      aria-pressed={active}
      title="Bandingkan"
      className={cn(
        'flex size-7 shrink-0 items-center justify-center rounded-full transition-colors',
        active ? 'text-blue-500' : 'text-zinc-300 hover:text-blue-400 dark:text-zinc-700'
      )}
    >
      <GitCompare className="size-4" strokeWidth={2.5} />
    </button>
  );
}

// ── ChangeBadge ────────────────────────────────────────────────────────────────
function ChangeBadge({ value }: { value: number }) {
  const positive = value >= 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-mono text-sm tabular-nums',
        positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
      )}
    >
      <Icon className="size-3.5" strokeWidth={2.5} />
      {formatPercent(value)}
    </span>
  );
}

// ── Data Freshness badge ──────────────────────────────────────────────────────
// Honest EOD age indicator — never labeled "LIVE" since this app has no real-time
// tick feed, only daily EOD bars (see docs/feasibility-features-update-plan2.md).
const FRESHNESS_STYLES: Record<DataFreshness['tier'], string> = {
  fresh: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300',
  aging: 'bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300',
  stale: 'bg-rose-50 text-rose-700 dark:bg-rose-400/10 dark:text-rose-300',
};

function FreshnessBadge({ freshness }: { freshness: DataFreshness }) {
  const label =
    freshness.tier === 'fresh'
      ? 'EOD terkini'
      : freshness.tier === 'stale'
        ? `EOD stale (H-${freshness.ageInTradingDays})`
        : `EOD H-${freshness.ageInTradingDays}`;
  return (
    <span className={cn('inline-flex items-center border border-(--neo-line) px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap', FRESHNESS_STYLES[freshness.tier])}>
      {label}
    </span>
  );
}

// ── Trigger checklist ─────────────────────────────────────────────────────────
// Surfaces the per-condition reasons[]/failed[] every preset already computes,
// as an explicit "X/Y kondisi terpenuhi" checklist instead of a single opaque score.
function TriggerChecklist({ reasons, failed }: { reasons: string[]; failed: string[] }) {
  const total = reasons.length + failed.length;
  if (total === 0) return null;
  return (
    <div className="mt-3 border-t-2 border-(--neo-line) pt-3 space-y-2">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-bold uppercase text-zinc-500 dark:text-zinc-400">Trigger</span>
        <span className="font-mono font-bold text-zinc-600 dark:text-zinc-300">
          {reasons.length}/{total} terpenuhi
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden border border-(--neo-line) bg-zinc-100 dark:bg-zinc-800">
        <div
          className={cn('h-full', reasons.length === total ? 'bg-emerald-500' : 'bg-amber-400')}
          style={{ width: `${(reasons.length / total) * 100}%` }}
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {reasons.slice(0, 3).map((r) => (
          <span key={r} className="inline-flex items-center gap-1 border border-(--neo-line) bg-emerald-50 dark:bg-emerald-400/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
            ✓ {r}
          </span>
        ))}
        {failed.slice(0, 3).map((f) => (
          <span key={f} className="inline-flex items-center gap-1 border border-(--neo-line) bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[10px] font-bold text-zinc-500 dark:text-zinc-400">
            ✕ {f}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Breakout Score badge ──────────────────────────────────────────────────────
const STATUS_STYLES: Record<BreakoutScores['status'], string> = {
  BUY_WATCH: 'bg-emerald-500 text-white dark:bg-emerald-600',
  WATCH: 'bg-amber-400 text-white dark:bg-amber-500',
  SKIP: 'bg-zinc-300 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300',
};

function BreakoutBadge({ scores }: { scores: BreakoutScores }) {
  return (
    <div className="mt-3 border-t-2 border-(--neo-line) pt-3 space-y-2">
      {/* Status pill + composite */}
      <div className="flex items-center justify-between gap-2">
        <span className={cn('inline-flex items-center gap-1.5 border border-(--neo-line) px-2.5 py-1 text-[11px] font-bold tracking-wide', STATUS_STYLES[scores.status])}>
          <Rocket className="size-3" />
          {scores.status === 'BUY_WATCH' ? 'BUY WATCH' : scores.status}
        </span>
        <span className="font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
          Score <span className="font-bold text-zinc-700 dark:text-zinc-200">{scores.composite}</span>/100
        </span>
      </div>

      {/* Mini score bars */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        {([
          { label: '🔥 Momentum', value: scores.momentum },
          { label: '💰 Likuiditas', value: scores.likuiditas },
          { label: '🏦 Smart Money', value: scores.smartMoney },
          { label: '📈 Prob Naik', value: scores.probUp },
        ] as const).map(({ label, value }) => (
          <div key={label}>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500">{label}</span>
              <span className="text-[10px] font-mono font-semibold text-zinc-600 dark:text-zinc-300">{value}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden border border-(--neo-line) bg-zinc-100 dark:bg-zinc-800">
              <div
                className={cn('h-full', value >= 70 ? 'bg-emerald-500' : value >= 45 ? 'bg-amber-400' : 'bg-rose-400')}
                style={{ width: `${value}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Risk indicator */}
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-zinc-400 dark:text-zinc-500">⚠️ Distribution Risk</span>
        <span className={cn('font-mono font-semibold', scores.distributionRisk >= 50 ? 'text-rose-500' : scores.distributionRisk >= 30 ? 'text-amber-500' : 'text-emerald-500')}>
          {scores.distributionRisk}/100
        </span>
      </div>
    </div>
  );
}

// ── Trading Plan badge ─────────────────────────────────────────────────────────
const TRADING_PLAN_STATUS_STYLES: Record<TradingPlanScore['status'], string> = {
  STRONG_BUY: 'bg-emerald-600 text-white dark:bg-emerald-600',
  BUY: 'bg-emerald-500 text-white dark:bg-emerald-600',
  WATCHLIST: 'bg-amber-400 text-white dark:bg-amber-500',
  SPECULATIVE: 'bg-orange-400 text-white dark:bg-orange-500',
  AVOID: 'bg-zinc-300 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300',
};

const TRADING_PLAN_STATUS_LABEL: Record<TradingPlanScore['status'], string> = {
  STRONG_BUY: 'STRONG BUY',
  BUY: 'BUY',
  WATCHLIST: 'WATCHLIST',
  SPECULATIVE: 'SPEKULATIF',
  AVOID: 'HINDARI',
};

function StarRating({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn('size-3', i < count ? 'text-amber-400' : 'text-zinc-200 dark:text-zinc-700')}
          fill={i < count ? 'currentColor' : 'none'}
          strokeWidth={2}
        />
      ))}
    </span>
  );
}

function TradingPlanBadge({ plan }: { plan: TradingPlanScore }) {
  return (
    <div className="mt-3 border-t-2 border-(--neo-line) pt-3 space-y-2">
      {/* Status pill + momentum stars */}
      <div className="flex items-center justify-between gap-2">
        <span className={cn('inline-flex items-center gap-1.5 border border-(--neo-line) px-2.5 py-1 text-[11px] font-bold tracking-wide', TRADING_PLAN_STATUS_STYLES[plan.status])}>
          <Target className="size-3" />
          {TRADING_PLAN_STATUS_LABEL[plan.status]}
        </span>
        <StarRating count={plan.momentumStars} />
      </div>

      {/* Buy Area / SL / TP / RR */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        <div className="col-span-2 flex items-center justify-between">
          <span className="text-zinc-400 dark:text-zinc-500">Buy Area</span>
          <span className="font-mono font-semibold text-zinc-700 dark:text-zinc-200">
            {formatRupiah(plan.buyAreaLow)}–{formatRupiah(plan.buyAreaHigh)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-zinc-400 dark:text-zinc-500">AVGD</span>
          <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">{formatRupiah(plan.avgDown)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-zinc-400 dark:text-zinc-500">Stop Loss</span>
          <span className="font-mono font-semibold text-rose-500 dark:text-rose-400">{formatRupiah(plan.stopLoss)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-zinc-400 dark:text-zinc-500">TP1</span>
          <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">{formatRupiah(plan.tp1)}</span>
        </div>
      </div>

      {/* Risk/Reward + score */}
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-zinc-400 dark:text-zinc-500">Risk/Reward</span>
        <span className={cn('font-mono font-semibold', plan.riskRewardRatio >= 2 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500')}>
          1 : {plan.riskRewardRatio.toFixed(1)}
        </span>
      </div>
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-zinc-400 dark:text-zinc-500">Opportunity Score</span>
        <span className="font-mono font-semibold text-zinc-600 dark:text-zinc-300">{plan.score}/100</span>
      </div>
    </div>
  );
}

// ── ARA Probability badge ─────────────────────────────────────────────────────
const ARA_PROBABILITY_STYLES: Record<AraProbabilityScore['probability'], string> = {
  HIGH: 'bg-emerald-500 text-white dark:bg-emerald-600',
  MEDIUM: 'bg-amber-400 text-white dark:bg-amber-500',
  LOW: 'bg-zinc-300 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300',
};

function AraProbabilityBadge({ score }: { score: AraProbabilityScore }) {
  return (
    <div className="mt-3 border-t-2 border-(--neo-line) pt-3 space-y-2">
      {/* Probability pill + composite */}
      <div className="flex items-center justify-between gap-2">
        <span className={cn('inline-flex items-center gap-1.5 border border-(--neo-line) px-2.5 py-1 text-[11px] font-bold tracking-wide', ARA_PROBABILITY_STYLES[score.probability])}>
          <Zap className="size-3" />
          ARA Probability: {score.probability}
        </span>
        <span className="font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
          Score <span className="font-bold text-zinc-700 dark:text-zinc-200">{score.composite}</span>/100
        </span>
      </div>

      {/* Mini score bars */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        {([
          { label: 'Momentum', value: score.momentum },
          { label: 'Volume', value: score.volume },
          { label: 'Breakout', value: score.breakout },
          { label: 'Liquidity', value: score.liquidity },
        ] as const).map(({ label, value }) => (
          <div key={label}>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500">{label}</span>
              <span className="text-[10px] font-mono font-semibold text-zinc-600 dark:text-zinc-300">{value}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden border border-(--neo-line) bg-zinc-100 dark:bg-zinc-800">
              <div
                className={cn('h-full', value >= 70 ? 'bg-emerald-500' : value >= 45 ? 'bg-amber-400' : 'bg-rose-400')}
                style={{ width: `${value}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {score.freshnessCapped && (
        <p className="text-[10px] text-rose-500 dark:text-rose-400">⚠️ Data stale — probability dipaksa turun ke LOW.</p>
      )}
      <p className="text-[10px] text-zinc-400 dark:text-zinc-500">{score.disclaimer}</p>
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 neo-border border-dashed px-6 py-14 text-center">
      <SearchX className="size-7 text-zinc-500 dark:text-zinc-400" strokeWidth={2} />
      <p className="text-sm font-bold uppercase text-zinc-700 dark:text-zinc-200">Belum ada saham yang lolos</p>
      <p className="max-w-xs text-sm font-medium text-zinc-400 dark:text-zinc-500">
        Tidak ada saham yang memenuhi kriteria preset ini hari ini. Coba preset lain atau pindai ulang besok.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Grid card — navigates to /screener/[ticker]
// ─────────────────────────────────────────────────────────────────────────────
function StockCard({
  result,
  isWatchlisted,
  onToggleWatchlist,
  isCompareSelected,
  onToggleCompare,
}: {
  result: ScreenerResult;
  isWatchlisted: boolean;
  onToggleWatchlist: () => void;
  isCompareSelected: boolean;
  onToggleCompare: () => void;
}) {
  const { summary, evaluation } = result;
  const positive = summary.percentChange1D >= 0;
  const bScores = evaluation.breakoutScores;
  const tradingPlan = evaluation.tradingPlan;
  const araProbability = evaluation.araProbability;

  return (
    <Link
      href={`/screener/${summary.ticker}`}
      className={cn(
        'group relative flex flex-col neo-border neo-shadow bg-white p-4 transition-transform duration-150',
        'hover:-translate-x-0.5 hover:-translate-y-0.5 hover:neo-shadow-lg',
        bScores?.status === 'BUY_WATCH' ? 'bg-emerald-50 dark:bg-emerald-400/10' : 'dark:bg-zinc-900'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <TickerAvatar ticker={summary.ticker} />
          <div>
            <div className="font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
              {summary.ticker}
            </div>
            <div className="max-w-[9rem] truncate text-xs font-medium text-zinc-500 dark:text-zinc-400">{summary.name}</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <div className="text-right">
            <div className="font-mono text-sm font-bold tabular-nums text-zinc-800 dark:text-zinc-200">
              {formatRupiah(summary.lastClose)}
            </div>
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

      {/* Extra scoring badge (only for the Breakout Hunter / Trading Plan / ARA Hunter presets) */}
      {bScores ? (
        <BreakoutBadge scores={bScores} />
      ) : tradingPlan ? (
        <TradingPlanBadge plan={tradingPlan} />
      ) : araProbability ? (
        <AraProbabilityBadge score={araProbability} />
      ) : evaluation.reasons.length + evaluation.failed.length > 0 ? (
        <TriggerChecklist reasons={evaluation.reasons} failed={evaluation.failed} />
      ) : (
        /* Footer meta — standard (only for the unfiltered "Semua" view, no reasons computed) */
        <div className="mt-3 flex items-center justify-between gap-2 border-t-2 border-(--neo-line) pt-3 text-xs font-semibold text-zinc-400 dark:text-zinc-500">
          <span>Nilai {formatCompact(summary.value)}</span>
          {summary.per > 0 && <span>P/E {summary.per.toFixed(1)}</span>}
          <span className="ml-auto flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity font-bold">
            Analisis <ChevronRight className="size-3.5" strokeWidth={2.5} />
          </span>
        </div>
      )}

      {/* Accent bar */}
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
// Table row — navigates to /screener/[ticker]
// ─────────────────────────────────────────────────────────────────────────────
function StockTableRow({
  result,
  isWatchlisted,
  onToggleWatchlist,
  isCompareSelected,
  onToggleCompare,
}: {
  result: ScreenerResult;
  isWatchlisted: boolean;
  onToggleWatchlist: () => void;
  isCompareSelected: boolean;
  onToggleCompare: () => void;
}) {
  const { summary, evaluation } = result;
  const rvol = evaluation.relativeVolume;
  const volShares = summary.volume;

  return (
    <tr className={cn(
      'group transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/40',
    )}>
      {/* ★ Watchlist + ⇄ Compare */}
      <td className="px-3 py-3">
        <div className="flex items-center gap-0.5">
          <CompareToggle
            active={isCompareSelected}
            onToggle={onToggleCompare}
            ticker={summary.ticker}
          />
          <WatchlistStar
            active={isWatchlisted}
            onToggle={onToggleWatchlist}
            ticker={summary.ticker}
          />
        </div>
      </td>

      {/* Simbol + Nama */}
      <td className="px-4 py-3">
        <Link href={`/screener/${summary.ticker}`} className="flex items-center gap-3">
          <TickerAvatar ticker={summary.ticker} />
          <div>
            <div className="font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
              {summary.ticker}
            </div>
            <div className="max-w-[12rem] truncate text-xs text-zinc-500 dark:text-zinc-400">
              {summary.name}
            </div>
          </div>
        </Link>
      </td>

      {/* Perubahan % */}
      <td className="px-4 py-3">
        <ChangeBadge value={summary.percentChange1D} />
      </td>

      {/* Harga */}
      <td className="px-4 py-3 font-mono tabular-nums text-zinc-800 dark:text-zinc-200">
        {formatRupiah(summary.lastClose)}
        {evaluation.freshness && (
          <div className="mt-0.5">
            <FreshnessBadge freshness={evaluation.freshness} />
          </div>
        )}
      </td>

      {/* Vol (lembar) */}
      <td className="px-4 py-3 font-mono tabular-nums text-zinc-600 dark:text-zinc-300">
        {formatCompact(volShares)}
      </td>

      {/* Volume Relatif */}
      {/* <td className="px-4 py-3 font-mono tabular-nums">
        {rvol != null ? (
          <span className={cn(
            'font-semibold',
            rvol >= 2 ? 'text-emerald-600 dark:text-emerald-400' :
              rvol >= 1.2 ? 'text-zinc-700 dark:text-zinc-200' :
                'text-zinc-400 dark:text-zinc-500'
          )}>
            {rvol.toFixed(2)}
          </span>
        ) : (
          <span className="text-zinc-300 dark:text-zinc-700">—</span>
        )}
      </td> */}

      {/* Kap Pasar */}
      <td className="px-4 py-3 font-mono tabular-nums text-zinc-600 dark:text-zinc-300">
        {summary.capitalization > 0 ? (
          <>{formatCompact(summary.capitalization)}<span className="ml-1 text-[10px] text-zinc-400">IDR</span></>
        ) : (
          <span className="text-zinc-300 dark:text-zinc-700">—</span>
        )}
      </td>

      {/* P/E */}
      <td className="px-4 py-3 font-mono tabular-nums text-zinc-600 dark:text-zinc-300">
        {summary.per > 0 ? summary.per.toFixed(2) : <span className="text-zinc-300 dark:text-zinc-700">—</span>}
      </td>

      {/* Sektor */}
      <td className="px-4 py-3">
        {summary.sector ? (
          <span className="inline-block max-w-[9rem] truncate border border-(--neo-line) bg-zinc-100 px-2 py-0.5 text-[11px] font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            {summary.sector}
          </span>
        ) : (
          <span className="text-zinc-300 dark:text-zinc-700">—</span>
        )}
      </td>

      {/* Detail */}
      {/* <td className="px-4 py-3">
        <Link
          href={`/screener/${summary.ticker}`}
          className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 dark:border-zinc-700 px-2.5 py-1 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:border-emerald-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
          aria-label={`Buka analisis detail ${summary.ticker}`}
        >
          Analisis <ChevronRight className="size-3" />
        </Link>
      </td> */}
    </tr>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────
export function ResultsTable({ results, view, isWatchlisted, onToggleWatchlist, isCompareSelected, onToggleCompare }: ResultsTableProps) {
  if (results.length === 0) return <EmptyState />;


  if (view === 'grid') {
    return (
      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {results.map((result) => (
          <StockCard
            key={result.summary.ticker}
            result={result}
            isWatchlisted={isWatchlisted(result.summary.ticker)}
            onToggleWatchlist={() => onToggleWatchlist(result.summary.ticker)}
            isCompareSelected={isCompareSelected(result.summary.ticker)}
            onToggleCompare={() => onToggleCompare(result.summary.ticker)}
          />
        ))}
      </div>
    );
  }

  // table view
  return (
    <>
      {/* Desktop / tablet: table */}
      <div className="hidden overflow-x-auto overflow-hidden neo-border neo-shadow md:block">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="border-b-[3px] border-(--neo-line) bg-(--neo-accent) text-left text-xs font-bold uppercase tracking-wide text-black">
            <tr>
              <th className="w-16 px-3 py-3" />
              <th className="px-4 py-3">Simbol</th>
              <th className="px-4 py-3">Perubahan</th>
              <th className="px-4 py-3">Harga</th>
              <th className="px-4 py-3">Vol</th>
              {/* <th className="px-4 py-3">
                <span className="leading-tight">Volume<br />relatif</span>
              </th> */}
              <th className="px-4 py-3">Kap pasar</th>
              <th className="px-4 py-3">P/E</th>
              <th className="px-4 py-3">Sektor</th>
              {/* <th className="px-4 py-3">Detail</th> */}
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-(--neo-line) bg-white dark:bg-zinc-900">
            {results.map((result) => (
              <StockTableRow
                key={result.summary.ticker}
                result={result}
                isWatchlisted={isWatchlisted(result.summary.ticker)}
                onToggleWatchlist={() => onToggleWatchlist(result.summary.ticker)}
                isCompareSelected={isCompareSelected(result.summary.ticker)}
                onToggleCompare={() => onToggleCompare(result.summary.ticker)}
              />
            ))}
          </tbody>
        </table>
      </div>


      {/* Mobile: stacked cards */}
      <div className="grid gap-2.5 md:hidden">
        {results.map((result) => (
          <StockCard
            key={result.summary.ticker}
            result={result}
            isWatchlisted={isWatchlisted(result.summary.ticker)}
            onToggleWatchlist={() => onToggleWatchlist(result.summary.ticker)}
            isCompareSelected={isCompareSelected(result.summary.ticker)}
            onToggleCompare={() => onToggleCompare(result.summary.ticker)}
          />
        ))}
      </div>
    </>
  );
}
