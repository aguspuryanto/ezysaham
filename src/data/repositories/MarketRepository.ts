import { HistoryResponse, OHLCVBar } from '@/domain/models/History';

export async function getIhsgHistory(range: string): Promise<OHLCVBar[]> {
  const response = await fetch(`/api/market/ihsg/history?range=${range}`);
  if (!response.ok) return [];
  const data: HistoryResponse = await response.json();
  return data.ok ? data.bars : [];
}
