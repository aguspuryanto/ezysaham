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
 *   3. Never present a scenario as an immediately-actionable BUY/SHORT_SETUP unless price is
 *      actually on the correct side of its entry trigger — force WAIT instead. A setup that has
 *      already crossed its own invalidation line is NO_TRADE, not WAIT.
 *
 * It does not compute Entry/SL/TP itself (that stays deterministic in
 * stockAnalysisEngine.ts / tradeValidation.ts) and it does not replace the
 * AI advisor's composite score — it's a hard override on top of both.
 */

import { Trend } from '@/domain/models/StockAnalysis';
import { Direction } from '@/domain/analysis/tradeValidation';

export type TradeStatus = 'BUY' | 'SHORT_SETUP' | 'WAIT' | 'NO_TRADE';

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

  if (input.setupInvalidated) {
    reasons.push(
      input.direction === 'LONG'
        ? 'Harga sudah menembus Stop Loss — setup ini sudah tidak valid.'
        : 'Harga sudah menembus level invalidasi SHORT — setup ini sudah tidak valid.'
    );
  }

  // Being a small % away from the trigger while still on the wrong side of it is still "not
  // there yet" — Setup/Signal (entryType) and Permission (buyAllowed) can both be favorable while
  // Action still has to be WAIT, because Entry Condition (price actually at the trigger) hasn't
  // fired. Mixing that into a single percentage threshold is what let AYLS/MMLP show "BUY" while
  // price was still sitting above their pullback zones (features_riskgate.md).
  const mustWaitForEntry = !input.priceAtEntryTrigger;

  // Once hard blockers stack up (bearish trend + falling-knife RSI + fundamental distress +
  // strong distribution), the headline Action must read NO_TRADE regardless of direction — not
  // just "BUY blocked." Those conditions describe a genuinely unpredictable/capitulation-risk
  // stock (a falling knife can snap back violently), which argues against taking ANY new position,
  // not only against buying it. features_riskgate.md's own target list makes this explicit: UDNG
  // (bearish + blockers stacked) is headlined NO TRADE, not "SHORT SETUP WATCH" — the SHORT
  // rejection level is still worth watching (see `notes`/`invalidationRule` on the scenario), but
  // it is not this gate's headline verdict while the stock is this dangerous.
  let tradeStatus: TradeStatus;
  if (input.setupInvalidated || buyBlocked) {
    tradeStatus = 'NO_TRADE';
  } else if (input.direction === 'LONG') {
    tradeStatus = mustWaitForEntry ? 'WAIT' : 'BUY';
  } else {
    tradeStatus = mustWaitForEntry ? 'WAIT' : 'SHORT_SETUP';
  }

  return { buyAllowed: !buyBlocked && !input.setupInvalidated, tradeStatus, reasons };
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
