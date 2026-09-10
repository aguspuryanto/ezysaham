'use client';

import { useCallback, useEffect, useState } from 'react';
import { JournalEntry, NewJournalEntryInput } from '@/domain/models/JournalEntry';
import type { JournalEntryEditableFields } from '@/data/repositories/JournalRepository';

export function useJournal() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/journal');
      const data = await response.json();
      setEntries(data.ok ? data.entries : []);
    } finally {
      setLoading(false);
    }
  }, []);

  const addEntries = useCallback(async (inputs: NewJournalEntryInput[]) => {
    const response = await fetch('/api/journal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries: inputs }),
    });
    const data = await response.json();
    if (data.ok) setEntries(data.entries);
    return data as { ok: boolean; message?: string; entries: JournalEntry[] };
  }, []);

  const removeEntry = useCallback(async (id: string) => {
    const response = await fetch(`/api/journal/${id}`, { method: 'DELETE' });
    const data = await response.json();
    if (data.ok) setEntries(data.entries);
    return data as { ok: boolean; message?: string; entries: JournalEntry[] };
  }, []);

  const updateEntry = useCallback(async (id: string, patch: Partial<JournalEntryEditableFields>) => {
    const response = await fetch(`/api/journal/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const data = await response.json();
    if (data.ok) setEntries(data.entries);
    return data as { ok: boolean; message?: string; entries: JournalEntry[] };
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { entries, loading, refresh, addEntries, removeEntry, updateEntry };
}
