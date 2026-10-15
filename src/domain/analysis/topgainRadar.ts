/**
 * topgainRadar.ts
 *
 * Radar saham panas (docs/features_topgain_radar.md): ranks stocks by how many pre-topgain conditions they show at
 * the last close, to watch on the next trading day. Score = Σ ln(lift) of the conditions met; weights come from the
 * 6-month study (15 Apr – 15 Okt 2026). Backtest: the top 20 hold ~1 of the next day's Top 5 on average — a watch
 * list, not a BUY signal (median t+1 after a topgain is −2%).
 *
 * Pure — the caller fetches the data (Pasardana snapshot + 1-year daily bars).
 */

import { computeDataFreshness } from '@/domain/analysis/dataFreshness';
import { priorHigh } from '@/domain/history/breakoutEvents';
import { computeRvolSeries } from '@/domain/history/volumeEvents';
import { atr } from '@/domain/indicators/atr';
import { closes, ema } from '@/domain/indicators/movingAverages';
import { rsi } from '@/domain/indicators/rsi';
import { OHLCVBar } from '@/domain/models/History';
import { StockSummary } from '@/domain/models/Stock';

/** Topgain = up ≥ 10% in a day (used for "pernah topgain dalam 20 hari"). */
const GAIN = 0.1;
/** Default liquidity filter: 20-day average value ≥ Rp0,5 M. */
export const RADAR_MIN_AVG_VALUE = 0.5e9;
export const RADAR_TOP_N = 20;
const MIN_BARS = 60;
/** IDX session ends 16:00 WIB; before that today's bar is a live price, not a close. */
const CLOSE_HOUR_WIB = 16;

/** Conditions measured on the last close (t−1 relative to the day being watched). */
export interface RadarFeatures {
  close: number;
  changePct: number;
  rsi: number;
  /** close / EMA20 − 1 */
  distEma20: number;
  emaUp: boolean | null;
  ret5: number;
  ret20: number;
  distLow1y: number;
  distHigh1y: number;
  rvol: number;
  rvol5: number;
  atrRatio: number;
  range10: number;
  distHigh20: number;
  topgain20: boolean;
  avgValue20: number;
  capitalization: number;
  freeFloat: number;
}

export interface RadarCondition {
  label: string;
  /** ln(lift) from the 6-month study; negative = makes a topgain less likely. */
  weight: number;
  test: (f: RadarFeatures) => boolean;
}

const fin = Number.isFinite;

/** Weights: docs/features_topgain_radar.md, 103.406 stock-days, base rate 1,71%. */
export const RADAR_CONDITIONS: RadarCondition[] = [
  { label: 'Harga < 200 (ARA 35%)', weight: 0.19, test: (f) => f.close < 200 },
  { label: 'Harga 200–500', weight: -0.02, test: (f) => f.close >= 200 && f.close < 500 },
  { label: 'Harga 500–5.000', weight: -0.23, test: (f) => f.close >= 500 && f.close <= 5000 },
  { label: 'Harga > 5.000', weight: -0.23, test: (f) => f.close > 5000 },
  { label: 'Kapitalisasi < Rp1 T', weight: 0.15, test: (f) => f.capitalization < 1e12 },
  { label: 'Kapitalisasi > Rp10 T', weight: -0.23, test: (f) => f.capitalization >= 1e13 },
  { label: 'Free float < 15%', weight: -0.29, test: (f) => f.freeFloat < 15 },
  { label: 'Nilai rata-rata 20 hari < Rp1 M', weight: -0.53, test: (f) => f.avgValue20 < 1e9 },
  { label: 'Nilai rata-rata 20 hari ≥ Rp10 M', weight: 0.33, test: (f) => f.avgValue20 >= 1e10 },
  { label: 'RSI < 30', weight: 0.58, test: (f) => fin(f.rsi) && f.rsi < 30 },
  { label: 'RSI 30–50', weight: -0.34, test: (f) => fin(f.rsi) && f.rsi >= 30 && f.rsi < 50 },
  { label: 'RSI 50–70', weight: -0.02, test: (f) => fin(f.rsi) && f.rsi >= 50 && f.rsi <= 70 },
  { label: 'RSI > 70', weight: 1.27, test: (f) => fin(f.rsi) && f.rsi > 70 },
  { label: 'EMA20 > EMA50', weight: 0.27, test: (f) => f.emaUp === true },
  { label: 'Close > EMA20 + 10%', weight: 1.37, test: (f) => fin(f.distEma20) && f.distEma20 > 0.1 },
  { label: 'Close < EMA20 − 10%', weight: 0.85, test: (f) => fin(f.distEma20) && f.distEma20 < -0.1 },
  { label: 'Naik ≥ 25% dalam 20 hari', weight: 1.28, test: (f) => f.ret20 >= 0.25 },
  { label: 'Turun ≥ 20% dalam 20 hari', weight: 0.76, test: (f) => f.ret20 <= -0.2 },
  { label: 'Naik ≥ 10% dalam 5 hari', weight: 1.13, test: (f) => f.ret5 >= 0.1 },
  { label: 'Dalam 10% dari low 1 tahun', weight: -0.61, test: (f) => f.distLow1y <= 0.1 },
  { label: 'Dalam 5% dari high 1 tahun', weight: 0.62, test: (f) => f.distHigh1y >= -0.05 },
  { label: 'RVOL ≥ 2', weight: 0.86, test: (f) => fin(f.rvol) && f.rvol >= 2 },
  { label: 'RVOL rata-rata 5 hari ≥ 1,5', weight: 0.67, test: (f) => fin(f.rvol5) && f.rvol5 >= 1.5 },
  { label: 'RVOL < 0,7', weight: -0.34, test: (f) => fin(f.rvol) && f.rvol < 0.7 },
  { label: 'ATR14/ATR50 < 0,8', weight: -0.19, test: (f) => fin(f.atrRatio) && f.atrRatio < 0.8 },
  { label: 'Range 10 hari < 8%', weight: -1.67, test: (f) => f.range10 < 0.08 },
  { label: 'Range 10 hari > 30%', weight: 0.99, test: (f) => f.range10 > 0.3 },
  { label: 'Close dalam 3% dari high 20 hari', weight: 0.05, test: (f) => fin(f.distHigh20) && f.distHigh20 >= -0.03 },
  { label: 'Pernah naik ≥ 10% dalam 20 hari', weight: 0.78, test: (f) => f.topgain20 },
  { label: 'Hari ini turun ≥ 5%', weight: 0.91, test: (f) => f.changePct <= -0.05 },
  { label: 'Hari ini naik ≥ 10%', weight: 1.91, test: (f) => f.changePct >= 0.1 },
];

/**
 * Pasardana prefilter: only stocks that moved enough for a high score are worth fetching 1-year bars for.
 * Kept every candidate of the 15 Okt 2026 study (271 of 978 stocks that day).
 */
export function radarPrefilter(summaries: StockSummary[]): StockSummary[] {
  return summaries
    .filter((s) => s.ticker && s.lastClose > 0)
    .filter((s) => s.percentChange1D >= 10 || s.percentChange1D <= -5 || s.percentChange1W >= 10 || s.percentChange1M >= 25 || s.percentChange1M <= -20)
    .sort((a, b) => a.ticker.localeCompare(b.ticker));
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

/** Features at the last bar. Null when there is not enough history for EMA50/ATR50. */
export function radarFeatures(bars: OHLCVBar[], summary: StockSummary): RadarFeatures | null {
  const p = bars.length - 1;
  if (bars.length < MIN_BARS) return null;
  const c = closes(bars);
  const ema20 = ema(c, 20), ema50 = ema(c, 50), rsi14 = rsi(bars, 14);
  const atr14 = atr(bars, 14), atr50 = atr(bars, 50), rvol = computeRvolSeries(bars);
  const chgAt = (i: number) => c[i] / c[i - 1] - 1;
  let lo = Infinity, hi = -Infinity, lo10 = Infinity, hi10 = -Infinity, topgain20 = false;
  const val20: number[] = [];
  for (let j = 0; j <= p; j++) { lo = Math.min(lo, bars[j].low); hi = Math.max(hi, bars[j].high); }
  for (let j = p - 9; j <= p; j++) { lo10 = Math.min(lo10, bars[j].low); hi10 = Math.max(hi10, bars[j].high); }
  for (let j = p - 19; j <= p; j++) {
    val20.push(bars[j].close * bars[j].volume);
    if (chgAt(j) >= GAIN) topgain20 = true;
  }
  return {
    close: c[p],
    changePct: chgAt(p),
    rsi: rsi14[p],
    distEma20: c[p] / ema20[p] - 1,
    emaUp: fin(ema50[p]) ? ema20[p] > ema50[p] : null,
    ret5: c[p] / c[p - 5] - 1,
    ret20: c[p] / c[p - 20] - 1,
    distLow1y: c[p] / lo - 1,
    distHigh1y: c[p] / hi - 1,
    rvol: rvol[p],
    rvol5: avg(rvol.slice(p - 4, p + 1).filter(fin)),
    atrRatio: atr14[p] / atr50[p],
    range10: (hi10 - lo10) / c[p],
    distHigh20: c[p] / priorHigh(bars, p + 1) - 1,
    topgain20,
    avgValue20: avg(val20),
    capitalization: summary.capitalization,
    freeFloat: summary.freeFloat,
  };
}

export function radarScore(f: RadarFeatures): { score: number; met: RadarCondition[] } {
  const met = RADAR_CONDITIONS.filter((k) => k.test(f));
  return { score: met.reduce((s, k) => s + k.weight, 0), met };
}

export type RadarPath = 'LANJUTAN' | 'TURUN_DULU' | 'REBOUND' | 'LAINNYA';

/** Which route into a topgain the stock is on (archetypes in docs/features_topgain_patterns.md). */
export function radarPath(f: RadarFeatures): RadarPath {
  if (f.rsi < 35 || f.distLow1y <= 0.1 || f.ret20 <= -0.2) return 'REBOUND';
  if (f.changePct <= -0.05) return 'TURUN_DULU';
  if (f.topgain20 || f.ret20 >= 0.25 || f.ret5 >= 0.1) return 'LANJUTAN';
  return 'LAINNYA';
}

export interface RadarRow {
  summary: StockSummary;
  features: RadarFeatures;
  score: number;
  /** Positive-weight conditions met, strongest first — the "why" shown to the user. */
  reasons: string[];
  path: RadarPath;
  liquid: boolean;
}

export interface RadarInput {
  summary: StockSummary;
  bars: OHLCVBar[];
}

export type RadarState = 'OK' | 'EMPTY' | 'STALE';

export interface RadarScan {
  state: RadarState;
  stateNote: string;
  /** Close the scores are measured on (YYYY-MM-DD). */
  dataDate: string | null;
  /** True when today's live bar was dropped because the session is still open. */
  liveBarDropped: boolean;
  /** All scored stocks, highest score first. */
  rows: RadarRow[];
  /** Tickers without a trade on dataDate (likely suspended) — excluded from rows. */
  noTrade: string[];
  scanned: number;
}

const dateOf = (b: OHLCVBar) => b.date.slice(0, 10);

function wibParts(now: Date): { date: string; hour: number } {
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(now);
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', hour12: false }).format(now));
  return { date, hour };
}

export function buildRadarScan(inputs: RadarInput[], now: Date): RadarScan {
  const latest = inputs.reduce((d, x) => (x.bars.length && dateOf(x.bars[x.bars.length - 1]) > d ? dateOf(x.bars[x.bars.length - 1]) : d), '');
  const empty = (state: RadarState, stateNote: string, dataDate: string | null, liveBarDropped = false): RadarScan =>
    ({ state, stateNote, dataDate, liveBarDropped, rows: [], noTrade: [], scanned: inputs.length });
  if (!latest) return empty('EMPTY', 'Data harga tidak tersedia.', null);

  // During the session the last bar is a live price; score on the previous close instead.
  const wib = wibParts(now);
  const liveBarDropped = latest === wib.date && wib.hour < CLOSE_HOUR_WIB;
  const cut = inputs.map((x) => ({ ...x, bars: liveBarDropped ? x.bars.filter((b) => dateOf(b) < latest) : x.bars }));
  const dataDate = cut.reduce((d, x) => (x.bars.length && dateOf(x.bars[x.bars.length - 1]) > d ? dateOf(x.bars[x.bars.length - 1]) : d), '');
  if (!dataDate) return empty('EMPTY', 'Data harga tidak tersedia.', null, liveBarDropped);

  const fresh = computeDataFreshness([{ date: dataDate, open: 0, high: 0, low: 0, close: 0, volume: 0 }], now);
  if (fresh?.tier === 'stale') return empty('STALE', `Penutupan terakhir ${dataDate} sudah terlalu lama. Radar tidak ditampilkan.`, dataDate, liveBarDropped);

  const rows: RadarRow[] = [];
  const noTrade: string[] = [];
  for (const { summary, bars } of cut) {
    if (!bars.length || dateOf(bars[bars.length - 1]) !== dataDate) continue;
    if (bars[bars.length - 1].volume === 0) { noTrade.push(summary.ticker); continue; }
    const features = radarFeatures(bars, summary);
    if (!features) continue;
    const { score, met } = radarScore(features);
    rows.push({
      summary,
      features,
      score,
      reasons: met.filter((k) => k.weight > 0.3).sort((a, b) => b.weight - a.weight).map((k) => k.label),
      path: radarPath(features),
      liquid: features.avgValue20 >= RADAR_MIN_AVG_VALUE,
    });
  }
  rows.sort((a, b) => b.score - a.score || a.summary.ticker.localeCompare(b.summary.ticker));
  return {
    state: rows.length ? 'OK' : 'EMPTY',
    stateNote: rows.length ? `${rows.length} saham dinilai, ${noTrade.length} tanpa transaksi.` : 'Tidak ada saham yang bisa dinilai.',
    dataDate,
    liveBarDropped,
    rows,
    noTrade: noTrade.sort(),
    scanned: inputs.length,
  };
}

/** Top-N radar list, optionally including thin stocks (avg value 20 hari < Rp0,5 M). */
export function radarTop(scan: RadarScan, includeThin: boolean, n = RADAR_TOP_N): RadarRow[] {
  return scan.rows.filter((r) => includeThin || r.liquid).slice(0, n);
}
