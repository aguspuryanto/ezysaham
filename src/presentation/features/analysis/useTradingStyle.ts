'use client';

/**
 * useTradingStyle.ts
 *
 * Custom hook untuk menyimpan dan membaca preferensi gaya trading pengguna.
 * Nilai disimpan di localStorage agar persisten antar sesi.
 *
 * Preferensi:
 *  - maxClPct   : batas maksimal cut loss dari entry (default 7%)
 *  - minTp1Pct  : target minimum Take Profit 1 dari entry (default 10%)
 *  - minTp2Pct  : target minimum Take Profit 2 dari entry (default 15%)
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export interface TradingStylePrefs {
  maxClPct: number;   // 1–20
  minTp1Pct: number;  // 3–50
  minTp2Pct: number;  // 5–100
}

const STORAGE_KEY = 'ezy_trading_style_v1';

const DEFAULTS: TradingStylePrefs = {
  maxClPct: 7,
  minTp1Pct: 10,
  minTp2Pct: 15,
};

function loadPrefs(): TradingStylePrefs {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<TradingStylePrefs>;
    return {
      maxClPct: clamp(parsed.maxClPct ?? DEFAULTS.maxClPct, 1, 20),
      minTp1Pct: clamp(parsed.minTp1Pct ?? DEFAULTS.minTp1Pct, 3, 50),
      minTp2Pct: clamp(parsed.minTp2Pct ?? DEFAULTS.minTp2Pct, 5, 100),
    };
  } catch {
    return DEFAULTS;
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function useTradingStyle() {
  const [prefs, setPrefsState] = useState<TradingStylePrefs>(DEFAULTS);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydrate dari localStorage setelah mount (SSR safe)
  useEffect(() => {
    setPrefsState(loadPrefs());
  }, []);

  const setPrefs = useCallback((updates: Partial<TradingStylePrefs>) => {
    setPrefsState((prev) => {
      const next: TradingStylePrefs = {
        maxClPct: clamp(updates.maxClPct ?? prev.maxClPct, 1, 20),
        minTp1Pct: clamp(updates.minTp1Pct ?? prev.minTp1Pct, 3, 50),
        minTp2Pct: clamp(updates.minTp2Pct ?? prev.minTp2Pct, 5, 100),
      };

      // Debounced localStorage save (300ms)
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore quota errors
        }
      }, 300);

      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setPrefsState(DEFAULTS);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  return { prefs, setPrefs, reset };
}
