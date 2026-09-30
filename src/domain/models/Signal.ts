/**
 * Signal.ts
 *
 * SARA AI (Smart Algorithmic Return Analysis) signal contracts (features_signal.md).
 * These shapes are what the /signal UI consumes — the future API must return
 * the same structure so the mock in `data/mock/signalMock.ts` can be swapped out.
 */

export type SignalAction = 'BUY' | 'BUY_ON_WEAKNESS' | 'WAIT' | 'HOLD' | 'SELL' | 'NO_TRADE';

export const SIGNAL_ACTIONS: readonly SignalAction[] = ['BUY', 'BUY_ON_WEAKNESS', 'WAIT', 'HOLD', 'SELL', 'NO_TRADE'];

export const SIGNAL_ACTION_LABEL: Record<SignalAction, string> = {
  BUY: 'BUY',
  BUY_ON_WEAKNESS: 'BUY ON WEAKNESS',
  WAIT: 'WAIT',
  HOLD: 'HOLD',
  SELL: 'SELL',
  NO_TRADE: 'NO TRADE',
};

export type SignalPattern = 'Breakout' | 'Pullback' | 'Momentum' | 'Reversal' | 'Consolidation' | 'Breakdown';

export const SIGNAL_PATTERNS: readonly SignalPattern[] = ['Breakout', 'Pullback', 'Momentum', 'Reversal', 'Consolidation', 'Breakdown'];

export type ScoreFactorKey = 'trend' | 'momentum' | 'volume' | 'smartMoney' | 'pattern' | 'fundamental' | 'marketRisk';

export const SCORE_FACTOR_LABEL: Record<ScoreFactorKey, string> = {
  trend: 'Trend',
  momentum: 'Momentum',
  volume: 'Volume',
  smartMoney: 'Smart Money',
  pattern: 'Pattern',
  fundamental: 'Fundamental',
  marketRisk: 'Market Risk',
};

/** One component of the SARA Score. `score` is 0–100 (higher = better; for marketRisk higher = safer). */
export interface ScoreFactor {
  key: ScoreFactorKey;
  score: number;
  /** Weight in the composite SARA Score, 0–1. All weights sum to 1. */
  weight: number;
  note: string;
}

export interface TradePlan {
  entryLow: number;
  entryHigh: number;
  tp1: number;
  tp2: number;
  stopLoss: number;
  /** Reward per 1 unit of risk, e.g. 2.8 → "1:2.8". */
  riskReward: number;
  holdingPeriod: string;
}

/** A "WHY" checklist line. */
export interface SignalReason {
  label: string;
  factor: ScoreFactorKey;
  passed: boolean;
}

export interface SignalDecision {
  buyAllowed: boolean;
  /** Condition that confirms the entry, e.g. "Close > 1.270 + Volume > 1,5x". */
  trigger: string;
}

export interface StockSignal {
  id: string;
  ticker: string;
  companyName: string;
  sector: string;
  price: number;
  changePct: number;
  /** Trading date the signal was generated for (YYYY-MM-DD, WIB). */
  date: string;
  action: SignalAction;
  pattern: SignalPattern;
  /** Composite SARA Score, 0–100. */
  saraScore: number;
  /** Model confidence, 0–100 (%). */
  confidence: number;
  /** null when the signal has no actionable plan (e.g. NO TRADE). */
  tradePlan: TradePlan | null;
  reasons: SignalReason[];
  risks: string[];
  decision: SignalDecision;
  /** Plain-language "Why this signal?" explanation. */
  explanation: string;
  scoreBreakdown: ScoreFactor[];
}

export interface SignalPerformanceSummary {
  /** Signals generated in the evaluation window. */
  totalSignals: number;
  /** % of closed BUY-type signals that hit TP1 before SL. */
  winRate: number;
  /** Average return per closed signal, %. */
  avgReturn: number;
  /** Signals still open (not yet TP/SL/expired). */
  activeSignals: number;
  periodLabel: string;
}

export interface SignalDashboardData {
  date: string;
  /** ISO timestamp of when the signal batch was generated. */
  lastUpdated: string | null;
  signals: StockSignal[];
  performance: SignalPerformanceSummary;
}

export interface SignalFilterState {
  date: string;
  action: SignalAction | 'ALL';
  pattern: SignalPattern | 'ALL';
  minScore: number;
  search: string;
}
