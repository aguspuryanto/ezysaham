'use client';

import { useCallback, useEffect, useState } from 'react';
import { getSignalDashboard } from '@/data/repositories/SignalRepository';
import { SignalDashboardData } from '@/domain/models/Signal';

type LoadResult = { key: string; data: SignalDashboardData; error: null } | { key: string; data: null; error: string };

/** Loads the SARA signal batch for `date`; `refresh()` re-fetches the same date. */
export function useSignals(date: string) {
  const [nonce, setNonce] = useState(0);
  const [result, setResult] = useState<LoadResult | null>(null);
  const key = `${date}#${nonce}`;

  useEffect(() => {
    let cancelled = false;
    getSignalDashboard(date)
      .then((data) => { if (!cancelled) setResult({ key, data, error: null }); })
      .catch((e: unknown) => {
        if (!cancelled) setResult({ key, data: null, error: e instanceof Error ? e.message : 'Gagal memuat sinyal.' });
      });
    return () => { cancelled = true; };
  }, [date, key]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);
  const loading = result?.key !== key;

  return {
    loading,
    data: loading ? null : result?.data ?? null,
    error: loading ? null : result?.error ?? null,
    refresh,
  };
}
