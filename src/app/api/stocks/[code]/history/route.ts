import { fetchYahooDailyBars } from '@/data/external/yahooFinance';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code: rawCode } = await params;
  const code = rawCode.toUpperCase();
  const range = new URL(request.url).searchParams.get('range') || '2y';

  if (!code) {
    return Response.json(
      { code, ok: false, reason: 'error', message: 'Missing ticker code' },
      { status: 400 }
    );
  }

  const result = await fetchYahooDailyBars(code, range);
  return Response.json(result);
}
