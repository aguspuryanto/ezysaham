/**
 * SignalRepository.ts
 *
 * API service for SARA AI signals. Signal logic is still TEMPORARY mock data, but
 * prices are real EOD quotes (mock trade plans are rebased onto them).
 * To go live, replace the body of `getSignalDashboard` with:
 *
 *   const res = await fetch(`/api/signals?date=${date}`, { cache: 'no-store' });
 *   if (!res.ok) throw new Error('Gagal memuat sinyal');
 *   return (await res.json()) as SignalDashboardData;
 *
 * The UI only depends on `SignalDashboardData`, so nothing else needs to change.
 */

import { MOCK_PERFORMANCE, buildMockSignals, rebaseMockSignal } from '@/data/mock/signalMock';
import { getStockHistory, getStockSummaries } from '@/data/repositories/StockRepository';
import { SignalDashboardData, StockSignal } from '@/domain/models/Signal';

/** Today's date in WIB (Asia/Jakarta) as YYYY-MM-DD. */
export function todayWib(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
}

function isWeekend(date: string): boolean {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

type Quote = { price: number; changePct: number };

/** EOD close + 1D change per ticker for `date`: live summaries for today, daily bars for past dates. */
async function getEodQuotes(tickers: string[], date: string): Promise<Map<string, Quote>> {
  const quotes = new Map<string, Quote>();
  if (date >= todayWib()) {
    const summaries = await getStockSummaries().catch(() => []);
    const wanted = new Set(tickers);
    for (const s of summaries) {
      if (wanted.has(s.ticker) && s.lastClose > 0) quotes.set(s.ticker, { price: s.lastClose, changePct: s.percentChange1D });
    }
    return quotes;
  }
  await Promise.all(tickers.map(async (ticker) => {
    const bars = await getStockHistory(ticker, '1y').catch(() => []);
    const i = bars.findLastIndex((b) => b.date <= date);
    if (i < 0 || !(bars[i].close > 0)) return;
    const prev = i > 0 ? bars[i - 1].close : 0;
    quotes.set(ticker, { price: bars[i].close, changePct: prev > 0 ? ((bars[i].close - prev) / prev) * 100 : 0 });
  }));
  return quotes;
}

/** Replaces the mock prices with real EOD quotes (mock kept only if a quote is unavailable). */
async function withEodPrices(signals: StockSignal[], date: string): Promise<StockSignal[]> {
  const quotes = await getEodQuotes(signals.map((s) => s.ticker), date);
  return signals.map((s) => {
    const q = quotes.get(s.ticker);
    return q ? rebaseMockSignal(s, q.price, q.changePct) : s;
  });
}

export async function getSignalDashboard(date: string): Promise<SignalDashboardData> {

  // No trading session on weekends → no signal batch (exercises the empty state).
  if (isWeekend(date)) {
    return { date, lastUpdated: null, signals: [], performance: MOCK_PERFORMANCE };
  }

  const signals = await withEodPrices(buildMockSignals(date), date);

  return {
    date,
    // Batches are generated after market close (16:15 WIB).
    lastUpdated: `${date}T16:15:00+07:00`,
    signals,
    performance: MOCK_PERFORMANCE,
  };
}
