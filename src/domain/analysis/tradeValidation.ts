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

/** TRADE LEVEL RULE defaults — % of Current Price, LONG framing (SHORT mirrors the sign). */
export const DEFAULT_SL_PCT = 7;
export const DEFAULT_TP1_PCT = 5;
export const DEFAULT_TP2_PCT = 10;

/** How close a default level must sit to a real S/R level to count as "at a reasonable technical level". */
const NEAR_LEVEL_TOLERANCE_PCT = 3;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function isNearAnyLevel(value: number, levels: number[], tolerancePct = NEAR_LEVEL_TOLERANCE_PCT): boolean {
  return levels.some((lvl) => lvl > 0 && Math.abs(value - lvl) / lvl <= tolerancePct / 100);
}

export interface TargetValidationFlags {
  /** SL sits within NEAR_LEVEL_TOLERANCE_PCT of a real support (LONG) / resistance (SHORT) level. */
  slNearTechnicalLevel: boolean;
  tp1NearTechnicalLevel: boolean;
  tp2NearTechnicalLevel: boolean;
  /** TP already reached judging by Current Price — should not happen by construction, checked anyway. */
  tp1AlreadyReached: boolean;
  tp2AlreadyReached: boolean;
  /** TP2 further from entry than TP1, in the scenario's favorable direction. */
  tp2AheadOfTp1: boolean;
  /** SL on the correct (losing) side of Current Price for this direction. */
  slOnCorrectSide: boolean;
}

/** A validation group's verdict + its human-readable (Indonesian) warning notes — the notes explain
 * a mismatch, they never change sl/tp1/tp2 on the plan itself. */
export interface ValidationGroup {
  ok: boolean;
  notes: string[];
}

export interface DefaultTargetPlan {
  direction: Direction;
  currentPrice: number;
  sl: number;
  tp1: number;
  tp2: number;
  riskPct: number;
  rewardPct1: number;
  rewardPct2: number;
  riskRewardRatio1: number;
  riskRewardRatio2: number;
  validation: TargetValidationFlags;
  /** "Stop Loss Validation" — SL near a real technical level & on the correct side of Current Price. */
  stopLossValidation: ValidationGroup;
  /** "Target Validation" — TP1/TP2 near real resistance/support, not already reached, TP2 ahead of TP1. */
  targetValidation: ValidationGroup;
  /** Flat concatenation of stopLossValidation.notes + targetValidation.notes — for a single-list display. */
  mismatchNotes: string[];
}

/**
 * TRADE LEVEL RULE: SL/TP1/TP2 computed strictly off Current Price
 * (SL = price×0.93, TP1 = price×1.05, TP2 = price×1.10 for LONG; mirrored for SHORT),
 * then validated against the actual support/resistance levels. A failed check is surfaced
 * as a note — the default numbers themselves are never silently changed to "fix" a mismatch.
 */
export function buildDefaultTargetPlan(
  direction: Direction,
  currentPrice: number,
  supportPrices: number[],
  resistancePrices: number[]
): DefaultTargetPlan {
  const isLong = direction === 'LONG';
  const sl = round2(currentPrice * (isLong ? 1 - DEFAULT_SL_PCT / 100 : 1 + DEFAULT_SL_PCT / 100));
  const tp1 = round2(currentPrice * (isLong ? 1 + DEFAULT_TP1_PCT / 100 : 1 - DEFAULT_TP1_PCT / 100));
  const tp2 = round2(currentPrice * (isLong ? 1 + DEFAULT_TP2_PCT / 100 : 1 - DEFAULT_TP2_PCT / 100));

  // LONG: SL should sit near support, TP near resistance. SHORT: mirrored.
  const slLevels = isLong ? supportPrices : resistancePrices;
  const tpLevels = isLong ? resistancePrices : supportPrices;

  const slNearTechnicalLevel = isNearAnyLevel(sl, slLevels);
  const tp1NearTechnicalLevel = isNearAnyLevel(tp1, tpLevels);
  const tp2NearTechnicalLevel = isNearAnyLevel(tp2, tpLevels);
  const tp1AlreadyReached = isLong ? tp1 <= currentPrice : tp1 >= currentPrice;
  const tp2AlreadyReached = isLong ? tp2 <= currentPrice : tp2 >= currentPrice;
  const tp2AheadOfTp1 = isLong ? tp2 > tp1 : tp2 < tp1;
  const slOnCorrectSide = isLong ? sl < currentPrice : sl > currentPrice;

  const risk1 = computeRiskReward(direction, currentPrice, sl, tp1);
  const risk2 = computeRiskReward(direction, currentPrice, sl, tp2);

  // Stop Loss Validation — SL near a real technical level & on the correct (losing) side of price.
  // A failed check never changes `sl` above; it only produces a warning note.
  const stopLossNotes: string[] = [];
  if (!slNearTechnicalLevel) {
    stopLossNotes.push(
      isLong
        ? `SL default (Rp${sl.toLocaleString('id-ID')}) tidak dekat level support teknikal mana pun.`
        : `SL default (Rp${sl.toLocaleString('id-ID')}) tidak dekat level resistance teknikal mana pun.`
    );
  }
  if (!slOnCorrectSide) stopLossNotes.push('SL default tidak berada pada sisi yang benar dari Current Price — periksa ulang data harga.');

  // Target Validation — TP1/TP2 near real resistance/support, not already reached, TP2 ahead of TP1.
  // A failed check never changes `tp1`/`tp2` above; it only produces a warning note.
  const targetNotes: string[] = [];
  if (!tp1NearTechnicalLevel) {
    targetNotes.push(
      isLong
        ? `TP1 default (Rp${tp1.toLocaleString('id-ID')}) tidak dekat area resistance teknikal mana pun.`
        : `TP1 default (Rp${tp1.toLocaleString('id-ID')}) tidak dekat area support teknikal mana pun.`
    );
  }
  if (!tp2NearTechnicalLevel) {
    targetNotes.push(
      isLong
        ? `TP2 default (Rp${tp2.toLocaleString('id-ID')}) tidak dekat area resistance teknikal mana pun.`
        : `TP2 default (Rp${tp2.toLocaleString('id-ID')}) tidak dekat area support teknikal mana pun.`
    );
  }
  if (tp1AlreadyReached) targetNotes.push('TP1 default sudah tercapai berdasarkan Current Price.');
  if (tp2AlreadyReached) targetNotes.push('TP2 default sudah tercapai berdasarkan Current Price.');
  if (!tp2AheadOfTp1) targetNotes.push('TP2 default tidak lebih jauh dari TP1 pada arah yang diuntungkan — periksa ulang data harga.');

  const stopLossValidation: ValidationGroup = { ok: stopLossNotes.length === 0, notes: stopLossNotes };
  const targetValidation: ValidationGroup = { ok: targetNotes.length === 0, notes: targetNotes };

  return {
    direction,
    currentPrice,
    sl,
    tp1,
    tp2,
    riskPct: risk1.riskPct,
    rewardPct1: risk1.rewardPct,
    rewardPct2: risk2.rewardPct,
    riskRewardRatio1: risk1.riskRewardRatio,
    riskRewardRatio2: risk2.riskRewardRatio,
    validation: {
      slNearTechnicalLevel,
      tp1NearTechnicalLevel,
      tp2NearTechnicalLevel,
      tp1AlreadyReached,
      tp2AlreadyReached,
      tp2AheadOfTp1,
      slOnCorrectSide,
    },
    stopLossValidation,
    targetValidation,
    mismatchNotes: [...stopLossNotes, ...targetNotes],
  };
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

export interface EntryConfirmationInput {
  /** Price has reached the actionable side of the entry trigger (tradeValidation.isPriceAtEntryTrigger) — support/retest reached. */
  priceAtEntryTrigger: boolean;
  /** Price already crossed the scenario's own SL/invalidation line — a broken setup can never confirm. */
  setupInvalidated: boolean;
  /** The broader trend has not flipped against this scenario's direction (e.g. still not bearish for a LONG). */
  trendValid: boolean;
  /** A reversal/continuation candle in this scenario's favor (bullish for LONG, bearish for SHORT) — plain price-in-zone is not itself a signal. */
  reversalConfirmed: boolean;
  /** Relative volume is at/above average, not weak or declining — a silent retest on dead volume does not confirm. */
  volumeSupportive: boolean;
}

/**
 * Deterministic Entry Confirmation checklist: reaching the entry trigger by price alone is not
 * confirmation (features_kontradiktif.md's MMLP case — "In Entry Zone ≠ otomatis BUY"). All of
 * support/retest reached, no breakdown, a reversal candle, supportive volume, and an intact trend
 * must hold before an entry can read CONFIRMED — never AI Score, never price location by itself.
 */
export function isEntryConfirmed(input: EntryConfirmationInput): boolean {
  if (input.setupInvalidated || !input.priceAtEntryTrigger || !input.trendValid) return false;
  return input.reversalConfirmed && input.volumeSupportive;
}
