import { fetchYahooFundamentals } from '@/data/external/yahooFundamentals';

// Fundamentals move slowly (quarterly reports) and the source endpoint is an
// unofficial/undocumented Yahoo API — a long cache both matches the data's
// real update cadence and keeps per-ticker request volume low.
export const revalidate = 21600; // 6 hours

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code: rawCode } = await params;
  const code = rawCode.toUpperCase();

  if (!code) {
    return Response.json(null, { status: 400 });
  }

  const result = await fetchYahooFundamentals(code);
  return Response.json(result, {
    headers: {
      'Cache-Control': 'public, max-age=21600, stale-while-revalidate=43200',
    },
  });
}
