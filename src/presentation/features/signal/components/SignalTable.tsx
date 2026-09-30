'use client';

import { StockSignal } from '@/domain/models/Signal';
import { cn } from '@/lib/format';
import { TONE_TEXT } from '../../screener/detail/components/ui';
import { DASH, fmtNum, fmtPct, toneOf } from '../../screener/detail/format';
import { fmtRR, scoreTone } from '../signalUi';
import { BuyAllowedPill, ScoreBar, SignalBadge } from './SignalBadge';

const TH = 'whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-(--sv-muted)';
const TD = 'whitespace-nowrap px-3 py-3 tabular-nums';

export function SignalTable({ signals, onSelect }: { signals: StockSignal[]; onSelect: (s: StockSignal) => void }) {
  return (
    <div className="overflow-hidden rounded-xl border border-(--sv-border) bg-(--sv-surface) shadow-(--sv-shadow)">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-(--sv-border) bg-(--sv-bg)">
            <tr>
              <th className={TH}>Saham</th>
              <th className={cn(TH, 'text-right')}>Harga</th>
              <th className={TH}>Signal</th>
              <th className={TH}>SARA Score</th>
              <th className={cn(TH, 'text-right')}>Confidence</th>
              <th className={TH}>Pattern</th>
              <th className={cn(TH, 'text-right')}>Entry</th>
              <th className={cn(TH, 'text-right')}>TP1</th>
              <th className={cn(TH, 'text-right')}>SL</th>
              <th className={cn(TH, 'text-right')}>R:R</th>
              <th className={TH}>Boleh Entry?</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-(--sv-border)">
            {signals.map((s) => (
              <tr
                key={s.id}
                tabIndex={0}
                onClick={() => onSelect(s)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(s); } }}
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
                <td className={TD}><SignalBadge action={s.action} /></td>
                <td className={TD}>
                  <div className="flex items-center gap-2">
                    <span className={cn('w-7 font-semibold', TONE_TEXT[scoreTone(s.saraScore)])}>{s.saraScore}</span>
                    <ScoreBar score={s.saraScore} className="w-16" />
                  </div>
                </td>
                <td className={cn(TD, 'text-right text-(--sv-text)')}>{s.confidence}%</td>
                <td className={cn(TD, 'text-(--sv-muted)')}>{s.pattern}</td>
                <td className={cn(TD, 'text-right text-(--sv-text)')}>
                  {s.tradePlan ? `${fmtNum(s.tradePlan.entryLow)}–${fmtNum(s.tradePlan.entryHigh)}` : DASH}
                </td>
                <td className={cn(TD, 'text-right text-emerald-600 dark:text-emerald-400')}>{s.tradePlan ? fmtNum(s.tradePlan.tp1) : DASH}</td>
                <td className={cn(TD, 'text-right text-rose-600 dark:text-rose-400')}>{s.tradePlan ? fmtNum(s.tradePlan.stopLoss) : DASH}</td>
                <td className={cn(TD, 'text-right text-(--sv-text)')}>{s.tradePlan ? fmtRR(s.tradePlan.riskReward) : DASH}</td>
                <td className={TD}><BuyAllowedPill allowed={s.decision.buyAllowed} compact /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
