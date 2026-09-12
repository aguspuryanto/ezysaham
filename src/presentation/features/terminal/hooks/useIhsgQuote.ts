'use client';

import { useEffect, useState } from 'react';
import { getIhsgHistory } from '@/data/repositories/MarketRepository';

export interface IhsgQuote {
  value: number;
  changePct: number;
}

/** Real IHSG last value + 1-day change, reusing the same repository IhsgChart uses. */
export function useIhsgQuote(): IhsgQuote | null {
  const [quote, setQuote] = useState<IhsgQuote | null>(null);

  useEffect(() => {
    let cancelled = false;
    getIhsgHistory('5d')
      .then((bars) => {
        if (cancelled || bars.length < 2) return;
        const last = bars[bars.length - 1];
        const prev = bars[bars.length - 2];
        const changePct = prev.close !== 0 ? ((last.close - prev.close) / prev.close) * 100 : 0;
        setQuote({ value: last.close, changePct });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return quote;
}
