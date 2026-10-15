'use client';

import { ArrowDown, ArrowUp } from 'lucide-react';
import { SmCategoryKey, SmartMoneyResult } from '@/domain/analysis/smartMoneyHunter';
import { cn } from '@/lib/format';
import { Badge, TONE_TEXT } from '../../screener/detail/components/ui';
import { DASH, fmtNum, fmtPct, toneOf } from '../../screener/detail/format';
import { categoryOf, fmtRatio, fmtRpShort, fmtShare, STATUS_TONE, statusLabel } from '../smartMoneyUi';

const TH = 'whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-(--sv-muted)';
const TD = 'whitespace-nowrap px-3 py-3 tabular-nums';
const NA = 'text-(--sv-muted)';

export type SortKey =
  | 'ticker' | 'close' | 'change' | 'score' | 'coverage' | SmCategoryKey | 'foreign5' | 'foreign20' | 'foreignDays' | 'rvol' | 'relTx'
  | 'adtv' | 'brokerShare' | 'ma60' | 'high52' | 'profit' | 'der' | 'pbv' | 'dividend' | 'flags';

const flag = (b: boolean | null) => (b == null ? null : b ? 1 : 0);

/** Sort value per column; null always sorts last. */
export function sortValue(r: SmartMoneyResult, key: SortKey): number | string | null {
  const m = r.measures;
  switch (key) {
    case 'ticker': return m.ticker;
    case 'close': return m.close;
    case 'change': return m.change1D;
    case 'score': return r.score;
    case 'coverage': return r.coverage;
    case 'foreign5': return m.foreignNet5;
    case 'foreign20': return m.foreignNet20;
    case 'foreignDays': return m.foreignBuyDays;
    case 'rvol': return m.rvol5;
    case 'relTx': return m.relTxCount;
    case 'adtv': return m.adtv20;
    case 'brokerShare': return m.brokerTopShare;
    case 'ma60': return m.close != null && m.ma60 != null ? m.close / m.ma60 - 1 : null;
    case 'high52': return m.distHigh52;
    case 'profit': return flag(m.profitPositive);
    case 'der': return m.der;
    case 'pbv': return m.pbv;
    case 'dividend': return flag(m.dividendRecent);
    case 'flags': return r.gates.filter((g) => g.result === 'FAIL').length;
    default: {
      const c = categoryOf(r, key);
      return c.knownMax ? c.earned / c.knownMax : null;
    }
  }
}

const COLS: Array<{ key: SortKey; label: string; right?: boolean; title?: string }> = [
  { key: 'ticker', label: 'Saham' },
  { key: 'close', label: 'Harga', right: true },
  { key: 'score', label: 'Skor', right: true, title: 'Skor 0–100 dari indikator yang tersedia · coverage data' },
  { key: 'foreign', label: 'Asing', right: true, title: 'Poin Foreign Flow (maks 25)' },
  { key: 'broker', label: 'Broker', right: true, title: 'Poin Broker Accumulation (maks 20)' },
  { key: 'activity', label: 'Aktivitas', right: true, title: 'Poin Activity & Liquidity (maks 20)' },
  { key: 'momentum', label: 'Momentum', right: true, title: 'Poin Price Momentum (maks 25)' },
  { key: 'fundamental', label: 'Fund.', right: true, title: 'Poin Fundamental (maks 10)' },
  { key: 'foreign5', label: 'Asing 5H', right: true },
  { key: 'foreign20', label: 'Asing 20H', right: true },
  { key: 'foreignDays', label: 'Hari NB', right: true, title: 'Hari net buy asing dari 5' },
  { key: 'rvol', label: 'RVOL', right: true, title: 'Volume 5 sesi ÷ 20 sesi sebelumnya' },
  { key: 'relTx', label: 'Transaksi', right: true, title: 'Jumlah transaksi relatif 5 vs 20 sesi' },
  { key: 'adtv', label: 'Nilai 20H', right: true, title: 'Rata-rata nilai transaksi harian 20 sesi' },
  { key: 'brokerShare', label: 'Broker top', right: true, title: 'Konsentrasi broker net buy terbesar (5 sesi)' },
  { key: 'ma60', label: 'vs MA60', right: true },
  { key: 'high52', label: '52W high', right: true, title: 'Close ÷ high 52 minggu' },
  { key: 'profit', label: 'Laba', title: 'Laba bersih positif (PER > 0)' },
  { key: 'der', label: 'DER', right: true, title: 'Total utang ÷ ekuitas (Yahoo)' },
  { key: 'pbv', label: 'PBV', right: true },
  { key: 'dividend', label: 'Div.', title: 'Ada dividen dalam 2 tahun terakhir' },
  { key: 'flags', label: 'Risk', right: true, title: 'Jumlah Risk Gate FAIL' },
];

function CategoryCell({ r, k }: { r: SmartMoneyResult; k: SmCategoryKey }) {
  const c = categoryOf(r, k);
  if (!c.knownMax) return <span className={NA}>N/A</span>;
  return <span className="text-(--sv-text)">{c.earned}<span className="text-(--sv-muted)">/{c.knownMax}</span></span>;
}

export function SmartMoneyTable({ rows, sort, onSort, onSelect }: {
  rows: SmartMoneyResult[];
  /** Null = default order (status, then score). */
  sort: { key: SortKey; dir: 'asc' | 'desc' } | null;
  onSort: (key: SortKey) => void;
  onSelect: (r: SmartMoneyResult) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-(--sv-border) bg-(--sv-surface) shadow-(--sv-shadow)">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-(--sv-border) bg-(--sv-bg)">
            <tr>
              {COLS.map((c) => (
                <th key={c.key} className={cn(TH, c.right && 'text-right')} title={c.title} aria-sort={sort?.key === c.key ? (sort?.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                  <button type="button" onClick={() => onSort(c.key)} className={cn('inline-flex items-center gap-1 uppercase hover:text-(--sv-text)', sort?.key === c.key && 'text-(--sv-primary)')}>
                    {c.label}
                    {sort?.key === c.key && (sort?.dir === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
                  </button>
                </th>
              ))}
              <th className={TH}>Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-(--sv-border)">
            {rows.map((r) => {
              const m = r.measures;
              const fails = r.gates.filter((g) => g.result === 'FAIL').length;
              const chg = m.change1D != null ? m.change1D * 100 : null;
              const ma60 = m.close != null && m.ma60 != null ? (m.close / m.ma60 - 1) * 100 : null;
              return (
                <tr
                  key={m.ticker}
                  tabIndex={0}
                  onClick={() => onSelect(r)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(r); } }}
                  className="cursor-pointer outline-none hover:bg-(--sv-bg) focus-visible:bg-(--sv-primary-soft)"
                >
                  <td className="px-3 py-3">
                    <div className="font-semibold text-(--sv-text)">{m.ticker}</div>
                    <div className="max-w-40 truncate text-xs text-(--sv-muted)">{m.name}</div>
                  </td>
                  <td className={cn(TD, 'text-right')}>
                    <div className="font-semibold text-(--sv-text)">{fmtNum(m.close)}</div>
                    <div className={cn('text-xs', TONE_TEXT[toneOf(chg)])}>{fmtPct(chg)}</div>
                  </td>
                  <td className={cn(TD, 'text-right')}>
                    <div className="font-bold text-(--sv-text)">{r.score}</div>
                    <div className="text-xs text-(--sv-muted)">cov {r.coverage}%</div>
                  </td>
                  {(['foreign', 'broker', 'activity', 'momentum', 'fundamental'] as const).map((k) => (
                    <td key={k} className={cn(TD, 'text-right')}><CategoryCell r={r} k={k} /></td>
                  ))}
                  <td className={cn(TD, 'text-right', m.foreignNet5 == null ? NA : TONE_TEXT[toneOf(m.foreignNet5)])}>{m.foreignNet5 == null ? 'N/A' : fmtRpShort(m.foreignNet5)}</td>
                  <td className={cn(TD, 'text-right', m.foreignNet20 == null ? NA : TONE_TEXT[toneOf(m.foreignNet20)])}>{m.foreignNet20 == null ? 'N/A' : fmtRpShort(m.foreignNet20)}</td>
                  <td className={cn(TD, 'text-right', m.foreignBuyDays == null ? NA : 'text-(--sv-text)')}>{m.foreignBuyDays == null ? 'N/A' : `${m.foreignBuyDays}/5`}</td>
                  <td className={cn(TD, 'text-right text-(--sv-text)')}>{fmtRatio(m.rvol5)}</td>
                  <td className={cn(TD, 'text-right', m.relTxCount == null ? NA : 'text-(--sv-text)')}>{m.relTxCount == null ? 'N/A' : fmtRatio(m.relTxCount)}</td>
                  <td className={cn(TD, 'text-right text-(--sv-text)')}>{fmtRpShort(m.adtv20)}</td>
                  <td className={cn(TD, 'text-right', m.brokerTopShare == null ? NA : 'text-(--sv-text)')}>
                    {m.brokerTopShare == null ? 'N/A' : m.brokerTopNet != null && m.brokerTopNet > 0 ? `${m.brokerTopCode} ${fmtShare(m.brokerTopShare)}` : DASH}
                  </td>
                  <td className={cn(TD, 'text-right', TONE_TEXT[toneOf(ma60)])}>{fmtPct(ma60, 1)}</td>
                  <td className={cn(TD, 'text-right text-(--sv-text)')}>{m.distHigh52 == null ? <span className={NA}>N/A</span> : fmtShare(m.distHigh52, 0)}</td>
                  <td className={cn(TD, m.profitPositive == null ? NA : m.profitPositive ? TONE_TEXT.positive : TONE_TEXT.negative)}>{m.profitPositive == null ? 'N/A' : m.profitPositive ? 'Laba' : 'Rugi'}</td>
                  <td className={cn(TD, 'text-right', m.der == null ? NA : m.der > 2 ? TONE_TEXT.negative : 'text-(--sv-text)')}>{m.der == null ? 'N/A' : fmtRatio(m.der)}</td>
                  <td className={cn(TD, 'text-right', m.pbv == null ? NA : m.pbv < 0 ? TONE_TEXT.negative : 'text-(--sv-text)')}>{m.pbv == null ? 'N/A' : fmtRatio(m.pbv)}</td>
                  <td className={cn(TD, m.dividendRecent == null ? NA : 'text-(--sv-text)')}>{m.dividendRecent == null ? 'N/A' : m.dividendRecent ? 'Ada' : 'Tidak'}</td>
                  <td className={cn(TD, 'text-right', fails ? TONE_TEXT.negative : 'text-(--sv-muted)')}>{fails ? `${fails} FAIL` : '—'}</td>
                  <td className="px-3 py-3"><Badge tone={STATUS_TONE[r.status]}>{statusLabel(r.status)}</Badge></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
