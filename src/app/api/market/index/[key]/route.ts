import { fetchYahooIndexBars } from '@/data/external/yahooFinance';

export const revalidate = 900; // 15 minutes cache revalidation

/** Whitelisted market series for the Screener's Market Summary — never an arbitrary symbol. */
const SYMBOLS: Record<string, string> = {
  ihsg: '^JKSE',
  lq45: '^JKLQ45',
  usdidr: 'IDR=X',
};

export async function GET(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const symbol = SYMBOLS[key.toLowerCase()];
  if (!symbol) {
    return Response.json({ code: key, ok: false, reason: 'not_found', message: 'Unknown market series' }, { status: 404 });
  }
  const range = new URL(request.url).searchParams.get('range') || '1mo';
  const result = await fetchYahooIndexBars(symbol, range);
  return Response.json(result, {
    headers: {
      'Cache-Control': 'public, max-age=900, stale-while-revalidate=1800',
    },
  });
}
