import { HistoryResponse, OHLCVBar } from '@/domain/models/History';
import { StockSummary } from '@/domain/models/Stock';
import { mapToStockSummary, PasardanaStockItem } from '@/data/external/pasardana';

export async function getStockSummaries(): Promise<StockSummary[]> {
  const response = await fetch('/api/stocks');
  if (!response.ok) {
    throw new Error('Failed to fetch stock list');
  }
  const data: PasardanaStockItem[] = await response.json();
  return data.filter((item) => item.Code && item.Last > 0).map(mapToStockSummary);
}

export async function getStockHistory(ticker: string, range = '6mo'): Promise<OHLCVBar[]> {
  const response = await fetch(`/api/stocks/${ticker}/history?range=${range}`);
  if (!response.ok) return [];
  const data: HistoryResponse = await response.json();
  return data.ok ? data.bars : [];
}
