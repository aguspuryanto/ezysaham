import "server-only";

/*
 * Pengambil data Yahoo Finance (dipindahkan dari branch main):
 *  - v8/finance/chart        → OHLCV harian saham (.JK), indeks (^JKSE, ^JKLQ45), kurs (IDR=X), dividen
 *  - v10/finance/quoteSummary → rasio fundamental (butuh handshake cookie + crumb)
 * Endpoint ini tidak resmi; semua fungsi mengembalikan null/[] saat gagal, bukan melempar error.
 */

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export interface YahooBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface YahooChart {
  symbol: string;
  bars: YahooBar[];
  price: number | null;
  prevClose: number | null;
  dayHigh: number | null;
  dayLow: number | null;
}

export function toDateString(unixSeconds: number, gmtOffsetSeconds: number): string {
  return new Date((unixSeconds + gmtOffsetSeconds) * 1000).toISOString().slice(0, 10);
}

/** Simbol saham BEI butuh akhiran .JK; indeks/kurs (^JKSE, IDR=X) dipakai apa adanya. */
export function yahooSymbol(code: string) {
  return /[\^=.]/.test(code) ? code : `${code.toUpperCase()}.JK`;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function fetchYahooChart(code: string, range: string, revalidate = 600): Promise<YahooChart | null> {
  const symbol = yahooSymbol(code);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${encodeURIComponent(range)}&interval=1d`;
  let payload: any;
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, next: { revalidate } });
    if (!res.ok) return null;
    payload = await res.json();
  } catch {
    return null;
  }

  const result = payload?.chart?.result?.[0];
  if (!result) return null;
  const meta = result.meta ?? {};
  const timestamps: number[] = result.timestamp ?? [];
  const quote = result.indicators?.quote?.[0] ?? {};
  const gmtOffset: number = meta.gmtoffset ?? 0;
  const live: number | undefined = meta.regularMarketPrice;

  const byDate = new Map<string, YahooBar>();
  for (let i = 0; i < timestamps.length; i++) {
    let open = quote.open?.[i];
    let high = quote.high?.[i];
    let low = quote.low?.[i];
    let close = quote.close?.[i];
    // Sesi yang masih berjalan belum punya OHLC final — pakai harga live.
    if (i === timestamps.length - 1 && close == null && live != null) {
      open ??= live;
      high ??= live;
      low ??= live;
      close = live;
    }
    if (open == null || high == null || low == null || close == null) continue;
    const date = toDateString(timestamps[i], gmtOffset);
    byDate.set(date, { date, open, high, low, close, volume: quote.volume?.[i] ?? 0 });
  }
  const bars = [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));

  // Previous close = penutupan bar sebelum bar terakhir (chartPreviousClose = awal rentang, bukan kemarin)
  const prevClose = bars.length >= 2 ? bars[bars.length - 2].close : (meta.chartPreviousClose ?? null);
  return {
    symbol,
    bars,
    price: live ?? bars.at(-1)?.close ?? null,
    prevClose,
    dayHigh: meta.regularMarketDayHigh ?? bars.at(-1)?.high ?? null,
    dayLow: meta.regularMarketDayLow ?? bars.at(-1)?.low ?? null,
  };
}

// ---------------- Fundamental (quoteSummary) ----------------

interface YahooSession {
  cookie: string;
  crumb: string;
}
let cachedSession: YahooSession | null = null;
let sessionPromise: Promise<YahooSession | null> | null = null;

/** Ikuti redirect fc.yahoo.com manual sambil mengumpulkan Set-Cookie di setiap hop. */
async function primeCookie(): Promise<string> {
  const cookies: string[] = [];
  let url = "https://fc.yahoo.com";
  for (let hop = 0; hop < 5; hop++) {
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, Cookie: cookies.join("; ") },
        redirect: "manual",
        cache: "no-store",
      });
    } catch {
      break;
    }
    for (const c of res.headers.getSetCookie?.() ?? []) cookies.push(c.split(";")[0]);
    const location = res.headers.get("location");
    if (!location || res.status < 300 || res.status >= 400) break;
    url = new URL(location, url).toString();
  }
  return cookies.join("; ");
}

async function fetchCrumb(cookie: string): Promise<string | null> {
  try {
    const res = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
      headers: { "User-Agent": USER_AGENT, Cookie: cookie },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const text = (await res.text()).trim();
    return !text || text.startsWith("{") ? null : text;
  } catch {
    return null;
  }
}

async function getSession(forceRefresh: boolean): Promise<YahooSession | null> {
  if (forceRefresh) {
    cachedSession = null;
    sessionPromise = null;
  }
  if (cachedSession) return cachedSession;
  sessionPromise ??= (async () => {
    const cookie = await primeCookie();
    const crumb = cookie ? await fetchCrumb(cookie) : null;
    cachedSession = cookie && crumb ? { cookie, crumb } : null;
    sessionPromise = null;
    return cachedSession;
  })();
  return sessionPromise;
}

const raw = (node: unknown): number | null => {
  const v = (node as { raw?: unknown } | undefined)?.raw;
  return typeof v === "number" && Number.isFinite(v) ? v : null;
};
const pct = (v: number | null) => (v == null ? null : v * 100);

export interface YahooFundamentals {
  dividendYield: number | null;
  payoutRatio: number | null;
  dividendPerShare: number | null;
  dividendHistory: { date: string; amount: number }[];
  der: number | null;
  currentRatio: number | null;
  netMargin: number | null;
  revenueGrowth: number | null;
  earningsGrowth: number | null;
}

/** Riwayat dividen 5 tahun (endpoint chart, tanpa crumb). */
async function fetchDividendHistory(code: string): Promise<{ date: string; amount: number }[]> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol(code))}?range=5y&interval=1mo&events=div`,
      { headers: { "User-Agent": USER_AGENT }, next: { revalidate: 21600 } },
    );
    if (!res.ok) return [];
    const result = (await res.json())?.chart?.result?.[0];
    const divs = result?.events?.dividends as Record<string, { amount: number; date: number }> | undefined;
    if (!divs) return [];
    const off = result.meta?.gmtoffset ?? 0;
    return Object.values(divs)
      .map((d) => ({ date: toDateString(d.date, off), amount: d.amount }))
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  } catch {
    return [];
  }
}

/**
 * Dividen & rasio neraca untuk satu saham. null = data tidak tersedia (bukan nol).
 * Catatan skema Yahoo: dividendYield/payoutRatio/profitMargins/*Growth berupa pecahan,
 * sedangkan debtToEquity (sudah %) dan currentRatio (sudah x) tidak.
 */
export async function fetchYahooFundamentals(code: string): Promise<YahooFundamentals | null> {
  const symbol = yahooSymbol(code);
  const historyPromise = fetchDividendHistory(code);

  for (let attempt = 0; attempt < 2; attempt++) {
    const session = await getSession(attempt > 0);
    if (!session) continue;
    let res: Response;
    try {
      res = await fetch(
        `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=summaryDetail,financialData&crumb=${encodeURIComponent(session.crumb)}`,
        { headers: { "User-Agent": USER_AGENT, Cookie: session.cookie }, next: { revalidate: 21600 } },
      );
    } catch {
      return null;
    }
    if (res.status === 401) continue; // crumb basi — ulangi sekali dengan session baru
    if (!res.ok) return null;
    let payload: any;
    try {
      payload = await res.json();
    } catch {
      return null;
    }
    const result = payload?.quoteSummary?.result?.[0];
    if (!result) return null;
    const sd = result.summaryDetail;
    const fd = result.financialData;
    return {
      dividendYield: pct(raw(sd?.dividendYield)),
      payoutRatio: pct(raw(sd?.payoutRatio)),
      dividendPerShare: raw(sd?.trailingAnnualDividendRate),
      dividendHistory: await historyPromise,
      der: raw(fd?.debtToEquity),
      currentRatio: raw(fd?.currentRatio),
      netMargin: pct(raw(fd?.profitMargins)),
      revenueGrowth: pct(raw(fd?.revenueGrowth)),
      earningsGrowth: pct(raw(fd?.earningsGrowth)),
    };
  }
  return null;
}
