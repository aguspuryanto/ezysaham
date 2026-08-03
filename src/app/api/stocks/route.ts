import { PASARDANA_LIST_URL } from '@/data/external/pasardana';

export const revalidate = 300; // 5 minutes cache in Next.js

export async function GET() {
  try {
    const response = await fetch(PASARDANA_LIST_URL, {
      next: { revalidate: 300 },
    });
    if (!response.ok) {
      throw new Error(`Network response was not ok: ${response.statusText}`);
    }
    const data = await response.json();
    return Response.json(data, {
      headers: {
        'X-Fetched-At': new Date().toISOString(),
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('Error fetching from pasardana:', error);
    return Response.json({ error: 'Failed to fetch stocks' }, { status: 500 });
  }
}
