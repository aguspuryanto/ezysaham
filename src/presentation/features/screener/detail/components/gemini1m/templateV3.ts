/**
 * Output template from docs/features_decision_enginev3_gemini.md (§TEMPLATE OUTPUT), filled from Decision Engine v3.
 *   • "Tunggu" only for WAIT.
 *   • Entry / Target / Stop Loss / Risk-Reward only for BUY (WAIT and AVOID never show levels).
 *   • Risiko + Kesimpulan always. No technical numbers (EMA, RVOL, MACD) anywhere.
 */

import { Decision, DecisionV3Report } from '@/domain/analysis/decisionEngineV3';
import { fmtRp } from '../../format';

export const TEMPLATE_EMOJI: Record<Decision, string> = { BUY: '🟢', WAIT: '🟡', AVOID: '🔴' };

export interface TemplateV3 {
  ticker: string;
  status: Decision;
  reason: string;
  /** WAIT only. */
  waitFor: string | null;
  /** BUY only. */
  plan: { entry: string; tp1: string; tp2: string | null; sl: string; rr: string } | null;
  risk: 'Rendah' | 'Sedang' | 'Tinggi';
  conclusion: string;
}

const LINE = '=================================';
const fmt1 = (n: number) => n.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function buildTemplateV3(ticker: string, r: DecisionV3Report): TemplateV3 {
  const s = r.simple;
  const p = s.status === 'BUY' ? s.plan : null;
  const chasing = s.status === 'AVOID' && s.tag === 'AVOID CHASING';
  return {
    ticker,
    status: s.status,
    reason: chasing
      ? 'Harganya sudah naik terlalu cepat dan terlalu jauh dari rata-rata. Risiko membeli di puncak saat ini jauh lebih besar daripada peluang keuntungannya.'
      : s.reason,
    waitFor: s.status === 'WAIT' ? s.waitFor : null,
    plan: p
      ? {
        entry: p.entryLow === p.entryHigh ? fmtRp(p.entryLow) : `${fmtRp(p.entryLow)} – ${fmtRp(p.entryHigh).replace('Rp ', '')}`,
        tp1: fmtRp(p.targets[0].price),
        tp2: p.targets[1] ? fmtRp(p.targets[1].price) : null,
        sl: fmtRp(p.sl),
        rr: `1 : ${fmt1(p.riskReward)}`,
      }
      : null,
    risk: s.riskText,
    conclusion: chasing ? 'Jangan kejar harga. Tunggu hingga harga mendingin.' : s.conclusion,
  };
}

/** Plain text exactly in the template layout — used by the copy button. */
export function templateV3Text(t: TemplateV3): string {
  const lines = [LINE, '⚡ EzySaham AI', LINE, '', t.ticker, '', `${TEMPLATE_EMOJI[t.status]} ${t.status}`, '', 'Alasan:', `"${t.reason}"`];
  if (t.waitFor) lines.push('', 'Tunggu:', `"${t.waitFor}"`);
  if (t.plan) {
    lines.push(
      '', '📍 Entry:', t.plan.entry,
      '', '🎯 Target:', `TP1 ${t.plan.tp1}`, ...(t.plan.tp2 ? [`TP2 ${t.plan.tp2}`] : []),
      '', '🛑 Stop Loss:', t.plan.sl,
      '', '📊 Risk/Reward:', t.plan.rr,
    );
  }
  lines.push('', '⚠️ Risiko:', t.risk, '', '💡 Kesimpulan:', `"${t.conclusion}"`, LINE);
  return lines.join('\n');
}
