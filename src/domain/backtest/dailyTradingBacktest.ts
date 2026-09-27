/**
 * dailyTradingBacktest.ts
 *
 * Day-trade simulation on daily candles over the last N trading days (default 60). Each day T:
 *   ENTRY  buy at Open(T).
 *   EXIT   same day — High ≥ TP → TP, Low ≤ SL → SL, otherwise sell at Close(T).
 *          TP and SL both touched on the same candle → SL first (daily bars can't tell the order).
 *
 * No mandatory rules: every filter is optional and OFF by default, so the baseline is "buy every
 * Open, sell by the Close". Filters only read data up to T−1 (yesterday), never the day being traded.
 * One trade per day, full capital, fee subtracted from every trade's P/L.
 */

import type { OHLCVBar } from '@/domain/models/History';
import { ema, sma } from '@/domain/indicators/movingAverages';
import { roundToTick } from '@/domain/analysis/idxTick';

export interface DailyBacktestFilters {
  /** Yesterday's close > EMA20. */
  trendUp: boolean;
  /** Yesterday was a green candle (Close > Open). */
  prevGreen: boolean;
  /** Yesterday's volume ≥ SMA20 of volume. */
  volumeAboveAvg: boolean;
  /** Today's open gaps up vs yesterday's close (known at the open, before entry). */
  gapUp: boolean;
}

export interface DailyBacktestConfig {
  days: number;
  /** % above entry. 0 = no take profit. */
  tpPct: number;
  /** % below entry. 0 = no stop loss. */
  slPct: number;
  /** Round-trip fee in %, subtracted from every trade. */
  feePct: number;
  filters: DailyBacktestFilters;
}

export const DEFAULT_DAILY_BACKTEST_CONFIG: DailyBacktestConfig = {
  days: 60,
  tpPct: 3,
  slPct: 2,
  feePct: 0.35,
  filters: { trendUp: false, prevGreen: false, volumeAboveAvg: false, gapUp: false },
};

export const DAILY_FILTER_LABEL: Record<keyof DailyBacktestFilters, string> = {
  trendUp: 'Close kemarin > EMA20',
  prevGreen: 'Candle kemarin hijau',
  volumeAboveAvg: 'Volume kemarin ≥ rata-rata 20 hari',
  gapUp: 'Open hari ini gap up',
};

export type DailyExitReason = 'TP' | 'SL' | 'CLOSE';
export const DAILY_EXIT_LABEL: Record<DailyExitReason, string> = { TP: 'Take Profit', SL: 'Stop Loss', CLOSE: 'Jual di Close' };

export interface DailyTrade {
  date: string;
  entry: number;
  tp: number | null;
  sl: number | null;
  exit: number;
  exitReason: DailyExitReason;
  /** Net of fee. */
  plPct: number;
  /** Compounded equity after this trade, starting at 100. */
  equity: number;
}

export interface DailyDay {
  date: string;
  traded: boolean;
  /** Filters that blocked this day (empty when traded). */
  blockedBy: string[];
}

export interface DailyBacktestStats {
  daysTested: number;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number | null;
  avgWinPct: number | null;
  avgLossPct: number | null;
  profitFactor: number | null;
  expectancyPct: number | null;
  maxDrawdownPct: number | null;
  totalReturnPct: number | null;
  /** Buy at the first tested Open, hold to the last Close — the benchmark to beat. */
  buyHoldPct: number | null;
  tpHits: number;
  slHits: number;
  closeExits: number;
}

export interface DailyBacktestResult {
  firstDate: string;
  lastDate: string;
  trades: DailyTrade[];
  days: DailyDay[];
  stats: DailyBacktestStats;
}

export function runDailyTradingBacktest(bars: OHLCVBar[], config: DailyBacktestConfig): DailyBacktestResult | null {
  const days = Math.min(config.days, bars.length - 1);
  if (days < 1) return null;

  const closes = bars.map((b) => b.close);
  const ema20 = ema(closes, 20);
  const volSma = sma(bars.map((b) => b.volume), 20);
  const start = bars.length - days;

  const trades: DailyTrade[] = [];
  const dayRows: DailyDay[] = [];
  let equity = 100;

  for (let t = start; t < bars.length; t++) {
    const b = bars[t];
    const prev = bars[t - 1];
    const f = config.filters;
    const blockedBy = [
      f.trendUp && !(Number.isFinite(ema20[t - 1]) && prev.close > ema20[t - 1]) && DAILY_FILTER_LABEL.trendUp,
      f.prevGreen && !(prev.close > prev.open) && DAILY_FILTER_LABEL.prevGreen,
      f.volumeAboveAvg && !(Number.isFinite(volSma[t - 1]) && prev.volume >= volSma[t - 1]) && DAILY_FILTER_LABEL.volumeAboveAvg,
      f.gapUp && !(b.open > prev.close) && DAILY_FILTER_LABEL.gapUp,
    ].filter((x): x is string => Boolean(x));

    if (blockedBy.length > 0 || !(b.open > 0)) {
      dayRows.push({ date: b.date, traded: false, blockedBy: blockedBy.length ? blockedBy : ['Data Open tidak valid'] });
      continue;
    }

    const entry = b.open;
    const tp = config.tpPct > 0 ? roundToTick(entry * (1 + config.tpPct / 100)) : null;
    const sl = config.slPct > 0 ? roundToTick(entry * (1 - config.slPct / 100)) : null;
    let exit = b.close;
    let exitReason: DailyExitReason = 'CLOSE';
    if (sl != null && b.low <= sl) {
      exit = sl;
      exitReason = 'SL';
    } else if (tp != null && b.high >= tp) {
      exit = tp;
      exitReason = 'TP';
    }

    const plPct = ((exit - entry) / entry) * 100 - config.feePct;
    equity *= 1 + plPct / 100;
    trades.push({ date: b.date, entry, tp, sl, exit, exitReason, plPct, equity });
    dayRows.push({ date: b.date, traded: true, blockedBy: [] });
  }

  return {
    firstDate: bars[start].date,
    lastDate: bars[bars.length - 1].date,
    trades,
    days: dayRows,
    stats: computeDailyStats(trades, days, bars[start].open, bars[bars.length - 1].close),
  };
}

function computeDailyStats(trades: DailyTrade[], daysTested: number, firstOpen: number, lastClose: number): DailyBacktestStats {
  const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
  const wins = trades.filter((t) => t.plPct > 0);
  const losses = trades.filter((t) => t.plPct <= 0);
  const grossWin = sum(wins.map((t) => t.plPct));
  const grossLoss = Math.abs(sum(losses.map((t) => t.plPct)));
  const n = trades.length;

  let peak = 100;
  let maxDd = 0;
  for (const t of trades) {
    peak = Math.max(peak, t.equity);
    maxDd = Math.min(maxDd, (t.equity - peak) / peak);
  }

  return {
    daysTested,
    totalTrades: n,
    wins: wins.length,
    losses: losses.length,
    winRate: n ? (wins.length / n) * 100 : null,
    avgWinPct: wins.length ? grossWin / wins.length : null,
    avgLossPct: losses.length ? -grossLoss / losses.length : null,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : null,
    expectancyPct: n ? sum(trades.map((t) => t.plPct)) / n : null,
    maxDrawdownPct: n ? maxDd * 100 : null,
    totalReturnPct: n ? trades[n - 1].equity - 100 : null,
    buyHoldPct: firstOpen > 0 ? ((lastClose - firstOpen) / firstOpen) * 100 : null,
    tpHits: trades.filter((t) => t.exitReason === 'TP').length,
    slHits: trades.filter((t) => t.exitReason === 'SL').length,
    closeExits: trades.filter((t) => t.exitReason === 'CLOSE').length,
  };
}
