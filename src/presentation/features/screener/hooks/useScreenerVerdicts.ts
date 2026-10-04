'use client';

import { useCallback, useRef, useState } from 'react';
import { getStockFundamentals, getStockHistory } from '@/data/repositories/StockRepository';
import { computeScreenerVerdict, ScreenerVerdict } from '@/domain/analysis/screenerVerdict';
import { mapWithConcurrency } from '@/lib/concurrency';
import { ScreenerResult } from '../components/ResultsTable';

const HISTORY_CONCURRENCY = 6;
/** Verdicts are committed to state in chunks so progress shows while a long list is analysed. */
const VERDICT_CHUNK = 24;

/**
 * Lazily computes row verdicts (Market Phase / Trend / Fundamental / Momentum / Volume /
 * Fair Value / Risk). Each needs a per-ticker history + fundamentals fetch, so callers pass only
 * the rows that need one (e.g. the visible page) to `load`, from an effect:
 *
 *   useEffect(() => load(targets), [load, targets]);
 *
 * `load` returns a cleanup that stops further chunks. Each ticker is fetched at most once until
 * `reset()`. Split from the target selection because callers sort by the verdicts they load.
 */
export function useScreenerVerdicts() {
  const [verdictByTicker, setVerdictByTicker] = useState<Record<string, ScreenerVerdict>>({});
  const attemptedRef = useRef<Set<string>>(new Set());

  const load = useCallback((targets: ScreenerResult[]) => {
    const pending = targets.filter((r) => !attemptedRef.current.has(r.summary.ticker));
    if (pending.length === 0) return undefined;

    let cancelled = false;
    (async () => {
      for (let i = 0; i < pending.length && !cancelled; i += VERDICT_CHUNK) {
        const chunk = pending.slice(i, i + VERDICT_CHUNK).filter((r) => !attemptedRef.current.has(r.summary.ticker));
        chunk.forEach((r) => attemptedRef.current.add(r.summary.ticker));
        const entries = await mapWithConcurrency(chunk, HISTORY_CONCURRENCY, async ({ summary }) => {
          const [bars, fundamentals] = await Promise.all([
            getStockHistory(summary.ticker),
            getStockFundamentals(summary.ticker),
          ]);
          return [summary.ticker, computeScreenerVerdict(summary, bars, fundamentals)] as const;
        });
        // Results are valid regardless of cancellation — commit them so nothing is fetched twice.
        setVerdictByTicker((prev) => {
          const next = { ...prev };
          for (const [ticker, verdict] of entries) next[ticker] = verdict;
          return next;
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /** Forget every computed verdict (e.g. on Refresh) so they are recomputed from fresh data. */
  const reset = useCallback(() => {
    attemptedRef.current = new Set();
    setVerdictByTicker({});
  }, []);

  return { verdictByTicker, load, reset };
}
