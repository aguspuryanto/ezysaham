import { HistoryResponse, OHLCVBar } from '@/domain/models/History';
import { StockSummary } from '@/domain/models/Stock';
import { mapToStockSummary, PasardanaStockItem } from '@/data/external/pasardana';

export async function getStockSummaries(): Promise<StockSummary[]> {
  const { summaries } = await getStockSummariesWithTimestamp();
  return summaries;
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
