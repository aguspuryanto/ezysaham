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

export type ZoneStatus = 'ABOVE_ZONE' | 'IN_ZONE' | 'BELOW_ZONE';

/**
 * Where price sits relative to the entry zone, as its own explicit field — not implied by a
 * distance percentage or folded into "BUY". A LONG buy-on-support zone at Rp52–53 with price at
 * Rp67 is unambiguously ABOVE_ZONE (67 > 53), not "close enough" or "still bullish"
 * (features_kontradiktif.md's TRUE case). This is direction-agnostic: it only compares price
 * against the zone bounds the caller already computed for display, so it can never disagree with
 * the Entry Zone shown on screen.
 */
export function classifyZoneStatus(currentPrice: number, zoneLow: number, zoneHigh: number): ZoneStatus {
  if (currentPrice > zoneHigh) return 'ABOVE_ZONE';
  if (currentPrice < zoneLow) return 'BELOW_ZONE';
  return 'IN_ZONE';
}

/**
 * Whether the current price is actually on the actionable side of this scenario's entry trigger —
 * not just "close enough" by percentage. A LONG buy-on-support/pullback plan is only actionable
 * once price has come down to (or below) the entry level; a SHORT rejection plan is only watched
 * once price has rebounded up to the trigger level.
 *
 * This replaces gating on `entryDistancePct > threshold` alone (features_riskgate.md's MMLP/AYLS
 * cases): AYLS sat ~9% above its 178–180 entry zone and MMLP ~1% above its 302–318 zone — both
 * under a 15% "extreme distance" threshold, so both were being labeled BUY even though price
 * hadn't pulled back into the zone yet. A small percentage gap on the wrong side of the trigger is
 * still "not there yet," not "close enough."
 */
export function isPriceAtEntryTrigger(direction: Direction, currentPrice: number, entry: number): boolean {
  return direction === 'LONG' ? currentPrice <= entry : currentPrice >= entry;
}

/**
 * Whether price has already crossed this scenario's own invalidation line (the same condition
 * `invalidationRuleText` describes) — i.e. the setup is broken, not merely "not triggered yet."
 * This must never be presented as BUY/SHORT_SETUP *or* as a plain WAIT — it's NO_TRADE.
 */
export function isSetupInvalidated(direction: Direction, currentPrice: number, sl: number): boolean {
  return direction === 'LONG' ? currentPrice < sl : currentPrice > sl;
}
