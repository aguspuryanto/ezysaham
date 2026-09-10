'use client';

import { useCallback, useState } from 'react';
import { getStockHistory } from '@/data/repositories/StockRepository';
import { mapWithConcurrency } from '@/lib/concurrency';
import { BacktestRunConfig, BacktestRunResult } from '@/domain/backtest/BacktestEntry';
import { runPresetBacktest } from '@/domain/backtest/runBacktest';

const FETCH_CONCURRENCY = 6;

export function useBacktest() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<BacktestRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (config: BacktestRunConfig) => {
    setLoading(true);
    setError(null);
    setResult(null);
    setProgress({ done: 0, total: config.tickers.length });

    try {
      let done = 0;
      const tickersWithBars = await mapWithConcurrency(config.tickers, FETCH_CONCURRENCY, async (ticker) => {
        const bars = await getStockHistory(ticker, config.range);
        done += 1;
        setProgress({ done, total: config.tickers.length });
        return { ticker, bars };
      });

      const outcome = runPresetBacktest(tickersWithBars, {
        presetId: config.presetId,
        range: config.range,
        holdingDays: config.holdingDays,
      });
      setResult(outcome);
      return outcome;
    } catch (err) {
      setError((err as Error).message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { run, loading, progress, result, error };
}
