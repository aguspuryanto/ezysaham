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
 * BULLISH TRANSITION = trend improving + momentum improving + buyers supportive + price action improving.
 * BUY only if: transition AND a BUY trigger is active AND entry VALID AND FOMO not HIGH AND risk ≠ HIGH.
 * BUY triggers: REVERSAL (support holds + higher low/reversal + buyers in) or BREAKOUT (resistance
 * broken + volume + price holds/retests). Every WAIT states the concrete trigger that turns it into BUY.
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
export type EbDecisionTag = 'EARLY_BULLISH' | 'BULLISH' | 'STABILIZING' | 'EXTENDED' | 'BEARISH' | 'EVENT_RISK' | 'HIGH_RISK' | 'FUNDAMENTAL' | 'DATA_KURANG';
export type BuyTriggerType = 'REVERSAL' | 'BREAKOUT';

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
  EARLY_BULLISH: 'EARLY BULLISH', BULLISH: 'BULLISH', STABILIZING: 'STABILIZING', EXTENDED: 'EXTENDED', BEARISH: 'BEARISH',
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

  // ── DECISION
  const structureBroken = priceAction.status === 'BREAKDOWN' || priceAction.status === 'LOWER_HIGH_LOW' ||
    i.isStrongDistribution || i.setupInvalidated || (trend.status === 'BEARISH' && !bullishTransition);
  let decision: EbDecision;
  let tag: EbDecisionTag;
  if (i.eventRisk === 'HIGH') {
    decision = 'NO_TRADE'; tag = 'EVENT_RISK';
  } else if (structureBroken) {
    decision = 'NO_TRADE'; tag = 'BEARISH';
  } else if (i.baseTradeStatus === 'NO_TRADE') {
    decision = 'NO_TRADE'; tag = 'HIGH_RISK';
  } else if (trend.status === 'EXTENDED' || entry.status === 'EXTENDED' || fomo === 'HIGH') {
    decision = 'WAIT'; tag = 'EXTENDED';
  } else if (bullishTransition) {
    tag = 'EARLY_BULLISH';
    decision = triggerType != null && entry.status === 'VALID' && risk.level !== 'HIGH' ? 'BUY' : 'WAIT';
  } else {
    decision = 'WAIT';
    tag = trend.status === 'UNKNOWN' ? 'DATA_KURANG' : trend.status === 'BULLISH' ? 'BULLISH' : trend.status === 'EARLY_BULLISH' ? 'EARLY_BULLISH' : 'STABILIZING';
  }

  // ── WHY + BUY TRIGGER text
  const volTarget = i.volumeMa20 > 0 ? ` (≥ ${formatCompact(Math.round(i.volumeMa20 * BUYER_RVOL))} lbr)` : '';
  const reversalPath = `REVERSAL — support ${supportTxt ?? 'terdekat'} bertahan, muncul higher low/candle reversal, dan volume beli ≥${BUYER_RVOL}× rata-rata${volTarget}`;
  const breakoutPath = `BREAKOUT — close di atas resistance ${resistanceTxt ?? 'terdekat'} dengan volume ≥${BUYER_RVOL}× rata-rata${volTarget}, lalu bertahan/retest di atasnya`;
  const nearResistance = i.resistance != null && i.price >= i.resistance * (1 - NEAR_LEVEL_PCT / 100) && i.price < i.resistance;
  const paths = nearResistance ? [breakoutPath] : nearSupport ? [reversalPath] : [reversalPath, breakoutPath];
  const prereq: string[] = [];
  if (trend.status === 'BEARISH' || trend.status === 'STABILIZING') prereq.push(`close di atas EMA20${ema20Txt ? ` ${ema20Txt}` : ''}`);
  if (momentum.status === 'NETRAL' || momentum.status === 'MELEMAH') prereq.push('MACD cross-up di atas signal atau RSI naik menembus 50');
  if (entry.status === 'CAUTION') prereq.push(`harga kembali dekat area entry ${rp(entryRef) ?? ''}`.trim());
  const pathTxt = paths.length > 1 ? `salah satu trigger: (1) ${paths[0]}; (2) ${paths[1]}` : `trigger ${paths[0]}`;

  let why: string;
  let buyTrigger: string;
  if (decision === 'BUY') {
    why = `Transisi bullish terkonfirmasi (tren ${TREND_CLASS_LABEL[trend.status].toLowerCase()}, momentum ${MOMENTUM_CLASS_LABEL[momentum.status].toLowerCase()}, buyer dominan, ${PRICE_ACTION_CLASS_LABEL[priceAction.status].toLowerCase()}), entry masih valid dan risiko ${risk.level.toLowerCase()}.`;
    buyTrigger = triggerType === 'BREAKOUT'
      ? `Trigger aktif: BREAKOUT — ${rp(breakoutRef) ?? 'resistance'} ditembus dengan volume dan bertahan. Batal jika close kembali di bawah ${rp(breakoutRef) ?? 'level breakout'}.`
      : `Trigger aktif: REVERSAL — support ${supportTxt ?? ''} bertahan + ${priceAction.status === 'REVERSAL' ? 'candle reversal' : 'higher low'} + buyer masuk. Batal jika close di bawah ${supportTxt ?? 'support'}.`;
  } else if (tag === 'EVENT_RISK') {
    why = 'Ada event berisiko tinggi — harga bisa bergerak liar tanpa pola teknikal.';
    buyTrigger = `Tunggu event selesai dan harga stabil, lalu ${pathTxt}.`;
  } else if (tag === 'BEARISH') {
    why = priceAction.status === 'BREAKDOWN' || priceAction.status === 'LOWER_HIGH_LOW'
      ? `Struktur harga rusak (${PRICE_ACTION_CLASS_LABEL[priceAction.status].toLowerCase()}).`
      : i.isStrongDistribution ? 'Distribusi kuat — penjual masih menguasai.'
        : i.setupInvalidated ? 'Harga sudah menembus batas setup.' : 'Tren masih bearish tanpa tanda transisi.';
    buyTrigger = `Tunggu harga berhenti membuat lower low dan close di atas EMA20${ema20Txt ? ` ${ema20Txt}` : ''}, lalu ${pathTxt}.`;
  } else if (tag === 'HIGH_RISK') {
    why = 'Risk Gate menolak setup ini — risiko terlalu tinggi untuk entry.';
    buyTrigger = `Tunggu risiko mereda, lalu ${pathTxt}.`;
  } else if (tag === 'EXTENDED') {
    why = `Harga sudah naik terlalu jauh${entryDistancePct != null && entryDistancePct > 0 ? ` (${entryDistancePct.toFixed(0)}% dari ${refTxt})` : ''} — entry sekarang sama dengan mengejar harga.`;
    buyTrigger = `Tunggu pullback ke area ${rp(i.entryZoneHigh) ?? supportTxt ?? 'entry'}${ema20Txt ? ` / EMA20 ${ema20Txt}` : ''} yang bertahan, lalu ${reversalPath}.`;
  } else {
    const missing: string[] = [];
    if (!trendImproving) missing.push(`tren ${TREND_CLASS_LABEL[trend.status].toLowerCase()}`);
    if (!momentumImproving) missing.push(`momentum ${MOMENTUM_CLASS_LABEL[momentum.status].toLowerCase()}`);
    if (!buyerIn) missing.push('buyer belum dominan');
    if (!paImproving) missing.push('price action belum membaik');
    if (bullishTransition && triggerType == null) missing.push('trigger belum aktif');
    if (bullishTransition && entry.status !== 'VALID') missing.push(`entry ${ENTRY_CLASS_LABEL[entry.status].toLowerCase()}`);
    if (bullishTransition && risk.level === 'HIGH') missing.push('risiko tinggi');
    why = bullishTransition
      ? `Transisi bullish terbentuk, tapi ${missing.join(', ')}.`
      : `Belum ada transisi bullish: ${missing.join(', ')}.`;
    buyTrigger = `${prereq.length > 0 ? `${cap(prereq.join(', '))}, lalu ` : ''}${prereq.length > 0 ? pathTxt : cap(pathTxt)}.`;
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
    '🎯 DECISION',
    ebDecisionLine(r),
    r.why,
    '',
    '⏳ BUY TRIGGER',
    r.buyTrigger,
    ...(extra.length ? ['', ...extra] : []),
  ].join('\n');
}
