/**
 * tradeValidation.ts
 *
 * Direction-aware math for the Equity Research Report's trading plan.
 *
 * Root cause of the "UDNG inconsistency" report (features_inkonsistensi.md):
 * the engine already computed a bearish (SHORT) scenario in
 * stockAnalysisEngine.ts's buildTradingPlan(), but every consumer (report
 * cards, the LLM narrative prompt) formatted BOTH the bullish and bearish
 * scenario with LONG-only wording — "Gain" instead of "Potential Short
 * Profit", "Cut loss jika Close < SL" instead of "> SL" for a short, and no
 * validation that Entry/SL/TP ordering actually matches the direction or
 * that the entry is anywhere near the current price.
 *
 * This module makes `direction` an explicit input to every Entry/SL/TP
 * calculation instead of leaving it implicit, so LONG and SHORT scenarios
 * can never be silently mixed up again.
 */

export type Direction = 'LONG' | 'SHORT';

export type ValidationErrorCode =
  | 'ERROR_INVALID_PRICE'
  | 'ERROR_INVALID_LONG_SL'
  | 'ERROR_INVALID_SHORT_SL'
  | 'ERROR_INVALID_TP_STRUCTURE';

export const ENTRY_DISTANCE_WARNING_PCT = 15;
export const EXTREME_RR_THRESHOLD = 10;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** LONG: SL below entry, TP1/TP2 above entry, TP2 >= TP1. SHORT: mirrored. */
export function validateTradeScenario(
  direction: Direction,
  entry: number,
  sl: number,
  tp1: number,
  tp2: number
): ValidationErrorCode[] {
  const errors: ValidationErrorCode[] = [];
  if (!(entry > 0) || !(sl > 0) || !(tp1 > 0) || !(tp2 > 0)) {
    errors.push('ERROR_INVALID_PRICE');
    return errors;
  }
  if (direction === 'LONG') {
    if (sl >= entry) errors.push('ERROR_INVALID_LONG_SL');
    if (tp1 <= entry || tp2 < tp1) errors.push('ERROR_INVALID_TP_STRUCTURE');
  } else {
    if (sl <= entry) errors.push('ERROR_INVALID_SHORT_SL');
    if (tp1 >= entry || tp2 > tp1) errors.push('ERROR_INVALID_TP_STRUCTURE');
  }
  return errors;
}

export interface RiskRewardResult {
  /** % of entry price risked to Stop Loss. */
  riskPct: number;
  /** % of entry price gained at target — "Gain" for LONG, "Potential Short Profit" for SHORT. */
  rewardPct: number;
  riskRewardRatio: number;
  extremeRRWarning: boolean;
}

/**
 * LONG risk/reward: risk = entry - sl, reward = target - entry.
 * SHORT risk/reward: risk = sl - entry, reward = entry - target.
 * The Rp1 floor on the risk denominator matches the pre-existing engine
 * behaviour (avoids divide-by-zero on a near-zero stop distance) — kept as-is
 * so this refactor doesn't silently change previously-displayed RR numbers.
 */
export function computeRiskReward(direction: Direction, entry: number, sl: number, target: number): RiskRewardResult {
  const riskAbs = direction === 'LONG' ? entry - sl : sl - entry;
  const rewardAbs = direction === 'LONG' ? target - entry : entry - target;
  const riskPct = round2((riskAbs / entry) * 100);
  const rewardPct = round2((rewardAbs / entry) * 100);
  const riskRewardRatio = round2(rewardAbs / Math.max(riskAbs, 1));
  return { riskPct, rewardPct, riskRewardRatio, extremeRRWarning: riskRewardRatio > EXTREME_RR_THRESHOLD };
}

/** How far the entry sits from where the stock trades right now. */
export function computeEntryDistancePct(entry: number, currentPrice: number): number {
  return round2((Math.abs(entry - currentPrice) / currentPrice) * 100);
}

/** "Cut loss jika Close < RpX" for LONG, "Exit/Cut loss jika Close > RpX" for SHORT — never the other way round. */
export function invalidationRuleText(direction: Direction, sl: number): string {
  return direction === 'LONG'
    ? `Cut loss jika Close < Rp${sl.toLocaleString('id-ID')}`
    : `Exit/Cut loss jika Close > Rp${sl.toLocaleString('id-ID')}`;
}
