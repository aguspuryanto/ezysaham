'use client';

import { ArrowDown, ArrowUp } from 'lucide-react';
import { PerformerRow, PerfPeriod, PerfTrend } from '@/domain/analysis/bestPerforming';
import { cn } from '@/lib/format';
import { TONE_TEXT } from '../../screener/detail/components/ui';
import { DASH, fmtCompact, fmtMultiple, fmtNum, fmtPct, fmtPctPlain, toneOf } from '../../screener/detail/format';

export type SortKey = 'perf' | 'perf1Y' | 'avgValue20' | 'capitalization' | 'per' | 'pbv' | 'roe' | 'fromHigh52' | 'maxDrawdown' | 'spikeDays';

export const SORT_VALUE: Record<SortKey, (r: PerformerRow) => number> = {
  perf: (r) => r.perf,
  perf1Y: (r) => r.summary.percentChange1Y,
  avgValue20: (r) => r.avgValue20,
  capitalization: (r) => r.summary.capitalization,
  per: (r) => r.summary.per,
  pbv: (r) => r.summary.pbv,
  roe: (r) => r.summary.roe,
  fromHigh52: (r) => r.fromHigh52,
  maxDrawdown: (r) => r.maxDrawdown,
  spikeDays: (r) => r.spikeDays,
};

const TH = 'whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-(--sv-muted)';
const TD = 'whitespace-nowrap px-3 py-3 tabular-nums';

const TREND_TONE: Record<PerfTrend, string> = {
  'Uptrend kuat': 'text-emerald-600 dark:text-emerald-400',
  Uptrend: 'text-emerald-600/80 dark:text-emerald-400/80',
  Melemah: 'text-rose-600 dark:text-rose-400',
};

function SortableTh({ k, label, right = true, sort, onSort }: {
  k: SortKey; label: string; right?: boolean; sort: { key: SortKey; desc: boolean }; onSort: (key: SortKey) => void;
}) {
  const active = sort.key === k;
  return (
    <th className={cn(TH, right && 'text-right')} aria-sort={active ? (sort.desc ? 'descending' : 'ascending') : 'none'}>
      <button type="button" onClick={() => onSort(k)} className={cn('inline-flex items-center gap-1 uppercase hover:text-(--sv-text)', active && 'text-(--sv-text)')}>
        {label}
        {active && (sort.desc ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />)}
      </button>
    </th>
  );
}

/** Valuation multiples ≤ 0 mean loss / negative equity — shown as "—" rather than a misleading number. */
const positive = (n: number) => (n > 0 ? n : null);

export function BestPerformingTable({
  rows, period, sort, onSort, onSelect,
}: {
  rows: PerformerRow[];
  period: PerfPeriod;
  sort: { key: SortKey; desc: boolean };
  onSort: (key: SortKey) => void;
  onSelect: (r: PerformerRow) => void;
}) {

  return (
    <div className="overflow-hidden rounded-xl border border-(--sv-border) bg-(--sv-surface) shadow-(--sv-shadow)">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-(--sv-border) bg-(--sv-bg)">
            <tr>
              <th className={cn(TH, 'text-right')}>#</th>
              <th className={TH}>Saham</th>
              <th className={cn(TH, 'text-right')}>Harga</th>
              <SortableTh sort={sort} onSort={onSort} k="perf" label={`Perf ${period}`} />
              {period !== '1Y' && <SortableTh sort={sort} onSort={onSort} k="perf1Y" label="Perf 1Y" />}
              <SortableTh sort={sort} onSort={onSort} k="avgValue20" label="Nilai/hari" />
              <SortableTh sort={sort} onSort={onSort} k="capitalization" label="Kap." />
              <SortableTh sort={sort} onSort={onSort} k="per" label="PER" />
              <SortableTh sort={sort} onSort={onSort} k="pbv" label="PBV" />
              <SortableTh sort={sort} onSort={onSort} k="roe" label="ROE" />
              <SortableTh sort={sort} onSort={onSort} k="fromHigh52" label="Dari high" />
              <SortableTh sort={sort} onSort={onSort} k="maxDrawdown" label="Max DD" />
              <th className={TH}>Trend</th>
              <th className={TH}>Fase</th>
              <SortableTh sort={sort} onSort={onSort} k="spikeDays" label="Karakter" right={false} />
            </tr>
          </thead>
          <tbody className="divide-y divide-(--sv-border)">
            {rows.map((r, k) => {
              const s = r.summary;
              return (
                <tr
                  key={s.ticker}
                  tabIndex={0}
                  onClick={() => onSelect(r)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(r); } }}
                  className="cursor-pointer outline-none hover:bg-(--sv-bg) focus-visible:bg-(--sv-primary-soft)"
                >
                  <td className={cn(TD, 'text-right text-(--sv-muted)')}>{k + 1}</td>
                  <td className="px-3 py-3">
                    <div className="font-semibold text-(--sv-text)">{s.ticker}</div>
                    <div className="max-w-44 truncate text-xs text-(--sv-muted)">{s.name}</div>
                    <div className="max-w-44 truncate text-[11px] text-(--sv-muted)">{s.sector}</div>
                  </td>
                  <td className={cn(TD, 'text-right')}>
                    <div className="font-semibold text-(--sv-text)">{fmtNum(s.lastClose)}</div>
                    <div className={cn('text-xs', TONE_TEXT[toneOf(s.percentChange1D)])}>{fmtPct(s.percentChange1D)}</div>
                  </td>
                  <td className={cn(TD, 'text-right font-semibold', TONE_TEXT[toneOf(r.perf)])}>{fmtPct(r.perf, 1)}</td>
                  {period !== '1Y' && <td className={cn(TD, 'text-right', TONE_TEXT[toneOf(s.percentChange1Y)])}>{fmtPct(s.percentChange1Y, 1)}</td>}
                  <td className={cn(TD, 'text-right text-(--sv-text)')}>Rp {fmtCompact(r.avgValue20)}</td>
                  <td className={cn(TD, 'text-right text-(--sv-text)')}>{s.capitalization > 0 ? `Rp ${fmtCompact(s.capitalization)}` : DASH}</td>
                  <td className={cn(TD, 'text-right text-(--sv-text)')}>{fmtMultiple(positive(s.per))}</td>
                  <td className={cn(TD, 'text-right text-(--sv-text)')}>{fmtMultiple(positive(s.pbv))}</td>
                  <td className={cn(TD, 'text-right', TONE_TEXT[toneOf(s.roe)])}>{fmtPctPlain(s.roe)}</td>
                  <td className={cn(TD, 'text-right text-(--sv-text)')}>{fmtPct(r.fromHigh52, 1)}</td>
                  <td className={cn(TD, 'text-right text-rose-600 dark:text-rose-400')}>{fmtPct(r.maxDrawdown, 1)}</td>
                  <td className={cn(TD, 'font-medium', TREND_TONE[r.trend])}>{r.trend}</td>
                  <td className={cn(TD, 'text-(--sv-text)')}>{r.phase ? `${r.phase.emoji} ${r.phase.label}` : DASH}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-xs">
                    <div className={cn('font-medium', r.character === 'Didorong lonjakan' ? 'text-amber-600 dark:text-amber-400' : 'text-(--sv-text)')}>
                      {r.character ?? DASH}
                    </div>
                    <div className="text-(--sv-muted)">
                      {r.spikeDays} hari ≥ +10%{r.top5Share != null ? ` · 5 hari terbaik ${r.top5Share >= 1 ? "≥ 100" : Math.round(r.top5Share * 100)}%` : ''}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
