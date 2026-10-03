/**
 * dayTrading.ts
 *
 * Day Trading screener (spec: docs/features_daytrading.md).
 *
 * Pipeline: indikator dari OHLCV EOD → filter utama (setup + risk gate) → skor tertimbang
 * (Trend 25 / Momentum 25 / Volume 20 / Liquidity 15 / Risk-Reward 15) → status
 * DAY TRADE SETUP / WATCH / NO TRADE + rencana entry (trigger, TP, SL, R:R).
 *
 * Semua angka berbasis data EOD terakhir — bukan kondisi realtime. Entry trigger adalah level
 * yang HARUS ditembus besok (break high hari ini), bukan harga beli sekarang. Indikator yang tidak
 * bisa dihitung dikembalikan sebagai null (UI menampilkan "DATA TIDAK TERSEDIA"), tidak dikarang.
 */

import { OHLCVBar } from '@/domain/models/History';
import { StockSummary } from '@/domain/models/Stock';
import { atr } from '@/domain/indicators/atr';
import { ema, lastValid } from '@/domain/indicators/movingAverages';
import { rsi } from '@/domain/indicators/rsi';
import { relativeVolume } from '@/domain/indicators/volume';
import { computeDataFreshness, DataFreshness } from '@/domain/analysis/dataFreshness';
import { idxTickSize } from '@/domain/analysis/idxTick';
import { ceilTick, clamp, DATA_NA, floorTick, fmt, nearestResistance, num, rp, SetupCheck, tickUp } from './setupUtils';

export type DayTradingStatus = 'SETUP' | 'WATCH' | 'NO_TRADE';

export const DAY_TRADING_STATUS_LABEL: Record<DayTradingStatus, string> = {
  SETUP: 'DAY TRADE SETUP',
  WATCH: 'WATCH',
  NO_TRADE: 'NO TRADE',
};

export { DATA_NA };

// ── Thresholds (docs/features_daytrading.md → FILTER UTAMA) ──────────────────
export const DT_PRICE_MIN = 50;
export const DT_PRICE_MAX = 5_000;
export const DT_MIN_AVG_VALUE_20D = 5_000_000_000;
export const DT_RSI_MIN = 50;
export const DT_RSI_MAX = 70;
export const DT_MIN_RVOL = 1.2;
export const DT_MIN_CLOSE_POS = 0.7;
export const DT_MIN_ATR_PCT = 2;
export const DT_MIN_UPSIDE_PCT = 5;
export const DT_MAX_GAP_UP_PCT = 8;
/** Parabolik: harga terlalu jauh di atas EMA20 atau reli 5 hari terlalu tajam. */
export const DT_MAX_EMA20_DISTANCE_PCT = 15;
export const DT_MAX_RETURN_5D_PCT = 25;
/** Jangan mengejar harga: close lebih dari 1×ATR di atas EMA9 → WAIT pullback. */
export const DT_CHASE_ATR_MULT = 1;
export const DT_SCORE_SETUP = 75;
export const DT_SCORE_WATCH = 60;
export const DT_RISK_PER_TRADE_PCT = 1;

const WEIGHTS = { trend: 0.25, momentum: 0.25, volume: 0.2, liquidity: 0.15, riskReward: 0.15 } as const;

export type DayTradingCheck = SetupCheck;

export interface DayTradingScores {
  trend: number;
  momentum: number;
  volume: number;
  liquidity: number;
  riskReward: number;
  /** 0-100 komposit tertimbang */
  total: number;
}

export interface DayTradingSetup {
  price: number;
  ema9: number | null;
  ema20: number | null;
  rsi: number | null;
  rvol: number | null;
  return1D: number;
  return1W: number | null;
  /** Posisi close di range harian, 0-1 */
  closePosition: number | null;
  atrPct: number | null;
  avgValue20D: number | null;
  gapUpPct: number | null;
  /** Resistance terdekat di atas harga (swing high 60 hari). null = tidak terdeteksi. */
  resistance: number | null;
  upsidePct: number | null;
  /** Break high hari terakhir + 1 tick — entry hanya valid jika level ini ditembus. */
  entryTrigger: number | null;
  tp: number | null;
  sl: number | null;
  riskReward: number | null;
  scores: DayTradingScores;
  status: DayTradingStatus;
  /** Filter setup (trend/momentum/volume/candle/ATR/upside). Gagal → maksimal WATCH. */
  setupChecks: DayTradingCheck[];
  /** Risk gate (harga, likuiditas, gap-up, parabolik, data). Gagal → NO TRADE. */
  riskChecks: DayTradingCheck[];
  /** Harga sudah jauh dari entry ideal — tunggu pullback, jangan kejar. */
  chasing: boolean;
  missingData: string[];
  freshness: DataFreshness | null;
  /** Jawaban: "Layak dipantau untuk DAY TRADING hari ini, dan apa trigger entry-nya?" */
  conclusion: string;
}

// ── Scoring helpers ──────────────────────────────────────────────────────────
function rsiScore(v: number | null): number {
  if (v == null) return 0;
  if (v >= 55 && v <= 65) return 100;
  if (v >= DT_RSI_MIN && v <= DT_RSI_MAX) return 75;
  if ((v >= 45 && v < DT_RSI_MIN) || (v > DT_RSI_MAX && v <= 75)) return 35;
  return 0;
}

function return1DScore(r: number): number {
  if (r <= 0) return 0;
  if (r <= 5) return 100;
  if (r <= DT_MAX_GAP_UP_PCT) return 65;
  return 25;
}

function rvolScore(v: number | null): number {
  if (v == null) return 0;
  if (v < 1) return clamp(v * 30);
  if (v < DT_MIN_RVOL) return 45;
  if (v < 1.5) return 70;
  if (v <= 3) return 100;
  return 80; // volume klimaks — bisa jadi distribusi
}

function liquidityScore(avgValue: number | null): number {
  if (avgValue == null) return 0;
  if (avgValue >= 50e9) return 100;
  if (avgValue >= 20e9) return 85;
  if (avgValue >= 10e9) return 70;
  if (avgValue >= DT_MIN_AVG_VALUE_20D) return 55;
  return clamp((avgValue / DT_MIN_AVG_VALUE_20D) * 40);
}

function riskRewardScore(rr: number | null): number {
  if (rr == null) return 0;
  if (rr >= 3) return 100;
  if (rr >= 2) return 85;
  if (rr >= 1.5) return 65;
  if (rr >= 1) return 35;
  return 0;
}

// ── Main ─────────────────────────────────────────────────────────────────────
export function computeDayTradingSetup(s: StockSummary, bars: OHLCVBar[], asOf: Date = new Date()): DayTradingSetup {
  const closes = bars.map((b) => b.close);
  const lastBar = bars[bars.length - 1];
  const prevBar = bars[bars.length - 2];
  const price = s.lastClose;

  const ema9Series = ema(closes, 9);
  const ema20Series = ema(closes, 20);
  const ema9 = num(lastValid(ema9Series));
  const ema20 = num(lastValid(ema20Series));
  const ema20Prev = num(ema20Series[ema20Series.length - 6] ?? NaN);
  const rsiLast = num(lastValid(rsi(bars, 14)));
  const rvol = num(relativeVolume(bars, 20));
  const atrLast = num(lastValid(atr(bars, 14)));
  const atrPct = atrLast != null && price > 0 ? (atrLast / price) * 100 : null;

  const return1D = s.percentChange1D;
  const close5Ago = bars.length >= 6 ? bars[bars.length - 6].close : NaN;
  const return1W = close5Ago > 0 && lastBar ? ((lastBar.close - close5Ago) / close5Ago) * 100 : null;

  const dayRange = lastBar ? lastBar.high - lastBar.low : 0;
  const closePosition = lastBar ? (dayRange > 0 ? clamp((lastBar.close - lastBar.low) / dayRange, 0, 1) : lastBar.close > lastBar.open ? 1 : 0) : null;
  const bullishCandle = lastBar ? lastBar.close > lastBar.open : false;

  const last20 = bars.slice(-20);
  const avgValue20D = last20.length >= 20 ? last20.reduce((sum, b) => sum + b.close * b.volume, 0) / last20.length : null;

  const gapUpPct = lastBar && prevBar && prevBar.close > 0 ? ((lastBar.open - prevBar.close) / prevBar.close) * 100 : null;
  const ema20DistancePct = ema20 != null && ema20 > 0 ? ((price - ema20) / ema20) * 100 : null;
  const parabolic =
    (ema20DistancePct != null && ema20DistancePct > DT_MAX_EMA20_DISTANCE_PCT) ||
    (return1W != null && return1W > DT_MAX_RETURN_5D_PCT);

  const resistance = bars.length > 5 ? nearestResistance(bars, price) : null;
  const upsidePct = resistance != null && price > 0 ? ((resistance - price) / price) * 100 : null;

  // Rencana: trigger = break high hari ini; SL = low hari ini / 1×ATR di bawah trigger (mana yang lebih dekat);
  // TP = resistance terdekat (1 tick di bawahnya). Tanpa resistance → TP tidak dikarang.
  let entryTrigger: number | null = null;
  let tp: number | null = null;
  let sl: number | null = null;
  let riskReward: number | null = null;
  if (lastBar) {
    entryTrigger = tickUp(Math.max(lastBar.high, price));
    const slByLow = lastBar.low - idxTickSize(lastBar.low);
    const slByAtr = atrLast != null ? entryTrigger - atrLast : slByLow;
    sl = floorTick(Math.max(slByLow, slByAtr));
    if (sl >= entryTrigger) sl = floorTick(entryTrigger - idxTickSize(entryTrigger));
    if (resistance != null && resistance > entryTrigger) {
      tp = floorTick(resistance - idxTickSize(resistance));
      if (tp <= entryTrigger) tp = ceilTick(resistance);
      const risk = entryTrigger - sl;
      riskReward = risk > 0 ? Math.round(((tp - entryTrigger) / risk) * 100) / 100 : null;
    }
  }

  const chasing = ema9 != null && atrLast != null && price - ema9 > atrLast * DT_CHASE_ATR_MULT;

  const freshness = computeDataFreshness(bars, asOf);

  // ── Missing data ──
  const missingData: string[] = [];
  if (ema9 == null) missingData.push('EMA9');
  if (ema20 == null) missingData.push('EMA20');
  if (rsiLast == null) missingData.push('RSI');
  if (rvol == null) missingData.push('RVOL');
  if (atrPct == null) missingData.push('ATR');
  if (avgValue20D == null) missingData.push('Avg Value 20D');
  if (return1W == null) missingData.push('Return 1W');

  // ── Risk gate (gagal → NO TRADE) ──
  const riskChecks: DayTradingCheck[] = [
    { ok: price >= DT_PRICE_MIN && price <= DT_PRICE_MAX, label: `Harga Rp${DT_PRICE_MIN}–Rp${DT_PRICE_MAX.toLocaleString('id-ID')}` },
    avgValue20D == null
      ? { ok: false, missing: true, label: `Avg Value 20D: ${DATA_NA}` }
      : { ok: avgValue20D >= DT_MIN_AVG_VALUE_20D, label: `Avg Value 20D ≥ Rp5 M (Rp${(avgValue20D / 1e9).toFixed(1)} M)` },
    gapUpPct == null
      ? { ok: false, missing: true, label: `Gap-up: ${DATA_NA}` }
      : { ok: gapUpPct <= DT_MAX_GAP_UP_PCT, label: `Tidak gap-up > ${DT_MAX_GAP_UP_PCT}% (${gapUpPct.toFixed(1)}%)` },
    { ok: !parabolic, label: parabolic ? 'Kondisi terlalu parabolik' : 'Tidak parabolik' },
    { ok: missingData.length === 0, missing: missingData.length > 0, label: missingData.length === 0 ? 'Indikator penting lengkap' : `${DATA_NA}: ${missingData.join(', ')}` },
    { ok: freshness?.tier !== 'stale', label: freshness ? `Data EOD H-${freshness.ageInTradingDays}` : `Data harga: ${DATA_NA}` },
  ];

  // ── Setup filter (gagal → maksimal WATCH / trigger belum valid) ──
  const setupChecks: DayTradingCheck[] = [
    { ok: ema20 != null && price > ema20, missing: ema20 == null, label: `Price > EMA20 (${fmt(ema20, 0)})` },
    { ok: ema9 != null && ema20 != null && ema9 > ema20, missing: ema9 == null || ema20 == null, label: 'EMA9 > EMA20' },
    { ok: rsiLast != null && rsiLast >= DT_RSI_MIN && rsiLast <= DT_RSI_MAX, missing: rsiLast == null, label: `RSI ${DT_RSI_MIN}–${DT_RSI_MAX} (${fmt(rsiLast)})` },
    { ok: rvol != null && rvol >= DT_MIN_RVOL, missing: rvol == null, label: `RVOL ≥ ${DT_MIN_RVOL}x (${fmt(rvol, 2)})` },
    { ok: return1D > 0, label: `Return 1D > 0% (${return1D.toFixed(2)}%)` },
    { ok: return1W != null && return1W > 0, missing: return1W == null, label: `Return 1W > 0% (${fmt(return1W, 2)}%)` },
    { ok: bullishCandle && closePosition != null && closePosition >= DT_MIN_CLOSE_POS, missing: closePosition == null, label: `Candle bullish, close ≥ 70% range (${closePosition == null ? DATA_NA : `${Math.round(closePosition * 100)}%`})` },
    { ok: atrPct != null && atrPct >= DT_MIN_ATR_PCT, missing: atrPct == null, label: `ATR% ≥ ${DT_MIN_ATR_PCT}% (${fmt(atrPct)}%)` },
    { ok: upsidePct != null && upsidePct >= DT_MIN_UPSIDE_PCT, missing: upsidePct == null, label: `Upside ke resistance ≥ ${DT_MIN_UPSIDE_PCT}% (${upsidePct == null ? 'resistance tidak terdeteksi' : `${upsidePct.toFixed(1)}%`})` },
  ];

  // ── Scoring ──
  const trend = Math.round(
    (ema20 != null && price > ema20 ? 40 : 0) +
    (ema9 != null && ema20 != null && ema9 > ema20 ? 35 : 0) +
    (ema20 != null && ema20Prev != null && ema20 > ema20Prev ? 25 : 0),
  );
  const return1WScore = return1W == null || return1W <= 0 ? 0 : clamp(60 + return1W * 4);
  const momentum = Math.round(
    rsiScore(rsiLast) * 0.35 +
    return1DScore(return1D) * 0.25 +
    return1WScore * 0.15 +
    (closePosition != null ? closePosition * 100 : 0) * 0.25,
  );
  const volume = Math.round(rvolScore(rvol));
  const liquidity = Math.round(liquidityScore(avgValue20D));
  const rrScore = Math.round(riskRewardScore(riskReward));
  const total = Math.round(
    trend * WEIGHTS.trend + momentum * WEIGHTS.momentum + volume * WEIGHTS.volume +
    liquidity * WEIGHTS.liquidity + rrScore * WEIGHTS.riskReward,
  );
  const scores: DayTradingScores = { trend, momentum, volume, liquidity, riskReward: rrScore, total };

  // ── Status: skor tinggi saja tidak cukup untuk SETUP ──
  const riskGateFailed = riskChecks.some((c) => !c.ok);
  const setupValid = setupChecks.every((c) => c.ok) && riskReward != null && !chasing;
  const status: DayTradingStatus =
    riskGateFailed || total < DT_SCORE_WATCH ? 'NO_TRADE'
      : total >= DT_SCORE_SETUP && setupValid ? 'SETUP'
        : 'WATCH';

  const conclusion = buildConclusion({
    status, total, riskChecks, setupChecks, chasing, entryTrigger, tp, sl, riskReward, ema9, freshness,
  });

  return {
    price,
    ema9,
    ema20,
    rsi: rsiLast,
    rvol,
    return1D,
    return1W,
    closePosition,
    atrPct,
    avgValue20D,
    gapUpPct,
    resistance,
    upsidePct,
    entryTrigger,
    tp,
    sl,
    riskReward,
    scores,
    status,
    setupChecks,
    riskChecks,
    chasing,
    missingData,
    freshness,
    conclusion,
  };
}

function buildConclusion(p: {
  status: DayTradingStatus;
  total: number;
  riskChecks: DayTradingCheck[];
  setupChecks: DayTradingCheck[];
  chasing: boolean;
  entryTrigger: number | null;
  tp: number | null;
  sl: number | null;
  riskReward: number | null;
  ema9: number | null;
  freshness: DataFreshness | null;
}): string {
  const eod = p.freshness ? `Berbasis data EOD ${p.freshness.lastBarDate}, bukan realtime.` : 'Berbasis data EOD, bukan realtime.';
  const plan = `Trigger entry: break ${rp(p.entryTrigger)} · TP ${rp(p.tp)} · SL ${rp(p.sl)} · R:R ${p.riskReward == null ? DATA_NA : p.riskReward.toFixed(2)}.`;
  const sizing = `Risiko maks ${DT_RISK_PER_TRADE_PCT}% modal per transaksi, tanpa averaging down.`;

  if (p.status === 'NO_TRADE') {
    const failed = p.riskChecks.filter((c) => !c.ok).map((c) => c.label);
    const why = failed.length > 0 ? `Risk gate gagal: ${failed.join('; ')}.` : `Skor ${p.total}/100 di bawah ${DT_SCORE_WATCH}.`;
    return `Tidak layak untuk day trading hari ini. ${why} ${eod}`;
  }
  if (p.status === 'WATCH') {
    const pending = p.setupChecks.filter((c) => !c.ok).map((c) => c.label);
    const parts = [`Layak dipantau, belum entry (skor ${p.total}/100).`];
    if (p.chasing) parts.push(`Harga sudah jauh dari entry ideal (EMA9 ${rp(p.ema9 == null ? null : Math.round(p.ema9))}) — WAIT pullback, jangan kejar.`);
    if (pending.length > 0) parts.push(`Belum valid: ${pending.slice(0, 3).join('; ')}.`);
    if (p.riskReward == null) parts.push('Resistance/target tidak terdeteksi — R:R tidak dapat dihitung.');
    parts.push(plan, eod);
    return parts.join(' ');
  }
  return `Layak dipantau untuk day trading hari ini (skor ${p.total}/100). Entry HANYA jika trigger terpenuhi. ${plan} ${sizing} ${eod}`;
}
