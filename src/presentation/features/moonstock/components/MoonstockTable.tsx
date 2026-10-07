'use client';

import { ReactNode } from 'react';
import {
  InvestingRow,
  IntradayRow,
  labelEmoji,
  MoonStatus,
  MoonstockRow,
  SwingRow,
} from '@/domain/analysis/moonstockScreener';
import { VALUATION_VERDICT_LABEL } from '@/domain/analysis/fundamentalPillars';
import { cn } from '@/lib/format';
import { Badge, TONE_TEXT } from '../../screener/detail/components/ui';
import { DASH, fmtCompact, fmtNum, fmtPct, fmtPctPlain, Tone, toneOf } from '../../screener/detail/format';

const TH = 'whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-(--sv-muted)';
const TD = 'whitespace-nowrap px-3 py-3 tabular-nums text-(--sv-text)';
const R = 'text-right';

export const STATUS_TONE: Record<MoonStatus, Tone> = { HOT: 'negative', SOLID: 'positive', GROWTH: 'info', WATCH: 'warning' };
const LABEL_TONE: Record<string, Tone> = {
  BREAKOUT: 'positive', MOMENTUM: 'positive', PULLBACK: 'info', UNDERVALUED: 'positive', QUALITY: 'positive',
  WATCH: 'warning', DEVELOPING: 'warning', 'FAIR VALUE': 'warning',
  'AVOID CHASING': 'negative', AVOID: 'negative', 'VALUE TRAP RISK': 'negative',
};

export function LabelBadge({ row }: { row: MoonstockRow }) {
  return <Badge tone={LABEL_TONE[row.label] ?? 'neutral'}>{labelEmoji(row.mode, row.label)} {row.label}</Badge>;
}

export function StatusBadge({ status }: { status: MoonStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{status}</Badge>;
}

const x = (n: number | null | undefined) => (n == null ? DASH : `${fmtNum(n, 1)}×`);
const price = (n: number | null | undefined) => (n == null ? DASH : fmtNum(n));

function Ticker({ row }: { row: MoonstockRow }) {
  return (
    <td className="px-3 py-3">
      <div className="font-semibold text-(--sv-text)">{row.ticker} <span className="text-[10px] font-medium text-(--sv-muted)">{row.cap}</span></div>
      <div className="max-w-40 truncate text-xs text-(--sv-muted)">{row.name}</div>
    </td>
  );
}

function PriceCell({ row }: { row: MoonstockRow }) {
  return (
    <td className={cn(TD, R)}>
      <div className="font-semibold">{fmtNum(row.price)}</div>
      <div className={cn('text-xs', TONE_TEXT[toneOf(row.changePct)])}>{fmtPct(row.changePct)}</div>
    </td>
  );
}

function TriggerCell({ text }: { text: string }) {
  return <td className="min-w-64 max-w-80 px-3 py-3 text-xs leading-snug text-(--sv-muted)">{text}</td>;
}

function IntradayCells({ r }: { r: IntradayRow }) {
  return (
    <>
      <td className={cn(TD, R)}>{price(r.vwap)}</td>
      <td className={cn(TD, R)}>{x(r.rvol)}</td>
      <td className={cn(TD, R)}>{fmtCompact(r.volume)}</td>
      <td className={TD}>{r.momentum}</td>
      <td className={TD}>{r.structure}</td>
      <td className={cn(TD, R)}>{price(r.resistance)}</td>
      <td className={TD}>{r.setup}</td>
    </>
  );
}

function SwingCells({ r }: { r: SwingRow }) {
  return (
    <>
      <td className={TD} title={r.ema200Available ? undefined : 'EMA 200 tidak tersedia'}>{r.trend}</td>
      <td className={cn(TD, 'text-xs')}>{r.structure}</td>
      <td className={cn(TD, R)}>{fmtNum(r.rsi, 1)}</td>
      <td className={cn(TD, R)}>{x(r.rvol)}</td>
      <td className={TD}>{r.setup}</td>
      <td className={cn(TD, R)}>{price(r.support)}</td>
      <td className={cn(TD, R)}>{price(r.resistance)}</td>
      <td className={cn(TD, R)}>
        <div>{r.upsidePct != null ? fmtPct(r.upsidePct, 1) : 'Blue sky'}</div>
        <div className="text-xs text-(--sv-muted)">R:R {r.riskReward != null ? `1:${fmtNum(r.riskReward, 1)}` : DASH}</div>
      </td>
    </>
  );
}

function InvestingCells({ r }: { r: InvestingRow }) {
  return (
    <>
      <td className={cn(TD, R)}>{r.per != null ? `${fmtNum(r.per, 1)}x` : DASH}</td>
      <td className={cn(TD, R)}>{r.pbv != null ? `${fmtNum(r.pbv, 1)}x` : DASH}</td>
      <td className={cn(TD, R)}>{fmtPctPlain(r.roe)}</td>
      <td className={cn(TD, R, TONE_TEXT[toneOf(r.revenueGrowth)])}>{fmtPct(r.revenueGrowth, 1)}</td>
      <td className={cn(TD, R, TONE_TEXT[toneOf(r.profitGrowth)])}>{fmtPct(r.profitGrowth, 1)}</td>
      <td className={cn(TD, R)}>{fmtPctPlain(r.netMargin)}</td>
      <td className={cn(TD, R)} title={r.debtToEquity == null ? 'D/E tidak relevan untuk bank/asuransi' : undefined}>
        {r.debtToEquity != null ? `${fmtNum(r.debtToEquity / 100, 2)}×` : 'N/A'}
      </td>
      <td className={cn(TD, R, 'text-(--sv-muted)')} title="Arus kas operasional tidak tersedia di sumber data">N/A</td>
      <td className={TD}>{VALUATION_VERDICT_LABEL[r.valuation]}</td>
      <td className={TD}>{r.quality}</td>
    </>
  );
}

const HEADERS: Record<MoonstockRow['mode'], Array<[string, boolean?]>> = {
  intraday: [['VWAP', true], ['RVOL', true], ['Volume', true], ['Momentum'], ['Structure'], ['Resistance', true], ['Setup']],
  swing: [['Trend'], ['Structure'], ['RSI', true], ['RVOL', true], ['Setup'], ['Support', true], ['Resistance', true], ['Upside', true]],
  investing: [['PER', true], ['PBV', true], ['ROE', true], ['Rev Growth', true], ['Profit Growth', true], ['Margin', true], ['Debt (D/E)', true], ['Cash Flow', true], ['Valuation'], ['Quality']],
};

export function MoonstockTable({ rows, onSelect }: { rows: MoonstockRow[]; onSelect: (r: MoonstockRow) => void }) {
  const mode = rows[0]?.mode ?? 'intraday';
  const head = (label: string, right?: boolean): ReactNode => <th key={label} className={cn(TH, right && R)}>{label}</th>;
  return (
    <div className="overflow-hidden rounded-xl border border-(--sv-border) bg-(--sv-surface) shadow-(--sv-shadow)">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-(--sv-border) bg-(--sv-bg)">
            <tr>
              {head('Ticker')}
              {head('Price', true)}
              {HEADERS[mode].map(([l, r]) => head(l, r))}
              {head('Label')}
              {head('Status')}
              {mode === 'investing' ? head('Catatan') : head('Trigger')}
            </tr>
          </thead>
          <tbody className="divide-y divide-(--sv-border)">
            {rows.map((r) => (
              <tr
                key={r.ticker}
                tabIndex={0}
                onClick={() => onSelect(r)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(r); } }}
                className="cursor-pointer outline-none hover:bg-(--sv-bg) focus-visible:bg-(--sv-primary-soft)"
              >
                <Ticker row={r} />
                <PriceCell row={r} />
                {r.mode === 'intraday' && <IntradayCells r={r} />}
                {r.mode === 'swing' && <SwingCells r={r} />}
                {r.mode === 'investing' && <InvestingCells r={r} />}
                <td className={TD}><LabelBadge row={r} /></td>
                <td className={TD}><StatusBadge status={r.status} /></td>
                <TriggerCell text={r.trigger} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
