'use client';

import { TopBuyRow } from '@/domain/analysis/topBuyScreener';
import { SignalAction } from '@/domain/models/Signal';
import { cn } from '@/lib/format';
import { TONE_TEXT } from '../../screener/detail/components/ui';
import { DASH, fmtCompact, fmtMultiple, fmtNum, fmtPct, fmtPctPlain, toneOf } from '../../screener/detail/format';
import { fmtRR, scoreTone } from '../../signal/signalUi';

const TH = 'whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-(--sv-muted)';
const TD = 'whitespace-nowrap px-3 py-3 tabular-nums';

/** BUY → fundamentals + trade plan; WAIT → rules passed + engine trigger; AVOID → main reason. */
export function TopBuyTable({ rows, variant, onSelect }: { rows: TopBuyRow[]; variant: SignalAction; onSelect: (r: TopBuyRow) => void }) {
  return (
    <div className="overflow-hidden rounded-xl border border-(--sv-border) bg-(--sv-surface) shadow-(--sv-shadow)">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-(--sv-border) bg-(--sv-bg)">
            <tr>
              <th className={TH}>Saham</th>
              <th className={cn(TH, 'text-right')}>Harga</th>
              <th className={cn(TH, 'text-right')}>1W</th>
              {variant === 'BUY' && (
                <>
                  <th className={cn(TH, 'text-right')}>Nilai</th>
                  <th className={cn(TH, 'text-right')}>PER</th>
                  <th className={cn(TH, 'text-right')}>PBV</th>
                  <th className={cn(TH, 'text-right')}>ROE</th>
                  <th className={cn(TH, 'text-right')}>FF</th>
                </>
              )}
              <th className={cn(TH, 'text-right')}>SARA</th>
              {variant === 'BUY' ? (
                <>
                  <th className={cn(TH, 'text-right')}>Entry</th>
                  <th className={cn(TH, 'text-right')}>TP1 / TP2</th>
                  <th className={cn(TH, 'text-right')}>SL</th>
                  <th className={cn(TH, 'text-right')}>R:R</th>
                </>
              ) : variant === 'WAIT' ? (
                <>
                  <th className={cn(TH, 'text-right')}>Aturan</th>
                  <th className={TH}>Aturan gagal</th>
                  <th className={TH}>Pemicu BUY</th>
                </>
              ) : (
                <th className={TH}>Alasan utama</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-(--sv-border)">
            {rows.map((r) => {
              const s = r.signal;
              const plan = s.tradePlan;
              const failed = s.reasons.filter((x) => !x.passed).map((x) => x.label);
              return (
                <tr
                  key={s.id}
                  tabIndex={0}
                  onClick={() => onSelect(r)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(r); } }}
                  className="cursor-pointer outline-none hover:bg-(--sv-bg) focus-visible:bg-(--sv-primary-soft)"
                >
                  <td className="px-3 py-3">
                    <div className="font-semibold text-(--sv-text)">{s.ticker}</div>
                    <div className="max-w-44 truncate text-xs text-(--sv-muted)">{s.companyName}</div>
                  </td>
                  <td className={cn(TD, 'text-right')}>
                    <div className="font-semibold text-(--sv-text)">{fmtNum(s.price)}</div>
                    <div className={cn('text-xs', TONE_TEXT[toneOf(s.changePct)])}>{fmtPct(s.changePct)}</div>
                  </td>
                  <td className={cn(TD, 'text-right', TONE_TEXT[toneOf(r.summary.percentChange1W)])}>{fmtPct(r.summary.percentChange1W)}</td>
                  {variant === 'BUY' && (
                    <>
                      <td className={cn(TD, 'text-right text-(--sv-text)')}>Rp {fmtCompact(r.summary.value)}</td>
                      <td className={cn(TD, 'text-right text-(--sv-text)')}>{fmtMultiple(r.summary.per, 2)}</td>
                      <td className={cn(TD, 'text-right text-(--sv-text)')}>{fmtMultiple(r.summary.pbv, 2)}</td>
                      <td className={cn(TD, 'text-right text-(--sv-text)')}>{fmtPctPlain(r.summary.roe, 2)}</td>
                      <td className={cn(TD, 'text-right text-(--sv-text)')}>{fmtPctPlain(r.summary.freeFloat, 1)}</td>
                    </>
                  )}
                  <td className={cn(TD, 'text-right font-semibold', TONE_TEXT[scoreTone(s.saraScore)])}>{s.saraScore}</td>
                  {variant === 'BUY' ? (
                    <>
                      <td className={cn(TD, 'text-right text-(--sv-text)')}>{plan ? `${fmtNum(plan.entryLow)}–${fmtNum(plan.entryHigh)}` : DASH}</td>
                      <td className={cn(TD, 'text-right text-emerald-600 dark:text-emerald-400')}>{plan ? `${fmtNum(plan.tp1)} / ${fmtNum(plan.tp2)}` : DASH}</td>
                      <td className={cn(TD, 'text-right text-rose-600 dark:text-rose-400')}>{plan ? fmtNum(plan.stopLoss) : DASH}</td>
                      <td className={cn(TD, 'text-right text-(--sv-text)')}>{plan ? fmtRR(plan.riskReward) : DASH}</td>
                    </>
                  ) : variant === 'WAIT' ? (
                    <>
                      <td className={cn(TD, 'text-right text-(--sv-text)')}>{r.rulesPct}%</td>
                      <td className="max-w-56 px-3 py-3 text-xs text-(--sv-muted)">{failed.join(', ') || DASH}</td>
                      <td className="max-w-72 px-3 py-3 text-xs text-(--sv-text)">{s.decision.trigger || DASH}</td>
                    </>
                  ) : (
                    <td className="max-w-80 px-3 py-3 text-xs text-(--sv-muted)">{s.risks[0] ?? (failed.join(', ') || DASH)}</td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
