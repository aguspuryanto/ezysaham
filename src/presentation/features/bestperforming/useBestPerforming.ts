'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getStockHistory, getStockSummaries } from '@/data/repositories/StockRepository';
import { analyzePerformer, bestPerformingCandidates, PerformerRow, PerfPeriod, rankBestPerforming } from '@/domain/analysis/bestPerforming';
import { OHLCVBar } from '@/domain/models/History';
import { mapWithConcurrency } from '@/lib/concurrency';

const CONCURRENCY = 6;

type State =
  | { status: 'idle' }
  | { status: 'scanning'; key: string; checked: number; total: number }
  | { status: 'done'; key: string; rows: PerformerRow[]; candidates: number }
  | { status: 'error'; key: string; message: string };

/** 1-year bars per ticker, shared across periods so switching tabs only fetches new tickers. */
const barCache = new Map<string, OHLCVBar[]>();
const resultCache = new Map<PerfPeriod, { rows: PerformerRow[]; candidates: number }>();

/**
 * Kinerja Terbaik (domain/analysis/bestPerforming.ts): Pasardana snapshot → top candidates by period performance →
 * 1-year daily bars → liquidity filter + rise-shape analysis → top 50. Cached per period; `rescan()` refetches.
 */
export function useBestPerforming(period: PerfPeriod) {
  const [state, setState] = useState<State>({ status: 'idle' });
  const [nonce, setNonce] = useState(0);
  const tokenRef = useRef(0);
  const key = `${period}#${nonce}`;

  useEffect(() => {
    const token = ++tokenRef.current;
    let cancelled = false;
    const live = () => !cancelled && tokenRef.current === token;

    (async () => {
      const cached = resultCache.get(period);
      if (cached) {
        setState({ status: 'done', key, ...cached });
        return;
      }
      try {
        const candidates = bestPerformingCandidates(await getStockSummaries(), period);
        if (!live()) return;
        setState({ status: 'scanning', key, checked: 0, total: candidates.length });

        let checked = 0;
        const rows = await mapWithConcurrency(candidates, CONCURRENCY, async (summary) => {
          let bars = barCache.get(summary.ticker);
          if (!bars) {
            bars = await getStockHistory(summary.ticker, '1y').catch(() => []);
            if (bars.length) barCache.set(summary.ticker, bars);
          }
          checked += 1;
          if (live() && checked % 5 === 0) setState({ status: 'scanning', key, checked, total: candidates.length });
          return analyzePerformer(summary, bars, period);
        });
        if (!live()) return;

        const result = { rows: rankBestPerforming(rows), candidates: candidates.length };
        resultCache.set(period, result);
        setState({ status: 'done', key, ...result });
      } catch {
        if (!cancelled) setState({ status: 'error', key, message: 'Gagal memuat data saham. Periksa koneksi lalu coba lagi.' });
      }
    })();

    return () => { cancelled = true; };
  }, [period, nonce, key]);

  const rescan = useCallback(() => {
    resultCache.clear();
    barCache.clear();
    setNonce((x) => x + 1);
  }, []);

  const current = state.status !== 'idle' && state.key === key ? state : null;
  return {
    loading: !current || current.status === 'scanning',
    progress: current?.status === 'scanning' ? { checked: current.checked, total: current.total } : null,
    rows: current?.status === 'done' ? current.rows : null,
    candidates: current?.status === 'done' ? current.candidates : 0,
    error: current?.status === 'error' ? current.message : null,
    rescan,
  };
}
