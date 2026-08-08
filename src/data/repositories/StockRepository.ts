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
 * Pasardana's payload has no per-item freshness field, so "last updated" is the
 * time our own /api/stocks route fetched it (X-Fetched-At), not upstream data.
 */
export async function getStockSummariesWithTimestamp(): Promise<{
  summaries: StockSummary[];
  lastUpdatedAt: Date;
}> {
  const response = await fetch('/api/stocks');
  if (!response.ok) {
    throw new Error('Failed to fetch stock list');
  }
  const fetchedAtHeader = response.headers.get('X-Fetched-At');
  const lastUpdatedAt = fetchedAtHeader ? new Date(fetchedAtHeader) : new Date();
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
