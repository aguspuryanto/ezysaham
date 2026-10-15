import {
  BrokerActivityDetail,
  BrokerActivityResponse,
  BrokerActivityUnavailableReason,
  BrokerSummaryRow,
  ForeignFlowDetail,
  SmartMoneyFlowsResponse,
  SmartMoneyForeignDay,
} from '@/domain/models/BrokerSummary';

/**
 * Server-only client for the Index Alpha REST API (https://indexalpha.id).
 * Never import this from client-side code (repositories/presentation) — the
 * Bearer token must stay out of the browser bundle. Only Route Handlers under
 * `src/app/api/**` may call these functions.
 *
 * Requires a paid Starter+ plan (broker-summary/foreign-flow are not on the
 * Free tier) and INDEX_ALPHA_API_KEY set in `.env`. When the key is missing
 * we skip the network call entirely rather than burning quota on a 401.
 */
const BASE_URL = 'https://api.indexalpha.id';

interface RawBrokerSummaryRow {
  code: string;
  buy_freq: number;
  buy_volume: number;
  buy_value: number;
  sell_freq: number;
  sell_volume: number;
  sell_value: number;
  buy_avg: number;
  sell_avg: number;
}

interface RawBrokerSummaryResponse {
  success: boolean;
  data: RawBrokerSummaryRow[] | null;
  error: string | null;
}

interface RawForeignFlowResponse {
  success: boolean;
  data: { foreign_buy: number; foreign_sell: number; net_foreign: number } | null;
  error: string | null;
}

/** Last N calendar days ending on the most recent IDX trading close (WIB).
 *  Over-shooting weekends is fine — the API aggregates the range and
 *  non-trading days simply contribute no activity. */
function getRecentDateRange(days: number): { from: string; to: string } {
  const wibOffsetMs = 7 * 60 * 60 * 1000;
  const nowWib = new Date(Date.now() + wibOffsetMs);
  const toDate = new Date(Date.UTC(nowWib.getUTCFullYear(), nowWib.getUTCMonth(), nowWib.getUTCDate()));
  const fromDate = new Date(toDate.getTime() - days * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { from: fmt(fromDate), to: fmt(toDate) };
}

function getApiKey(): string | null {
  return process.env.INDEX_ALPHA_API_KEY || null;
}

async function indexAlphaGet(
  path: string,
  params: Record<string, string>
): Promise<{ ok: true; json: unknown } | { ok: false; reason: BrokerActivityUnavailableReason; message: string }> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { ok: false, reason: 'not_configured', message: 'INDEX_ALPHA_API_KEY belum diisi di .env' };
  }

  const url = `${BASE_URL}${path}?${new URLSearchParams(params).toString()}`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
    });
  } catch (error) {
    return { ok: false, reason: 'error', message: (error as Error).message };
  }

  if (res.status === 401 || res.status === 403) {
    // The body says which limit was hit (e.g. "Free plan allows 5/day") — worth surfacing.
    const detail = await res.json().then((b: { detail?: unknown }) => (typeof b?.detail === 'string' ? b.detail : null)).catch(() => null);
    return { ok: false, reason: 'quota_exceeded', message: detail ?? `HTTP ${res.status} dari Index Alpha (auth/quota)` };
  }
  if (res.status === 429) {
    return { ok: false, reason: 'rate_limited', message: 'Rate limit per menit Index Alpha terlampaui' };
  }
  if (!res.ok) {
    return { ok: false, reason: 'error', message: `HTTP ${res.status} dari Index Alpha` };
  }

  try {
    return { ok: true, json: await res.json() };
  } catch (error) {
    return { ok: false, reason: 'error', message: (error as Error).message };
  }
}

function normalizeBrokerRow(raw: RawBrokerSummaryRow): BrokerSummaryRow {
  return {
    code: raw.code,
    buyFreq: raw.buy_freq,
    buyVolume: raw.buy_volume,
    buyValue: raw.buy_value,
    sellFreq: raw.sell_freq,
    sellVolume: raw.sell_volume,
    sellValue: raw.sell_value,
    buyAvg: raw.buy_avg,
    sellAvg: raw.sell_avg,
    netValue: raw.buy_value - raw.sell_value,
  };
}

/**
 * Fetches real broker buy/sell activity + foreign flow for one ticker over
 * the last `days` trading days (default 20, matching the 20-day window
 * already used throughout `bandarScore.ts`'s proxy score).
 *
 * Broker-summary and foreign-flow are fetched in parallel; a foreign-flow
 * failure does not fail the whole call — `foreignFlow` is simply null.
 */
export async function fetchBrokerActivity(ticker: string, days = 20): Promise<BrokerActivityResponse> {
  const { from, to } = getRecentDateRange(days);

  const [summaryResult, flowResult] = await Promise.all([
    indexAlphaGet('/stocks/broker-summary', { ticker, from, to, investor: 'all', market: 'RG' }),
    indexAlphaGet('/foreign-flow', { ticker, from, to, market: 'ALL' }),
  ]);

  if (!summaryResult.ok) {
    return { ticker, ok: false, reason: summaryResult.reason, message: summaryResult.message, data: null };
  }

  const summaryPayload = summaryResult.json as RawBrokerSummaryResponse;
  if (!summaryPayload?.success || !summaryPayload.data) {
    return { ticker, ok: false, reason: 'unavailable', message: summaryPayload?.error ?? 'Data tidak tersedia', data: null };
  }

  const rows = summaryPayload.data.map(normalizeBrokerRow);
  const sortedByNetDesc = [...rows].sort((a, b) => b.netValue - a.netValue);
  const topBuyers = sortedByNetDesc.slice(0, 5);
  const topSellers = [...sortedByNetDesc].reverse().slice(0, 5);

  let foreignFlow: ForeignFlowDetail | null = null;
  if (flowResult.ok) {
    const flowPayload = flowResult.json as RawForeignFlowResponse;
    if (flowPayload?.success && flowPayload.data) {
      foreignFlow = {
        foreignBuy: flowPayload.data.foreign_buy,
        foreignSell: flowPayload.data.foreign_sell,
        netForeign: flowPayload.data.net_foreign,
      };
    }
  }

  const detail: BrokerActivityDetail = {
    ticker,
    rangeFrom: from,
    rangeTo: to,
    topBuyers,
    topSellers,
    foreignFlow,
    source: 'indexalpha',
    fetchedAt: new Date().toISOString(),
  };

  return { ticker, ok: true, data: detail };
}

function parseForeign(json: unknown): ForeignFlowDetail | null {
  const payload = json as RawForeignFlowResponse;
  if (!payload?.success || !payload.data) return null;
  return { foreignBuy: payload.data.foreign_buy, foreignSell: payload.data.foreign_sell, netForeign: payload.data.net_foreign };
}

function parseBrokers(json: unknown): BrokerSummaryRow[] | null {
  const payload = json as RawBrokerSummaryResponse;
  return payload?.success && payload.data ? payload.data.map(normalizeBrokerRow) : null;
}

/**
 * Smart Money Accumulation Hunter flows for one ticker (docs/features_smartmoney_hunter.md), over explicit trading
 * dates (oldest → newest, last = most recent close with published data). Calls run sequentially (per-minute limit)
 * and stop at the first auth/quota refusal, keeping whatever already arrived; parts are null, never zero.
 *
 * Quota: 4 requests (foreign 5D/20D, broker 5D/20D). The API only returns range totals, so the 5-day foreign
 * consistency costs one extra request per day — only when `daily` is set (the Free plan allows 5 requests/day).
 */
export async function fetchSmartMoneyFlows(ticker: string, dates5: string[], from20: string, daily: boolean): Promise<SmartMoneyFlowsResponse> {
  const to = dates5[dates5.length - 1];
  const from5 = dates5[0];
  let reason: BrokerActivityUnavailableReason | undefined;
  let message: string | undefined;
  const blocked = () => reason === 'not_configured' || reason === 'quota_exceeded';
  const get = async (path: string, params: Record<string, string>) => {
    if (blocked()) return null;
    const r = await indexAlphaGet(path, params);
    if (!r.ok) { reason ??= r.reason; message ??= r.message; return null; }
    return r.json;
  };

  const foreign5 = parseForeign(await get('/foreign-flow', { ticker, from: from5, to, market: 'ALL' }));
  const broker5 = parseBrokers(await get('/stocks/broker-summary', { ticker, from: from5, to, investor: 'all', market: 'RG' }));
  const foreign20 = parseForeign(await get('/foreign-flow', { ticker, from: from20, to, market: 'ALL' }));
  const broker20 = parseBrokers(await get('/stocks/broker-summary', { ticker, from: from20, to, investor: 'all', market: 'RG' }));
  const foreignDaily: SmartMoneyForeignDay[] = [];
  if (daily) {
    for (const date of dates5) {
      const f = parseForeign(await get('/foreign-flow', { ticker, from: date, to: date, market: 'ALL' }));
      foreignDaily.push({ date, netForeign: f ? f.netForeign : null });
    }
  }

  const anyData = foreign5 || foreign20 || broker5 || broker20;
  if (!anyData) return { ticker, ok: false, reason: reason ?? 'unavailable', message: message ?? 'Data tidak tersedia', data: null };
  // ok with a reason = partial data (some parts refused); callers should not cache it as final.
  return {
    ticker,
    ok: true,
    ...(reason ? { reason, message } : {}),
    data: {
      ticker, asOf: to, from5, from20, foreignDaily, foreign5, foreign20, broker5, broker20,
      source: 'indexalpha', fetchedAt: new Date().toISOString(),
    },
  };
}
