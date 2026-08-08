import { HistoryResponse, OHLCVBar } from '@/domain/models/History';
import { IntradayResponse } from '@/domain/models/Intraday';
import { StockSummary } from '@/domain/models/Stock';
import { mapToStockSummary, PasardanaStockItem } from '@/data/external/pasardana';
import { AnalysisCacheManager } from '@/data/cache/analysisCache';

export async function getStockSummaries(): Promise<StockSummary[]> {
  const cached = AnalysisCacheManager.getSummaries();
  if (cached && cached.length > 0) {
    return cached;
  }

  // Deduplicate ongoing network flight requests
  const flightPromise = AnalysisCacheManager.getSummariesPromise();
  if (flightPromise) {
    return flightPromise;
  }

  const fetchPromise = (async () => {
    try {
      const { summaries } = await getStockSummariesWithTimestamp();
      AnalysisCacheManager.setSummaries(summaries);
      return summaries;
    } finally {
      AnalysisCacheManager.setSummariesPromise(null);
    }
  })();

  AnalysisCacheManager.setSummariesPromise(fetchPromise);
  return fetchPromise;
}

/**
 * Returns the last IDX market close time: 15:00 WIB (UTC+7) on the most recent
 * trading day (Monday–Friday). If today is a weekday and market has already
 * closed (≥ 15:00 WIB), today is used; otherwise we step back to the previous
 * trading day. Weekends are skipped automatically.
 */
function getLastIdxCloseTime(): Date {
  // Current time in WIB (UTC+7)
  const nowUtc = new Date();
  const wibOffsetMs = 7 * 60 * 60 * 1000;
  const nowWib = new Date(nowUtc.getTime() + wibOffsetMs);

  // Build a candidate: today at 15:00 WIB expressed as UTC
  const candidate = new Date(
    Date.UTC(nowWib.getUTCFullYear(), nowWib.getUTCMonth(), nowWib.getUTCDate(), 15, 0, 0, 0) -
      wibOffsetMs
  );

  // Step back until we land on a weekday where market has already closed
  let closeTime = new Date(candidate);
  while (true) {
    const dayOfWeek = new Date(closeTime.getTime() + wibOffsetMs).getUTCDay(); // 0=Sun, 6=Sat
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
    const marketClosed = closeTime <= nowUtc;
    if (isWeekday && marketClosed) break;
    // Go back one day
    closeTime = new Date(closeTime.getTime() - 24 * 60 * 60 * 1000);
  }

  return closeTime;
}

/**
 * Fetches stock summaries and pairs them with the last IDX end-of-day close
 * time (15:00 WIB on the most recent trading day), not the fetch timestamp.
 */
export async function getStockSummariesWithTimestamp(): Promise<{
  summaries: StockSummary[];
  lastUpdatedAt: Date;
}> {
  const response = await fetch('/api/stocks');
  if (!response.ok) {
    throw new Error('Failed to fetch stock list');
  }
  const lastUpdatedAt = getLastIdxCloseTime();
  const data: PasardanaStockItem[] = await response.json();
  const summaries = data.filter((item) => item.Code && item.Last > 0).map(mapToStockSummary);
  return { summaries, lastUpdatedAt };
}

export async function getStockHistory(ticker: string, range = '6mo'): Promise<OHLCVBar[]> {
  const response = await fetch(`/api/stocks/${ticker}/history?range=${range}`);
  if (!response.ok) return [];
  const data: HistoryResponse = await response.json();
  return data.ok ? data.bars : [];
}

export async function getStockIntraday(ticker: string): Promise<IntradayResponse> {
  try {
    const response = await fetch(`/api/stocks/${ticker}/intraday`);
    if (!response.ok) return { code: ticker, ok: false, bars: [], reason: 'error' };
    return await response.json();
  } catch {
    return { code: ticker, ok: false, bars: [], reason: 'error' };
  }
}
