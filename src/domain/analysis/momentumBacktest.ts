/**
 * momentumBacktest.ts
 *
 * Walk-forward backtest of the Momentum Trade Engine on daily OHLCV, through the SAME pipeline as the detail
 * page (StockSummary → computeStockAnalysis → buildMomentumInput → buildMomentumTrade).
 *
 * Execution rules (no look-ahead):
 *   • Day t: the engine sees bars[0..t] only (window = last WINDOW sessions, EMA 200 from the full prefix).
 *   • A BUY at the close of t is executed at the OPEN of t+1 — only if SL < open ≤ entryHigh (no chasing a gap).
 *   • From t+1: SL is checked before targets on every bar (worst case); a gap below SL fills at the open.
 *     TP1 → sell half, move SL to entry. TP2 → sell the rest. Time stop after `maxHoldBars` at the close.
 *   • Fees + slippage (≥ 1 tick) on every fill. One position per ticker at a time. Equal size per trade.
 *   • Not modelled: IDX auto-rejection (ARA/ARB fills), partial fills, broker lot rounding, holidays.
 */

import { evaluateFundamentalScreening } from '@/domain/analysis/aiStockEngine';
import { buildMomentumInput } from '@/domain/analysis/decisionInput';
import { buildFundamentalPillars } from '@/domain/analysis/fundamentalPillars';
import { idxTickSize } from '@/domain/analysis/idxTick';
import { CostModel, IDX_COSTS, liquidityOf } from '@/domain/analysis/momentumSetups';
import { buildMomentumTrade, MomentumMode, MomentumTradeReport, MomentumTradeStatus } from '@/domain/analysis/momentumTradeEngine';
import { computeStockAnalysis } from '@/domain/analysis/stockAnalysisEngine';
import { OHLCVBar } from '@/domain/models/History';
import { StockSummary } from '@/domain/models/Stock';

export interface BacktestOptions {
  mode?: MomentumMode;
  /** Sessions passed to the engine as `bars` (detail page: 6 months ≈ 125). */
  window?: number;
  /** First day evaluated = this many bars into the history. */
  warmup?: number;
  maxHoldBars?: number;
  costs?: CostModel;
  /** Forward horizon / thresholds for the "missed opportunity" count. */
  missed?: { horizon: number; gainPct: number; lossPct: number };
}

export type ExitReason = 'SL' | 'BE' | 'TP2' | 'TIME';

export interface BacktestTrade {
  ticker: string;
  setup: string;
  signalDate: string;
  entryDate: string;
  exitDate: string;
  entry: number;
  sl: number;
  tp1: number | null;
  tp2: number;
  exitReason: ExitReason;
  tp1Hit: boolean;
  /** Net % return of the whole position after costs. */
  netPct: number;
  holdBars: number;
  avgValue20: number | null;
}

export interface TickerBacktest {
  ticker: string;
  daysEvaluated: number;
  statusCounts: Partial<Record<MomentumTradeStatus, number>>;
  setupCounts: Record<string, number>;
  trades: BacktestTrade[];
  /** BUY signals that were not filled (gap above the zone / below SL at the next open). */
  unfilled: number;
  /** Non-BUY days in a bullish trend after which price reached +gain% before −loss% within the horizon. */
  missed: number;
  /** BUY signals that reached +gain% before −loss% (same yardstick). */
  buyHits: number;
  buySignals: number;
}

const DEFAULTS = { mode: 'swing' as MomentumMode, window: 125, warmup: 125, maxHoldBars: 10, missed: { horizon: 10, gainPct: 10, lossPct: 5 } };

/** Summary snapshot from bars only (what the summary feed would have shown on that day). */
export function summaryFromBars(ticker: string, bars: OHLCVBar[]): StockSummary {
  const last = bars[bars.length - 1];
  const at = (k: number) => bars[bars.length - 1 - k]?.close ?? NaN;
  const ch = (k: number) => (bars.length > k ? (last.close / at(k) - 1) * 100 : 0);
  const yr = bars.slice(-250);
  return {
    ticker, name: ticker, sector: '', subSector: '', lastClose: last.close, prevClose: at(1),
    percentChange1D: ch(1), percentChange1W: ch(5), percentChange1M: ch(21), percentChange3M: ch(63), percentChange6M: ch(126),
    percentChangeYtd: 0, percentChange1Y: ch(249), percentChange3Y: 0, percentChange5Y: 0, percentChange10Y: 0,
    high: last.high, low: last.low, volume: last.volume, value: last.close * last.volume, frequency: 0,
    capitalization: 0, per: 0, pbv: 0, roe: 0, freeFloat: 0,
    annualHigh: Math.max(...yr.map((b) => b.high)), annualLow: Math.min(...yr.map((b) => b.low)),
  };
}

/** The engine verdict exactly as the detail page would compute it on `history` (no future bars exist here). */
export function evaluateAt(ticker: string, history: OHLCVBar[], mode: MomentumMode, window = DEFAULTS.window): MomentumTradeReport {
  const bars = history.slice(-window);
  const summary = summaryFromBars(ticker, history);
  const analysis = computeStockAnalysis(summary, bars);
  const pillars = buildFundamentalPillars(summary, null, evaluateFundamentalScreening(summary));
  return buildMomentumTrade(buildMomentumInput({ summary, bars, analysis, fundamentals: null, pillars, vwap: null, longBars: history }), { mode });
}

const slipOf = (p: number, c: CostModel) => Math.max((p * c.slippagePct) / 100, idxTickSize(p));

function forwardHit(bars: OHLCVBar[], t: number, horizon: number, gainPct: number, lossPct: number): boolean {
  const ref = bars[t].close;
  for (let k = t + 1; k <= Math.min(bars.length - 1, t + horizon); k++) {
    if (bars[k].low <= ref * (1 - lossPct / 100)) return false;
    if (bars[k].high >= ref * (1 + gainPct / 100)) return true;
  }
  return false;
}

export function backtestTicker(ticker: string, bars: OHLCVBar[], opts: BacktestOptions = {}): TickerBacktest {
  const o = { ...DEFAULTS, ...opts, costs: opts.costs ?? IDX_COSTS };
  const out: TickerBacktest = { ticker, daysEvaluated: 0, statusCounts: {}, setupCounts: {}, trades: [], unfilled: 0, missed: 0, buyHits: 0, buySignals: 0 };
  let busyUntil = -1;
  for (let t = Math.max(o.warmup, 60) - 1; t < bars.length - 1; t++) {
    const r = evaluateAt(ticker, bars.slice(0, t + 1), o.mode, o.window);
    out.daysEvaluated += 1;
    out.statusCounts[r.status] = (out.statusCounts[r.status] ?? 0) + 1;
    if (r.setupType !== 'NONE') out.setupCounts[r.setupType] = (out.setupCounts[r.setupType] ?? 0) + 1;
    const hit = forwardHit(bars, t, o.missed.horizon, o.missed.gainPct, o.missed.lossPct);
    if (r.status !== 'BUY') {
      if (r.trend === 'BULLISH' && hit) out.missed += 1;
      continue;
    }
    out.buySignals += 1;
    if (hit) out.buyHits += 1;
    if (t < busyUntil) continue;

    const next = bars[t + 1];
    if (!(next.open > r.sl! && next.open <= r.entryHigh!)) { out.unfilled += 1; continue; }
    const c = o.costs;
    const entry = next.open + slipOf(next.open, c);
    const cost = entry * (1 + c.buyFeePct / 100);
    const sell = (p: number) => (p - slipOf(p, c)) * (1 - c.sellFeePct / 100);
    let sl = r.sl!;
    const tp1 = r.tp1?.price ?? null;
    const tp2 = r.tp2!.price;
    let size = 1;
    let proceeds = 0;
    let tp1Hit = false;
    let exitIdx = -1;
    let reason: ExitReason = 'TIME';
    for (let k = t + 1; k < bars.length && k <= t + o.maxHoldBars; k++) {
      const b = bars[k];
      if (b.low <= sl) { proceeds += size * sell(Math.min(b.open, sl)); size = 0; exitIdx = k; reason = tp1Hit ? 'BE' : 'SL'; break; }
      if (!tp1Hit && tp1 != null && b.high >= tp1) { proceeds += 0.5 * sell(Math.max(b.open, tp1)); size = 0.5; tp1Hit = true; sl = Math.max(sl, next.open); }
      if (b.high >= tp2) { proceeds += size * sell(Math.max(b.open, tp2)); size = 0; exitIdx = k; reason = 'TP2'; break; }
    }
    if (size > 0) {
      exitIdx = Math.min(bars.length - 1, t + o.maxHoldBars);
      proceeds += size * sell(bars[exitIdx].close);
    }
    out.trades.push({
      ticker, setup: r.setupType, signalDate: bars[t].date, entryDate: next.date, exitDate: bars[exitIdx].date,
      entry: next.open, sl: r.sl!, tp1, tp2, exitReason: reason, tp1Hit,
      netPct: (proceeds / cost - 1) * 100, holdBars: exitIdx - t, avgValue20: liquidityOf(bars.slice(0, t + 1)).avgValue20,
    });
    busyUntil = exitIdx;
  }
  return out;
}

export interface BacktestSummary {
  trades: number;
  winRate: number | null;
  /** Mean net % per trade. */
  expectancyPct: number | null;
  profitFactor: number | null;
  /** Max peak-to-trough of the cumulative net % (equal size, trades ordered by exit date). */
  maxDrawdownPct: number | null;
  avgWinPct: number | null;
  avgLossPct: number | null;
  avgHoldBars: number | null;
  stopRate: number | null;
  /** Share of BREAKOUT / RETEST trades that ended at the original SL. */
  falseBreakoutRate: number | null;
}

export function summarizeTrades(trades: BacktestTrade[]): BacktestSummary {
  const n = trades.length;
  if (n === 0) {
    return { trades: 0, winRate: null, expectancyPct: null, profitFactor: null, maxDrawdownPct: null, avgWinPct: null, avgLossPct: null, avgHoldBars: null, stopRate: null, falseBreakoutRate: null };
  }
  const wins = trades.filter((t) => t.netPct > 0);
  const losses = trades.filter((t) => t.netPct <= 0);
  const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
  const grossWin = sum(wins.map((t) => t.netPct));
  const grossLoss = -sum(losses.map((t) => t.netPct));
  let eq = 0;
  let peak = 0;
  let dd = 0;
  for (const t of [...trades].sort((a, b) => a.exitDate.localeCompare(b.exitDate))) {
    eq += t.netPct;
    peak = Math.max(peak, eq);
    dd = Math.max(dd, peak - eq);
  }
  const bo = trades.filter((t) => t.setup === 'BREAKOUT' || t.setup === 'RETEST');
  return {
    trades: n,
    winRate: (wins.length / n) * 100,
    expectancyPct: sum(trades.map((t) => t.netPct)) / n,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : null,
    maxDrawdownPct: dd,
    avgWinPct: wins.length ? grossWin / wins.length : null,
    avgLossPct: losses.length ? -grossLoss / losses.length : null,
    avgHoldBars: sum(trades.map((t) => t.holdBars)) / n,
    stopRate: (trades.filter((t) => t.exitReason === 'SL').length / n) * 100,
    falseBreakoutRate: bo.length ? (bo.filter((t) => t.exitReason === 'SL').length / bo.length) * 100 : null,
  };
}
