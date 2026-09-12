'use client';

import { useMemo } from 'react';
import { Loader2, SearchX, Star } from 'lucide-react';
import { StockSummary } from '@/domain/models/Stock';
import { PresetEvaluation } from '@/domain/screener/presets';
import { cn, formatCompact, formatPercent } from '@/lib/format';
import { useLazyRvol } from '../hooks/useLazyRvol';
import { getRowDisplay, SignalTone } from '../lib/rowDisplay';

export interface ScreenerResult {
  summary: StockSummary;
  evaluation: PresetEvaluation;
}

const TONE_CLASS: Record<SignalTone, string> = {
  emerald: 'bg-(--term-emerald-tint) text-(--term-emerald) border-(--term-emerald-border)',
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  amber: 'bg-(--term-amber-tint) text-(--term-amber) border-(--term-amber-border)',
  gray: 'bg-(--term-surface-sunken) text-(--term-muted) border-(--term-border)',
  crimson: 'bg-(--term-crimson-tint) text-(--term-crimson) border-(--term-crimson-border)',
};

const SCORE_BAR_COLOR = (score: number) => {
  if (score >= 85) return 'var(--term-emerald)';
  if (score >= 65) return 'var(--term-cyan-strong)';
  if (score >= 50) return 'var(--term-amber)';
  return 'var(--term-muted)';
};

const GRID_COLS = '28px 220px 160px 96px 100px 130px 1fr 120px';

function TableRow({
  result,
  rvolFallback,
  isWatchlisted,
  onToggleWatchlist,
  compact,
}: {
  result: ScreenerResult;
  rvolFallback: number | null;
  isWatchlisted: boolean;
  onToggleWatchlist: () => void;
  compact: boolean;
}) {
  const { summary: s, evaluation } = result;
  const display = getRowDisplay(s, evaluation);
  const rvol = evaluation.relativeVolume ?? rvolFallback ?? null;

  return (
    <div
      className={cn('grid items-center gap-2 border-b border-(--term-border) px-4', compact ? 'py-2' : 'py-3')}
      style={{ gridTemplateColumns: GRID_COLS }}
    >
      <button type="button" onClick={onToggleWatchlist} aria-label="Watchlist">
        <Star className="size-3.5" style={isWatchlisted ? { color: 'var(--term-gold)' } : { color: 'var(--term-border-strong)' }} fill={isWatchlisted ? 'var(--term-gold)' : 'none'} strokeWidth={1.5} />
      </button>

      <div className="flex items-center gap-2 min-w-0">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-(--term-cyan-tint) text-[10px] font-bold text-(--term-cyan-strong)">
          {s.ticker.slice(0, 2)}
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="font-terminal-mono text-[13px] font-bold text-(--term-text)">{s.ticker}</span>
          <span className="truncate text-[11px] text-(--term-muted)">{s.name}</span>
        </div>
      </div>

      <div className="flex min-w-0 flex-col">
        <span className="truncate text-xs text-(--term-text)">{s.sector}</span>
        <span className="truncate font-terminal-mono text-[10px] text-(--term-muted)">{s.subSector}</span>
      </div>

      <span className="font-terminal-mono text-right text-[13px] font-semibold text-(--term-text)">Rp {new Intl.NumberFormat('id-ID').format(s.lastClose)}</span>

      <span className={cn('font-terminal-mono text-right text-[13px] font-bold', s.percentChange1D >= 0 ? 'text-(--term-emerald)' : 'text-(--term-crimson)')}>
        {formatPercent(s.percentChange1D)}
      </span>

      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <span className="font-terminal-mono text-xs font-bold text-(--term-text)">{display.scoreComposite}</span>
          <span className="font-terminal-mono text-[10px] text-(--term-muted)">/100</span>
        </div>
        <div className="h-1 w-20 overflow-hidden rounded-full bg-(--term-surface-sunken)">
          <div style={{ width: `${display.scoreComposite}%`, background: SCORE_BAR_COLOR(display.scoreComposite) }} className="h-full rounded-full" />
        </div>
      </div>

      <div className="flex flex-col items-start gap-1 min-w-0">
        <span className={cn('rounded border px-1.5 py-0.5 text-[10px] font-bold', TONE_CLASS[display.signalTone])}>{display.signalLabel}</span>
        <span className="truncate text-[10px] text-(--term-muted)">{display.signalSub}</span>
      </div>

      <div className="flex flex-col items-end">
        <span className="font-terminal-mono text-xs font-semibold text-(--term-text)">{formatCompact(s.volume)}</span>
        <span className="font-terminal-mono text-[10px] text-(--term-muted)">{rvol != null ? `${rvol.toFixed(2)}x SMA20` : '—'}</span>
      </div>
    </div>
  );
}

export function TerminalTable({
  results,
  totalCount,
  isBusy,
  progress,
  isWatchlisted,
  onToggleWatchlist,
  hasMore,
  onLoadMore,
  remainingCount,
  compact,
}: {
  results: ScreenerResult[];
  totalCount: number;
  isBusy: boolean;
  progress: { checked: number; total: number };
  isWatchlisted: (ticker: string) => boolean;
  onToggleWatchlist: (ticker: string) => void;
  hasMore: boolean;
  onLoadMore: () => void;
  remainingCount: number;
  compact: boolean;
}) {
  // Only fetch RVOL for rows whose preset didn't already compute it — bounded
  // to the currently visible page, not the whole result set.
  const needsRvol = useMemo(() => results.filter((r) => r.evaluation.relativeVolume == null).map((r) => r.summary.ticker), [results]);
  const rvolByTicker = useLazyRvol(needsRvol);

  return (
    <div className="overflow-hidden rounded-lg border border-(--term-border) bg-(--term-surface)">
      <div className="flex items-center justify-between border-b border-(--term-border) px-4 py-3">
        <div className="flex flex-col">
          <span className="text-sm font-bold text-(--term-text)">Hasil Screener Realtime</span>
          <span className="text-[11px] text-(--term-muted)">
            Menampilkan {results.length} dari {totalCount} Emiten BEI/IHSG
          </span>
        </div>
        {isBusy && (
          <span className="flex items-center gap-2 font-terminal-mono text-[11px] font-semibold text-(--term-muted)">
            <Loader2 className="size-3.5 animate-spin" strokeWidth={2.5} />
            {progress.total > 0 ? `${progress.checked}/${progress.total}` : 'Memuat...'}
          </span>
        )}
      </div>

      <div className="hidden bg-(--term-surface-sunken) px-4 py-2 sm:grid sm:items-center sm:gap-2" style={{ gridTemplateColumns: GRID_COLS }}>
        <span />
        <span className="font-terminal-mono text-[10px] font-bold text-(--term-muted)">SIMBOL &amp; EMITEN</span>
        <span className="font-terminal-mono text-[10px] font-bold text-(--term-muted)">SEKTOR</span>
        <span className="font-terminal-mono text-right text-[10px] font-bold text-(--term-muted)">HARGA (RP)</span>
        <span className="font-terminal-mono text-right text-[10px] font-bold text-(--term-muted)">PERUBAHAN %</span>
        <span className="font-terminal-mono text-[10px] font-bold text-(--term-muted)">SKOR AI</span>
        <span className="font-terminal-mono text-[10px] font-bold text-(--term-muted)">SINYAL &amp; ALGORITMA AI</span>
        <span className="font-terminal-mono text-right text-[10px] font-bold text-(--term-muted)">VOLUME / RVOL</span>
      </div>

      {results.length === 0 && !isBusy ? (
        <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
          <SearchX className="size-6 text-(--term-muted)" strokeWidth={2} />
          <p className="text-sm font-bold text-(--term-text)">Belum ada saham yang lolos</p>
          <p className="max-w-xs text-xs text-(--term-muted)">Tidak ada saham yang memenuhi kriteria filter ini. Coba filter lain.</p>
        </div>
      ) : (
        results.map((r) => (
          <TableRow
            key={r.summary.ticker}
            result={r}
            rvolFallback={rvolByTicker[r.summary.ticker] ?? null}
            isWatchlisted={isWatchlisted(r.summary.ticker)}
            onToggleWatchlist={() => onToggleWatchlist(r.summary.ticker)}
            compact={compact}
          />
        ))
      )}

      {hasMore && (
        <div className="p-3">
          <button type="button" onClick={onLoadMore} className="w-full rounded-md border border-(--term-border) py-2 text-xs font-bold text-(--term-muted)">
            Muat {Math.min(50, remainingCount)} Lagi
          </button>
        </div>
      )}
    </div>
  );
}
