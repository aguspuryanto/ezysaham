import { PASARDANA_LIST_URL } from '@/data/external/pasardana';

export async function GET() {
  try {
    const response = await fetch(PASARDANA_LIST_URL);
    if (!response.ok) {
      throw new Error(`Network response was not ok: ${response.statusText}`);
    }
    const data = await response.json();
    return Response.json(data);
  } catch (error) {
    console.error('Error fetching from pasardana:', error);
    return Response.json({ error: 'Failed to fetch stocks' }, { status: 500 });
  }
}
