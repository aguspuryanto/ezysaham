'use client';

/**
 * DayTradingTable.tsx
 *
 * Results for the Day Trading preset (docs/features_daytrading.md). Columns follow the spec:
 * Kode | Harga | EMA9 | EMA20 | RSI | RVOL | 1D | 1W | Resistance | Entry Trigger | TP | SL | R:R |
 * Score | Status. Every value comes from `evaluation.dayTrading`; anything not computable renders
 * as "DATA TIDAK TERSEDIA" rather than a guess. Presentation only.
 */

import { ClipboardList } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import {
  DATA_NA,
  DAY_TRADING_VERDICT_LABEL,
  DayTradingSetup,
  DayTradingVerdict,
  DT_SCORE_SETUP,
  DT_SCORE_WATCH,
} from '@/domain/screener/dayTrading';
import { buildDayTradingReport, dayTradingReportText } from '@/domain/screener/dayTradingReport';
import { cn, formatRupiah } from '@/lib/format';
import { CopyShareButton } from '../detail/components/TradingModesReport';
import { Popover } from './Popover';
import { ScreenerResult } from './ResultsTable';
import { ActionsMenu, RowActions, ScreenerSort, ScreenerSortKey, Th, WatchStar } from './ScreenerTable';
import {
  CheckList,
  IdentityCells,
  IdentityHeadCells,
  NA,
  Num,
  pct,
  pctClass,
  PctCell,
  ScoreCell,
  SetupEmptyState,
  SetupSkeletonRows,
  SetupStatusChip,
  SetupTone,
  TD,
} from './SetupTableParts';

const VERDICT_TONE: Record<DayTradingVerdict, SetupTone> = { SETUP: 'positive', WATCH: 'warning', AVOID: 'negative', AVOID_CHASING: 'negative' };
/** Columns rendered by Row (identity 3 + Harga + 13 data + Aksi). */
const COLUMN_COUNT = 18;

function StatusChip({ verdict }: { verdict: DayTradingVerdict }) {
  return <SetupStatusChip tone={VERDICT_TONE[verdict]} label={DAY_TRADING_VERDICT_LABEL[verdict]} />;
}

function DayScore({ dt }: { dt: DayTradingSetup }) {
  const { scores } = dt;
  return (
    <ScoreCell
      total={scores.total}
      good={DT_SCORE_SETUP}
      fair={DT_SCORE_WATCH}
      rows={[
        ['Trend', scores.trend, '25%'],
        ['Momentum', scores.momentum, '25%'],
        ['Volume', scores.volume, '20%'],
        ['Liquidity', scores.liquidity, '15%'],
        ['Risk/Reward', scores.riskReward, '15%'],
      ]}
    />
  );
}

/** "⚡ EzySaham AI — DAY TRADING" report (dayTradingReport.ts) + the rule checks behind it. */
function ConclusionButton({ ticker, dt }: { ticker: string; dt: DayTradingSetup }) {
  const r = useMemo(() => buildDayTradingReport(ticker, dt), [ticker, dt]);
  const getText = useCallback(() => dayTradingReportText(r), [r]);
  const rows: Array<[string, string, string?]> = [
    ['Trend', r.trend],
    ['Momentum', r.momentum],
    ['Volume', r.volume],
    ['Likuiditas', r.liquidity],
    ['Trigger', r.trigger, 'font-semibold'],
    ['Entry', r.entry],
    ['SL', r.sl, 'text-rose-700 dark:text-rose-400'],
    ['TP', r.tp, 'text-emerald-700 dark:text-emerald-400'],
    ['R:R', r.rr],
  ];
  return (
    <Popover
      mode="click"
      label={`Kesimpulan day trading ${ticker}`}
      width={360}
      trigger={<ClipboardList className="size-4" strokeWidth={2} />}
      triggerClassName="size-8 rounded-lg text-(--sv-primary) hover:bg-(--sv-primary-soft)"
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold text-(--sv-muted)">⚡ EzySaham AI — DAY TRADING</p>
          <p className="text-sm font-bold text-(--sv-text)">{ticker}</p>
        </div>
        <CopyShareButton getText={getText} />
      </div>
      <div className="mt-2"><StatusChip verdict={dt.verdict} /></div>
      <dl className="mt-2.5 space-y-1 text-xs">
        {rows.map(([k, v, cls]) => (
          <div key={k} className="flex gap-2">
            <dt className="w-20 shrink-0 text-(--sv-muted)">{k}</dt>
            <dd className={cn('min-w-0 tabular-nums text-(--sv-text)', cls)}>{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2.5 text-xs leading-relaxed text-(--sv-text)">💡 <b>Kesimpulan:</b> {r.conclusion}</p>
      <details className="mt-2.5 border-t border-(--sv-border) pt-2">
        <summary className="cursor-pointer text-[11px] font-semibold text-(--sv-muted)">Cek aturan (risk gate & setup)</summary>
        <div className="mt-2 space-y-2.5">
          <CheckList title="Risk gate" checks={dt.riskChecks} />
          <CheckList title="Setup" checks={dt.setupChecks} />
        </div>
      </details>
      <p className="mt-2.5 border-t border-(--sv-border) pt-2 text-[11px] text-(--sv-muted)">
        ⚠️ Data EOD, bukan realtime. Trigger wajib dikonfirmasi dengan harga realtime. DAY TRADE SETUP ≠ entry otomatis.
      </p>
    </Popover>
  );
}

// ── Desktop row ──────────────────────────────────────────────────────────────
function Row({ result, index, actions }: { result: ScreenerResult; index: number; actions: RowActions }) {
  const router = useRouter();
  const { summary: s, evaluation } = result;
  const dt = evaluation.dayTrading;

  return (
    <tr
      onClick={() => router.push(`/screener/${s.ticker}`)}
      className="group cursor-pointer border-b border-(--sv-border) last:border-b-0 hover:bg-slate-50 dark:hover:bg-slate-800/40"
    >
      <IdentityCells ticker={s.ticker} name={s.name} index={index} actions={actions} />
      <td className={cn(TD, 'font-bold')}>{formatRupiah(s.lastClose)}</td>
      {dt ? (
        <>
          <td className={TD} onClick={(e) => e.stopPropagation()}><DayScore dt={dt} /></td>
          <td className="px-2.5 py-3"><StatusChip verdict={dt.verdict} /></td>
          <td className={TD}><Num v={dt.ema9} rupiah /></td>
          <td className={TD}><Num v={dt.ema20} rupiah /></td>
          <td className={TD}><Num v={dt.rsi} digits={1} /></td>
          <td className={TD}><Num v={dt.rvol} digits={2} suffix="x" /></td>
          <td className={TD}><PctCell v={dt.return1D} /></td>
          <td className={TD}><PctCell v={dt.return1W} /></td>
          <td className={TD}>
            <Num v={dt.resistance} rupiah />
            {dt.upsidePct != null && <p className="text-[11px] tabular-nums text-(--sv-muted)">+{dt.upsidePct.toFixed(1).replace('.', ',')}%</p>}
          </td>
          <td className={cn(TD, 'font-semibold')}>
            {dt.entryTrigger == null ? <NA /> : <span className="tabular-nums">≥ {formatRupiah(dt.entryTrigger)}</span>}
            {dt.chasing && <p className="text-[11px] font-medium text-amber-700 dark:text-amber-400">WAIT pullback</p>}
          </td>
          <td className={cn(TD, 'text-emerald-700 dark:text-emerald-400')}><Num v={dt.tp} rupiah /></td>
          <td className={cn(TD, 'text-rose-700 dark:text-rose-400')}><Num v={dt.sl} rupiah /></td>
          <td className={TD}><Num v={dt.riskReward} digits={2} /></td>
        </>
      ) : (
        <td colSpan={COLUMN_COUNT - 5} className="px-2.5 py-3 text-sm text-(--sv-muted)">{DATA_NA}</td>
      )}
      <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-0.5">
          {dt && <ConclusionButton ticker={s.ticker} dt={dt} />}
          <WatchStar ticker={s.ticker} actions={actions} />
          <ActionsMenu ticker={s.ticker} actions={actions} />
        </div>
      </td>
    </tr>
  );
}

// ── Mobile card ──────────────────────────────────────────────────────────────
function MobileCard({ result, actions }: { result: ScreenerResult; actions: RowActions }) {
  const { summary: s, evaluation } = result;
  const dt = evaluation.dayTrading;
  const stat = (label: string, node: React.ReactNode) => (
    <div>
      <p className="text-[11px] text-(--sv-muted)">{label}</p>
      <p className="text-sm font-semibold text-(--sv-text)">{node}</p>
    </div>
  );
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
            <p className={cn('text-xs font-medium tabular-nums', pctClass(s.percentChange1D))}>{pct(s.percentChange1D)}</p>
          </div>
        </div>
        {dt && (
          <>
            <div className="mt-3 flex items-center justify-between gap-2">
              <StatusChip verdict={dt.verdict} />
              <span className="text-sm text-(--sv-muted)">Skor <b className="tabular-nums text-(--sv-text)">{dt.scores.total}</b></span>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2 rounded-lg bg-(--sv-bg) px-3 py-2">
              {stat('Entry', dt.entryTrigger == null ? <NA /> : <span className="tabular-nums">≥{dt.entryTrigger.toLocaleString('id-ID')}</span>)}
              {stat('TP', <Num v={dt.tp} />)}
              {stat('SL', <Num v={dt.sl} />)}
              {stat('R:R', <Num v={dt.riskReward} digits={2} />)}
            </div>
            <div className="mt-2 grid grid-cols-4 gap-2 px-3 text-xs">
              {stat('RSI', <Num v={dt.rsi} digits={1} />)}
              {stat('RVOL', <Num v={dt.rvol} digits={2} suffix="x" />)}
              {stat('1W', <PctCell v={dt.return1W} />)}
              {stat('Resist.', <Num v={dt.resistance} />)}
            </div>
            <p className="mt-2.5 text-xs leading-relaxed text-(--sv-muted)">{buildDayTradingReport(s.ticker, dt).conclusion}</p>
          </>
        )}
      </Link>
      <div className="flex items-center justify-end border-t border-(--sv-border) px-2 py-1">
        {dt && <ConclusionButton ticker={s.ticker} dt={dt} />}
        <WatchStar ticker={s.ticker} actions={actions} />
        <ActionsMenu ticker={s.ticker} actions={actions} />
      </div>
    </li>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export function DayTradingTable({
  rows,
  startIndex,
  loading,
  sort,
  onSort,
  emptyHint,
  onResetFilters,
  ...actions
}: RowActions & {
  rows: ScreenerResult[];
  startIndex: number;
  loading: boolean;
  sort: ScreenerSort;
  onSort: (key: ScreenerSortKey) => void;
  emptyHint: string;
  onResetFilters?: () => void;
}) {
  if (!loading && rows.length === 0) {
    return <SetupEmptyState title="Tidak ada kandidat day trading" hint={emptyHint} onResetFilters={onResetFilters} />;
  }

  return (
    <>
      <div className="hidden max-h-[calc(100vh-9rem)] overflow-auto rounded-xl border border-(--sv-border) bg-(--sv-surface) shadow-(--sv-shadow) md:block">
        <table className="w-full min-w-[1280px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <IdentityHeadCells />
              <Th className="left-20 z-20 border-r" sortKey="ticker" sort={sort} onSort={onSort}>Kode</Th>
              <Th sortKey="price" sort={sort} onSort={onSort} align="right">Harga</Th>
              <Th sortKey="score" sort={sort} onSort={onSort} align="right" tip={{ term: 'Score', text: 'Trend 25% · Momentum 25% · Volume 20% · Liquidity 15% · Risk/Reward 15%.' }}>Score</Th>
              <Th tip={{ term: 'Status', text: 'DAY TRADE SETUP = skor ≥75 + setup valid + R:R ≥ 1,5 (bukan entry otomatis — tunggu trigger). WATCH = menarik tetapi belum cukup kuat / trigger belum valid. AVOID CHASING = harga sudah lari terlalu jauh. AVOID (skor <60 / risk gate gagal) disaring dari daftar.' }}>Status</Th>
              <Th align="right">EMA9</Th>
              <Th align="right">EMA20</Th>
              <Th align="right" tip={{ term: 'RSI', text: 'RSI(14). Zona day trading 50–70: momentum bullish, belum overbought.' }}>RSI</Th>
              <Th align="right" tip={{ term: 'RVOL', text: 'Volume hari terakhir dibanding rata-rata 20 hari. Minimal 1,2x.' }}>RVOL</Th>
              <Th sortKey="change" sort={sort} onSort={onSort} align="right">1D</Th>
              <Th align="right">1W</Th>
              <Th align="right" tip={{ term: 'Resistance', text: 'Swing high terdekat di atas harga (60 hari). Persentase = ruang naik ke resistance, minimal 5%.' }}>Resistance</Th>
              <Th align="right" tip={{ term: 'Entry Trigger', text: 'Break high hari terakhir + 1 tick. Entry hanya jika level ini ditembus — jangan beli sebelum trigger terpenuhi.' }}>Entry Trigger</Th>
              <Th align="right">TP</Th>
              <Th align="right">SL</Th>
              <Th align="right">R:R</Th>
              <Th align="right">Aksi</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? <SetupSkeletonRows columns={COLUMN_COUNT} /> : rows.map((r, i) => (
              <Row key={r.summary.ticker} result={r} index={startIndex + i + 1} actions={actions} />
            ))}
          </tbody>
        </table>
      </div>

      <ul className="grid gap-3 md:hidden">
        {loading
          ? Array.from({ length: 4 }, (_, i) => <li key={i} className="h-48 animate-pulse rounded-xl border border-(--sv-border) bg-(--sv-surface)" />)
          : rows.map((r) => <MobileCard key={r.summary.ticker} result={r} actions={actions} />)}
      </ul>
    </>
  );
}
