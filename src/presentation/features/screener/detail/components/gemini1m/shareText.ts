/**
 * Copy/share text — the simple user output format from features_decision_enginev3.md §OUTPUT USER,
 * mirroring QuickDecision, followed by the "📊 CORE TECHNICAL" block when the technical analysis is passed in. Valuation / fundamentals / scores are deliberately left out.
 */

import { DecisionV3Report } from '@/domain/analysis/decisionEngineV3';
import { TechnicalAnalysisV3 } from '@/domain/analysis/technicalAnalysisV3';
import { fmtRp } from '../../format';
import { DECISION_EMOJI, TAG_TEXT } from './primitives';

const LINE = '=================================';
const zone = (lo: number, hi: number) => (lo === hi ? fmtRp(lo) : `${fmtRp(lo)} – ${fmtRp(hi).replace('Rp ', '')}`);

const FINAL_EMOJI = { BUY: '🟢', WAIT: '🟡', AVOID: '🔴', 'AVOID CHASING': '🔴' } as const;

/** "📊 CORE TECHNICAL" block — 7 steps + the decision, each value with only the reading behind it. */
export function coreTechnicalLines(ta: TechnicalAnalysisV3): string[] {
  const t = ta.trend;
  return [
    '📊 CORE TECHNICAL',
    '',
    '1️⃣ Fase', ta.phase.value,
    '',
    '2️⃣ Trend', `Pendek ${t.short}`, `· Menengah ${t.medium}`, `· Panjang ${t.long}`, `→ ${t.explain}`,
    '',
    '3️⃣ Tenaga', ta.power.value, `→ ${ta.power.detail}`,
    '',
    '4️⃣ Momentum', ta.momentum.value, `→ ${ta.momentum.detail}`,
    '',
    '5️⃣ Posisi Harga', ta.position.value,
    '',
    '6️⃣ Entry', ta.entry.value, `→ ${ta.entry.detail}`,
    '',
    '7️⃣ Risiko', ta.risk.value, `→ ${ta.risk.detail}`,
    '',
    '🎯 KEPUTUSAN', `${FINAL_EMOJI[ta.decision.value]} ${ta.decision.value}`,
    ...(ta.decision.conflicts.length ? ['', '⚖️ Konflik data:', ...ta.decision.conflicts.map((c) => `• ${c}`)] : []),
  ];
}

export function buildShareText(ticker: string, r: DecisionV3Report, ta?: TechnicalAnalysisV3): string {
  const s = r.simple;
  const plan = s.plan;
  const verdict = (st: keyof typeof DECISION_EMOJI) => `${DECISION_EMOJI[st]} ${st}`;
  const lines = [
    LINE,
    '⚡ EzySaham AI',
    LINE,
    '',
    ticker,
    '',
    `${verdict(s.status)}${s.tag ? ` · ${TAG_TEXT[s.tag]}` : ''}`,
    '',
    `Harga: ${fmtRp(s.price)}`,
    `Trend: ${s.trendLabel}`,
    `Kondisi: ${s.condition}`,
    '',
    'Alasan:',
    s.reason,
  ];
  if (plan) {
    lines.push(
      '',
      ...(plan.conditional ? ['(Rencana bila terkonfirmasi — belum sinyal beli)', ''] : []),
      '📍 Entry:', zone(plan.entryLow, plan.entryHigh),
      '',
      '🎯 Target:', ...plan.targets.map((t) => `${t.label} ${fmtRp(t.price)}`),
      '',
      '🛑 Stop Loss:', fmtRp(plan.sl),
      '',
      '📊 Risk/Reward:', plan.rrText,
    );
  }
  if (s.betterEntry) lines.push('', '🎯 Entry lebih menarik:', `± ${fmtRp(s.betterEntry.price)}`, `Syarat: ${s.betterEntry.condition}`);
  else if (s.waitFor) lines.push('', s.status === 'AVOID' ? 'Baru menarik lagi bila:' : 'Tunggu:', s.waitFor);
  lines.push(
    '',
    '⚠️ Risiko:', s.riskText,
    '',
    '💡 Kesimpulan:', s.takeaway, s.conclusion,
    '',
    `Swing (5–15 hari): ${verdict(r.decisions.swing.status)}`,
    `Investing: ${verdict(r.decisions.investing.status)}`,
    '',
  );
  if (ta) lines.push(...coreTechnicalLines(ta), '');
  lines.push(
    LINE,
    '⚠️ EOD + intraday tertunda',
    'Edukasi, bukan ajakan jual/beli.',
  );
  return lines.join('\n');
}
