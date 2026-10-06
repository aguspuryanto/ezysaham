/**
 * SignalRepository.ts
 *
 * SARA AI signals. Each signal is computed by Decision Engine v3 (domain/analysis/signalFromDecision.ts)
 * from the SAME data the stock detail page uses — summary + 6-month daily bars + Yahoo fundamentals +
 * session VWAP — so a ticker's BUY / WAIT / AVOID here always equals the detail page's Trading verdict.
 *
 * Past dates are replayed from 1-year history cut at that date (no intraday VWAP).
 * The performance summary is still TEMPORARY mock data until signal outcomes are tracked.
 */

import { MOCK_PERFORMANCE, SIGNAL_UNIVERSE } from '@/data/mock/signalMock';
import { getStockFundamentals, getStockHistory, getStockIntraday, getStockSummaries } from '@/data/repositories/StockRepository';
import { buildSignalFromDecision } from '@/domain/analysis/signalFromDecision';
import { vwap as sessionVwap } from '@/domain/indicators/vwap';
import { OHLCVBar } from '@/domain/models/History';
import { SignalDashboardData, StockSignal } from '@/domain/models/Signal';
import { StockSummary } from '@/domain/models/Stock';

/** Today's date in WIB (Asia/Jakarta) as YYYY-MM-DD. */
export function todayWib(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
}

function isWeekend(date: string): boolean {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

const pctChange = (bars: OHLCVBar[], back: number) => {
  const last = bars[bars.length - 1];
  const then = bars[bars.length - 1 - back];
  return last && then && then.close > 0 ? ((last.close - then.close) / then.close) * 100 : 0;
};

/**
 * Same price sync as useStockAnalysis (detail page): the last daily bar is the price reference.
 * For a past date the price-derived fields are rebuilt from the bars cut at that date.
 */
function syncSummary(base: StockSummary, bars: OHLCVBar[], past: boolean): StockSummary {
  const s = { ...base };
  const last = bars[bars.length - 1];
  const prev = bars[bars.length - 2];
  if (!last) return s;
  s.lastClose = last.close;
  if (prev) {
    s.prevClose = prev.close;
    s.percentChange1D = ((last.close - prev.close) / prev.close) * 100;
  }
  if (past) {
    s.percentChange1W = pctChange(bars, 5);
    s.percentChange1M = pctChange(bars, 21);
    s.volume = last.volume;
    s.value = last.close * last.volume;
    s.high = last.high;
    s.low = last.low;
  }
  return s;
}

async function buildSignal(summary: StockSummary, date: string, isToday: boolean): Promise<StockSignal | null> {
  const ticker = summary.ticker;
  const [history, fundamentals, intraday] = await Promise.all([
    // Today: the detail page's default 6-month range. Past: 1 year, cut at `date`.
    getStockHistory(ticker, isToday ? undefined : '1y').catch(() => [] as OHLCVBar[]),
    getStockFundamentals(ticker),
    isToday ? getStockIntraday(ticker).catch(() => null) : Promise.resolve(null),
  ]);
  const bars = isToday ? history : history.filter((b) => b.date.slice(0, 10) <= date);
  if (bars.length === 0) return null;
  const vwap = intraday?.ok && intraday.bars.length > 0 ? sessionVwap(intraday.bars) : null;
  return buildSignalFromDecision({ summary: syncSummary(summary, bars, !isToday), bars, fundamentals, vwap, date });
}

export async function getSignalDashboard(date: string): Promise<SignalDashboardData> {
  // No trading session on weekends → no signal batch (exercises the empty state).
  if (isWeekend(date)) {
    return { date, lastUpdated: null, signals: [], performance: MOCK_PERFORMANCE };
  }

  const isToday = date >= todayWib();
  const summaries = await getStockSummaries();
  const universe = SIGNAL_UNIVERSE
    .map((t) => summaries.find((s) => s.ticker === t))
    .filter((s): s is StockSummary => s != null);
  const signals = (await Promise.all(universe.map((s) => buildSignal(s, date, isToday).catch(() => null))))
    .filter((s): s is StockSignal => s != null);

  return {
    date,
    lastUpdated: isToday ? new Date().toISOString() : `${date}T16:15:00+07:00`,
    signals,
    performance: MOCK_PERFORMANCE,
  };
}
