/**
 * simpleEntryReview.ts
 *
 * EARLY BULLISH read for EquityResearchReportCardv4: find stocks that are STARTING to turn bullish
 * while the entry is still reasonable — never chase a stock that has already flown.
 *
 * Six reads, all weighted on CHANGE OF CONDITION rather than an indicator that is already bullish:
 *   1. Trend          — turning from bearish/sideways to bullish (EMA20/EMA50 reclaim, EMA20×EMA50 cross)?
 *   2. Momentum       — strengthening (MACD cross / histogram turning up, RSI crossing 50)?
 *   3. Volume         — buyers stepping in (today RVOL on an up day, or up-volume dominating the last 10 bars)?
 *   4. Price Action   — higher low, reversal candle, breakout, or breakout-retest?
 *   5. Entry Distance — price still close to the entry zone / EMA20?
 *   6. FOMO Risk      — has price run so far that entry is late?
 *
 * Phase:
 *   EARLY_BULLISH = bullish transition forming (≥2 change signals, price above EMA20) + not extended
 *   BULLISH       = trend + momentum already strong, entry validity still checked
 *   EXTENDED      = bullish but price too far → don't chase
 *   WAIT          = no BUY trigger yet
 *   NO_TRADE      = setup broken or risk too high
 *
 * BUY only if: fundamental acceptable AND bullish transition confirmed (EARLY_BULLISH/BULLISH)
 *   AND buyers/volume supportive AND entry still near AND FOMO not high AND a valid BUY trigger exists.
 * A WAIT always states the concrete trigger that would turn it into a BUY.
 * Holder actions: SELL = structure broken (breakdown / strong distribution / setup invalidated),
 * TAKE_PROFIT = EXTENDED and overheated. Neither ever permits a new entry.
 *
 * Never recomputes Entry/SL/TP, Risk Gate or catalysts — the caller passes the already-derived
 * reads from tenSecondReview.ts / todayMoveAnalysis.ts, and a NO TRADE there is never upgraded here.
 */

import { formatCompact, formatRupiah } from '@/lib/format';
import type { OHLCVBar } from '@/domain/models/History';
import type { CandlePattern, MacdSignal } from '@/domain/models/StockAnalysis';
import { FundamentalRiskLevel } from '@/domain/analysis/riskGate';
import {
  CATALYST_STATUS_LABEL, CatalystStatus, describeClosePosition, EVIDENCE_KIND_LABEL, MOVE_TYPE_LABEL, MoveType, RiskLevel3,
  TodayMoveAnalysis, TodayTradeStatus,
} from '@/domain/analysis/todayMoveAnalysis';

export type SimpleFundamental = 'GOOD' | 'ACCEPTABLE' | 'WEAK';
/** TURNING_UP = the change we look for; UPTREND = already established. */
export type TrendState = 'TURNING_UP' | 'UPTREND' | 'SIDEWAYS' | 'DOWNTREND';
export type MomentumState = 'TURNING_UP' | 'STRONG' | 'NEUTRAL' | 'WEAK';
/** SUPPORTIVE = buyers backing the move, SELLING = sellers pressing, NEUTRAL = nothing decisive. */
export type SimpleVolume = 'SUPPORTIVE' | 'NEUTRAL' | 'SELLING';
export type PriceActionSignal = 'BREAKOUT_RETEST' | 'BREAKOUT' | 'REVERSAL' | 'HIGHER_LOW' | 'NONE' | 'BREAKDOWN';
export type FomoRisk = 'LOW' | 'MEDIUM' | 'HIGH';
export type BullishPhase = 'EARLY_BULLISH' | 'BULLISH' | 'EXTENDED' | 'WAIT' | 'NO_TRADE';
/** SELL / TAKE_PROFIT are for holders; a new entry is never allowed with either. */
export type SimpleEntry = 'BUY' | 'WAIT' | 'TAKE_PROFIT' | 'SELL' | 'NO_TRADE';
export type BuyPermission = 'YES' | 'CONDITIONAL' | 'NO';

export const SIMPLE_ENTRY_LABEL: Record<SimpleEntry, string> = { BUY: 'BUY', WAIT: 'WAIT', TAKE_PROFIT: 'TAKE PROFIT', SELL: 'SELL', NO_TRADE: 'NO TRADE' };
export const BULLISH_PHASE_LABEL: Record<BullishPhase, string> = {
  EARLY_BULLISH: 'EARLY BULLISH', BULLISH: 'BULLISH', EXTENDED: 'EXTENDED', WAIT: 'WAIT', NO_TRADE: 'NO TRADE',
};
export const SIMPLE_FUNDAMENTAL_LABEL: Record<SimpleFundamental, string> = { GOOD: 'Good', ACCEPTABLE: 'Acceptable', WEAK: 'Weak' };
export const TREND_STATE_LABEL: Record<TrendState, string> = { TURNING_UP: 'Mulai Naik', UPTREND: 'Uptrend', SIDEWAYS: 'Sideways', DOWNTREND: 'Downtrend' };
export const MOMENTUM_STATE_LABEL: Record<MomentumState, string> = { TURNING_UP: 'Menguat', STRONG: 'Kuat', NEUTRAL: 'Netral', WEAK: 'Lemah' };
export const SIMPLE_VOLUME_LABEL: Record<SimpleVolume, string> = { SUPPORTIVE: 'Buyer Masuk', NEUTRAL: 'Biasa', SELLING: 'Tekanan Jual' };
export const PRICE_ACTION_LABEL: Record<PriceActionSignal, string> = {
  BREAKOUT_RETEST: 'Breakout-Retest', BREAKOUT: 'Breakout', REVERSAL: 'Reversal', HIGHER_LOW: 'Higher Low', NONE: 'Belum Ada', BREAKDOWN: 'Breakdown',
};
export const FOMO_RISK_LABEL: Record<FomoRisk, string> = { LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH' };

export interface SimpleEntryInput {
  bars: OHLCVBar[];
  price: number;
  changePct: number;
  percentChange1M: number;
  rvol: number | null;
  volume: number;
  prevVolume: number | null;
  volumeMa20: number;
  trend: 'bullish' | 'bearish' | 'sideways';
  higherLows: boolean;
  rsi14: number;
  macdSignalType: MacdSignal;
  macdValue: number;
  macdSignal: number;
  macdHistogram: number;
  candlePattern: CandlePattern;
  ema20: number;
  ema50: number;
  ema200: number;
  support: number | null;
  resistance: number | null;
  moveType: MoveType;
  catalystStatus: CatalystStatus;
  entryZoneLow: number;
  entryZoneHigh: number;
  fundamentalRisk: FundamentalRiskLevel;
  chaseRisk: RiskLevel3;
  eventRisk: RiskLevel3;
  isStrongDistribution: boolean;
  setupInvalidated: boolean;
  /** Trade status from todayMoveAnalysis.ts — a NO_TRADE there is never upgraded. */
  baseTradeStatus: TodayTradeStatus;
}

export interface SimpleEntryReview {
  price: number;
  changePct: number;
  fundamental: SimpleFundamental;
  trend: TrendState;
  momentum: MomentumState;
  volume: SimpleVolume;
  priceAction: PriceActionSignal;
  fomoRisk: FomoRisk;
  phase: BullishPhase;
  /** % price sits above the top of the entry zone (negative = inside/below zone). */
  distanceFromZonePct: number | null;
  /** % price sits above EMA20. */
  distanceFromEma20Pct: number | null;
  /** 1–2 sentences: what is changing on the chart. */
  insight: string;
  decision: SimpleEntry;
  /** Main reason for the decision. */
  why: string;
  /** BUY: the trigger that is active now. Otherwise: the concrete condition that must happen. */
  buyTrigger: string;
  buyPermission: BuyPermission;
  buyPermissionReason: string;
  /** Price + EMA20/50/200 sorted high → low, e.g. "Harga > EMA20 > EMA50 > EMA200". */
  emaStack: string;
  emaStackNote: string;
  rsiText: string;
  macdText: string;
}

/** FOMO thresholds: distance above the entry-zone top. */
const FOMO_LOW_MAX_PCT = 3;
const FOMO_MEDIUM_MAX_PCT = 8;
/** FOMO thresholds: distance above EMA20. */
const EMA20_STRETCH_MEDIUM_PCT = 7;
const EMA20_STRETCH_HIGH_PCT = 12;
/** Entry is "still reasonable" within this distance above the entry-zone top. */
const ENTRY_NEAR_MAX_PCT = 5;
/** Window (bars) in which a reclaim/cross/breakout still counts as a fresh change. */
const TRANSITION_LOOKBACK = 10;
/** Breakout reference: highest high of this many bars before the breakout bar. */
const BREAKOUT_BASE_BARS = 20;
/** A retest must hold within this % above the broken level. */
const RETEST_TOLERANCE_PCT = 3;
/** |changePct| below this counts as a flat day. */
const FLAT_PCT = 0.5;

type IssueKey = 'RISK' | 'FUNDAMENTAL' | 'FOMO' | 'TREND' | 'MOMENTUM' | 'VOLUME' | 'TRIGGER' | 'ENTRY';
const ISSUE_PRIORITY: IssueKey[] = ['RISK', 'FUNDAMENTAL', 'FOMO', 'TREND', 'MOMENTUM', 'VOLUME', 'TRIGGER', 'ENTRY'];
interface Issue {
  key: IssueKey;
  /** true = disqualifies the stock outright (NO TRADE), false = only blocks timing (WAIT). */
  noTrade: boolean;
  /** The condition, e.g. "harga sudah naik terlalu jauh dari area beli". */
  cause: string;
  /** What it means for the entry. */
  effect: string;
  /** Concrete BUY trigger that resolves it. */
  trigger: string;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
function rp(n: number | null | undefined): string | null {
  return n != null && n > 0 ? formatRupiah(Math.round(n)) : null;
}
function pct(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

// ── Series helpers (bars → change detection) ─────────────────────────────────────
function emaSeries(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out: number[] = [];
  values.forEach((v, idx) => out.push(idx === 0 ? v : v * k + out[idx - 1] * (1 - k)));
  return out;
}

function rsiSeries(closes: number[], period = 14): number[] {
  const out: number[] = new Array(closes.length).fill(50);
  let gain = 0;
  let loss = 0;
  for (let idx = 1; idx < closes.length; idx++) {
    const d = closes[idx] - closes[idx - 1];
    const g = Math.max(d, 0);
    const l = Math.max(-d, 0);
    if (idx <= period) {
      gain += g / period;
      loss += l / period;
    } else {
      gain = (gain * (period - 1) + g) / period;
      loss = (loss * (period - 1) + l) / period;
    }
    if (idx >= period) out[idx] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  }
  return out;
}

function macdHistSeries(closes: number[]): number[] {
  const e12 = emaSeries(closes, 12);
  const e26 = emaSeries(closes, 26);
  const macd = closes.map((_, idx) => e12[idx] - e26[idx]);
  const signal = emaSeries(macd, 9);
  return macd.map((m, idx) => m - signal[idx]);
}

export interface ChartChange {
  /** false when there are too few bars (< 60) — every change read below is then unknown. */
  available: boolean;
  reclaimedEma20: boolean;
  reclaimedEma50: boolean;
  emaCrossUp: boolean;
  macdTurnedUp: boolean;
  rsiCrossed50: boolean;
  breakoutLevel: number | null;
  retestLevel: number | null;
  breakdown: boolean;
  /** % gain from the lowest low of the last 20 bars. */
  runFromLowPct: number | null;
  /** Up-day volume ÷ down-day volume over the last 10 bars. */
  upDownVolumeRatio: number | null;
  /** RSI dipped below 40 in the last 10 bars and has since recovered ≥ 8 points. */
  rsiWeakRecovery: boolean;
  /** EMA20 higher than 5 bars ago. */
  ema20Rising: boolean;
  /** Last 10 bars vs the 10 before: higher low / lower high + lower low. */
  higherLowStructure: boolean;
  lowerHighLowerLow: boolean;
  /** No new lower low in the last 10 bars (lowest low ≥ prior 10-bar low). */
  stoppedFalling: boolean;
  /** Today: long upper wick at the 20-bar high, closing in the lower half of the range. */
  rejection: boolean;
  /** Breakout bar volume ÷ its prior 20-bar average (retest case). */
  retestBreakoutVolRatio: number | null;
  /** Lowest low of the last 5 bars. */
  low5: number | null;
}

export function detectChartChange(bars: OHLCVBar[]): ChartChange {
  const empty: ChartChange = {
    available: false, rsiWeakRecovery: false, ema20Rising: false, higherLowStructure: false, lowerHighLowerLow: false,
    stoppedFalling: false, rejection: false, retestBreakoutVolRatio: null, low5: null,
    reclaimedEma20: false, reclaimedEma50: false, emaCrossUp: false, macdTurnedUp: false, rsiCrossed50: false,
    breakoutLevel: null, retestLevel: null, breakdown: false, runFromLowPct: null, upDownVolumeRatio: null,
  };
  const n = bars.length;
  if (n < 60) return empty;

  const closes = bars.map((b) => b.close);
  const ema20 = emaSeries(closes, 20);
  const ema50 = emaSeries(closes, 50);
  const rsi = rsiSeries(closes);
  const hist = macdHistSeries(closes);
  const last = n - 1;
  const window = Array.from({ length: TRANSITION_LOOKBACK }, (_, k) => last - 1 - k);

  const close = closes[last];
  const reclaimedEma20 = close > ema20[last] && window.some((j) => closes[j] < ema20[j]);
  const reclaimedEma50 = close > ema50[last] && window.some((j) => closes[j] < ema50[j]);
  const emaCrossUp = ema20[last] > ema50[last] && window.some((j) => ema20[j] <= ema50[j]);

  const recent5 = [1, 2, 3, 4, 5].map((k) => last - k);
  const macdTurnedUp =
    (hist[last] > 0 && recent5.some((j) => hist[j] <= 0)) ||
    (hist[last] > hist[last - 1] && hist[last - 1] > hist[last - 2] && hist[last - 2] > hist[last - 3]);
  const rsiCrossed50 = rsi[last] >= 50 && recent5.some((j) => rsi[j] < 50);

  const highestHigh = (from: number, to: number) => Math.max(...bars.slice(from, to).map((b) => b.high));
  const lowestLow = (from: number, to: number) => Math.min(...bars.slice(from, to).map((b) => b.low));

  // Breakout today: close above the prior 20-bar high.
  const todayBase = highestHigh(last - BREAKOUT_BASE_BARS, last);
  const breakoutLevel = close > todayBase ? todayBase : null;

  // Breakout-retest: a close above its prior 20-bar high within the lookback (not today), and price
  // has come back near that level without closing under it.
  let retestLevel: number | null = null;
  let retestBreakoutVolRatio: number | null = null;
  for (let j = last - 1; j >= last - TRANSITION_LOOKBACK && j - BREAKOUT_BASE_BARS >= 0; j--) {
    const level = highestHigh(j - BREAKOUT_BASE_BARS, j);
    if (closes[j] > level) {
      const heldSince = closes.slice(j, last + 1).every((c) => c >= level * 0.99);
      const nearNow = bars[last].low <= level * (1 + RETEST_TOLERANCE_PCT / 100) && close >= level;
      if (heldSince && nearNow) {
        retestLevel = level;
        const base = bars.slice(j - BREAKOUT_BASE_BARS, j).reduce((a, b) => a + b.volume, 0) / BREAKOUT_BASE_BARS;
        retestBreakoutVolRatio = base > 0 ? bars[j].volume / base : null;
      }
      break;
    }
  }

  const breakdown = close < lowestLow(last - BREAKOUT_BASE_BARS, last);
  const low20 = lowestLow(last - 19, last + 1);
  const runFromLowPct = low20 > 0 ? ((close - low20) / low20) * 100 : null;

  let upVol = 0;
  let downVol = 0;
  for (let j = last - 9; j <= last; j++) {
    if (closes[j] > closes[j - 1]) upVol += bars[j].volume;
    else if (closes[j] < closes[j - 1]) downVol += bars[j].volume;
  }
  const upDownVolumeRatio = downVol > 0 ? upVol / downVol : upVol > 0 ? Infinity : null;

  const rsiMin10 = Math.min(...rsi.slice(last - 9, last + 1));
  const rsiWeakRecovery = rsiMin10 < 40 && rsi[last] - rsiMin10 >= 8;
  const ema20Rising = ema20[last] > ema20[last - 5];
  const recentHigh = highestHigh(last - 9, last + 1);
  const recentLow = lowestLow(last - 9, last + 1);
  const priorHigh = highestHigh(last - 19, last - 9);
  const priorLow = lowestLow(last - 19, last - 9);
  const higherLowStructure = recentLow > priorLow;
  const lowerHighLowerLow = recentHigh < priorHigh && recentLow < priorLow;
  const stoppedFalling = recentLow >= priorLow * 0.99;
  const b = bars[last];
  const range = b.high - b.low;
  const upperWick = b.high - Math.max(b.open, b.close);
  const body = Math.abs(b.close - b.open);
  const rejection = range > 0 && upperWick >= 2 * body && upperWick >= range * 0.5 &&
    b.high >= highestHigh(last - BREAKOUT_BASE_BARS, last) * 0.99 && b.close <= b.low + range * 0.5;
  const low5 = lowestLow(last - 4, last + 1);

  return {
    available: true, reclaimedEma20, reclaimedEma50, emaCrossUp, macdTurnedUp, rsiCrossed50, breakoutLevel, retestLevel, breakdown,
    runFromLowPct, upDownVolumeRatio, rsiWeakRecovery, ema20Rising, higherLowStructure, lowerHighLowerLow, stoppedFalling, rejection,
    retestBreakoutVolRatio, low5,
  };
}

export function buildSimpleEntryReview(i: SimpleEntryInput): SimpleEntryReview {
  const ch = detectChartChange(i.bars);
  const rvol = i.rvol ?? 0;
  const volumeRising = i.prevVolume != null && i.prevVolume > 0 && i.volume > i.prevVolume;
  const macdBullish = i.macdSignalType === 'bullish' || i.macdSignalType === 'bullish_crossover';
  const macdBearish = i.macdSignalType === 'bearish' || i.macdSignalType === 'bearish_crossover';
  const aboveEma20 = i.ema20 > 0 && i.price > i.ema20;

  // ── QUALITY
  const fundamental: SimpleFundamental =
    i.fundamentalRisk === 'LOW' ? 'GOOD' : i.fundamentalRisk === 'MODERATE' ? 'ACCEPTABLE' : 'WEAK';

  // ── 1. TREND — the change first, the established state second.
  const trendTurning = aboveEma20 && (ch.reclaimedEma20 || ch.reclaimedEma50 || ch.emaCrossUp ||
    (i.trend === 'sideways' && i.higherLows));
  const trend: TrendState = trendTurning && i.trend !== 'bullish' ? 'TURNING_UP'
    : i.trend === 'bullish' ? (trendTurning ? 'TURNING_UP' : 'UPTREND')
      : i.trend === 'bearish' ? 'DOWNTREND' : 'SIDEWAYS';

  // ── 2. MOMENTUM
  const momentumTurning = i.macdSignalType === 'bullish_crossover' || ch.macdTurnedUp || ch.rsiCrossed50;
  const momentum: MomentumState =
    momentumTurning && i.rsi14 < 75 ? 'TURNING_UP'
      : macdBullish && i.rsi14 >= 50 ? 'STRONG'
        : macdBearish && i.rsi14 < 45 ? 'WEAK' : 'NEUTRAL';

  // ── 3. VOLUME — today's up-day volume, or up-volume dominating the last 10 bars.
  const volume: SimpleVolume =
    i.isStrongDistribution || (i.changePct < 0 && rvol >= 1.5)
      ? 'SELLING'
      : (i.changePct > 0 && (rvol >= 1.5 || (rvol >= 1 && volumeRising))) || (ch.upDownVolumeRatio ?? 0) >= 1.3
        ? 'SUPPORTIVE'
        : (ch.upDownVolumeRatio ?? 1) < 0.7 ? 'SELLING' : 'NEUTRAL';

  // ── 4. PRICE ACTION
  const bullishCandle = i.candlePattern === 'bullish_engulfing' || i.candlePattern === 'hammer' || i.candlePattern === 'marubozu_bullish';
  const priceAction: PriceActionSignal =
    ch.breakdown ? 'BREAKDOWN'
      : ch.retestLevel != null ? 'BREAKOUT_RETEST'
        : ch.breakoutLevel != null || i.moveType === 'BREAKOUT' ? 'BREAKOUT'
          : bullishCandle && (i.percentChange1M < 0 || (i.support != null && i.price <= i.support * 1.05)) ? 'REVERSAL'
            : i.higherLows && aboveEma20 ? 'HIGHER_LOW' : 'NONE';

  // ── 5. ENTRY DISTANCE
  const zoneTop = i.entryZoneHigh > 0 ? i.entryZoneHigh : null;
  const distanceFromZonePct = zoneTop != null ? ((i.price - zoneTop) / zoneTop) * 100 : null;
  const distanceFromEma20Pct = i.ema20 > 0 ? ((i.price - i.ema20) / i.ema20) * 100 : null;
  const entryNear = distanceFromZonePct != null
    ? distanceFromZonePct <= ENTRY_NEAR_MAX_PCT
    : distanceFromEma20Pct != null && distanceFromEma20Pct <= ENTRY_NEAR_MAX_PCT;

  // ── 6. FOMO — distance from zone, escalated by a stretched/too-fast move.
  let fomoRisk: FomoRisk =
    distanceFromZonePct == null ? 'MEDIUM'
      : distanceFromZonePct <= FOMO_LOW_MAX_PCT ? 'LOW'
        : distanceFromZonePct <= FOMO_MEDIUM_MAX_PCT ? 'MEDIUM' : 'HIGH';
  const ema20Stretch = distanceFromEma20Pct ?? 0;
  if (i.changePct >= 10 || i.rsi14 >= 80 || i.chaseRisk === 'HIGH' || ema20Stretch >= EMA20_STRETCH_HIGH_PCT ||
    (ch.runFromLowPct ?? 0) >= 35) {
    fomoRisk = 'HIGH';
  } else if (fomoRisk === 'LOW' && (i.changePct >= 5 || i.rsi14 >= 70 || ema20Stretch >= EMA20_STRETCH_MEDIUM_PCT ||
    i.percentChange1M >= 25)) {
    fomoRisk = 'MEDIUM';
  }

  const zoneTxt = rp(i.entryZoneLow) && i.entryZoneLow !== i.entryZoneHigh
    ? `${rp(i.entryZoneLow)}–${rp(i.entryZoneHigh)}`
    : rp(i.entryZoneHigh);
  const support = rp(i.support);
  const resistance = rp(i.resistance);
  const ema20Txt = rp(i.ema20);
  const ema50Txt = rp(i.ema50);
  const volTarget = i.volumeMa20 > 0 ? ` (≥ ${formatCompact(Math.round(i.volumeMa20 * 1.5))} lbr)` : '';

  // ── PHASE
  const hardRisk = i.isStrongDistribution || i.setupInvalidated || i.eventRisk === 'HIGH' || i.baseTradeStatus === 'NO_TRADE';
  const transitionSignals = [
    trend === 'TURNING_UP',
    momentum === 'TURNING_UP',
    priceAction === 'BREAKOUT_RETEST' || priceAction === 'BREAKOUT' || priceAction === 'REVERSAL' || priceAction === 'HIGHER_LOW',
  ].filter(Boolean).length;
  const bullishLeaning = trend === 'TURNING_UP' || trend === 'UPTREND' || momentum === 'TURNING_UP' || momentum === 'STRONG';
  const setupBroken = priceAction === 'BREAKDOWN' ||
    (trend === 'DOWNTREND' && momentum === 'WEAK' && priceAction !== 'REVERSAL');

  const phase: BullishPhase =
    hardRisk || fundamental === 'WEAK' || setupBroken ? 'NO_TRADE'
      : bullishLeaning && fomoRisk === 'HIGH' ? 'EXTENDED'
        : transitionSignals >= 2 && aboveEma20 && trend !== 'DOWNTREND' ? 'EARLY_BULLISH'
          : trend === 'UPTREND' && (momentum === 'STRONG' || momentum === 'TURNING_UP') ? 'BULLISH'
            : 'WAIT';

  // ── BUY TRIGGER — what is (or would be) the valid entry trigger right now.
  const triggerActive =
    priceAction === 'BREAKOUT_RETEST' ||
    (priceAction === 'BREAKOUT' && volume === 'SUPPORTIVE') ||
    ((priceAction === 'REVERSAL' || priceAction === 'HIGHER_LOW') && entryNear);

  // ── Collect every blocker, ranked, before deciding.
  const issues: Issue[] = [];
  const add = (key: IssueKey, noTrade: boolean, cause: string, effect: string, trigger: string) =>
    issues.push({ key, noTrade, cause, effect, trigger });

  if (i.isStrongDistribution) {
    add('RISK', true, 'ada tanda aksi jual besar', 'harga rawan turun lebih dalam', `aksi jual mereda dan harga stabil${support ? ` di atas ${support}` : ''} dengan volume beli kembali dominan`);
  } else if (i.setupInvalidated || priceAction === 'BREAKDOWN') {
    add('RISK', true, 'harga jatuh di bawah batas setup', 'struktur naiknya rusak', 'harga membentuk dasar baru (higher low) lalu close kembali di atas EMA20');
  } else if (i.eventRisk === 'HIGH') {
    add('RISK', true, 'ada risiko event yang tinggi', 'harga bisa bergerak liar', 'event selesai dan harga kembali stabil di atas EMA20');
  } else if (i.baseTradeStatus === 'NO_TRADE') {
    add('RISK', true, 'risikonya saat ini terlalu tinggi', 'belum layak mengambil posisi', 'risiko mereda dan muncul setup reversal/breakout baru');
  }
  if (fundamental === 'WEAK') {
    add('FUNDAMENTAL', true, 'fundamentalnya lemah', 'kenaikan harga rawan tidak bertahan', 'kinerja bisnis membaik (laba & rasio utang kembali sehat)');
  }
  if (fomoRisk !== 'LOW') {
    const backToZone = zoneTxt ? `pullback ke area beli ${zoneTxt}` : ema20Txt ? `pullback ke dekat EMA20 ${ema20Txt}` : 'pullback ke area beli';
    const far = distanceFromZonePct != null && distanceFromZonePct > 0 ? ` (${distanceFromZonePct.toFixed(0)}% di atas area beli)` : '';
    if (fomoRisk === 'HIGH') add('FOMO', false, `harga sudah terbang${far}`, 'entry sekarang sama dengan mengejar harga', `${backToZone} yang bertahan membentuk higher low`);
    else if (!entryNear || phase !== 'EARLY_BULLISH') add('FOMO', false, `harga mulai menjauh dari area beli${far}`, 'risk/reward masuk sekarang kurang sepadan', `${backToZone} atau breakout-retest yang bertahan`);
  }
  if (trend === 'DOWNTREND') {
    add('TREND', setupBroken, 'tren masih turun', 'belum ada tanda berbalik naik',
      `close kembali di atas EMA20${ema20Txt ? ` ${ema20Txt}` : ''} dan harga berhenti membuat lower low`);
  } else if (trend === 'SIDEWAYS' && !aboveEma20) {
    add('TREND', false, 'harga masih sideways di bawah EMA20', 'belum ada perubahan arah', `close di atas EMA20${ema20Txt ? ` ${ema20Txt}` : ''}`);
  } else if (trend === 'SIDEWAYS') {
    add('TREND', false, 'tren masih sideways', 'perubahan menuju bullish belum terkonfirmasi',
      ema50Txt && i.price < i.ema50 ? `close di atas EMA50 ${ema50Txt}` : 'EMA20 memotong ke atas EMA50');
  }
  if (momentum === 'WEAK' || momentum === 'NEUTRAL') {
    add('MOMENTUM', false, momentum === 'WEAK' ? 'momentum masih melemah' : 'momentum belum menguat', 'dorongan naiknya belum ada',
      'MACD cross up atau RSI menembus 50 dari bawah');
  }
  if (volume !== 'SUPPORTIVE') {
    add('VOLUME', false, volume === 'SELLING' ? 'penjual masih dominan' : 'buyer belum masuk', 'kenaikan belum terkonfirmasi',
      `candle naik dengan volume ±1,5× rata-rata${volTarget}`);
  }
  if (!triggerActive) {
    const breakoutTxt = resistance ? `breakout close di atas ${resistance} dengan volume` : 'breakout di atas resistance terdekat dengan volume';
    const pullbackTxt = support ? `pullback ke ${support} yang bertahan (higher low)` : 'pullback yang bertahan membentuk higher low';
    add('TRIGGER', false, 'belum ada trigger entry', 'belum ada titik masuk yang jelas', `${breakoutTxt}, atau ${pullbackTxt}`);
  }
  if (!entryNear && fomoRisk === 'LOW') {
    add('ENTRY', false, 'harga belum di area entry', 'risk/reward belum optimal', zoneTxt ? `harga masuk area beli ${zoneTxt}` : 'harga mendekati area beli');
  }
  issues.sort((a, b) => ISSUE_PRIORITY.indexOf(a.key) - ISSUE_PRIORITY.indexOf(b.key));

  // ── DECISION
  const transitionOk = phase === 'EARLY_BULLISH' || (phase === 'BULLISH' && fomoRisk === 'LOW');
  const baseDecision: SimpleEntry =
    phase === 'NO_TRADE' ? 'NO_TRADE'
      : transitionOk && volume === 'SUPPORTIVE' && entryNear && fomoRisk !== 'HIGH' && triggerActive ? 'BUY'
        : 'WAIT';
  // Holder actions: a broken structure → SELL, a clearly overheated run → TAKE PROFIT.
  const overheated = i.rsi14 >= 75 || ema20Stretch >= 15 || i.changePct >= 10 || (ch.runFromLowPct ?? 0) >= 35;
  const decision: SimpleEntry =
    baseDecision === 'NO_TRADE' && (i.isStrongDistribution || i.setupInvalidated || priceAction === 'BREAKDOWN') ? 'SELL'
      : phase === 'EXTENDED' && overheated ? 'TAKE_PROFIT'
        : baseDecision;

  // ── Signals describing the change (for INSIGHT/WHY).
  const changeSignals: string[] = [];
  if (ch.emaCrossUp) changeSignals.push('EMA20 baru memotong ke atas EMA50');
  else if (ch.reclaimedEma50) changeSignals.push('harga baru merebut kembali EMA50');
  else if (ch.reclaimedEma20) changeSignals.push('harga baru merebut kembali EMA20');
  if (i.macdSignalType === 'bullish_crossover' || ch.macdTurnedUp) changeSignals.push('MACD berbalik naik');
  else if (ch.rsiCrossed50) changeSignals.push('RSI menembus 50');
  if (priceAction === 'BREAKOUT_RETEST') changeSignals.push(`breakout-retest bertahan di ${rp(ch.retestLevel) ?? 'level breakout'}`);
  else if (priceAction === 'BREAKOUT') changeSignals.push(`breakout di atas ${rp(ch.breakoutLevel) ?? resistance ?? 'resistance'}`);
  else if (priceAction === 'REVERSAL') changeSignals.push('muncul candle reversal');
  else if (priceAction === 'HIGHER_LOW') changeSignals.push('terbentuk higher low');
  const signalsTxt = changeSignals.slice(0, 3).join(', ');

  // ── INSIGHT (1–2 kalimat)
  const move = describeMove(i, volume, priceAction);
  const context: Record<BullishPhase, string> = {
    EARLY_BULLISH: `Mulai beralih ke bullish${signalsTxt ? `: ${signalsTxt}` : ''}, dan harga masih dekat area entry.`,
    BULLISH: entryNear ? 'Tren naik sudah terbentuk dan harga masih dekat area entry.' : 'Tren naik sudah terbentuk, tapi harga mulai menjauh dari area entry.',
    EXTENDED: distanceFromZonePct != null && distanceFromZonePct > 0
      ? `Sudah bullish, tapi harga ${distanceFromZonePct.toFixed(0)}% di atas area beli — sudah terlambat untuk dikejar.`
      : 'Sudah bullish, tapi harga bergerak terlalu cepat — sudah terlambat untuk dikejar.',
    WAIT: changeSignals.length > 0 ? `Ada tanda awal (${signalsTxt}), tapi perubahan menuju bullish belum terkonfirmasi.` : 'Belum ada perubahan kondisi menuju bullish.',
    NO_TRADE: 'Setup rusak atau risikonya terlalu tinggi.',
  };
  const insight = `${move} ${context[phase]}`;

  // ── WHY + BUY TRIGGER
  let why: string;
  let buyTrigger: string;
  if (decision === 'BUY') {
    const qualityTxt = fundamental === 'GOOD' ? 'bagus' : 'cukup';
    why = `Fundamental ${qualityTxt}, ${signalsTxt || 'tren dan momentum menguat'}, buyer mulai masuk, dan harga masih ${distanceFromZonePct != null && distanceFromZonePct > 0 ? `${distanceFromZonePct.toFixed(1)}% dari` : 'di'} area beli — entry masih masuk akal.`;
    const invalid = support ? ` Batal jika close di bawah ${support}.` : '';
    buyTrigger = `Trigger aktif: ${PRICE_ACTION_LABEL[priceAction].toLowerCase()}${zoneTxt ? ` — entry di area ${zoneTxt}` : ''}, jangan kejar di atas ${rp((zoneTop ?? i.price) * (1 + FOMO_LOW_MAX_PCT / 100))}.${invalid}`;
  } else {
    const [primary, ...rest] = issues;
    // Max 2 reasons; for NO TRADE the next disqualifying issue first so weak quality is never hidden.
    const second = baseDecision === 'NO_TRADE' ? rest.find((x) => x.noTrade) ?? rest[0] : rest[0];
    const top = primary ? (second ? [primary, second] : [primary]) : [];
    if (top.length === 0) {
      why = 'Bullish sudah terbentuk, tapi syarat entry belum lengkap.';
      buyTrigger = 'Tunggu pullback ke area beli yang bertahan dengan volume beli.';
    } else {
      const reason = `${top.map((x) => x.cause).join(' dan ')}, jadi ${top[0].effect}`;
      why = fundamental !== 'WEAK' && top[0].key !== 'RISK' ? `Fundamental oke, tapi ${reason}.` : `${capitalize(reason)}.`;
      if (decision === 'SELL') why = `${why} Bagi yang sudah pegang, kurangi/keluar posisi; jangan entry baru.`;
      if (decision === 'TAKE_PROFIT') why = `${why} Bagi yang sudah pegang, amankan sebagian profit; jangan entry baru.`;
      // The trigger lists every timing blocker (max 3) so WAIT → BUY is fully spelled out.
      const triggers = (baseDecision === 'NO_TRADE' ? top : issues.filter((x) => !x.noTrade)).slice(0, 3).map((x) => x.trigger);
      buyTrigger = `${capitalize(triggers.join('; lalu '))}.`;
    }
  }

  // ── BUY PERMISSION
  const firstBlocker = issues[0]?.cause;
  const buyPermission: BuyPermission =
    decision === 'BUY' ? 'YES'
      : decision === 'WAIT' && (phase === 'EARLY_BULLISH' || phase === 'BULLISH') ? 'CONDITIONAL' : 'NO';
  const buyPermissionReason =
    buyPermission === 'YES' ? 'Semua syarat terpenuhi: transisi bullish, buyer masuk, entry dekat, FOMO rendah, dan trigger valid.'
      : buyPermission === 'CONDITIONAL' ? `Boleh beli hanya setelah trigger terpenuhi — saat ini ${firstBlocker ?? 'syarat entry belum lengkap'}.`
        : `Tidak ada izin beli — ${firstBlocker ?? 'belum ada transisi bullish'}.`;

  const technical = describeTechnical(i);

  return {
    price: i.price,
    changePct: i.changePct,
    fundamental,
    trend,
    momentum,
    volume,
    priceAction,
    fomoRisk,
    phase,
    distanceFromZonePct,
    distanceFromEma20Pct,
    insight,
    decision,
    why,
    buyTrigger,
    buyPermission,
    buyPermissionReason,
    ...technical,
  };
}

/** EMA arrangement + RSI/MACD read, in plain words. */
function describeTechnical(i: SimpleEntryInput): Pick<SimpleEntryReview, 'emaStack' | 'emaStackNote' | 'rsiText' | 'macdText'> {
  const points = [
    { label: 'Harga', v: i.price },
    { label: 'EMA20', v: i.ema20 },
    { label: 'EMA50', v: i.ema50 },
    { label: 'EMA200', v: i.ema200 },
  ].filter((p) => p.v > 0).sort((a, b) => b.v - a.v);
  const emaStack = points.map((p) => p.label).join(' > ');
  const { price: p, ema20: e20, ema50: e50, ema200: e200 } = i;
  const emaStackNote =
    p > e20 && e20 > e50 && e50 > e200 ? 'Tersusun bullish penuh — tren naik jangka pendek & menengah.'
      : p > e20 && e20 > e50 ? 'Tren pendek-menengah naik, tapi jangka panjang (EMA200) belum ikut.'
        : e20 > e50 && p <= e20 ? 'Tren masih naik, harga sedang pullback ke bawah EMA20.'
          : p > e20 && e20 <= e50 ? 'Harga sudah di atas EMA20 sementara EMA20 masih di bawah EMA50 — awal pembalikan.'
            : p < e20 && e20 < e50 ? 'Tersusun bearish — harga di bawah EMA pendek & menengah.'
              : 'EMA saling berdekatan — belum ada arah yang jelas.';
  const rsiZone = i.rsi14 >= 70 ? 'overbought' : i.rsi14 >= 50 ? 'zona bullish' : i.rsi14 > 30 ? 'di bawah 50 (lemah)' : 'oversold';
  const rsiText = `${i.rsi14.toFixed(1)} — ${rsiZone}`;
  const macdSide = i.macdValue >= i.macdSignal ? 'di atas' : 'di bawah';
  const macdEvent =
    i.macdSignalType === 'bullish_crossover' ? ' · baru cross up'
      : i.macdSignalType === 'bearish_crossover' ? ' · baru cross down' : '';
  const macdText = `MACD ${i.macdValue.toFixed(2)} ${macdSide} signal ${i.macdSignal.toFixed(2)} (histogram ${i.macdHistogram >= 0 ? '+' : ''}${i.macdHistogram.toFixed(2)})${macdEvent}`;
  return { emaStack, emaStackNote, rsiText, macdText };
}

/** First insight sentence: today's price move and its most likely driver. */
function describeMove(i: SimpleEntryInput, volume: SimpleVolume, pa: PriceActionSignal): string {
  const chg = `${Math.abs(i.changePct).toFixed(1)}%`;
  if (i.changePct <= -FLAT_PCT) {
    if (pa === 'BREAKOUT_RETEST') return `Harga turun ${chg}, menguji ulang level breakout.`;
    return volume === 'SELLING' ? `Harga turun ${chg} dengan tekanan jual.` : `Harga turun ${chg} hari ini.`;
  }
  if (i.changePct < FLAT_PCT) return `Harga cenderung datar hari ini (${pct(i.changePct)}).`;

  if (i.catalystStatus === 'VERIFIED' && (i.moveType === 'EVENT' || i.moveType === 'REOPENING')) {
    return i.moveType === 'REOPENING'
      ? `Harga naik ${chg} setelah saham dibuka kembali dari suspensi.`
      : `Harga naik ${chg} karena ada berita/event yang jelas.`;
  }
  if (pa === 'BREAKOUT') return `Harga naik ${chg} dan menembus batas atas.`;
  if (volume === 'SUPPORTIVE') return `Harga naik ${chg} dengan dukungan buyer.`;
  if (i.percentChange1M < 0 || i.trend === 'bearish' || (i.ema50 > 0 && i.price < i.ema50)) {
    return `Harga memantul ${chg} setelah sempat turun.`;
  }
  return `Harga naik ${chg} tanpa pemicu yang jelas.`;
}

// ── Plain-text sections for copy/share — shared by the v4 and v5 report cards. ────────
const rpx = (n: number | null) => rp(n) ?? '–';

export function formatSummaryLines(r: SimpleEntryReview): string[] {
  return [
    `Harga: ${rpx(r.price)} (${pct(r.changePct)})`,
    `🧠 Insight: ${r.insight}`,
    `🎯 Keputusan: ${SIMPLE_ENTRY_LABEL[r.decision]} (${BULLISH_PHASE_LABEL[r.phase]})`,
    `💡 Why: ${r.why}`,
    `⚠️ FOMO Risk: ${FOMO_RISK_LABEL[r.fomoRisk]}`,
  ];
}

export function formatDailyMoveLines(m: TodayMoveAnalysis): string[] {
  const x = (n: number | null) => (n == null || Number.isNaN(n) ? '–' : `${n.toFixed(2)}×`);
  const vol = (n: number | null) => (n == null ? '–' : `${formatCompact(Math.round(n))} lbr`);
  return [
    `O/H/L/C: ${rpx(m.open)} / ${rpx(m.high)} / ${rpx(m.low)} / ${rpx(m.close)} (${pct(m.changePct)})`,
    `Volume: ${vol(m.volume)} vs avg 20D ${vol(m.avgVolume20)} · RVOL ${x(m.rvol)}`,
    `Close Position: ${describeClosePosition(m.closePosition)}`,
    `Move Type: ${MOVE_TYPE_LABEL[m.moveType]} — ${m.moveTypeReason}`,
    `Katalis: ${CATALYST_STATUS_LABEL[m.catalystStatus]} — ${m.catalystSummary}`,
    ...m.evidence.map((e) => `- [${EVIDENCE_KIND_LABEL[e.kind]}] ${e.text}`),
  ];
}

/** `extra` lets v5 add Stochastic / EMA200 lines without changing the v4 output. */
export function formatTechnicalLines(r: SimpleEntryReview, m: TodayMoveAnalysis, extra: string[] = []): string[] {
  return [
    `Trend: ${TREND_STATE_LABEL[r.trend]} · ${r.emaStack} — ${r.emaStackNote}`,
    `Momentum: ${MOMENTUM_STATE_LABEL[r.momentum]} · RSI ${r.rsiText} · ${r.macdText}`,
    ...extra,
    `Price Action: ${PRICE_ACTION_LABEL[r.priceAction]}`,
    `Support: ${rpx(m.support)} · Resistance: ${rpx(m.resistance)}`,
  ];
}

export function formatRiskLines(r: SimpleEntryReview, m: TodayMoveAnalysis, extra: string[] = []): string[] {
  return [
    `Chase Risk: ${m.chaseRisk} — ${m.chaseRiskNote}`,
    `Event Risk: ${m.eventRisk} — ${m.eventRiskNote}`,
    `Primary Trend Risk: ${m.primaryTrendRisk} — ${m.primaryTrendRiskNote}`,
    `⚠️ FOMO Risk: ${FOMO_RISK_LABEL[r.fomoRisk]}`,
    `⏳ Buy Trigger: ${r.buyTrigger}`,
    ...extra,
    `Status: ${SIMPLE_ENTRY_LABEL[r.decision]} · Buy Permission: ${r.buyPermission} — ${r.buyPermissionReason}`,
  ];
}

/** Plain-text version of the v4 4-section report, for copy/share. */
export function formatSimpleEntryReview(ticker: string, r: SimpleEntryReview, m: TodayMoveAnalysis): string {
  return [
    `📌 ${ticker} — EQUITY RESEARCH REPORT`,
    '',
    '1️⃣ KARTU RINGKASAN EKSEKUTIF',
    ...formatSummaryLines(r),
    '',
    '2️⃣ PERGERAKAN HARIAN & VOLUME',
    ...formatDailyMoveLines(m),
    '',
    '3️⃣ DASHBOARD TEKNIKAL',
    ...formatTechnicalLines(r, m),
    '',
    '4️⃣ MANAJEMEN RISIKO & BUY TRIGGER',
    ...formatRiskLines(r, m),
  ].join('\n');
}
