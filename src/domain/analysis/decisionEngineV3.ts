/**
 * decisionEngineV3.ts
 *
 * EzySaham Decision Engine v3 (src/presentation/features/screener/detail/components/features_decision_enginev3.md).
 *
 *   DATA → DATA QUALITY → LIQUIDITY → TREND → MOMENTUM → MOMENTUM STAGE → SETUP DETECTION
 *        → ENTRY QUALITY → RISK → R:R → HORIZON DECISION → SIMPLE USER OUTPUT
 *
 * Principles:
 *   • "Momentum kuat ≠ BUY". Decision = Trend + Momentum + Entry Quality + R:R + Liquidity, decided by
 *     RULES / GATES — the component scores are shown for context only, never summed into a verdict.
 *   • Momentum is split into Strength · Quality · Stage · Risk. A top gainer (1D/1M run, far above EMA 20,
 *     RSI > 75) is CHASE RISK → stage PARABOLIC → entry BAD → AVOID CHASING, however strong the momentum.
 *   • Three setups only: BREAKOUT (needs RVOL ≥ 1.5x), PULLBACK (selling dries up + buyer returns, high
 *     RVOL not required) and TREND FOLLOWING. R:R ≥ 1.5 is computed before any BUY.
 *   • Fundamentals differ per horizon: Trading = warning only, Swing = secondary filter (smaller size),
 *     Investing = mandatory filter.
 *   • Liquidity is horizon-aware: Trading can still trade a thinner name (Avg 20D ≥ Rp 300 jt) with a
 *     position cap; Swing needs the Avg 20D ≥ Rp 1 M baseline.
 *   • Risk-based position sizing: Max Risk = Capital × Risk% · Size = Max Risk / (Entry − SL).
 *   • The user-facing output (`simple`) is plain language; technical detail lives in the other fields.
 *
 * Evidence (candle read, liquidity view, Fundamental / Market / Execution risk split, valuation context,
 * hot-money flags) is reused from momentumSpeculation.ts (v2). Its BUY/WAIT/AVOID gates are superseded here.
 * Pure & deterministic — a missing input never turns into a guessed value.
 */

import { idxTickSize, roundToTick } from '@/domain/analysis/idxTick';
import {
  buildMomentumReport,
  fmtIdrValue,
  GOOD_LIQUID_VALUE,
  MIN_LIQUID_VALUE,
  MomentumInput,
  MomentumReport,
  PlanTarget,
  RiskLevel,
} from '@/domain/analysis/momentumSpeculation';
import { pickTargets, validatePlanLevels } from '@/domain/analysis/tradingModesReview';
import { ema } from '@/domain/indicators/movingAverages';

// ─── Thresholds ─────────────────────────────────────────────────────────────────

export const MIN_RR = 1.5;
/** SL further than this from entry is not a tight technical stop. */
export const MAX_SL_PCT = 8;
/** Price ≤ this % above EMA 20 still counts as an early entry. */
export const EARLY_DIST_PCT = 5;
/** Price above this % over EMA 20 is EXTENDED — wait for a pullback. */
export const EXTENDED_DIST_PCT = 8;
/** Top-gainer protection (CHASE RISK) triggers. */
export const CHASE_DIST_PCT = 15;
export const CHASE_RSI = 75;
export const CHASE_1D_PCT = 10;
export const CHASE_1W_PCT = 25;
export const CHASE_1M_PCT = 40;
/** Breakout must be volume-confirmed. */
export const BREAKOUT_RVOL = 1.5;
/** Don't buy a breakout more than this % above the breakout level. */
export const BREAKOUT_MAX_CHASE_PCT = 3;
/** Trading can still be done (smaller size) down to this Avg 20D traded value. */
export const LIMITED_LIQUID_VALUE = 300e6;
/** A retail position should stay under this share of the average daily traded value. */
export const LIQUIDITY_PARTICIPATION = 0.01;

// ─── Types ──────────────────────────────────────────────────────────────────────

export type Decision = 'BUY' | 'WAIT' | 'AVOID';
export type Horizon = 'trading' | 'swing' | 'investing';
export type DecisionTag = 'AVOID CHASING' | 'EARLY MOMENTUM' | 'BUY CANDIDATE';
export type TrendDirection = 'BULLISH' | 'BEARISH' | 'SIDEWAYS' | 'NA';
export type TrendStrength = 'STRONG' | 'MODERATE' | 'WEAK' | 'NA';
export type MomentumStrengthLabel = 'VERY_STRONG' | 'STRONG' | 'MODERATE' | 'WEAK' | 'NA';
export type MomentumQuality = 'GOOD' | 'FAIR' | 'POOR' | 'NA';
export type MomentumStage = 'EARLY' | 'CONFIRMED' | 'EXTENDED' | 'PARABOLIC' | 'NONE';
export type Level = 'LOW' | 'MEDIUM' | 'HIGH';
export type SetupKind = 'BREAKOUT' | 'PULLBACK' | 'TREND_FOLLOWING';
export type SetupState = 'VALID' | 'FORMING' | 'INVALID';
export type EntryQuality = 'GOOD' | 'FAIR' | 'POOR' | 'BAD';
export type LiquidityGate = 'PASS' | 'LIMITED' | 'FAIL';

export interface TrendAssessment {
  direction: TrendDirection;
  strength: TrendStrength;
  /** % change of EMA 20 / EMA 50 over the last 5 sessions. */
  ema20Slope: number | null;
  ema50Slope: number | null;
  /** Last 10 sessions' low above the previous 10 sessions' low. */
  higherLows: boolean | null;
  /** Bullish EMA order but price dipped ≤ 2% under EMA 20 (pullback inside an uptrend). */
  pullbackDip: boolean;
  score: number | null;
}

export interface MomentumAssessment {
  /** 0–100 — RSI, price change, EMA structure, candle, RVOL. */
  strength: number | null;
  strengthLabel: MomentumStrengthLabel;
  quality: MomentumQuality;
  qualityNotes: string[];
  stage: MomentumStage;
  risk: Level;
  /** % above EMA 20 (negative = below). */
  distEma20: number | null;
  /** Top-gainer protection triggers. Non-empty = CHASE RISK. */
  chaseFlags: string[];
}

export interface HotMoneyAssessment {
  strength: Level;
  risk: Level;
  flags: string[];
}

export interface LiquidityAssessment {
  trading: LiquidityGate;
  swing: LiquidityGate;
  todayValue: number | null;
  avgValue20D: number | null;
  rvol: number | null;
  /** One tick as % of price — effective spread. */
  tickPct: number | null;
  /** Max position value (Rp) so a retail order stays ≤ 1% of the average daily traded value. */
  maxPositionValue: number | null;
  score: number | null;
  note: string;
}

export interface SetupEvaluation {
  kind: SetupKind;
  state: SetupState;
  checks: Array<{ label: string; ok: boolean }>;
  entryLow: number | null;
  entryHigh: number | null;
  /** Entry used for R:R — current price when inside the zone, otherwise the middle of the zone. */
  entryRef: number | null;
  inZone: boolean;
  sl: number | null;
  slBasis: string | null;
  targets: PlanTarget[];
  riskPct: number | null;
  rewardPct: number | null;
  riskReward: number | null;
  /** Breakout level (breakout setups only). */
  trigger: number | null;
  /** Breakout only: price closed through the level today. */
  triggered: boolean;
  /** Plain-language summary of where this setup stands. */
  note: string;
}

export interface RiskFlag {
  label: string;
  severity: 'block' | 'warn';
}

export interface RiskAssessment {
  gate: 'PASS' | 'FAIL';
  flags: RiskFlag[];
  fundamental: RiskLevel;
  market: RiskLevel;
  execution: RiskLevel;
  /** What the user sees: worst of the risk gate, trading risk and momentum risk. */
  overall: Level;
}

export interface ComponentScores {
  trend: number | null;
  momentum: number | null;
  entry: number | null;
  /** Higher = safer. */
  risk: number | null;
  liquidity: number | null;
  rr: number | null;
}

export interface PositionSizing {
  riskPerTradePct: number;
  reason: string;
  rows: Array<{ capital: number; maxLoss: number; lots: number | null; positionValue: number | null }>;
}

export interface HorizonResult {
  horizon: Horizon;
  label: string;
  status: Decision;
  tag: DecisionTag | null;
  /** Main reason only — plain language. */
  reason: string;
  /** WAIT: what to wait for. AVOID: when it becomes interesting again. */
  waitFor: string | null;
  /** Rule checks behind the status (detail view). */
  rules: Array<{ label: string; ok: boolean }>;
  warnings: string[];
}

export interface SimplePlan {
  /** true = WAIT plan, only valid after confirmation ("Buy Area" ≠ BUY). */
  conditional: boolean;
  setup: SetupKind;
  entryLow: number;
  entryHigh: number;
  targets: PlanTarget[];
  sl: number;
  riskPct: number;
  riskReward: number;
  /** "Potensi keuntungan sekitar 1,8× risiko." */
  rrText: string;
  sizing: PositionSizing;
}

export interface SimpleOutput {
  status: Decision;
  tag: DecisionTag | null;
  /** Level 1 — one sentence. */
  reason: string;
  /** Level 1 — plan (BUY) or conditional plan (WAIT with a forming setup). Never for AVOID. */
  plan: SimplePlan | null;
  risk: Level;
  riskText: 'Rendah' | 'Sedang' | 'Tinggi';
  waitFor: string | null;
  conclusion: string;
  /** Level 2 — "Kenapa?" in plain words, 2–5 short sentences. */
  why: string[];
}

export interface DecisionV3Report {
  dataOk: boolean;
  dataNote: string;
  liquidity: LiquidityAssessment;
  trend: TrendAssessment;
  momentum: MomentumAssessment;
  hotMoney: HotMoneyAssessment;
  setups: SetupEvaluation[];
  primarySetup: SetupEvaluation | null;
  entryQuality: EntryQuality;
  risk: RiskAssessment;
  scores: ComponentScores;
  earlyMomentum: boolean;
  decisions: Record<Horizon, HorizonResult>;
  simple: SimpleOutput;
  consistency: Array<{ label: string; passed: boolean }>;
  /** v2 evidence (candle, EMA/VWAP position, valuation, fundamentals) — detail view only. */
  evidence: MomentumReport;
}

// ─── Plain-language labels ──────────────────────────────────────────────────────

export const TREND_TEXT: Record<TrendDirection, string> = {
  BULLISH: 'Naik', BEARISH: 'Turun', SIDEWAYS: 'Mendatar', NA: 'Tidak tersedia',
};
export const STRENGTH_TEXT: Record<TrendStrength, string> = {
  STRONG: 'Kuat', MODERATE: 'Sedang', WEAK: 'Lemah', NA: '—',
};
export const MOMENTUM_STRENGTH_TEXT: Record<MomentumStrengthLabel, string> = {
  VERY_STRONG: 'Sangat kuat', STRONG: 'Kuat', MODERATE: 'Sedang', WEAK: 'Lemah', NA: 'Data kurang',
};
export const QUALITY_TEXT: Record<MomentumQuality, string> = {
  GOOD: 'Sehat', FAIR: 'Cukup', POOR: 'Buruk', NA: 'Data kurang',
};
export const STAGE_TEXT: Record<MomentumStage, string> = {
  EARLY: 'Awal (belum terlambat)',
  CONFIRMED: 'Terkonfirmasi',
  EXTENDED: 'Sudah jauh naik',
  PARABOLIC: 'Terlalu cepat naik (parabolik)',
  NONE: 'Belum ada momentum naik',
};
export const SETUP_TEXT: Record<SetupKind, string> = {
  BREAKOUT: 'Breakout',
  PULLBACK: 'Pullback',
  TREND_FOLLOWING: 'Ikuti trend',
};
export const SETUP_STATE_TEXT: Record<SetupState, string> = {
  VALID: 'Valid', FORMING: 'Sedang terbentuk', INVALID: 'Tidak ada',
};
export const ENTRY_QUALITY_TEXT: Record<EntryQuality, string> = {
  GOOD: 'Bagus', FAIR: 'Cukup', POOR: 'Kurang', BAD: 'Buruk (mengejar harga)',
};
export const LEVEL_TEXT: Record<Level, 'Rendah' | 'Sedang' | 'Tinggi'> = { LOW: 'Rendah', MEDIUM: 'Sedang', HIGH: 'Tinggi' };

// ─── Helpers ────────────────────────────────────────────────────────────────────

const ok = (n: number | null | undefined): n is number => n != null && Number.isFinite(n) && n > 0;
const finite = (n: number | null | undefined): n is number => n != null && Number.isFinite(n);
const pctDiff = (a: number, b: number) => ((a - b) / b) * 100;
const clamp100 = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const n1 = (n: number, dec = 1) => n.toLocaleString('id-ID', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const rp = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;
const rpZone = (lo: number, hi: number) => (lo === hi ? rp(lo) : `${rp(lo)}–${Math.round(hi).toLocaleString('id-ID')}`);
const LEVEL_RANK: Record<Level, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };
const worst = (...ls: Level[]): Level => (['LOW', 'MEDIUM', 'HIGH'] as const)[Math.max(...ls.map((l) => LEVEL_RANK[l]))];
const fromRisk = (l: RiskLevel): Level => (l === 'NA' ? 'MEDIUM' : l);

/** % change of the last valid point of `series` vs `lookback` points earlier. */
function slopePct(series: number[], lookback = 5): number | null {
  let last = series.length - 1;
  while (last >= 0 && Number.isNaN(series[last])) last--;
  const then = last - lookback;
  if (last < 0 || then < 0 || Number.isNaN(series[then]) || series[then] <= 0) return null;
  return pctDiff(series[last], series[then]);
}

// ─── 1. Liquidity ───────────────────────────────────────────────────────────────

function assessLiquidity(ev: MomentumReport, price: number): LiquidityAssessment {
  const lv = ev.liquidityView;
  const base = lv.avgValue20D ?? lv.todayValue;
  const trading: LiquidityGate = lv.status === 'LIQUID' || lv.status === 'TEMPORARY_PASS' ? 'PASS'
    : base != null && base >= LIMITED_LIQUID_VALUE ? 'LIMITED' : 'FAIL';
  const swing: LiquidityGate = lv.status === 'LIQUID' ? 'PASS' : trading === 'FAIL' ? 'FAIL' : 'LIMITED';
  const maxPositionValue = base != null ? base * LIQUIDITY_PARTICIPATION : null;
  const tickPct = price > 0 ? (idxTickSize(price) / price) * 100 : null;
  const note = trading === 'FAIL'
    ? (base == null ? 'Nilai transaksi tidak tersedia.' : `Transaksi rata-rata ${fmtIdrValue(base)}/hari — terlalu sepi, sulit menjual saat dibutuhkan.`)
    : trading === 'LIMITED'
      ? `Transaksi rata-rata ${fmtIdrValue(base)}/hari — masih bisa ditradingkan dalam jumlah kecil (maks ± ${fmtIdrValue(maxPositionValue)} per posisi).`
      : (lv.avgValue20D ?? 0) >= GOOD_LIQUID_VALUE
        ? `Transaksi rata-rata ${fmtIdrValue(lv.avgValue20D)}/hari — ramai, mudah keluar-masuk.`
        : `Transaksi rata-rata ${fmtIdrValue(base)}/hari — cukup, tetapi jaga ukuran posisi.`;
  return {
    trading, swing, todayValue: lv.todayValue, avgValue20D: lv.avgValue20D, rvol: lv.rvol, tickPct,
    maxPositionValue, score: ev.scores.liquidity.value, note,
  };
}

// ─── 2. Trend ───────────────────────────────────────────────────────────────────

export function assessTrend(i: MomentumInput): TrendAssessment {
  const price = i.price;
  if (!ok(i.ema20) || !ok(i.ema50) || !(price > 0)) {
    return { direction: 'NA', strength: 'NA', ema20Slope: null, ema50Slope: null, higherLows: null, pullbackDip: false, score: null };
  }
  const closes = i.bars.map((b) => b.close);
  const ema20Slope = slopePct(ema(closes, 20));
  const ema50Slope = slopePct(ema(closes, 50));
  const lows = i.bars.map((b) => b.low);
  const higherLows = lows.length >= 20 ? Math.min(...lows.slice(-10)) > Math.min(...lows.slice(-20, -10)) : null;
  const emaUp = i.ema20 > i.ema50;

  let direction: TrendDirection;
  let pullbackDip = false;
  if (price > i.ema20 && emaUp) direction = 'BULLISH';
  else if (price < i.ema20 && i.ema20 < i.ema50) direction = 'BEARISH';
  else if (emaUp && price > i.ema50 && price >= i.ema20 * 0.98 && (ema20Slope ?? 0) > 0) {
    direction = 'BULLISH';
    pullbackDip = true;
  } else direction = 'SIDEWAYS';

  const gap = pctDiff(i.ema20, i.ema50);
  let strength: TrendStrength;
  if (direction === 'BULLISH') {
    strength = (ema20Slope ?? 0) > 0 && (ema50Slope ?? 0) > 0 && higherLows !== false && gap >= 1.5 ? 'STRONG'
      : (ema20Slope ?? 0) > 0 && ((ema50Slope ?? 0) >= 0 || higherLows === true) ? 'MODERATE' : 'WEAK';
    if (pullbackDip && strength === 'STRONG') strength = 'MODERATE';
  } else if (direction === 'BEARISH') {
    strength = (ema20Slope ?? 0) < 0 && (ema50Slope ?? 0) < 0 ? 'STRONG' : (ema20Slope ?? 0) < 0 ? 'MODERATE' : 'WEAK';
  } else strength = 'WEAK';

  const score = direction === 'BULLISH' ? (strength === 'STRONG' ? 90 : strength === 'MODERATE' ? 72 : 58)
    : direction === 'SIDEWAYS' ? 40
      : strength === 'STRONG' ? 5 : strength === 'MODERATE' ? 15 : 25;
  return { direction, strength, ema20Slope, ema50Slope, higherLows, pullbackDip, score };
}

// ─── 3. Momentum: strength · quality · stage · risk ─────────────────────────────

function assessMomentum(i: MomentumInput, ev: MomentumReport, trend: TrendAssessment, hotRisk: Level): MomentumAssessment {
  const price = i.price;
  const dist = ok(i.ema20) ? pctDiff(price, i.ema20) : null;
  const rsi = finite(i.rsi14) ? i.rsi14 : null;
  const rvol = ok(i.rvol) ? i.rvol : null;
  const candleSig = ev.candle.signal;

  // Strength — weighted over the inputs that exist (needs ≥ 3).
  const parts: Array<[number | null, number]> = [
    [rsi == null ? null : clamp100(((rsi - 30) / 45) * 100), 25],
    [!finite(i.change1W) && !finite(i.change1M) ? null : clamp100(50 + (i.change1W ?? 0) * 2.5 + (i.change1M ?? 0)), 20],
    [ev.emaStack === 'bullish' ? 100 : trend.direction === 'BULLISH' ? 80 : trend.direction === 'SIDEWAYS' ? 45 : trend.direction === 'BEARISH' ? 10 : null, 25],
    [candleSig === 'green' ? 90 : candleSig === 'yellow' ? 55 : candleSig === 'red' ? 15 : null, 15],
    [rvol == null ? null
      : candleSig === 'red' ? (rvol >= 1.5 ? 10 : rvol >= 1 ? 30 : 45)
        : rvol >= 1.5 ? 95 : rvol >= 1 ? 75 : rvol >= 0.8 ? 60 : rvol >= 0.5 ? 40 : 20, 15],
  ];
  const known = parts.filter((p): p is [number, number] => p[0] != null);
  const strength = known.length < 3 ? null
    : clamp100(known.reduce((s, [v, w]) => s + v * w, 0) / known.reduce((s, [, w]) => s + w, 0));
  const strengthLabel: MomentumStrengthLabel = strength == null ? 'NA'
    : strength >= 80 ? 'VERY_STRONG' : strength >= 65 ? 'STRONG' : strength >= 45 ? 'MODERATE' : 'WEAK';

  // Top gainer protection.
  const chaseFlags = [
    finite(i.change1D) && i.change1D >= CHASE_1D_PCT && `Naik ${n1(i.change1D)}% dalam 1 hari`,
    finite(i.change1W) && i.change1W >= CHASE_1W_PCT && `Naik ${n1(i.change1W)}% dalam 1 minggu`,
    finite(i.change1M) && i.change1M >= CHASE_1M_PCT && `Naik ${n1(i.change1M)}% dalam 1 bulan`,
    dist != null && dist >= CHASE_DIST_PCT && `Harga ${n1(dist)}% di atas EMA 20`,
    rsi != null && rsi > CHASE_RSI && `RSI ${n1(rsi)} (> ${CHASE_RSI}, overbought)`,
  ].filter((x): x is string => Boolean(x));

  // Stage.
  const upish = trend.direction === 'BULLISH' || (trend.direction === 'SIDEWAYS' && dist != null && dist > 0 && (trend.ema20Slope ?? 0) > 0);
  const earlyShape = dist != null && dist <= EARLY_DIST_PCT && (rsi == null || (rsi >= 50 && rsi <= 65));
  const stage: MomentumStage = chaseFlags.length > 0 ? 'PARABOLIC'
    : !upish ? 'NONE'
      : (dist != null && dist > EXTENDED_DIST_PCT) || (rsi != null && rsi > 70) || (finite(i.change1M) && i.change1M >= 25) ? 'EXTENDED'
        : earlyShape ? 'EARLY'
          : trend.direction === 'BULLISH' ? 'CONFIRMED' : 'NONE';

  // Quality — is the move healthy or forced?
  const distribution = candleSig === 'red' && rvol != null && rvol >= 1.5;
  const qualityNotes: string[] = [];
  if (stage === 'PARABOLIC') qualityNotes.push('Kenaikan terlalu cepat / parabolik.');
  if (distribution) qualityNotes.push('Candle merah dengan volume besar — ada tekanan jual.');
  if (rvol != null && rvol < 0.5) qualityNotes.push('Transaksi sangat sepi — kenaikan tidak terkonfirmasi.');
  if (dist != null && dist > EXTENDED_DIST_PCT && stage !== 'PARABOLIC') qualityNotes.push('Harga sudah cukup jauh dari EMA 20.');
  if (rsi != null && (rsi < 50 || rsi > 72) && stage !== 'PARABOLIC') qualityNotes.push(`RSI ${n1(rsi)} di luar zona sehat 50–72.`);
  if (candleSig === 'red' && !distribution) qualityNotes.push('Candle terakhir merah.');
  if (rvol != null && rvol >= 0.5 && rvol < 0.7) qualityNotes.push('Volume di bawah rata-rata.');
  const quality: MomentumQuality = strength == null ? 'NA'
    : stage === 'PARABOLIC' || distribution || (rvol != null && rvol < 0.5) || strength < 35 || (dist != null && dist >= 12) ? 'POOR'
      : (stage === 'EARLY' || stage === 'CONFIRMED') && rsi != null && rsi >= 50 && rsi <= 72
        && dist != null && dist >= -2 && dist <= EXTENDED_DIST_PCT
        && (rvol == null || rvol >= 0.7) && candleSig !== 'red' && strength >= 55 ? 'GOOD'
        : 'FAIR';
  if (quality === 'GOOD') qualityNotes.length = 0;

  const risk: Level = stage === 'PARABOLIC' ? 'HIGH' : worst(stage === 'EXTENDED' ? 'MEDIUM' : 'LOW', hotRisk === 'HIGH' ? 'HIGH' : 'LOW');
  return { strength, strengthLabel, quality, qualityNotes, stage, risk, distEma20: dist, chaseFlags };
}

// ─── Hot money: strength ≠ risk ─────────────────────────────────────────────────

function assessHotMoney(i: MomentumInput, ev: MomentumReport): HotMoneyAssessment {
  const rvol = ok(i.rvol) ? i.rvol : 0;
  const d1 = finite(i.change1D) ? i.change1D : 0;
  const strength: Level = rvol >= 3 || (rvol >= 2 && d1 >= 7) ? 'HIGH' : rvol >= 1.5 || d1 >= 5 ? 'MEDIUM' : 'LOW';
  const base: Level = ev.hotMoney.level === 'TINGGI' ? 'HIGH' : ev.hotMoney.level === 'SEDANG' ? 'MEDIUM' : 'LOW';
  // Hot money on a weak business is the dangerous kind.
  const risk: Level = base === 'HIGH' && ev.driver.signal === 'red' ? 'HIGH'
    : base === 'HIGH' ? 'MEDIUM'
      : strength === 'HIGH' && ev.driver.signal === 'red' ? 'MEDIUM' : base === 'MEDIUM' ? 'MEDIUM' : 'LOW';
  return { strength, risk, flags: ev.hotMoney.flags };
}

// ─── 4. Setup detection ─────────────────────────────────────────────────────────

interface LevelsResult {
  sl: number | null;
  slBasis: string | null;
  targets: PlanTarget[];
  riskPct: number | null;
  rewardPct: number | null;
  riskReward: number | null;
  valid: boolean;
}

/** SL = highest invalidation level under the entry zone (padded ½ ATR / 1%); targets = resistances, else 2R/3R projections. */
function buildLevels(
  entryLow: number,
  entryHigh: number,
  entryRef: number,
  stops: Array<[number, string]>,
  resistances: number[],
  atr: number | null,
): LevelsResult {
  const pad = (lvl: number) => roundToTick(atr != null ? Math.min(lvl * 0.99, lvl - atr * 0.5) : lvl * 0.99);
  const below = stops.filter(([lvl]) => ok(lvl) && lvl < entryLow * 0.995).sort((a, b) => b[0] - a[0]);
  let sl: number | null = null;
  let slBasis: string | null = null;
  if (below.length > 0) {
    sl = pad(below[0][0]);
    slBasis = `Di bawah ${below[0][1]} ${rp(below[0][0])}${atr != null ? ' (buffer ½ ATR)' : ''}`;
  } else if (atr != null) {
    sl = roundToTick(entryLow - atr * 1.5);
    slBasis = `1,5× ATR di bawah area entry (tidak ada support dekat)`;
  }
  if (sl != null && !(sl > 0 && sl < entryRef)) sl = null;

  const targets: PlanTarget[] = pickTargets(resistances, entryHigh).map((p) => ({ label: '', price: p, gainPct: pctDiff(p, entryRef), basis: 'Resistance' }));
  const riskAbs = sl != null ? entryRef - sl : null;
  if (riskAbs != null && riskAbs > 0) {
    for (const m of [2, 3]) {
      if (targets.length >= 2) break;
      const p = roundToTick(entryRef + riskAbs * m);
      if (p > entryHigh && (targets.length === 0 || p > targets[targets.length - 1].price)) {
        targets.push({ label: '', price: p, gainPct: pctDiff(p, entryRef), basis: `Proyeksi ${m}R (tidak ada resistance)` });
      }
    }
  }
  targets.splice(3);
  targets.forEach((t, idx) => { t.label = `TP${idx + 1}`; });

  const riskPct = sl != null ? pctDiff(entryRef, sl) : null;
  const rewardPct = targets[0]?.gainPct ?? null;
  const riskReward = riskPct != null && rewardPct != null && riskPct > 0 ? rewardPct / riskPct : null;
  const errors = validatePlanLevels({ side: 'LONG', entry: entryRef, tp1: targets[0]?.price ?? null, tp2: targets[1]?.price ?? null, tp3: targets[2]?.price ?? null, sl });
  return { sl, slBasis, targets, riskPct, rewardPct, riskReward, valid: sl != null && targets.length > 0 && errors.length === 0 };
}

const slOk = (l: LevelsResult) => l.valid && l.riskPct != null && l.riskPct <= MAX_SL_PCT;
const rrOk = (l: LevelsResult) => l.riskReward != null && l.riskReward >= MIN_RR;
const rrLabel = `R:R ≥ 1:${n1(MIN_RR)}`;
const slLabel = `Stop loss ≤ ${MAX_SL_PCT}% dari entry`;

interface SetupCtx {
  i: MomentumInput;
  ev: MomentumReport;
  trend: TrendAssessment;
  momentum: MomentumAssessment;
  liquidity: LiquidityAssessment;
  atr: number | null;
  resistances: number[];
  supports: number[];
}

function makeSetup(
  kind: SetupKind, checks: Array<{ label: string; ok: boolean }>, forming: boolean,
  zone: { entryLow: number; entryHigh: number; entryRef: number; inZone: boolean } | null,
  levels: LevelsResult | null, trigger: number | null, note: string,
): SetupEvaluation {
  const state: SetupState = checks.every((c) => c.ok) ? 'VALID' : forming ? 'FORMING' : 'INVALID';
  return {
    kind, state, checks, trigger, note, triggered: false,
    entryLow: zone?.entryLow ?? null, entryHigh: zone?.entryHigh ?? null, entryRef: zone?.entryRef ?? null, inZone: zone?.inZone ?? false,
    sl: levels?.sl ?? null, slBasis: levels?.slBasis ?? null, targets: levels?.targets ?? [],
    riskPct: levels?.riskPct ?? null, rewardPct: levels?.rewardPct ?? null, riskReward: levels?.riskReward ?? null,
  };
}

function detectBreakout(c: SetupCtx): SetupEvaluation {
  const { i, ev, trend, momentum, atr } = c;
  const price = i.price;
  const last = i.bars[i.bars.length - 1];
  const prev = i.bars[i.bars.length - 2];
  const prior = i.bars.slice(-21, -1);
  const priorHigh = prior.length >= 10 ? Math.max(...prior.map((b) => b.high)) : null;
  const crossed = [
    ...(priorHigh != null && price > priorHigh ? [priorHigh] : []),
    ...c.resistances.filter((r) => prev && prev.close <= r && price > r),
  ];
  const triggered = crossed.length > 0;
  const nextLevel = [...c.resistances.filter((r) => r > price), ...(priorHigh != null && priorHigh > price ? [priorHigh] : [])].sort((a, b) => a - b)[0] ?? null;
  const near = !triggered && nextLevel != null && pctDiff(nextLevel, price) <= 3;
  const level = triggered ? Math.max(...crossed) : near ? nextLevel : null;
  const rvol = ok(i.rvol) ? i.rvol : null;

  if (level == null) {
    return makeSetup('BREAKOUT', [{ label: 'Menembus resistance / high 20 hari', ok: false }], false, null, null, null,
      'Harga belum dekat level breakout.');
  }
  const entryLow = roundToTick(level);
  const entryHigh = roundToTick(level * (1 + BREAKOUT_MAX_CHASE_PCT / 100));
  const inZone = triggered && price >= entryLow * 0.995 && price <= entryHigh * 1.005;
  const entryRef = inZone ? price : (entryLow + entryHigh) / 2;
  const stops: Array<[number, string]> = [
    ...(triggered && last ? [[last.low, 'low candle breakout'] as [number, string]] : []),
    ...(ok(i.ema9) ? [[i.ema9, 'EMA 9'] as [number, string]] : []),
    ...c.supports.filter((s) => s < entryLow).map((s): [number, string] => [s, 'support']),
    ...(ok(i.ema20) ? [[i.ema20, 'EMA 20'] as [number, string]] : []),
  ];
  const levels = buildLevels(entryLow, entryHigh, entryRef, stops, c.resistances.filter((r) => r > entryHigh), atr);
  const bullCandle = !!last && last.close > last.open && (ev.candle.buyerPower ?? 0) >= 60;
  const checks = [
    { label: 'Trend naik', ok: trend.direction === 'BULLISH' },
    { label: 'Menembus resistance / high 20 hari', ok: triggered },
    { label: 'Candle breakout bullish (close dekat high)', ok: triggered && bullCandle },
    { label: `Volume konfirmasi (RVOL ≥ ${n1(BREAKOUT_RVOL)}x)`, ok: rvol != null && rvol >= BREAKOUT_RVOL },
    { label: `Belum terlalu jauh (≤ ${BREAKOUT_MAX_CHASE_PCT}% di atas level, ≤ ${EXTENDED_DIST_PCT}% dari EMA 20)`, ok: inZone && momentum.distEma20 != null && momentum.distEma20 <= EXTENDED_DIST_PCT },
    { label: slLabel, ok: slOk(levels) },
    { label: rrLabel, ok: rrOk(levels) },
  ];
  const note = !triggered ? `Harga ${n1(pctDiff(level, price))}% di bawah level breakout ${rp(level)}.`
    : rvol != null && rvol < 1 ? 'Breakout terjadi, tetapi naiknya harga belum didukung transaksi yang cukup.'
      : rvol != null && rvol < BREAKOUT_RVOL ? 'Breakout terjadi, tetapi transaksinya belum cukup ramai untuk konfirmasi.'
        : !inZone ? 'Harga sudah lari terlalu jauh dari level breakout.'
          : checks.every((x) => x.ok) ? `Breakout ${rp(level)} terkonfirmasi transaksi yang meningkat.` : 'Breakout belum memenuhi semua syarat.';
  return { ...makeSetup('BREAKOUT', checks, trend.direction === 'BULLISH', { entryLow, entryHigh, entryRef, inZone }, levels, roundToTick(level), note), triggered };
}

function detectPullback(c: SetupCtx): SetupEvaluation {
  const { i, ev, trend, atr } = c;
  const price = i.price;
  if (!ok(i.ema9) || !ok(i.ema20) || trend.direction !== 'BULLISH') {
    return makeSetup('PULLBACK', [{ label: 'Trend naik', ok: trend.direction === 'BULLISH' }], false, null, null, null,
      trend.direction === 'BULLISH' ? 'EMA 9 / EMA 20 tidak tersedia.' : 'Pullback hanya dicari saat trend naik.');
  }
  const bars = i.bars;
  const last = bars[bars.length - 1];
  const prev = bars[bars.length - 2];
  const entryLow = roundToTick(Math.min(i.ema9, i.ema20) * 0.99);
  const entryHigh = roundToTick(Math.max(i.ema9, i.ema20) * 1.01);
  const inZone = price >= entryLow * 0.995 && price <= entryHigh * 1.005;
  const aboveZone = price > entryHigh * 1.005;
  const entryRef = inZone ? price : (entryLow + entryHigh) / 2;
  const recentHigh = bars.length >= 10 ? Math.max(...bars.slice(-10).map((b) => b.high)) : null;
  const retraced = recentHigh != null && recentHigh >= price * 1.03;
  const volMa = ok(i.volumeMa20) ? i.volumeMa20 : null;
  const priorVols = bars.slice(-4, -1).map((b) => b.volume);
  const sellingDried = volMa != null && priorVols.length === 3 ? priorVols.reduce((s, v) => s + v, 0) / 3 <= volMa : false;
  const reversal = !!last && ((last.close > last.open && (ev.candle.buyerPower ?? 0) >= 55) || ev.candle.pattern.includes('Hammer'));
  const volImproving = (!!last && !!prev && last.volume > prev.volume) || (ok(i.rvol) && i.rvol >= 1);
  const swingLow = bars.length >= 5 ? Math.min(...bars.slice(-5).map((b) => b.low)) : null;
  const stops: Array<[number, string]> = [
    ...(swingLow != null ? [[swingLow, 'low 5 hari'] as [number, string]] : []),
    ...c.supports.map((s): [number, string] => [s, 'support']),
    ...(ok(i.ema50) ? [[i.ema50, 'EMA 50'] as [number, string]] : []),
  ];
  const levels = buildLevels(entryLow, entryHigh, entryRef, stops, c.resistances, atr);
  const checks = [
    { label: 'Trend naik', ok: true },
    { label: 'Harga turun ke area EMA 9–20 / support', ok: inZone },
    { label: 'Sempat terkoreksi ≥ 3% dari high 10 hari', ok: retraced },
    { label: 'Tekanan jual mereda (volume turun)', ok: sellingDried },
    { label: 'Candle pantulan bullish', ok: reversal },
    { label: 'Volume mulai membaik', ok: volImproving },
    { label: slLabel, ok: slOk(levels) },
    { label: rrLabel, ok: rrOk(levels) },
  ];
  const note = aboveZone ? `Harga masih di atas area pullback ${rpZone(entryLow, entryHigh)}.`
    : !inZone ? 'Harga di bawah area pullback — tunggu kembali stabil.'
      : !reversal ? 'Harga sudah di area pullback, tetapi belum ada candle pantulan.'
        : checks.every((x) => x.ok) ? 'Pullback sehat: tekanan jual mereda dan pembeli kembali masuk.' : 'Pullback belum memenuhi semua syarat.';
  return makeSetup('PULLBACK', checks, inZone || aboveZone, { entryLow, entryHigh, entryRef, inZone }, levels, null, note);
}

function detectTrendFollowing(c: SetupCtx): SetupEvaluation {
  const { i, ev, trend, momentum, liquidity, atr } = c;
  const price = i.price;
  const strict = trend.direction === 'BULLISH' && !trend.pullbackDip;
  if (!strict) {
    return makeSetup('TREND_FOLLOWING', [{ label: 'Harga > EMA 20 > EMA 50', ok: false }], false, null, null, null,
      'Trend following hanya saat harga > EMA 20 > EMA 50.');
  }
  const entryHigh = roundToTick(price);
  const lowCands = [ok(i.ema9) && i.ema9 < price ? i.ema9 : price * 0.98, atr != null ? price - atr * 0.5 : price * 0.98];
  let entryLow = roundToTick(Math.max(...lowCands));
  if (entryLow > entryHigh) entryLow = entryHigh;
  const stops: Array<[number, string]> = [
    ...(ok(i.ema20) ? [[i.ema20, 'EMA 20'] as [number, string]] : []),
    ...c.supports.map((s): [number, string] => [s, 'support']),
    ...(ok(i.ema50) ? [[i.ema50, 'EMA 50'] as [number, string]] : []),
  ];
  const levels = buildLevels(entryLow, entryHigh, price, stops, c.resistances, atr);
  const rsi = finite(i.rsi14) ? i.rsi14 : null;
  const momentumPositive = (finite(i.macdHistogram) && i.macdHistogram > 0) || (momentum.strength ?? 0) >= 55;
  const checks = [
    { label: 'Harga > EMA 20 > EMA 50', ok: true },
    { label: 'Momentum positif', ok: momentumPositive },
    { label: 'RSI sehat (50–70)', ok: rsi != null && rsi >= 50 && rsi <= 70 },
    { label: `Tidak overextended (≤ ${EXTENDED_DIST_PCT}% di atas EMA 20)`, ok: momentum.distEma20 != null && momentum.distEma20 <= EXTENDED_DIST_PCT },
    { label: 'Candle terakhir tidak bearish', ok: ev.candle.signal !== 'red' },
    { label: 'Likuiditas PASS', ok: liquidity.trading === 'PASS' },
    { label: slLabel, ok: slOk(levels) },
    { label: rrLabel, ok: rrOk(levels) },
  ];
  const failed = checks.filter((x) => !x.ok);
  const note = failed.length === 0 ? 'Harga naik stabil dan belum terlalu jauh, sehingga entry masih masuk akal.'
    : `Belum memenuhi: ${failed.map((x) => x.label.toLowerCase()).join(', ')}.`;
  return makeSetup('TREND_FOLLOWING', checks, true, { entryLow, entryHigh, entryRef: price, inZone: true }, levels, null, note);
}

// ─── 5. Position sizing ─────────────────────────────────────────────────────────

function sizePosition(
  entry: number, sl: number, entryHigh: number, atrPct: number | null, hot: HotMoneyAssessment,
  liquidity: LiquidityAssessment, halve: boolean,
): PositionSizing {
  let pct = atrPct == null ? 0.5 : atrPct >= 6 ? 0.25 : atrPct >= 3.5 ? 0.5 : 1;
  const reasons = [atrPct == null ? 'volatilitas tidak diketahui' : atrPct >= 3.5 ? `volatilitas tinggi (ATR ${n1(atrPct)}%)` : 'volatilitas normal'];
  if (hot.strength === 'HIGH' && pct > 0.5) { pct = 0.5; reasons.push('ada lonjakan spekulatif'); }
  if (halve) { pct = pct / 2; reasons.push('fundamental lemah → posisi diperkecil'); }
  const perShare = entry - sl;
  const rows = [10e6, 100e6].map((capital) => {
    const maxLoss = capital * (pct / 100);
    const byRisk = perShare > 0 ? Math.floor(maxLoss / perShare / 100) : null;
    const byCash = Math.floor(capital / entryHigh / 100);
    const byLiq = liquidity.maxPositionValue != null && liquidity.trading !== 'PASS' ? Math.floor(liquidity.maxPositionValue / entryHigh / 100) : null;
    const lots = byRisk == null ? null : Math.min(byRisk, byCash, byLiq ?? Infinity);
    return { capital, maxLoss, lots, positionValue: lots != null ? lots * 100 * entryHigh : null };
  });
  return { riskPerTradePct: pct, reason: reasons.join(', '), rows };
}

// ─── Engine ─────────────────────────────────────────────────────────────────────

export function buildDecisionV3(i: MomentumInput): DecisionV3Report {
  const ev = buildMomentumReport(i);
  const price = i.price;
  const atr = ok(i.atr14) ? i.atr14 : null;
  const atrPct = atr != null && price > 0 ? (atr / price) * 100 : null;
  const rvol = ok(i.rvol) ? i.rvol : null;
  const rsi = finite(i.rsi14) ? i.rsi14 : null;

  // DATA QUALITY
  const dataGate = ev.gates.find((g) => g.key === 'data')!;
  const dataOk = dataGate.status === 'PASS';

  // LIQUIDITY → TREND → MOMENTUM → STAGE
  const liquidity = assessLiquidity(ev, price);
  const trend = assessTrend(i);
  const hotMoney = assessHotMoney(i, ev);
  const momentum = assessMomentum(i, ev, trend, hotMoney.risk);
  const chase = momentum.chaseFlags.length > 0;

  // SETUP DETECTION
  const resistances = [...i.resistances, ...(ok(i.annualHigh) ? [i.annualHigh] : [])].filter((r) => ok(r) && r > 0);
  const supports = i.supports.filter((s) => ok(s) && s < price);
  const ctx: SetupCtx = { i, ev, trend, momentum, liquidity, atr, resistances, supports };
  const setups = [detectBreakout(ctx), detectPullback(ctx), detectTrendFollowing(ctx)];
  const byState = (s: SetupState) => setups.find((x) => x.state === s) ?? null;
  // Forming guidance: when price is extended, the pullback zone is the useful answer.
  // Otherwise the forming setup closest to valid (fewest unmet checks).
  const formingSetups = setups.filter((s) => s.state === 'FORMING');
  const unmet = (s: SetupEvaluation) => s.checks.filter((c) => !c.ok).length;
  const forming = (momentum.stage === 'EXTENDED' ? formingSetups.find((s) => s.kind === 'PULLBACK') : undefined)
    ?? [...formingSetups].sort((a, b) => unmet(a) - unmet(b))[0] ?? null;
  // A breakout today without volume (RVOL < 1) is a WAIT — no other setup may turn it into a BUY.
  const breakoutEval = setups[0];
  const weakBreakout = breakoutEval.triggered && rvol != null && rvol < 1;
  const primarySetup = chase ? null : weakBreakout ? breakoutEval : byState('VALID') ?? forming;
  const rr = primarySetup?.riskReward ?? null;

  // ENTRY QUALITY
  const entryQuality: EntryQuality = chase ? 'BAD'
    : primarySetup?.state === 'VALID' ? 'GOOD'
      : primarySetup?.state === 'FORMING' && momentum.stage !== 'EXTENDED' && (rr == null || rr >= 1) ? 'FAIR'
        : 'POOR';

  // RISK
  const flags: RiskFlag[] = [
    ...momentum.chaseFlags.map((f): RiskFlag => ({ label: `Mengejar harga: ${f}`, severity: 'block' })),
    ...(liquidity.trading === 'FAIL' ? [{ label: 'Likuiditas terlalu rendah', severity: 'block' } as RiskFlag] : []),
    ...(hotMoney.risk === 'HIGH' ? [{ label: 'Hot money tinggi tanpa dukungan fundamental', severity: 'block' } as RiskFlag] : []),
    ...(!chase && momentum.distEma20 != null && momentum.distEma20 > EXTENDED_DIST_PCT ? [{ label: `Overextended ${n1(momentum.distEma20)}% di atas EMA 20`, severity: 'warn' } as RiskFlag] : []),
    ...(!chase && rsi != null && rsi > 70 ? [{ label: `RSI ${n1(rsi)} mendekati overbought`, severity: 'warn' } as RiskFlag] : []),
    ...(atrPct != null && atrPct >= 5 ? [{ label: `Volatilitas tinggi (ATR ${n1(atrPct)}% harga)`, severity: 'warn' } as RiskFlag] : []),
    ...(liquidity.tickPct != null && liquidity.tickPct >= 1 ? [{ label: `Spread lebar (1 tick = ${n1(liquidity.tickPct)}%)`, severity: 'warn' } as RiskFlag] : []),
    ...(liquidity.trading === 'LIMITED' ? [{ label: 'Likuiditas terbatas — posisi dibatasi', severity: 'warn' } as RiskFlag] : []),
    ...(hotMoney.risk === 'MEDIUM' ? [{ label: 'Ada tanda spekulasi (hot money sedang)', severity: 'warn' } as RiskFlag] : []),
    ...(!chase && !primarySetup ? [{ label: 'Setup belum jelas', severity: 'warn' } as RiskFlag] : []),
    ...(primarySetup?.riskPct != null && primarySetup.riskPct > MAX_SL_PCT ? [{ label: `Stop loss terlalu jauh (${n1(primarySetup.riskPct)}%)`, severity: 'warn' } as RiskFlag] : []),
  ];
  const riskGate: 'PASS' | 'FAIL' = flags.some((f) => f.severity === 'block') ? 'FAIL' : 'PASS';
  const tradingRisk = worst(fromRisk(ev.risk.market.level), fromRisk(ev.risk.execution.level));
  const overall: Level = riskGate === 'FAIL' ? 'HIGH'
    : worst(tradingRisk, momentum.risk, flags.length >= 2 ? 'MEDIUM' : 'LOW', liquidity.trading === 'LIMITED' ? 'MEDIUM' : 'LOW');
  const risk: RiskAssessment = {
    gate: riskGate, flags, fundamental: ev.risk.fundamental.level, market: ev.risk.market.level, execution: ev.risk.execution.level, overall,
  };

  // SCORES (context only — the decision below is rule-based)
  const blocks = flags.filter((f) => f.severity === 'block').length;
  const warns = flags.length - blocks;
  const scores: ComponentScores = {
    trend: trend.score,
    momentum: momentum.strength,
    entry: entryQuality === 'GOOD' ? 85 : entryQuality === 'FAIR' ? 55 : entryQuality === 'POOR' ? 30 : 10,
    risk: ev.scores.risk.value == null ? null : clamp100(100 - ev.scores.risk.value - blocks * 20 - warns * 5),
    liquidity: liquidity.score,
    rr: rr == null ? null : clamp100((rr / 3) * 100),
  };

  // EARLY MOMENTUM scanner — catch it before it becomes a top gainer.
  const earlyMomentum = !chase && trend.direction === 'BULLISH' && !trend.pullbackDip
    && rsi != null && rsi >= 50 && rsi <= 70
    && rvol != null && rvol >= 0.8 && rvol <= 1.6
    && momentum.distEma20 != null && momentum.distEma20 <= EARLY_DIST_PCT
    && ((finite(i.macdHistogram) && i.macdHistogram > 0) || (momentum.strength ?? 0) >= 55)
    && liquidity.trading === 'PASS'
    && primarySetup != null && (rr == null || rr >= MIN_RR);

  // ── HORIZON DECISIONS ──
  const fundamentalHigh = ev.risk.fundamental.level === 'HIGH';
  const fundamentalSound = ev.risk.fundamental.level === 'LOW' || ev.risk.fundamental.level === 'MEDIUM';
  const setupValid = primarySetup?.state === 'VALID';
  const rrPass = rr != null && rr >= MIN_RR;

  const waitTargets = buildWaitFor(i, trend, momentum, setups, primarySetup, rvol);

  // Trading 1–5D — fundamentals are a warning only.
  const tradingRules = [
    { label: 'Data lengkap', ok: dataOk },
    { label: 'Likuiditas cukup untuk trading', ok: liquidity.trading !== 'FAIL' },
    { label: 'Trend naik', ok: trend.direction === 'BULLISH' },
    { label: 'Kualitas momentum sehat', ok: momentum.quality === 'GOOD' },
    { label: 'Bukan parabolik / tidak mengejar harga', ok: !chase },
    { label: 'Setup entry valid', ok: setupValid },
    { label: 'Tidak ada breakout tanpa volume', ok: !weakBreakout },
    { label: rrLabel, ok: rrPass },
    { label: 'Risk gate PASS', ok: riskGate === 'PASS' },
  ];
  const tradingAvoid = !dataOk || liquidity.trading === 'FAIL' || chase || trend.direction === 'BEARISH' || riskGate === 'FAIL';
  const tradingStatus: Decision = tradingAvoid ? 'AVOID' : tradingRules.every((r) => r.ok) ? 'BUY' : 'WAIT';
  const tradingWarnings = [
    ev.fundamentalLabel === 'Fundamental Lemah' || fundamentalHigh ? 'Fundamental lemah, sehingga risiko menyimpan lebih lama lebih tinggi.' : null,
    liquidity.trading === 'LIMITED' ? liquidity.note : null,
    hotMoney.risk === 'MEDIUM' ? 'Ada tanda spekulasi — ambil untung bertahap.' : null,
  ].filter((x): x is string => Boolean(x));
  const trading: HorizonResult = {
    horizon: 'trading',
    label: 'Trading (1–5 hari)',
    status: tradingStatus,
    tag: tradingStatus === 'AVOID' && chase ? 'AVOID CHASING'
      : earlyMomentum ? (tradingStatus === 'BUY' ? 'EARLY MOMENTUM' : 'BUY CANDIDATE') : null,
    reason: horizonReason('trading', tradingStatus, { dataOk, liquidity, trend, momentum, chase, hotMoney, primarySetup, rr, rvol }),
    waitFor: tradingStatus === 'BUY' ? null : tradingStatus === 'AVOID' ? avoidChange({ dataOk, liquidity, trend, chase, i }) : waitTargets,
    rules: tradingRules,
    warnings: tradingWarnings,
  };

  // Swing 5–15D — fundamentals are a secondary filter (smaller size), liquidity needs the 20D baseline.
  const swingRules = [
    { label: 'Data lengkap', ok: dataOk },
    { label: `Likuiditas Avg 20D ≥ ${fmtIdrValue(MIN_LIQUID_VALUE)}`, ok: liquidity.swing === 'PASS' },
    { label: 'Trend naik', ok: trend.direction === 'BULLISH' },
    { label: 'Kualitas momentum sehat', ok: momentum.quality === 'GOOD' },
    { label: 'Setup entry valid', ok: setupValid },
    { label: rrLabel, ok: rrPass },
    { label: 'Risiko trading tidak tinggi', ok: tradingRisk !== 'HIGH' && riskGate === 'PASS' },
  ];
  const swingAvoid = !dataOk || liquidity.swing === 'FAIL' || chase || riskGate === 'FAIL' || (trend.direction === 'BEARISH' && !fundamentalSound);
  const swingStatus: Decision = swingAvoid ? 'AVOID' : swingRules.every((r) => r.ok) ? 'BUY' : 'WAIT';
  const swing: HorizonResult = {
    horizon: 'swing',
    label: 'Swing (5–15 hari)',
    status: swingStatus,
    tag: swingStatus === 'AVOID' && chase ? 'AVOID CHASING' : null,
    reason: horizonReason('swing', swingStatus, { dataOk, liquidity, trend, momentum, chase, hotMoney, primarySetup, rr, rvol, fundamentalSound }),
    waitFor: swingStatus === 'BUY' ? null
      : swingStatus === 'AVOID' ? avoidChange({ dataOk, liquidity, trend, chase, i, swing: true })
        : trend.direction === 'BEARISH' ? `Harga kembali di atas ${ok(i.ema20) ? rp(i.ema20) : 'EMA 20'} dan arah mulai naik.`
          : liquidity.swing === 'LIMITED' ? `Transaksi rata-rata harian naik di atas ${fmtIdrValue(MIN_LIQUID_VALUE)}.` : waitTargets,
    rules: swingRules,
    warnings: [
      fundamentalHigh && swingStatus === 'BUY' ? 'Fundamental lemah — boleh swing, tetapi dengan posisi lebih kecil.' : null,
      fundamentalHigh && swingStatus !== 'BUY' ? 'Fundamental lemah — bila nanti BUY, gunakan posisi lebih kecil.' : null,
    ].filter((x): x is string => Boolean(x)),
  };

  // Investing > 3 bulan — fundamentals are mandatory, price action is not an input.
  const v = i.valuationVerdict;
  const lossMaking = (finite(i.per) && i.per < 0) || (finite(i.roe) && i.roe < 0);
  const valueTrap = finite(i.earningsGrowth) && i.earningsGrowth < 0;
  const businessGood = finite(i.roe) && i.roe >= 10;
  const valuationOk = v === 'UNDERVALUED' || v === 'WAJAR';
  const investRules = [
    { label: 'Fundamental sehat', ok: ev.risk.fundamental.level === 'LOW' },
    { label: 'Valuasi menarik / wajar', ok: valuationOk },
    { label: 'Kualitas bisnis baik (ROE ≥ 10%)', ok: businessGood },
    { label: 'Laba tidak menurun (bukan value trap)', ok: !valueTrap },
    { label: 'Risiko eksekusi masih wajar', ok: liquidity.trading !== 'FAIL' },
  ];
  const investAvoid = fundamentalHigh || lossMaking || i.healthVerdict === 'LEMAH';
  const investStatus: Decision = investAvoid ? 'AVOID' : investRules.every((r) => r.ok) ? 'BUY' : 'WAIT';
  const accZone = ok(i.accumulationLow) && ok(i.accumulationHigh) ? rpZone(roundToTick(i.accumulationLow), roundToTick(i.accumulationHigh)) : null;
  const investing: HorizonResult = {
    horizon: 'investing',
    label: 'Investing (> 3 bulan)',
    status: investStatus,
    tag: null,
    reason: investStatus === 'BUY'
      ? `Bisnisnya sehat dan harganya ${v === 'UNDERVALUED' ? 'masih murah' : 'wajar'}${accZone ? ` — area cicil ${accZone}` : ''}.${trend.direction === 'BEARISH' ? ' Harga jangka pendek masih turun, jadi cicil bertahap.' : ''}`
      : investStatus === 'AVOID'
        ? `Kondisi bisnisnya bermasalah (${ev.risk.fundamental.reasons.slice(0, 2).join('; ').toLowerCase()}) — bukan untuk investasi jangka panjang.`
        : ev.risk.fundamental.level === 'NA' ? 'Data laporan keuangan belum cukup untuk keputusan investasi.'
          : valueTrap ? 'Terlihat menarik, tetapi labanya sedang turun — waspada jebakan harga murah.'
            : !valuationOk ? 'Bisnisnya layak, tetapi harganya sudah tidak murah.'
              : 'Bisnisnya cukup, tetapi belum memenuhi semua syarat kualitas.',
    waitFor: investStatus === 'BUY' ? null
      : investStatus === 'AVOID' ? 'Laba kembali tumbuh, utang terkendali, dan ROE membaik.'
        : accZone && !valuationOk ? `Harga turun ke area ${accZone}.`
          : valueTrap ? 'Laba kembali tumbuh di laporan berikutnya.' : 'Laporan keuangan berikutnya menunjukkan perbaikan.',
    rules: investRules,
    warnings: [],
  };

  const decisions: Record<Horizon, HorizonResult> = { trading, swing, investing };

  // ── SIMPLE USER OUTPUT (Level 1 & 2) — the Trading horizon is the headline ──
  // BUY → executable plan. WAIT → a conditional plan only when its levels already work (SL ≤ 8%, R:R ≥ 1.5).
  const planWorks = primarySetup != null && primarySetup.riskPct != null && primarySetup.riskPct <= MAX_SL_PCT
    && primarySetup.riskReward != null && primarySetup.riskReward >= MIN_RR;
  const showPlan = tradingStatus === 'BUY' || (tradingStatus === 'WAIT' && planWorks);
  let plan: SimplePlan | null = null;
  if (showPlan && primarySetup && primarySetup.entryLow != null && primarySetup.entryHigh != null && primarySetup.sl != null
    && primarySetup.riskPct != null && primarySetup.riskReward != null && primarySetup.targets.length > 0 && primarySetup.entryRef != null) {
    plan = {
      conditional: tradingStatus !== 'BUY',
      setup: primarySetup.kind,
      entryLow: primarySetup.entryLow,
      entryHigh: primarySetup.entryHigh,
      targets: primarySetup.targets.slice(0, 2),
      sl: primarySetup.sl,
      riskPct: primarySetup.riskPct,
      riskReward: primarySetup.riskReward,
      rrText: `Potensi keuntungan sekitar ${n1(primarySetup.riskReward)}× risiko.`,
      sizing: sizePosition(primarySetup.entryRef, primarySetup.sl, primarySetup.entryHigh, atrPct, hotMoney, liquidity, false),
    };
  }
  const conclusion = tradingStatus === 'BUY' ? 'Layak dibeli dengan risiko terukur.'
    : tradingStatus === 'AVOID' ? (chase ? 'Jangan kejar harga.' : 'Hindari dulu.')
      : momentum.stage === 'EXTENDED' ? 'Tunggu pullback terlebih dahulu.'
        : trading.tag === 'BUY CANDIDATE' ? 'Kandidat beli — tunggu sinyal masuk.'
          : 'Belum perlu membeli sekarang.';
  const simple: SimpleOutput = {
    status: tradingStatus,
    tag: trading.tag,
    reason: trading.reason,
    plan,
    risk: overall,
    riskText: LEVEL_TEXT[overall],
    waitFor: trading.waitFor,
    conclusion,
    why: buildWhy({ i, trend, momentum, liquidity, hotMoney, primarySetup, rr, rvol, chase, tradingStatus, ev }),
  };

  // ── CONSISTENCY ──
  const consistency = [
    { label: 'AVOID tidak memuat Entry / TP / SL', passed: tradingStatus !== 'AVOID' || plan == null },
    { label: 'BUY hanya dengan setup valid & R:R ≥ 1,5', passed: tradingStatus !== 'BUY' || (setupValid && rrPass) },
    { label: 'Saham parabolik / top gainer tidak pernah BUY', passed: !chase || (tradingStatus !== 'BUY' && swingStatus !== 'BUY') },
    { label: 'Breakout tanpa volume tidak BUY', passed: !(tradingStatus === 'BUY' && primarySetup?.kind === 'BREAKOUT') || (rvol != null && rvol >= BREAKOUT_RVOL) },
    { label: 'Trading tidak AVOID hanya karena fundamental', passed: tradingStatus !== 'AVOID' || tradingAvoid },
    { label: 'Trend Price > EMA20 > EMA50 tidak disebut sideways', passed: !(ok(i.ema20) && ok(i.ema50) && price > i.ema20 && i.ema20 > i.ema50) || trend.direction === 'BULLISH' },
    { label: 'Investing BUY hanya bila fundamental sehat', passed: investStatus !== 'BUY' || ev.risk.fundamental.level === 'LOW' },
  ];

  return {
    dataOk, dataNote: dataGate.reason, liquidity, trend, momentum, hotMoney, setups, primarySetup, entryQuality, risk, scores,
    earlyMomentum, decisions, simple, consistency, evidence: ev,
  };
}

// ─── Plain-language builders ────────────────────────────────────────────────────

interface ReasonCtx {
  dataOk: boolean;
  liquidity: LiquidityAssessment;
  trend: TrendAssessment;
  momentum: MomentumAssessment;
  chase: boolean;
  hotMoney: HotMoneyAssessment;
  primarySetup: SetupEvaluation | null;
  rr: number | null;
  rvol: number | null;
  fundamentalSound?: boolean;
}

function trendSentence(t: TrendAssessment): string {
  if (t.direction === 'BULLISH') return t.pullbackDip ? 'Arah harga masih naik, sedang turun sejenak' : t.strength === 'STRONG' ? 'Arah harga sedang naik dengan kuat' : t.strength === 'MODERATE' ? 'Arah harga sedang naik' : 'Arah harga mulai naik, tetapi belum kokoh';
  if (t.direction === 'BEARISH') return 'Arah harga sedang turun';
  if (t.direction === 'SIDEWAYS') return 'Harga masih bergerak mendatar, arahnya belum jelas';
  return 'Arah harga belum bisa dinilai';
}

function setupSentence(s: SetupEvaluation): string {
  if (s.kind === 'BREAKOUT') return `harga baru menembus ${s.trigger != null ? rp(s.trigger) : 'batas atas'} dengan transaksi yang meningkat`;
  if (s.kind === 'PULLBACK') return 'harga sempat turun ke area wajar lalu pembeli kembali masuk';
  return 'harga naik stabil dan belum terlalu jauh, sehingga entry masih masuk akal';
}

function horizonReason(h: 'trading' | 'swing', status: Decision, c: ReasonCtx): string {
  if (status === 'BUY' && c.primarySetup) {
    const mom = c.momentum.stage === 'EARLY' ? 'momentum mulai menguat' : 'momentum menguat';
    return `${trendSentence(c.trend)}, ${mom}, dan ${setupSentence(c.primarySetup)}.`;
  }
  if (status === 'AVOID') {
    if (!c.dataOk) return 'Data belum cukup untuk dianalisis dengan aman.';
    if (c.chase) {
      return (c.momentum.strengthLabel === 'STRONG' || c.momentum.strengthLabel === 'VERY_STRONG')
        ? 'Momentumnya kuat, tetapi harga sudah naik terlalu jauh. Risiko membeli di puncak lebih besar daripada peluangnya.'
        : 'Harganya sudah naik terlalu cepat dan terlalu jauh. Risiko membeli sekarang lebih besar daripada peluangnya.';
    }
    if ((h === 'trading' ? c.liquidity.trading : c.liquidity.swing) === 'FAIL') return 'Saham ini terlalu sepi transaksi — sulit menjual saat dibutuhkan.';
    if (c.hotMoney.risk === 'HIGH') return 'Kenaikannya didorong spekulasi tanpa dukungan fundamental — harga bisa berbalik cepat.';
    if (c.trend.direction === 'BEARISH') {
      return h === 'swing' ? 'Arah harga sedang turun dan fundamentalnya tidak cukup kuat untuk menunggu pemulihan.' : 'Arah harga sedang turun. Belum ada tanda pembalikan.';
    }
    return 'Risiko membeli sekarang lebih besar daripada peluangnya.';
  }
  // WAIT — the main thing still missing.
  if (c.trend.direction === 'BEARISH') return 'Arah harga masih turun, tetapi bisnisnya cukup sehat — pantau tanda pembalikan.';
  if (h === 'swing' && c.liquidity.swing !== 'PASS') return 'Transaksi harian rata-rata belum cukup ramai untuk ditahan beberapa minggu.';
  if (c.trend.direction === 'SIDEWAYS' || c.trend.direction === 'NA') return `${trendSentence(c.trend)}. Belum ada sinyal masuk yang cukup kuat.`;
  if (c.momentum.stage === 'EXTENDED') return `${trendSentence(c.trend)}, tetapi harga sudah agak jauh dari area beli yang wajar.`;
  const s = c.primarySetup;
  if (s?.kind === 'BREAKOUT' && s.triggered && c.rvol != null && c.rvol < 1) return `${trendSentence(c.trend)}, tetapi naiknya harga belum didukung transaksi yang cukup.`;
  if (s?.kind === 'BREAKOUT' && s.triggered && c.rvol != null && c.rvol < BREAKOUT_RVOL) return `${trendSentence(c.trend)}, tetapi transaksinya belum cukup ramai untuk memastikan breakout.`;
  if (s && s.riskReward != null && s.riskReward < MIN_RR) return `${trendSentence(c.trend)}, tetapi jarak ke target terlalu dekat dibanding risikonya.`;
  if (s?.riskPct != null && s.riskPct > MAX_SL_PCT) return `${trendSentence(c.trend)}, tetapi titik cut loss terlalu jauh dari harga sekarang.`;
  if (c.momentum.quality !== 'GOOD' && c.momentum.qualityNotes.length > 0) return `${trendSentence(c.trend)}, tetapi kenaikannya belum sehat: ${c.momentum.qualityNotes[0].replace(/\.$/, '').toLowerCase()}.`;
  return `${trendSentence(c.trend)}, tetapi belum ada sinyal masuk yang cukup kuat.`;
}

function buildWaitFor(
  i: MomentumInput, trend: TrendAssessment, momentum: MomentumAssessment, setups: SetupEvaluation[], primary: SetupEvaluation | null, rvol: number | null,
): string {
  const breakout = setups.find((s) => s.kind === 'BREAKOUT');
  // A breakout already in progress is confirmed by volume — a pullback zone under its SL would contradict the plan.
  const pullback = primary?.kind === 'BREAKOUT' && primary.triggered ? undefined : setups.find((s) => s.kind === 'PULLBACK');
  const parts: string[] = [];
  if (trend.direction === 'SIDEWAYS' || trend.direction === 'NA') {
    parts.push(`harga bertahan di atas ${ok(i.ema20) ? rp(roundToTick(i.ema20)) : 'EMA 20'} dan arahnya mulai naik`);
  }
  if (pullback?.entryLow != null && pullback.entryHigh != null && pullback.state !== 'INVALID') {
    parts.push(pullback.inZone ? `muncul candle hijau di area ${rpZone(pullback.entryLow, pullback.entryHigh)}` : `harga turun mendekati ${rpZone(pullback.entryLow, pullback.entryHigh)} lalu muncul candle hijau`);
  }
  if (breakout?.trigger != null && momentum.stage !== 'EXTENDED') {
    parts.push(breakout.inZone && rvol != null && rvol < BREAKOUT_RVOL
      ? `breakout ${rp(breakout.trigger)} dikonfirmasi transaksi yang lebih ramai`
      : `breakout ${rp(breakout.trigger)} dengan transaksi ramai`);
  }
  if (parts.length === 0) parts.push('muncul sinyal masuk yang lebih jelas (pullback ke area wajar atau breakout dengan transaksi ramai)');
  const txt = parts.join(' atau ');
  return txt.charAt(0).toUpperCase() + txt.slice(1) + '.';
}

function avoidChange(c: { dataOk: boolean; liquidity: LiquidityAssessment; trend: TrendAssessment; chase: boolean; i: MomentumInput; swing?: boolean }): string {
  const ema20 = ok(c.i.ema20) ? rp(roundToTick(c.i.ema20)) : 'EMA 20';
  if (!c.dataOk) return 'Data harga & transaksi tersedia lengkap.';
  if (c.chase) return `Harga turun mendekati area wajar (± ${ema20}) dan stabil.`;
  if ((c.swing ? c.liquidity.swing : c.liquidity.trading) === 'FAIL') return `Transaksi rata-rata harian naik di atas ${fmtIdrValue(c.swing ? MIN_LIQUID_VALUE : LIMITED_LIQUID_VALUE)}.`;
  if (c.trend.direction === 'BEARISH') return `Harga kembali di atas ${ema20} dan arah mulai naik.`;
  return 'Tanda spekulasi mereda dan harga kembali stabil.';
}

function buildWhy(c: {
  i: MomentumInput; trend: TrendAssessment; momentum: MomentumAssessment; liquidity: LiquidityAssessment; hotMoney: HotMoneyAssessment;
  primarySetup: SetupEvaluation | null; rr: number | null; rvol: number | null; chase: boolean; tradingStatus: Decision; ev: MomentumReport;
}): string[] {
  const out: string[] = [`${trendSentence(c.trend)}.`];
  const m = c.momentum;
  out.push(
    m.stage === 'PARABOLIC' ? 'Harganya sudah naik terlalu cepat dan terlalu jauh. Risiko koreksi tinggi.'
      : m.stage === 'EXTENDED' ? 'Harga sudah naik cukup jauh — lebih aman menunggu turun sedikit.'
        : m.stage === 'EARLY' ? 'Momentum baru mulai terbentuk — belum terlambat.'
          : m.stage === 'CONFIRMED' ? 'Momentum naik sudah terkonfirmasi.'
            : 'Belum ada dorongan naik yang jelas.',
  );
  if (c.rvol != null) {
    const up = (c.i.change1D ?? 0) > 0;
    out.push(c.rvol >= 1.5 ? (c.ev.candle.signal === 'red' ? 'Transaksi ramai, tetapi didominasi penjual.' : 'Transaksi meningkat — pembeli aktif.')
      : c.rvol >= 1 ? 'Transaksi normal.'
        : up ? 'Naiknya harga belum didukung transaksi yang cukup.' : 'Transaksi sedang sepi.');
  }
  if (c.primarySetup && !c.chase) {
    out.push(c.primarySetup.state === 'VALID' ? `Sinyal masuk: ${setupSentence(c.primarySetup)}.` : 'Belum ada sinyal masuk yang cukup kuat.');
  }
  if (c.rr != null && !c.chase) out.push(`Potensi keuntungan sekitar ${n1(c.rr)}× risiko${c.rr < MIN_RR ? ' — belum sepadan (minimal 1,5×).' : '.'}`);
  if (c.liquidity.trading !== 'PASS') out.push(c.liquidity.note);
  if (c.hotMoney.risk !== 'LOW') out.push('Ada tanda spekulasi (uang panas) — harga bisa berbalik cepat.');
  if (c.ev.fundamentalLabel === 'Fundamental Lemah' || c.ev.risk.fundamental.level === 'HIGH') out.push('Fundamental lemah, sehingga risiko menyimpan lebih lama lebih tinggi.');
  return out.slice(0, 6);
}
