/**
 * signalFromDecision.ts
 *
 * Builds a SARA AI signal from Decision Engine v3 — the same engine (and the same input mapping,
 * decisionInput.ts) as the "EzySaham AI" report on the stock detail page. The signal's BUY / WAIT / AVOID
 * IS the detail page's Trading (1–5 hari) verdict, so the two screens can never disagree on the same data.
 *
 * Pure: the caller fetches summary, bars, fundamentals (and VWAP for today).
 */

import { computeBandarScore } from '@/domain/analysis/bandarScore';
import { DecisionV3Report, SetupKind } from '@/domain/analysis/decisionEngineV3';
import { buildDecisionForStock } from '@/domain/analysis/decisionInput';
import { FundamentalDetail } from '@/domain/models/Fundamentals';
import { OHLCVBar } from '@/domain/models/History';
import { ScoreFactor, ScoreFactorKey, SignalPattern, SignalReason, StockSignal } from '@/domain/models/Signal';
import { StockSummary } from '@/domain/models/Stock';

/** Composite weights (sum = 1). */
const WEIGHTS: Record<ScoreFactorKey, number> = {
  trend: 0.2,
  momentum: 0.15,
  volume: 0.15,
  smartMoney: 0.15,
  pattern: 0.15,
  fundamental: 0.1,
  marketRisk: 0.1,
};

const PATTERN_OF: Record<SetupKind, SignalPattern> = { BREAKOUT: 'Breakout', PULLBACK: 'Pullback', TREND_FOLLOWING: 'Momentum' };

const clamp100 = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const n1 = (n: number) => n.toLocaleString('id-ID', { maximumFractionDigits: 1 });

/** Rule label → score factor, for the WHY checklist. */
function factorOf(label: string): ScoreFactorKey {
  if (/trend/i.test(label)) return 'trend';
  if (/momentum|parabolik|kejar/i.test(label)) return 'momentum';
  if (/likuiditas|volume|breakout tanpa/i.test(label)) return 'volume';
  if (/setup|R:R/i.test(label)) return 'pattern';
  return 'marketRisk';
}

function patternOf(r: DecisionV3Report): SignalPattern {
  if (r.primarySetup) return PATTERN_OF[r.primarySetup.kind];
  if (r.momentum.chaseFlags.length > 0) return 'Momentum';
  if (r.evidence.candle.pattern.startsWith('Breakdown') || (r.trend.direction === 'BEARISH' && r.trend.strength === 'STRONG')) return 'Breakdown';
  return 'Consolidation';
}

export function buildSignalFromDecision(a: {
  summary: StockSummary;
  bars: OHLCVBar[];
  fundamentals: FundamentalDetail | null;
  vwap: number | null;
  date: string;
}): StockSignal {
  const { summary, bars, date } = a;
  const r = buildDecisionForStock({ summary, bars, fundamentals: a.fundamentals, vwap: a.vwap });
  const trading = r.decisions.trading;
  const s = r.simple;
  const rvol = r.liquidity.rvol;

  const bandar = bars.length > 0 ? computeBandarScore(summary, bars) : null;
  const scores: Record<ScoreFactorKey, number | null> = {
    trend: r.scores.trend,
    momentum: r.scores.momentum,
    volume: rvol == null ? null : clamp100(rvol >= 1.5 ? 90 : rvol >= 1 ? 70 : rvol >= 0.7 ? 50 : 25),
    smartMoney: bandar && bandar.max > 0 ? clamp100((bandar.total / bandar.max) * 100) : null,
    pattern: r.scores.entry,
    fundamental: r.evidence.scores.fundamental.value,
    marketRisk: r.scores.risk,
  };
  const scoreBreakdown: ScoreFactor[] = (Object.keys(WEIGHTS) as ScoreFactorKey[]).map((key) => {
    const score = scores[key] ?? 50;
    const note = key === 'trend' ? `Trend ${r.trend.direction.toLowerCase()} (${r.trend.strength.toLowerCase()})`
      : key === 'momentum' ? `Momentum ${r.momentum.strengthLabel.toLowerCase().replace('_', ' ')} · tahap ${r.momentum.stage.toLowerCase()}`
        : key === 'volume' ? (rvol == null ? 'Volume tidak tersedia' : `Volume ${n1(rvol)}x rata-rata 20 hari`)
          : key === 'smartMoney' ? (bandar ? `Bandar score: ${bandar.classification.label}` : 'Data akumulasi tidak tersedia')
            : key === 'pattern' ? `Kualitas entry: ${r.entryQuality.toLowerCase()}`
              : key === 'fundamental' ? r.evidence.fundamentalLabel
                : `Risiko ${s.riskText.toLowerCase()} (makin tinggi skor makin aman)`;
    return { key, score, weight: WEIGHTS[key], note: scores[key] == null ? `${note} — data kurang, dinilai netral` : note };
  });
  const saraScore = Math.round(scoreBreakdown.reduce((sum, f) => sum + f.score * f.weight, 0));

  const plan = s.plan;
  const reasons: SignalReason[] = trading.rules.map((rule) => ({ label: rule.label, factor: factorOf(rule.label), passed: rule.ok }));
  const risks = [...r.risk.flags.map((f) => f.label), ...trading.warnings];

  return {
    id: `${date}-${summary.ticker}`,
    ticker: summary.ticker,
    companyName: summary.name,
    sector: summary.sector || summary.subSector || '—',
    price: summary.lastClose,
    changePct: summary.percentChange1D,
    date,
    action: trading.status,
    pattern: patternOf(r),
    saraScore,
    // Share of the Trading rules that are met — how close the setup is to a full BUY.
    confidence: clamp100((trading.rules.filter((x) => x.ok).length / Math.max(1, trading.rules.length)) * 100),
    tradePlan: plan
      ? {
        entryLow: plan.entryLow,
        entryHigh: plan.entryHigh,
        tp1: plan.targets[0].price,
        tp2: (plan.targets[1] ?? plan.targets[0]).price,
        stopLoss: plan.sl,
        riskReward: Math.round(plan.riskReward * 10) / 10,
        holdingPeriod: '1–5 Hari',
      }
      : null,
    reasons,
    risks: risks.length > 0 ? risks : [`Risiko ${s.riskText.toLowerCase()}`],
    decision: {
      buyAllowed: trading.status === 'BUY',
      trigger: trading.status === 'BUY' && plan
        ? `Entry di area ${plan.entryLow.toLocaleString('id-ID')}–${plan.entryHigh.toLocaleString('id-ID')}, cut loss < ${plan.sl.toLocaleString('id-ID')}`
        : trading.waitFor ?? s.conclusion,
    },
    explanation: `${s.reason} ${s.conclusion}`,
    scoreBreakdown,
  };
}
