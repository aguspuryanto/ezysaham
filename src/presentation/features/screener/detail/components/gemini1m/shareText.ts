/**
 * Copy/share text — the simple user output format from features_decision_enginev3.md §OUTPUT USER.
 * Technical detail (EMA, RVOL, VWAP, PER/PBV, scores) is deliberately left out.
 */

import { DecisionV3Report } from '@/domain/analysis/decisionEngineV3';
import { fmtRp } from '../../format';
import { DECISION_EMOJI } from './primitives';

const LINE = '=================================';
const zone = (lo: number, hi: number) => (lo === hi ? fmtRp(lo) : `${fmtRp(lo)} – ${fmtRp(hi).replace('Rp ', '')}`);

export function buildShareText(ticker: string, r: DecisionV3Report): string {
  const s = r.simple;
  const plan = s.plan;
  const lines = [
    LINE,
    '⚡ EzySaham AI',
    LINE,
    '',
    ticker,
    '',
    `${DECISION_EMOJI[s.status]} ${s.status}${s.tag ? ` · ${s.tag}` : ''}`,
    '',
    'Alasan:',
    `"${s.reason}"`,
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
  if (s.waitFor) lines.push('', s.status === 'AVOID' ? 'Baru menarik lagi bila:' : 'Tunggu:', `"${s.waitFor}"`);
  lines.push(
    '',
    '⚠️ Risiko:', s.riskText,
    '',
    '💡 Kesimpulan:', `"${s.conclusion}"`,
    '',
    `Swing (5–15 hari): ${DECISION_EMOJI[r.decisions.swing.status]} ${r.decisions.swing.status} · Investing: ${DECISION_EMOJI[r.decisions.investing.status]} ${r.decisions.investing.status}`,
    LINE,
    '⚠️ Analisa otomatis berbasis data EOD + intraday tertunda. Edukasi, bukan ajakan jual/beli.',
  );
  return lines.join('\n');
}
