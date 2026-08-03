import { fetchYahooIndexBars } from '@/data/external/yahooFinance';

export const revalidate = 900; // 15 minutes cache revalidation

export async function GET(request: Request) {
  const range = new URL(request.url).searchParams.get('range') || '1mo';
  const result = await fetchYahooIndexBars('^JKSE', range);
  return Response.json(result, {
    headers: {
      'Cache-Control': 'public, max-age=900, stale-while-revalidate=1800',
    },
  });
}
