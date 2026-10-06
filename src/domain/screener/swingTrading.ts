/**
 * swingTrading.ts
 *
 * Swing Trading screener (spec: docs/features_swingtrading.md). Target 5–15% dalam 3–10 hari bursa.
 *
 * Pipeline: indikator dari OHLCV EOD → deteksi setup (breakout / breakout-retest / pullback sehat)
 * → filter utama (setup + risk gate) → skor tertimbang (Trend 25 / Momentum 25 / Volume 20 /
 * Setup-Price Action 20 / Risk-Reward 10) → status SWING BUY SETUP / SWING WAIT / NO TRADE +
 * rencana (trigger, batas entry, TP1, TP2, SL, R:R).
 *
 * "Buy area" bukan BUY otomatis: trigger = break high bar terakhir, dan entry di atas batas entry
 * dianggap mengejar harga. Fundamental hanya quality filter (ROE negatif → gate gagal), bukan
 * alasan entry. Indikator yang tidak bisa dihitung → null ("DATA TIDAK TERSEDIA"), tidak dikarang.
 * EMA200 butuh ≥200 bar — preset ini mengambil riwayat 1 tahun.
 */

import { OHLCVBar } from '@/domain/models/History';
import { StockSummary } from '@/domain/models/Stock';
import { isBearishStructure, isBullishStructure, priceStructure, PriceStructure } from '@/domain/analysis/decisionEngineV3';
import { atr } from '@/domain/indicators/atr';
import { macd } from '@/domain/indicators/macd';
import { ema, lastValid } from '@/domain/indicators/movingAverages';
import { rsi } from '@/domain/indicators/rsi';
import { relativeVolume } from '@/domain/indicators/volume';
import { computeDataFreshness, DataFreshness } from '@/domain/analysis/dataFreshness';
import { idxTickSize } from '@/domain/analysis/idxTick';
import {
  avgTradedValue,
  barReturn,
  clamp,
  DATA_NA,
  floorTick,
  fmt,
  num,
  resistancesAbove,
  rp,
  SetupCheck,
  tickUp,
} from './setupUtils';

export type SwingTradingStatus = 'BUY' | 'WAIT' | 'NO_TRADE';
export type SwingSetupType = 'BREAKOUT' | 'BREAKOUT_RETEST' | 'PULLBACK' | 'NONE';
/**
 * What the user sees (EzySaham AI — SWING): `status` decides the list (NO_TRADE is filtered out);
 * the verdict adds AVOID CHASING for a WAIT row whose price already ran too far from the entry.
 */
export type SwingVerdict = 'SETUP' | 'WATCH' | 'AVOID' | 'AVOID_CHASING';
/** Price + EMA9/21/50/200 + structure HH/HL · LH/LL. */
export type SwingTrendCall = 'BULLISH' | 'RECOVERY' | 'NETRAL' | 'BEARISH';
/** RSI + MACD. */
export type SwingMomentumCall = 'KUAT' | 'CUKUP' | 'LEMAH';

export const SWING_VERDICT_LABEL: Record<SwingVerdict, string> = {
  SETUP: 'SWING SETUP',
  WATCH: 'WATCH',
  AVOID: 'AVOID',
  AVOID_CHASING: 'AVOID CHASING',
};

export const SWING_STATUS_LABEL: Record<SwingTradingStatus, string> = {
  BUY: 'SWING BUY SETUP',
  WAIT: 'SWING WAIT',
  NO_TRADE: 'NO TRADE',
};

export const SWING_SETUP_LABEL: Record<SwingSetupType, string> = {
  BREAKOUT: 'Breakout',
  BREAKOUT_RETEST: 'Breakout-Retest',
  PULLBACK: 'Pullback Sehat',
  NONE: 'Belum ada setup',
};

// ── Thresholds (docs/features_swingtrading.md → FILTER UTAMA) ────────────────
/** "Likuiditas memadai" — rata-rata nilai transaksi 20 hari. */
export const SW_MIN_AVG_VALUE_20D = 10_000_000_000;
export const SW_RSI_MIN = 50;
export const SW_RSI_MAX = 70;
export const SW_MIN_RVOL = 1.2;
export const SW_BREAKOUT_RVOL = 1.5;
export const SW_MIN_UPSIDE_PCT = 5;
export const SW_MIN_RR = 2;
export const SW_TARGET_MIN_PCT = 5;
export const SW_TARGET_MAX_PCT = 15;
/** Gap ekstrem: open hari terakhir vs close sebelumnya. */
export const SW_MAX_GAP_PCT = 7;
/** Terlalu jauh dari EMA18 (extended). */
export const SW_MAX_EMA18_DISTANCE_PCT = 10;
/** Parabolik: reli 1 bulan terlalu tajam. */
export const SW_MAX_RETURN_1M_PCT = 35;
/** Batas entry = trigger + 0,5×ATR; di atas itu = mengejar harga. */
export const SW_MAX_ENTRY_ATR_MULT = 0.5;
/** Close lebih dari 1,5×ATR di atas EMA8 → WAIT pullback. */
export const SW_CHASE_ATR_MULT = 1.5;
export const SW_SCORE_BUY = 80;
export const SW_SCORE_WAIT = 60;
export const SW_RISK_PER_TRADE_PCT = 1;
/** Bar riwayat yang dibutuhkan (EMA200) — preset meminta range 1 tahun. */
export const SW_HISTORY_RANGE = '1y';

const BREAKOUT_LOOKBACK = 20;
const RETEST_WINDOW = 10;
const RETEST_TOLERANCE_PCT = 3;
const PULLBACK_TOUCH_PCT = 2;
const RESISTANCE_LOOKBACK = 120;

const WEIGHTS = { trend: 0.25, momentum: 0.25, volume: 0.2, setup: 0.2, riskReward: 0.1 } as const;

export type SwingTradingCheck = SetupCheck;

export interface SwingTradingScores {
  trend: number;
  momentum: number;
  volume: number;
  setup: number;
  riskReward: number;
  /** 0-100 komposit tertimbang */
  total: number;
}

export type SwingTrendLabel = 'UPTREND' | 'SIDEWAYS' | 'DOWNTREND' | null;

export interface SwingConclusion {
  /** 1. Mengapa saham ini menarik untuk swing? */
  why: string;
  /** 2. Apa trigger entry? */
  trigger: string;
  /** 3. Target 5–15% realistis atau tidak? */
  target: string;
  /** 4. Di mana invalidation/SL? */
  invalidation: string;
  /** 5. Apa alasan untuk TIDAK entry? */
  reasonsNotToEnter: string;
}

export interface SwingTradingSetup {
  price: number;
  ema8: number | null;
  ema18: number | null;
  ema9: number | null;
  ema21: number | null;
  ema50: number | null;
  ema200: number | null;
  trend: SwingTrendLabel;
  /** 20-session structure (last 20 vs the 20 before). */
  structure: PriceStructure;
  trendCall: SwingTrendCall;
  momentumCall: SwingMomentumCall;
  rsi: number | null;
  macdHistogram: number | null;
  rvol: number | null;
  volume: number | null;
  /** Pullback only: selling dried up (volume under average) and volume picked up on the rebound bar. */
  pullbackVolumeOk: boolean | null;
  /** Breakout / retest level, otherwise the lowest low of the last 10 sessions. */
  support: number | null;
  return1W: number | null;
  return1M: number | null;
  closePosition: number | null;
  atrPct: number | null;
  avgValue20D: number | null;
  gapPct: number | null;
  ema18DistancePct: number | null;
  setupType: SwingSetupType;
  /** Level breakout (high 20 hari sebelumnya) yang dipakai untuk deteksi breakout/retest. */
  breakoutLevel: number | null;
  resistance: number | null;
  /** Ruang naik dari harga ke resistance terdekat; bila tidak ada resistance di atas, ke TP1 (target R-multiple). */
  upsidePct: number | null;
  /** Break high bar terakhir + 1 tick. */
  entryTrigger: number | null;
  /** Batas entry — di atas level ini jangan beli (mengejar harga). */
  maxEntry: number | null;
  tp1: number | null;
  tp2: number | null;
  /** Dasar target: resistance swing-high, atau kelipatan R bila tidak ada resistance di atas. */
  targetBasis: 'resistance' | 'rMultiple' | null;
  sl: number | null;
  /** R:R ke TP1. */
  riskReward: number | null;
  tp1Pct: number | null;
  tp2Pct: number | null;
  /** true bila TP1 di rentang 5–15% dan ATR 10 hari cukup untuk mencapainya. */
  targetRealistic: boolean | null;
  scores: SwingTradingScores;
  status: SwingTradingStatus;
  verdict: SwingVerdict;
  setupChecks: SwingTradingCheck[];
  riskChecks: SwingTradingCheck[];
  chasing: boolean;
  missingData: string[];
  freshness: DataFreshness | null;
  conclusion: SwingConclusion;
}

// ── Setup detection ──────────────────────────────────────────────────────────
function detectSetup(
  bars: OHLCVBar[],
  price: number,
  ema8: number | null,
  ema18: number | null,
  rvol: number | null,
): { type: SwingSetupType; breakoutLevel: number | null } {
  const n = bars.length;
  if (n < BREAKOUT_LOOKBACK + RETEST_WINDOW + 2 || ema18 == null || ema8 == null) return { type: 'NONE', breakoutLevel: null };
  const last = bars[n - 1];

  // Breakout: close menembus high 20 hari sebelumnya dengan volume ≥ 1,5x.
  const prior = bars.slice(n - 1 - BREAKOUT_LOOKBACK, n - 1);
  const level = Math.max(...prior.map((b) => b.high));
  if (price > level && rvol != null && rvol >= SW_BREAKOUT_RVOL) return { type: 'BREAKOUT', breakoutLevel: level };

  // Breakout-retest: dalam 10 bar terakhir sempat close di atas high 20 hari sebelumnya, lalu harga
  // kembali menguji level itu (low ≤ level + 3%) dan close bertahan di atasnya.
  for (let i = n - 2; i >= n - 1 - RETEST_WINDOW; i--) {
    const base = bars.slice(i - BREAKOUT_LOOKBACK, i);
    const lvl = Math.max(...base.map((b) => b.high));
    if (bars[i].close > lvl) {
      const tested = bars.slice(i + 1).some((b) => b.low <= lvl * (1 + RETEST_TOLERANCE_PCT / 100));
      if (tested && price > lvl && last.close >= last.open) return { type: 'BREAKOUT_RETEST', breakoutLevel: lvl };
      break;
    }
  }

  // Pullback sehat: EMA8 > EMA18, salah satu dari 3 bar terakhir menyentuh area EMA18 (±2%),
  // close kembali di atas EMA8 dengan candle hijau.
  const touched = bars.slice(-3).some((b) => b.low <= ema18 * (1 + PULLBACK_TOUCH_PCT / 100));
  if (ema8 > ema18 && touched && price > ema8 && last.close > last.open) return { type: 'PULLBACK', breakoutLevel: null };

  return { type: 'NONE', breakoutLevel: null };
}

// ── Scoring helpers ──────────────────────────────────────────────────────────
function rsiScore(v: number | null): number {
  if (v == null) return 0;
  if (v >= 55 && v <= 65) return 100;
  if (v >= SW_RSI_MIN && v <= SW_RSI_MAX) return 75;
  if ((v >= 45 && v < SW_RSI_MIN) || (v > SW_RSI_MAX && v <= 75)) return 35;
  return 0;
}

function returnScore(r: number | null, sweetMax: number): number {
  if (r == null || r <= 0) return 0;
  if (r <= sweetMax) return clamp(60 + (r / sweetMax) * 40);
  return clamp(100 - (r - sweetMax) * 3, 40);
}

function rvolScore(v: number | null): number {
  if (v == null) return 0;
  if (v < 1) return clamp(v * 30);
  if (v < SW_MIN_RVOL) return 45;
  if (v < SW_BREAKOUT_RVOL) return 75;
  if (v <= 4) return 100;
  return 80; // volume klimaks — bisa jadi distribusi
}

const SETUP_BASE: Record<SwingSetupType, number> = { BREAKOUT: 100, BREAKOUT_RETEST: 95, PULLBACK: 90, NONE: 20 };

function riskRewardScore(rr: number | null): number {
  if (rr == null) return 0;
  if (rr >= 3) return 100;
  if (rr >= SW_MIN_RR) return 85;
  if (rr >= 1.5) return 50;
  if (rr >= 1) return 25;
  return 0;
}

// ── Main ─────────────────────────────────────────────────────────────────────
export function computeSwingTradingSetup(s: StockSummary, bars: OHLCVBar[], asOf: Date = new Date()): SwingTradingSetup {
  const closes = bars.map((b) => b.close);
  const n = bars.length;
  const lastBar = bars[n - 1];
  const prevBar = bars[n - 2];
  const price = s.lastClose;

  const ema8 = num(lastValid(ema(closes, 8)));
  const ema18Series = ema(closes, 18);
  const ema18 = num(lastValid(ema18Series));
  const ema18Prev = num(ema18Series[n - 6] ?? NaN);
  const ema200 = num(lastValid(ema(closes, 200)));
  const ema9 = num(lastValid(ema(closes, 9)));
  const ema21 = n >= 21 ? num(lastValid(ema(closes, 21))) : null;
  const ema50 = n >= 50 ? num(lastValid(ema(closes, 50))) : null;
  const macdHistogram = num(lastValid(macd(bars).histogram));
  const structure = priceStructure(bars, 20);
  const lastVolume = lastBar && lastBar.volume > 0 ? lastBar.volume : null;
  const rsiLast = num(lastValid(rsi(bars, 14)));
  const rvol = num(relativeVolume(bars, 20));
  const atrLast = num(lastValid(atr(bars, 14)));
  const atrPct = atrLast != null && price > 0 ? (atrLast / price) * 100 : null;
  const return1W = barReturn(bars, 5);
  const return1M = barReturn(bars, 21);
  const avgValue20D = avgTradedValue(bars, 20);

  const dayRange = lastBar ? lastBar.high - lastBar.low : 0;
  const closePosition = lastBar ? (dayRange > 0 ? clamp((lastBar.close - lastBar.low) / dayRange, 0, 1) : lastBar.close > lastBar.open ? 1 : 0) : null;
  const gapPct = lastBar && prevBar && prevBar.close > 0 ? ((lastBar.open - prevBar.close) / prevBar.close) * 100 : null;
  const ema18DistancePct = ema18 != null && ema18 > 0 ? ((price - ema18) / ema18) * 100 : null;

  const trend: SwingTrendLabel =
    ema8 == null || ema18 == null ? null
      : price > ema18 && ema8 > ema18 && (ema200 == null || price > ema200) ? 'UPTREND'
        : price < ema18 && ema8 < ema18 ? 'DOWNTREND'
          : 'SIDEWAYS';

  const { type: setupType, breakoutLevel } = detectSetup(bars, price, ema8, ema18, rvol);

  // Trend = price + EMA9/21/50/200 + structure (never one indicator alone).
  const bullS = isBullishStructure(structure);
  const bearS = isBearishStructure(structure);
  const emaUp = ema9 != null && ema21 != null && ema50 != null && price > ema21 && ema9 > ema21 && ema21 > ema50;
  const emaDown = ema9 != null && ema21 != null && ema50 != null && price < ema21 && ema9 < ema21 && ema21 < ema50;
  const trendCall: SwingTrendCall = bearS && ema50 != null && price < ema50 ? 'BEARISH'
    : emaUp && !bearS && (ema200 == null || price > ema200) ? 'BULLISH'
      : (bullS || emaUp || (ema21 != null && ema9 != null && price > ema21 && ema9 > ema21)) && !bearS ? 'RECOVERY'
        : emaDown ? 'BEARISH'
          : 'NETRAL';
  // Momentum = RSI + MACD histogram.
  const momentumCall: SwingMomentumCall = rsiLast == null && macdHistogram == null ? 'LEMAH'
    : (rsiLast != null && rsiLast < 45) || (macdHistogram != null && macdHistogram < 0 && (rsiLast == null || rsiLast < 50)) ? 'LEMAH'
      : (rsiLast == null || (rsiLast >= SW_RSI_MIN && rsiLast <= SW_RSI_MAX)) && (macdHistogram == null || macdHistogram > 0) ? 'KUAT'
        : 'CUKUP';
  // Healthy pullback: volume shrinks into the dip, then rises on the rebound bar.
  const volMa20 = n >= 21 ? bars.slice(-21, -1).reduce((sum, b) => sum + b.volume, 0) / 20 : null;
  const dipVols = bars.slice(-4, -1).map((b) => b.volume);
  const pullbackVolumeOk = setupType !== 'PULLBACK' ? null
    : volMa20 != null && dipVols.length === 3 && prevBar != null && lastBar != null
      && dipVols.reduce((sum, v) => sum + v, 0) / 3 <= volMa20 && lastBar.volume > prevBar.volume;
  const support = breakoutLevel != null && breakoutLevel < price ? breakoutLevel
    : n >= 10 ? Math.min(...bars.slice(-10).map((b) => b.low)) : null;

  // ── Rencana ──
  // Trigger = break high bar terakhir; batas entry = trigger + 0,5×ATR.
  // SL = di bawah struktur: low terendah 5 bar (breakout/retest: di bawah level breakout bila lebih dekat),
  // tapi tidak lebih dari 2×ATR di bawah trigger. TP1/TP2 = resistance swing-high berikutnya; bila tidak
  // ada resistance di atas trigger → 2R / 3R (ditandai rMultiple, bukan level resistance).
  let entryTrigger: number | null = null;
  let maxEntry: number | null = null;
  let sl: number | null = null;
  let tp1: number | null = null;
  let tp2: number | null = null;
  let targetBasis: SwingTradingSetup['targetBasis'] = null;
  let riskReward: number | null = null;
  const resistances = n > 5 ? resistancesAbove(bars, price, RESISTANCE_LOOKBACK) : [];
  const resistance = resistances[0] ?? null;

  if (lastBar && atrLast != null) {
    entryTrigger = tickUp(Math.max(lastBar.high, price));
    maxEntry = floorTick(entryTrigger + atrLast * SW_MAX_ENTRY_ATR_MULT);
    const swingLow = Math.min(...bars.slice(-5).map((b) => b.low));
    let structural = swingLow - idxTickSize(swingLow);
    if (breakoutLevel != null && breakoutLevel < entryTrigger) {
      structural = Math.max(structural, breakoutLevel - atrLast * 0.5);
    }
    sl = floorTick(Math.max(structural, entryTrigger - atrLast * 2));
    if (sl >= entryTrigger) sl = floorTick(entryTrigger - idxTickSize(entryTrigger));
    const risk = entryTrigger - sl;

    const targets = resistances.filter((r) => r > entryTrigger! * 1.005);
    if (targets.length > 0) {
      targetBasis = 'resistance';
      tp1 = floorTick(targets[0] - idxTickSize(targets[0]));
      tp2 = targets[1] != null ? floorTick(targets[1] - idxTickSize(targets[1])) : null;
    } else if (risk > 0) {
      targetBasis = 'rMultiple';
      tp1 = floorTick(entryTrigger + risk * 2);
      tp2 = floorTick(entryTrigger + risk * 3);
    }
    if (tp1 != null && tp1 <= entryTrigger) tp1 = null;
    if (tp2 != null && (tp1 == null || tp2 <= tp1)) tp2 = tp1 != null && risk > 0 ? floorTick(Math.max(tp1 + risk, entryTrigger + risk * 3)) : null;
    if (tp1 != null && risk > 0) riskReward = Math.round(((tp1 - entryTrigger) / risk) * 100) / 100;
  }

  // Spec: "Upside ke resistance/target" — tanpa resistance di atas, ukur ke TP1 (R-multiple).
  const upsideTarget = resistance ?? (targetBasis === 'rMultiple' ? tp1 : null);
  const upsidePct = upsideTarget != null && price > 0 ? ((upsideTarget - price) / price) * 100 : null;
  const tp1Pct = tp1 != null && entryTrigger ? ((tp1 - entryTrigger) / entryTrigger) * 100 : null;
  const tp2Pct = tp2 != null && entryTrigger ? ((tp2 - entryTrigger) / entryTrigger) * 100 : null;
  // ATR × √10 ≈ jangkauan gerak wajar 10 hari bursa.
  const targetRealistic =
    tp1Pct == null || atrPct == null ? null
      : tp1Pct >= SW_TARGET_MIN_PCT && tp1Pct <= SW_TARGET_MAX_PCT && atrPct * Math.sqrt(10) >= tp1Pct;

  const chasing = ema8 != null && atrLast != null && price - ema8 > atrLast * SW_CHASE_ATR_MULT;
  const freshness = computeDataFreshness(bars, asOf);

  // ── Missing data ──
  const missingData: string[] = [];
  if (ema200 == null) missingData.push('EMA200');
  if (ema8 == null) missingData.push('EMA8');
  if (ema18 == null) missingData.push('EMA18');
  if (rsiLast == null) missingData.push('RSI');
  if (rvol == null) missingData.push('RVOL');
  if (atrPct == null) missingData.push('ATR');
  if (avgValue20D == null) missingData.push('Avg Value 20D');
  if (return1W == null) missingData.push('Return 1W');
  if (return1M == null) missingData.push('Return 1M');

  // Fundamental = quality filter saja. ROE 0 dari ringkasan dianggap tidak tersedia, bukan gagal.
  const roeKnown = Number.isFinite(s.roe) && s.roe !== 0;
  const qualityCheck: SwingTradingCheck = roeKnown
    ? { ok: s.roe > 0, label: s.roe > 0 ? `Quality: ROE positif (${s.roe.toFixed(1)}%)` : `Quality: ROE negatif (${s.roe.toFixed(1)}%) — perusahaan merugi` }
    : { ok: true, missing: true, label: `Quality (ROE): ${DATA_NA} — tidak dipakai sebagai gate` };

  const parabolic = return1M != null && return1M > SW_MAX_RETURN_1M_PCT;
  const extended = ema18DistancePct != null && ema18DistancePct > SW_MAX_EMA18_DISTANCE_PCT;

  // ── Risk gate (gagal → NO TRADE) ──
  const riskChecks: SwingTradingCheck[] = [
    avgValue20D == null
      ? { ok: false, missing: true, label: `Avg Value 20D: ${DATA_NA}` }
      : { ok: avgValue20D >= SW_MIN_AVG_VALUE_20D, label: `Likuiditas: Avg Value 20D ≥ Rp10 M (Rp${(avgValue20D / 1e9).toFixed(1)} M)` },
    gapPct == null
      ? { ok: false, missing: true, label: `Gap: ${DATA_NA}` }
      : { ok: Math.abs(gapPct) <= SW_MAX_GAP_PCT, label: `Tidak gap ekstrem > ${SW_MAX_GAP_PCT}% (${gapPct.toFixed(1)}%)` },
    { ok: !parabolic, label: parabolic ? `Terlalu parabolik (1M ${fmt(return1M)}%)` : 'Tidak parabolik' },
    { ok: !extended, missing: ema18DistancePct == null, label: `Jarak dari EMA18 ≤ ${SW_MAX_EMA18_DISTANCE_PCT}% (${fmt(ema18DistancePct)}%)` },
    { ok: missingData.length === 0, missing: missingData.length > 0, label: missingData.length === 0 ? 'Indikator penting lengkap' : `${DATA_NA}: ${missingData.join(', ')}` },
    { ok: freshness?.tier !== 'stale', label: freshness ? `Data EOD H-${freshness.ageInTradingDays}` : `Data harga: ${DATA_NA}` },
    qualityCheck,
  ];

  // ── Setup filter (gagal → maksimal WAIT / trigger belum terpenuhi) ──
  const setupChecks: SwingTradingCheck[] = [
    { ok: ema200 != null && price > ema200, missing: ema200 == null, label: `Harga > EMA200 (${fmt(ema200, 0)})` },
    { ok: ema8 != null && ema18 != null && ema8 > ema18, missing: ema8 == null || ema18 == null, label: 'EMA8 > EMA18' },
    { ok: ema8 != null && ema18 != null && price > ema8 && price > ema18, missing: ema8 == null || ema18 == null, label: 'Harga > EMA8 & EMA18' },
    { ok: rsiLast != null && rsiLast >= SW_RSI_MIN && rsiLast <= SW_RSI_MAX, missing: rsiLast == null, label: `RSI ${SW_RSI_MIN}–${SW_RSI_MAX} (${fmt(rsiLast)})` },
    { ok: rvol != null && rvol >= SW_MIN_RVOL, missing: rvol == null, label: `RVOL ≥ ${SW_MIN_RVOL}x (${fmt(rvol, 2)})` },
    { ok: return1W != null && return1W > 0, missing: return1W == null, label: `Return 1W positif (${fmt(return1W, 2)}%)` },
    { ok: return1M != null && return1M > 0, missing: return1M == null, label: `Momentum 1M positif (${fmt(return1M, 2)}%)` },
    { ok: setupType !== 'NONE', label: `Setup: ${SWING_SETUP_LABEL[setupType]}` },
    { ok: upsidePct != null && upsidePct >= SW_MIN_UPSIDE_PCT, missing: upsidePct == null, label: `Upside ke ${resistance != null ? 'resistance' : 'target'} ≥ ${SW_MIN_UPSIDE_PCT}% (${upsidePct == null ? DATA_NA : `${upsidePct.toFixed(1)}%`})` },
    { ok: riskReward != null && riskReward >= SW_MIN_RR, missing: riskReward == null, label: `R:R ≥ 1:${SW_MIN_RR} (${riskReward == null ? DATA_NA : `1:${riskReward.toFixed(2)}`})` },
    { ok: targetRealistic === true, missing: targetRealistic == null, label: `Target realistis ${SW_TARGET_MIN_PCT}–${SW_TARGET_MAX_PCT}% (${tp1Pct == null ? DATA_NA : `${tp1Pct.toFixed(1)}%`})` },
    // Conflicting data → WATCH: trend and momentum must agree.
    { ok: trendCall === 'BULLISH' && momentumCall !== 'LEMAH', label: `Trend & momentum searah (${trendCall} · ${momentumCall})` },
    ...(setupType === 'PULLBACK' ? [{ ok: pullbackVolumeOk === true, label: 'Pullback: volume mengecil lalu naik saat memantul' }] : []),
  ];

  // ── Scoring ──
  const trendScore = Math.round(
    (ema200 != null && price > ema200 ? 30 : 0) +
    (ema8 != null && ema18 != null && ema8 > ema18 ? 25 : 0) +
    (ema8 != null && ema18 != null && price > ema8 && price > ema18 ? 25 : 0) +
    (ema18 != null && ema18Prev != null && ema18 > ema18Prev ? 20 : 0),
  );
  const momentum = Math.round(rsiScore(rsiLast) * 0.4 + returnScore(return1W, 6) * 0.3 + returnScore(return1M, 15) * 0.3);
  const volume = Math.round(rvolScore(rvol));
  const setup = Math.round(SETUP_BASE[setupType] * (0.6 + 0.4 * (closePosition ?? 0)));
  const rrScore = Math.round(riskRewardScore(riskReward));
  const total = Math.round(
    trendScore * WEIGHTS.trend + momentum * WEIGHTS.momentum + volume * WEIGHTS.volume +
    setup * WEIGHTS.setup + rrScore * WEIGHTS.riskReward,
  );
  const scores: SwingTradingScores = { trend: trendScore, momentum, volume, setup, riskReward: rrScore, total };

  // ── Status: skor tinggi saja tidak cukup untuk BUY ──
  const riskGateFailed = riskChecks.some((c) => !c.ok);
  const triggerValid = setupChecks.every((c) => c.ok) && !chasing;
  const status: SwingTradingStatus =
    riskGateFailed || total < SW_SCORE_WAIT ? 'NO_TRADE'
      : total >= SW_SCORE_BUY && triggerValid ? 'BUY'
        : 'WAIT';
  const verdict: SwingVerdict = status === 'NO_TRADE' ? 'AVOID' : status === 'WAIT' && chasing ? 'AVOID_CHASING' : status === 'BUY' ? 'SETUP' : 'WATCH';

  const conclusion = buildConclusion({
    status, total, setupType, trend, aboveEma200: ema200 == null ? null : price > ema200, rvol, return1M, rsiLast, riskChecks, setupChecks, chasing,
    entryTrigger, maxEntry, tp1, tp2, tp1Pct, tp2Pct, targetBasis, targetRealistic, sl, riskReward, ema8, freshness,
  });

  return {
    price,
    ema8,
    ema18,
    ema9,
    ema21,
    ema50,
    ema200,
    trend,
    structure,
    trendCall,
    momentumCall,
    rsi: rsiLast,
    macdHistogram,
    rvol,
    volume: lastVolume,
    pullbackVolumeOk,
    support,
    return1W,
    return1M,
    closePosition,
    atrPct,
    avgValue20D,
    gapPct,
    ema18DistancePct,
    setupType,
    breakoutLevel,
    resistance,
    upsidePct,
    entryTrigger,
    maxEntry,
    tp1,
    tp2,
    targetBasis,
    sl,
    riskReward,
    tp1Pct,
    tp2Pct,
    targetRealistic,
    scores,
    status,
    verdict,
    setupChecks,
    riskChecks,
    chasing,
    missingData,
    freshness,
    conclusion,
  };
}

function buildConclusion(p: {
  status: SwingTradingStatus;
  total: number;
  setupType: SwingSetupType;
  trend: SwingTrendLabel;
  aboveEma200: boolean | null;
  rvol: number | null;
  return1M: number | null;
  rsiLast: number | null;
  riskChecks: SwingTradingCheck[];
  setupChecks: SwingTradingCheck[];
  chasing: boolean;
  entryTrigger: number | null;
  maxEntry: number | null;
  tp1: number | null;
  tp2: number | null;
  tp1Pct: number | null;
  tp2Pct: number | null;
  targetBasis: SwingTradingSetup['targetBasis'];
  targetRealistic: boolean | null;
  sl: number | null;
  riskReward: number | null;
  ema8: number | null;
  freshness: DataFreshness | null;
}): SwingConclusion {
  const eod = p.freshness ? `Data EOD ${p.freshness.lastBarDate}.` : 'Data EOD.';

  // 1. Why
  const strengths: string[] = [];
  if (p.setupType !== 'NONE') strengths.push(`setup ${SWING_SETUP_LABEL[p.setupType].toLowerCase()}`);
  if (p.trend === 'UPTREND') strengths.push(p.aboveEma200 ? 'trend naik (harga > EMA8/18/200)' : 'trend jangka pendek naik (harga > EMA8/18)');
  if (p.rvol != null && p.rvol >= SW_MIN_RVOL) strengths.push(`volume ${p.rvol.toFixed(2)}x rata-rata`);
  if (p.rsiLast != null && p.rsiLast >= SW_RSI_MIN && p.rsiLast <= SW_RSI_MAX) strengths.push(`RSI ${p.rsiLast.toFixed(0)} di zona momentum`);
  if (p.return1M != null && p.return1M > 0) strengths.push(`momentum 1M +${p.return1M.toFixed(1)}%`);
  const why = strengths.length > 0
    ? `Skor ${p.total}/100 — ${strengths.join(', ')}.`
    : `Skor ${p.total}/100 — belum ada kombinasi trend + momentum + volume yang jelas.`;

  // 2. Trigger
  const trigger = p.entryTrigger == null
    ? `Trigger: ${DATA_NA}.`
    : `Entry hanya bila harga menembus ${rp(p.entryTrigger)}; batas entry ${rp(p.maxEntry)} — di atas itu jangan kejar.${p.chasing ? ` Harga sudah jauh dari EMA8 (${rp(p.ema8 == null ? null : Math.round(p.ema8))}) — tunggu pullback.` : ''}`;

  // 3. Target
  const basis = p.targetBasis === 'rMultiple' ? ' (tidak ada resistance di atas — target dari kelipatan risiko, bukan level teknikal)' : '';
  const target = p.tp1 == null || p.tp1Pct == null
    ? `Target: ${DATA_NA}.`
    : `TP1 ${rp(p.tp1)} (+${p.tp1Pct.toFixed(1)}%)${p.tp2 != null && p.tp2Pct != null ? `, TP2 ${rp(p.tp2)} (+${p.tp2Pct.toFixed(1)}%)` : ''}${basis}. ` +
      (p.targetRealistic == null ? 'Realistis atau tidak: DATA TIDAK TERSEDIA.'
        : p.targetRealistic ? 'Target 5–15% realistis dengan volatilitas (ATR) saat ini.'
          : p.tp1Pct < SW_TARGET_MIN_PCT ? 'Ruang ke TP1 < 5% — kurang menarik untuk swing.'
            : p.tp1Pct > SW_TARGET_MAX_PCT ? 'TP1 > 15% — ambil sebagian lebih awal, target penuh kurang realistis dalam 3–10 hari.'
              : 'Volatilitas (ATR) terlalu rendah untuk mencapai TP1 dalam 3–10 hari.');

  // 4. Invalidation
  const invalidation = p.sl == null
    ? `SL: ${DATA_NA}.`
    : `Invalidasi bila close di bawah ${rp(p.sl)}${p.entryTrigger ? ` (−${(((p.entryTrigger - p.sl) / p.entryTrigger) * 100).toFixed(1)}% dari trigger)` : ''}. Risiko maks ${SW_RISK_PER_TRADE_PCT}% modal per transaksi, tanpa averaging down. R:R ${p.riskReward == null ? DATA_NA : `1:${p.riskReward.toFixed(2)}`}.`;

  // 5. Reasons not to enter
  const against = [
    ...p.riskChecks.filter((c) => !c.ok).map((c) => c.label),
    ...p.setupChecks.filter((c) => !c.ok).map((c) => c.label),
  ];
  if (p.chasing) against.push('Harga terlalu jauh dari entry ideal');
  const reasonsNotToEnter = (against.length > 0 ? `${against.slice(0, 4).join('; ')}.` : 'Tidak ada kriteria yang gagal — tetap tunggu trigger, "buy area" bukan BUY otomatis.') + ` ${eod}`;

  return { why, trigger, target, invalidation, reasonsNotToEnter };
}
