/**
 * momentumTradeEngine.ts
 *
 * Momentum Trade Engine (docs/features_momentum_engine.md): looks for MOMENTUM CONTINUATION — not
 * simply "overbought" — with a ≥20% target, a validated entry and controlled risk, while avoiding
 * chasing and reversal / distribution.
 *
 *   1. Trend       — EMA 20/50 order, Higher High / Higher Low.
 *   2. Momentum    — RSI, MACD histogram (+ its slope), price acceleration (ROC 5 vs the previous ROC 5).
 *   3. Volume      — RVOL, 5-day volume expansion / contraction vs the 20-day average.
 *   4. Structure   — BREAKOUT (close above resistance + volume), RETEST, PULLBACK to EMA 9–20.
 *   5. Support & Resistance — the next resistance overhead caps the target.
 *   6. Volatility  — ATR 14: can the stock realistically travel +20%?
 *   7. Distribution & reversal risk — rejection, lower high, selling volume, breakdown, MACD weakening.
 *
 * HARD RISK GATE — MOMENTUM BUY only when ALL pass:
 *   1. Potential ≥ 20%          (fail → NO TRADE)     4. SL valid on structure      (fail → NO TRADE)
 *   2. R:R ≥ 1:2                (fail → NO TRADE)     5. Distribution risk < HIGH   (fail → AVOID)
 *   3. Valid entry trigger      (fail → NO TRADE)     6. Upside to next resistance ≥ 20% (fail → NO TRADE)
 *   Extended (too far from entry) → AVOID CHASING.
 *
 * The HARD RISK GATE is final. Candidate Setup = internal calculation; Validated Setup = every gate PASS;
 * Final Trade Plan = only for a Validated Setup. FINAL GATE BLOCKED → Entry, SL, TP1, TP2, Potential and
 * R:R are all N/A — a candidate's levels are never published as a plan, and FAIL is never turned into PASS.
 * TP comes only from resistance, measured move or structure — never from a % stretched to hit 20%.
 * RSI > 70 never means AVOID by itself. Missing data → N/A. Order prices snap to valid IDX ticks.
 */

import { roundToTick } from '@/domain/analysis/idxTick';
import { MomentumInput } from '@/domain/analysis/momentumSpeculation';
import { macd } from '@/domain/indicators/macd';
import { OHLCVBar } from '@/domain/models/History';

// ─── Thresholds ─────────────────────────────────────────────────────────────────

/** Gate 1 & 6: potential to TP2 and upside to the next resistance must both be ≥ this. */
export const MOMENTUM_TARGET_PCT = 20;
/** Realistic travel of a momentum leg ≈ this many daily ATRs (ATR 3.4% → ~20%). */
export const ATR_TRAVEL_MULT = 6;
/** Gate 2: min reward : risk to TP2. */
export const MIN_MOMENTUM_RR = 2;
/** Gate 4: SL further than this from entry is not a structural stop. */
export const MAX_SL_PCT = 10;
/** Breakout volume confirmation. */
export const BREAKOUT_RVOL = 1.5;
/** Entry zone above a breakout level — beyond this it's chasing. */
export const BREAKOUT_ZONE_PCT = 3;
/** Price within this % under the breakout level → the candidate is a breakout of that level (else a pullback). */
const NEAR_BREAKOUT_PCT = 5;
/** Extended: further above EMA 20 than max(this, EXTENDED_ATR_MULT × ATR%). */
const EXTENDED_EMA20_PCT = 10;
const EXTENDED_ATR_MULT = 3.5;
const EXTENDED_1W_PCT = 25;
const EXTREME_RSI = 85;
const HOT_RSI = 80;
/** Bars needed for EMA 50 / 20-day structure to mean anything. */
const MIN_BARS = 50;
/** Lookback for the breakout level (prior N-session high) and the measured-move base. */
const BREAKOUT_LOOKBACK = 20;
/** TP1 must be at least this far above entry to be worth a partial. */
const MIN_TP1_PCT = 3;

// ─── Types ──────────────────────────────────────────────────────────────────────

export type MomentumTradeStatus = 'MOMENTUM BUY' | 'AVOID CHASING' | 'AVOID REVERSAL' | 'NO TRADE' | 'N/A';
/** PASS = Validated Setup (final trade plan published). BLOCKED = every trading parameter is N/A. */
export type FinalGate = 'PASS' | 'BLOCKED' | 'N/A';
export type MomentumGrade = 'STRONG' | 'MODERATE' | 'WEAK' | 'N/A';
/**
 * Display label only (never drives the decision). DOWNTREND = confirmed bearish trend without fresh
 * distribution signs; NO TREND = sideways, no bullish structure to continue.
 */
export type StructureGrade = 'HEALTHY' | 'EXTENDED' | 'DISTRIBUTION' | 'DOWNTREND' | 'NO TREND' | 'N/A';
export type ExitRisk = 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME' | 'N/A';
export type TrendRead = 'BULLISH' | 'SIDEWAYS' | 'BEARISH' | 'N/A';
export type VolumeRead = 'EXPANSION' | 'NORMAL' | 'CONTRACTION' | 'N/A';
export type MomentumSetup = 'BREAKOUT' | 'RETEST' | 'PULLBACK' | 'NONE';
export type RiskGateKey = 'potential' | 'rr' | 'trigger' | 'sl' | 'distribution' | 'upside';

export const MOMENTUM_STATUS_EMOJI: Record<MomentumTradeStatus, string> = {
  'MOMENTUM BUY': '🟢',
  'AVOID CHASING': '🔴',
  'AVOID REVERSAL': '🔴',
  'NO TRADE': '🔴',
  'N/A': '⚪',
};

export const SETUP_NAME: Record<MomentumSetup, string> = {
  BREAKOUT: 'Breakout valid',
  RETEST: 'Breakout retest',
  PULLBACK: 'Pullback EMA 9–20',
  NONE: 'Belum ada setup',
};

export const RISK_GATE_LABEL: Record<RiskGateKey, string> = {
  potential: `Potential ≥${MOMENTUM_TARGET_PCT}%`,
  rr: `R:R ≥1:${MIN_MOMENTUM_RR}`,
  trigger: 'Entry Trigger',
  sl: 'Valid SL',
  distribution: 'Distribution Risk',
  upside: `Upside ≥${MOMENTUM_TARGET_PCT}%`,
};

export interface MomentumSignalItem {
  label: string;
  ok: boolean;
}

export interface RiskGateItem {
  key: RiskGateKey;
  label: string;
  pass: boolean;
  /** Why it passed / failed, with the numbers. */
  detail: string;
}

export interface DistributionFlag {
  key: 'rejection' | 'lowerHigh' | 'sellingVolume' | 'breakdown' | 'macdWeakening';
  label: string;
}

export interface MomentumTarget {
  price: number;
  pct: number;
  basis: string;
}

export interface MomentumTradeReport {
  dataOk: boolean;
  dataNote: string;
  status: MomentumTradeStatus;
  /** HARD RISK GATE verdict. Entry / SL / TP / Potential / R:R are non-null only when PASS. */
  finalGate: FinalGate;
  /**
   * Candidate Setup — what was evaluated internally (no levels), e.g. "Kandidat breakout di atas Rp 1.250".
   * Null for AVOID REVERSAL: the gate still runs on a reference pullback, but naming it would suggest a setup exists.
   */
  candidateSetup: string | null;
  /**
   * Candidate Setup numbers as percentages only (no prices) — for discovery screens (Moonstock) that rank
   * candidates before this engine validates them. Never a trade plan. Null when there is no candidate.
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
  /** Reward : risk to TP2 (1 : x → x). */
  riskReward: number | null;
  /** % from entry to the nearest resistance above (null = no resistance overhead). */
  upsideToResistancePct: number | null;
  /** % ATR 14 × ATR_TRAVEL_MULT — realistic travel of a momentum leg. */
  volatilityRoomPct: number | null;
  /** TP2 ≥ +20% backed by both resistance/structure and volatility. */
  target20Realistic: boolean;
  /** HARD RISK GATE — all six must pass for MOMENTUM BUY. Empty when data is insufficient. */
  riskGate: RiskGateItem[];
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
  trigger: string;
  exitWarnings: string[];
  conclusion: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

const pct = (a: number, b: number) => (a / b - 1) * 100;
const fin = (n: number | null | undefined): n is number => n != null && Number.isFinite(n);
const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN);
/** One-decimal number for narrative text, Indonesian locale (1,5 — matching Rp 1.250). */
const r1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString('id-ID', { maximumFractionDigits: 1 });
const rp = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;

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

function emptyReport(price: number, note: string): MomentumTradeReport {
  return {
    dataOk: false,
    dataNote: note,
    status: 'N/A',
    finalGate: 'N/A',
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
    riskReward: null,
    upsideToResistancePct: null,
    volatilityRoomPct: null,
    target20Realistic: false,
    riskGate: [],
    metrics: {
      price, rsi14: null, macdHistogram: null, macdRising: null, roc5: null, accelerating: null, rvol: null,
      volumeRatio5: null, atrPct: null, distEma20Pct: null, structureLabel: 'Data kurang', breakoutLevel: null,
      nearestResistance: null, nearestSupport: null,
    },
    checks: { trend: [], momentum: [], volume: [], structure: [], volatility: [], distribution: [] },
    distributionFlags: [],
    reasons: [note],
    trigger: 'N/A — data belum cukup untuk menilai momentum.',
    exitWarnings: [],
    conclusion: 'Data tidak cukup — tidak ada keputusan momentum.',
  };
}

interface Plan {
  entryLow: number;
  entryHigh: number;
  entryRef: number;
  inZone: boolean;
  sl: number;
  slBasis: string;
  slPct: number;
  tp1: MomentumTarget | null;
  tp2: MomentumTarget | null;
  potentialPct: number | null;
  rr: number | null;
  upsideToResistancePct: number | null;
  /** TP2 ≥ 20% and the ATR range can cover it. */
  target20Realistic: boolean;
  /** Nearest resistance above entry. */
  blocker: number | null;
}

/**
 * Entry zone → structural SL → TP1 / TP2. TP2 = the next resistance overhead; with no resistance
 * overhead (blue sky) it is the measured move. TP1 = the nearest of resistance / measured move /
 * recent swing high below TP2. Nothing is stretched to reach +20% — gates 1 & 6 judge the result.
 */
function buildPlan(a: {
  price: number;
  zoneLow: number;
  zoneHigh: number;
  structuralLow: number;
  slLabel: string;
  atr: number;
  resistances: number[];
  measuredMove: number | null;
  swingHigh: number | null;
}): Plan {
  const entryLow = roundToTick(a.zoneLow);
  const entryHigh = roundToTick(Math.max(a.zoneHigh, a.zoneLow));
  const inZone = a.price >= entryLow && a.price <= entryHigh;
  const entryRef = inZone ? a.price : roundToTick((entryLow + entryHigh) / 2);
  const sl = roundToTick(Math.min(a.structuralLow, entryLow) - 0.5 * a.atr);
  const slPct = pct(entryRef, sl);

  const above = [...new Set(a.resistances.filter((r) => fin(r) && r > entryRef * 1.01).map(roundToTick))].sort((x, y) => x - y);
  const blocker = above[0] ?? null;
  const upsideToResistancePct = blocker != null ? pct(blocker, entryRef) : null;
  const mm = a.measuredMove != null && a.measuredMove > entryRef * 1.01 ? roundToTick(a.measuredMove) : null;

  let tp2: MomentumTarget | null = null;
  if (blocker != null) tp2 = { price: blocker, pct: pct(blocker, entryRef), basis: 'Resistance berikutnya' };
  else if (mm != null) tp2 = { price: mm, pct: pct(mm, entryRef), basis: 'Measured move (tanpa resistance di atas)' };

  let tp1: MomentumTarget | null = null;
  if (tp2) {
    const cands: Array<{ price: number; basis: string }> = [
      ...above.filter((r) => r < tp2!.price).map((r) => ({ price: r, basis: 'Resistance terdekat' })),
      ...(mm != null && mm < tp2.price ? [{ price: mm, basis: 'Measured move' }] : []),
      ...(a.swingHigh != null && roundToTick(a.swingHigh) < tp2.price ? [{ price: roundToTick(a.swingHigh), basis: 'Swing high terakhir' }] : []),
    ].filter((c) => pct(c.price, entryRef) >= MIN_TP1_PCT).sort((x, y) => x.price - y.price);
    if (cands[0]) tp1 = { price: cands[0].price, pct: pct(cands[0].price, entryRef), basis: cands[0].basis };
  }

  const roomPct = (a.atr / entryRef) * 100 * ATR_TRAVEL_MULT;
  const risk = entryRef - sl;
  const rr = tp2 && risk > 0 ? (tp2.price - entryRef) / risk : null;
  return {
    entryLow, entryHigh, entryRef, inZone, sl, slBasis: a.slLabel, slPct, tp1, tp2,
    potentialPct: tp2 ? tp2.pct : null,
    rr,
    upsideToResistancePct,
    target20Realistic: tp2 != null && tp2.pct >= MOMENTUM_TARGET_PCT && roomPct >= MOMENTUM_TARGET_PCT,
    blocker,
  };
}

// ─── Engine ─────────────────────────────────────────────────────────────────────

export function buildMomentumTrade(i: MomentumInput): MomentumTradeReport {
  const bars = i.bars;
  const price = i.price;
  const { ema9, ema20, ema50, rsi14, atr14 } = i;
  if (!fin(price) || price <= 0) return emptyReport(price, 'Harga terakhir tidak tersedia.');
  if (bars.length < MIN_BARS) return emptyReport(price, `Riwayat harga baru ${bars.length} sesi (butuh ≥ ${MIN_BARS}).`);
  if (!fin(ema20) || !fin(ema50) || !fin(rsi14) || !fin(atr14) || atr14 <= 0) {
    return emptyReport(price, 'EMA 20/50, RSI atau ATR tidak tersedia.');
  }

  const last = bars[bars.length - 1];
  const prev = bars[bars.length - 2];
  const closes = bars.map((b) => b.close);
  const atrPct = (atr14 / price) * 100;
  const roomPct = atrPct * ATR_TRAVEL_MULT;

  // 1. Trend
  const st = structureOf(bars);
  const distEma20Pct = pct(price, ema20);
  const emaUp = ema20 > ema50;
  const trend: TrendRead =
    emaUp && price > ema50 && st.lows !== 'LL' ? 'BULLISH'
      : !emaUp && price < ema50 && st.highs !== 'HH' ? 'BEARISH'
        : 'SIDEWAYS';

  // 2. Momentum
  const hist = macd(bars).histogram.filter(Number.isFinite);
  const h0 = hist[hist.length - 1] ?? null;
  const h1 = hist[hist.length - 2] ?? null;
  const h2 = hist[hist.length - 3] ?? null;
  const macdHistogram = fin(i.macdHistogram) ? i.macdHistogram : h0;
  const macdRising = h0 != null && h1 != null ? h0 > h1 : null;
  const macdWeakening = h0 != null && h1 != null && h2 != null && ((h0 > 0 && h0 < h1 && h1 < h2) || (h0 <= 0 && h1 > 0));
  const at = (k: number) => closes[closes.length - 1 - k];
  const roc5 = closes.length > 5 ? pct(at(0), at(5)) : null;
  const prevRoc5 = closes.length > 10 ? pct(at(5), at(10)) : null;
  const accelerating = roc5 != null && prevRoc5 != null ? roc5 > prevRoc5 && roc5 > 0 : null;
  const rvol = fin(i.rvol) ? i.rvol : null;
  let mPts = 0;
  if (rsi14 >= 60) mPts += 1; else if (rsi14 >= 50) mPts += 0.5;
  if (macdHistogram != null && macdHistogram > 0) mPts += 1;
  if (macdRising) mPts += 1;
  if (accelerating) mPts += 1;
  if (rvol != null && rvol >= 1.2) mPts += 1;
  const momentum: MomentumGrade = mPts >= 4 ? 'STRONG' : mPts >= 2 ? 'MODERATE' : 'WEAK';

  // 3. Volume
  const volMa20 = fin(i.volumeMa20) && i.volumeMa20 > 0 ? i.volumeMa20 : avg(bars.slice(-21, -1).map((b) => b.volume));
  const volumeRatio5 = volMa20 > 0 ? avg(bars.slice(-5).map((b) => b.volume)) / volMa20 : null;
  const volume: VolumeRead = volumeRatio5 == null ? 'N/A' : volumeRatio5 >= 1.3 ? 'EXPANSION' : volumeRatio5 <= 0.8 ? 'CONTRACTION' : 'NORMAL';

  // 7. Distribution & reversal risk
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

  // Extension — how far price has run from a sane entry (chasing), separate from distribution.
  const extended =
    distEma20Pct > Math.max(EXTENDED_EMA20_PCT, EXTENDED_ATR_MULT * atrPct)
    || (fin(i.change1W) && i.change1W >= EXTENDED_1W_PCT)
    || rsi14 >= EXTREME_RSI;

  // Exit risk = distribution/reversal risk; a hot / extended chart adds at most one notch (LOW → MEDIUM).
  const riskPts = flags.length + (breakdown ? 1 : 0) + (trend === 'BEARISH' ? 1 : 0);
  let exitRisk: ExitRisk = breakdown || riskPts >= 3 ? 'EXTREME' : riskPts === 2 ? 'HIGH' : riskPts === 1 ? 'MEDIUM' : 'LOW';
  if (exitRisk === 'LOW' && (extended || rsi14 >= HOT_RSI)) exitRisk = 'MEDIUM';
  const distributionGateOk = exitRisk === 'LOW' || exitRisk === 'MEDIUM';

  const distribution = breakdown || flags.length >= 3;
  const structure: StructureGrade =
    distribution ? 'DISTRIBUTION' : trend === 'BEARISH' ? 'DOWNTREND' : trend !== 'BULLISH' ? 'NO TREND' : extended ? 'EXTENDED' : 'HEALTHY';

  // 4–5. Structure, support & resistance
  const resistances = [...i.resistances, ...(fin(i.annualHigh) ? [i.annualHigh] : [])].filter((r) => fin(r) && r > 0);
  const supportsBelow = i.supports.filter((s) => fin(s) && s < price);
  const nearestSupport = supportsBelow.length ? Math.max(...supportsBelow) : null;
  const nearestResistance = resistances.filter((r) => r > price * 1.01).sort((a, b) => a - b)[0] ?? null;

  const priorWindow = bars.slice(-(BREAKOUT_LOOKBACK + 1), -1);
  const breakoutLevel = Math.max(...priorWindow.map((b) => b.high));
  const breakoutBaseLow = Math.min(...priorWindow.map((b) => b.low));
  const closeUpperHalf = last.close >= (last.high + last.low) / 2;
  // Breakout = CLOSE above resistance + volume confirmation, still within the entry zone.
  const breakoutValid =
    last.close > breakoutLevel && pct(last.close, breakoutLevel) <= BREAKOUT_ZONE_PCT
    && rvol != null && rvol >= BREAKOUT_RVOL && closeUpperHalf && last.close > last.open;

  // Retest: base high before the last 5 sessions, broken within sessions -5..-2, now held from above.
  const retestWindow = bars.slice(-(BREAKOUT_LOOKBACK + 6), -6);
  const baseLevel = Math.max(...retestWindow.map((b) => b.high));
  const baseLow = Math.min(...retestWindow.map((b) => b.low));
  const brokeRecently = bars.slice(-5, -1).some((b) => b.close > baseLevel * 1.01);
  const retestValid =
    brokeRecently && Math.min(...bars.slice(-3).map((b) => b.low)) <= baseLevel * 1.02
    && last.close > baseLevel && last.close >= last.open && pct(last.close, baseLevel) <= BREAKOUT_ZONE_PCT;

  const pbLow = ema20;
  const pbHigh = fin(ema9) && ema9 > ema20 ? Math.max(ema9, ema20 * 1.02) : ema20 * 1.02;
  const inPullbackZone = price >= pbLow * 0.99 && price <= pbHigh;
  const lowVolDip = volumeRatio5 != null && volumeRatio5 <= 1;
  const bounce = last.close > last.open || last.close > prev.close;
  const pullbackValid = trend === 'BULLISH' && inPullbackZone && lowVolDip && bounce;

  const setup: MomentumSetup = breakoutValid ? 'BREAKOUT' : retestValid ? 'RETEST' : pullbackValid ? 'PULLBACK' : 'NONE';

  // Measured move for a pullback (ABC): C + (B − A) — B = swing high of the last 20 sessions,
  // A = the low that leg started from (30 sessions before B), C = the current pullback low.
  const recent20 = bars.slice(-BREAKOUT_LOOKBACK);
  const swingHigh = Math.max(...recent20.map((b) => b.high));
  const idxB = bars.length - BREAKOUT_LOOKBACK + recent20.findIndex((b) => b.high === swingHigh);
  const legLow = Math.min(...bars.slice(Math.max(0, idxB - 30), idxB + 1).map((b) => b.low));
  const recentLow5 = Math.min(...bars.slice(-5).map((b) => b.low));

  type PlanKind = 'breakout' | 'retest' | 'pullback' | 'nextBreakout';
  const plan = (kind: PlanKind, level?: number): Plan => {
    const common = { price, atr: atr14, resistances, swingHigh: swingHigh > price * 1.01 ? swingHigh : null };
    if (kind === 'breakout' || kind === 'retest') {
      const L = kind === 'breakout' ? breakoutLevel : baseLevel;
      const lo = kind === 'breakout' ? breakoutBaseLow : baseLow;
      return buildPlan({
        ...common, zoneLow: L, zoneHigh: L * (1 + BREAKOUT_ZONE_PCT / 100), structuralLow: L,
        slLabel: `Di bawah level breakout ${rp(L)} − 0,5× ATR`, measuredMove: L + (L - lo),
      });
    }
    if (kind === 'nextBreakout') {
      const L = level!;
      const lo = Math.min(...bars.slice(-BREAKOUT_LOOKBACK).map((b) => b.low));
      return buildPlan({
        ...common, zoneLow: L, zoneHigh: L * (1 + BREAKOUT_ZONE_PCT / 100), structuralLow: Math.max(L - 1.5 * atr14, recentLow5),
        slLabel: 'Di bawah area breakout − 0,5× ATR', measuredMove: L + (L - lo),
      });
    }
    return buildPlan({
      ...common, zoneLow: pbLow, zoneHigh: pbHigh, structuralLow: Math.min(recentLow5, pbLow),
      slLabel: 'Di bawah swing low 5 sesi / EMA 20 − 0,5× ATR', measuredMove: Math.min(recentLow5, price) + (swingHigh - legLow),
    });
  };

  // HARD RISK GATE on the Candidate Setup. Details carry percentages / S&R levels only — the candidate's
  // Entry / SL / TP prices are never published unless the FINAL GATE passes.
  const gateOf = (pl: Plan | null, triggerOk: boolean, triggerDetail: string): RiskGateItem[] => {
    const g = (key: RiskGateKey, pass: boolean, detail: string): RiskGateItem => ({ key, label: RISK_GATE_LABEL[key], pass, detail });
    return [
      g('potential', !!pl?.target20Realistic,
        pl?.tp2 == null ? 'Tidak ada target dari resistance / measured move'
          : pl.tp2.pct < MOMENTUM_TARGET_PCT ? `Potensi kandidat hanya ${r1(pl.tp2.pct)}%`
            : roomPct < MOMENTUM_TARGET_PCT ? `Potensi kandidat ${r1(pl.tp2.pct)}%, tapi ATR ${r1(atrPct)}% hanya menjangkau ±${r1(roomPct)}%`
              : `Potensi ${r1(pl.tp2.pct)}% (jangkauan ATR ±${r1(roomPct)}%)`),
      g('rr', pl?.rr != null && pl.rr >= MIN_MOMENTUM_RR, pl?.rr == null ? 'R:R tidak dapat dihitung' : `R:R kandidat 1:${r1(pl.rr)}`),
      g('trigger', triggerOk, triggerDetail),
      g('sl', pl != null && pl.slPct > 0 && pl.slPct <= MAX_SL_PCT,
        pl == null ? 'Tidak ada SL struktural' : `SL struktural ${r1(pl.slPct)}% dari entry (maks ${MAX_SL_PCT}%)`),
      g('distribution', distributionGateOk, `Exit risk ${exitRisk}${
        [flags.length ? `${flags.length} tanda distribusi` : '', breakdown ? 'breakdown support' : '', trend === 'BEARISH' ? 'tren turun' : '']
          .filter(Boolean).map((x, k) => (k === 0 ? ` — ${x}` : ` + ${x}`)).join('')}`),
      g('upside', pl != null && (pl.upsideToResistancePct == null ? pl.tp2 != null : pl.upsideToResistancePct >= MOMENTUM_TARGET_PCT),
        pl == null ? 'Tidak ada setup kandidat'
          : pl.upsideToResistancePct == null ? (pl.tp2 != null ? 'Tidak ada resistance di atas (blue sky)' : 'Tidak ada target terukur')
            : `Resistance berikutnya ${rp(pl.blocker!)} (+${r1(pl.upsideToResistancePct)}%)`),
    ];
  };

  // ─── Classification ──────────────────────────────────────────────────────────
  // 1) pick the Candidate Setup, 2) run the gate, 3) publish a plan only for a Validated Setup.
  interface Candidate { kind: PlanKind; plan: Plan; level: number | null; label: string; triggerOk: boolean; triggerDetail: string }
  let candidate: Candidate | null = null;
  let avoidStatus: 'AVOID CHASING' | 'AVOID REVERSAL' | null = null;
  let noCandidateDetail = 'Tidak ada tren naik maupun level breakout';

  const breakoutTarget = nearestResistance ?? (breakoutLevel > price ? breakoutLevel : null);
  const nearBreakout = breakoutTarget != null && pct(breakoutTarget, price) <= NEAR_BREAKOUT_PCT;
  const setupKind: PlanKind | null = setup === 'BREAKOUT' ? 'breakout' : setup === 'RETEST' ? 'retest' : setup === 'PULLBACK' ? 'pullback' : null;
  const pullbackCandidate = (triggerDetail: string): Candidate => ({
    kind: 'pullback', plan: plan('pullback'), level: null, label: 'Kandidat pullback ke EMA 9–20', triggerOk: false, triggerDetail,
  });

  if (!distributionGateOk || distribution || trend === 'BEARISH') {
    avoidStatus = 'AVOID REVERSAL';
    candidate = pullbackCandidate('Tidak ada entry saat risiko distribusi/reversal tinggi');
  } else if (extended) {
    // Strong momentum but EXTENDED → never BUY; wait for a pullback / reset and a new trigger.
    avoidStatus = 'AVOID CHASING';
    candidate = pullbackCandidate(`Harga ${r1(distEma20Pct)}% di atas EMA 20 — terlalu jauh dari zona entry`);
  } else if (trend === 'BULLISH' && setupKind != null) {
    const cand = plan(setupKind);
    const triggerOk = cand.inZone && momentum !== 'WEAK';
    candidate = {
      kind: setupKind,
      plan: cand,
      level: setupKind === 'breakout' ? breakoutLevel : setupKind === 'retest' ? baseLevel : null,
      label: SETUP_NAME[setup],
      triggerOk,
      triggerDetail: triggerOk ? `${SETUP_NAME[setup]} — harga di zona entry`
        : !cand.inZone ? `${SETUP_NAME[setup]}, tapi harga sudah di luar zona entry` : `${SETUP_NAME[setup]}, tapi momentum lemah`,
    };
  } else if (breakoutTarget != null && nearBreakout) {
    // Only a resistance within NEAR_BREAKOUT_PCT is a breakout candidate — a level far above price
    // would produce a hypothetical entry unrelated to where the stock trades now.
    candidate = {
      kind: 'nextBreakout', plan: plan('nextBreakout', breakoutTarget), level: breakoutTarget,
      label: `Kandidat breakout di atas ${rp(breakoutTarget)}`, triggerOk: false,
      triggerDetail: `Breakout di atas ${rp(breakoutTarget)} belum terkonfirmasi (close + volume)`,
    };
  } else if (trend === 'BULLISH') {
    candidate = pullbackCandidate('Belum ada breakout / retest / pullback yang valid');
  } else {
    noCandidateDetail = trend !== 'SIDEWAYS' ? noCandidateDetail
      : breakoutTarget != null ? `Tren datar — resistance terdekat ${rp(breakoutTarget)} masih +${r1(pct(breakoutTarget, price))}% di atas harga`
        : 'Tren datar tanpa level breakout terukur';
  }

  const gates = gateOf(candidate?.plan ?? null, candidate?.triggerOk ?? false, candidate?.triggerDetail ?? noCandidateDetail);
  const finalGate: FinalGate = gates.every((x) => x.pass) ? 'PASS' : 'BLOCKED';
  const status: MomentumTradeStatus = avoidStatus ?? (finalGate === 'PASS' ? 'MOMENTUM BUY' : 'NO TRADE');
  // Final Trade Plan — Validated Setup only. Anything else: every trading parameter stays N/A.
  const p: Plan | null = status === 'MOMENTUM BUY' && finalGate === 'PASS' ? candidate!.plan : null;
  const failed = gates.filter((x) => !x.pass);

  // ─── Checks per area ─────────────────────────────────────────────────────────
  const checks: MomentumTradeReport['checks'] = {
    trend: [
      { label: `EMA 20 ${emaUp ? '>' : '<'} EMA 50`, ok: emaUp },
      { label: `Harga ${price > ema20 ? 'di atas' : 'di bawah'} EMA 20 (${r1(distEma20Pct)}%)`, ok: price > ema20 },
      { label: st.label, ok: st.highs === 'HH' && st.lows === 'HL' },
    ],
    momentum: [
      { label: `RSI 14 = ${r1(rsi14)}${rsi14 > 70 ? ' (overbought ≠ otomatis AVOID)' : ''}`, ok: rsi14 >= 55 && rsi14 < EXTREME_RSI },
      { label: `MACD histogram ${macdHistogram != null && macdHistogram > 0 ? 'positif' : 'negatif'}${macdRising == null ? '' : macdRising ? ', naik' : ', turun'}`, ok: macdHistogram != null && macdHistogram > 0 && macdRising === true },
      { label: roc5 == null ? 'Akselerasi harga: N/A' : `ROC 5 hari ${r1(roc5)}%${accelerating ? ' — berakselerasi' : ' — melambat'}`, ok: accelerating === true },
    ],
    volume: [
      { label: rvol == null ? 'RVOL: N/A' : `RVOL ${r1(rvol)}×`, ok: rvol != null && rvol >= 1.2 },
      { label: volumeRatio5 == null ? 'Volume 5 hari: N/A' : `Volume 5 hari ${r1(volumeRatio5)}× rata-rata 20 hari (${volume.toLowerCase()})`, ok: volume === 'EXPANSION' || (setup === 'PULLBACK' && volume === 'CONTRACTION') },
    ],
    structure: [
      { label: `Breakout: close di atas ${rp(breakoutLevel)} + RVOL ≥ ${r1(BREAKOUT_RVOL)}× (maks +${BREAKOUT_ZONE_PCT}%)`, ok: breakoutValid },
      { label: `Retest breakout ${rp(baseLevel)} bertahan`, ok: retestValid },
      { label: `Pullback ke EMA 9–20 (${rp(pbLow)}–${rp(pbHigh)}) dengan volume turun`, ok: pullbackValid },
      { label: nearestResistance != null ? `Resistance terdekat ${rp(nearestResistance)} (+${r1(pct(nearestResistance, price))}%)` : 'Tidak ada resistance di atas (blue sky)', ok: nearestResistance == null || pct(nearestResistance, price) >= MOMENTUM_TARGET_PCT },
      { label: nearestSupport != null ? `Support terdekat ${rp(nearestSupport)} (${r1(pct(nearestSupport, price))}%)` : 'Support terdekat: N/A', ok: nearestSupport != null },
    ],
    volatility: [
      { label: `ATR 14 = ${rp(atr14)} (${r1(atrPct)}% harga)`, ok: roomPct >= MOMENTUM_TARGET_PCT },
      { label: `Jangkauan ${ATR_TRAVEL_MULT}× ATR ≈ ${r1(roomPct)}%`, ok: roomPct >= MOMENTUM_TARGET_PCT },
      { label: `Jarak dari EMA 20 ${r1(distEma20Pct)}% (batas extended ${r1(Math.max(EXTENDED_EMA20_PCT, EXTENDED_ATR_MULT * atrPct))}%)`, ok: !extended },
    ],
    distribution: (['rejection', 'lowerHigh', 'sellingVolume', 'breakdown', 'macdWeakening'] as const).map((k) => {
      const f = flags.find((x) => x.key === k);
      const okLabel = {
        rejection: 'Tidak ada rejection candle',
        lowerHigh: 'Tidak ada Lower High',
        sellingVolume: 'Tidak ada selling volume besar',
        breakdown: 'Support masih bertahan',
        macdWeakening: 'MACD belum melemah',
      }[k];
      return { label: f ? f.label : okLabel, ok: !f };
    }),
  };

  // ─── Narrative ───────────────────────────────────────────────────────────────
  const reasons: string[] = [];
  if (status === 'AVOID REVERSAL') {
    if (trend === 'BEARISH') reasons.push('Tren turun — EMA 20 di bawah EMA 50 dan harga di bawah EMA 50.');
    for (const f of flags.slice(0, 3 - reasons.length)) reasons.push(f.label + '.');
  } else if (status === 'AVOID CHASING') {
    reasons.push(`Harga sudah ${r1(distEma20Pct)}% di atas EMA 20${fin(i.change1W) ? ` (${i.change1W >= 0 ? '+' : ''}${r1(i.change1W)}% seminggu)` : ''} — terlalu jauh dari zona entry.`);
    if (momentum === 'STRONG') reasons.push('Momentum kuat, tapi struktur EXTENDED — momentum kuat bukan berarti BUY.');
    if (rsi14 >= HOT_RSI) reasons.push(`RSI ${r1(rsi14)} sangat panas — risiko profit taking tinggi.`);
    for (const f of flags.slice(0, 3 - reasons.length)) reasons.push(f.label + '.');
  } else {
    reasons.push(`Tren ${trend === 'BULLISH' ? 'naik' : trend === 'SIDEWAYS' ? 'datar' : 'turun'} (${st.label}), momentum ${momentum.toLowerCase()} — RSI ${r1(rsi14)}${macdHistogram != null ? `, MACD ${macdHistogram > 0 ? 'positif' : 'negatif'}` : ''}.`);
    if (status === 'MOMENTUM BUY' && p) {
      reasons.push(`${SETUP_NAME[setup]} — harga di zona entry, volume ${volume === 'N/A' ? 'N/A' : volume.toLowerCase()}${rvol != null ? ` (RVOL ${r1(rvol)}×)` : ''}.`);
      reasons.push(`Semua Hard Risk Gate lulus: potensi +${r1(p.potentialPct ?? 0)}%, R:R 1:${r1(p.rr ?? 0)}.`);
    } else {
      // Main gates first, the trigger last — unless there is no candidate at all: then the trigger detail
      // is the root cause and the other FAILs ("R:R tidak dapat dihitung") are only its consequence.
      const trig = failed.filter((x) => x.key === 'trigger');
      const main = failed.filter((x) => x.key !== 'trigger');
      const ordered = candidate ? [...main, ...trig] : [...trig, ...main];
      for (const f of ordered.slice(0, 2)) reasons.push(`${f.label} FAIL — ${f.detail}.`);
    }
  }

  // Trigger Entry (Validated Setup) or Re-evaluation (blocked) — only levels backed by data (S/R, EMA 20).
  const zoneText = p ? (p.entryLow === p.entryHigh ? rp(p.entryLow) : `${rp(p.entryLow)}–${rp(p.entryHigh)}`) : '';
  const failedMain = failed.filter((x) => x.key !== 'trigger' && x.key !== 'distribution').map((x) => x.label);
  const reevalSetup = (() => {
    if (!candidate) {
      if (trend !== 'SIDEWAYS') return 'tren naik terbentuk kembali';
      return breakoutTarget != null
        ? `tren naik terbentuk (EMA 20 > EMA 50, Higher Low) atau harga mendekati resistance ${rp(breakoutTarget)} lalu CLOSE di atasnya dengan volume`
        : 'tren naik terbentuk (EMA 20 > EMA 50, Higher Low) atau ada resistance yang di-breakout dengan volume';
    }
    const blocker = candidate.plan.blocker;
    if (candidate.plan.upsideToResistancePct != null && candidate.plan.upsideToResistancePct < MOMENTUM_TARGET_PCT && blocker != null) {
      return `CLOSE di atas resistance ${rp(blocker)} dengan RVOL ≥ ${r1(BREAKOUT_RVOL)}×, dan ruang ≥ ${MOMENTUM_TARGET_PCT}% ke resistance berikutnya`;
    }
    if (candidate.kind === 'nextBreakout') return `CLOSE di atas ${rp(candidate.level!)} dengan RVOL ≥ ${r1(BREAKOUT_RVOL)}× dan candle hijau kuat (maks +${BREAKOUT_ZONE_PCT}% dari level)`;
    if (candidate.kind === 'breakout' || candidate.kind === 'retest') return `harga kembali ke area level ${rp(candidate.level!)} (maks +${BREAKOUT_ZONE_PCT}%) dan bertahan di atasnya`;
    return `pullback ke area EMA 20 (${rp(ema20)}) dengan volume mengecil, lalu candle pantulan hijau`;
  })();
  const trigger =
    status === 'MOMENTUM BUY' && p ? `Entry di ${zoneText} selama harga bertahan di atas ${rp(p.sl)}; jangan kejar di atas ${rp(p.entryHigh)}.`
      : status === 'AVOID CHASING' ? `Re-evaluasi setelah pullback/reset ke area EMA 20 (${rp(ema20)}) dengan volume mengecil dan muncul trigger baru — lalu cek ulang semua Hard Risk Gate.`
        : status === 'AVOID REVERSAL' ? `Re-evaluasi setelah struktur pulih: kembali di atas EMA 20 (${rp(ema20)}) dengan Higher Low baru dan tanda distribusi hilang.`
          : `Re-evaluasi jika ${reevalSetup}${failedMain.length ? `; gate yang harus lulus: ${failedMain.join(', ')}` : ''}.`;

  const exitWarnings = [
    p ? `Close di bawah SL ${rp(p.sl)} → keluar penuh.` : `Close di bawah EMA 20 (${rp(ema20)}) → kurangi/tutup posisi yang sudah ada.`,
    'Upper wick panjang / rejection dengan volume besar di dekat resistance → kurangi posisi.',
    'Candle merah dengan volume ≥ 1,5× rata-rata (selling volume) → waspada distribusi.',
    'Terbentuk Lower High + MACD histogram turun 3 hari → amankan profit.',
    ...(p?.tp1 ? [`TP1 ${rp(p.tp1.price)} tercapai → realisasi sebagian, naikkan SL ke entry.`] : []),
  ];

  const blockedBy = failed.map((x) => x.label).join(', ');
  const conclusion = {
    'MOMENTUM BUY': `Validated Setup — semua Hard Risk Gate lulus: BUY di ${zoneText}, SL ${p ? rp(p.sl) : 'N/A'}, target +${r1(p?.potentialPct ?? 0)}%.`,
    'AVOID CHASING': 'Harga sudah terlalu jauh dari zona entry — jangan kejar, tidak ada trading plan.',
    'AVOID REVERSAL': 'Risiko distribusi/reversal tinggi — hindari, tidak ada trading plan.',
    'NO TRADE': `Setup belum valid — tidak ada trading plan (FINAL GATE BLOCKED: ${blockedBy}).`,
    'N/A': 'Data tidak cukup.',
  }[status];

  return {
    dataOk: true,
    dataNote: '',
    status,
    finalGate,
    candidateSetup: status === 'AVOID REVERSAL' ? null : candidate?.label ?? null,
    candidateStats: candidate
      ? { potentialPct: candidate.plan.potentialPct, riskReward: candidate.plan.rr, upsidePct: candidate.plan.upsideToResistancePct, target20Realistic: candidate.plan.target20Realistic }
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
    riskReward: p?.rr ?? null,
    upsideToResistancePct: p ? p.upsideToResistancePct : nearestResistance != null ? pct(nearestResistance, price) : null,
    volatilityRoomPct: roomPct,
    target20Realistic: p?.target20Realistic ?? false,
    riskGate: gates,
    metrics: {
      price, rsi14, macdHistogram, macdRising, roc5, accelerating, rvol, volumeRatio5, atrPct, distEma20Pct,
      structureLabel: st.label, breakoutLevel, nearestResistance, nearestSupport,
    },
    checks,
    distributionFlags: flags,
    reasons: reasons.slice(0, 3),
    trigger,
    exitWarnings,
    conclusion,
  };
}
