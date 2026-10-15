'use client';

import Link from 'next/link';
import { RadarPath, RadarRow } from '@/domain/analysis/topgainRadar';
import { cn } from '@/lib/format';
import { Badge, TONE_TEXT } from '../../screener/detail/components/ui';
import { fmtCompact, fmtNum, fmtPct, Tone, toneOf } from '../../screener/detail/format';

const TH = 'whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-(--sv-muted)';
const TD = 'whitespace-nowrap px-3 py-3 tabular-nums';

export const PATH_LABEL: Record<RadarPath, { label: string; tone: Tone }> = {
  LANJUTAN: { label: 'Lanjutan', tone: 'info' },
  TURUN_DULU: { label: 'Turun dulu', tone: 'warning' },
  REBOUND: { label: 'Rebound', tone: 'positive' },
  LAINNYA: { label: 'Lainnya', tone: 'neutral' },
};

const MAX_REASONS = 3;

export function RadarTable({ rows }: { rows: RadarRow[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-(--sv-border) bg-(--sv-surface) shadow-(--sv-shadow)">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-(--sv-border) bg-(--sv-bg)">
            <tr>
              <th className={cn(TH, 'text-right')}>#</th>
              <th className={TH}>Saham</th>
              <th className={cn(TH, 'text-right')}>Harga</th>
              <th className={cn(TH, 'text-right')}>Skor</th>
              <th className={TH}>Jalur</th>
              <th className={cn(TH, 'text-right')}>RSI</th>
              <th className={cn(TH, 'text-right')}>vs EMA20</th>
              <th className={cn(TH, 'text-right')}>20 hari</th>
              <th className={cn(TH, 'text-right')}>RVOL</th>
              <th className={cn(TH, 'text-right')}>Nilai rata² 20H</th>
              <th className={TH}>Kondisi utama</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-(--sv-border)">
            {rows.map((r, k) => {
              const f = r.features;
              const path = PATH_LABEL[r.path];
              const chg = f.changePct * 100;
              return (
                <tr key={r.summary.ticker} className="hover:bg-(--sv-bg)">
                  <td className={cn(TD, 'text-right text-(--sv-muted)')}>{k + 1}</td>
                  <td className="px-3 py-3">
                    <Link href={`/screener/${r.summary.ticker}`} className="font-semibold text-(--sv-text) hover:text-(--sv-primary) hover:underline">
                      {r.summary.ticker}
                    </Link>
                    <div className="max-w-44 truncate text-xs text-(--sv-muted)">{r.summary.sector}</div>
                  </td>
                  <td className={cn(TD, 'text-right')}>
                    <div className="font-semibold text-(--sv-text)">{fmtNum(f.close)}</div>
                    <div className={cn('text-xs', TONE_TEXT[toneOf(chg)])}>{fmtPct(chg, 1)}</div>
                  </td>
                  <td className={cn(TD, 'text-right font-bold text-(--sv-text)')}>{fmtNum(r.score, 1)}</td>
                  <td className="px-3 py-3"><Badge tone={path.tone}>{path.label}</Badge></td>
                  <td className={cn(TD, 'text-right', f.rsi > 70 ? TONE_TEXT.warning : f.rsi < 30 ? TONE_TEXT.info : 'text-(--sv-text)')}>{fmtNum(f.rsi, 0)}</td>
                  <td className={cn(TD, 'text-right', TONE_TEXT[toneOf(f.distEma20)])}>{fmtPct(f.distEma20 * 100, 0)}</td>
                  <td className={cn(TD, 'text-right', TONE_TEXT[toneOf(f.ret20)])}>{fmtPct(f.ret20 * 100, 0)}</td>
                  <td className={cn(TD, 'text-right text-(--sv-text)')}>{fmtNum(f.rvol, 1)}</td>
                  <td className={cn(TD, 'text-right', r.liquid ? 'text-(--sv-text)' : TONE_TEXT.warning)}>Rp {fmtCompact(f.avgValue20)}</td>
                  <td className="px-3 py-3 text-xs text-(--sv-muted)">
                    <span className="block max-w-72 truncate" title={r.reasons.join(' · ')}>
                      {r.reasons.slice(0, MAX_REASONS).join(' · ')}
                      {r.reasons.length > MAX_REASONS && ` +${r.reasons.length - MAX_REASONS}`}
                    </span>
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
