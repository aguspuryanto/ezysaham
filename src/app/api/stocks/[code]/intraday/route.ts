import { fetchYahooIntradayBars } from '@/data/external/yahooIntraday';

export const revalidate = 60; // 1 minute cache — intraday data is 1-minute granular

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code: rawCode } = await params;
  const code = rawCode.toUpperCase();

  if (!code) {
    return Response.json(
      { code, ok: false, bars: [], reason: 'error', message: 'Missing ticker code' },
      { status: 400 }
    );
  }

  try {
    const result = await fetchYahooIntradayBars(code);
    return Response.json(result, {
      headers: {
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=120',
      },
    });
  } catch (error) {
    // Unofficial, unauthenticated upstream endpoint — never let an unexpected
    // shape/rate-limit change surface as an uncaught 500.
    return Response.json(
      { code, ok: false, bars: [], reason: 'error', message: (error as Error).message },
      { status: 200 }
    );
  }
}
