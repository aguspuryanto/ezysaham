/**
 * tradingConfig.ts
 *
 * Single source of truth for the Decision Engine's configurable parameters
 * (EzySaham 2.0 PRD §56, "User Settings"). No account/DB layer exists yet, so
 * these are hardcoded defaults; `useTradingSettings` (presentation layer)
 * lets a user override them client-side via localStorage.
 */

export interface TradingConfig {
  /** Total trading capital in IDR, used for position sizing. */
  capital: number;
  /** % of capital risked per trade (PRD §23 default: 0.5%). */
  riskPerTradePct: number;
  /** Hard ceiling on risk per trade — above this, the Decision Engine forces NO_TRADE. */
  maxRiskPerTradePct: number;
  /** Minimum acceptable reward:risk ratio (PRD §25 default: 1:2). Below this → NO_TRADE. */
  minRiskRewardRatio: number;
  /** Max number of TRADE-eligible entries allowed per day (PRD §44). */
  maxTradesPerDay: number;
  /** Daily % move that starts FOMO scrutiny (PRD §26). */
  fomoMoveThresholdPct: number;
  /** Daily % move considered an extreme/high-FOMO move. */
  fomoExtremeMoveThresholdPct: number;
}

export const DEFAULT_TRADING_CONFIG: TradingConfig = {
  capital: 50_000_000,
  riskPerTradePct: 0.5,
  maxRiskPerTradePct: 1.0,
  minRiskRewardRatio: 2,
  maxTradesPerDay: 3,
  fomoMoveThresholdPct: 8,
  fomoExtremeMoveThresholdPct: 15,
};
