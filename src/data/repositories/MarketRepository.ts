import { HistoryResponse, OHLCVBar } from '@/domain/models/History';

export type MarketSeriesKey = 'ihsg' | 'lq45' | 'usdidr';

export async function getMarketSeriesHistory(key: MarketSeriesKey, range: string): Promise<OHLCVBar[]> {
  try {
    const response = await fetch(`/api/market/index/${key}?range=${range}`);
    if (!response.ok) return [];
    const data: HistoryResponse = await response.json();
    return data.ok ? data.bars : [];
  } catch {
    return [];
  }
}

export async function getIhsgHistory(range: string): Promise<OHLCVBar[]> {
  const response = await fetch(`/api/market/ihsg/history?range=${range}`);
  if (!response.ok) return [];
  const data: HistoryResponse = await response.json();
  return data.ok ? data.bars : [];
}
