import { deleteEntry } from '@/data/repositories/JournalRepository';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const entries = await deleteEntry(id);
    return Response.json({ ok: true, entries });
  } catch (error) {
    return Response.json({ ok: false, message: (error as Error).message, entries: [] }, { status: 200 });
  }
}
