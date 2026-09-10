/**
 * Server-only repository for the trading journal. Persists as a single JSON
 * document (`journal/entries.json`) in Vercel Blob — read-modify-written on
 * every mutation. Single-user tool with infrequent manual writes, so a naive
 * read → mutate → overwrite (no transactions/etag guard) is an accepted v1 risk.
 *
 * Never import this from client-side code ('use client' files) — only Route
 * Handlers under src/app/api/journal/** may call these functions.
 */
import { get, put } from '@vercel/blob';
import { fetchYahooDailyBars } from '@/data/external/yahooFinance';
import { JournalEntry, NewJournalEntryInput } from '@/domain/models/JournalEntry';

const JOURNAL_PATHNAME = 'journal/entries.json';

async function readJournal(): Promise<JournalEntry[]> {
  const result = await get(JOURNAL_PATHNAME, { access: 'private', useCache: false });
  if (!result || !result.stream) return [];
  const text = await new Response(result.stream).text();
  if (!text) return [];
  return JSON.parse(text) as JournalEntry[];
}

async function writeJournal(entries: JournalEntry[]): Promise<void> {
  await put(JOURNAL_PATHNAME, JSON.stringify(entries), {
    access: 'private',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

export async function addEntries(inputs: NewJournalEntryInput[]): Promise<JournalEntry[]> {
  const entries = await readJournal();
  const now = new Date().toISOString();
  const newEntries: JournalEntry[] = inputs.map((input) => ({
    ...input,
    id: crypto.randomUUID(),
    addedAt: now,
    status: 'open',
    resolvedAt: null,
    exitPrice: null,
    gainLossPct: null,
    daysTracked: 0,
  }));
  const updated = [...entries, ...newEntries];
  await writeJournal(updated);
  return updated;
}

export async function deleteEntry(id: string): Promise<JournalEntry[]> {
  const entries = await readJournal();
  const updated = entries.filter((e) => e.id !== id);
  await writeJournal(updated);
  return updated;
}

export type JournalEntryEditableFields = Pick<
  JournalEntry,
  'entry' | 'tp1' | 'tp2' | 'sl' | 'reasonBuy' | 'reasonAvoid'
>;

export async function updateEntry(
  id: string,
  patch: Partial<JournalEntryEditableFields>
): Promise<JournalEntry[]> {
  const entries = await readJournal();
  if (!entries.some((e) => e.id === id)) {
    throw new Error('Entri jurnal tidak ditemukan');
  }
  const updated = entries.map((e) => (e.id === id ? { ...e, ...patch } : e));
  await writeJournal(updated);
  return updated;
}

/**
 * EOD closing-based grading: resolves an entry off the single next trading
 * day's closing price (H+1) — not intraday high/low, and not a multi-day
 * walk-forward. As soon as that day's close is available: close >= tp1 is a
 * win (tp_hit), close <= sl is a loss (sl_hit), otherwise the position is
 * closed out as "sideways" at that day's actual close. If no next-day bar is
 * available yet, the entry stays "open" for the next gradeAndRead() call.
 */
function resolveEntry(
  entry: JournalEntry,
  bars: Array<{ date: string; close: number }>
): JournalEntry {
  const addedDate = entry.addedAt.slice(0, 10);
  const nextBar = bars.find((b) => b.date > addedDate);
  if (!nextBar) return entry;

  if (nextBar.close >= entry.tp1) {
    return {
      ...entry,
      status: 'tp_hit',
      resolvedAt: nextBar.date,
      exitPrice: entry.tp1,
      gainLossPct: ((entry.tp1 - entry.entry) / entry.entry) * 100,
      daysTracked: 1,
    };
  }
  if (nextBar.close <= entry.sl) {
    return {
      ...entry,
      status: 'sl_hit',
      resolvedAt: nextBar.date,
      exitPrice: entry.sl,
      gainLossPct: ((entry.sl - entry.entry) / entry.entry) * 100,
      daysTracked: 1,
    };
  }
  return {
    ...entry,
    status: 'sideways',
    resolvedAt: nextBar.date,
    exitPrice: nextBar.close,
    gainLossPct: ((nextBar.close - entry.entry) / entry.entry) * 100,
    daysTracked: 1,
  };
}

/** Grades every still-open entry against fresh OHLC bars, persists changes, and returns the full list. */
export async function gradeAndRead(): Promise<JournalEntry[]> {
  const entries = await readJournal();
  const openEntries = entries.filter((e) => e.status === 'open');
  if (openEntries.length === 0) return entries;

  const graded = await Promise.all(
    openEntries.map(async (entry) => {
      const history = await fetchYahooDailyBars(entry.ticker, '3mo');
      if (!history.ok || history.bars.length === 0) return entry;
      return resolveEntry(entry, history.bars);
    })
  );

  const gradedById = new Map(graded.map((e) => [e.id, e]));
  const updated = entries.map((e) => gradedById.get(e.id) ?? e);

  const changed = updated.some((e, i) => e !== entries[i]);
  if (changed) await writeJournal(updated);
  return updated;
}
