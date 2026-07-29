import { fetchYahooIndexBars } from '@/data/external/yahooFinance';

export async function GET(request: Request) {
  const range = new URL(request.url).searchParams.get('range') || '1mo';
  const result = await fetchYahooIndexBars('^JKSE', range);
  return Response.json(result);
}
