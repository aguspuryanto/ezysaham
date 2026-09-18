/**
 * riskGate.ts
 *
 * "Consistency & Risk Gate" layer sitting between the raw analysis engine
 * (stockAnalysisEngine.ts / aiStockEngine.ts / bandarScore.ts) and the report
 * UI — see features_inkonsistensi.md / features_kontradiktif.md. Its job is
 * narrow on purpose:
 *
 *   1. Never let "RSI oversold" alone flip into a BUY signal.
 *   2. Block BUY outright when several bearish confirmations stack up
 *      (bearish trend + very weak fundamentals + strong distribution +
 *      deep oversold + price under EMA50/EMA200).
 *   3. Never present a scenario as an immediately-actionable BUY/SHORT_SETUP unless price is
 *      actually on the correct side of its entry trigger — force WAIT instead. A setup that has
 *      already crossed its own invalidation line is NO_TRADE, not WAIT.
 *
 * It does not compute Entry/SL/TP itself (that stays deterministic in
 * stockAnalysisEngine.ts / tradeValidation.ts) and it does not replace the
 * AI advisor's composite score — it's a hard override on top of both.
 *
 * A single `Buy Allowed: TRUE/FALSE` boolean used to answer three different
 * questions at once — "is the market/fundamental picture risky?", "is a BUY
 * permitted at all?", and "is price actually at the entry right now?" —
 * which is exactly how a stock flagged CONDITIONAL risk (TRUE: sideways +
 * weak fundamental + extreme overbought, none of which individually crossed
 * the hard-block threshold) could still read a bare "TRUE" next to a report
 * full of warnings (features_kontradiktif.md's TRUE case). This module now
 * answers each question as its own field — `riskGateStatus`, `buyPermission`,
 * `entryStatus` — and `tradeStatus`/Final Action is derived from all three
 * together, never from one alone.
 */

import { Trend } from '@/domain/models/StockAnalysis';
import { Direction, ZoneStatus } from '@/domain/analysis/tradeValidation';

export type TradeStatus = 'BUY' | 'SHORT_SETUP' | 'WAIT' | 'WAIT_FOR_PULLBACK' | 'NO_TRADE';

/** Is the market/fundamental/technical picture systemically risky right now — independent of direction or price location? */
export type RiskGateStatus = 'CLEAR' | 'CONDITIONAL' | 'BLOCKED';
/** Given the Risk Gate, is opening a BUY permitted at all — still independent of whether price is at the entry yet? */
export type BuyPermission = 'TRUE' | 'CONDITIONAL' | 'FALSE';
/** Is price/timing actually confirming entry right now — independent of whether BUY is permitted in principle? */
export type EntryStatus = 'NOT_READY' | 'WATCH' | 'CONFIRMED' | 'INVALIDATED';

export interface RiskGateInput {
  direction: Direction;
  trend: Trend;
  rsi14: number;
  fundamentalScore: number; // 0-100
  isStrongDistribution: boolean;
  priceBelowEma50: boolean;
  priceBelowEma200: boolean;
  /** From tradeValidation.isPriceAtEntryTrigger — price is on the actionable side of the trigger. */
  priceAtEntryTrigger: boolean;
  /** From tradeValidation.isSetupInvalidated — price already crossed the scenario's own SL/invalidation line. */
  setupInvalidated: boolean;
  /** From TradeScenario.extremeDistanceWarning — price sits >15% from the entry trigger, i.e. not a realistic near-term setup (distinguishes NOT_READY from WATCH). */
  extremeDistanceWarning: boolean;
  /** bandarScore's classification.label === 'Distribution Risk' — elevated but not yet Strong Distribution. Soft warning only, never a BLOCKED contributor on its own. */
  isDistributionRisk: boolean;
  /** Where price sits vs. the entry zone shown on screen (tradeValidation.classifyZoneStatus) — required for BUY_NOW, see tradeStatus derivation below. */
  zoneStatus: ZoneStatus;
  /** Debt-to-Equity Ratio, % — null when unavailable. Feeds classifyFundamentalRisk alongside ROE. */
  der: number | null;
  /** Return on Equity, %. Feeds classifyFundamentalRisk alongside DER. */
  roe: number;
}

export interface RiskGateResult {
  riskGateStatus: RiskGateStatus;
  buyPermission: BuyPermission;
  entryStatus: EntryStatus;
  tradeStatus: TradeStatus;
  /** Bearish confirmations found — empty when nothing is flagged. */
  reasons: string[];
}

/** Risk Gate reads BLOCKED once this many independent bearish confirmations stack up (section 8 of the prompt). */
const BUY_BLOCK_THRESHOLD = 3;

export function evaluateRiskGate(input: RiskGateInput): RiskGateResult {
  // Hard reasons are the only ones that can ever stack up to BLOCKED — see BUY_BLOCK_THRESHOLD.
  const hardReasons: string[] = [];
  if (input.trend === 'bearish') hardReasons.push('Tren utama Bearish');
  if (input.rsi14 < 25) hardReasons.push(`RSI ${input.rsi14.toFixed(1)} oversold ekstrem — kondisi, bukan sinyal reversal`);
  if (input.fundamentalScore < 20) hardReasons.push(`Skor fundamental sangat lemah (${input.fundamentalScore}/100)`);
  if (input.isStrongDistribution) hardReasons.push('Bandar terindikasi Strong Distribution');
  if (input.priceBelowEma50) hardReasons.push('Harga di bawah EMA50');
  if (input.priceBelowEma200) hardReasons.push('Harga di bawah EMA200');

  // Soft reasons elevate CLEAR → CONDITIONAL on their own but can never add up to BLOCKED — a
  // stock can be "risky enough to flag" without being "risky enough to veto outright". Without
  // these, a report with none of the 6 hard conditions above but still extreme-overbought + weak
  // fundamental + distribution risk (features_kontradiktif.md's TRUE case: RSI 96.6, fundamental
  // 23/100, Bandar "Distribution Risk") would read a plain "Risk Gate: CLEAR / Buy Permission:
  // TRUE" — exactly the bare "Buy Allowed: TRUE" this module exists to replace.
  const softReasons: string[] = [];
  const rsiOverbought = classifyRsiOverbought(input.rsi14);
  if (rsiOverbought.status === 'HIGH_OVERBOUGHT' || rsiOverbought.status === 'EXTREME_OVERBOUGHT') {
    softReasons.push(rsiOverbought.label);
  }
  // Fundamental score alone undersells TRUE's case (40/100 — not "sangat lemah") once DER 151% /
  // ROE -22.2% are folded in; classifyFundamentalRisk treats those as a risk modifier on top of the
  // score band, still only ever CONDITIONAL here, never a hard BUY block on their own (§6).
  const fundamentalRisk = classifyFundamentalRisk(input.fundamentalScore, input.der, input.roe);
  if (input.fundamentalScore >= 20 && (fundamentalRisk === 'HIGH' || fundamentalRisk === 'MODERATE_HIGH')) {
    softReasons.push(
      fundamentalRisk === 'HIGH'
        ? `Fundamental Risk HIGH — skor ${input.fundamentalScore}/100, leverage tinggi (DER ${input.der != null ? `${input.der.toFixed(0)}%` : '–'}) & profitabilitas negatif (ROE ${input.roe.toFixed(1)}%)`
        : `Fundamental Risk MODERATE_HIGH — skor ${input.fundamentalScore}/100 tergolong lemah`
    );
  }
  if (input.isDistributionRisk) softReasons.push('Bandar terindikasi Distribution Risk (belum Strong Distribution)');

  const reasons: string[] = [...hardReasons, ...softReasons];

  // Risk Gate is a market-level judgment that must hold regardless of which scenario direction
  // happens to be displayed — a BEARISH + Falling-Knife + Strong-Distribution report must never
  // read "Risk Gate: CLEAR" just because a SHORT scenario is shown (features_riskgate.md). Hard
  // reasons stacking up to the threshold is BLOCKED; any reason at all (hard or soft) below that
  // threshold is CONDITIONAL (elevated risk, not an automatic block).
  const riskGateStatus: RiskGateStatus =
    hardReasons.length >= BUY_BLOCK_THRESHOLD ? 'BLOCKED' : reasons.length > 0 ? 'CONDITIONAL' : 'CLEAR';

  // Buy Permission answers "would BUY be permitted at all" from the Risk Gate alone — it does not
  // know or care yet whether price is actually at the entry (that's Entry Status below).
  const buyPermission: BuyPermission =
    riskGateStatus === 'BLOCKED' ? 'FALSE' : riskGateStatus === 'CONDITIONAL' ? 'CONDITIONAL' : 'TRUE';

  // Entry Status is purely about price/timing, never about market risk — Setup/Signal (entryType)
  // and Buy Permission can both be favorable while Entry Status still reads NOT_READY/WATCH,
  // because price hasn't actually reached the trigger yet. Mixing that into a single percentage
  // threshold is what let AYLS/MMLP show "BUY" while price was still sitting above their pullback
  // zones, and what let TRUE (price 20.9% above its entry) read the same as a stock one tick away
  // (features_riskgate.md / features_kontradiktif.md).
  let entryStatus: EntryStatus;
  if (input.setupInvalidated) {
    entryStatus = 'INVALIDATED';
    reasons.push(
      input.direction === 'LONG'
        ? 'Harga sudah menembus Stop Loss — setup ini sudah tidak valid.'
        : 'Harga sudah menembus level invalidasi SHORT — setup ini sudah tidak valid.'
    );
  } else if (input.priceAtEntryTrigger) {
    entryStatus = 'CONFIRMED';
  } else if (input.extremeDistanceWarning) {
    entryStatus = 'NOT_READY';
  } else {
    entryStatus = 'WATCH';
  }

  // Final Action is derived from all four fields together — never from Risk Gate, Buy Permission,
  // Entry Status, or Zone Status alone, and never overridden by AI Score (features_kontradiktif.md
  // §10). A CONDITIONAL Risk Gate does not by itself force NO_TRADE (TRUE's expected Final Action
  // is WAIT_FOR_PULLBACK, not NO_TRADE) — only BLOCKED or an already-invalidated setup do.
  //
  // BUY_NOW = BUY_ALLOWED AND RiskGate != BLOCK AND ZoneStatus == IN_ZONE AND EntryConfirmation ==
  // CONFIRMED (features_kontradiktif.md rule 1). Price sitting on the actionable side of the raw
  // entry number (entryStatus CONFIRMED) is not enough by itself — TRUE's price (67) is still
  // "confirmed" against its single entry number under the old check while sitting 20.9% ABOVE the
  // 52–53 entry zone shown on screen; without the explicit Zone Status gate this read BUY instead
  // of WAIT_FOR_PULLBACK.
  let tradeStatus: TradeStatus;
  if (riskGateStatus === 'BLOCKED' || entryStatus === 'INVALIDATED') {
    tradeStatus = 'NO_TRADE';
  } else if (input.direction === 'LONG') {
    if (buyPermission !== 'FALSE' && input.zoneStatus === 'IN_ZONE' && entryStatus === 'CONFIRMED') {
      tradeStatus = 'BUY';
    } else if (input.zoneStatus === 'ABOVE_ZONE') {
      tradeStatus = 'WAIT_FOR_PULLBACK';
    } else {
      tradeStatus = 'WAIT';
    }
  } else {
    tradeStatus = entryStatus === 'CONFIRMED' ? 'SHORT_SETUP' : 'WAIT';
  }

  return { riskGateStatus, buyPermission, entryStatus, tradeStatus, reasons };
}

// ─── Oversold ≠ BUY classification (section 7) ──────────────────────────────
export type OversoldRiskStatus =
  | 'NONE'
  | 'OVERSOLD'
  | 'FALLING_KNIFE_RISK'
  | 'REVERSAL_WATCH'
  | 'EARLY_REVERSAL'
  | 'REVERSAL_CONFIRMED';

export interface OversoldRiskInput {
  rsi14: number;
  trend: Trend;
  higherLows: boolean;
  macdBullish: boolean;
  breakoutConfirmedWithVolume: boolean;
}

export interface OversoldRiskResult {
  status: OversoldRiskStatus;
  label: string;
}

/**
 * RSI oversold is a condition, not a signal. This ranks it against the other
 * confirmations available (trend, structure, momentum, breakout+volume)
 * before ever implying a reversal is underway.
 */
export function classifyOversoldRisk(input: OversoldRiskInput): OversoldRiskResult {
  if (!(input.rsi14 < 30)) return { status: 'NONE', label: '' };

  if (input.rsi14 < 25) {
    if (input.breakoutConfirmedWithVolume) {
      return { status: 'REVERSAL_CONFIRMED', label: 'Reversal Confirmed — breakout resistance dikonfirmasi volume.' };
    }
    if (input.higherLows) {
      return { status: 'EARLY_REVERSAL', label: 'Early Reversal — higher low mulai terbentuk, tunggu konfirmasi lanjutan.' };
    }
    if (input.macdBullish) {
      return { status: 'REVERSAL_WATCH', label: 'Reversal Watch — mulai ada divergensi bullish, belum terkonfirmasi.' };
    }
    if (input.trend === 'bearish') {
      return { status: 'FALLING_KNIFE_RISK', label: 'Falling Knife Risk — oversold ekstrem di tengah downtrend, hindari average down.' };
    }
  }

  return { status: 'OVERSOLD', label: 'Oversold — kondisi, bukan sinyal beli otomatis.' };
}

// ─── RSI overbought tiers (features_kontradiktif.md §4) ─────────────────────
export type RsiOverboughtStatus = 'NONE' | 'OVERBOUGHT' | 'HIGH_OVERBOUGHT' | 'EXTREME_OVERBOUGHT';
export type ChasingRisk = 'LOW' | 'MODERATE' | 'HIGH' | 'VERY_HIGH';

export interface RsiOverboughtResult {
  status: RsiOverboughtStatus;
  chasingRisk: ChasingRisk;
  label: string;
}

/**
 * A flat "Overbought" pill treats RSI 71 and RSI 96.6 the same — TRUE's report showed exactly that
 * before this classifier existed. Extreme overbought (>90) is a chasing-risk warning, never an
 * automatic SELL: a stock can keep grinding up while RSI stays pinned above 90.
 */
export function classifyRsiOverbought(rsi14: number): RsiOverboughtResult {
  if (rsi14 > 90) {
    return {
      status: 'EXTREME_OVERBOUGHT',
      chasingRisk: 'VERY_HIGH',
      label: `RSI ${rsi14.toFixed(1)} Extreme Overbought — chasing risk sangat tinggi, bukan sinyal jual otomatis`,
    };
  }
  if (rsi14 > 80) {
    return {
      status: 'HIGH_OVERBOUGHT',
      chasingRisk: 'HIGH',
      label: `RSI ${rsi14.toFixed(1)} Overbought tinggi — risiko chasing tinggi`,
    };
  }
  if (rsi14 > 70) {
    return {
      status: 'OVERBOUGHT',
      chasingRisk: 'MODERATE',
      label: `RSI ${rsi14.toFixed(1)} Overbought — momentum kuat, waspada profit taking`,
    };
  }
  return { status: 'NONE', chasingRisk: 'LOW', label: '' };
}

// ─── Fundamental risk modifier (features_kontradiktif.md §6) ────────────────
export type FundamentalRiskLevel = 'LOW' | 'MODERATE' | 'MODERATE_HIGH' | 'HIGH';

/**
 * Fundamental score alone undersells a case like TRUE's (40/100 reads "just weak" on its own).
 * High leverage (DER > 100%) stacked with negative profitability (ROE < 0) compounds a
 * MODERATE_HIGH score band into HIGH — but only as a risk modifier that feeds Risk Gate reasons,
 * never an automatic BUY or SELL by itself.
 */
export function classifyFundamentalRisk(score: number, der: number | null, roe: number): FundamentalRiskLevel {
  const base: FundamentalRiskLevel = score < 30 ? 'HIGH' : score < 50 ? 'MODERATE_HIGH' : score < 70 ? 'MODERATE' : 'LOW';
  const highLeverage = der != null && der > 100;
  const negativeProfitability = roe < 0;
  if (base === 'MODERATE_HIGH' && highLeverage && negativeProfitability) return 'HIGH';
  return base;
}
