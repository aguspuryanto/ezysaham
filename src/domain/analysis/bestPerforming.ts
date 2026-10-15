/**
 * bestPerforming.ts
 *
 * "Kinerja Terbaik" — IDX stocks ranked by period performance (like TradingView's Best performing), restricted to
 * liquid names and annotated with HOW the stock rose and where it stands now:
 *   • performance  — Pasardana's period change (StockSummary.percentChange1M/3M/6M/Ytd/1Y), used for ranking;
 *   • liquidity    — average daily value of the last 20 bars (illiquid stocks are dropped);
 *   • shape        — max drawdown, days ≥ +10%, and how much of the rise came from the 5 best days
 *                    (spike-driven rises tend to give back gains — docs/features_topgain_patterns.md);
 *   • state        — distance from the 52-week high, EMA50/EMA200 trend, market phase (marketPhase.ts).
 *
 * Pure — the caller fetches summaries and 1-year daily bars.
 */

import { computeMarketPhase, MarketPhaseResult } from '@/domain/analysis/marketPhase';
import { closes, ema } from '@/domain/indicators/movingAverages';
import { OHLCVBar } from '@/domain/models/History';
import { StockSummary } from '@/domain/models/Stock';

export type PerfPeriod = '1M' | '3M' | '6M' | 'YTD' | '1Y';

export const PERF_PERIODS: Array<{ id: PerfPeriod; label: string; bars: number | 'ytd' | 'all'; perf: (s: StockSummary) => number }> = [
  { id: '1M', label: '1 Bulan', bars: 21, perf: (s) => s.percentChange1M },
  { id: '3M', label: '3 Bulan', bars: 63, perf: (s) => s.percentChange3M },
  { id: '6M', label: '6 Bulan', bars: 126, perf: (s) => s.percentChange6M },
  { id: 'YTD', label: 'YTD', bars: 'ytd', perf: (s) => s.percentChangeYtd },
  { id: '1Y', label: '1 Tahun', bars: 'all', perf: (s) => s.percentChange1Y },
];

export const periodOf = (id: PerfPeriod) => PERF_PERIODS.find((p) => p.id === id)!;

/** Above this share of the period's log-gain coming from the 5 best days, the rise is "spike-driven". */
export const SPIKE_SHARE = 0.7;
export const SPIKE_DAY = 0.1;

export type PerfTrend = 'Uptrend kuat' | 'Uptrend' | 'Melemah';
export type PerfCharacter = 'Didorong lonjakan' | 'Tren bertahap';

export interface PerformerRow {
  summary: StockSummary;
  /** Period performance, % (Pasardana). */
  perf: number;
  /** Average close × volume of the last 20 bars, Rp. */
  avgValue20: number;
  /** close / highest high of the bars − 1, % (≤ 0). */
  fromHigh52: number;
  /** Deepest peak-to-trough fall inside the period, % (≤ 0). */
  maxDrawdown: number;
  trend: PerfTrend;
  phase: MarketPhaseResult | null;
  /** Days ≥ +10% inside the period. */
  spikeDays: number;
  /** Share (0–1) of the period's log-gain made on its 5 best days; null when the period is not a gain. */
  top5Share: number | null;
  character: PerfCharacter | null;
}

/** Ranks the whole snapshot by period performance and keeps the first `n` as candidates for the bar fetch. */
export function bestPerformingCandidates(summaries: StockSummary[], period: PerfPeriod, n = 150): StockSummary[] {
  const perf = periodOf(period).perf;
  return summaries
    .filter((s) => s.lastClose > 0 && Number.isFinite(perf(s)))
    .sort((a, b) => perf(b) - perf(a) || a.ticker.localeCompare(b.ticker))
    .slice(0, n);
}

/** Bars of the period, including the bar before it (the base the first day's change is measured from). */
export function periodBars(bars: OHLCVBar[], period: PerfPeriod): OHLCVBar[] {
  const spec = periodOf(period).bars;
  if (spec === 'all') return bars;
  if (spec === 'ytd') {
    if (!bars.length) return bars;
    const year = bars[bars.length - 1].date.slice(0, 4);
    const first = bars.findIndex((b) => b.date.slice(0, 4) === year);
    return bars.slice(Math.max(0, first - 1));
  }
  return bars.slice(Math.max(0, bars.length - spec - 1));
}

export function maxDrawdownPct(bars: OHLCVBar[]): number {
  let peak = -Infinity, worst = 0;
  for (const b of bars) {
    peak = Math.max(peak, b.close);
    worst = Math.min(worst, b.close / peak - 1);
  }
  return worst * 100;
}

/** Daily log-returns of the period; the share of their total made by the 5 largest. */
export function top5GainShare(bars: OHLCVBar[]): number | null {
  const rets: number[] = [];
  for (let i = 1; i < bars.length; i++) if (bars[i - 1].close > 0) rets.push(Math.log(bars[i].close / bars[i - 1].close));
  const total = rets.reduce((a, b) => a + b, 0);
  if (total <= 0) return null;
  const top = [...rets].sort((a, b) => b - a).slice(0, 5).filter((r) => r > 0).reduce((a, b) => a + b, 0);
  return Math.min(1, top / total);
}

export function trendOf(bars: OHLCVBar[]): PerfTrend {
  const c = closes(bars);
  const last = c[c.length - 1];
  const e50 = ema(c, 50)[c.length - 1];
  const e200 = ema(c, 200)[c.length - 1];
  if (Number.isFinite(e50) && Number.isFinite(e200) && last > e50 && e50 > e200) return 'Uptrend kuat';
  if (Number.isFinite(e50) && last > e50) return 'Uptrend';
  return 'Melemah';
}

/** null when there are too few bars to say anything (< 21). */
export function analyzePerformer(summary: StockSummary, bars: OHLCVBar[], period: PerfPeriod): PerformerRow | null {
  if (bars.length < 21) return null;
  const last20 = bars.slice(-20);
  const inPeriod = periodBars(bars, period);
  const high = Math.max(...bars.map((b) => b.high));
  let spikeDays = 0;
  for (let i = 1; i < inPeriod.length; i++) if (inPeriod[i].close / inPeriod[i - 1].close - 1 >= SPIKE_DAY) spikeDays += 1;
  const top5Share = top5GainShare(inPeriod);
  return {
    summary,
    perf: periodOf(period).perf(summary),
    avgValue20: last20.reduce((a, b) => a + b.close * b.volume, 0) / last20.length,
    fromHigh52: high > 0 ? (bars[bars.length - 1].close / high - 1) * 100 : 0,
    maxDrawdown: maxDrawdownPct(inPeriod),
    trend: trendOf(bars),
    phase: computeMarketPhase(summary, bars),
    spikeDays,
    top5Share,
    character: top5Share == null ? null : top5Share >= SPIKE_SHARE ? 'Didorong lonjakan' : 'Tren bertahap',
  };
}

/** Drops illiquid rows, ranks by performance, keeps the top `limit`. */
export function rankBestPerforming(rows: Array<PerformerRow | null>, opts: { minValue?: number; limit?: number } = {}): PerformerRow[] {
  const { minValue = 1e9, limit = 50 } = opts;
  return rows
    .filter((r): r is PerformerRow => r != null && r.avgValue20 >= minValue)
    .sort((a, b) => b.perf - a.perf || a.summary.ticker.localeCompare(b.summary.ticker))
    .slice(0, limit);
}

export interface PerformersSummary {
  topSectors: Array<{ sector: string; count: number }>;
  spikeDrivenPct: number;
  uptrendPct: number;
  medianFromHigh: number | null;
  medianPerf: number | null;
}

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

export function summarizePerformers(rows: PerformerRow[]): PerformersSummary {
  const bySector = new Map<string, number>();
  for (const r of rows) bySector.set(r.summary.sector, (bySector.get(r.summary.sector) ?? 0) + 1);
  const n = rows.length || 1;
  return {
    topSectors: [...bySector.entries()].map(([sector, count]) => ({ sector, count })).sort((a, b) => b.count - a.count).slice(0, 3),
    spikeDrivenPct: (rows.filter((r) => r.character === 'Didorong lonjakan').length / n) * 100,
    uptrendPct: (rows.filter((r) => r.trend !== 'Melemah').length / n) * 100,
    medianFromHigh: median(rows.map((r) => r.fromHigh52)),
    medianPerf: median(rows.map((r) => r.perf)),
  };
}
