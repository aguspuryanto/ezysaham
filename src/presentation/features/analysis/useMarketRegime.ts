'use client';

/**
 * useMarketRegime.ts
 *
 * Shared fetch/compute path for the IHSG-based market regime classification.
 * Extracted from `IhsgChart.tsx`'s existing inline effect so the Decision
 * Engine can consume the same regime without duplicating the fetch.
 *
 * Needs 200+ daily bars to seed EMA200 — '1y' gives ~250 trading days,
 * independent of any chart range the caller might separately display.
 */

import { useEffect, useMemo, useState } from 'react';
import { getIhsgHistory } from '@/data/repositories/MarketRepository';
import { computeMarketRegime, MarketRegimeResult } from '@/domain/analysis/marketRegimeEngine';

const REGIME_RANGE = '1y';
const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

export function useMarketRegime(): { regime: MarketRegimeResult | null; loading: boolean } {
  const [bars, setBars] = useState<import('@/domain/models/History').OHLCVBar[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchRegime = async () => {
      try {
        const result = await getIhsgHistory(REGIME_RANGE);
        if (!cancelled && result.length > 0) {
          setBars(result);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchRegime();
    const interval = setInterval(fetchRegime, FIFTEEN_MINUTES_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const regime = useMemo(() => (bars ? computeMarketRegime(bars) : null), [bars]);

  return { regime, loading };
}
