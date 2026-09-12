'use client';

import { useEffect, useState } from 'react';
import { getStockHistory } from '@/data/repositories/StockRepository';
import { relativeVolume } from '@/domain/indicators/volume';
import { mapWithConcurrency } from '@/lib/concurrency';

const CONCURRENCY = 6;

// Module-level so the table's per-visible-row fetches and the stat cards'
// top-20 fetch share one cache for the page's lifetime — a ticker's RVOL is
// only ever fetched once, however many components ask for it.
const rvolCache = new Map<string, number | null>();

/**
 * Lazily fetches and caches relative volume (volume / 20-day average volume)
 * for a bounded list of tickers — used where a preset's evaluate() hasn't
 * already computed `relativeVolume` (e.g. the "Semua Saham" view, or the
 * table's currently visible page). Real data, fetched on demand rather than
 * for the whole ~900-stock universe up front.
 */
export function useLazyRvol(tickers: string[]): Record<string, number | null> {
  const [, forceRerender] = useState(0);
  const key = tickers.join(',');

  useEffect(() => {
    const missing = tickers.filter((t) => !rvolCache.has(t));
    if (missing.length === 0) return;
    let cancelled = false;

    mapWithConcurrency(missing, CONCURRENCY, async (ticker) => {
      const bars = await getStockHistory(ticker);
      const rvol = bars.length > 0 ? relativeVolume(bars, 20) : NaN;
      rvolCache.set(ticker, Number.isNaN(rvol) ? null : rvol);
    }).then(() => {
      if (!cancelled) forceRerender((n) => n + 1);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const out: Record<string, number | null> = {};
  for (const t of tickers) out[t] = rvolCache.get(t) ?? null;
  return out;
}
