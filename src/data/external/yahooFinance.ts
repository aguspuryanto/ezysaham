import { HistoryResponse, OHLCVBar } from '@/domain/models/History';

interface YahooChartPayload {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: { quote?: Array<{ open?: number[]; high?: number[]; low?: number[]; close?: number[]; volume?: number[] }> };
      meta?: { gmtoffset?: number };
    }>;
  };
}

function toDateString(unixSeconds: number, gmtOffsetSeconds: number): string {
  const shifted = new Date((unixSeconds + gmtOffsetSeconds) * 1000);
  return shifted.toISOString().slice(0, 10);
}

export async function fetchYahooDailyBars(code: string, range: string): Promise<HistoryResponse> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(code)}.JK?range=${encodeURIComponent(range)}&interval=1d`;

  let response: Response;
  try {
    response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  } catch (error) {
    return { code, ok: false, bars: [], reason: 'error', message: (error as Error).message };
  }

  if (!response.ok) {
    return {
      code,
      ok: false,
      bars: [],
      reason: response.status === 404 ? 'not_found' : 'error',
      message: response.status === 404 ? undefined : `HTTP ${response.status}`,
    };
  }

  let payload: YahooChartPayload;
  try {
    payload = await response.json();
  } catch {
    return { code, ok: false, bars: [], reason: 'error', message: 'Invalid JSON from Yahoo' };
  }

  const result = payload?.chart?.result?.[0];
  if (!result) {
    return { code, ok: false, bars: [], reason: 'not_found' };
  }

  const timestamps: number[] = result.timestamp || [];
  const quote = result.indicators?.quote?.[0] || {};
  const gmtOffset: number = result.meta?.gmtoffset || 0;

  const bars: OHLCVBar[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const open = quote.open?.[i];
    const high = quote.high?.[i];
    const low = quote.low?.[i];
    const close = quote.close?.[i];
    const volume = quote.volume?.[i];

    if (open == null || high == null || low == null || close == null) continue;

    bars.push({
      date: toDateString(timestamps[i], gmtOffset),
      open,
      high,
      low,
      close,
      volume: volume == null ? 0 : volume,
    });
  }

  if (bars.length === 0) {
    return { code, ok: false, bars: [], reason: 'not_found' };
  }

  return { code, ok: true, bars, source: 'yahoo' };
}
