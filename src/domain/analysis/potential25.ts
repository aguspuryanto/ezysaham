/**
 * potential25.ts
 *
 * "POTENTIAL 25% CANDIDATE" screener (features_potensi_25.md): stocks priced
 * Rp50–999 that are building momentum AND have a structural target ≥25% above
 * the current close. It flags *technical potential*, never a guaranteed 25%.
 *
 * EOD daily bars only (swing 1–5 days) — no intraday data is assumed.
 *
 * Status follows the spec's principles, independent of the score:
 *  - breakout not confirmed                    → WAIT
 *  - breakout + volume + momentum confirmed    → BUY_CANDIDATE
 *  - already extended / FOMO                   → NO_TRADE
 */

import { OHLCVBar } from '@/domain/models/History';
import { closes, ema, sma } from '@/domain/indicators/movingAverages';
import { roundToTick } from '@/domain/analysis/idxTick';
import { MarketRegime } from '@/domain/analysis/marketRegimeEngine';

// ── Thresholds ──────────────────────────────────────────────────────────────
export const P25_MIN_PRICE = 50;
export const P25_MAX_PRICE = 999;
/** Avg daily traded value (close × volume, 20 days) — below this, fills/exits are unreliable. */
export const P25_MIN_AVG_VALUE = 1_000_000_000;
export const P25_MIN_UPSIDE_PCT = 25;
const MIN_BARS = 60;
const RVOL_MIN = 1.5;
const BASE_LOOKBACK = 20;
const PIVOT_WING = 5;
/** Close this far above EMA18 = stretched on its own… */
const MAX_EMA18_STRETCH = 0.25;
/** …or this far above EMA18 right after a fast 5-day run (sub-Rp1.000 names swing hard, so 15% alone is normal). */
const EMA18_STRETCH_AFTER_RUN = 0.15;
const RUN_5D = 0.15;
/** Close more than this far past the breakout level = the move already happened. */
const MAX_PAST_BREAKOUT = 0.08;
const MAX_GAIN_5D = 0.3;
/** FOMO line: never chase more than this above the breakout level. */
const FOMO_ABOVE_BREAKOUT = 0.05;

// ── Types ───────────────────────────────────────────────────────────────────
export type P25Class = 'POTENTIAL_25' | 'MOMENTUM_CANDIDATE' | 'WATCHLIST' | 'SKIP';
export type P25Action = 'BUY_CANDIDATE' | 'WAIT' | 'NO_TRADE';
export type P25Tone = 'good' | 'fair' | 'bad';
export type P25Phase = 'Pre-breakout' | 'Breakout' | 'Accumulation' | 'Uptrend' | 'Distribution';
export type P25FactorKey = 'trend' | 'volume' | 'proximity' | 'candle' | 'upside' | 'accumulation' | 'market';

export const P25_FACTOR_MAX: Record<P25FactorKey, number> = {
  trend: 20,
  volume: 20,
  proximity: 15,
  candle: 15,
  upside: 15,
  accumulation: 10,
  market: 5,
};

export const P25_FACTOR_LABEL: Record<P25FactorKey, string> = {
  trend: 'Trend Structure',
  volume: 'Volume / RVOL',
  proximity: 'Breakout Proximity',
  candle: 'Momentum Candle',
  upside: 'Resistance Upside',
  accumulation: 'Akumulasi (proxy)',
  market: 'Market Condition',
};

export interface P25Factor {
  key: P25FactorKey;
  points: number;
  max: number;
  note: string;
}

export interface P25Check {
  label: string;
  value: string;
  tone: P25Tone;
}

export interface P25Target {
  price: number;
  upsidePct: number;
  source: string;
}

export interface Potential25Result {
  price: number;
  changePct: number;
  date: string;
  score: number;
  classification: P25Class;
  action: P25Action;
  /** Short reason for the action, e.g. "Breakout belum terkonfirmasi". */
  actionReason: string;
  factors: P25Factor[];
  checks: P25Check[];
  phase: P25Phase;
  base: string;
  ema8: number;
  ema18: number;
  rvol: number;
  avgValue: number;
  /** Top of the base — the level that must break. */
  resistance: number;
  /** % from close up to `resistance`; ≤0 when already above it. */
  breakoutDistancePct: number;
  breakoutConfirmed: boolean;
  targets: P25Target[];
  /** Upside to the furthest structural target, %. */
  potentialUpsidePct: number;
  entryLow: number;
  entryHigh: number;
  stopLoss: number;
  riskPct: number;
  riskReward: number;
  /** Price above which entry is considered chasing. */
  fomoPrice: number;
  extended: boolean;
  trigger: string;
  buyOnlyIf: string[];
  whyPotential: string[];
  riskGate: string[];
  fomoWarning: string;
  /** Highest-priority risk, for the table's Risk column. */
  headlineRisk: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────
const pct = (from: number, to: number) => ((to - from) / from) * 100;
const fmt = (n: number) => Math.round(n).toLocaleString('id-ID');

/** The 🔥 label also needs a structural target ≥25% away — a high score alone is not "potential 25%". */
export function p25ClassOf(score: number, upsidePct: number): P25Class {
  if (score >= 80 && upsidePct >= P25_MIN_UPSIDE_PCT) return 'POTENTIAL_25';
  if (score >= 80) return 'MOMENTUM_CANDIDATE';
  if (score >= 70) return 'MOMENTUM_CANDIDATE';
  if (score >= 60) return 'WATCHLIST';
  return 'SKIP';
}

/** Local swing highs (higher than `wing` bars on each side), oldest → newest. */
function pivotHighs(bars: OHLCVBar[], wing: number): number[] {
  const out: number[] = [];
  for (let i = wing; i < bars.length - wing; i++) {
    const h = bars[i].high;
    let isPivot = true;
    for (let j = i - wing; j <= i + wing && isPivot; j++) if (j !== i && bars[j].high > h) isPivot = false;
    if (isPivot) out.push(h);
  }
  return out;
}

/** Collapses levels within `gap` (fraction) of each other, keeping the higher one. */
function cluster(levels: Array<{ price: number; source: string }>, gap: number) {
  const sorted = [...levels].sort((a, b) => a.price - b.price);
  const out: Array<{ price: number; source: string }> = [];
  for (const l of sorted) {
    const last = out[out.length - 1];
    if (last && l.price <= last.price * (1 + gap)) out[out.length - 1] = l.price >= last.price ? l : last;
    else out.push(l);
  }
  return out;
}

/**
 * Evaluates one stock. Returns null when it fails the hard gates of the spec
 * (price band, liquidity, EMA8/18 trend, above/reclaiming EMA18) or has too little history.
 * `bars` must be daily EOD bars, oldest first, ending on the evaluation date.
 */
export function evaluatePotential25(bars: OHLCVBar[], market: MarketRegime | null): Potential25Result | null {
  const valid = bars.filter((b) => b.close > 0 && b.high > 0 && b.low > 0);
  if (valid.length < MIN_BARS) return null;

  const n = valid.length;
  const last = valid[n - 1];
  const prev = valid[n - 2];
  const price = last.close;
  if (price < P25_MIN_PRICE || price > P25_MAX_PRICE) return null;

  // Liquidity
  const recent20 = valid.slice(-20);
  const avgValue = recent20.reduce((s, b) => s + b.close * b.volume, 0) / recent20.length;
  if (avgValue < P25_MIN_AVG_VALUE) return null;

  // EMA structure
  const cls = closes(valid);
  const e8 = ema(cls, 8);
  const e18 = ema(cls, 18);
  const ema8 = e8[n - 1];
  const ema18 = e18[n - 1];
  const ema18Rising = ema18 > e18[n - 4];
  const bullishEma = ema8 > ema18;
  const crossedRecently = bullishEma && [2, 3, 4, 5, 6].some((k) => e8[n - k] <= e18[n - k]);
  const aboveEma18 = price > ema18;
  const reclaimEma18 = aboveEma18 && [2, 3, 4].some((k) => valid[n - k].close < e18[n - k]);
  // Hard gate: bullish (or freshly crossing) EMA8/18 and price above / reclaiming EMA18.
  if (!bullishEma || price < ema18 * 0.99) return null;

  const lows10 = valid.slice(-10).map((b) => b.low);
  const lowsPrev10 = valid.slice(-20, -10).map((b) => b.low);
  const higherLow = Math.min(...lows10) > Math.min(...lowsPrev10);

  // Volume
  const vol20 = sma(valid.map((b) => b.volume), 20);
  const avgVolPrior = vol20[n - 2];
  const rvol = avgVolPrior > 0 ? last.volume / avgVolPrior : 0;

  // Candle
  const range = last.high - last.low;
  const closePos = range > 0 ? (last.close - last.low) / range : 0.5;
  const bodyRatio = range > 0 ? Math.abs(last.close - last.open) / range : 0;
  const green = last.close > last.open && last.close > prev.close;
  const changePct = pct(prev.close, last.close);
  const gapPct = pct(prev.close, last.open);
  const strongCandle = green && closePos >= 0.7 && bodyRatio >= 0.5;

  // Base / resistance: highest high of the prior 20 bars (today excluded).
  const baseBars = valid.slice(-(BASE_LOOKBACK + 1), -1);
  const resistance = Math.max(...baseBars.map((b) => b.high));
  const baseLow = Math.min(...baseBars.map((b) => b.low));
  const baseDepth = (resistance - baseLow) / resistance;
  const breakoutDistancePct = pct(price, resistance);
  const brokeOut = price > resistance;
  const breakoutConfirmed = brokeOut && rvol >= RVOL_MIN && strongCandle;
  const firstHalfLow = Math.min(...baseBars.slice(0, 10).map((b) => b.low));
  const secondHalfLow = Math.min(...baseBars.slice(10).map((b) => b.low));
  const base = baseDepth <= 0.15
    ? 'Flat Base'
    : secondHalfLow > firstHalfLow * 1.02 ? 'Ascending Base' : baseDepth <= 0.3 ? 'Base konsolidasi' : 'Tidak ada base jelas';

  // Extension / FOMO
  const gain5d = pct(valid[n - 6].close, price) / 100;
  const stretchedEma = price > ema18 * (1 + MAX_EMA18_STRETCH) || (price > ema18 * (1 + EMA18_STRETCH_AFTER_RUN) && gain5d > RUN_5D);
  const pastBreakout = price > resistance * (1 + MAX_PAST_BREAKOUT);
  const extended = stretchedEma || pastBreakout || gain5d > MAX_GAIN_5D;
  const fomoPrice = roundToTick(resistance * (1 + FOMO_ABOVE_BREAKOUT));

  // Structural targets above the breakout level: swing highs (1y), 52w high, measured move.
  const floor = Math.max(price, resistance) * 1.02;
  const candidates: Array<{ price: number; source: string }> = [];
  for (const h of pivotHighs(valid.slice(0, -1), PIVOT_WING)) if (h > floor) candidates.push({ price: h, source: 'Swing high' });
  const yearHigh = Math.max(...valid.map((b) => b.high));
  if (yearHigh > floor) candidates.push({ price: yearHigh, source: 'High 1 tahun' });
  const measured = resistance + (resistance - baseLow);
  if (measured > floor) candidates.push({ price: measured, source: 'Measured move' });
  const targets: P25Target[] = cluster(candidates, 0.04)
    .slice(0, 3)
    .map((t) => ({ price: roundToTick(t.price), upsidePct: pct(price, roundToTick(t.price)), source: t.source }));
  const potentialUpsidePct = targets.length > 0 ? targets[targets.length - 1].upsidePct : 0;

  // Accumulation proxy (no foreign-flow data in EOD bars): OBV trend + up/down volume.
  let obv = 0;
  const obvSeries: number[] = [];
  for (let i = 1; i < n; i++) {
    obv += valid[i].close > valid[i - 1].close ? valid[i].volume : valid[i].close < valid[i - 1].close ? -valid[i].volume : 0;
    obvSeries.push(obv);
  }
  const obvRising = obvSeries[obvSeries.length - 1] > obvSeries[obvSeries.length - 21];
  let upVol = 0;
  let downVol = 0;
  for (let i = n - 20; i < n; i++) {
    if (valid[i].close > valid[i - 1].close) upVol += valid[i].volume;
    else if (valid[i].close < valid[i - 1].close) downVol += valid[i].volume;
  }
  const upDownRatio = downVol > 0 ? upVol / downVol : upVol > 0 ? 3 : 1;

  // ── Scoring ───────────────────────────────────────────────────────────────
  const trendPts = (bullishEma ? 6 : 0) + (aboveEma18 ? 5 : 0) + (ema18Rising ? 5 : 0) + (higherLow ? 4 : 0);
  const volumePts = rvol >= 3 ? 20 : rvol >= 2 ? 17 : rvol >= RVOL_MIN ? 13 : rvol >= 1.2 ? 7 : rvol >= 1 ? 4 : 0;
  const proximityPts = pastBreakout
    ? 3
    : brokeOut ? 15 : breakoutDistancePct <= 3 ? 13 : breakoutDistancePct <= 6 ? 10 : breakoutDistancePct <= 10 ? 6 : 0;
  const candlePts = strongCandle ? 15 : green && closePos >= 0.6 ? 10 : green ? 5 : 0;
  const upsidePts = potentialUpsidePct >= 40 ? 15 : potentialUpsidePct >= P25_MIN_UPSIDE_PCT ? 12 : potentialUpsidePct >= 15 ? 6 : 0;
  const accumulationPts = (obvRising ? 5 : 0) + (upDownRatio >= 1.5 ? 5 : upDownRatio >= 1.2 ? 3 : 0);
  const marketPts = market === 'bullish' ? 5 : market === 'neutral' ? 3 : market === 'bearish' ? 0 : 2;

  const factors: P25Factor[] = [
    { key: 'trend', points: trendPts, max: 20, note: [bullishEma && (crossedRecently ? 'EMA8 baru cross di atas EMA18' : 'EMA8 > EMA18'), aboveEma18 && (reclaimEma18 ? 'reclaim EMA18' : 'harga > EMA18'), ema18Rising ? 'EMA18 naik' : 'EMA18 belum naik', higherLow ? 'higher low' : 'belum higher low'].filter(Boolean).join(' · ') },
    { key: 'volume', points: volumePts, max: 20, note: `RVOL ${rvol.toFixed(1)}x vs rata-rata 20 hari` },
    { key: 'proximity', points: proximityPts, max: 15, note: brokeOut ? `Sudah di atas resistance ${fmt(resistance)}` : `${breakoutDistancePct.toFixed(1)}% di bawah resistance ${fmt(resistance)}` },
    { key: 'candle', points: candlePts, max: 15, note: strongCandle ? 'Candle hijau, close dekat high' : green ? 'Candle hijau, close belum kuat' : 'Bukan candle momentum' },
    { key: 'upside', points: upsidePts, max: 15, note: targets.length ? `Target terjauh +${potentialUpsidePct.toFixed(0)}% (${targets[targets.length - 1].source})` : 'Tidak ada target struktural di atas' },
    { key: 'accumulation', points: accumulationPts, max: 10, note: `OBV ${obvRising ? 'naik' : 'turun'} · volume naik/turun ${upDownRatio.toFixed(1)}x (proxy — data foreign flow tidak tersedia)` },
    { key: 'market', points: marketPts, max: 5, note: market ? `IHSG ${market === 'bullish' ? 'bullish' : market === 'neutral' ? 'netral' : 'bearish'}` : 'Kondisi IHSG belum tersedia' },
  ];
  const score = Math.min(100, factors.reduce((s, f) => s + f.points, 0));
  const classification = p25ClassOf(score, potentialUpsidePct);

  // ── Plan ──────────────────────────────────────────────────────────────────
  const entryLow = roundToTick(resistance);
  const entryHigh = roundToTick(Math.min(resistance * 1.03, fomoPrice));
  const swingLow5 = Math.min(...valid.slice(-5).map((b) => b.low));
  const slRaw = Math.min(entryLow * 0.97, Math.max(entryLow * 0.94, swingLow5 * 0.99));
  const stopLoss = roundToTick(slRaw);
  const entryMid = (entryLow + entryHigh) / 2;
  const riskPct = pct(entryMid, stopLoss) * -1;
  const riskReward = targets.length && entryMid > stopLoss ? (targets[0].price - entryMid) / (entryMid - stopLoss) : 0;

  const triggerLevel = fmt(entryLow);
  const trigger = brokeOut
    ? `Bertahan > ${triggerLevel} + volume > 1,5x`
    : `Close > ${triggerLevel} + volume > 1,5x + candle close kuat`;
  const buyOnlyIf = [`Close menembus ${triggerLevel}`, 'Volume > 1,5x rata-rata 20 hari', 'Candle hijau, close dekat high'];
  const fomoWarning = `Jangan entry jika harga sudah > ${fmt(fomoPrice)}`;

  // ── Action (score alone never makes it a BUY) ─────────────────────────────
  let action: P25Action;
  let actionReason: string;
  if (extended) {
    action = 'NO_TRADE';
    actionReason = pastBreakout ? 'Sudah jauh di atas breakout — terlambat' : stretchedEma ? 'Terlalu jauh di atas EMA18 (extended)' : 'Naik >30% dalam 5 hari (FOMO)';
  } else if (classification === 'SKIP') {
    action = 'NO_TRADE';
    actionReason = 'Skor di bawah 60';
  } else if (breakoutConfirmed && potentialUpsidePct >= P25_MIN_UPSIDE_PCT && score >= 70) {
    action = 'BUY_CANDIDATE';
    actionReason = 'Breakout + volume + momentum terkonfirmasi';
  } else {
    action = 'WAIT';
    actionReason = brokeOut ? 'Breakout belum dikonfirmasi volume/candle' : 'Tunggu breakout terkonfirmasi';
  }

  // ── Narrative ─────────────────────────────────────────────────────────────
  const whyPotential: string[] = [];
  if (bullishEma) whyPotential.push(crossedRecently ? 'EMA8 baru bullish cross di atas EMA18' : 'EMA8 di atas EMA18 (trend jangka pendek bullish)');
  if (ema18Rising) whyPotential.push('EMA18 mulai menanjak');
  if (higherLow) whyPotential.push('Struktur higher low terbentuk');
  if (rvol >= RVOL_MIN) whyPotential.push(`Volume ${rvol.toFixed(1)}x rata-rata — ada partisipasi`);
  if (strongCandle) whyPotential.push('Candle momentum, close dekat high');
  if (!brokeOut && breakoutDistancePct <= 10) whyPotential.push(`Hanya ${breakoutDistancePct.toFixed(1)}% di bawah resistance ${fmt(resistance)}`);
  if (brokeOut && !pastBreakout) whyPotential.push(`Menembus resistance ${fmt(resistance)}`);
  if (potentialUpsidePct >= P25_MIN_UPSIDE_PCT) whyPotential.push(`Ruang ke target struktural +${potentialUpsidePct.toFixed(0)}%`);
  if (base !== 'Tidak ada base jelas') whyPotential.push(`${base} ${Math.round(baseDepth * 100)}% selama ${BASE_LOOKBACK} hari`);

  const riskGate: string[] = [];
  if (extended) riskGate.push(actionReason);
  if (brokeOut) riskGate.push(`False breakout jika close kembali < ${triggerLevel}`);
  if (rvol < RVOL_MIN) riskGate.push(`Volume belum cukup (RVOL ${rvol.toFixed(1)}x < 1,5x)`);
  if (!strongCandle) riskGate.push('Candle belum close kuat');
  if (gapPct > 10) riskGate.push(`Gap up ${gapPct.toFixed(1)}% — rawan false breakout`);
  if (changePct >= 15) riskGate.push(`Naik ${changePct.toFixed(1)}% hari ini — dekat ARA, rawan profit taking`);
  if (potentialUpsidePct < P25_MIN_UPSIDE_PCT) riskGate.push(`Upside target struktural hanya +${potentialUpsidePct.toFixed(0)}% (< 25%)`);
  if (targets.length > 0 && riskReward < 2) riskGate.push(`R:R ke TP1 hanya 1:${riskReward.toFixed(1)} (< 1:2)`);
  if (market === 'bearish') riskGate.push('IHSG bearish — breakout lebih mudah gagal');
  if (avgValue < 3_000_000_000) riskGate.push('Likuiditas tipis — gunakan ukuran posisi kecil');
  if (!ema18Rising) riskGate.push('EMA18 belum naik');

  const phase: P25Phase = breakoutConfirmed
    ? 'Breakout'
    : !green && rvol >= 2 && closePos < 0.4 ? 'Distribution'
      : !brokeOut && breakoutDistancePct <= 5 && baseDepth <= 0.2 ? 'Pre-breakout'
        : upDownRatio >= 1.3 && obvRising ? 'Accumulation' : 'Uptrend';

  const tone = (ok: boolean, mid = false): P25Tone => (ok ? 'good' : mid ? 'fair' : 'bad');
  const checks: P25Check[] = [
    { label: 'Trend', value: bullishEma && aboveEma18 && ema18Rising ? 'Bullish' : 'Mulai bullish', tone: tone(bullishEma && aboveEma18 && ema18Rising, true) },
    { label: 'Structure', value: higherLow ? 'Higher Low' : base, tone: tone(higherLow, base !== 'Tidak ada base jelas') },
    { label: 'EMA 8/18', value: crossedRecently ? 'Bullish cross' : 'Bullish', tone: 'good' },
    { label: 'RVOL', value: `${rvol.toFixed(1)}x`, tone: tone(rvol >= 2, rvol >= RVOL_MIN) },
    { label: 'Breakout', value: brokeOut ? (pastBreakout ? `${Math.abs(breakoutDistancePct).toFixed(1)}% di atas` : 'Tembus') : `${breakoutDistancePct.toFixed(1)}% lagi`, tone: pastBreakout ? 'bad' : tone(breakoutConfirmed, !brokeOut ? breakoutDistancePct <= 10 : true) },
    { label: 'Upside', value: `${potentialUpsidePct.toFixed(0)}%`, tone: tone(potentialUpsidePct >= P25_MIN_UPSIDE_PCT, potentialUpsidePct >= 15) },
    { label: 'Phase', value: phase, tone: phase === 'Distribution' ? 'bad' : phase === 'Uptrend' ? 'fair' : 'good' },
  ];

  return {
    price,
    changePct,
    date: last.date,
    score,
    classification,
    action,
    actionReason,
    factors,
    checks,
    phase,
    base,
    ema8,
    ema18,
    rvol,
    avgValue,
    resistance: roundToTick(resistance),
    breakoutDistancePct,
    breakoutConfirmed,
    targets,
    potentialUpsidePct,
    entryLow,
    entryHigh,
    stopLoss,
    riskPct,
    riskReward,
    fomoPrice,
    extended,
    trigger,
    buyOnlyIf,
    whyPotential,
    riskGate,
    fomoWarning,
    headlineRisk: riskGate[0] ?? 'Risiko utama rendah',
  };
}
