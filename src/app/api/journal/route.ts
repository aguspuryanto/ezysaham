import { addEntries, gradeAndRead } from '@/data/repositories/JournalRepository';
import { NewJournalEntryInput } from '@/domain/models/JournalEntry';

export async function GET() {
  try {
    const entries = await gradeAndRead();
    return Response.json({ ok: true, entries });
  } catch (error) {
    return Response.json({ ok: false, message: (error as Error).message, entries: [] }, { status: 200 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { entries: NewJournalEntryInput[] };
    if (!Array.isArray(body.entries) || body.entries.length === 0) {
      return Response.json({ ok: false, message: 'Missing entries', entries: [] }, { status: 400 });
    }
    const entries = await addEntries(body.entries);
    return Response.json({ ok: true, entries });
  } catch (error) {
    return Response.json({ ok: false, message: (error as Error).message, entries: [] }, { status: 200 });
  }
}
