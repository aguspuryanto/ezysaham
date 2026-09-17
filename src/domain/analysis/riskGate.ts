/**
 * riskGate.ts
 *
 * "Consistency & Risk Gate" layer sitting between the raw analysis engine
 * (stockAnalysisEngine.ts / aiStockEngine.ts / bandarScore.ts) and the report
 * UI — see features_inkonsistensi.md. Its job is narrow on purpose:
 *
 *   1. Never let "RSI oversold" alone flip into a BUY signal.
 *   2. Block BUY outright when several bearish confirmations stack up
 *      (bearish trend + very weak fundamentals + strong distribution +
 *      deep oversold + price under EMA50/EMA200).
 *   3. Never present an entry that's far from the current price as an
 *      immediately-actionable BUY/SHORT — force WAIT instead.
 *
 * It does not compute Entry/SL/TP itself (that stays deterministic in
 * stockAnalysisEngine.ts / tradeValidation.ts) and it does not replace the
 * AI advisor's composite score — it's a hard override on top of both.
 */

import { Trend } from '@/domain/models/StockAnalysis';
import { Direction, ENTRY_DISTANCE_WARNING_PCT } from '@/domain/analysis/tradeValidation';

export type TradeStatus = 'BUY' | 'SHORT_SETUP' | 'WAIT' | 'NO_TRADE';

export interface RiskGateInput {
  direction: Direction;
  trend: Trend;
  rsi14: number;
  fundamentalScore: number; // 0-100
  isStrongDistribution: boolean;
  priceBelowEma50: boolean;
  priceBelowEma200: boolean;
  entryDistancePct: number;
}

export interface RiskGateResult {
  buyAllowed: boolean;
  tradeStatus: TradeStatus;
  /** Bearish confirmations found — empty when nothing is flagged. */
  reasons: string[];
}

/** BUY is blocked once this many independent bearish confirmations stack up (section 8 of the prompt). */
const BUY_BLOCK_THRESHOLD = 3;

export function evaluateRiskGate(input: RiskGateInput): RiskGateResult {
  const reasons: string[] = [];
  if (input.trend === 'bearish') reasons.push('Tren utama Bearish');
  if (input.rsi14 < 25) reasons.push(`RSI ${input.rsi14.toFixed(1)} oversold ekstrem — kondisi, bukan sinyal reversal`);
  if (input.fundamentalScore < 20) reasons.push(`Skor fundamental sangat lemah (${input.fundamentalScore}/100)`);
  if (input.isStrongDistribution) reasons.push('Bandar terindikasi Strong Distribution');
  if (input.priceBelowEma50) reasons.push('Harga di bawah EMA50');
  if (input.priceBelowEma200) reasons.push('Harga di bawah EMA200');

  // `buyAllowed` answers "would BUY be permitted right now given market conditions" — a
  // market-level judgment that must hold regardless of which scenario direction happens to be
  // displayed. The previous `input.direction === 'LONG' &&` guard made this trivially TRUE
  // whenever a SHORT scenario was shown, so a BEARISH + Falling-Knife + Strong-Distribution report
  // could still read "Risk Gate: BUY DIIZINKAN" (features_riskgate.md) — a direct contradiction of
  // the rest of the report, since the blockers are properties of the market, not of the scenario
  // being rendered.
  const buyBlocked = reasons.length >= BUY_BLOCK_THRESHOLD;
  const mustWaitForEntry = input.entryDistancePct > ENTRY_DISTANCE_WARNING_PCT;

  let tradeStatus: TradeStatus;
  if (input.direction === 'LONG') {
    tradeStatus = buyBlocked ? 'NO_TRADE' : mustWaitForEntry ? 'WAIT' : 'BUY';
  } else {
    tradeStatus = mustWaitForEntry ? 'WAIT' : 'SHORT_SETUP';
  }

  return { buyAllowed: !buyBlocked, tradeStatus, reasons };
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
