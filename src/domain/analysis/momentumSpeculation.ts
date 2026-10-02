/**
 * momentumSpeculation.ts
 *
 * "EzySaham AI" momentum vs speculation report (features_momentum.md):
 *   1. Deteksi momentum & price action — candlestick, RVOL, posisi harga vs VWAP / EMA 9 / 20 / 50.
 *   2. Anomali & aksi spekulasi — organik vs momentum chasing, likuiditas (< Rp 1 M = rawan digoreng), hot money.
 *   3. Valuasi & value trap — PER/PBV mahal saat teknikal hijau, kenaikan tidak sejalan fundamental.
 *   4. Actionable trading plan — BUY / WAIT / AVOID, Entry, TP1–TP3, SL teknikal, Risk Gate.
 *
 * Pure & deterministic: every verdict is derived from the numbers passed in. A missing input yields `null` /
 * an "na" signal — never a guessed value. Price levels shown as orders snap to valid IDX ticks.
 */

import { roundToTick } from '@/domain/analysis/idxTick';
import { pickTargets, PlanLevels, validatePlanLevels } from '@/domain/analysis/tradingModesReview';
import { OHLCVBar } from '@/domain/models/History';

export type MomentumSignal = 'green' | 'yellow' | 'red' | 'na';
export type MomentumStatus = 'BUY' | 'WAIT' | 'AVOID';

/** Liquidity floor from features_momentum.md: daily traded value < Rp 1 M is thin and easy to "goreng". */
export const MIN_LIQUID_VALUE = 1e9;
/** Comfortable liquidity for swing size positions. */
export const GOOD_LIQUID_VALUE = 10e9;
/** RVOL at/above this is an anomaly / strong market interest (features_momentum.md §1). */
export const RVOL_ANOMALY = 1.5;
/** Max equity risked per trade — the Risk Gate. Intraday is half of swing. */
export const MAX_RISK_PER_TRADE_PCT = 1;
export const MAX_RISK_PER_TRADE_INTRADAY_PCT = 0.5;
/** SL wider than this from entry is not a "tight" technical stop → no BUY. */
export const MAX_SL_DISTANCE_PCT = 8;
/** Don't chase: price more than this above the entry level invalidates the entry. */
export const MAX_CHASE_PCT = 3;

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

export interface MomentumPlan {
  status: MomentumStatus;
  statusReason: string;
  setup: 'BUY ON BREAKOUT' | 'BUY ON SUPPORT' | 'BUY ON PULLBACK' | 'TIDAK ADA SETUP';
  entryLow: number | null;
  entryHigh: number | null;
  entryTrigger: string;
  targets: PlanTarget[];
  sl: number | null;
  slBasis: string;
  riskPct: number | null;
  rewardPct: number | null;
  riskReward: number | null;
  validationErrors: string[];
  riskGate: string[];
  /** Max lot for a Rp 10 jt / 100 jt account at MAX_RISK_PER_TRADE_PCT. */
  sizing: Array<{ capital: number; maxLoss: number; maxLot: number | null }>;
}

export interface MomentumReport {
  // §1
  candle: CandleRead;
  rvolCheck: Check;
  positionChecks: Check[];
  emaStack: 'bullish' | 'bearish' | 'mixed' | 'na';
  momentumScore: number;
  momentumMax: number;
  momentumSignal: MomentumSignal;
  momentumLabel: string;
  // §2
  driver: { signal: MomentumSignal; label: string; reasons: string[] };
  liquidity: Check;
  hotMoney: { level: 'TINGGI' | 'SEDANG' | 'RENDAH'; signal: MomentumSignal; flags: string[] };
  // §3
  valuationChecks: Check[];
  valuationSignal: MomentumSignal;
  valuationLabel: string;
  valuationWarnings: string[];
  // §4
  plan: MomentumPlan;
  conclusion: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

const ok = (n: number | null | undefined): n is number => n != null && Number.isFinite(n) && n > 0;
const finite = (n: number | null | undefined): n is number => n != null && Number.isFinite(n);
const pctDiff = (a: number, b: number) => ((a - b) / b) * 100;
const n1 = (n: number, dec = 1) => n.toLocaleString('id-ID', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const rp = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;
const sgn = (n: number, dec = 1) => `${n > 0 ? '+' : ''}${n1(n, dec)}%`;

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

/** Reads the last daily candle: Marubozu, Pin Bar (hammer / shooting star), Doji, Breakout / Breakdown candle. */
export function readCandle(bars: OHLCVBar[]): CandleRead {
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

  // Breakout: close above the highest high of the previous 20 sessions with a real body.
  const prior = bars.slice(-21, -1);
  const priorHigh = prior.length >= 10 ? Math.max(...prior.map((b) => b.high)) : null;
  const priorLow = prior.length >= 10 ? Math.min(...prior.map((b) => b.low)) : null;
  const base = { buyerPower, bodyPct, upperWickPct, lowerWickPct };

  if (priorHigh != null && green && last.close > priorHigh && bodyPct >= 50) {
    return { ...base, pattern: 'Breakout Candle', emoji: '🚀', signal: 'green', note: `Close ${rp(last.close)} menembus high 20 hari ${rp(priorHigh)} dengan body ${n1(bodyPct, 0)}% — buyer agresif.` };
  }
  if (priorLow != null && red && last.close < priorLow && bodyPct >= 50) {
    return { ...base, pattern: 'Breakdown Candle', emoji: '🔻', signal: 'red', note: `Close ${rp(last.close)} jebol low 20 hari ${rp(priorLow)} — seller dominan.` };
  }
  if (bodyPct >= 85) {
    return green
      ? { ...base, pattern: 'Bullish Marubozu', emoji: '🟢', signal: 'green', note: 'Hampir tanpa shadow — buyer menguasai sesi dari open sampai close.' }
      : { ...base, pattern: 'Bearish Marubozu', emoji: '🔴', signal: 'red', note: 'Hampir tanpa shadow — seller menguasai sesi dari open sampai close.' };
  }
  if (bodyPct <= 10) {
    return { ...base, pattern: 'Doji', emoji: '🟡', signal: 'yellow', note: 'Body sangat kecil — buyer & seller seimbang, tunggu konfirmasi candle berikutnya.' };
  }
  if (lower >= 2 * body && upperWickPct <= 25) {
    return { ...base, pattern: 'Bullish Pin Bar (Hammer)', emoji: '📌', signal: 'green', note: `Lower shadow ${n1(lowerWickPct, 0)}% dari range — tekanan jual ditolak, buyer masuk di bawah.` };
  }
  if (upper >= 2 * body && lowerWickPct <= 25) {
    return { ...base, pattern: 'Bearish Pin Bar (Shooting Star)', emoji: '📍', signal: 'red', note: `Upper shadow ${n1(upperWickPct, 0)}% dari range — kenaikan ditolak, indikasi distribusi / profit taking.` };
  }
  if (green) {
    return buyerPower >= 70
      ? { ...base, pattern: 'Candle Hijau Kuat', emoji: '🟢', signal: 'green', note: `Close di ${n1(buyerPower, 0)}% range harian — buyer dominan.` }
      : { ...base, pattern: 'Candle Hijau', emoji: '🟡', signal: 'yellow', note: `Close di ${n1(buyerPower, 0)}% range — buyer menang tipis, ada tekanan jual di atas.` };
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

  // §1 ── Candle, RVOL, position vs VWAP / EMA
  const candle = readCandle(i.bars);

  const rvolCheck: Check = !ok(i.rvol)
    ? { label: 'RVOL', value: '—', signal: 'na', note: 'Volume rata-rata tidak tersedia.' }
    : i.rvol >= RVOL_ANOMALY
      ? { label: 'RVOL', value: `${n1(i.rvol, 2)}x`, signal: 'green', note: `⚡ Anomali volume (≥ ${n1(RVOL_ANOMALY)}x) — minat pasar kuat${candle.signal === 'red' ? ', tetapi candle merah: tekanan jual bervolume' : ''}.` }
      : i.rvol >= 1
        ? { label: 'RVOL', value: `${n1(i.rvol, 2)}x`, signal: 'yellow', note: 'Volume normal — belum ada anomali.' }
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

  // Momentum score: candle + RVOL (only with candle direction) + 4 position checks + EMA stack + RSI + MACD.
  const votes: Array<number | null> = [
    candle.signal === 'green' ? 1 : candle.signal === 'red' ? -1 : candle.signal === 'na' ? null : 0,
    !ok(i.rvol) ? null : i.rvol >= RVOL_ANOMALY ? (candle.signal === 'green' ? 1 : candle.signal === 'red' ? -1 : 0) : 0,
    ...positionChecks.map((c) => (c.signal === 'green' ? 1 : c.signal === 'red' ? -1 : c.signal === 'na' ? null : 0)),
    emaStack === 'bullish' ? 1 : emaStack === 'bearish' ? -1 : emaStack === 'na' ? null : 0,
    !finite(i.rsi14) ? null : i.rsi14 >= 55 && i.rsi14 <= 75 ? 1 : i.rsi14 < 45 ? -1 : 0,
    !finite(i.macdHistogram) ? null : i.macdHistogram > 0 ? 1 : i.macdHistogram < 0 ? -1 : 0,
  ];
  const counted = votes.filter((v): v is number => v != null);
  const momentumScore = counted.reduce((s, v) => s + v, 0);
  const momentumMax = counted.length;
  const ratio = momentumMax > 0 ? momentumScore / momentumMax : 0;
  const momentumSignal: MomentumSignal = momentumMax < 4 ? 'na' : ratio >= 0.5 ? 'green' : ratio <= -0.25 ? 'red' : 'yellow';
  const momentumLabel = momentumSignal === 'green' ? 'Momentum Kuat' : momentumSignal === 'red' ? 'Momentum Lemah' : momentumSignal === 'yellow' ? 'Momentum Netral' : 'Data kurang';

  // §2 ── Driver (organic vs chasing), liquidity, hot money
  const eg = i.earningsGrowth;
  const rg = i.revenueGrowth;
  const fundamentalsKnown = finite(eg) || finite(rg) || finite(i.roe);
  const solidFundamental = (finite(eg) ? eg > 0 : true) && (finite(rg) ? rg > 0 : true) && (finite(i.roe) ? i.roe >= 10 : true) && fundamentalsKnown;
  const weakFundamental = (finite(eg) && eg < 0) || (finite(i.per) && i.per < 0) || (finite(i.roe) && i.roe < 5);
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
  ].filter((x): x is string => Boolean(x));
  const driver = !fundamentalsKnown
    ? { signal: 'na' as const, label: 'Fundamental tidak tersedia — kenaikan tidak bisa dikonfirmasi organik', reasons: driverReasons }
    : solidFundamental && !overvalued
      ? { signal: 'green' as const, label: strongRun ? 'Momentum didukung fundamental (organik)' : 'Fundamental solid — momentum organik', reasons: driverReasons }
      : weakFundamental && strongRun
        ? { signal: 'red' as const, label: 'Short-term momentum chasing / FOMO — fundamental tidak mendukung', reasons: driverReasons }
        : weakFundamental
          ? { signal: 'red' as const, label: 'Fundamental lemah — pergerakan rawan spekulatif', reasons: driverReasons }
          : { signal: 'yellow' as const, label: strongRun ? 'Campuran — fundamental cukup, tapi harga sudah lari / valuasi mahal' : 'Campuran — belum ada pendorong yang dominan', reasons: driverReasons };

  // Use the larger of today's value and the 20-day average value proxy so one quiet session doesn't flag a liquid stock.
  const avgValue = ok(i.volumeMa20) ? i.volumeMa20 * price : null;
  const liqValue = ok(i.tradedValue) ? i.tradedValue : avgValue;
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

  // §3 ── Valuation & value trap
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
        return { label: 'Nilai wajar', value: `${rp(i.fairValue)} (${sgn(gap)})`, signal: (gap >= 10 ? 'green' : gap >= -10 ? 'yellow' : 'red') as MomentumSignal, note: gap >= 0 ? 'Harga di bawah estimasi nilai wajar.' : 'Harga sudah di atas estimasi nilai wajar.' };
      })()
      : { label: 'Nilai wajar', value: '—', signal: 'na', note: 'Estimasi nilai wajar tidak tersedia.' },
  ];
  const redVal = valuationChecks.filter((c) => c.signal === 'red').length;
  const greenVal = valuationChecks.filter((c) => c.signal === 'green').length;
  const knownVal = valuationChecks.filter((c) => c.signal !== 'na').length;
  const valuationSignal: MomentumSignal = knownVal === 0 ? 'na' : overvalued || redVal >= 2 ? 'red' : greenVal >= 2 && redVal === 0 ? 'green' : 'yellow';
  const valuationLabel = valuationSignal === 'red' ? 'Overvalued' : valuationSignal === 'green' ? 'Murah / Undervalued' : valuationSignal === 'yellow' ? 'Wajar' : 'Tidak dapat dinilai';

  const technicalGreen = momentumSignal === 'green' || strongRun;
  const cheapLooking = (finite(i.per) && i.per > 0 && i.per < 8) || (finite(i.pbv) && i.pbv > 0 && i.pbv < 1);
  const valuationWarnings = [
    technicalGreen && valuationSignal === 'red' && '🔴 Momentum hijau tetapi valuasi sudah mahal — risiko profit taking / koreksi tajam saat momentum habis.',
    technicalGreen && weakFundamental && '🔴 Kenaikan harga tidak sejalan fundamental (laba turun / rugi / ROE rendah) — kenaikan rawan dibalik.',
    cheapLooking && finite(eg) && eg < 0 && `🟡 Risiko value trap: terlihat murah (PER/PBV rendah) tetapi laba turun ${sgn(eg)} YoY — murah bisa karena memang memburuk.`,
    ok(i.annualHigh) && pctDiff(price, i.annualHigh) >= -3 && strongRun && '🟡 Harga dekat high 1 tahun setelah reli — area rawan distribusi.',
  ].filter((x): x is string => Boolean(x));

  // §4 ── Plan
  const plan = buildPlan(i, { candle, momentumSignal, emaStack, liqValue, hotLevel, driverSignal: driver.signal, valuationSignal, ext20 });

  const potential = plan.rewardPct != null ? `potensi ${sgn(plan.rewardPct)} ke TP1` : 'potensi belum terukur';
  const risk = plan.riskPct != null ? `risiko −${n1(plan.riskPct)}% ke SL` : 'risiko belum terukur';
  const rr = plan.riskReward != null ? ` (R:R 1:${n1(plan.riskReward)})` : '';
  const nature = driver.signal === 'green' ? 'momentum organik' : driver.signal === 'red' ? 'pergerakan spekulatif' : 'momentum belum terkonfirmasi fundamental';
  const conclusion = plan.status === 'AVOID'
    ? `${nature[0].toUpperCase()}${nature.slice(1)} dengan ${plan.statusReason.toLowerCase()} — risiko lebih besar dari potensi, lebih baik dihindari.`
    : plan.status === 'BUY'
      ? `${nature[0].toUpperCase()}${nature.slice(1)}: ${potential} vs ${risk}${rr} — layak dieksekusi hanya dengan disiplin SL dan maksimal ${MAX_RISK_PER_TRADE_PCT}% modal.`
      : `${nature[0].toUpperCase()}${nature.slice(1)}: ${potential} vs ${risk}${rr}, tetapi trigger belum terpenuhi — tunggu konfirmasi, jangan antisipasi.`;

  return {
    candle, rvolCheck, positionChecks, emaStack, momentumScore, momentumMax, momentumSignal, momentumLabel,
    driver, liquidity, hotMoney,
    valuationChecks, valuationSignal, valuationLabel, valuationWarnings,
    plan, conclusion,
  };
}

function buildPlan(
  i: MomentumInput,
  ctx: {
    candle: CandleRead;
    momentumSignal: MomentumSignal;
    emaStack: MomentumReport['emaStack'];
    liqValue: number | null;
    hotLevel: 'TINGGI' | 'SEDANG' | 'RENDAH';
    driverSignal: MomentumSignal;
    valuationSignal: MomentumSignal;
    ext20: number | null;
  },
): MomentumPlan {
  const price = i.price;
  const atr = ok(i.atr14) ? i.atr14 : null;
  const resistanceAbove = i.resistances.filter((r) => ok(r) && r > price).sort((a, b) => a - b);
  const supportBelow = i.supports.filter((s) => ok(s) && s < price).sort((a, b) => b - a);
  const r1 = resistanceAbove[0] ?? null;
  const s1 = supportBelow[0] ?? null;

  // Setup selection:
  //  • Breakout — price is coiled within 3% under R1 and momentum isn't weak.
  //  • Pullback — strong trend but extended > 5% above EMA20 → wait for EMA9/EMA20 retest.
  //  • Support — otherwise buy near the nearest technical floor (EMA20 or S1, whichever is higher below price).
  const nearR1 = r1 != null && pctDiff(r1, price) <= 3;
  const extended = ctx.ext20 != null && ctx.ext20 > 5;
  const emaFloor = [i.ema20, i.ema9].filter((x): x is number => ok(x) && x < price);
  const floor = Math.max(s1 ?? 0, ...emaFloor) || null;

  let setup: MomentumPlan['setup'] = 'TIDAK ADA SETUP';
  let entryLow: number | null = null;
  let entryHigh: number | null = null;
  let entryTrigger = 'Tidak ada level teknikal yang valid untuk entry.';
  let breakout: number | null = null;

  if (r1 != null && nearR1 && ctx.momentumSignal !== 'red') {
    setup = 'BUY ON BREAKOUT';
    breakout = roundToTick(r1);
    entryLow = breakout;
    entryHigh = roundToTick(breakout * (1 + MAX_CHASE_PCT / 100));
    entryTrigger = `Close / bertahan di atas ${rp(breakout)} dengan RVOL ≥ ${n1(RVOL_ANOMALY)}x. Jangan kejar di atas ${rp(entryHigh)}.`;
  } else if (extended && ctx.emaStack === 'bullish' && ok(i.ema9) && ok(i.ema20)) {
    setup = 'BUY ON PULLBACK';
    entryLow = roundToTick(Math.min(i.ema9, i.ema20));
    entryHigh = roundToTick(Math.max(i.ema9, i.ema20));
    entryTrigger = `Harga sudah ${sgn(ctx.ext20!)} di atas EMA 20 — tunggu pullback ke area EMA 9–20 dan candle pantulan hijau.`;
  } else if (floor != null) {
    setup = 'BUY ON SUPPORT';
    entryLow = roundToTick(floor);
    entryHigh = roundToTick(Math.min(price, floor * 1.02));
    if (entryHigh < entryLow) entryHigh = entryLow;
    entryTrigger = `Beli di area support ${rp(entryLow)}${entryHigh > entryLow ? `–${rp(entryHigh)}` : ''} hanya bila muncul candle pantulan (hammer / bullish engulfing) dengan volume.`;
  }

  // Tight technical SL: the highest invalidation level below the entry zone, padded 1% (or 0,5 ATR).
  let sl: number | null = null;
  let slBasis = 'Tidak ada level invalidasi teknikal.';
  if (entryLow != null) {
    const pad = (lvl: number) => roundToTick(atr != null ? Math.min(lvl * 0.99, lvl - atr * 0.5) : lvl * 0.99);
    const candidates: Array<[number, string]> = [];
    if (setup === 'BUY ON BREAKOUT') {
      // A failed breakout is invalidated back under the low of the breakout zone / EMA9.
      if (ok(i.ema9) && i.ema9 < entryLow) candidates.push([i.ema9, 'EMA 9']);
      if (s1 != null && s1 < entryLow) candidates.push([s1, 'support terdekat']);
    } else {
      const below = [
        ...supportBelow.filter((s) => s < entryLow!).map((s): [number, string] => [s, 'support berikutnya']),
        ...(ok(i.ema50) && i.ema50 < entryLow ? [[i.ema50, 'EMA 50'] as [number, string]] : []),
        ...(setup === 'BUY ON PULLBACK' && ok(i.ema20) && i.ema20 <= entryLow ? [[i.ema20, 'EMA 20'] as [number, string]] : []),
      ];
      candidates.push(...below);
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
  const entry = setup === 'BUY ON BREAKOUT' ? entryLow : entryHigh;

  // Targets: resistances above the entry zone first; R-multiple projections only when resistances run out (labelled as such).
  const targets: PlanTarget[] = [];
  if (entry != null && entryHigh != null) {
    const res = pickTargets(i.resistances, entryHigh);
    res.forEach((p) => targets.push({ label: '', price: p, gainPct: pctDiff(p, entry), basis: 'Resistance' }));
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

  // Status: AVOID on hard red flags, BUY only when every gate is green, WAIT otherwise.
  const illiquid = ctx.liqValue != null && ctx.liqValue < MIN_LIQUID_VALUE;
  const downtrend = ctx.emaStack === 'bearish' || (ctx.momentumSignal === 'red' && ok(i.ema50) && price < i.ema50);
  const pumpOnWeak = ctx.hotLevel === 'TINGGI' && ctx.driverSignal === 'red';
  const inZone = entryLow != null && entryHigh != null && price >= entryLow * 0.995 && price <= entryHigh;
  const breakoutConfirmed = setup !== 'BUY ON BREAKOUT' || (breakout != null && price >= breakout && ok(i.rvol) && i.rvol >= RVOL_ANOMALY);
  const vwapOk = !ok(i.vwap) || price >= i.vwap;

  let status: MomentumStatus;
  let statusReason: string;
  if (illiquid) { status = 'AVOID'; statusReason = 'Likuiditas di bawah Rp 1 M'; }
  else if (pumpOnWeak) { status = 'AVOID'; statusReason = 'Indikasi hot money tinggi tanpa dukungan fundamental'; }
  else if (downtrend) { status = 'AVOID'; statusReason = 'Struktur EMA bearish / momentum lemah di bawah EMA 50'; }
  else if (setup === 'TIDAK ADA SETUP' || sl == null) { status = 'WAIT'; statusReason = 'Belum ada level entry & invalidasi yang valid'; }
  else if (validationErrors.length > 0) { status = 'WAIT'; statusReason = 'Level plan tidak valid'; }
  else if (riskPct != null && riskPct > MAX_SL_DISTANCE_PCT) { status = 'WAIT'; statusReason = `Jarak SL ${n1(riskPct)}% terlalu lebar`; }
  else if (riskReward != null && riskReward < 1.5) { status = 'WAIT'; statusReason = `R:R 1:${n1(riskReward)} di bawah 1:1,5`; }
  else if (!inZone) { status = 'WAIT'; statusReason = setup === 'BUY ON BREAKOUT' ? 'Harga belum menembus level breakout' : 'Harga belum masuk area entry'; }
  else if (!breakoutConfirmed) { status = 'WAIT'; statusReason = 'Breakout belum dikonfirmasi volume (RVOL < 1,5x)'; }
  else if (!vwapOk) { status = 'WAIT'; statusReason = 'Harga masih di bawah VWAP'; }
  else if (ctx.momentumSignal !== 'green' && ctx.candle.signal !== 'green') { status = 'WAIT'; statusReason = 'Momentum & candle belum mengonfirmasi'; }
  else if (finite(i.rsi14) && i.rsi14 >= 75) { status = 'WAIT'; statusReason = 'RSI overbought — tunggu pendinginan'; }
  else { status = 'BUY'; statusReason = 'Harga di area entry dengan konfirmasi momentum'; }

  const riskGate = [
    `Risiko maksimal ${MAX_RISK_PER_TRADE_PCT}% modal per transaksi (intraday ${n1(MAX_RISK_PER_TRADE_INTRADAY_PCT)}%) — ukuran lot dihitung dari jarak Entry → SL.`,
    sl != null ? `Wajib cut loss bila close < ${rp(sl)} — tanpa averaging down.` : 'Tanpa SL yang jelas = tidak entry.',
    entryHigh != null ? `Jangan kejar bila harga > ${rp(entryHigh)} (lebih dari batas atas area entry).` : null,
    `Tidak entry bila nilai transaksi < Rp 1 M atau RVOL breakout < ${n1(RVOL_ANOMALY)}x.`,
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

  return { status, statusReason, setup, entryLow, entryHigh, entryTrigger, targets, sl, slBasis, riskPct, rewardPct, riskReward, validationErrors, riskGate, sizing };
}
