'use client';

/**
 * SwingTradingTable.tsx
 *
 * Results for the Swing Trading preset (docs/features_swingtrading.md). Columns follow the spec:
 * Kode | Harga | Trend | RSI | RVOL | 1W | 1M | Setup | Entry | TP1 | TP2 | SL | R:R | Score | Status.
 * Every value comes from `evaluation.swingTrading`; anything not computable renders as
 * "DATA TIDAK TERSEDIA" rather than a guess. Presentation only.
 */

import { ClipboardList } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DATA_NA } from '@/domain/screener/setupUtils';
import {
  SW_SCORE_BUY,
  SW_SCORE_WAIT,
  SWING_SETUP_LABEL,
  SWING_STATUS_LABEL,
  SwingTradingSetup,
  SwingTradingStatus,
  SwingTrendLabel,
} from '@/domain/screener/swingTrading';
import { cn, formatRupiah } from '@/lib/format';
import { Popover } from './Popover';
import { ScreenerResult } from './ResultsTable';
import { Chip } from './ScreenerBadges';
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

const STATUS_TONE: Record<SwingTradingStatus, SetupTone> = { BUY: 'positive', WAIT: 'warning', NO_TRADE: 'negative' };
/** Columns rendered by Row (identity 3 + Harga + 13 data + Aksi). */
const COLUMN_COUNT = 18;

function StatusChip({ status }: { status: SwingTradingStatus }) {
  return <SetupStatusChip tone={STATUS_TONE[status]} label={SWING_STATUS_LABEL[status]} />;
}

function TrendChip({ trend }: { trend: SwingTrendLabel }) {
  if (trend == null) return <NA />;
  const tone = trend === 'UPTREND' ? 'positive' : trend === 'DOWNTREND' ? 'negative' : 'neutral';
  const label = trend === 'UPTREND' ? 'Uptrend' : trend === 'DOWNTREND' ? 'Downtrend' : 'Sideways';
  return <Chip tone={tone}>{label}</Chip>;
}

function SetupChip({ sw }: { sw: SwingTradingSetup }) {
  return <Chip tone={sw.setupType === 'NONE' ? 'neutral' : 'info'}>{SWING_SETUP_LABEL[sw.setupType]}</Chip>;
}

function SwingScore({ sw }: { sw: SwingTradingSetup }) {
  const { scores } = sw;
  return (
    <ScoreCell
      total={scores.total}
      good={SW_SCORE_BUY}
      fair={SW_SCORE_WAIT}
      rows={[
        ['Trend', scores.trend, '25%'],
        ['Momentum', scores.momentum, '25%'],
        ['Volume', scores.volume, '20%'],
        ['Setup/Price Action', scores.setup, '20%'],
        ['Risk/Reward', scores.riskReward, '10%'],
      ]}
    />
  );
}

function ConclusionButton({ ticker, sw }: { ticker: string; sw: SwingTradingSetup }) {
  const items: Array<[string, string]> = [
    ['Mengapa menarik?', sw.conclusion.why],
    ['Trigger entry', sw.conclusion.trigger],
    ['Target 5–15%', sw.conclusion.target],
    ['Invalidation / SL', sw.conclusion.invalidation],
    ['Alasan TIDAK entry', sw.conclusion.reasonsNotToEnter],
  ];
  return (
    <Popover
      mode="click"
      label={`Kesimpulan swing ${ticker}`}
      width={360}
      trigger={<ClipboardList className="size-4" strokeWidth={2} />}
      triggerClassName="size-8 rounded-lg text-(--sv-primary) hover:bg-(--sv-primary-soft)"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-(--sv-text)">{ticker}</p>
        <StatusChip status={sw.status} />
      </div>
      <ol className="mt-2 space-y-1.5">
        {items.map(([q, a], i) => (
          <li key={q} className="text-xs leading-relaxed">
            <span className="font-semibold text-(--sv-text)">{i + 1}. {q}</span>{' '}
            <span className="text-(--sv-text)">{a}</span>
          </li>
        ))}
      </ol>
      <div className="mt-3 space-y-2.5 border-t border-(--sv-border) pt-2.5">
        <CheckList title="Risk gate" checks={sw.riskChecks} />
        <CheckList title="Setup & trigger" checks={sw.setupChecks} />
      </div>
      <p className="mt-2.5 border-t border-(--sv-border) pt-2 text-[11px] text-(--sv-muted)">
        &quot;Buy area&quot; ≠ BUY otomatis · entry hanya setelah trigger valid · jangan kejar di atas batas entry · risiko maks 1% modal · tanpa averaging down. Bukan rekomendasi beli/jual.
      </p>
    </Popover>
  );
}

// ── Desktop row ──────────────────────────────────────────────────────────────
function Row({ result, index, actions }: { result: ScreenerResult; index: number; actions: RowActions }) {
  const router = useRouter();
  const { summary: s, evaluation } = result;
  const sw = evaluation.swingTrading;

  return (
    <tr
      onClick={() => router.push(`/screener/${s.ticker}`)}
      className="group cursor-pointer border-b border-(--sv-border) last:border-b-0 hover:bg-slate-50 dark:hover:bg-slate-800/40"
    >
      <IdentityCells ticker={s.ticker} name={s.name} index={index} actions={actions} />
      <td className={TD}>
        <p className="font-bold tabular-nums">{formatRupiah(s.lastClose)}</p>
        <p className={cn('text-xs font-medium tabular-nums', pctClass(s.percentChange1D))}>{pct(s.percentChange1D)}</p>
      </td>
      {sw ? (
        <>
          <td className="px-2.5 py-3"><TrendChip trend={sw.trend} /></td>
          <td className={TD}><Num v={sw.rsi} digits={1} /></td>
          <td className={TD}><Num v={sw.rvol} digits={2} suffix="x" /></td>
          <td className={TD}><PctCell v={sw.return1W} /></td>
          <td className={TD}><PctCell v={sw.return1M} /></td>
          <td className="px-2.5 py-3"><SetupChip sw={sw} /></td>
          <td className={cn(TD, 'font-semibold')}>
            {sw.entryTrigger == null ? <NA /> : <span className="tabular-nums">≥ {formatRupiah(sw.entryTrigger)}</span>}
            {sw.maxEntry != null && <p className="text-[11px] font-normal tabular-nums text-(--sv-muted)">maks {formatRupiah(sw.maxEntry)}</p>}
            {sw.chasing && <p className="text-[11px] font-medium text-amber-700 dark:text-amber-400">WAIT pullback</p>}
          </td>
          <td className={cn(TD, 'text-emerald-700 dark:text-emerald-400')}>
            <Num v={sw.tp1} rupiah />
            {sw.tp1Pct != null && <p className="text-[11px] tabular-nums text-(--sv-muted)">+{sw.tp1Pct.toFixed(1).replace('.', ',')}%</p>}
          </td>
          <td className={cn(TD, 'text-emerald-700 dark:text-emerald-400')}>
            <Num v={sw.tp2} rupiah />
            {sw.tp2Pct != null && <p className="text-[11px] tabular-nums text-(--sv-muted)">+{sw.tp2Pct.toFixed(1).replace('.', ',')}%</p>}
          </td>
          <td className={cn(TD, 'text-rose-700 dark:text-rose-400')}><Num v={sw.sl} rupiah /></td>
          <td className={TD}>
            {sw.riskReward == null ? <NA /> : <span className="tabular-nums">1:{sw.riskReward.toFixed(2).replace('.', ',')}</span>}
            {sw.targetBasis === 'rMultiple' && <p className="text-[11px] text-(--sv-muted)" title="Tidak ada resistance di atas — target dari kelipatan risiko">R-multiple</p>}
          </td>
          <td className={TD} onClick={(e) => e.stopPropagation()}><SwingScore sw={sw} /></td>
          <td className="px-2.5 py-3"><StatusChip status={sw.status} /></td>
        </>
      ) : (
        <td colSpan={COLUMN_COUNT - 5} className="px-2.5 py-3 text-sm text-(--sv-muted)">{DATA_NA}</td>
      )}
      <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-0.5">
          {sw && <ConclusionButton ticker={s.ticker} sw={sw} />}
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
  const sw = evaluation.swingTrading;
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
        {sw && (
          <>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <StatusChip status={sw.status} />
                <SetupChip sw={sw} />
              </div>
              <span className="text-sm text-(--sv-muted)">Skor <b className="tabular-nums text-(--sv-text)">{sw.scores.total}</b></span>
            </div>
            <div className="mt-3 grid grid-cols-5 gap-2 rounded-lg bg-(--sv-bg) px-3 py-2">
              {stat('Entry', sw.entryTrigger == null ? <NA /> : <span className="tabular-nums">≥{sw.entryTrigger.toLocaleString('id-ID')}</span>)}
              {stat('TP1', <Num v={sw.tp1} />)}
              {stat('TP2', <Num v={sw.tp2} />)}
              {stat('SL', <Num v={sw.sl} />)}
              {stat('R:R', <Num v={sw.riskReward} digits={2} />)}
            </div>
            <div className="mt-2 grid grid-cols-4 gap-2 px-3 text-xs">
              {stat('RSI', <Num v={sw.rsi} digits={1} />)}
              {stat('RVOL', <Num v={sw.rvol} digits={2} suffix="x" />)}
              {stat('1W', <PctCell v={sw.return1W} />)}
              {stat('1M', <PctCell v={sw.return1M} />)}
            </div>
            <p className="mt-2.5 text-xs leading-relaxed text-(--sv-muted)">{sw.conclusion.why} {sw.conclusion.trigger}</p>
          </>
        )}
      </Link>
      <div className="flex items-center justify-end border-t border-(--sv-border) px-2 py-1">
        {sw && <ConclusionButton ticker={s.ticker} sw={sw} />}
        <WatchStar ticker={s.ticker} actions={actions} />
        <ActionsMenu ticker={s.ticker} actions={actions} />
      </div>
    </li>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export function SwingTradingTable({
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
    return <SetupEmptyState title="Tidak ada kandidat swing" hint={emptyHint} onResetFilters={onResetFilters} />;
  }

  return (
    <>
      <div className="hidden max-h-[calc(100vh-9rem)] overflow-auto rounded-xl border border-(--sv-border) bg-(--sv-surface) shadow-(--sv-shadow) md:block">
        <table className="w-full min-w-[1320px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <IdentityHeadCells />
              <Th className="left-20 z-20 border-r" sortKey="ticker" sort={sort} onSort={onSort}>Kode</Th>
              <Th sortKey="price" sort={sort} onSort={onSort} align="right">Harga</Th>
              <Th tip={{ term: 'Trend', text: 'Uptrend = harga > EMA18, EMA8 > EMA18, dan harga > EMA200.' }}>Trend</Th>
              <Th align="right" tip={{ term: 'RSI', text: 'RSI(14). Zona swing 50–70: momentum naik, belum overbought.' }}>RSI</Th>
              <Th align="right" tip={{ term: 'RVOL', text: 'Volume hari terakhir dibanding rata-rata 20 hari. Minimal 1,2x; breakout ideal ≥ 1,5x.' }}>RVOL</Th>
              <Th align="right">1W</Th>
              <Th align="right">1M</Th>
              <Th tip={{ term: 'Setup', text: 'Breakout = close menembus high 20 hari dengan RVOL ≥ 1,5x. Breakout-Retest = sempat breakout ≤ 10 hari lalu lalu menguji ulang level itu. Pullback Sehat = uptrend yang turun menyentuh EMA18 lalu memantul.' }}>Setup</Th>
              <Th align="right" tip={{ term: 'Entry', text: 'Trigger = break high bar terakhir + 1 tick. "maks" = batas entry (trigger + 0,5×ATR) — di atas itu jangan kejar.' }}>Entry</Th>
              <Th align="right" tip={{ term: 'TP1 / TP2', text: 'Resistance swing-high berikutnya (120 hari). Bila tidak ada resistance di atas, target dari 2R / 3R.' }}>TP1</Th>
              <Th align="right">TP2</Th>
              <Th align="right" tip={{ term: 'SL', text: 'Di bawah low 5 hari (atau level breakout), maksimal 2×ATR di bawah trigger.' }}>SL</Th>
              <Th align="right" tip={{ term: 'R:R', text: 'Reward ke TP1 dibanding risiko ke SL. Minimal 1:2.' }}>R:R</Th>
              <Th sortKey="score" sort={sort} onSort={onSort} align="right" tip={{ term: 'Score', text: 'Trend 25% · Momentum 25% · Volume 20% · Setup/Price Action 20% · Risk/Reward 10%.' }}>Score</Th>
              <Th tip={{ term: 'Status', text: 'SWING BUY SETUP = skor ≥80 + trigger valid. SWING WAIT = skor 60–79 atau trigger belum terpenuhi. NO TRADE (skor <60 / risk gate gagal) disaring dari daftar.' }}>Status</Th>
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
          ? Array.from({ length: 4 }, (_, i) => <li key={i} className="h-52 animate-pulse rounded-xl border border-(--sv-border) bg-(--sv-surface)" />)
          : rows.map((r) => <MobileCard key={r.summary.ticker} result={r} actions={actions} />)}
      </ul>
    </>
  );
}
