import { IntradayResponse } from '@/domain/models/Intraday';

/**
 * 1-minute intraday bars for the current/last trading session, via Yahoo Finance's
 * unofficial chart endpoint. Separate from yahooFinance.ts (daily bars) since the
 * parsing rules differ in one important way: a null close here (e.g. IDX's
 * 11:30-13:59 WIB lunch break — confirmed to produce ~150 consecutive null minutes
 * even on liquid tickers) is dropped, never forward-filled, unlike the daily
 * fetcher's single still-open-day regularMarketPrice patch.
 */
export async function fetchYahooIntradayBars(code: string): Promise<IntradayResponse> {
  const symbol = `${code}.JK`;
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?range=1d&interval=1m&includePrePost=true&events=div%7Csplit%7Cearn&lang=en-US&region=US&source=cosaic`;

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

  let payload: any;
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
  const previousClose: number | undefined = result.meta?.chartPreviousClose ?? result.meta?.previousClose;
  const regular = result.meta?.currentTradingPeriod?.regular;
  const session = regular ? { regularStart: regular.start, regularEnd: regular.end } : undefined;

  const bars: IntradayResponse['bars'] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const price = quote.close?.[i];
    if (price == null) continue; // lunch break / in-progress minute — drop, don't forward-fill
    const volume = quote.volume?.[i];
    bars.push({ time: timestamps[i], price, volume: volume == null ? 0 : volume });
  }

  if (bars.length === 0) {
    return { code, ok: false, bars: [], reason: 'not_found' };
  }

  return { code, ok: true, bars, previousClose, session, source: 'yahoo' };
}
