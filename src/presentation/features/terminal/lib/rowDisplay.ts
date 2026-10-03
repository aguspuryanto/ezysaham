import { StockSummary } from '@/domain/models/Stock';
import { DAY_TRADING_STATUS_LABEL } from '@/domain/screener/dayTrading';
import { PresetEvaluation, computeQuickScore } from '@/domain/screener/presets';
import { SWING_SETUP_LABEL, SWING_STATUS_LABEL } from '@/domain/screener/swingTrading';

export type SignalTone = 'emerald' | 'blue' | 'amber' | 'gray' | 'crimson';

export interface RowDisplay {
  scoreComposite: number;
  scoreStatus: string;
  signalLabel: string;
  signalSub: string;
  signalTone: SignalTone;
}

const STATUS_TONE: Record<string, SignalTone> = {
  EXCELLENT: 'emerald',
  GOOD: 'emerald',
  FAIR: 'amber',
  WEAK: 'gray',
  BUY_WATCH: 'emerald',
  WATCH: 'amber',
  SKIP: 'gray',
  STRONG_BUY: 'emerald',
  BUY: 'blue',
  WATCHLIST: 'amber',
  SPECULATIVE: 'amber',
  AVOID: 'crimson',
  HIGH: 'emerald',
  MEDIUM: 'amber',
  LOW: 'gray',
  'Strong Accumulation': 'emerald',
  Accumulation: 'emerald',
  Neutral: 'gray',
  'Distribution Risk': 'amber',
  'Strong Distribution': 'crimson',
};

const STATUS_LABEL: Record<string, string> = {
  EXCELLENT: 'Excellent',
  GOOD: 'Good',
  FAIR: 'Fair',
  WEAK: 'Weak',
  BUY_WATCH: 'Buy Watch',
  WATCH: 'Watch',
  SKIP: 'Skip',
  STRONG_BUY: 'Strong Buy',
  BUY: 'Buy',
  WATCHLIST: 'Watchlist',
  SPECULATIVE: 'Speculative',
  AVOID: 'Avoid',
  HIGH: 'ARA Probability: High',
  MEDIUM: 'ARA Probability: Medium',
  LOW: 'ARA Probability: Low',
};

function toneAndLabel(status: string): { tone: SignalTone; label: string } {
  return { tone: STATUS_TONE[status] ?? 'gray', label: STATUS_LABEL[status] ?? status };
}

/**
 * "Skor AI" + "Sinyal & Algoritma AI" for one row — reuses whichever composite
 * score/status the active preset's evaluate() already produced (Breakout,
 * TradingPlan, ARA, Fundamental, CorePortofolio, HighGrowth, Bandar, Day/Swing
 * Trading); falls
 * back to the universal QuickScore (from StockSummary alone) for presets that
 * don't compute a composite (Semua). Every label here
 * is real domain vocabulary already used elsewhere in the app — nothing here
 * invents new signal names.
 */
export function getRowDisplay(summary: StockSummary, evaluation: PresetEvaluation): RowDisplay {
  const fallbackSub = evaluation.reasons[0] ?? evaluation.failed[0] ?? 'Tidak ada sinyal spesifik';

  if (evaluation.breakoutScores) {
    const { tone, label } = toneAndLabel(evaluation.breakoutScores.status);
    return { scoreComposite: evaluation.breakoutScores.composite, scoreStatus: evaluation.breakoutScores.status, signalLabel: label, signalSub: fallbackSub, signalTone: tone };
  }
  if (evaluation.tradingPlan) {
    const { tone, label } = toneAndLabel(evaluation.tradingPlan.status);
    return { scoreComposite: evaluation.tradingPlan.score, scoreStatus: evaluation.tradingPlan.status, signalLabel: label, signalSub: fallbackSub, signalTone: tone };
  }
  if (evaluation.araProbability) {
    const { tone, label } = toneAndLabel(evaluation.araProbability.probability);
    return { scoreComposite: evaluation.araProbability.composite, scoreStatus: evaluation.araProbability.probability, signalLabel: label, signalSub: fallbackSub, signalTone: tone };
  }
  if (evaluation.fundamentalScore) {
    const { tone, label } = toneAndLabel(evaluation.fundamentalScore.status);
    return { scoreComposite: evaluation.fundamentalScore.composite, scoreStatus: evaluation.fundamentalScore.status, signalLabel: label, signalSub: fallbackSub, signalTone: tone };
  }
  if (evaluation.corePortofolioScore) {
    const { tone, label } = toneAndLabel(evaluation.corePortofolioScore.status);
    return { scoreComposite: evaluation.corePortofolioScore.composite, scoreStatus: evaluation.corePortofolioScore.status, signalLabel: label, signalSub: fallbackSub, signalTone: tone };
  }
  if (evaluation.highGrowthScore) {
    const { tone, label } = toneAndLabel(evaluation.highGrowthScore.status);
    return { scoreComposite: evaluation.highGrowthScore.composite, scoreStatus: evaluation.highGrowthScore.status, signalLabel: label, signalSub: fallbackSub, signalTone: tone };
  }
  if (evaluation.dayTrading) {
    const dt = evaluation.dayTrading;
    const tone: SignalTone = dt.status === 'SETUP' ? 'emerald' : dt.status === 'WATCH' ? 'amber' : 'crimson';
    return { scoreComposite: dt.scores.total, scoreStatus: dt.status, signalLabel: DAY_TRADING_STATUS_LABEL[dt.status], signalSub: fallbackSub, signalTone: tone };
  }
  if (evaluation.swingTrading) {
    const sw = evaluation.swingTrading;
    const tone: SignalTone = sw.status === 'BUY' ? 'emerald' : sw.status === 'WAIT' ? 'amber' : 'crimson';
    return { scoreComposite: sw.scores.total, scoreStatus: sw.status, signalLabel: SWING_STATUS_LABEL[sw.status], signalSub: SWING_SETUP_LABEL[sw.setupType], signalTone: tone };
  }
  if (evaluation.bandarScore) {
    const { tone, label } = toneAndLabel(evaluation.bandarScore.classification.label);
    return { scoreComposite: evaluation.bandarScore.total, scoreStatus: evaluation.bandarScore.classification.label, signalLabel: label, signalSub: evaluation.bandarScore.phaseLabel, signalTone: tone };
  }

  const quick = computeQuickScore(summary);
  const { tone, label } = toneAndLabel(quick.status);
  return { scoreComposite: quick.composite, scoreStatus: quick.status, signalLabel: label, signalSub: fallbackSub, signalTone: tone };
}
