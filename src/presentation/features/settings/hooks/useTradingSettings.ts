'use client';

/**
 * useTradingSettings.ts
 *
 * Client-side override of `DEFAULT_TRADING_CONFIG` (EzySaham 2.0 Decision
 * Engine parameters — capital, risk per trade, minimum R:R, etc). Persisted
 * to localStorage, same pattern as `useTradingStyle.ts`. No account/DB layer
 * exists yet, so these settings are per-browser, not per-account.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_TRADING_CONFIG, TradingConfig } from '@/domain/config/tradingConfig';

const STORAGE_KEY = 'ezy_trading_settings_v1';

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function sanitize(partial: Partial<TradingConfig>, base: TradingConfig): TradingConfig {
  return {
    capital: clamp(partial.capital ?? base.capital, 1_000_000, 100_000_000_000),
    riskPerTradePct: clamp(partial.riskPerTradePct ?? base.riskPerTradePct, 0.1, 5),
    maxRiskPerTradePct: clamp(partial.maxRiskPerTradePct ?? base.maxRiskPerTradePct, 0.1, 10),
    maxTradesPerDay: clamp(partial.maxTradesPerDay ?? base.maxTradesPerDay, 1, 20),
    fomoMoveThresholdPct: clamp(partial.fomoMoveThresholdPct ?? base.fomoMoveThresholdPct, 1, 50),
    fomoExtremeMoveThresholdPct: clamp(partial.fomoExtremeMoveThresholdPct ?? base.fomoExtremeMoveThresholdPct, 1, 100),
  };
}

function loadConfig(): TradingConfig {
  if (typeof window === 'undefined') return DEFAULT_TRADING_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_TRADING_CONFIG;
    const parsed = JSON.parse(raw) as Partial<TradingConfig>;
    return sanitize(parsed, DEFAULT_TRADING_CONFIG);
  } catch {
    return DEFAULT_TRADING_CONFIG;
  }
}

export function useTradingSettings() {
  const [settings, setSettingsState] = useState<TradingConfig>(DEFAULT_TRADING_CONFIG);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydrate from localStorage after mount (SSR safe)
  useEffect(() => {
    setSettingsState(loadConfig());
  }, []);

  const setSettings = useCallback((updates: Partial<TradingConfig>) => {
    setSettingsState((prev) => {
      const next = sanitize(updates, prev);

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
    setSettingsState(DEFAULT_TRADING_CONFIG);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  return { settings, setSettings, reset };
}
