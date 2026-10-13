/**
 * momentumTradeEngine.ts
 *
 * Momentum Trade Engine (docs/features_momentum_engine.md). Two layers on DAILY OHLCV:
 *
 *   A. OPPORTUNITY SCANNER — trend quality, momentum, volume, liquidity, structure, setup candidates.
 *      Display only: a high opportunity score never turns into BUY.
 *   B. EXECUTION GATE (HARD RISK GATE) — BUY only when EVERY gate passes:
 *        data · liquidity · entry trigger · structural SL · reward · R:R (net) · distribution · upside · no chasing
 *
 * Status: BUY · WAIT PULLBACK · WAIT BREAKOUT · WAIT RETEST · WATCHLIST · AVOID CHASING · NO TRADE.
 * WAIT / WATCHLIST are NOT buy signals and carry no trade plan — only the objective trigger condition.
 *
 * Modes (explicit, see MOMENTUM_MODES):
 *   • swing (default)  — 3–10 trading days, technical targets ≈ 5–15%, net R:R ≥ 1:2.
 *   • momentum20       — the original ≥ 20% momentum leg (used by Moonstock), net R:R ≥ 1:2.
 *
 * Definitions:
 *   Potential (reward) = (TP2 − entry) / entry — TP2 is a technical level (resistance / measured move / swing high).
 *   Upside             = (nearest resistance above entry − entry) / entry — the first obstacle, not the target.
 *   Risk               = (entry − SL) / entry, SL = structural low − 0,5 × ATR 14 (never tightened to pass a gate).
 *   R:R                = (TP2 − entry) / (entry − SL);  net R:R also pays fees + slippage on both legs.
 *   Extended           = price − EMA 20 > max(10%, 3,5 × ATR%)  or  ROC 5 ≥ max(25%, 5 × ATR%)  or  RSI ≥ 85.
 *
 * Setups are judged on the last CLOSED candle; pivots need bars on both sides — no look-ahead. FAIL is never
 * turned into PASS by strong indicators. Order prices snap to valid IDX ticks. Missing data → NO TRADE / N/A.
 */

import { roundToTick } from '@/domain/analysis/idxTick';
import { MomentumInput } from '@/domain/analysis/momentumSpeculation';
import {
  assessData,
  BREAKOUT_RVOL,
  CostModel,
  DataQuality,
  detectBreakout,
  detectConsolidation,
  detectPullback,
  detectRetest,
  floorToTick,
  IDX_COSTS,
  liquidityOf,
  netRiskReward,
  relVolume,
  SetupEval,
  SetupType,
  SL_BUFFER_ATR,
} from '@/domain/analysis/momentumSetups';
import { macd } from '@/domain/indicators/macd';
import { ema } from '@/domain/indicators/movingAverages';
import { rsi } from '@/domain/indicators/rsi';
import { OHLCVBar } from '@/domain/models/History';

export { BREAKOUT_RVOL } from '@/domain/analysis/momentumSetups';

// ─── Modes & thresholds ─────────────────────────────────────────────────────────

export type MomentumMode = 'swing' | 'momentum20';

export interface MomentumModeConfig {
  key: MomentumMode;
  label: string;
  horizon: string;
  /** Min NET reward : risk to TP2. */
  minRR: number;
  /** Min potential (entry → TP2), %. */
  minRewardPct: number;
  /** Preferred upper bound for TP selection, % (null = take the next resistance / measured move as is). */
  maxTargetPct: number | null;
  /** Min room to the nearest resistance overhead, %. */
  minUpsidePct: number;
  /** Realistic travel within the horizon ≈ this many daily ATRs. */
  atrReachMult: number;
  /** Structural SL further than this from entry (% or ATRs) is not tradable in this mode. */
  maxSlPct: number;
  maxSlAtr: number;
  /** Min average traded value of the last 20 sessions, rupiah. */
  minAvgValue20: number;
  costs: CostModel;
}

export const MOMENTUM_MODES: Record<MomentumMode, MomentumModeConfig> = {
  swing: {
    key: 'swing', label: 'Swing 3–10 hari', horizon: '3–10 hari bursa',
    minRR: 2, minRewardPct: 5, maxTargetPct: 15, minUpsidePct: 5, atrReachMult: 4, maxSlPct: 8, maxSlAtr: 2.5,
    minAvgValue20: 1e9, costs: IDX_COSTS,
  },
  momentum20: {
    key: 'momentum20', label: 'Momentum ≥20%', horizon: '±1 bulan',
    minRR: 2, minRewardPct: 20, maxTargetPct: null, minUpsidePct: 20, atrReachMult: 6, maxSlPct: 10, maxSlAtr: 3,
    minAvgValue20: 1e9, costs: IDX_COSTS,
  },
};

export interface MomentumOptions {
  mode?: MomentumMode;
  /** Per-call overrides (e.g. a stricter minRR). Never lowered automatically. */
  config?: Partial<Omit<MomentumModeConfig, 'key'>>;
  /** Analysis time — enables the stale-data and unclosed-candle checks. Omit for historical replays. */
  asOf?: Date;
}

/** Legacy exports (momentum20 mode). */
export const MOMENTUM_TARGET_PCT = MOMENTUM_MODES.momentum20.minRewardPct;
export const MIN_MOMENTUM_RR = MOMENTUM_MODES.momentum20.minRR;
export const MAX_SL_PCT = MOMENTUM_MODES.momentum20.maxSlPct;
/** Realistic travel of a ≥ 20% momentum leg ≈ this many daily ATRs (target20Realistic). */
export const ATR_TRAVEL_MULT = 6;
export { BREAKOUT_ZONE_PCT } from '@/domain/analysis/momentumSetups';

const EXTENDED_EMA20_PCT = 10;
const EXTENDED_ATR_MULT = 3.5;
const EXTENDED_ROC5_PCT = 25;
const EXTENDED_ROC5_ATR_MULT = 5;
const EXTREME_RSI = 85;
const HOT_RSI = 80;
/** Bars needed for EMA 50 / 20-day structure to mean anything. */
const MIN_BARS = 50;
/** TP1 must be at least this far above entry to be worth a partial. */
const MIN_TP1_PCT = 3;

// ─── Types ──────────────────────────────────────────────────────────────────────

export type MomentumTradeStatus =
  | 'BUY' | 'WAIT PULLBACK' | 'WAIT BREAKOUT' | 'WAIT RETEST' | 'WATCHLIST' | 'AVOID CHASING' | 'NO TRADE';
/** PASS = every hard gate passed (plan published). BLOCKED = no plan. N/A = data insufficient. */
export type FinalGate = 'PASS' | 'BLOCKED' | 'N/A';
export type MomentumGrade = 'STRONG' | 'MODERATE' | 'WEAK' | 'N/A';
/** Display label consistent with the status driver: EXTENDED ⇔ AVOID CHASING, DISTRIBUTION/DOWNTREND ⇔ NO TRADE. */
export type StructureGrade = 'HEALTHY' | 'EXTENDED' | 'DISTRIBUTION' | 'DOWNTREND' | 'NO TREND' | 'N/A';
export type ExitRisk = 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME' | 'N/A';
export type TrendRead = 'BULLISH' | 'SIDEWAYS' | 'BEARISH' | 'N/A';
export type VolumeRead = 'EXPANSION' | 'NORMAL' | 'CONTRACTION' | 'N/A';
/** Setup whose entry trigger fired on the last closed candle (NONE otherwise). */
export type MomentumSetup = 'BREAKOUT' | 'RETEST' | 'PULLBACK' | 'NONE';
export type RiskGateKey = 'data' | 'liquidity' | 'trigger' | 'slPct' | 'slAtr' | 'potential' | 'rr' | 'distribution' | 'upside' | 'chase';
/**
 * FINAL = entry valid (trigger PASS) → the SL the plan would use. PROVISIONAL = simulation before the entry is
 * confirmed (SL / R:R gates PENDING). UNKNOWN = structural low not formed yet. NONE = no setup.
 */
export type SlStage = 'FINAL' | 'PROVISIONAL' | 'UNKNOWN' | 'NONE';
export type GateState = 'PASS' | 'FAIL' | 'PENDING';
export type OpportunityGrade = 'HIGH' | 'MEDIUM' | 'LOW' | 'N/A';
export type { SetupEval, SetupLevel, SetupType, SetupState, DataQuality } from '@/domain/analysis/momentumSetups';

export const MOMENTUM_STATUS_EMOJI: Record<MomentumTradeStatus, string> = {
  BUY: '🟢',
  'WAIT PULLBACK': '🟡',
  'WAIT BREAKOUT': '🟡',
  'WAIT RETEST': '🟡',
  WATCHLIST: '👀',
  'AVOID CHASING': '🔴',
  'NO TRADE': '⛔',
};

export const SETUP_NAME: Record<MomentumSetup, string> = {
  BREAKOUT: 'Breakout valid',
  RETEST: 'Breakout retest',
  PULLBACK: 'Pullback EMA 9–20',
  NONE: 'Belum ada trigger',
};

export const SETUP_TYPE_NAME: Record<SetupType | 'NONE', string> = {
  TREND: 'Trend continuation',
  BREAKOUT: 'Breakout',
  RETEST: 'Breakout-retest',
  PULLBACK: 'Pullback EMA 9–20',
  CONSOLIDATION: 'Konsolidasi / range',
  NONE: 'Belum ada setup',
};

export function riskGateLabel(key: RiskGateKey, cfg: MomentumModeConfig): string {
  return {
    data: 'Data valid',
    liquidity: `Likuiditas ≥ Rp ${(cfg.minAvgValue20 / 1e9).toLocaleString('id-ID')} M/hari`,
    trigger: 'Entry Trigger',
    slPct: `SL ≤ ${r1(cfg.maxSlPct)}% dari entry`,
    slAtr: `SL ≤ ${r1(cfg.maxSlAtr)}× ATR`,
    potential: `Potential ≥${cfg.minRewardPct}%`,
    rr: `R:R net ≥1:${cfg.minRR}`,
    distribution: 'Distribution Risk',
    upside: `Upside ≥${cfg.minUpsidePct}%`,
    chase: 'Tidak extended',
  }[key];
}

export interface MomentumSignalItem {
  label: string;
  ok: boolean;
}

export interface RiskGateItem {
  key: RiskGateKey;
  label: string;
  /** True only for PASS. PENDING (not evaluable until the trigger forms) is not a pass. */
  pass: boolean;
  state: GateState;
  /** Why it passed / failed, with the numbers. */
  detail: string;
}

export interface DistributionFlag {
  key: 'rejection' | 'lowerHigh' | 'sellingVolume' | 'breakdown' | 'macdWeakening' | 'failedBreakout';
  label: string;
}

export interface MomentumTarget {
  price: number;
  pct: number;
  basis: string;
}

export interface MomentumIndicators {
  rsi14: number | null;
  rsiPrev: number | null;
  macdLine: number | null;
  macdSignal: number | null;
  macdHistogram: number | null;
  macdHistogramPrev: number | null;
  ema9: number | null;
  ema20: number | null;
  ema50: number | null;
  ema200: number | null;
  /** EMA 20 change over the last 5 sessions, %. */
  ema20Slope5Pct: number | null;
  atr14: number | null;
  atrPct: number | null;
  /** Last volume ÷ average of the prior 20 sessions. */
  rvol: number | null;
  avgValue20: number | null;
}

export interface MomentumTradeReport {
  mode: MomentumMode;
  config: MomentumModeConfig;
  dataOk: boolean;
  dataNote: string;
  data: DataQuality;
  status: MomentumTradeStatus;
  /** HARD RISK GATE verdict. Entry / SL / TP / Potential / R:R are non-null only when PASS. */
  finalGate: FinalGate;
  /** Opportunity Scanner (analysis only — never drives BUY). */
  opportunity: { grade: OpportunityGrade; score: number | null; notes: string[] };
  /** Setup the status refers to (triggered, or the one being waited for). */
  setupType: SetupType | 'NONE';
  /** Every setup evaluated, with activation / trigger / invalidation / reason. */
  setups: SetupEval[];
  /** Candidate Setup label (no levels). Null when there is no candidate or the status is a reversal NO TRADE. */
  candidateSetup: string | null;
  /**
   * Candidate Setup numbers as percentages only — for discovery screens (Moonstock) that rank candidates
   * before this engine validates them. Never a trade plan. Null when there is no candidate.
   */
  candidateStats: { potentialPct: number | null; riskReward: number | null; upsidePct: number | null; target20Realistic: boolean } | null;
  momentum: MomentumGrade;
  structure: StructureGrade;
  exitRisk: ExitRisk;
  trend: TrendRead;
  volume: VolumeRead;
  setup: MomentumSetup;
  entryLow: number | null;
  entryHigh: number | null;
  /** Entry used for SL / TP / R:R — current price when inside the zone, else the zone middle. */
  entryRef: number | null;
  sl: number | null;
  slBasis: string | null;
  tp1: MomentumTarget | null;
  tp2: MomentumTarget | null;
  /** % from entry to TP2. */
  potentialPct: number | null;
  /** % from entry to SL (FINAL SL only). */
  riskPct: number | null;
  /** FINAL / PROVISIONAL / UNKNOWN / NONE — see SlStage. Only a BUY publishes the FINAL SL price. */
  slStage: SlStage;
  /** Gross reward : risk to TP2 (1 : x → x). */
  riskReward: number | null;
  /** Net of fees + slippage. */
  riskRewardNet: number | null;
  /** % from entry to the nearest resistance above (null = no resistance overhead). */
  upsideToResistancePct: number | null;
  /** % ATR 14 × atrReachMult of the mode — realistic travel within the horizon. */
  volatilityRoomPct: number | null;
  /** TP2 ≥ +20% backed by both structure and ATR × ATR_TRAVEL_MULT (momentum20 semantics). */
  target20Realistic: boolean;
  /** HARD RISK GATE — all must PASS for BUY. Empty when data is insufficient. */
  riskGate: RiskGateItem[];
  indicators: MomentumIndicators;
  metrics: {
    price: number;
    rsi14: number | null;
    macdHistogram: number | null;
    macdRising: boolean | null;
    roc5: number | null;
    accelerating: boolean | null;
    rvol: number | null;
    volumeRatio5: number | null;
    atrPct: number | null;
    distEma20Pct: number | null;
    /** Distance from EMA 20 in ATRs. */
    distEma20Atr: number | null;
    /** Extended threshold actually used, % above EMA 20. */
    extendedLimitPct: number | null;
    structureLabel: string;
    breakoutLevel: number | null;
    nearestResistance: number | null;
    nearestSupport: number | null;
  };
  /** Per-area checks for the detail view. */
  checks: Record<'trend' | 'momentum' | 'volume' | 'structure' | 'volatility' | 'distribution', MomentumSignalItem[]>;
  distributionFlags: DistributionFlag[];
  /** 2–3 main reasons. */
  reasons: string[];
  /** BUY: the entry trigger / zone. Otherwise the condition that must happen first (no fake entry price). */
  entryCondition: string;
  /** When to analyse again. */
  reEvaluation: string;
  /** BUY → entryCondition, else reEvaluation (kept for share text / older callers). */
  trigger: string;
  riskWarnings: string[];
  exitWarnings: string[];
  conclusion: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

const pct = (a: number, b: number) => (a / b - 1) * 100;
const fin = (n: number | null | undefined): n is number => n != null && Number.isFinite(n);
const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN);
const at = (xs: number[], k: number): number | null => { const v = xs[xs.length - 1 - k]; return fin(v) ? v : null; };
/** One-decimal number for narrative text, Indonesian locale (1,5 — matching Rp 1.250). */
const r1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString('id-ID', { maximumFractionDigits: 1 });
const rp = (n: number) => `Rp ${Math.round(roundToTick(n) || n).toLocaleString('id-ID')}`;
const rpM = (n: number) => `Rp ${r1(n / 1e9)} M`;
const r1f = (n: number) => n.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
/** Inclusive limits: a value exactly at the limit passes (float noise tolerated). */
const EPS = 1e-9;
/** "8,2% > 8,0%" — adds decimals until the shown value can't contradict the verdict (8,04% never reads "8,0% > 8,0%"). */
function cmpLimit(v: number, lim: number, unit: string, pass: boolean): string {
  let d = 1;
  while (d < 3 && !pass && v.toFixed(d) === lim.toFixed(d)) d += 1;
  const f = (x: number) => x.toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d });
  return `${f(v)}${unit} ${pass ? '≤' : '>'} ${f(lim)}${unit}`;
}
/**
 * Valid SL for a long — two independent hard limits, both inclusive:
 *   slRiskPct     = (entry − SL) / entry × 100   ≤ maxSlPct
 *   slAtrMultiple = (entry − SL) / ATR           ≤ maxSlAtr
 * The SL itself is never moved to pass.
 */
export function evaluateSl(entry: number, sl: number, atr: number, cfg: Pick<MomentumModeConfig, 'maxSlPct' | 'maxSlAtr'>) {
  const slRiskPct = ((entry - sl) / entry) * 100;
  const slAtrMultiple = (entry - sl) / atr;
  const pctPass = slRiskPct > 0 && slRiskPct <= cfg.maxSlPct + EPS;
  const atrPass = slAtrMultiple > 0 && slAtrMultiple <= cfg.maxSlAtr + EPS;
  return {
    slRiskPct, slAtrMultiple, pctPass, atrPass,
    pctText: `risiko ${cmpLimit(slRiskPct, cfg.maxSlPct, '%', pctPass)}`,
    atrText: cmpLimit(slAtrMultiple, cfg.maxSlAtr, '× ATR', atrPass),
  };
}
const rrCmp = (rr: number | null, min: number, pass: boolean) => (rr == null ? 'N/A' : `1:${r1f(rr)} ${pass ? '≥' : '<'} 1:${r1f(min)}`);

function structureOf(bars: OHLCVBar[], w = 10): { highs: 'HH' | 'LH' | 'EQ' | null; lows: 'HL' | 'LL' | 'EQ' | null; label: string } {
  if (bars.length < w * 2) return { highs: null, lows: null, label: 'Data kurang' };
  const recent = bars.slice(-w);
  const prior = bars.slice(-w * 2, -w);
  const dh = pct(Math.max(...recent.map((b) => b.high)), Math.max(...prior.map((b) => b.high)));
  const dl = pct(Math.min(...recent.map((b) => b.low)), Math.min(...prior.map((b) => b.low)));
  const highs = dh > 0.5 ? 'HH' : dh < -0.5 ? 'LH' : 'EQ';
  const lows = dl > 0.5 ? 'HL' : dl < -0.5 ? 'LL' : 'EQ';
  const H = { HH: 'Higher High', LH: 'Lower High', EQ: 'High sejajar' } as const;
  const L = { HL: 'Higher Low', LL: 'Lower Low', EQ: 'Low sejajar' } as const;
  return { highs, lows, label: `${H[highs]} + ${L[lows]}` };
}

function emptyReport(price: number, note: string, cfg: MomentumModeConfig, data: DataQuality): MomentumTradeReport {
  return {
    mode: cfg.key,
    config: cfg,
    dataOk: false,
    dataNote: note,
    data,
    status: 'NO TRADE',
    finalGate: 'N/A',
    opportunity: { grade: 'N/A', score: null, notes: [] },
    setupType: 'NONE',
    setups: [],
    candidateSetup: null,
    candidateStats: null,
    momentum: 'N/A',
    structure: 'N/A',
    exitRisk: 'N/A',
    trend: 'N/A',
    volume: 'N/A',
    setup: 'NONE',
    entryLow: null,
    entryHigh: null,
    entryRef: null,
    sl: null,
    slBasis: null,
    tp1: null,
    tp2: null,
    potentialPct: null,
    riskPct: null,
    slStage: 'NONE',
    riskReward: null,
    riskRewardNet: null,
    upsideToResistancePct: null,
    volatilityRoomPct: null,
    target20Realistic: false,
    riskGate: [],
    indicators: {
      rsi14: null, rsiPrev: null, macdLine: null, macdSignal: null, macdHistogram: null, macdHistogramPrev: null,
      ema9: null, ema20: null, ema50: null, ema200: null, ema20Slope5Pct: null, atr14: null, atrPct: null, rvol: null, avgValue20: null,
    },
    metrics: {
      price, rsi14: null, macdHistogram: null, macdRising: null, roc5: null, accelerating: null, rvol: null,
      volumeRatio5: null, atrPct: null, distEma20Pct: null, distEma20Atr: null, extendedLimitPct: null, structureLabel: 'Data kurang',
      breakoutLevel: null, nearestResistance: null, nearestSupport: null,
    },
    checks: { trend: [], momentum: [], volume: [], structure: [], volatility: [], distribution: [] },
    distributionFlags: [],
    reasons: [note],
    entryCondition: 'N/A — data belum cukup.',
    reEvaluation: 'Analisa ulang setelah data harga lengkap tersedia.',
    trigger: 'N/A — data belum cukup untuk menilai momentum.',
    riskWarnings: [],
    exitWarnings: [],
    conclusion: 'Data tidak cukup — NO TRADE, tidak ada keputusan momentum.',
  };
}

interface Plan {
  entryLow: number;
  entryHigh: number;
  entryRef: number;
  inZone: boolean;
  /** False when the structural low isn't known yet (pullback not formed) — SL / R:R gates are PENDING. */
  slKnown: boolean;
  sl: number;
  slBasis: string;
  riskPct: number;
  riskAtr: number;
  tp1: MomentumTarget | null;
  tp2: MomentumTarget | null;
  potentialPct: number | null;
  rr: number | null;
  rrNet: number | null;
  upsideToResistancePct: number | null;
  /** Realistic travel within the mode's horizon, %. */
  reachPct: number;
  /** TP2 within reach. */
  realistic: boolean;
  /** TP2 ≥ 20% and ATR × ATR_TRAVEL_MULT can cover it (momentum20 semantics, for Moonstock). */
  target20Realistic: boolean;
  /** Nearest resistance above entry. */
  blocker: number | null;
}

/**
 * Entry zone → structural SL → TP1 / TP2 from technical levels only.
 *   momentum20: TP2 = next resistance overhead, else measured move (blue sky).
 *   swing:      TP2 = the highest technical level within min(ATR reach, maxTargetPct); if none, the first
 *               level within ATR reach; otherwise no realistic target (the reward gate fails — nothing is stretched).
 */
function buildPlan(a: {
  price: number;
  zoneLow: number;
  zoneHigh: number;
  structuralLow: number | null;
  /** Used for the hypothetical SL when the structural low isn't known yet. */
  fallbackLow: number;
  slLabel: string;
  atr: number;
  resistances: number[];
  measuredMove: number | null;
  swingHigh: number | null;
  cfg: MomentumModeConfig;
}): Plan {
  const { cfg } = a;
  const entryLow = roundToTick(a.zoneLow);
  const entryHigh = roundToTick(Math.max(a.zoneHigh, a.zoneLow));
  const inZone = a.price >= entryLow && a.price <= entryHigh;
  const entryRef = inZone ? a.price : roundToTick((entryLow + entryHigh) / 2);
  const slKnown = a.structuralLow != null;
  // Rounded DOWN to a valid tick: rounding to the nearest tick could shave the buffer and flatter the risk.
  const sl = floorToTick(Math.min(a.structuralLow ?? a.fallbackLow, entryLow) - SL_BUFFER_ATR * a.atr);
  const riskPct = ((entryRef - sl) / entryRef) * 100;
  const riskAtr = (entryRef - sl) / a.atr;

  const above = [...new Set(a.resistances.filter((r) => fin(r) && r > entryRef * 1.01).map(roundToTick))].sort((x, y) => x - y);
  const blocker = above[0] ?? null;
  const upsideToResistancePct = blocker != null ? pct(blocker, entryRef) : null;
  const mm = a.measuredMove != null && a.measuredMove > entryRef * 1.01 ? roundToTick(a.measuredMove) : null;
  const reachPct = (a.atr / entryRef) * 100 * cfg.atrReachMult;
  const T = (price: number, basis: string): MomentumTarget => ({ price, pct: pct(price, entryRef), basis });

  let tp2: MomentumTarget | null = null;
  if (cfg.maxTargetPct == null) {
    if (blocker != null) tp2 = T(blocker, 'Resistance berikutnya');
    else if (mm != null) tp2 = T(mm, 'Measured move (tanpa resistance di atas)');
  } else {
    const levels = [
      ...above.map((p) => T(p, 'Resistance')),
      ...(mm != null ? [T(mm, 'Measured move')] : []),
      ...(a.swingHigh != null && roundToTick(a.swingHigh) > entryRef * 1.01 ? [T(roundToTick(a.swingHigh), 'Swing high terakhir')] : []),
    ].filter((t) => t.pct >= MIN_TP1_PCT).sort((x, y) => x.price - y.price);
    const window = Math.min(reachPct, cfg.maxTargetPct);
    const inWindow = levels.filter((t) => t.pct <= window);
    tp2 = inWindow[inWindow.length - 1] ?? levels.find((t) => t.pct <= reachPct) ?? null;
  }

  let tp1: MomentumTarget | null = null;
  if (tp2) {
    const cands = [
      ...above.filter((r) => r < tp2!.price).map((r) => T(r, 'Resistance terdekat')),
      ...(mm != null && mm < tp2.price ? [T(mm, 'Measured move')] : []),
      ...(a.swingHigh != null && roundToTick(a.swingHigh) < tp2.price ? [T(roundToTick(a.swingHigh), 'Swing high terakhir')] : []),
    ].filter((c) => c.pct >= MIN_TP1_PCT).sort((x, y) => x.price - y.price);
    tp1 = cands[0] ?? null;
  }

  const risk = entryRef - sl;
  const rr = tp2 && risk > 0 ? (tp2.price - entryRef) / risk : null;
  const rrNet = tp2 && risk > 0 ? netRiskReward(entryRef, sl, tp2.price, cfg.costs).rr : null;
  const travel20 = (a.atr / entryRef) * 100 * ATR_TRAVEL_MULT;
  return {
    entryLow, entryHigh, entryRef, inZone, slKnown, sl, slBasis: a.slLabel, riskPct, riskAtr, tp1, tp2,
    potentialPct: tp2 ? tp2.pct : null,
    rr, rrNet,
    upsideToResistancePct,
    reachPct,
    realistic: tp2 != null && tp2.pct <= reachPct,
    target20Realistic: tp2 != null && tp2.pct >= 20 && travel20 >= 20,
    blocker,
  };
}

// ─── Engine ─────────────────────────────────────────────────────────────────────

export function buildMomentumTrade(i: MomentumInput, opts: MomentumOptions = {}): MomentumTradeReport {
  const cfg: MomentumModeConfig = { ...MOMENTUM_MODES[opts.mode ?? 'swing'], ...opts.config };
  const bars = i.bars;
  const price = i.price;
  const { ema9, ema20, ema50, rsi14, atr14 } = i;
  const data = assessData(bars, MIN_BARS, opts.asOf);
  if (!fin(price) || price <= 0) return emptyReport(price, 'Harga terakhir tidak tersedia.', cfg, { ...data, usable: false, gateOk: false });
  if (!data.usable) return emptyReport(price, data.notes[0] ?? 'Data tidak cukup.', cfg, data);
  if (!fin(ema20) || !fin(ema50) || !fin(rsi14) || !fin(atr14) || atr14 <= 0) {
    return emptyReport(price, 'EMA 20/50, RSI atau ATR tidak tersedia.', cfg, { ...data, usable: false, gateOk: false });
  }

  const last = bars[bars.length - 1];
  const prev = bars[bars.length - 2];
  const closes = bars.map((b) => b.close);
  const atrPct = (atr14 / price) * 100;
  const roomPct = atrPct * cfg.atrReachMult;
  const ema200 = fin(i.ema200) ? i.ema200 : null;
  if (Math.abs(pct(price, last.close)) > 1) data.notes.push(`Harga ringkasan ${rp(price)} berbeda dari close candle terakhir ${rp(last.close)} — trigger dinilai dari candle.`);

  // 1. Trend — EMA order + slope, Higher High / Higher Low.
  const st = structureOf(bars);
  const distEma20Pct = pct(price, ema20);
  const distEma20Atr = (price - ema20) / atr14;
  const ema20Series = ema(closes, 20);
  const e20Now = at(ema20Series, 0);
  const e20Prev5 = at(ema20Series, 5);
  const ema20Slope5Pct = e20Now != null && e20Prev5 != null ? pct(e20Now, e20Prev5) : null;
  const emaUp = ema20 > ema50;
  const trend: TrendRead =
    emaUp && price > ema50 && st.lows !== 'LL' ? 'BULLISH'
      : !emaUp && price < ema50 && st.highs !== 'HH' ? 'BEARISH'
        : 'SIDEWAYS';

  // 2. Momentum — RSI value & direction, MACD line vs signal, histogram & its change, ROC acceleration.
  const md = macd(bars);
  const hist = md.histogram.filter(Number.isFinite);
  const h0 = hist[hist.length - 1] ?? null;
  const h1 = hist[hist.length - 2] ?? null;
  const h2 = hist[hist.length - 3] ?? null;
  const macdLine = at(md.macdLine, 0);
  const macdSignal = at(md.signalLine, 0);
  const macdHistogram = fin(i.macdHistogram) ? i.macdHistogram : h0;
  const macdRising = h0 != null && h1 != null ? h0 > h1 : null;
  const macdWeakening = h0 != null && h1 != null && h2 != null && ((h0 > 0 && h0 < h1 && h1 < h2) || (h0 <= 0 && h1 > 0));
  const rsiPrev = at(rsi(bars, 14), 1);
  const c = (k: number) => closes[closes.length - 1 - k];
  const roc5 = closes.length > 5 ? pct(c(0), c(5)) : null;
  const prevRoc5 = closes.length > 10 ? pct(c(5), c(10)) : null;
  const accelerating = roc5 != null && prevRoc5 != null ? roc5 > prevRoc5 && roc5 > 0 : null;
  const rvol = relVolume(bars) ?? (fin(i.rvol) ? i.rvol : null);
  let mPts = 0;
  if (rsi14 >= 60) mPts += 1; else if (rsi14 >= 50) mPts += 0.5;
  if (macdHistogram != null && macdHistogram > 0) mPts += 1;
  if (macdRising) mPts += 1;
  if (accelerating) mPts += 1;
  if (rvol != null && rvol >= 1.2) mPts += 1;
  const momentum: MomentumGrade = mPts >= 4 ? 'STRONG' : mPts >= 2 ? 'MODERATE' : 'WEAK';

  // 3. Volume & liquidity
  const volMa20 = avg(bars.slice(-21, -1).map((b) => b.volume));
  const volumeRatio5 = volMa20 > 0 ? avg(bars.slice(-5).map((b) => b.volume)) / volMa20 : null;
  const volume: VolumeRead = volumeRatio5 == null ? 'N/A' : volumeRatio5 >= 1.3 ? 'EXPANSION' : volumeRatio5 <= 0.8 ? 'CONTRACTION' : 'NORMAL';
  const liq = liquidityOf(bars);
  const liquidityOk = liq.avgValue20 != null && liq.avgValue20 >= cfg.minAvgValue20;

  // 4. Setups (each judged on the last candle; pivots / levels from completed bars only)
  const ctx = { bars, atr: atr14, ema9: fin(ema9) ? ema9 : null, ema20, ema50, trendBullish: trend === 'BULLISH' };
  const bo = detectBreakout(ctx);
  const rtRaw = detectRetest(ctx);
  const rt: SetupEval = bo.state === 'TRIGGERED' && rtRaw.level === bo.level
    ? { ...rtRaw, state: 'ABSENT', reason: 'Breakout baru terjadi di candle terakhir — dinilai sebagai breakout' } : rtRaw;
  const pb = detectPullback(ctx);
  const cons = detectConsolidation(ctx);
  const trendSetup: SetupEval = {
    type: 'TREND',
    state: trend === 'BULLISH' && (ema20Slope5Pct ?? 0) > 0 && price > ema20 ? 'PRESENT' : 'ABSENT',
    activation: 'EMA 20 > EMA 50 dan menanjak, harga di atas EMA 20, Higher High + Higher Low',
    triggerPrice: null, zoneLow: null, zoneHigh: null, level: ema20, measuredMove: null, structuralLow: null,
    invalidationPrice: ema50, invalidation: `Close di bawah EMA 50 (${rp(ema50)})`,
    reason: `EMA 20 ${emaUp ? '>' : '<'} EMA 50, kemiringan EMA 20 ${ema20Slope5Pct == null ? 'N/A' : `${ema20Slope5Pct >= 0 ? '+' : ''}${r1(ema20Slope5Pct)}%/5 sesi`}, ${st.label}${ema200 != null ? `, harga ${price > ema200 ? 'di atas' : 'di bawah'} EMA 200` : ''}`
      + ' — konteks; entry tetap lewat pullback / breakout',
  };
  const setups: SetupEval[] = [trendSetup, bo, rt, pb, cons];

  // 5. Distribution & reversal risk
  const flags: DistributionFlag[] = [];
  const rejection = bars.slice(-3).some((b) => {
    const range = b.high - b.low;
    const upper = b.high - Math.max(b.open, b.close);
    return range >= 0.8 * atr14 && upper >= 0.5 * range && b.close < (b.high + b.low) / 2;
  });
  if (rejection) flags.push({ key: 'rejection', label: 'Rejection — upper wick panjang, close di bawah tengah candle' });
  if (st.highs === 'LH') flags.push({ key: 'lowerHigh', label: 'Lower High — puncak terbaru lebih rendah' });
  const sellingVolume = bars.slice(-5).some((b, k, arr) => {
    const p = k === 0 ? bars[bars.length - 6] : arr[k - 1];
    return b.close < b.open && p != null && b.close < p.close && volMa20 > 0 && b.volume >= 1.5 * volMa20;
  });
  if (sellingVolume) flags.push({ key: 'sellingVolume', label: 'Selling volume — candle merah dengan volume ≥ 1,5× rata-rata' });
  const prior10Low = Math.min(...bars.slice(-11, -1).map((b) => b.low));
  const breakdown = price < prior10Low || (price < ema50 && prev.close >= ema50);
  if (breakdown) flags.push({ key: 'breakdown', label: price < prior10Low ? 'Breakdown support — close di bawah low 10 sesi' : 'Breakdown EMA 50' });
  if (macdWeakening) flags.push({ key: 'macdWeakening', label: 'MACD melemah — histogram turun / cross ke negatif' });
  if (rt.state === 'INVALID') flags.push({ key: 'failedBreakout', label: `False breakout — close kembali di bawah ${rp(rt.level!)}` });

  // 6. Extension — relative to volatility, not one universal %.
  const extendedLimitPct = Math.max(EXTENDED_EMA20_PCT, EXTENDED_ATR_MULT * atrPct);
  const roc5Limit = Math.max(EXTENDED_ROC5_PCT, EXTENDED_ROC5_ATR_MULT * atrPct);
  const extended = distEma20Pct > extendedLimitPct || (roc5 != null && roc5 >= roc5Limit) || rsi14 >= EXTREME_RSI;

  // Exit risk = distribution/reversal risk; a hot / extended chart adds at most one notch (LOW → MEDIUM).
  const riskPts = flags.length + (breakdown ? 1 : 0) + (trend === 'BEARISH' ? 1 : 0);
  let exitRisk: ExitRisk = breakdown || riskPts >= 3 ? 'EXTREME' : riskPts === 2 ? 'HIGH' : riskPts === 1 ? 'MEDIUM' : 'LOW';
  if (exitRisk === 'LOW' && (extended || rsi14 >= HOT_RSI)) exitRisk = 'MEDIUM';
  const distributionGateOk = exitRisk === 'LOW' || exitRisk === 'MEDIUM';
  const distribution = breakdown || flags.length >= 3;
  const reversal = !distributionGateOk || distribution || trend === 'BEARISH';
  const structure: StructureGrade =
    distribution ? 'DISTRIBUTION' : trend === 'BEARISH' ? 'DOWNTREND' : extended ? 'EXTENDED' : trend === 'BULLISH' ? 'HEALTHY' : 'NO TREND';

  // Support & resistance
  const resistances = [...i.resistances, ...(fin(i.annualHigh) ? [i.annualHigh] : [])].filter((r) => fin(r) && r > 0);
  const supportsBelow = i.supports.filter((s) => fin(s) && s < price);
  const nearestSupport = supportsBelow.length ? Math.max(...supportsBelow) : null;
  const nearestResistance = resistances.filter((r) => r > price * 1.01).sort((a, b) => a - b)[0] ?? null;
  const swingHigh = Math.max(...bars.slice(-20).map((b) => b.high));
  const recentLow5 = Math.min(...bars.slice(-5).map((b) => b.low));

  const planOf = (s: SetupEval): Plan => {
    const common = { price, atr: atr14, resistances, swingHigh: swingHigh > price * 1.01 ? swingHigh : null, cfg };
    if (s.type === 'PULLBACK') {
      const zoneHigh = s.state === 'TRIGGERED' ? Math.max(s.zoneHigh!, last.close) : s.zoneHigh!;
      // Measured move for a pullback (ABC): C + (B − A) over the last leg.
      const idxB = bars.length - 20 + bars.slice(-20).findIndex((b) => b.high === swingHigh);
      const legLow = Math.min(...bars.slice(Math.max(0, idxB - 30), idxB + 1).map((b) => b.low));
      return buildPlan({
        ...common, zoneLow: s.zoneLow!, zoneHigh, structuralLow: s.structuralLow, fallbackLow: Math.min(recentLow5, s.zoneLow!),
        slLabel: 'Di bawah swing low pullback − 0,5× ATR', measuredMove: Math.min(recentLow5, price) + (swingHigh - legLow),
      });
    }
    const L = s.level!;
    return buildPlan({
      ...common, zoneLow: s.zoneLow!, zoneHigh: s.zoneHigh!, structuralLow: s.structuralLow, fallbackLow: L,
      slLabel: s.type === 'CONSOLIDATION' ? `Di bawah range low ${rp(s.structuralLow ?? L)} − 0,5× ATR`
        : s.type === 'RETEST' ? `Di bawah low retest / level ${rp(L)} − 0,5× ATR` : `Di bawah level breakout ${rp(L)} − 0,5× ATR`,
      measuredMove: s.measuredMove,
    });
  };

  // ─── Candidate selection ────────────────────────────────────────────────────
  // Triggered setup first; otherwise the setup being waited for (retest → breakout/range → pullback).
  const triggered = [bo, rt, pb].find((s) => s.state === 'TRIGGERED') ?? null;
  const pending =
    rt.state === 'PENDING' ? rt
      : bo.state === 'PENDING' ? bo
        : cons.state === 'PENDING' && trend !== 'BEARISH' ? cons
          : pb.state === 'PENDING' ? pb : null;
  const cand: SetupEval | null = triggered ?? pending;
  const plan = cand ? planOf(cand) : null;
  const setup: MomentumSetup = triggered ? (triggered.type as MomentumSetup) : 'NONE';
  const momentumOk = momentum !== 'WEAK';

  // ─── HARD RISK GATE ─────────────────────────────────────────────────────────
  const G = (key: RiskGateKey, state: GateState, detail: string): RiskGateItem => ({ key, label: riskGateLabel(key, cfg), pass: state === 'PASS', state, detail });
  const ok = (b: boolean): GateState => (b ? 'PASS' : 'FAIL');
  const triggerOk = !!triggered && !!plan && plan.inZone && momentumOk && data.lastBarClosed;
  // SL stages: FINAL only once the entry is valid (trigger PASS). Before that the SL is PROVISIONAL — a simulation
  // on the zone (price if inside it, else the zone middle) — and the SL / R:R gates stay PENDING, never PASS.
  const slStage: SlStage = !plan ? 'NONE' : !plan.slKnown ? 'UNKNOWN' : triggerOk ? 'FINAL' : 'PROVISIONAL';
  const slFinal = slStage === 'FINAL';
  const slEval = plan ? evaluateSl(plan.entryRef, plan.sl, atr14, cfg) : null;
  const slPctOk = !!slEval?.pctPass;
  const slAtrOk = !!slEval?.atrPass;
  const rrOk = plan?.rrNet != null && plan.rrNet >= cfg.minRR - EPS;
  const simEntry = plan ? `${plan.inZone ? 'harga sekarang' : 'tengah zona'} ${rp(plan.entryRef)}` : '';
  const slGate = (key: 'slPct' | 'slAtr', pass: boolean, cmpText: string): RiskGateItem =>
    G(key, !plan ? 'FAIL' : !plan.slKnown || !slFinal ? 'PENDING' : ok(pass),
      !plan ? 'Tidak ada setup — tidak ada SL struktural'
        : !plan.slKnown ? 'PENDING — swing low pullback belum terbentuk, SL struktural belum ada'
          : !slFinal ? `PENDING ENTRY — entry belum terkonfirmasi. Simulasi (entry ${simEntry}, SL ${rp(plan.sl)}): ${cmpText}${pass ? '' : ' → akan FAIL bila entry di sini'}`
            : `${cmpText} (entry ${rp(plan.entryRef)}, SL ${rp(plan.sl)} = ${plan.slBasis.toLowerCase()})`);
  const gates: RiskGateItem[] = [
    G('data', ok(data.gateOk), data.gateOk ? `Data harian ${data.lastBarDate} lengkap (${bars.length} sesi)` : data.notes.join(' ')),
    G('liquidity', ok(liquidityOk), liq.avgValue20 == null ? 'Nilai transaksi tidak tersedia'
      : `Rata-rata nilai transaksi 20 hari ${rpM(liq.avgValue20)} (min ${rpM(cfg.minAvgValue20)})`),
    G('trigger', ok(triggerOk),
      triggerOk ? `${SETUP_TYPE_NAME[triggered!.type]} terkonfirmasi — harga di zona entry`
        : triggered && !data.lastBarClosed ? `${SETUP_TYPE_NAME[triggered.type]} terdeteksi di candle yang belum ditutup`
          : triggered && !momentumOk ? `${SETUP_TYPE_NAME[triggered.type]}, tapi momentum lemah`
            : triggered ? `${SETUP_TYPE_NAME[triggered.type]}, tapi harga sudah di luar zona entry`
              : cand?.type === 'RETEST' ? `Konfirmasi retest belum terjadi — ${cand.reason}`
                : cand ? `Belum terpicu — ${cand.reason}`
                  : extended ? `Harga ${r1(distEma20Pct)}% di atas EMA 20 — tidak ada trigger saat extended` : 'Tidak ada setup breakout / retest / pullback'),
    slGate('slPct', slPctOk, slEval?.pctText ?? ''),
    slGate('slAtr', slAtrOk, slEval?.atrText ?? ''),
    G('potential', ok(!!plan?.tp2 && plan.tp2.pct >= cfg.minRewardPct && plan.realistic),
      !plan ? 'Tidak ada setup kandidat'
        : plan.tp2 == null ? `Tidak ada target teknikal dalam jangkauan ATR ±${r1(plan.reachPct)}%`
          : plan.tp2.pct < cfg.minRewardPct ? `Target teknikal hanya +${r1(plan.tp2.pct)}% (min ${cfg.minRewardPct}%)`
            : !plan.realistic ? `Target +${r1(plan.tp2.pct)}% melebihi jangkauan ATR ±${r1(plan.reachPct)}%`
              : `Target teknikal +${r1(plan.tp2.pct)}% (${plan.tp2.basis.toLowerCase()}, jangkauan ATR ±${r1(plan.reachPct)}%)`),
    G('rr', !plan ? 'FAIL' : plan.tp2 == null || !plan.slKnown || !slFinal ? 'PENDING' : ok(rrOk),
      !plan ? 'Tidak ada setup — R:R tidak dapat dihitung'
        : plan.tp2 == null ? 'PENDING — target teknikal (resistance / measured move) belum tersedia, R:R tidak dihitung'
          : !plan.slKnown ? 'PENDING — SL struktural belum ada'
            : !slFinal ? `PENDING ENTRY — entry belum terkonfirmasi. Simulasi ke TP2 ${rp(plan.tp2.price)}: kotor 1:${r1f(plan.rr!)}, net ${rrCmp(plan.rrNet, cfg.minRR, rrOk)}`
              : `net ${rrCmp(plan.rrNet, cfg.minRR, rrOk)} (kotor 1:${r1f(plan.rr!)}; TP2 ${rp(plan.tp2.price)} − entry ${rp(plan.entryRef)} vs entry − SL ${rp(plan.sl)}, fee ${r1f(cfg.costs.buyFeePct)}%/${r1f(cfg.costs.sellFeePct)}% + slippage)`),
    G('distribution', ok(distributionGateOk), `Exit risk ${exitRisk}${
      [flags.length ? `${flags.length} tanda distribusi` : '', breakdown ? 'breakdown support' : '', trend === 'BEARISH' ? 'tren turun' : '']
        .filter(Boolean).map((x, k) => (k === 0 ? ` — ${x}` : ` + ${x}`)).join('')}`),
    G('upside', ok(!!plan && (plan.upsideToResistancePct == null ? plan.tp2 != null : plan.upsideToResistancePct >= cfg.minUpsidePct)),
      !plan ? 'Tidak ada setup kandidat'
        : plan.upsideToResistancePct == null ? (plan.tp2 != null ? 'Tidak ada resistance di atas (blue sky)' : 'Tidak ada target terukur')
          : `Resistance terdekat ${rp(plan.blocker!)} (+${r1(plan.upsideToResistancePct)}% dari entry)`),
    G('chase', ok(!extended), extended
      ? `Harga ${r1(distEma20Pct)}% (${r1(distEma20Atr)}× ATR) di atas EMA 20 — batas ${r1(extendedLimitPct)}%${roc5 != null && roc5 >= roc5Limit ? `; naik ${r1(roc5)}% dalam 5 sesi` : ''}${rsi14 >= EXTREME_RSI ? `; RSI ${r1(rsi14)}` : ''}`
      : `Jarak dari EMA 20 ${r1(distEma20Pct)}% (batas ${r1(extendedLimitPct)}%)`),
  ];
  const allPass = gates.every((g) => g.pass);
  const failed = gates.filter((g) => !g.pass);
  const failedKeys = new Set(failed.map((g) => g.key));

  // ─── Status ─────────────────────────────────────────────────────────────────
  const waitFor = (t: SetupType): MomentumTradeStatus =>
    t === 'RETEST' ? 'WAIT RETEST' : t === 'PULLBACK' ? 'WAIT PULLBACK' : 'WAIT BREAKOUT';
  let status: MomentumTradeStatus;
  if (data.status === 'STALE') status = 'NO TRADE';
  else if (reversal) status = 'NO TRADE';
  else if (extended) status = 'AVOID CHASING';
  else if (triggered && allPass) status = 'BUY';
  else if (triggered) {
    // The trigger fired but a gate failed: say what would make it tradable, never upgrade it to BUY.
    if (!data.lastBarClosed) status = waitFor(triggered.type);
    else if (failedKeys.has('data') || failedKeys.has('liquidity')) status = 'NO TRADE';
    else if (failedKeys.has('slPct') || failedKeys.has('slAtr')) status = 'WATCHLIST';
    else if ((failedKeys.has('upside') || failedKeys.has('potential')) && plan?.blocker != null) status = 'WAIT BREAKOUT';
    else if (failedKeys.has('trigger')) status = triggered.type === 'PULLBACK' ? 'WAIT PULLBACK' : 'WAIT RETEST';
    else status = 'WATCHLIST';
  } else if (pending) status = waitFor(pending.type);
  else if (trend === 'BULLISH' || (trend === 'SIDEWAYS' && momentum !== 'WEAK')) status = 'WATCHLIST';
  else status = 'NO TRADE';

  const finalGate: FinalGate = status === 'BUY' ? 'PASS' : 'BLOCKED';
  // Final Trade Plan — Validated Setup only. Anything else: every trading parameter stays N/A.
  const p: Plan | null = status === 'BUY' ? plan : null;
  const setupType: SetupType | 'NONE' = status === 'NO TRADE' && reversal ? 'NONE' : cand?.type ?? (trendSetup.state === 'PRESENT' ? 'TREND' : 'NONE');
  // Waiting on a resistance that blocks a triggered setup → the breakout of THAT level is the next trigger.
  const blockerWait = status === 'WAIT BREAKOUT' && triggered && plan?.blocker != null ? plan.blocker : null;

  // ─── Opportunity Scanner (analysis only) ───────────────────────────────────
  const oppNotes: string[] = [];
  let score = 0;
  if (emaUp) score += 15; else oppNotes.push('EMA 20 di bawah EMA 50');
  if (price > ema20) score += 10;
  if ((ema20Slope5Pct ?? 0) > 0) score += 10; else oppNotes.push('EMA 20 belum menanjak');
  if (st.highs === 'HH' && st.lows === 'HL') score += 15; else oppNotes.push(st.label);
  score += momentum === 'STRONG' ? 20 : momentum === 'MODERATE' ? 10 : 0;
  if ((rvol ?? 0) >= 1.2 || volume === 'EXPANSION') score += 10;
  if (liquidityOk) score += 10; else oppNotes.push('Likuiditas di bawah ambang');
  score += Math.max(0, 10 - 5 * flags.length);
  if (extended) oppNotes.push('Extended — peluang ada, entry belum menarik');
  const opportunity = { grade: (score >= 70 ? 'HIGH' : score >= 45 ? 'MEDIUM' : 'LOW') as OpportunityGrade, score, notes: oppNotes.slice(0, 3) };

  // ─── Checks per area ─────────────────────────────────────────────────────────
  const checks: MomentumTradeReport['checks'] = {
    trend: [
      { label: `EMA 20 ${emaUp ? '>' : '<'} EMA 50`, ok: emaUp },
      { label: `EMA 20 ${ema20Slope5Pct == null ? 'kemiringan N/A' : `${ema20Slope5Pct >= 0 ? 'naik' : 'turun'} ${r1(Math.abs(ema20Slope5Pct))}% / 5 sesi`}`, ok: (ema20Slope5Pct ?? 0) > 0 },
      { label: `Harga ${price > ema20 ? 'di atas' : 'di bawah'} EMA 20 (${r1(distEma20Pct)}%)`, ok: price > ema20 },
      ...(ema200 != null ? [{ label: `Harga ${price > ema200 ? 'di atas' : 'di bawah'} EMA 200 (${rp(ema200)})`, ok: price > ema200 }] : []),
      { label: st.label, ok: st.highs === 'HH' && st.lows === 'HL' },
    ],
    momentum: [
      { label: `RSI 14 = ${r1(rsi14)}${rsiPrev != null ? ` (${rsi14 >= rsiPrev ? 'naik' : 'turun'} dari ${r1(rsiPrev)})` : ''}${rsi14 > 70 ? ' — kuat sekaligus rawan jenuh beli, bukan larangan otomatis' : ''}`, ok: rsi14 >= 55 && rsi14 < EXTREME_RSI },
      {
        label: macdLine != null && macdSignal != null
          ? `MACD ${macdLine > macdSignal ? 'di atas' : 'di bawah'} signal, ${macdLine >= 0 ? 'di atas' : 'di bawah'} nol${macdLine > macdSignal && macdLine < 0 ? ' (crossover masih di bawah nol)' : ''}; histogram ${macdRising == null ? '' : macdRising ? 'membesar' : 'mengecil'}`
          : `MACD histogram ${macdHistogram != null && macdHistogram > 0 ? 'positif' : 'negatif'}`,
        ok: macdHistogram != null && macdHistogram > 0 && macdRising === true,
      },
      { label: roc5 == null ? 'Akselerasi harga: N/A' : `ROC 5 hari ${r1(roc5)}%${accelerating ? ' — berakselerasi' : ' — melambat'}`, ok: accelerating === true },
    ],
    volume: [
      { label: rvol == null ? 'RVOL: N/A' : `RVOL ${r1(rvol)}× rata-rata 20 sesi sebelumnya`, ok: rvol != null && rvol >= 1.2 },
      { label: volumeRatio5 == null ? 'Volume 5 hari: N/A' : `Volume 5 hari ${r1(volumeRatio5)}× rata-rata 20 hari (${volume.toLowerCase()})`, ok: volume === 'EXPANSION' || (setup === 'PULLBACK' && volume === 'CONTRACTION') },
      { label: liq.avgValue20 == null ? 'Likuiditas: N/A' : `Nilai transaksi rata-rata 20 hari ${rpM(liq.avgValue20)}`, ok: liquidityOk },
    ],
    structure: [
      ...[bo, rt, pb, cons].map((s) => ({ label: `${SETUP_TYPE_NAME[s.type]}: ${s.reason}`, ok: s.state === 'TRIGGERED' })),
      { label: nearestResistance != null ? `Resistance terdekat ${rp(nearestResistance)} (+${r1(pct(nearestResistance, price))}%)` : 'Tidak ada resistance di atas (blue sky)', ok: nearestResistance == null || pct(nearestResistance, price) >= cfg.minUpsidePct },
      { label: nearestSupport != null ? `Support terdekat ${rp(nearestSupport)} (${r1(pct(nearestSupport, price))}%)` : 'Support terdekat: N/A', ok: nearestSupport != null },
    ],
    volatility: [
      { label: `ATR 14 = ${rp(atr14)} (${r1(atrPct)}% harga)`, ok: roomPct >= cfg.minRewardPct },
      { label: `Jangkauan ${cfg.atrReachMult}× ATR (${cfg.horizon}) ≈ ${r1(roomPct)}%`, ok: roomPct >= cfg.minRewardPct },
      { label: `Jarak dari EMA 20 ${r1(distEma20Pct)}% = ${r1(distEma20Atr)}× ATR (batas extended ${r1(extendedLimitPct)}%)`, ok: !extended },
    ],
    distribution: (['rejection', 'lowerHigh', 'sellingVolume', 'breakdown', 'macdWeakening', 'failedBreakout'] as const).map((k) => {
      const f = flags.find((x) => x.key === k);
      const okLabel = {
        rejection: 'Tidak ada rejection candle',
        lowerHigh: 'Tidak ada Lower High',
        sellingVolume: 'Tidak ada selling volume besar',
        breakdown: 'Support masih bertahan',
        macdWeakening: 'MACD belum melemah',
        failedBreakout: 'Tidak ada false breakout',
      }[k];
      return { label: f ? f.label : okLabel, ok: !f };
    }),
  };

  // ─── Narrative ───────────────────────────────────────────────────────────────
  const zoneStr = (lo: number, hi: number) => (roundToTick(lo) === roundToTick(hi) ? rp(lo) : `${rp(lo)}–${rp(hi)}`);
  const trendLine = `Tren ${trend === 'BULLISH' ? 'naik' : trend === 'SIDEWAYS' ? 'datar' : 'turun'} (${st.label}), momentum ${momentum.toLowerCase()} — RSI ${r1(rsi14)}${macdHistogram != null ? `, MACD ${macdHistogram > 0 ? 'positif' : 'negatif'}` : ''}.`;
  const gateLine = (g: RiskGateItem) => `${g.label} ${g.state === 'PENDING' ? 'MENUNGGU' : 'FAIL'} — ${g.detail}.`;
  const reasons: string[] = [];
  if (status === 'NO TRADE' && reversal) {
    if (trend === 'BEARISH') reasons.push('Tren turun — EMA 20 di bawah EMA 50 dan harga di bawah EMA 50.');
    for (const f of flags.slice(0, 3 - reasons.length)) reasons.push(f.label + '.');
  } else if (status === 'AVOID CHASING') {
    reasons.push(`Harga sudah ${r1(distEma20Pct)}% (${r1(distEma20Atr)}× ATR) di atas EMA 20${roc5 != null ? `, ${roc5 >= 0 ? '+' : ''}${r1(roc5)}% dalam 5 sesi` : ''} — terlalu jauh dari zona entry.`);
    if (momentum === 'STRONG') reasons.push('Momentum kuat, tapi struktur EXTENDED — momentum kuat bukan berarti BUY.');
    if (rsi14 >= HOT_RSI) reasons.push(`RSI ${r1(rsi14)} sangat panas — risiko profit taking tinggi.`);
    else if (!liquidityOk) reasons.push(gateLine(gates.find((g) => g.key === 'liquidity')!));
    for (const f of flags.slice(0, 3 - reasons.length)) reasons.push(f.label + '.');
  } else if (status === 'BUY' && p) {
    reasons.push(trendLine);
    reasons.push(`${SETUP_TYPE_NAME[triggered!.type]} — ${triggered!.reason}.`);
    reasons.push(`Semua Hard Risk Gate lulus: potensi +${r1(p.potentialPct ?? 0)}%, risiko ${r1(p.riskPct)}%, R:R net 1:${r1(p.rrNet ?? 0)}.`);
  } else {
    reasons.push(trendLine);
    if (cand) reasons.push(`${SETUP_TYPE_NAME[cand.type]}: ${cand.reason}.`);
    const main = failed.filter((g) => g.key !== 'trigger' && g.state === 'FAIL');
    for (const g of main.slice(0, 3 - reasons.length)) reasons.push(gateLine(g));
    // A provisional SL / R:R that would fail is worth saying — labelled as simulation, never as the final verdict.
    if (reasons.length < 3 && slStage === 'PROVISIONAL' && plan && (!slPctOk || !slAtrOk || (plan.tp2 != null && !rrOk))) {
      reasons.push(`Simulasi (belum final, entry ${simEntry}): ${[!slPctOk ? `SL ${cmpLimit(plan.riskPct, cfg.maxSlPct, '%', false)}` : '', !slAtrOk ? `SL ${cmpLimit(plan.riskAtr, cfg.maxSlAtr, '× ATR', false)}` : '', plan.tp2 != null && !rrOk ? `R:R net ${rrCmp(plan.rrNet, cfg.minRR, false)}` : ''].filter(Boolean).join(', ')} — BUY tetap diblokir bila belum membaik saat trigger.`);
    }
    if (reasons.length < 2) for (const g of failed.slice(0, 1)) reasons.push(gateLine(g));
  }

  const liqCond = liquidityOk ? '' : `; likuiditas naik ke rata-rata ≥ ${rpM(cfg.minAvgValue20)}/hari`;
  const pbZone = zoneStr(pb.zoneLow ?? ema20, pb.zoneHigh ?? ema20);
  const reEvaluation = (() => {
    if (!data.gateOk && data.status !== 'PROVISIONAL' && data.status !== 'SUSPECT') return `Analisa ulang setelah data harian terbaru tersedia (${data.notes.join(' ')})`;
    if (status === 'BUY' && p) return `Analisa ulang jika close di bawah ${rp(p.sl)} (invalidasi) atau TP1 tercapai.`;
    if (status === 'NO TRADE' && reversal) return `Struktur pulih: close kembali di atas EMA 20 (${rp(ema20)}) dengan Higher Low baru dan tanda distribusi hilang${liqCond}.`;
    if (status === 'AVOID CHASING') {
      const retestAlt = rt.state === 'PENDING' ? `retest area breakout ${zoneStr(rt.zoneLow!, rt.zoneHigh!)} yang bertahan (candle hijau), ATAU ` : '';
      return `Harga reset dulu: ${retestAlt}pullback ke zona EMA 9–20 (${pbZone}) dengan volume mengecil lalu candle pantulan hijau, ATAU konsolidasi baru lalu breakout bervolume — cek ulang semua gate${liqCond}.`;
    }
    if (!data.lastBarClosed && cand) return `Tunggu candle hari ini ditutup: ${cand.activation}${liqCond}.`;
    if (blockerWait != null) return `CLOSE di atas resistance ${rp(blockerWait)} dengan RVOL ≥ ${r1(BREAKOUT_RVOL)}× sehingga ruang ke target berikutnya ≥ ${cfg.minUpsidePct}%${liqCond}.`;
    if (status === 'WATCHLIST' && (failedKeys.has('slPct') || failedKeys.has('slAtr')) && plan) return `Terbentuk higher low / base baru yang lebih dekat sehingga SL struktural ≤ ${r1(cfg.maxSlPct)}% dan ≤ ${r1(cfg.maxSlAtr)}× ATR (saat ini ${r1f(plan.riskPct)}% / ${r1f(plan.riskAtr)}× ATR)${liqCond}.`;
    if (cand?.type === 'RETEST') return `Harga kembali ke ${zoneStr(cand.zoneLow!, cand.zoneHigh!)}, tidak close di bawah ${rp(cand.invalidationPrice!)}, lalu candle hijau bertahan di atas ${rp(cand.level!)}${liqCond}.`;
    if (cand?.type === 'BREAKOUT' || cand?.type === 'CONSOLIDATION') return `CLOSE di atas ${rp(cand.triggerPrice!)} dengan RVOL ≥ ${r1(BREAKOUT_RVOL)}× dan candle hijau kuat, maks ${zoneStr(cand.zoneLow!, cand.zoneHigh!)}${liqCond}.`;
    if (cand?.type === 'PULLBACK') return `Pullback ke zona EMA 9–20 (${pbZone}) dengan volume mengecil, lalu candle hijau close di atas high candle sebelumnya${liqCond}.`;
    return trend === 'SIDEWAYS'
      ? `Tren naik terbentuk (EMA 20 > EMA 50, Higher Low) atau range yang jelas lalu breakout bervolume${liqCond}.`
      : `Tren naik terbentuk kembali${liqCond}.`;
  })();
  const entryCondition = status === 'BUY' && p
    ? `Entry di ${zoneStr(p.entryLow, p.entryHigh)} selama harga bertahan di atas ${rp(p.sl)}; jangan kejar di atas ${rp(p.entryHigh)}.`
    : cand ? `Belum ada entry. Pemicu: ${cand.activation}.` : 'Belum ada setup — tidak ada harga entry.';

  const riskWarnings = [
    ...data.notes,
    ...(!liquidityOk && liq.avgValue20 != null ? [`Likuiditas rendah (rata-rata ${rpM(liq.avgValue20)}/hari) — spread lebar, slippage besar, sulit keluar saat ARB.`] : []),
    ...(rsi14 >= 70 ? [`RSI ${r1(rsi14)} — momentum kuat sekaligus rawan jenuh beli; bukan bukti harga akan segera turun.`] : []),
    ...(extended ? [`Extended ${r1(distEma20Atr)}× ATR dari EMA 20 — risiko mean reversion tajam.`] : []),
    ...(last.open > prev.high + 0.5 * atr14 ? ['Gap up di candle terakhir — risiko gap fill.'] : []),
    ...flags.map((f) => f.label),
  ].slice(0, 6);

  const exitWarnings = [
    p ? `Close di bawah SL ${rp(p.sl)} → keluar penuh.` : `Close di bawah EMA 20 (${rp(ema20)}) → kurangi/tutup posisi yang sudah ada.`,
    'Upper wick panjang / rejection dengan volume besar di dekat resistance → kurangi posisi.',
    'Candle merah dengan volume ≥ 1,5× rata-rata (selling volume) → waspada distribusi.',
    'Terbentuk Lower High + MACD histogram turun 3 hari → amankan profit.',
    ...(p?.tp1 ? [`TP1 ${rp(p.tp1.price)} tercapai → realisasi sebagian, naikkan SL ke entry.`] : []),
    ...(p ? [`Belum bergerak ke target dalam ${cfg.horizon} → evaluasi / keluar (time stop).`] : []),
  ];

  const blockedBy = failed.map((x) => x.label).join(', ');
  const conclusion = {
    BUY: `Validated Setup — semua Hard Risk Gate lulus: BUY di ${p ? zoneStr(p.entryLow, p.entryHigh) : 'N/A'}, SL ${p ? rp(p.sl) : 'N/A'}, target +${r1(p?.potentialPct ?? 0)}%.`,
    'WAIT PULLBACK': 'Tren layak, tapi entry menunggu pullback + candle pantulan — bukan sinyal beli, belum ada trading plan.',
    'WAIT BREAKOUT': 'Menunggu breakout resistance yang valid (close + volume) — bukan sinyal beli, belum ada trading plan.',
    'WAIT RETEST': 'Breakout sudah terjadi, menunggu retest yang bertahan — jangan kejar, belum ada trading plan.',
    WATCHLIST: `Kandidat menarik, setup belum lengkap — pantau, belum ada trading plan (gate gagal: ${blockedBy}).`,
    'AVOID CHASING': 'Harga sudah terlalu jauh dari zona entry — jangan kejar; tetap dipantau untuk pullback / base baru.',
    'NO TRADE': reversal ? 'Risiko distribusi/reversal tinggi — NO TRADE, tidak ada trading plan.'
      : data.status === 'STALE' ? 'Data stale — NO TRADE sampai data terbaru tersedia.'
        : `Setup tidak valid — NO TRADE (FINAL GATE BLOCKED: ${blockedBy}).`,
  }[status];

  return {
    mode: cfg.key,
    config: cfg,
    dataOk: true,
    dataNote: '',
    data,
    status,
    finalGate,
    opportunity,
    setupType,
    setups,
    candidateSetup: status === 'NO TRADE' && reversal ? null : cand ? `${SETUP_TYPE_NAME[cand.type]} — ${cand.state === 'TRIGGERED' ? 'terpicu' : 'menunggu trigger'}` : null,
    candidateStats: plan
      ? { potentialPct: plan.potentialPct, riskReward: plan.rr, upsidePct: plan.upsideToResistancePct, target20Realistic: plan.target20Realistic }
      : null,
    momentum,
    structure,
    exitRisk,
    trend,
    volume,
    setup,
    entryLow: p?.entryLow ?? null,
    entryHigh: p?.entryHigh ?? null,
    entryRef: p?.entryRef ?? null,
    sl: p?.sl ?? null,
    slBasis: p?.slBasis ?? null,
    tp1: p?.tp1 ?? null,
    tp2: p?.tp2 ?? null,
    potentialPct: p?.potentialPct ?? null,
    riskPct: p?.riskPct ?? null,
    slStage,
    riskReward: p?.rr ?? null,
    riskRewardNet: p?.rrNet ?? null,
    upsideToResistancePct: p ? p.upsideToResistancePct : nearestResistance != null ? pct(nearestResistance, price) : null,
    volatilityRoomPct: roomPct,
    target20Realistic: p?.target20Realistic ?? false,
    riskGate: gates,
    indicators: {
      rsi14, rsiPrev, macdLine, macdSignal, macdHistogram, macdHistogramPrev: h1,
      ema9: fin(ema9) ? ema9 : null, ema20, ema50, ema200, ema20Slope5Pct, atr14, atrPct, rvol, avgValue20: liq.avgValue20,
    },
    metrics: {
      price, rsi14, macdHistogram, macdRising, roc5, accelerating, rvol, volumeRatio5, atrPct, distEma20Pct, distEma20Atr, extendedLimitPct,
      structureLabel: st.label, breakoutLevel: bo.level, nearestResistance, nearestSupport,
    },
    checks,
    distributionFlags: flags,
    reasons: reasons.slice(0, 3),
    entryCondition,
    reEvaluation,
    trigger: status === 'BUY' ? entryCondition : reEvaluation,
    riskWarnings,
    exitWarnings,
    conclusion,
  };
}
