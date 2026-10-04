/**
 * momentumSpeculation.ts
 *
 * "EzySaham AI" momentum vs speculation report (features_momentum.md), made consistent per
 * docs/features_1menit_analisa_gemini.md:
 *
 *   DECISION HIERARCHY  DATA QUALITY → LIQUIDITY → RISK → TREND → MOMENTUM → ENTRY CONFIRMATION
 *                       → VALUATION CONTEXT (info only) → FINAL ACTION
 *
 *   BUY   = every mandatory gate PASS
 *   WAIT  = no gate FAIL, but some confirmation still PENDING
 *   AVOID = any mandatory gate FAIL → no setup, entry, TP, SL, R:R or position size at all;
 *           only the reasons and the conditions under which the status could change.
 *
 * Valuation / fair value is context only — it never rescues a failed gate and is never a BUY reason.
 * A "buy area" is a conditional plan, not a BUY. Scores are kept separate (fundamental, valuation,
 * momentum, liquidity, risk) and a final consistency check validates the output.
 *
 * Pure & deterministic: every verdict is derived from the numbers passed in. A missing input yields
 * `null` / an "na" signal — never a guessed value. Price levels shown as orders snap to valid IDX ticks.
 */

import { roundToTick } from '@/domain/analysis/idxTick';
import { pickTargets, PlanLevels, validatePlanLevels } from '@/domain/analysis/tradingModesReview';
import { OHLCVBar } from '@/domain/models/History';

export type MomentumSignal = 'green' | 'yellow' | 'red' | 'na';
export type MomentumStatus = 'BUY' | 'WAIT' | 'AVOID';
export type GateStatus = 'PASS' | 'FAIL' | 'PENDING' | 'SKIPPED';
export type GateKey = 'data' | 'liquidity' | 'risk' | 'trend' | 'momentum' | 'entry';

/** Liquidity floor from features_momentum.md: daily traded value < Rp 1 M is thin and easy to "goreng". */
export const MIN_LIQUID_VALUE = 1e9;
/** Comfortable liquidity for swing size positions. */
export const GOOD_LIQUID_VALUE = 10e9;
/** RVOL at/above this is an anomaly / strong market interest (features_momentum.md §1). */
export const RVOL_ANOMALY = 1.5;
/** RVOL below this means volume can't confirm anything — confidence is cut hard. */
export const RVOL_VERY_LOW = 0.5;
/** Minimum RVOL for a candle/entry to count as volume-confirmed. */
export const RVOL_CONFIRM = 1;
/** Max equity risked per trade — the Risk Gate. Intraday is half of swing. */
export const MAX_RISK_PER_TRADE_PCT = 1;
export const MAX_RISK_PER_TRADE_INTRADAY_PCT = 0.5;
/** SL wider than this from entry is not a "tight" technical stop → no BUY. */
export const MAX_SL_DISTANCE_PCT = 8;
/** Don't chase: price more than this above the entry level invalidates the entry. */
export const MAX_CHASE_PCT = 3;
/** Price this far above EMA 20 is parabolic — Risk Gate fails. */
export const MAX_EXTENSION_EMA20_PCT = 15;
export const MIN_RISK_REWARD = 1.5;
/** Bars needed for EMA 50 / candle context to mean anything. */
const MIN_BARS = 50;

export interface MomentumInput {
  bars: OHLCVBar[];
  price: number;
  /** 1-day % change (summary.percentChange1D). */
  change1D: number | null;
  change1W: number | null;
  change1M: number | null;
  annualHigh: number | null;
  ema9: number | null;
  ema20: number | null;
  ema50: number | null;
  /** Session VWAP from the 1-minute feed; null when the intraday feed is unavailable. */
  vwap: number | null;
  rvol: number | null;
  /** 20-day average volume (shares). */
  volumeMa20: number | null;
  rsi14: number | null;
  macdHistogram: number | null;
  atr14: number | null;
  /** Daily traded value in rupiah. */
  tradedValue: number | null;
  capitalization: number | null;
  /** Free float in %. */
  freeFloat: number | null;
  per: number | null;
  pbv: number | null;
  roe: number | null;
  revenueGrowth: number | null;
  earningsGrowth: number | null;
  /** From fundamentalPillars: UNDERVALUED · WAJAR · PREMIUM · OVERVALUED · TIDAK_DAPAT_DINILAI. */
  valuationVerdict: string;
  fairValue: number | null;
  /** Ascending supports below / resistances above, as produced by the analysis engine. */
  supports: number[];
  resistances: number[];
}

export interface Check {
  label: string;
  value: string;
  signal: MomentumSignal;
  note: string;
}

export interface CandleRead {
  pattern: string;
  emoji: string;
  signal: MomentumSignal;
  /** Close location in the day's range, 0–100 (100 = closed at the high → buyers in control). */
  buyerPower: number | null;
  bodyPct: number | null;
  upperWickPct: number | null;
  lowerWickPct: number | null;
  note: string;
}

export interface PlanTarget {
  label: string;
  price: number;
  gainPct: number;
  basis: string;
}

export interface Gate {
  key: GateKey;
  label: string;
  status: GateStatus;
  reason: string;
  /** What has to change for a FAIL/PENDING gate to pass. */
  condition: string | null;
}

export interface ScoreItem {
  /** 0–100. For `risk`, higher = more risky. null = not computable. */
  value: number | null;
  label: string;
  signal: MomentumSignal;
}

export interface MomentumScores {
  fundamental: ScoreItem;
  valuation: ScoreItem;
  momentum: ScoreItem;
  liquidity: ScoreItem;
  risk: ScoreItem;
}

export type SetupType = 'BREAKOUT' | 'SUPPORT' | 'PULLBACK' | 'NONE';

export const SETUP_LABEL: Record<SetupType, string> = {
  BREAKOUT: 'Area Breakout',
  SUPPORT: 'Area Support',
  PULLBACK: 'Area Pullback',
  NONE: 'Tidak ada setup',
};

export interface MomentumPlan {
  status: MomentumStatus;
  statusReason: string;
  /**
   * 'active'      — BUY: every gate passed, levels are executable.
   * 'conditional' — WAIT with a valid setup: levels are a plan only ("Buy Area" ≠ BUY).
   * 'none'        — AVOID, or WAIT without a valid setup: no levels at all.
   */
  planState: 'active' | 'conditional' | 'none';
  setup: SetupType;
  entryLow: number | null;
  entryHigh: number | null;
  entryTrigger: string | null;
  targets: PlanTarget[];
  sl: number | null;
  slBasis: string | null;
  riskPct: number | null;
  rewardPct: number | null;
  riskReward: number | null;
  validationErrors: string[];
  /** Mandatory entry confirmations (only evaluated when no gate before ENTRY failed). */
  confirmations: Array<{ label: string; ok: boolean }>;
  /** AVOID / WAIT-without-setup: conditions under which the status could change. */
  conditions: string[];
  riskGate: string[];
  /** Max lot for a Rp 10 jt / 100 jt account at MAX_RISK_PER_TRADE_PCT — empty unless planState ≠ 'none'. */
  sizing: Array<{ capital: number; maxLoss: number; maxLot: number | null }>;
}

export interface ConsistencyCheck {
  label: string;
  passed: boolean;
}

export interface MomentumReport {
  gates: Gate[];
  scores: MomentumScores;
  // §1
  candle: CandleRead;
  rvolCheck: Check;
  positionChecks: Check[];
  emaStack: 'bullish' | 'bearish' | 'mixed' | 'na';
  momentumSignal: MomentumSignal;
  momentumLabel: string;
  // §2
  driver: { signal: MomentumSignal; label: string; reasons: string[] };
  liquidity: Check;
  hotMoney: { level: 'TINGGI' | 'SEDANG' | 'RENDAH'; signal: MomentumSignal; flags: string[] };
  // §3 — context only, never gates the decision
  fundamentalLabel: 'Fundamental Solid' | 'Fundamental Mixed' | 'Fundamental Lemah' | 'Fundamental tidak tersedia';
  valuationChecks: Check[];
  valuationSignal: MomentumSignal;
  valuationLabel: string;
  valuationWarnings: string[];
  // §4
  plan: MomentumPlan;
  consistency: ConsistencyCheck[];
  conclusion: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

const ok = (n: number | null | undefined): n is number => n != null && Number.isFinite(n) && n > 0;
const finite = (n: number | null | undefined): n is number => n != null && Number.isFinite(n);
const pctDiff = (a: number, b: number) => ((a - b) / b) * 100;
const n1 = (n: number, dec = 1) => n.toLocaleString('id-ID', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const rp = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;
const sgn = (n: number, dec = 1) => `${n > 0 ? '+' : ''}${n1(n, dec)}%`;
const clamp100 = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** "Rp 1,2 M" (miliar) / "Rp 350 jt" / "Rp 2,1 T" — Indonesian money units, as used by traders. */
export function fmtIdrValue(n: number | null | undefined): string {
  if (!finite(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1e12) return `Rp ${n1(n / 1e12)} T`;
  if (abs >= 1e9) return `Rp ${n1(n / 1e9)} M`;
  if (abs >= 1e6) return `Rp ${n1(n / 1e6, 0)} jt`;
  return rp(n);
}

// ─── §1 Candlestick ─────────────────────────────────────────────────────────────

/**
 * Reads the last daily candle: Marubozu, Pin Bar (hammer / shooting star), Doji, Breakout / Breakdown.
 * Bullish patterns only count as confirmation with adequate volume (RVOL ≥ 1): a hammer on thin volume
 * is a POTENTIAL REJECTION, a breakout candle on thin volume is unconfirmed.
 */
export function readCandle(bars: OHLCVBar[], rvol: number | null = null): CandleRead {
  const last = bars[bars.length - 1];
  if (!last || !(last.high > last.low)) {
    return { pattern: 'Data tidak tersedia', emoji: '⚪', signal: 'na', buyerPower: null, bodyPct: null, upperWickPct: null, lowerWickPct: null, note: 'Candle harian terakhir tidak tersedia.' };
  }
  const range = last.high - last.low;
  const body = Math.abs(last.close - last.open);
  const upper = last.high - Math.max(last.open, last.close);
  const lower = Math.min(last.open, last.close) - last.low;
  const green = last.close > last.open;
  const red = last.close < last.open;
  const buyerPower = ((last.close - last.low) / range) * 100;
  const bodyPct = (body / range) * 100;
  const upperWickPct = (upper / range) * 100;
  const lowerWickPct = (lower / range) * 100;
  const volumeOk = ok(rvol) && rvol >= RVOL_CONFIRM;
  const volTxt = ok(rvol) ? `RVOL ${n1(rvol, 2)}x` : 'RVOL tidak tersedia';

  // Breakout: close above the highest high of the previous 20 sessions with a real body.
  const prior = bars.slice(-21, -1);
  const priorHigh = prior.length >= 10 ? Math.max(...prior.map((b) => b.high)) : null;
  const priorLow = prior.length >= 10 ? Math.min(...prior.map((b) => b.low)) : null;
  const base = { buyerPower, bodyPct, upperWickPct, lowerWickPct };

  if (priorHigh != null && green && last.close > priorHigh && bodyPct >= 50) {
    return volumeOk
      ? { ...base, pattern: 'Breakout Candle', emoji: '🚀', signal: 'green', note: `Close ${rp(last.close)} menembus high 20 hari ${rp(priorHigh)} dengan body ${n1(bodyPct, 0)}% dan ${volTxt} — buyer agresif.` }
      : { ...base, pattern: 'Breakout tanpa volume', emoji: '🟡', signal: 'yellow', note: `Close menembus high 20 hari ${rp(priorHigh)} tetapi ${volTxt} — breakout belum terkonfirmasi volume, rawan false breakout.` };
  }
  if (priorLow != null && red && last.close < priorLow && bodyPct >= 50) {
    return { ...base, pattern: 'Breakdown Candle', emoji: '🔻', signal: 'red', note: `Close ${rp(last.close)} jebol low 20 hari ${rp(priorLow)} — seller dominan.` };
  }
  if (bodyPct >= 85) {
    if (green) {
      return volumeOk
        ? { ...base, pattern: 'Bullish Marubozu', emoji: '🟢', signal: 'green', note: `Hampir tanpa shadow dengan ${volTxt} — buyer menguasai sesi dari open sampai close.` }
        : { ...base, pattern: 'Bullish Marubozu (volume tipis)', emoji: '🟡', signal: 'yellow', note: `Buyer menguasai sesi, tetapi ${volTxt} — belum jadi konfirmasi.` };
    }
    return { ...base, pattern: 'Bearish Marubozu', emoji: '🔴', signal: 'red', note: 'Hampir tanpa shadow — seller menguasai sesi dari open sampai close.' };
  }
  if (bodyPct <= 10) {
    return { ...base, pattern: 'Doji', emoji: '🟡', signal: 'yellow', note: 'Body sangat kecil — buyer & seller seimbang, tunggu konfirmasi candle berikutnya.' };
  }
  if (lower >= 2 * body && upperWickPct <= 25) {
    return volumeOk
      ? { ...base, pattern: 'Bullish Pin Bar (Hammer)', emoji: '📌', signal: 'green', note: `Lower shadow ${n1(lowerWickPct, 0)}% dari range dengan ${volTxt} — tekanan jual ditolak, buyer masuk di bawah.` }
      : { ...base, pattern: 'Potential Rejection (Hammer)', emoji: '🟡', signal: 'yellow', note: `Lower shadow ${n1(lowerWickPct, 0)}% dari range, tetapi ${volTxt} — baru POTENSI penolakan, bukan konfirmasi bullish.` };
  }
  if (upper >= 2 * body && lowerWickPct <= 25) {
    return { ...base, pattern: 'Bearish Pin Bar (Shooting Star)', emoji: '📍', signal: 'red', note: `Upper shadow ${n1(upperWickPct, 0)}% dari range — kenaikan ditolak, indikasi distribusi / profit taking.` };
  }
  if (green) {
    return buyerPower >= 70 && volumeOk
      ? { ...base, pattern: 'Candle Hijau Kuat', emoji: '🟢', signal: 'green', note: `Close di ${n1(buyerPower, 0)}% range harian dengan ${volTxt} — buyer dominan.` }
      : { ...base, pattern: 'Candle Hijau', emoji: '🟡', signal: 'yellow', note: buyerPower >= 70 ? `Close di ${n1(buyerPower, 0)}% range, tetapi ${volTxt} — belum terkonfirmasi volume.` : `Close di ${n1(buyerPower, 0)}% range — buyer menang tipis, ada tekanan jual di atas.` };
  }
  if (red) {
    return buyerPower <= 30
      ? { ...base, pattern: 'Candle Merah Kuat', emoji: '🔴', signal: 'red', note: `Close di ${n1(buyerPower, 0)}% range harian — seller dominan.` }
      : { ...base, pattern: 'Candle Merah', emoji: '🟡', signal: 'yellow', note: `Close di ${n1(buyerPower, 0)}% range — seller menang tipis, buyer masih menahan.` };
  }
  return { ...base, pattern: 'Netral', emoji: '🟡', signal: 'yellow', note: 'Open = close — belum ada pemenang.' };
}

// ─── Engine ─────────────────────────────────────────────────────────────────────

export function buildMomentumReport(i: MomentumInput): MomentumReport {
  const price = i.price;
  const veryLowVolume = ok(i.rvol) && i.rvol < RVOL_VERY_LOW;

  // §1 ── Candle, RVOL, position vs VWAP / EMA
  const candle = readCandle(i.bars, i.rvol);

  const rvolCheck: Check = !ok(i.rvol)
    ? { label: 'RVOL', value: '—', signal: 'na', note: 'Volume rata-rata tidak tersedia — volume tidak bisa dipakai sebagai konfirmasi.' }
    : i.rvol >= RVOL_ANOMALY
      ? { label: 'RVOL', value: `${n1(i.rvol, 2)}x`, signal: candle.signal === 'red' ? 'red' : 'green', note: `⚡ Anomali volume (≥ ${n1(RVOL_ANOMALY)}x) — minat pasar kuat${candle.signal === 'red' ? ', tetapi candle merah: tekanan jual bervolume' : ''}.` }
      : i.rvol >= RVOL_CONFIRM
        ? { label: 'RVOL', value: `${n1(i.rvol, 2)}x`, signal: 'yellow', note: 'Volume normal — cukup sebagai konfirmasi dasar, belum ada anomali.' }
        : veryLowVolume
          ? { label: 'RVOL', value: `${n1(i.rvol, 2)}x`, signal: 'red', note: `Volume sangat rendah (< ${n1(RVOL_VERY_LOW)}x rata-rata) — pergerakan harga tidak terkonfirmasi, confidence diturunkan signifikan.` }
          : { label: 'RVOL', value: `${n1(i.rvol, 2)}x`, signal: 'red', note: 'Volume di bawah rata-rata — kenaikan/penurunan kurang meyakinkan.' };

  const vs = (label: string, level: number | null, desc: string): Check => {
    if (!ok(level)) return { label, value: '—', signal: 'na', note: `${desc} tidak tersedia.` };
    const d = pctDiff(price, level);
    return {
      label,
      value: `${rp(level)} (${sgn(d)})`,
      signal: d > 0.2 ? 'green' : d < -0.2 ? 'red' : 'yellow',
      note: d > 0.2 ? `Harga di atas ${desc}.` : d < -0.2 ? `Harga di bawah ${desc}.` : `Harga menempel ${desc}.`,
    };
  };
  const positionChecks: Check[] = [
    vs('VWAP', i.vwap, 'VWAP intraday (rata-rata harga tertimbang volume hari ini)'),
    vs('EMA 9', i.ema9, 'EMA 9 (momentum sangat pendek)'),
    vs('EMA 20', i.ema20, 'EMA 20 (trend pendek)'),
    vs('EMA 50', i.ema50, 'EMA 50 (trend menengah)'),
  ];
  const emaStack: MomentumReport['emaStack'] = !ok(i.ema9) || !ok(i.ema20) || !ok(i.ema50) ? 'na'
    : price > i.ema9 && i.ema9 > i.ema20 && i.ema20 > i.ema50 ? 'bullish'
      : price < i.ema9 && i.ema9 < i.ema20 && i.ema20 < i.ema50 ? 'bearish' : 'mixed';

  // Momentum votes: candle + RVOL (only with candle direction) + 4 position checks + EMA stack + RSI + MACD.
  const votes: Array<number | null> = [
    candle.signal === 'green' ? 1 : candle.signal === 'red' ? -1 : candle.signal === 'na' ? null : 0,
    !ok(i.rvol) ? null : i.rvol >= RVOL_ANOMALY ? (candle.signal === 'green' ? 1 : candle.signal === 'red' ? -1 : 0) : veryLowVolume ? -1 : 0,
    ...positionChecks.map((c) => (c.signal === 'green' ? 1 : c.signal === 'red' ? -1 : c.signal === 'na' ? null : 0)),
    emaStack === 'bullish' ? 1 : emaStack === 'bearish' ? -1 : emaStack === 'na' ? null : 0,
    !finite(i.rsi14) ? null : i.rsi14 >= 55 && i.rsi14 <= 75 ? 1 : i.rsi14 < 45 ? -1 : 0,
    !finite(i.macdHistogram) ? null : i.macdHistogram > 0 ? 1 : i.macdHistogram < 0 ? -1 : 0,
  ];
  const counted = votes.filter((v): v is number => v != null);
  const ratio = counted.length > 0 ? counted.reduce((s, v) => s + v, 0) / counted.length : 0;
  let momentumValue: number | null = counted.length < 4 ? null : clamp100(((ratio + 1) / 2) * 100);
  let momentumSignal: MomentumSignal = momentumValue == null ? 'na' : ratio >= 0.5 ? 'green' : ratio <= -0.25 ? 'red' : 'yellow';
  // RVOL < 0.5x: price action without participation — cut confidence and never call it strong momentum.
  if (veryLowVolume && momentumValue != null) {
    momentumValue = clamp100(momentumValue * 0.6);
    if (momentumSignal === 'green') momentumSignal = 'yellow';
  }
  const momentumLabel = momentumSignal === 'green' ? 'Momentum Kuat'
    : momentumSignal === 'red' ? 'Momentum Lemah'
      : momentumSignal === 'yellow' ? (veryLowVolume ? 'Momentum tidak terkonfirmasi volume' : 'Momentum Netral') : 'Data kurang';

  // §2 ── Fundamental class, driver (organic vs chasing), liquidity, hot money
  const eg = i.earningsGrowth;
  const rg = i.revenueGrowth;
  const fundamentalsKnown = finite(eg) || finite(rg) || finite(i.roe) || (finite(i.per) && i.per !== 0);
  const lossMaking = (finite(i.per) && i.per < 0) || (finite(i.roe) && i.roe < 0);
  const negatives = [finite(eg) && eg < 0, finite(rg) && rg < 0, finite(i.roe) && i.roe < 5, lossMaking].filter(Boolean).length;
  const positives = [finite(eg) && eg > 0, finite(rg) && rg > 0, finite(i.roe) && i.roe >= 10].filter(Boolean).length;
  // "Solid" requires no red flag at all — a loss-maker (PER negatif / ROE negatif) is at best "Mixed".
  const fundamentalLabel: MomentumReport['fundamentalLabel'] = !fundamentalsKnown ? 'Fundamental tidak tersedia'
    : negatives === 0 && positives >= 1 ? 'Fundamental Solid'
      : positives > 0 || (lossMaking && negatives <= 1) ? 'Fundamental Mixed'
        : 'Fundamental Lemah';
  const weakFundamental = fundamentalLabel === 'Fundamental Lemah' || lossMaking;

  const strongRun = (finite(i.change1D) && i.change1D >= 5) || (finite(i.change1W) && i.change1W >= 10) || (finite(i.change1M) && i.change1M >= 20);
  const ext20 = ok(i.ema20) ? pctDiff(price, i.ema20) : null;
  const overvalued = i.valuationVerdict === 'PREMIUM' || i.valuationVerdict === 'OVERVALUED';

  const driverReasons = [
    finite(i.change1D) && `1D ${sgn(i.change1D)}`,
    finite(i.change1W) && `1W ${sgn(i.change1W)}`,
    finite(i.change1M) && `1M ${sgn(i.change1M)}`,
    finite(eg) && `laba ${sgn(eg)} YoY`,
    finite(rg) && `pendapatan ${sgn(rg)} YoY`,
    finite(i.roe) && `ROE ${n1(i.roe)}%`,
    finite(i.per) && i.per < 0 && `PER ${n1(i.per)}x (rugi)`,
  ].filter((x): x is string => Boolean(x));
  const driver = !fundamentalsKnown
    ? { signal: 'na' as const, label: 'Fundamental tidak tersedia — kenaikan tidak bisa dikonfirmasi organik', reasons: driverReasons }
    : fundamentalLabel === 'Fundamental Solid' && !overvalued
      ? { signal: 'green' as const, label: strongRun ? 'Fundamental Solid — momentum didukung fundamental (organik)' : 'Fundamental Solid — momentum organik', reasons: driverReasons }
      : weakFundamental && strongRun
        ? { signal: 'red' as const, label: `${fundamentalLabel} — short-term momentum chasing / FOMO, fundamental tidak mendukung`, reasons: driverReasons }
        : weakFundamental
          ? { signal: 'red' as const, label: `${fundamentalLabel} — pergerakan rawan spekulatif`, reasons: driverReasons }
          : { signal: 'yellow' as const, label: `${fundamentalLabel} — ${strongRun ? 'harga sudah lari / valuasi mahal' : 'belum ada pendorong yang dominan'}`, reasons: driverReasons };

  // Liquidity: the larger of today's value and the 20-day average value, so one quiet session doesn't flag a liquid stock.
  const avgValue = ok(i.volumeMa20) ? i.volumeMa20 * price : null;
  const liqValue = ok(i.tradedValue) || ok(avgValue) ? Math.max(i.tradedValue ?? 0, avgValue ?? 0) : null;
  const liquidity: Check = !ok(liqValue)
    ? { label: 'Nilai transaksi', value: '—', signal: 'na', note: 'Nilai transaksi tidak tersedia.' }
    : {
      label: 'Nilai transaksi',
      value: `${fmtIdrValue(i.tradedValue)} hari ini${avgValue != null ? ` · rata-rata 20H ≈ ${fmtIdrValue(avgValue)}` : ''}`,
      signal: liqValue < MIN_LIQUID_VALUE ? 'red' : liqValue < GOOD_LIQUID_VALUE ? 'yellow' : 'green',
      note: liqValue < MIN_LIQUID_VALUE
        ? '🔴 Likuiditas tipis (< Rp 1 M) — mudah digerakkan (digoreng), spread lebar, sulit keluar saat panik.'
        : liqValue < GOOD_LIQUID_VALUE
          ? '🟡 Likuiditas cukup untuk trading kecil — batasi ukuran posisi.'
          : '🟢 Likuiditas memadai — keluar-masuk posisi relatif mudah.',
    };

  const hotFlags = [
    ok(i.rvol) && i.rvol >= 3 && `RVOL ekstrem ${n1(i.rvol, 2)}x (≥ 3x) — volume tiba-tiba melonjak`,
    finite(i.change1D) && i.change1D >= 7 && `Kenaikan 1 hari ${sgn(i.change1D)} — lonjakan harian agresif`,
    finite(i.change1M) && i.change1M >= 30 && `Return 1 bulan ${sgn(i.change1M)} — reli sangat cepat`,
    ext20 != null && ext20 >= 10 && `Harga ${sgn(ext20)} di atas EMA 20 — overextended`,
    finite(i.rsi14) && i.rsi14 >= 75 && `RSI ${n1(i.rsi14)} — overbought`,
    candle.pattern.includes('Shooting Star') && strongRun && 'Shooting star setelah reli — indikasi distribusi',
    ok(liqValue) && liqValue < MIN_LIQUID_VALUE && 'Likuiditas tipis — rentan dikendalikan sedikit pihak',
    ok(i.capitalization) && i.capitalization < 1e12 && `Kapitalisasi kecil ${fmtIdrValue(i.capitalization)} (< Rp 1 T)`,
    ok(i.freeFloat) && i.freeFloat < 15 && `Free float rendah ${n1(i.freeFloat)}% — barang beredar sedikit`,
  ].filter((x): x is string => Boolean(x));
  const hotLevel = hotFlags.length >= 4 ? 'TINGGI' : hotFlags.length >= 2 ? 'SEDANG' : 'RENDAH';
  const hotMoney = { level: hotLevel, signal: (hotLevel === 'TINGGI' ? 'red' : hotLevel === 'SEDANG' ? 'yellow' : 'green') as MomentumSignal, flags: hotFlags } as const;

  // §3 ── Valuation & value trap (context only)
  const valuationChecks: Check[] = [
    !finite(i.per) || i.per === 0
      ? { label: 'PER', value: '—', signal: 'na', note: 'PER tidak tersedia.' }
      : i.per < 0
        ? { label: 'PER', value: `${n1(i.per)}x`, signal: 'red', note: 'PER negatif — perusahaan rugi, valuasi berbasis laba tidak berlaku.' }
        : { label: 'PER', value: `${n1(i.per)}x`, signal: i.per <= 15 ? 'green' : i.per <= 25 ? 'yellow' : 'red', note: i.per <= 15 ? 'Murah–wajar.' : i.per <= 25 ? 'Wajar–premium.' : 'Mahal (> 25x) — pasar sudah membayar ekspektasi tinggi.' },
    !finite(i.pbv) || i.pbv <= 0
      ? { label: 'PBV', value: '—', signal: 'na', note: 'PBV tidak tersedia.' }
      : { label: 'PBV', value: `${n1(i.pbv, 2)}x`, signal: i.pbv <= 1.5 ? 'green' : i.pbv <= 3 ? 'yellow' : 'red', note: i.pbv <= 1.5 ? 'Dekat nilai buku.' : i.pbv <= 3 ? 'Premium moderat.' : 'Premium tinggi (> 3x nilai buku).' },
    ok(i.fairValue)
      ? (() => {
        const gap = pctDiff(i.fairValue, price);
        return { label: 'Nilai wajar', value: `${rp(i.fairValue)} (${sgn(gap)})`, signal: (gap >= 10 ? 'green' : gap >= -10 ? 'yellow' : 'red') as MomentumSignal, note: `${gap >= 0 ? 'Harga di bawah estimasi nilai wajar' : 'Harga sudah di atas estimasi nilai wajar'} — konteks saja, bukan alasan entry.` };
      })()
      : { label: 'Nilai wajar', value: '—', signal: 'na', note: 'Estimasi nilai wajar tidak tersedia.' },
  ];
  const redVal = valuationChecks.filter((c) => c.signal === 'red').length;
  const greenVal = valuationChecks.filter((c) => c.signal === 'green').length;
  const knownVal = valuationChecks.filter((c) => c.signal !== 'na');
  const valuationSignal: MomentumSignal = knownVal.length === 0 ? 'na' : overvalued || redVal >= 2 ? 'red' : greenVal >= 2 && redVal === 0 ? 'green' : 'yellow';
  const valuationLabel = valuationSignal === 'red' ? 'Overvalued' : valuationSignal === 'green' ? 'Murah / Undervalued' : valuationSignal === 'yellow' ? 'Wajar' : 'Tidak dapat dinilai';

  const technicalGreen = momentumSignal === 'green' || strongRun;
  const cheapLooking = (finite(i.per) && i.per > 0 && i.per < 8) || (finite(i.pbv) && i.pbv > 0 && i.pbv < 1);
  const valuationWarnings = [
    technicalGreen && valuationSignal === 'red' && '🔴 Momentum hijau tetapi valuasi sudah mahal — risiko profit taking / koreksi tajam saat momentum habis.',
    technicalGreen && weakFundamental && '🔴 Kenaikan harga tidak sejalan fundamental (laba turun / rugi / ROE rendah) — kenaikan rawan dibalik.',
    cheapLooking && finite(eg) && eg < 0 && `🟡 Risiko value trap: terlihat murah (PER/PBV rendah) tetapi laba turun ${sgn(eg)} YoY — murah bisa karena memang memburuk.`,
    ok(i.annualHigh) && pctDiff(price, i.annualHigh) >= -3 && strongRun && '🟡 Harga dekat high 1 tahun setelah reli — area rawan distribusi.',
  ].filter((x): x is string => Boolean(x));

  // ── Separate scores ──
  const fundamentalValue = !fundamentalsKnown ? null : clamp100(50 + positives * 15 - negatives * 20 - (lossMaking ? 15 : 0));
  const valuationValue = knownVal.length === 0 ? null
    : clamp100(knownVal.reduce((s, c) => s + (c.signal === 'green' ? 100 : c.signal === 'yellow' ? 55 : 10), 0) / knownVal.length - (overvalued ? 15 : 0));
  const liquidityValue = !ok(liqValue) ? null
    : liqValue < MIN_LIQUID_VALUE ? clamp100((liqValue / MIN_LIQUID_VALUE) * 20)
      : liqValue < 5e9 ? 45 : liqValue < GOOD_LIQUID_VALUE ? 60 : liqValue < 50e9 ? 80 : 100;
  const atrPct = ok(i.atr14) && price > 0 ? (i.atr14 / price) * 100 : null;
  const riskValue = clamp100(
    hotFlags.length * 12 +
    (ext20 != null && ext20 > 5 ? Math.min(25, (ext20 - 5) * 2.5) : 0) +
    (atrPct != null ? Math.min(20, atrPct * 3) : 10) +
    (weakFundamental ? 10 : 0) +
    (veryLowVolume ? 10 : 0),
  );
  const scores: MomentumScores = {
    fundamental: { value: fundamentalValue, label: fundamentalLabel, signal: fundamentalLabel === 'Fundamental Solid' ? 'green' : fundamentalLabel === 'Fundamental Mixed' ? 'yellow' : fundamentalLabel === 'Fundamental Lemah' ? 'red' : 'na' },
    valuation: { value: valuationValue, label: valuationLabel, signal: valuationSignal },
    momentum: { value: momentumValue, label: momentumLabel, signal: momentumSignal },
    liquidity: { value: liquidityValue, label: liquidity.signal === 'red' ? 'Tipis' : liquidity.signal === 'yellow' ? 'Cukup' : liquidity.signal === 'green' ? 'Memadai' : 'Tidak tersedia', signal: liquidity.signal },
    risk: { value: riskValue, label: riskValue >= 60 ? 'Risiko Tinggi' : riskValue >= 35 ? 'Risiko Sedang' : 'Risiko Rendah', signal: riskValue >= 60 ? 'red' : riskValue >= 35 ? 'yellow' : 'green' },
  };

  // ── Gates, in hierarchy order ──
  const gates: Gate[] = [];

  const missingCore = [
    !(price > 0) && 'harga',
    i.bars.length < MIN_BARS && `riwayat ≥ ${MIN_BARS} hari (tersedia ${i.bars.length})`,
    !ok(i.ema20) && 'EMA 20',
    !ok(i.ema50) && 'EMA 50',
    candle.signal === 'na' && 'candle harian',
    !ok(liqValue) && 'nilai transaksi',
  ].filter((x): x is string => Boolean(x));
  gates.push(missingCore.length > 0
    ? { key: 'data', label: 'Data Quality', status: 'FAIL', reason: `Data inti tidak tersedia: ${missingCore.join(', ')}.`, condition: 'Data harga, EMA 20/50 dan nilai transaksi tersedia lengkap.' }
    : { key: 'data', label: 'Data Quality', status: 'PASS', reason: `Data EOD lengkap${ok(i.vwap) ? ' + VWAP intraday' : ' (VWAP intraday tidak tersedia — tidak dipakai)'}.`, condition: null });

  gates.push(!ok(liqValue)
    ? { key: 'liquidity', label: 'Liquidity Gate', status: 'FAIL', reason: 'Nilai transaksi tidak tersedia — likuiditas tidak bisa diverifikasi.', condition: `Nilai transaksi terverifikasi ≥ ${fmtIdrValue(MIN_LIQUID_VALUE)}/hari.` }
    : liqValue < MIN_LIQUID_VALUE
      ? { key: 'liquidity', label: 'Liquidity Gate', status: 'FAIL', reason: `Nilai transaksi ${fmtIdrValue(liqValue)} < ${fmtIdrValue(MIN_LIQUID_VALUE)} — rawan digoreng, sulit keluar.`, condition: `Nilai transaksi harian (atau rata-rata 20H) naik ≥ ${fmtIdrValue(MIN_LIQUID_VALUE)}.` }
      : { key: 'liquidity', label: 'Liquidity Gate', status: 'PASS', reason: `Nilai transaksi ${fmtIdrValue(liqValue)} ≥ ${fmtIdrValue(MIN_LIQUID_VALUE)}.`, condition: null });

  const pumpOnWeak = hotLevel === 'TINGGI' && driver.signal === 'red';
  const parabolic = ext20 != null && ext20 >= MAX_EXTENSION_EMA20_PCT;
  gates.push(pumpOnWeak
    ? { key: 'risk', label: 'Risk Gate', status: 'FAIL', reason: `Hot money TINGGI (${hotFlags.length} tanda) tanpa dukungan fundamental.`, condition: 'Tanda spekulasi mereda (RVOL normal, harga kembali dekat EMA 20) atau fundamental membaik.' }
    : parabolic
      ? { key: 'risk', label: 'Risk Gate', status: 'FAIL', reason: `Harga ${sgn(ext20!)} di atas EMA 20 — parabolik, risiko koreksi tajam.`, condition: `Harga terkoreksi ke < ${MAX_EXTENSION_EMA20_PCT}% di atas EMA 20 (idealnya retest EMA 9–20).` }
      : { key: 'risk', label: 'Risk Gate', status: 'PASS', reason: hotLevel === 'RENDAH' ? 'Tidak ada tanda spekulasi berlebihan.' : `Hot money ${hotLevel} — masih dalam batas, kelola posisi lebih kecil.`, condition: null });

  const trendFail = emaStack === 'bearish' || (momentumSignal === 'red' && ok(i.ema50) && price < i.ema50);
  const trendUp = ok(i.ema20) && ok(i.ema50) && price > i.ema20 && i.ema20 > i.ema50;
  gates.push(trendFail
    ? { key: 'trend', label: 'Trend', status: 'FAIL', reason: emaStack === 'bearish' ? 'EMA tersusun turun (harga < EMA 9 < EMA 20 < EMA 50).' : 'Momentum lemah dan harga di bawah EMA 50.', condition: 'Harga kembali di atas EMA 20 & EMA 50 dengan EMA 20 > EMA 50.' }
    : trendUp
      ? { key: 'trend', label: 'Trend', status: 'PASS', reason: 'Harga > EMA 20 > EMA 50 — trend naik.', condition: null }
      : { key: 'trend', label: 'Trend', status: 'PENDING', reason: 'Trend belum jelas (EMA campur / sideways).', condition: 'Harga bertahan di atas EMA 20 dengan EMA 20 > EMA 50.' });

  gates.push(momentumSignal === 'green'
    ? { key: 'momentum', label: 'Momentum', status: 'PASS', reason: `${momentumLabel} (skor ${momentumValue}/100).`, condition: null }
    : { key: 'momentum', label: 'Momentum', status: 'PENDING', reason: `${momentumLabel}${momentumValue != null ? ` (skor ${momentumValue}/100)` : ''}.`, condition: veryLowVolume ? `RVOL kembali ≥ ${n1(RVOL_CONFIRM)}x dengan candle hijau.` : 'Mayoritas indikator momentum (EMA, RSI, MACD, candle) berbalik positif.' });

  const priorFail = gates.some((g) => g.status === 'FAIL');

  // §4 ── Plan (only when no mandatory gate before ENTRY failed)
  const plan = buildPlan(i, {
    gates, priorFail, candle, momentumSignal, emaStack, hotLevel, valuationSignal, ext20, veryLowVolume,
  });
  gates.push(plan.entryGate);

  // ── Consistency check (docs §MANDATORY CONSISTENCY CHECK) ──
  const { entryGate: _entryGate, ...planOut } = plan;
  void _entryGate;
  const hasLevels = planOut.entryLow != null || planOut.sl != null || planOut.targets.length > 0 || planOut.riskReward != null || planOut.sizing.length > 0;
  const volumeClaimed = /Breakout Candle|Bullish Pin Bar|Bullish Marubozu$|Candle Hijau Kuat/.test(candle.pattern);
  const anyFail = gates.some((g) => g.status === 'FAIL');
  const consistency: ConsistencyCheck[] = [
    { label: 'Status AVOID tidak memuat BUY / Entry / TP / SL', passed: planOut.status !== 'AVOID' || !hasLevels },
    { label: 'RVOL sangat rendah tidak disebut konfirmasi volume', passed: !veryLowVolume || (!volumeClaimed && planOut.status !== 'BUY') },
    { label: 'Rugi / PER negatif tidak disebut "Fundamental Solid"', passed: !lossMaking || fundamentalLabel !== 'Fundamental Solid' },
    { label: 'Fair value tidak dipakai sebagai alasan BUY saat gate gagal', passed: !anyFail || planOut.status === 'AVOID' },
    { label: 'Buy Area tidak dianggap otomatis BUY', passed: planOut.status === 'BUY' ? gates.every((g) => g.status === 'PASS') : planOut.planState !== 'active' },
  ];

  // ── Conclusion ──
  const nature = driver.signal === 'green' ? 'momentum organik' : driver.signal === 'red' ? 'pergerakan spekulatif' : 'momentum belum terkonfirmasi fundamental';
  const firstFail = gates.find((g) => g.status === 'FAIL');
  const conclusion = planOut.status === 'AVOID'
    ? `AVOID — ${firstFail?.label ?? 'Gate'} gagal: ${planOut.statusReason}. Tidak ada setup aktif; status baru bisa berubah bila: ${planOut.conditions.join(' ') || 'semua gate wajib terpenuhi.'}`
    : planOut.status === 'BUY'
      ? `BUY — ${nature}: potensi ${sgn(planOut.rewardPct!)} ke TP1 vs risiko −${n1(planOut.riskPct!)}% ke SL (R:R 1:${n1(planOut.riskReward!)}). Eksekusi hanya dengan disiplin SL dan maksimal ${MAX_RISK_PER_TRADE_PCT}% modal.`
      : planOut.planState === 'conditional'
        ? `WAIT — ${planOut.statusReason}. ${SETUP_LABEL[planOut.setup]} hanyalah rencana bersyarat, bukan sinyal BUY; tunggu semua konfirmasi terpenuhi.`
        : `WAIT — ${planOut.statusReason}. Belum ada setup valid; jangan memaksakan entry.`;

  return {
    gates, scores,
    candle, rvolCheck, positionChecks, emaStack, momentumSignal, momentumLabel,
    driver, liquidity, hotMoney,
    fundamentalLabel, valuationChecks, valuationSignal, valuationLabel, valuationWarnings,
    plan: planOut, consistency, conclusion,
  };
}

function buildPlan(
  i: MomentumInput,
  ctx: {
    gates: Gate[];
    priorFail: boolean;
    candle: CandleRead;
    momentumSignal: MomentumSignal;
    emaStack: MomentumReport['emaStack'];
    hotLevel: 'TINGGI' | 'SEDANG' | 'RENDAH';
    valuationSignal: MomentumSignal;
    ext20: number | null;
    veryLowVolume: boolean;
  },
): MomentumPlan & { entryGate: Gate } {
  const empty = {
    setup: 'NONE' as SetupType, entryLow: null, entryHigh: null, entryTrigger: null, targets: [], sl: null, slBasis: null,
    riskPct: null, rewardPct: null, riskReward: null, validationErrors: [], confirmations: [], riskGate: [], sizing: [],
  };

  // AVOID: a mandatory gate failed → no setup is generated at all.
  if (ctx.priorFail) {
    const failed = ctx.gates.filter((g) => g.status === 'FAIL');
    return {
      ...empty,
      status: 'AVOID',
      statusReason: failed.map((g) => g.reason.replace(/\.$/, '')).join('; '),
      planState: 'none',
      conditions: failed.map((g) => g.condition).filter((c): c is string => Boolean(c)),
      entryGate: { key: 'entry', label: 'Entry Confirmation', status: 'SKIPPED', reason: 'Tidak dievaluasi — ada mandatory gate yang FAIL.', condition: null },
    };
  }

  const price = i.price;
  const atr = ok(i.atr14) ? i.atr14 : null;
  const resistanceAbove = i.resistances.filter((r) => ok(r) && r > price).sort((a, b) => a - b);
  const supportBelow = i.supports.filter((s) => ok(s) && s < price).sort((a, b) => b - a);
  const r1 = resistanceAbove[0] ?? null;
  const s1 = supportBelow[0] ?? null;

  // Setup selection:
  //  • Breakout — price is coiled within 3% under R1 and momentum isn't weak.
  //  • Pullback — strong trend but extended > 5% above EMA20 → wait for EMA9/EMA20 retest.
  //  • Support — otherwise near the nearest technical floor (EMA20 or S1, whichever is higher below price).
  const nearR1 = r1 != null && pctDiff(r1, price) <= 3;
  const extended = ctx.ext20 != null && ctx.ext20 > 5;
  const emaFloor = [i.ema20, i.ema9].filter((x): x is number => ok(x) && x < price);
  const floor = Math.max(s1 ?? 0, ...emaFloor) || null;

  let setup: SetupType = 'NONE';
  let entryLow: number | null = null;
  let entryHigh: number | null = null;
  let entryTrigger: string | null = null;
  let breakout: number | null = null;

  if (r1 != null && nearR1 && ctx.momentumSignal !== 'red') {
    setup = 'BREAKOUT';
    breakout = roundToTick(r1);
    entryLow = breakout;
    entryHigh = roundToTick(breakout * (1 + MAX_CHASE_PCT / 100));
    entryTrigger = `Valid hanya bila close / bertahan di atas ${rp(breakout)} dengan RVOL ≥ ${n1(RVOL_ANOMALY)}x. Jangan kejar di atas ${rp(entryHigh)}.`;
  } else if (extended && ctx.emaStack === 'bullish' && ok(i.ema9) && ok(i.ema20)) {
    setup = 'PULLBACK';
    entryLow = roundToTick(Math.min(i.ema9, i.ema20));
    entryHigh = roundToTick(Math.max(i.ema9, i.ema20));
    entryTrigger = `Harga sudah ${sgn(ctx.ext20!)} di atas EMA 20 — valid hanya setelah pullback ke area EMA 9–20 dan candle pantulan hijau bervolume.`;
  } else if (floor != null) {
    setup = 'SUPPORT';
    entryLow = roundToTick(floor);
    entryHigh = roundToTick(Math.min(price, floor * 1.02));
    if (entryHigh < entryLow) entryHigh = entryLow;
    entryTrigger = `Valid hanya bila di area ${rp(entryLow)}${entryHigh > entryLow ? `–${rp(entryHigh)}` : ''} muncul candle pantulan (hammer / bullish engulfing) dengan RVOL ≥ ${n1(RVOL_CONFIRM)}x.`;
  }

  // Tight technical SL: the highest invalidation level below the entry zone, padded 1% (or 0,5 ATR).
  let sl: number | null = null;
  let slBasis: string | null = null;
  if (entryLow != null) {
    const pad = (lvl: number) => roundToTick(atr != null ? Math.min(lvl * 0.99, lvl - atr * 0.5) : lvl * 0.99);
    const candidates: Array<[number, string]> = [];
    if (setup === 'BREAKOUT') {
      // A failed breakout is invalidated back under the low of the breakout zone / EMA9.
      if (ok(i.ema9) && i.ema9 < entryLow) candidates.push([i.ema9, 'EMA 9']);
      if (s1 != null && s1 < entryLow) candidates.push([s1, 'support terdekat']);
    } else {
      candidates.push(
        ...supportBelow.filter((s) => s < entryLow!).map((s): [number, string] => [s, 'support berikutnya']),
        ...(ok(i.ema50) && i.ema50 < entryLow ? [[i.ema50, 'EMA 50'] as [number, string]] : []),
        ...(setup === 'PULLBACK' && ok(i.ema20) && i.ema20 <= entryLow ? [[i.ema20, 'EMA 20'] as [number, string]] : []),
      );
    }
    const best = candidates.filter(([lvl]) => pctDiff(entryLow!, lvl) <= MAX_SL_DISTANCE_PCT).sort((a, b) => b[0] - a[0])[0];
    if (best) {
      sl = pad(best[0]);
      slBasis = `Close < ${rp(sl)} — di bawah ${best[1]} ${rp(best[0])}${atr != null ? ' (buffer 0,5 ATR)' : ''}.`;
    } else if (atr != null) {
      sl = roundToTick(entryLow - atr * 1.5);
      slBasis = `Close < ${rp(sl)} — 1,5× ATR (${rp(atr)}) di bawah entry; tidak ada support teknikal dalam ${MAX_SL_DISTANCE_PCT}%.`;
    }
  }

  // Entry used for risk/reward: the breakout trigger itself for breakouts (entryHigh is only the "don't chase" cap),
  // the conservative top of the zone otherwise.
  const entry = setup === 'BREAKOUT' ? entryLow : entryHigh;

  // Targets: resistances above the entry zone first; R-multiple projections only when resistances run out (labelled as such).
  const targets: PlanTarget[] = [];
  if (entry != null && entryHigh != null) {
    pickTargets(i.resistances, entryHigh).forEach((p) => targets.push({ label: '', price: p, gainPct: pctDiff(p, entry), basis: 'Resistance' }));
    const risk = sl != null ? entry - sl : null;
    for (const m of [1.5, 2.5, 4]) {
      if (targets.length >= 3 || risk == null || risk <= 0) break;
      const p = roundToTick(entry + risk * m);
      if (p > entryHigh && (targets.length === 0 || p > targets[targets.length - 1].price)) {
        targets.push({ label: '', price: p, gainPct: pctDiff(p, entry), basis: `Proyeksi ${n1(m)}R (tidak ada resistance)` });
      }
    }
    targets.forEach((t, idx) => { t.label = `TP${idx + 1}`; });
  }

  const levels: PlanLevels = { side: 'LONG', entry, tp1: targets[0]?.price ?? null, tp2: targets[1]?.price ?? null, tp3: targets[2]?.price ?? null, sl, breakout };
  const validationErrors = entry != null ? validatePlanLevels(levels) : [];
  const riskPct = entry != null && sl != null ? pctDiff(entry, sl) : null;
  const rewardPct = targets[0]?.gainPct ?? null;
  const riskReward = riskPct != null && rewardPct != null && riskPct > 0 ? rewardPct / riskPct : null;

  // Mandatory entry confirmations — BUY needs every one of them (plus every earlier gate PASS).
  // Same 0,5% tolerance on both edges: entryHigh is tick-rounded and can land just under a price that caps the zone.
  const inZone = entryLow != null && entryHigh != null && price >= entryLow * 0.995 && price <= entryHigh * 1.005;
  const volumeConfirmed = ok(i.rvol) && i.rvol >= (setup === 'BREAKOUT' ? RVOL_ANOMALY : RVOL_CONFIRM);
  const setupValid = setup !== 'NONE' && sl != null && validationErrors.length === 0 && riskPct != null && riskPct <= MAX_SL_DISTANCE_PCT;
  const confirmations: Array<{ label: string; ok: boolean }> = [
    { label: 'Setup & level invalidasi (SL) valid', ok: setup !== 'NONE' && sl != null && validationErrors.length === 0 },
    { label: `Jarak SL ≤ ${MAX_SL_DISTANCE_PCT}%`, ok: riskPct != null && riskPct <= MAX_SL_DISTANCE_PCT },
    { label: `R:R ke TP1 ≥ 1:${n1(MIN_RISK_REWARD)}`, ok: riskReward != null && riskReward >= MIN_RISK_REWARD },
    { label: setup === 'BREAKOUT' ? 'Harga sudah menembus level breakout (belum terlalu jauh)' : 'Harga berada di area entry', ok: inZone },
    { label: setup === 'BREAKOUT' ? `Volume breakout RVOL ≥ ${n1(RVOL_ANOMALY)}x` : `Volume konfirmasi RVOL ≥ ${n1(RVOL_CONFIRM)}x`, ok: volumeConfirmed },
    { label: 'Candle konfirmasi bullish bervolume', ok: ctx.candle.signal === 'green' },
    { label: ok(i.vwap) ? 'Harga ≥ VWAP intraday' : 'VWAP (tidak tersedia — dilewati)', ok: !ok(i.vwap) || price >= i.vwap },
    { label: 'RSI belum overbought (< 75)', ok: !finite(i.rsi14) || i.rsi14 < 75 },
  ];
  const firstMissing = confirmations.find((c) => !c.ok);
  const otherGatesPass = ctx.gates.every((g) => g.status === 'PASS');
  const pendingGate = ctx.gates.find((g) => g.status === 'PENDING');

  const entryGate: Gate = !firstMissing
    ? { key: 'entry', label: 'Entry Confirmation', status: 'PASS', reason: `${SETUP_LABEL[setup]} terkonfirmasi — semua konfirmasi wajib terpenuhi.`, condition: null }
    : { key: 'entry', label: 'Entry Confirmation', status: 'PENDING', reason: `Belum terpenuhi: ${firstMissing.label}.`, condition: setup === 'NONE' ? 'Muncul setup breakout / support / pullback dengan level SL yang jelas.' : entryTrigger };

  const status: MomentumStatus = otherGatesPass && entryGate.status === 'PASS' ? 'BUY' : 'WAIT';
  const statusReason = status === 'BUY'
    ? `${SETUP_LABEL[setup]} — semua mandatory gate PASS`
    : pendingGate ? `${pendingGate.label}: ${pendingGate.reason.replace(/\.$/, '')}` : entryGate.reason.replace(/\.$/, '');
  const planState: MomentumPlan['planState'] = status === 'BUY' ? 'active' : setupValid ? 'conditional' : 'none';

  // WAIT without a valid setup: no levels (docs rule 10).
  if (planState === 'none') {
    return {
      ...empty,
      status, statusReason, planState,
      confirmations,
      conditions: [
        ...ctx.gates.filter((g) => g.status === 'PENDING').map((g) => g.condition).filter((c): c is string => Boolean(c)),
        entryGate.condition,
      ].filter((c): c is string => Boolean(c)),
      entryGate,
    };
  }

  const riskGate = [
    `Risiko maksimal ${MAX_RISK_PER_TRADE_PCT}% modal per transaksi (intraday ${n1(MAX_RISK_PER_TRADE_INTRADAY_PCT)}%) — ukuran lot dihitung dari jarak Entry → SL.`,
    sl != null ? `Wajib cut loss bila close < ${rp(sl)} — tanpa averaging down.` : null,
    entryHigh != null ? `Jangan kejar bila harga > ${rp(entryHigh)} (lebih dari batas atas area entry).` : null,
    ok(i.vwap) ? `Intraday: tidak entry selama harga < VWAP ${rp(i.vwap)}.` : null,
    ctx.hotLevel !== 'RENDAH' ? 'Indikasi spekulasi — ambil profit bertahap di TP1, naikkan SL ke entry (break-even).' : null,
    ctx.valuationSignal === 'red' ? 'Valuasi mahal — perlakukan sebagai trading jangka pendek, bukan investasi.' : null,
  ].filter((x): x is string => Boolean(x));

  const sizing = [10e6, 100e6].map((capital) => {
    const maxLoss = capital * (MAX_RISK_PER_TRADE_PCT / 100);
    const perShare = entry != null && sl != null ? entry - sl : null;
    const byRisk = perShare != null && perShare > 0 ? Math.floor(maxLoss / perShare / 100) : null;
    const byCash = entryHigh != null ? Math.floor(capital / entryHigh / 100) : null;
    return { capital, maxLoss, maxLot: byRisk != null && byCash != null ? Math.min(byRisk, byCash) : null };
  });

  return {
    status, statusReason, planState, setup, entryLow, entryHigh, entryTrigger, targets, sl, slBasis,
    riskPct, rewardPct, riskReward, validationErrors, confirmations,
    conditions: status === 'BUY' ? [] : confirmations.filter((c) => !c.ok).map((c) => c.label),
    riskGate, sizing, entryGate,
  };
}
