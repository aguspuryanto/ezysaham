import { PASARDANA_LIST_URL } from '@/data/external/pasardana';

// Run per request instead of ISR-prerendering: a prerendered response is served stale
// to the first visitor after each window (e.g. the first load after EOD showed the
// previous day). Upstream is still shared-cached for 60s via the fetch data cache + CDN.
export const dynamic = 'force-dynamic';

const UPSTREAM_REVALIDATE_SECONDS = 60;

export async function GET() {
  try {
    const response = await fetch(PASARDANA_LIST_URL, {
      next: { revalidate: UPSTREAM_REVALIDATE_SECONDS },
    });
    if (!response.ok) {
      throw new Error(`Network response was not ok: ${response.statusText}`);
    }
    const data = await response.json();
    return Response.json(data, {
      headers: {
        'X-Fetched-At': new Date().toISOString(),
        // No browser caching (max-age=0) so Refresh / a reopened tab always reaches the
        // server; the CDN may share a response for up to a minute.
        'Cache-Control': `public, max-age=0, s-maxage=${UPSTREAM_REVALIDATE_SECONDS}, stale-while-revalidate=${UPSTREAM_REVALIDATE_SECONDS}`,
      },
    });
  } catch (error) {
    console.error('Error fetching from pasardana:', error);
    return Response.json({ error: 'Failed to fetch stocks' }, { status: 500 });
  }
}
