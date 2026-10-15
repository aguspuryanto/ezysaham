import { fetchSmartMoneyFlows } from '@/data/external/indexAlpha';
import { fetchYahooIndexBars } from '@/data/external/yahooFinance';
import { SmartMoneyFlowsResponse } from '@/domain/models/BrokerSummary';

// Index Alpha publishes once a day (19:00 WIB) and the quota is tight (Free plan: 5 requests/day, 150/month;
// this route costs 4, or 9 with daily foreign consistency), so results are cached per ticker + trading date for
// the life of the instance and 12 hours at the CDN.
export const revalidate = 43200;

const PUBLISH_HOUR_WIB = 19;
/** Opt-in: 5 extra requests per stock for "net buy asing 4 dari 5 hari". Enable on a paid plan. */
const DAILY_FOREIGN = process.env.INDEX_ALPHA_FOREIGN_DAILY === '1';
const memo = new Map<string, SmartMoneyFlowsResponse>();

/** Last 20 IDX trading dates with published flow data (IHSG calendar; today only after 19:00 WIB). */
async function flowDates(): Promise<string[] | null> {
  const ihsg = await fetchYahooIndexBars('^JKSE', '3mo');
  if (!ihsg.ok || ihsg.bars.length < 20) return null;
  const now = new Date();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(now);
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', hour12: false }).format(now));
  const dates = ihsg.bars.map((b) => b.date.slice(0, 10)).filter((d) => d < today || (d === today && hour >= PUBLISH_HOUR_WIB));
  return dates.length >= 20 ? dates.slice(-20) : null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code: rawCode } = await params;
  const code = rawCode.toUpperCase();
  const fail = (message: string, status = 200): Response =>
    Response.json({ ticker: code, ok: false, reason: 'error', message, data: null } satisfies SmartMoneyFlowsResponse, { status });

  if (!/^[A-Z0-9]{2,8}$/.test(code)) return fail('Kode saham tidak valid', 400);

  try {
    const dates = await flowDates();
    if (!dates) return fail('Kalender bursa (IHSG) tidak tersedia');
    const key = `${code}|${dates[dates.length - 1]}`;
    let result = memo.get(key);
    if (!result) {
      result = await fetchSmartMoneyFlows(code, dates.slice(-5), dates[0], DAILY_FOREIGN);
      if (result.ok && !result.reason) memo.set(key, result);
    }
    // Partial or failed results are not cached, so they can be completed once the daily quota resets.
    const complete = result.ok && !result.reason;
    return Response.json(result, {
      headers: complete ? { 'Cache-Control': 'public, max-age=43200, stale-while-revalidate=86400' } : { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    // Paid third-party API — an outage or shape change must not surface as an uncaught 500.
    return fail((error as Error).message);
  }
}
