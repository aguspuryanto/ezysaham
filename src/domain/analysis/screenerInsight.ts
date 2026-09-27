/**
 * screenerInsight.ts
 *
 * Short "AI Insight" copy for a Screener row, assembled only from the ScreenerVerdict fields that
 * were already computed (no new scoring). Kept as three separate reads — TECHNICAL, VALUATION, RISK —
 * so a cheap valuation is never presented as a reason to buy by itself. Never outputs BUY/SELL.
 */

import type { ScreenerVerdict } from '@/domain/analysis/screenerVerdict';

export interface ScreenerInsight {
  technical: string;
  valuation: string;
  risk: string;
  /** One-line combined summary for compact places (mobile card, tooltip header). */
  summary: string;
}

const TREND_TXT = { bullish: 'Uptrend', sideways: 'Sideways', bearish: 'Downtrend' } as const;
const MOMENTUM_TXT = { STRONG: 'momentum kuat', MODERATE: 'momentum sedang', WEAK: 'momentum lemah' } as const;
const VOLUME_TXT = { HIGH: 'volume di atas rata-rata', MEDIUM: 'volume normal', LOW: 'volume sepi' } as const;

export function buildScreenerInsight(v: ScreenerVerdict): ScreenerInsight {
  const technical = v.trend == null
    ? 'Data teknikal belum cukup (riwayat harga < 20 hari).'
    : [
      TREND_TXT[v.trend],
      v.momentum ? MOMENTUM_TXT[v.momentum] : null,
      v.volume ? VOLUME_TXT[v.volume] : null,
    ].filter(Boolean).join(' + ') + (v.marketPhase ? ` · fase ${v.marketPhase.label}.` : '.');

  const { verdict, upsidePct, fairMedian } = v.valuation;
  const valuation = verdict === 'TIDAK_DAPAT_DINILAI' || fairMedian == null || upsidePct == null
    ? 'Nilai wajar tidak dapat dihitung dari data yang tersedia.'
    : upsidePct >= 0
      ? `Harga ${upsidePct.toFixed(0)}% di bawah median fair value.`
      : `Harga ${Math.abs(upsidePct).toFixed(0)}% di atas median fair value.`;

  const risk = v.risk == null
    ? 'Risiko belum dapat dinilai.'
    : v.riskReasons.length === 0
      ? `Risiko ${v.risk === 'LOW' ? 'rendah' : v.risk === 'MEDIUM' ? 'sedang' : 'tinggi'} — tidak ada sinyal bahaya menonjol.`
      : `Risiko ${v.risk === 'LOW' ? 'rendah' : v.risk === 'MEDIUM' ? 'sedang' : 'tinggi'}: ${v.riskReasons.slice(0, 2).join(', ')}.`;

  return { technical, valuation, risk, summary: `${technical} ${valuation}` };
}
