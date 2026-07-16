'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'stockpilot:watchlist';

export function useWatchlist() {
  const [tickers, setTickers] = useState<string[]>([]);

  useEffect(() => {
    Promise.resolve().then(() => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) setTickers(JSON.parse(raw));
      } catch {
        // localStorage unavailable (private mode, disabled storage) — watchlist just won't persist.
      }
    });
  }, []);

  const toggle = useCallback((ticker: string) => {
    setTickers((prev) => {
      const next = prev.includes(ticker) ? prev.filter((t) => t !== ticker) : [...prev, ticker];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const has = useCallback((ticker: string) => tickers.includes(ticker), [tickers]);

  return { tickers, toggle, has };
}
