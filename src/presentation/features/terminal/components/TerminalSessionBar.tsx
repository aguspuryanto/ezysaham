'use client';

import { Download, RotateCcw } from 'lucide-react';
import { exportResultsAsCsv, exportResultsAsJson, toExportRows } from '@/lib/exportResults';
import { IdxSessionStatus } from '@/domain/market/tradingSession';
import { getRowDisplay } from '../lib/rowDisplay';
import { IhsgQuote } from '../hooks/useIhsgQuote';
import { ScreenerResult } from './TerminalTable';

export function TerminalSessionBar({
  session,
  ihsg,
  breadth,
  filteredCount,
  totalCount,
  onReset,
  results,
}: {
  session: IdxSessionStatus;
  ihsg: IhsgQuote | null;
  breadth: { advancing: number; declining: number; unchanged: number };
  filteredCount: number;
  totalCount: number;
  onReset: () => void;
  results: ScreenerResult[];
}) {
  const total = breadth.advancing + breadth.declining + breadth.unchanged || 1;
  const advPct = (breadth.advancing / total) * 100;
  const decPct = (breadth.declining / total) * 100;
  const flatPct = 100 - advPct - decPct;

  const handleExport = (kind: 'csv' | 'json') => {
    const rows = toExportRows(results.map((r) => ({ summary: r.summary, score: getRowDisplay(r.summary, r.evaluation).scoreComposite })));
    if (kind === 'csv') exportResultsAsCsv(rows);
    else exportResultsAsJson(rows);
  };

  return (
    <div className="flex shrink-0 flex-col gap-2.5 border-b border-(--term-border) bg-(--term-surface) px-4 py-2.5 sm:px-5">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
        <span
          className={
            'font-terminal-mono inline-flex items-center gap-1.5 rounded border px-2 py-1 text-[11px] font-bold ' +
            (session.isOpen ? 'border-(--term-emerald-border) bg-(--term-emerald-tint) text-(--term-emerald)' : 'border-(--term-border-strong) bg-(--term-surface-sunken) text-(--term-muted)')
          }
        >
          <span className={'size-1.5 rounded-full ' + (session.isOpen ? 'bg-(--term-emerald)' : 'bg-(--term-border-strong)')} />
          {session.label}
        </span>

        {ihsg && (
          <span className="font-terminal-mono text-xs text-(--term-muted)">
            IHSG <b className="text-(--term-text)">{new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(ihsg.value)}</b>{' '}
            <span className={ihsg.changePct >= 0 ? 'text-(--term-emerald)' : 'text-(--term-crimson)'}>
              ({ihsg.changePct >= 0 ? '+' : ''}
              {ihsg.changePct.toFixed(2)}%)
            </span>
          </span>
        )}

        <div className="flex items-center gap-2">
          <span className="font-terminal-mono text-xs text-(--term-muted)">BREADTH:</span>
          <span className="font-terminal-mono text-xs font-bold text-(--term-emerald)">{breadth.advancing} ▲</span>
          <div className="flex h-1.5 w-32 overflow-hidden rounded-full">
            <div style={{ width: `${advPct}%` }} className="h-full bg-(--term-emerald)" />
            <div style={{ width: `${decPct}%` }} className="h-full bg-(--term-crimson)" />
            <div style={{ width: `${flatPct}%` }} className="h-full bg-(--term-border-strong)" />
          </div>
          <span className="font-terminal-mono text-xs font-bold text-(--term-crimson)">{breadth.declining} ▼</span>
          <span className="font-terminal-mono text-xs text-(--term-muted)">{breadth.unchanged} =</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-terminal-mono inline-flex items-center gap-1.5 rounded border border-(--term-cyan-border) bg-(--term-cyan-tint) px-2 py-1 text-[11px] font-bold text-(--term-cyan-strong)">
          FILTER AKTIF: {filteredCount} / {totalCount} SAHAM
        </span>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onReset} className="flex items-center gap-1.5 rounded border border-(--term-border) px-2.5 py-1 text-[11px] font-bold text-(--term-muted)">
            <RotateCcw className="size-3" strokeWidth={2.5} />
            RESET
          </button>
          <button type="button" onClick={() => handleExport('csv')} className="flex items-center gap-1.5 rounded bg-(--term-cyan-strong) px-2.5 py-1 text-[11px] font-bold text-white">
            <Download className="size-3" strokeWidth={2.5} />
            CSV
          </button>
          <button type="button" onClick={() => handleExport('json')} className="flex items-center gap-1.5 rounded bg-(--term-cyan-strong) px-2.5 py-1 text-[11px] font-bold text-white">
            <Download className="size-3" strokeWidth={2.5} />
            JSON
          </button>
        </div>
      </div>
    </div>
  );
}
