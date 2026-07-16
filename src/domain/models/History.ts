export interface OHLCVBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface HistoryResponse {
  code: string;
  ok: boolean;
  bars: OHLCVBar[];
  source?: 'yahoo';
  reason?: 'not_found' | 'error';
  message?: string;
}
