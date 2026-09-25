/**
 * earlyBullishReview.ts
 *
 * Consistent 6-component technical read for EquityResearchReportCardv5 — find stocks that are
 * STARTING to turn bullish while entry is still reasonable; never chase a stock that already flew.
 *
 *   1. TREND        BEARISH · STABILIZING · EARLY_BULLISH · BULLISH · EXTENDED (EMA20/50/200)
 *   2. MOMENTUM     change of RSI + MACD, not just their position
 *   3. BUYER/VOLUME volume vs average + who dominates — big volume is never BUY by itself
 *   4. PRICE ACTION reversal · higher low · breakout · breakout-retest · rejection · lower high/low
 *   5. ENTRY        VALID (near support/entry zone) · CAUTION (drifting away) · EXTENDED (too far/fast)
 *   6. RISK         FOMO/chase · event · trend · missing indicator data
 *
 * Rules: missing data → UNKNOWN (EMA200 is never mentioned without ≥ 200 bars), oversold is not a BUY
 * signal, fundamental is only a quality filter (applied by the caller), and no single indicator is a BUY.
 *
 * DECISION = CONFIRMATION HIERARCHY — "Bullish signal ≠ Buy Permission":
 *   1. SETUP         price > EMA20 + higher low/reversal + RSI > 50 or momentum improving; all 3 →
 *                    EARLY BULLISH (never BUY by itself).
 *   2. CONFIRMATION  ≥ 3/6 of: held above EMA20 · valid higher low · MACD cross/histogram improving ·
 *                    RSI > 50 · volume ≥ 1.5× avg · breakout with a strong close → CONFIRMED BULLISH.
 *   3. RISK GATE     PASS / CAUTION / BLOCK. BLOCK (below EMA200, MACD bearish, high event risk, weak
 *                    volume, too far from EMA20, …) downgrades CONFIRMED to EARLY BULLISH.
 *   4. BUY PERMISSION only when confirmed + gate PASS + entry VALID (no chasing) + a clear
 *                    invalidation level + valid stop loss and risk/reward.
 *   5. INVALIDATION  close under stop loss/support → INVALIDATED, BUY cancelled, status WAIT.
 * Trigger types (REVERSAL / BREAKOUT) are still reported but no longer grant BUY on their own.
 *
 * Reuses the bar-based change detection from simpleEntryReview.ts and never recomputes Entry/SL/TP,
 * Risk Gate or catalysts — a NO TRADE from the shared review is never upgraded here.
 */

import { formatCompact, formatRupiah } from '@/lib/format';
import type { OHLCVBar } from '@/domain/models/History';
import type { CandlePattern, MacdSignal } from '@/domain/models/StockAnalysis';
import { detectChartChange } from '@/domain/analysis/simpleEntryReview';
import type { MoveType, RiskLevel3, TodayTradeStatus } from '@/domain/analysis/todayMoveAnalysis';

export type TrendClass = 'BEARISH' | 'STABILIZING' | 'EARLY_BULLISH' | 'BULLISH' | 'EXTENDED' | 'UNKNOWN';
export type MomentumClass = 'MEMBAIK' | 'BULLISH' | 'NETRAL' | 'MELEMAH' | 'UNKNOWN';
export type BuyerClass = 'BUYER_DOMINAN' | 'NETRAL' | 'SELLER_DOMINAN' | 'UNKNOWN';
export type PriceActionClass =
  | 'BREAKOUT_RETEST' | 'BREAKOUT' | 'REVERSAL' | 'HIGHER_LOW' | 'REJECTION' | 'LOWER_HIGH_LOW' | 'BREAKDOWN' | 'NONE' | 'UNKNOWN';
export type EntryClass = 'VALID' | 'CAUTION' | 'EXTENDED' | 'UNKNOWN';
export type EbDecision = 'BUY' | 'WAIT' | 'NO_TRADE';
/** Second half of the decision line, e.g. "WAIT — EXTENDED". */
export type EbDecisionTag =
  | 'CONFIRMED_BULLISH' | 'EARLY_BULLISH' | 'BULLISH' | 'STABILIZING' | 'EXTENDED' | 'BEARISH' | 'INVALIDATED'
  | 'EVENT_RISK' | 'HIGH_RISK' | 'FUNDAMENTAL' | 'DATA_KURANG';
export type BuyTriggerType = 'REVERSAL' | 'BREAKOUT';
export type TechnicalStage = 'EARLY_BULLISH' | 'CONFIRMED_BULLISH' | 'WAIT' | 'INVALIDATED';
export type RiskGateStatus = 'PASS' | 'CAUTION' | 'BLOCK';

export const TECHNICAL_STAGE_LABEL: Record<TechnicalStage, string> = {
  EARLY_BULLISH: 'EARLY BULLISH', CONFIRMED_BULLISH: 'CONFIRMED BULLISH', WAIT: 'WAIT', INVALIDATED: 'INVALIDATED',
};

export interface HierarchyCheck {
  label: string;
  ok: boolean;
}

export interface HierarchyScore {
  score: number;
  max: number;
  /** Minimum score needed for this level to count as valid. */
  required: number;
  valid: boolean;
  checks: HierarchyCheck[];
}

export const TREND_CLASS_LABEL: Record<TrendClass, string> = {
  BEARISH: 'BEARISH', STABILIZING: 'STABILIZING', EARLY_BULLISH: 'EARLY BULLISH', BULLISH: 'BULLISH', EXTENDED: 'EXTENDED', UNKNOWN: 'UNKNOWN',
};
export const MOMENTUM_CLASS_LABEL: Record<MomentumClass, string> = {
  MEMBAIK: 'MEMBAIK', BULLISH: 'BULLISH', NETRAL: 'NETRAL', MELEMAH: 'MELEMAH', UNKNOWN: 'UNKNOWN',
};
export const BUYER_CLASS_LABEL: Record<BuyerClass, string> = {
  BUYER_DOMINAN: 'BUYER DOMINAN', NETRAL: 'NETRAL', SELLER_DOMINAN: 'SELLER DOMINAN', UNKNOWN: 'UNKNOWN',
};
export const PRICE_ACTION_CLASS_LABEL: Record<PriceActionClass, string> = {
  BREAKOUT_RETEST: 'BREAKOUT-RETEST', BREAKOUT: 'BREAKOUT', REVERSAL: 'REVERSAL', HIGHER_LOW: 'HIGHER LOW', REJECTION: 'REJECTION',
  LOWER_HIGH_LOW: 'LOWER HIGH / LOWER LOW', BREAKDOWN: 'BREAKDOWN', NONE: 'BELUM ADA POLA', UNKNOWN: 'UNKNOWN',
};
export const ENTRY_CLASS_LABEL: Record<EntryClass, string> = { VALID: 'VALID', CAUTION: 'CAUTION', EXTENDED: 'EXTENDED', UNKNOWN: 'UNKNOWN' };
export const EB_DECISION_LABEL: Record<EbDecision, string> = { BUY: 'BUY', WAIT: 'WAIT', NO_TRADE: 'NO TRADE' };
export const EB_DECISION_TAG_LABEL: Record<EbDecisionTag, string> = {
  CONFIRMED_BULLISH: 'CONFIRMED BULLISH', INVALIDATED: 'INVALIDATED', EARLY_BULLISH: 'EARLY BULLISH', BULLISH: 'BULLISH', STABILIZING: 'STABILIZING', EXTENDED: 'EXTENDED', BEARISH: 'BEARISH',
  EVENT_RISK: 'EVENT RISK', HIGH_RISK: 'RISIKO TINGGI', FUNDAMENTAL: 'FUNDAMENTAL LEMAH', DATA_KURANG: 'DATA KURANG',
};

export interface EarlyBullishInput {
  bars: OHLCVBar[];
  price: number;
  changePct: number;
  rvol: number | null;
  volumeMa20: number;
  /** 0 = closed at the low, 1 = closed at the high. */
  closePosition: number | null;
  rsi14: number;
  macdSignalType: MacdSignal;
  macdValue: number;
  macdSignal: number;
  candlePattern: CandlePattern;
  higherLows: boolean;
  ema20: number;
  ema50: number;
  ema200: number;
  support: number | null;
  resistance: number | null;
  moveType: MoveType;
  entryZoneLow: number;
  entryZoneHigh: number;
  chaseRisk: RiskLevel3;
  eventRisk: RiskLevel3;
  trendRisk: RiskLevel3;
  isStrongDistribution: boolean;
  setupInvalidated: boolean;
  /** Trade status from todayMoveAnalysis.ts — a NO_TRADE there is never upgraded. */
  baseTradeStatus: TodayTradeStatus;
  /** LONG stop loss from the shared trading plan (null when unavailable). */
  stopLoss: number | null;
  /** LONG target 1 from the shared trading plan (null when unavailable). */
  target: number | null;
}

export interface Component<T extends string> {
  status: T;
  reason: string;
}

export interface EarlyBullishReview {
  price: number;
  trend: Component<TrendClass>;
  momentum: Component<MomentumClass>;
  buyer: Component<BuyerClass>;
  priceAction: Component<PriceActionClass>;
  entry: Component<EntryClass>;
  fomo: RiskLevel3;
  risk: { level: RiskLevel3; reasons: string[] };
  bullishTransition: boolean;
  triggerType: BuyTriggerType | null;
  decision: EbDecision;
  tag: EbDecisionTag;
  /** One line: why this decision. */
  why: string;
  /** BUY: the active trigger. WAIT/NO TRADE: the concrete condition that turns it into BUY. */
  buyTrigger: string;
  /** Data that could not be read (shown as UNKNOWN, adds to risk). */
  missingData: string[];
  /** % price sits above the entry reference (zone top / breakout level). */
  entryDistancePct: number | null;
  /** EMA200 is only used/mentioned with ≥ 200 bars. */
  hasEma200: boolean;
  // ── Confirmation hierarchy
  stage: TechnicalStage;
  buyPermission: boolean;
  setup: HierarchyScore;
  confirmation: HierarchyScore;
  riskGate: { status: RiskGateStatus; block: string[]; caution: string[] };
  /** Conditions still missing before BUY permission can be given. */
  missingTriggers: string[];
  /** Close below this level cancels the setup (stop loss, else support). */
  invalidationLevel: number | null;
  riskRewardRatio: number | null;
}

/** Entry distance thresholds above the entry reference. */
const ENTRY_VALID_MAX_PCT = 3;
const ENTRY_CAUTION_MAX_PCT = 8;
/** Stretch that makes a trend EXTENDED. */
const STRETCH_EMA20_PCT = 12;
const STRETCH_RUN_FROM_LOW_PCT = 35;
/** Buyer volume threshold (× average). */
const BUYER_RVOL = 1.5;
/** Support "holds" if the last 5 lows stay within this % under it. */
const SUPPORT_HOLD_TOLERANCE_PCT = 2;
/** Price within this % of a level counts as "near" for choosing the trigger path. */
const NEAR_LEVEL_PCT = 5;
/** Confirmation hierarchy thresholds. */
const CONFIRMATION_REQUIRED = 3;
const HELD_ABOVE_EMA20_BARS = 3;
const WEAK_VOLUME_RVOL = 0.7;
const EMA20_CAUTION_PCT = 5;
const EMA20_BLOCK_PCT = 8;
const STRONG_CLOSE_POSITION = 0.6;
const MIN_RISK_REWARD = 1.5;
const MAX_STOP_LOSS_PCT = 8;

const rp = (n: number | null | undefined) => (n != null && n > 0 ? formatRupiah(Math.round(n)) : null);
const x2 = (n: number) => `${n.toFixed(2)}×`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function buildEarlyBullishReview(i: EarlyBullishInput): EarlyBullishReview {
  const ch = detectChartChange(i.bars);
  const missingData: string[] = [];
  const hasEmas = i.ema20 > 0 && i.ema50 > 0;
  const hasEma200 = i.bars.length >= 200 && i.ema200 > 0;
  const hasRsi = Number.isFinite(i.rsi14) && i.rsi14 > 0;
  const hasMacd = Number.isFinite(i.macdValue) && Number.isFinite(i.macdSignal);
  if (!hasEmas) missingData.push('EMA20/EMA50');
  if (!hasEma200) missingData.push('EMA200 (riwayat < 200 bar)');
  if (!ch.available) missingData.push('riwayat harga < 60 bar (perubahan tren/momentum tidak terbaca)');
  if (!hasRsi) missingData.push('RSI');
  if (!hasMacd) missingData.push('MACD');
  if (i.rvol == null) missingData.push('volume rata-rata');

  const ema20Txt = rp(i.ema20);
  const ema50Txt = rp(i.ema50);
  const ema200Txt = rp(i.ema200);
  const distEma20 = i.ema20 > 0 ? ((i.price - i.ema20) / i.ema20) * 100 : null;
  const stretched = (distEma20 ?? 0) >= STRETCH_EMA20_PCT || (ch.runFromLowPct ?? 0) >= STRETCH_RUN_FROM_LOW_PCT ||
    i.rsi14 >= 80 || i.changePct >= 10;
  const aboveEma20 = hasEmas && i.price > i.ema20;

  // ── 1. TREND
  let trend: Component<TrendClass>;
  if (!hasEmas) {
    trend = { status: 'UNKNOWN', reason: 'Data EMA20/EMA50 tidak tersedia.' };
  } else {
    const stack = `harga ${i.price > i.ema20 ? '>' : '<'} EMA20 ${ema20Txt}, EMA20 ${i.ema20 > i.ema50 ? '>' : '<'} EMA50 ${ema50Txt}`;
    const e200 = hasEma200 ? `, ${i.price > i.ema200 ? 'di atas' : 'di bawah'} EMA200 ${ema200Txt}` : '';
    const freshChange = ch.emaCrossUp || ch.reclaimedEma20 || ch.reclaimedEma50;
    const fullStack = i.price > i.ema20 && i.ema20 > i.ema50 && (!hasEma200 || i.price > i.ema200);
    if (aboveEma20 && stretched) {
      trend = { status: 'EXTENDED', reason: `Naik terlalu jauh/cepat — ${distEma20 != null ? `${distEma20.toFixed(0)}% di atas EMA20` : 'harga meregang'}${ch.runFromLowPct != null ? `, +${ch.runFromLowPct.toFixed(0)}% dari low 20 hari` : ''}.` };
    } else if (aboveEma20 && (freshChange || (ch.ema20Rising && i.ema20 <= i.ema50))) {
      const what = ch.emaCrossUp ? 'EMA20 baru cross-up EMA50' : ch.reclaimedEma50 ? 'harga baru merebut kembali EMA50' : ch.reclaimedEma20 ? 'harga baru merebut kembali EMA20' : 'EMA20 mulai menanjak';
      trend = { status: 'EARLY_BULLISH', reason: `${cap(what)} (${stack}${e200}).` };
    } else if (fullStack && (ch.ema20Rising || !ch.available)) {
      trend = { status: 'BULLISH', reason: `Tren naik sudah terbentuk (${stack}${e200}).` };
    } else if (aboveEma20 || ch.stoppedFalling) {
      trend = { status: 'STABILIZING', reason: `Berhenti membuat lower low, arah belum naik (${stack}${e200}).` };
    } else {
      trend = { status: 'BEARISH', reason: `Masih turun (${stack}${e200})${ch.available && !ch.stoppedFalling ? ' dan masih membuat lower low' : ''}.` };
    }
  }

  // ── 2. MOMENTUM (change first)
  let momentum: Component<MomentumClass>;
  if (!hasRsi || !hasMacd) {
    momentum = { status: 'UNKNOWN', reason: `Data ${!hasRsi ? 'RSI' : 'MACD'} tidak tersedia.` };
  } else {
    const macdAbove = i.macdValue >= i.macdSignal;
    const improving: string[] = [];
    if (i.macdSignalType === 'bullish_crossover' || (ch.macdTurnedUp && macdAbove)) improving.push('MACD cross-up');
    else if (ch.macdTurnedUp) improving.push('histogram MACD menanjak');
    if (ch.rsiWeakRecovery) improving.push(`RSI naik dari area lemah ke ${i.rsi14.toFixed(0)}`);
    else if (ch.rsiCrossed50) improving.push(`RSI menembus 50 (${i.rsi14.toFixed(0)})`);
    const oversold = i.rsi14 < 30 ? ' RSI oversold — bukan sinyal beli.' : '';
    if (improving.length > 0 && i.rsi14 < 75) {
      momentum = {
        status: 'MEMBAIK',
        reason: `${cap(improving.join(', '))}${macdAbove ? '' : ' — MACD masih di bawah signal, belum bullish penuh'}.${oversold}`,
      };
    } else if (macdAbove && i.rsi14 >= 50) {
      momentum = { status: 'BULLISH', reason: `MACD di atas signal, RSI ${i.rsi14.toFixed(0)}${i.rsi14 >= 70 ? ' (overbought)' : ''} — sudah kuat, bukan perubahan baru.` };
    } else if (i.macdSignalType === 'bearish_crossover' || (!macdAbove && i.rsi14 < 45)) {
      momentum = { status: 'MELEMAH', reason: `MACD di bawah signal, RSI ${i.rsi14.toFixed(0)}.${oversold}` };
    } else {
      momentum = { status: 'NETRAL', reason: `RSI ${i.rsi14.toFixed(0)}, MACD ${macdAbove ? 'di atas' : 'di bawah'} signal — belum ada perubahan berarti.${oversold}` };
    }
  }

  // ── 3. BUYER / VOLUME
  let buyer: Component<BuyerClass>;
  const ratio = ch.upDownVolumeRatio;
  if (i.rvol == null && ratio == null) {
    buyer = { status: 'UNKNOWN', reason: 'Data volume rata-rata tidak tersedia.' };
  } else {
    const rvol = i.rvol ?? 0;
    const cp = i.closePosition;
    const volTxt = `Volume ${i.rvol != null ? x2(i.rvol) : '–'} rata-rata${cp != null ? `, close di ${Math.round(cp * 100)}% range` : ''}${ratio != null && Number.isFinite(ratio) ? `, volume naik/turun 10 hari ${x2(ratio)}` : ''}`;
    if (i.isStrongDistribution || (i.changePct < 0 && rvol >= BUYER_RVOL) || (ratio != null && ratio < 0.7) || (rvol >= BUYER_RVOL && cp != null && cp < 0.3)) {
      buyer = { status: 'SELLER_DOMINAN', reason: `${volTxt} — ${rvol >= BUYER_RVOL ? 'volume besar tapi dikuasai penjual' : 'penjual lebih dominan'}.` };
    } else if ((i.changePct > 0 && rvol >= BUYER_RVOL && (cp == null || cp >= 0.5)) || (ratio != null && ratio >= 1.3)) {
      buyer = { status: 'BUYER_DOMINAN', reason: `${volTxt} — buyer mulai dominan.` };
    } else {
      buyer = { status: 'NETRAL', reason: `${volTxt} — belum ada dominasi buyer${rvol >= BUYER_RVOL ? ' (volume besar saja bukan sinyal beli)' : ''}.` };
    }
  }

  // ── 4. PRICE ACTION
  const resistanceTxt = rp(i.resistance);
  const bullishCandle = i.candlePattern === 'bullish_engulfing' || i.candlePattern === 'hammer' || i.candlePattern === 'marubozu_bullish';
  const supportLevel = i.support ?? (i.entryZoneLow > 0 ? i.entryZoneLow : null);
  const supportTxt = rp(supportLevel);
  const nearSupport = supportLevel != null && i.price <= supportLevel * (1 + NEAR_LEVEL_PCT / 100);
  let priceAction: Component<PriceActionClass>;
  if (!ch.available) {
    priceAction = { status: 'UNKNOWN', reason: 'Riwayat harga belum cukup untuk membaca struktur.' };
  } else if (ch.breakdown) {
    priceAction = { status: 'BREAKDOWN', reason: 'Close di bawah low 20 hari — struktur rusak.' };
  } else if (ch.lowerHighLowerLow && !ch.reclaimedEma20) {
    priceAction = { status: 'LOWER_HIGH_LOW', reason: 'High & low 10 hari terakhir lebih rendah dari sebelumnya — struktur turun.' };
  } else if (ch.rejection) {
    priceAction = { status: 'REJECTION', reason: `Ditolak di area high 20 hari${resistanceTxt ? ` / ${resistanceTxt}` : ''} — ekor atas panjang, close di bawah tengah range.` };
  } else if (ch.retestLevel != null) {
    priceAction = { status: 'BREAKOUT_RETEST', reason: `Breakout ${rp(ch.retestLevel)} lalu retest dan bertahan di atasnya.` };
  } else if (ch.breakoutLevel != null || i.moveType === 'BREAKOUT') {
    const level = rp(ch.breakoutLevel) ?? resistanceTxt;
    priceAction = { status: 'BREAKOUT', reason: `Close menembus ${level ? `resistance ${level}` : 'high 20 hari'} — belum diuji retest.` };
  } else if (bullishCandle && nearSupport) {
    priceAction = { status: 'REVERSAL', reason: `Candle reversal (${i.candlePattern.replace('_', ' ')}) di dekat support ${supportTxt}.` };
  } else if ((ch.higherLowStructure || i.higherLows) && ch.stoppedFalling) {
    priceAction = { status: 'HIGHER_LOW', reason: 'Low 10 hari terakhir lebih tinggi dari sebelumnya — terbentuk higher low.' };
  } else {
    priceAction = { status: 'NONE', reason: 'Belum ada reversal, higher low, atau breakout yang jelas.' };
  }

  // ── 5. ENTRY — distance above the entry reference (breakout level for breakouts, else zone top).
  const breakoutRef = priceAction.status === 'BREAKOUT_RETEST' ? ch.retestLevel : priceAction.status === 'BREAKOUT' ? ch.breakoutLevel : null;
  const entryRef = breakoutRef ?? (i.entryZoneHigh > 0 ? i.entryZoneHigh : supportLevel);
  const entryDistancePct = entryRef != null && entryRef > 0 ? ((i.price - entryRef) / entryRef) * 100 : null;
  const refTxt = breakoutRef != null ? `level breakout ${rp(breakoutRef)}` : `area entry ${rp(entryRef) ?? ''}`;
  let entry: Component<EntryClass>;
  if (entryDistancePct == null) {
    entry = { status: 'UNKNOWN', reason: 'Area entry/support tidak tersedia.' };
  } else if (trend.status === 'EXTENDED' || entryDistancePct > ENTRY_CAUTION_MAX_PCT || i.chaseRisk === 'HIGH') {
    entry = { status: 'EXTENDED', reason: `Harga ${entryDistancePct.toFixed(1)}% di atas ${refTxt} — sudah terlalu jauh.` };
  } else if (entryDistancePct > ENTRY_VALID_MAX_PCT) {
    entry = { status: 'CAUTION', reason: `Harga ${entryDistancePct.toFixed(1)}% di atas ${refTxt} — mulai menjauh.` };
  } else {
    entry = { status: 'VALID', reason: entryDistancePct <= 0 ? `Harga di dalam/di bawah ${refTxt}.` : `Harga hanya ${entryDistancePct.toFixed(1)}% di atas ${refTxt}.` };
  }

  // ── 6. RISK
  const fomo: RiskLevel3 = entry.status === 'EXTENDED' || i.chaseRisk === 'HIGH' || stretched ? 'HIGH'
    : entry.status === 'CAUTION' || i.chaseRisk === 'MEDIUM' ? 'MEDIUM' : 'LOW';
  const high: string[] = [];
  const medium: string[] = [];
  if (fomo === 'HIGH') high.push('FOMO/chase tinggi'); else if (fomo === 'MEDIUM') medium.push('FOMO sedang');
  if (i.eventRisk === 'HIGH') high.push('event risk tinggi'); else if (i.eventRisk === 'MEDIUM') medium.push('ada event risk');
  if (i.trendRisk === 'HIGH') high.push('risiko tren utama tinggi'); else if (i.trendRisk === 'MEDIUM') medium.push('tren utama belum mendukung');
  if (i.isStrongDistribution) high.push('distribusi kuat');
  if (i.setupInvalidated) high.push('setup sudah invalid');
  const coreMissing = missingData.filter((d) => !d.startsWith('EMA200'));
  if (coreMissing.length > 0) medium.push(`data tidak lengkap: ${coreMissing.join(', ')}`);
  const riskLevel: RiskLevel3 = high.length > 0 ? 'HIGH' : medium.length > 0 ? 'MEDIUM' : 'LOW';
  const risk = { level: riskLevel, reasons: [...high, ...medium] };

  // ── BUY TRIGGER (only REVERSAL or BREAKOUT)
  const supportHeld = supportLevel != null && ch.low5 != null && i.price > supportLevel &&
    ch.low5 >= supportLevel * (1 - SUPPORT_HOLD_TOLERANCE_PCT / 100);
  const buyerIn = buyer.status === 'BUYER_DOMINAN';
  const reversalTrigger = (priceAction.status === 'REVERSAL' || priceAction.status === 'HIGHER_LOW') && supportHeld && buyerIn;
  const breakoutTrigger =
    (priceAction.status === 'BREAKOUT_RETEST' && (ch.retestBreakoutVolRatio ?? 0) >= 1.3 && buyer.status !== 'SELLER_DOMINAN') ||
    (priceAction.status === 'BREAKOUT' && buyerIn && (i.closePosition ?? 0) >= 0.6);
  const triggerType: BuyTriggerType | null = breakoutTrigger ? 'BREAKOUT' : reversalTrigger ? 'REVERSAL' : null;

  // ── BULLISH TRANSITION: trend + momentum + buyers + price action all improving.
  const trendImproving = trend.status === 'EARLY_BULLISH' || (trend.status === 'BULLISH' && momentum.status === 'MEMBAIK');
  const momentumImproving = momentum.status === 'MEMBAIK' || momentum.status === 'BULLISH';
  const paImproving = ['REVERSAL', 'HIGHER_LOW', 'BREAKOUT', 'BREAKOUT_RETEST'].includes(priceAction.status);
  const bullishTransition = trendImproving && momentumImproving && buyerIn && paImproving;

  const volTarget = i.volumeMa20 > 0 ? ` (≥ ${formatCompact(Math.round(i.volumeMa20 * BUYER_RVOL))} lbr)` : '';

  // ── CONFIRMATION HIERARCHY ────────────────────────────────────────────────
  // 1. SETUP / EARLY BULLISH — all 3 conditions required; a valid setup is never a BUY by itself.
  const rsiAbove50 = hasRsi && i.rsi14 > 50;
  const higherLowOrReversal = ch.higherLowStructure || i.higherLows || (bullishCandle && nearSupport) ||
    priceAction.status === 'REVERSAL' || priceAction.status === 'HIGHER_LOW' || priceAction.status === 'BREAKOUT_RETEST';
  const setupChecks: HierarchyCheck[] = [
    { label: `Harga > EMA20${ema20Txt ? ` ${ema20Txt}` : ''}`, ok: aboveEma20 },
    { label: 'Higher low / bullish reversal', ok: higherLowOrReversal },
    { label: `RSI > 50 atau momentum membaik${hasRsi ? ` (RSI ${i.rsi14.toFixed(0)})` : ''}`, ok: rsiAbove50 || momentum.status === 'MEMBAIK' },
  ];
  const setupScore = setupChecks.filter((c) => c.ok).length;
  const setup: HierarchyScore = {
    score: setupScore, max: setupChecks.length, required: setupChecks.length,
    valid: setupScore === setupChecks.length, checks: setupChecks,
  };

  // 2. CONFIRMATION — at least 3 independent confirmations on top of a valid setup.
  const recentCloses = i.bars.slice(-HELD_ABOVE_EMA20_BARS).map((b) => b.close);
  const heldAboveEma20 = hasEmas && recentCloses.length === HELD_ABOVE_EMA20_BARS && recentCloses.every((c) => c > i.ema20);
  const validHigherLow = ch.available && (ch.higherLowStructure || i.higherLows) && ch.stoppedFalling && !ch.lowerHighLowerLow;
  const macdImproving = hasMacd && (i.macdSignalType === 'bullish_crossover' || ch.macdTurnedUp);
  const volumeConfirmed = (i.rvol ?? 0) >= BUYER_RVOL;
  const strongBreakout = priceAction.status === 'BREAKOUT_RETEST' ||
    (priceAction.status === 'BREAKOUT' && (i.closePosition ?? 0) >= STRONG_CLOSE_POSITION);
  const confirmationChecks: HierarchyCheck[] = [
    { label: `Bertahan di atas EMA20 (${HELD_ABOVE_EMA20_BARS} close terakhir)`, ok: heldAboveEma20 },
    { label: 'Higher low valid', ok: validHigherLow },
    { label: 'MACD bullish cross / histogram membaik', ok: macdImproving },
    { label: `RSI > 50${hasRsi ? ` (${i.rsi14.toFixed(0)})` : ''}`, ok: rsiAbove50 },
    { label: `Volume ≥ ${BUYER_RVOL}× rata-rata${i.rvol != null ? ` (${x2(i.rvol)})` : ''}${volTarget}`, ok: volumeConfirmed },
    { label: `Breakout resistance${resistanceTxt ? ` ${resistanceTxt}` : ''} dengan close kuat`, ok: strongBreakout },
  ];
  const confirmationScore = confirmationChecks.filter((c) => c.ok).length;
  const confirmation: HierarchyScore = {
    score: confirmationScore, max: confirmationChecks.length, required: CONFIRMATION_REQUIRED,
    valid: setup.valid && confirmationScore >= CONFIRMATION_REQUIRED, checks: confirmationChecks,
  };

  // 4. INVALIDATION — close under the stop loss / nearest support cancels any earlier bullish setup.
  const stopLoss = i.stopLoss != null && i.stopLoss > 0 ? i.stopLoss : null;
  const stopBroken = i.setupInvalidated || (stopLoss != null && i.price <= stopLoss);
  const supportBroken = i.support != null && i.support > 0 && i.price < i.support;
  const invalidated = stopBroken || supportBroken;
  const brokenLevel = stopBroken ? stopLoss : supportBroken ? i.support : null;
  const slValid = stopLoss != null && stopLoss < i.price;
  const invalidationLevel = invalidated ? brokenLevel
    : slValid ? stopLoss : supportLevel != null && supportLevel < i.price ? supportLevel : null;
  const stopPct = slValid ? ((i.price - stopLoss) / i.price) * 100 : null;
  const riskRewardRatio = slValid && i.target != null && i.target > i.price ? (i.target - i.price) / (i.price - stopLoss) : null;

  // 5. RISK GATE — only PASS allows BUY; CAUTION and BLOCK both withhold permission.
  // Unknown EMA200 (history < 200 bars) is reported in missingData, not as a gate reason — otherwise
  // the default 6-month history would make BUY impossible.
  const block: string[] = [];
  const caution: string[] = [];
  if (hasEma200 && i.price < i.ema200) block.push(`harga di bawah EMA200 ${ema200Txt}`);
  if (hasMacd && i.macdValue < i.macdSignal) block.push('MACD masih bearish (di bawah signal)');
  if (i.eventRisk === 'HIGH') block.push('event risk tinggi'); else if (i.eventRisk === 'MEDIUM') caution.push('ada event risk');
  if (i.rvol != null && i.rvol < WEAK_VOLUME_RVOL) block.push(`volume lemah (${x2(i.rvol)} rata-rata)`);
  if (distEma20 != null && distEma20 > EMA20_BLOCK_PCT) block.push(`harga terlalu jauh dari EMA20 (+${distEma20.toFixed(1)}%)`);
  else if (stretched || fomo === 'HIGH') block.push('harga sudah extended / rawan chasing');
  else if (distEma20 != null && distEma20 > EMA20_CAUTION_PCT) caution.push(`harga mulai menjauh dari EMA20 (+${distEma20.toFixed(1)}%)`);
  if (i.isStrongDistribution) block.push('distribusi kuat');
  if (buyer.status === 'SELLER_DOMINAN') block.push('seller dominan');
  if (priceAction.status === 'REJECTION') block.push('rejection di area resistance');
  if (i.baseTradeStatus === 'NO_TRADE') block.push('Risk Gate utama menolak (NO TRADE)');
  if (i.trendRisk === 'HIGH') block.push('risiko tren utama tinggi'); else if (i.trendRisk === 'MEDIUM') caution.push('tren utama belum mendukung');
  if (fomo === 'MEDIUM') caution.push('FOMO sedang');
  if (coreMissing.length > 0) caution.push(`data tidak lengkap: ${coreMissing.join(', ')}`);
  const riskGate = { status: (block.length > 0 ? 'BLOCK' : caution.length > 0 ? 'CAUTION' : 'PASS') as RiskGateStatus, block, caution };

  // Technical stage — a BLOCK gate downgrades CONFIRMED to EARLY BULLISH; a broken structure to WAIT.
  const structureBroken = priceAction.status === 'BREAKDOWN' || priceAction.status === 'LOWER_HIGH_LOW' ||
    i.isStrongDistribution || i.setupInvalidated || (trend.status === 'BEARISH' && !bullishTransition);
  let stage: TechnicalStage = invalidated ? 'INVALIDATED'
    : structureBroken ? 'WAIT'
      : confirmation.valid ? 'CONFIRMED_BULLISH'
        : setup.valid ? 'EARLY_BULLISH' : 'WAIT';
  if (stage === 'CONFIRMED_BULLISH' && riskGate.status === 'BLOCK') stage = 'EARLY_BULLISH';

  // 3. BUY PERMISSION — confirmed + gate PASS + no chasing + clear invalidation + valid SL & R/R.
  const permissionGaps: string[] = [];
  if (entry.status !== 'VALID') {
    permissionGaps.push(entry.status === 'UNKNOWN' ? 'area entry belum jelas'
      : `harga kembali dekat ${refTxt} (entry ${ENTRY_CLASS_LABEL[entry.status]} — jangan kejar)`);
  }
  if (!slValid) permissionGaps.push('stop loss / invalidasi belum jelas');
  else if (stopPct != null && stopPct > MAX_STOP_LOSS_PCT) permissionGaps.push(`stop loss terlalu lebar (${stopPct.toFixed(1)}% > ${MAX_STOP_LOSS_PCT}%)`);
  if (riskRewardRatio == null) permissionGaps.push('target / risk-reward belum tersedia');
  else if (riskRewardRatio < MIN_RISK_REWARD) permissionGaps.push(`risk/reward 1:${riskRewardRatio.toFixed(1)} < 1:${MIN_RISK_REWARD}`);
  const buyPermission = stage === 'CONFIRMED_BULLISH' && riskGate.status === 'PASS' && permissionGaps.length === 0;

  // Triggers still missing before BUY permission.
  const missingTriggers: string[] = [];
  if (invalidated) {
    missingTriggers.push(`Close kembali di atas ${rp(brokenLevel) ?? 'level invalidasi'} dan bentuk setup baru`);
  } else if (!buyPermission) {
    if (!setup.valid) setup.checks.filter((c) => !c.ok).forEach((c) => missingTriggers.push(`Setup: ${c.label}`));
    const need = Math.max(0, CONFIRMATION_REQUIRED - confirmation.score);
    if (need > 0) {
      const unmet = confirmation.checks.filter((c) => !c.ok).map((c) => c.label);
      missingTriggers.push(`Konfirmasi: butuh ${need} lagi dari — ${unmet.join(' · ')}`);
    }
    block.forEach((r) => missingTriggers.push(`Risk Gate (BLOCK): ${r}`));
    caution.forEach((r) => missingTriggers.push(`Risk Gate (CAUTION): ${r}`));
    permissionGaps.forEach((g) => missingTriggers.push(`Buy permission: ${g}`));
  }

  // ── DECISION (legacy BUY / WAIT / NO TRADE line, driven by the hierarchy above)
  let decision: EbDecision;
  let tag: EbDecisionTag;
  const isExtended = trend.status === 'EXTENDED' || entry.status === 'EXTENDED' || fomo === 'HIGH';
  if (i.eventRisk === 'HIGH') {
    decision = 'NO_TRADE'; tag = 'EVENT_RISK';
  } else if (invalidated) {
    // Previous BUY is cancelled → WAIT (a NO TRADE from the shared review is never upgraded).
    decision = i.baseTradeStatus === 'NO_TRADE' ? 'NO_TRADE' : 'WAIT'; tag = 'INVALIDATED';
  } else if (structureBroken) {
    decision = 'NO_TRADE'; tag = 'BEARISH';
  } else if (i.baseTradeStatus === 'NO_TRADE') {
    decision = 'NO_TRADE'; tag = 'HIGH_RISK';
  } else if (buyPermission) {
    decision = 'BUY'; tag = 'CONFIRMED_BULLISH';
  } else {
    decision = 'WAIT';
    tag = isExtended ? 'EXTENDED'
      : stage === 'CONFIRMED_BULLISH' ? 'CONFIRMED_BULLISH'
        : stage === 'EARLY_BULLISH' ? 'EARLY_BULLISH'
          : trend.status === 'UNKNOWN' ? 'DATA_KURANG' : trend.status === 'BULLISH' ? 'BULLISH' : 'STABILIZING';
  }

  // ── WHY (max 2–3 sentences) + BUY TRIGGER text
  const reversalPath = `REVERSAL — support ${supportTxt ?? 'terdekat'} bertahan, muncul higher low/candle reversal, dan volume beli ≥${BUYER_RVOL}× rata-rata${volTarget}`;
  const breakoutPath = `BREAKOUT — close di atas resistance ${resistanceTxt ?? 'terdekat'} dengan volume ≥${BUYER_RVOL}× rata-rata${volTarget}, lalu bertahan/retest di atasnya`;
  const nearResistance = i.resistance != null && i.price >= i.resistance * (1 - NEAR_LEVEL_PCT / 100) && i.price < i.resistance;
  const paths = nearResistance ? [breakoutPath] : nearSupport ? [reversalPath] : [reversalPath, breakoutPath];
  const prereq: string[] = [];
  if (trend.status === 'BEARISH' || trend.status === 'STABILIZING') prereq.push(`close di atas EMA20${ema20Txt ? ` ${ema20Txt}` : ''}`);
  if (momentum.status === 'NETRAL' || momentum.status === 'MELEMAH') prereq.push('MACD cross-up di atas signal atau RSI naik menembus 50');
  if (entry.status === 'CAUTION') prereq.push(`harga kembali dekat area entry ${rp(entryRef) ?? ''}`.trim());
  const pathTxt = paths.length > 1 ? `salah satu trigger: (1) ${paths[0]}; (2) ${paths[1]}` : `trigger ${paths[0]}`;
  const scores = `setup ${setup.score}/${setup.max}, konfirmasi ${confirmation.score}/${confirmation.max}`;
  const gateTxt = riskGate.status === 'PASS' ? 'Risk Gate PASS'
    : `Risk Gate ${riskGate.status} (${(riskGate.status === 'BLOCK' ? block : caution).slice(0, 2).join(', ')})`;

  let why: string;
  let buyTrigger: string;
  if (decision === 'BUY') {
    why = `Setup valid dan terkonfirmasi (${scores}). ${gateTxt}, entry masih dekat area entry, invalidasi ${rp(invalidationLevel) ?? '–'} dengan R/R 1:${(riskRewardRatio ?? 0).toFixed(1)}.`;
    buyTrigger = triggerType === 'BREAKOUT'
      ? `Trigger aktif: BREAKOUT — ${rp(breakoutRef) ?? 'resistance'} ditembus dengan volume dan bertahan. Batal jika close di bawah ${rp(invalidationLevel) ?? 'level invalidasi'}.`
      : `Konfirmasi aktif: ${confirmation.checks.filter((c) => c.ok).map((c) => c.label).join(', ')}. Batal jika close di bawah ${rp(invalidationLevel) ?? 'level invalidasi'}.`;
  } else if (tag === 'EVENT_RISK') {
    why = 'Ada event berisiko tinggi — harga bisa bergerak liar tanpa pola teknikal. Tidak ada buy permission sampai event selesai.';
    buyTrigger = `Tunggu event selesai dan harga stabil, lalu ${pathTxt}.`;
  } else if (tag === 'INVALIDATED') {
    const levelTxt = [stopBroken ? 'stop loss' : 'support', rp(brokenLevel)].filter(Boolean).join(' ');
    why = `Previous bullish setup invalidated. Harga close di bawah ${levelTxt} — sinyal BUY sebelumnya dibatalkan, status kembali WAIT.`;
    buyTrigger = `Tunggu harga close kembali di atas ${rp(brokenLevel) ?? 'level invalidasi'}${ema20Txt ? ` / EMA20 ${ema20Txt}` : ''}, bentuk higher low baru, lalu kumpulkan ≥${CONFIRMATION_REQUIRED} konfirmasi.`;
  } else if (tag === 'BEARISH') {
    why = priceAction.status === 'BREAKDOWN' || priceAction.status === 'LOWER_HIGH_LOW'
      ? `Struktur harga rusak (${PRICE_ACTION_CLASS_LABEL[priceAction.status].toLowerCase()}).`
      : i.isStrongDistribution ? 'Distribusi kuat — penjual masih menguasai.' : 'Tren masih bearish tanpa tanda transisi.';
    buyTrigger = `Tunggu harga berhenti membuat lower low dan close di atas EMA20${ema20Txt ? ` ${ema20Txt}` : ''}, lalu ${pathTxt}.`;
  } else if (tag === 'HIGH_RISK') {
    why = 'Risk Gate menolak setup ini — risiko terlalu tinggi untuk entry.';
    buyTrigger = `Tunggu risiko mereda, lalu ${pathTxt}.`;
  } else if (tag === 'EXTENDED') {
    why = `Harga sudah naik terlalu jauh${entryDistancePct != null && entryDistancePct > 0 ? ` (${entryDistancePct.toFixed(0)}% dari ${refTxt})` : ''} — entry sekarang sama dengan mengejar harga. Stage ${TECHNICAL_STAGE_LABEL[stage]} (${scores}), buy permission belum diberikan.`;
    buyTrigger = `Tunggu pullback ke area ${rp(i.entryZoneHigh) ?? supportTxt ?? 'entry'}${ema20Txt ? ` / EMA20 ${ema20Txt}` : ''} yang bertahan, lalu ${reversalPath}.`;
  } else {
    if (stage === 'CONFIRMED_BULLISH') {
      const gaps = [...(riskGate.status !== 'PASS' ? [gateTxt] : []), ...permissionGaps].slice(0, 2);
      why = `Setup terkonfirmasi (${scores}), tapi buy permission belum diberikan: ${gaps.join(', ')}. Bullish signal ≠ buy permission.`;
    } else if (stage === 'EARLY_BULLISH') {
      why = confirmation.score >= CONFIRMATION_REQUIRED
        ? `Setup early bullish dengan konfirmasi cukup (${scores}), tapi ${gateTxt}. Bullish signal ≠ buy permission.`
        : `Setup early bullish terbentuk (${scores}), tapi konfirmasi belum cukup (butuh ≥${CONFIRMATION_REQUIRED}). Bullish signal ≠ buy permission.`;
    } else {
      const unmet = setup.checks.filter((c) => !c.ok).map((c) => c.label.toLowerCase());
      why = `Setup belum valid (${scores})${unmet.length ? `: kurang ${unmet.slice(0, 3).join(', ')}` : ''}.`;
    }
    buyTrigger = `${prereq.length > 0 ? `${cap(prereq.join(', '))}, lalu ` : ''}${prereq.length > 0 ? pathTxt : cap(pathTxt)}; BUY baru diizinkan setelah ≥${CONFIRMATION_REQUIRED} konfirmasi dan Risk Gate tidak BLOCK.`;
  }

  return {
    price: i.price,
    trend,
    momentum,
    buyer,
    priceAction,
    entry,
    fomo,
    risk,
    bullishTransition,
    triggerType,
    decision,
    tag,
    why,
    buyTrigger,
    missingData,
    entryDistancePct,
    hasEma200,
    stage,
    buyPermission: decision === 'BUY',
    setup,
    confirmation,
    riskGate,
    missingTriggers,
    invalidationLevel,
    riskRewardRatio,
  };
}

export function ebDecisionLine(r: EarlyBullishReview): string {
  return `${EB_DECISION_LABEL[r.decision]} — ${EB_DECISION_TAG_LABEL[r.tag]}`;
}

/** Plain-text OUTPUT RINGKAS for copy/share. */
export function formatEarlyBullishReview(ticker: string, r: EarlyBullishReview, extra: string[] = []): string {
  return [
    `${ticker} — ${rp(r.price) ?? '–'}`,
    '',
    '📈 TREND',
    `${TREND_CLASS_LABEL[r.trend.status]} — ${r.trend.reason}`,
    '',
    '⚡ MOMENTUM',
    `${MOMENTUM_CLASS_LABEL[r.momentum.status]} — ${r.momentum.reason}`,
    '',
    '📊 BUYER/VOLUME',
    `${BUYER_CLASS_LABEL[r.buyer.status]} — ${r.buyer.reason}`,
    '',
    '📐 PRICE ACTION',
    `${PRICE_ACTION_CLASS_LABEL[r.priceAction.status]} — ${r.priceAction.reason}`,
    '',
    '🎯 ENTRY',
    `${ENTRY_CLASS_LABEL[r.entry.status]} — ${r.entry.reason}`,
    '',
    '⚠️ RISK',
    `${r.risk.level}${r.risk.reasons.length ? ` — ${r.risk.reasons.join(', ')}` : ''}`,
    '',
    '🪜 CONFIRMATION HIERARCHY',
    `Technical Stage: ${TECHNICAL_STAGE_LABEL[r.stage]}`,
    `Buy Permission: ${r.buyPermission ? 'YES' : 'NO'}`,
    `Setup Score: ${r.setup.score}/${r.setup.max} (min ${r.setup.required})`,
    `Confirmation Score: ${r.confirmation.score}/${r.confirmation.max} (min ${r.confirmation.required})`,
    `✓ Terpenuhi: ${r.confirmation.checks.filter((c) => c.ok).map((c) => c.label).join(' · ') || '–'}`,
    `✗ Kurang: ${r.confirmation.checks.filter((c) => !c.ok).map((c) => c.label).join(' · ') || '–'}`,
    `Risk Gate: ${r.riskGate.status}${r.riskGate.block.length ? ` — ${r.riskGate.block.join(', ')}` : r.riskGate.caution.length ? ` — ${r.riskGate.caution.join(', ')}` : ''}`,
    `Invalidation: ${rp(r.invalidationLevel) ?? '–'}`,
    ...(r.missingTriggers.length ? ['Trigger yang masih kurang:', ...r.missingTriggers.map((t) => `- ${t}`)] : []),
    '',
    '🎯 DECISION',
    ebDecisionLine(r),
    r.why,
    '',
    '⏳ BUY TRIGGER',
    r.buyTrigger,
    ...(extra.length ? ['', ...extra] : []),
  ].join('\n');
}
