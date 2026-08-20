import { FundamentalDetail } from '@/domain/models/Fundamentals';

/**
 * Yahoo's fundamentals endpoint (v10/finance/quoteSummary) is not documented
 * or officially supported — unlike the v8/finance/chart endpoint used for
 * OHLCV bars, it now requires a crumb + cookie handshake. This session is
 * cached per server process and reused across tickers; it's only refetched
 * on a 401 (stale crumb) or when no session exists yet.
 */
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

interface YahooSession {
  cookie: string;
  crumb: string;
}

let cachedSession: YahooSession | null = null;
let sessionPromise: Promise<YahooSession | null> | null = null;

/** Follows fc.yahoo.com's redirect chain manually, collecting Set-Cookie at every hop
 *  (fetch's automatic redirect following only exposes the final response's headers). */
async function primeCookie(): Promise<string> {
  const cookies: string[] = [];
  let url = 'https://fc.yahoo.com';
  for (let hop = 0; hop < 5; hop++) {
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Cookie: cookies.join('; ') },
        redirect: 'manual',
      });
    } catch {
      break;
    }
    const setCookie = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
    for (const c of setCookie) cookies.push(c.split(';')[0]);
    const location = res.headers.get('location');
    if (!location || res.status < 300 || res.status >= 400) break;
    url = new URL(location, url).toString();
  }
  return cookies.join('; ');
}

async function fetchCrumb(cookie: string): Promise<string | null> {
  try {
    const res = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
      headers: { 'User-Agent': USER_AGENT, Cookie: cookie },
    });
    if (!res.ok) return null;
    const text = (await res.text()).trim();
    if (!text || text.startsWith('{')) return null; // error payloads are JSON; a real crumb is a short opaque token
    return text;
  } catch {
    return null;
  }
}

async function createSession(): Promise<YahooSession | null> {
  const cookie = await primeCookie();
  if (!cookie) return null;
  const crumb = await fetchCrumb(cookie);
  if (!crumb) return null;
  return { cookie, crumb };
}

async function getSession(forceRefresh: boolean): Promise<YahooSession | null> {
  if (forceRefresh) {
    cachedSession = null;
    sessionPromise = null;
  }
  if (cachedSession) return cachedSession;
  if (!sessionPromise) {
    sessionPromise = createSession().then((session) => {
      cachedSession = session;
      sessionPromise = null;
      return session;
    });
  }
  return sessionPromise;
}

function pickRaw(node: unknown): number | null {
  const raw = (node as { raw?: unknown } | undefined)?.raw;
  return typeof raw === 'number' ? raw : null;
}

/**
 * Fetches dividend & balance-sheet-ratio fields for one IDX ticker.
 * Returns null on any failure (network error, rate limit, or a stale
 * crumb/cookie even after one retry) — callers must treat that as "data
 * unavailable" for this ticker, not as zero.
 */
export async function fetchYahooFundamentals(code: string): Promise<FundamentalDetail | null> {
  const symbol = `${code}.JK`;
  const modules = 'summaryDetail,financialData';

  for (let attempt = 0; attempt < 2; attempt++) {
    const session = await getSession(attempt > 0);
    if (!session) continue;

    let res: Response;
    try {
      res = await fetch(
        `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}&crumb=${encodeURIComponent(session.crumb)}`,
        { headers: { 'User-Agent': USER_AGENT, Cookie: session.cookie } }
      );
    } catch {
      return null;
    }

    if (res.status === 401) continue; // stale crumb/cookie — retry once with a fresh session
    if (!res.ok) return null;

    let payload: any;
    try {
      payload = await res.json();
    } catch {
      return null;
    }

    const result = payload?.quoteSummary?.result?.[0];
    if (!result) return null;

    const summaryDetail = result.summaryDetail;
    const financialData = result.financialData;

    // dividendYield/payoutRatio are fractions (0.0565 = 5.65%); debtToEquity/
    // currentRatio are not (18.1 already means 18.1%, 0.57 already means 0.57x) —
    // an inconsistency in Yahoo's own schema, confirmed empirically per-field.
    const dividendYieldRaw = pickRaw(summaryDetail?.dividendYield);
    const payoutRatioRaw = pickRaw(summaryDetail?.payoutRatio);

    return {
      ticker: code,
      dividendYield: dividendYieldRaw != null ? dividendYieldRaw * 100 : null,
      dividendPayoutRatio: payoutRatioRaw != null ? payoutRatioRaw * 100 : null,
      debtToEquity: pickRaw(financialData?.debtToEquity),
      currentRatio: pickRaw(financialData?.currentRatio),
      source: 'yahoo',
      fetchedAt: new Date().toISOString(),
    };
  }

  return null;
}
