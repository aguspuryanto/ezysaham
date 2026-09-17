/**
 * tradingPermission.ts
 *
 * EzySaham 2.0 PRD §10 "Trading Permission" — maps a market regime to which
 * trading strategies are allowed, cautioned, or blocked:
 *
 *            Swing   Breakout  Scalping  Invest
 *   BULL       ✅        ✅        ✅       ✅
 *   NEUTRAL    ⚠️        ⚠️        ⚠️       ✅
 *   RISK_OFF   ❌        ❌        ⚠️       ⚠️
 *
 * This is an additive layer on top of `marketRegimeEngine.ts` — it does not
 * rename or replace the existing `MarketRegime` union (`'bullish' | 'neutral'
 * | 'bearish'`), which `IhsgChart.tsx` already renders, to avoid touching
 * shipped labels. `toDecisionRegime` maps into the PRD's own vocabulary.
 */

import { MarketRegime } from './marketRegimeEngine';

export type DecisionRegime = 'BULL' | 'NEUTRAL' | 'RISK_OFF';

export type TradingStrategy = 'swing' | 'breakout' | 'scalping' | 'invest';

export type PermissionLevel = 'allowed' | 'caution' | 'blocked';

export interface TradingPermissionResult {
  level: PermissionLevel;
  /** true for 'allowed' and 'caution' — only 'blocked' fails the Decision Engine's hard gate. */
  allowed: boolean;
  reason: string;
}

const STRATEGY_LABEL: Record<TradingStrategy, string> = {
  swing: 'Swing',
  breakout: 'Breakout',
  scalping: 'Scalping',
  invest: 'Invest',
};

const REGIME_LABEL: Record<DecisionRegime, string> = {
  BULL: 'Bull',
  NEUTRAL: 'Neutral',
  RISK_OFF: 'Risk Off',
};

/** Maps the technical regime classification onto the PRD's permission vocabulary. */
export function toDecisionRegime(regime: MarketRegime): DecisionRegime {
  if (regime === 'bullish') return 'BULL';
  if (regime === 'bearish') return 'RISK_OFF';
  return 'NEUTRAL';
}

const PERMISSION_MATRIX: Record<DecisionRegime, Record<TradingStrategy, PermissionLevel>> = {
  BULL: { swing: 'allowed', breakout: 'allowed', scalping: 'allowed', invest: 'allowed' },
  NEUTRAL: { swing: 'caution', breakout: 'caution', scalping: 'caution', invest: 'allowed' },
  RISK_OFF: { swing: 'blocked', breakout: 'blocked', scalping: 'caution', invest: 'caution' },
};

function reasonFor(level: PermissionLevel, regime: DecisionRegime, strategy: TradingStrategy): string {
  const regimeLabel = REGIME_LABEL[regime];
  const strategyLabel = STRATEGY_LABEL[strategy];
  if (level === 'blocked') return `Market Regime ${regimeLabel} tidak mengizinkan strategi ${strategyLabel}.`;
  if (level === 'caution') return `Market Regime ${regimeLabel} — strategi ${strategyLabel} diizinkan dengan kehati-hatian ekstra.`;
  return `Market Regime ${regimeLabel} mengizinkan strategi ${strategyLabel}.`;
}

export function evaluateTradingPermission(
  regime: DecisionRegime,
  strategy: TradingStrategy
): TradingPermissionResult {
  const level = PERMISSION_MATRIX[regime][strategy];
  return {
    level,
    allowed: level !== 'blocked',
    reason: reasonFor(level, regime, strategy),
  };
}

/** Full permission row for a regime, one entry per strategy — used by dashboard-style summaries. */
export function getPermissionMatrix(regime: DecisionRegime): Record<TradingStrategy, TradingPermissionResult> {
  const strategies: TradingStrategy[] = ['swing', 'breakout', 'scalping', 'invest'];
  return Object.fromEntries(
    strategies.map((strategy) => [strategy, evaluateTradingPermission(regime, strategy)])
  ) as Record<TradingStrategy, TradingPermissionResult>;
}
