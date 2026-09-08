import { fetchBrokerActivity } from '@/data/external/indexAlpha';

// Index Alpha's broker/foreign-flow data updates once a day (19:00 WIB) and
// quota is paid + tight (Starter: 25k/month) — a long cache both matches the
// real update cadence and keeps per-ticker request volume low.
export const revalidate = 43200; // 12 hours

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code: rawCode } = await params;
  const code = rawCode.toUpperCase();

  if (!code) {
    return Response.json(
      { ticker: code, ok: false, reason: 'error', message: 'Missing ticker code', data: null },
      { status: 400 }
    );
  }

  try {
    const result = await fetchBrokerActivity(code);
    return Response.json(result, {
      headers: {
        'Cache-Control': 'public, max-age=43200, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    // Third-party paid API — never let an outage/shape change or exhausted
    // quota surface as an uncaught 500; the panel just hides itself instead.
    return Response.json(
      { ticker: code, ok: false, reason: 'error', message: (error as Error).message, data: null },
      { status: 200 }
    );
  }
}
