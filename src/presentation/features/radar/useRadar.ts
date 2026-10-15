'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getStockHistory, getStockSummaries } from '@/data/repositories/StockRepository';
import { buildRadarScan, radarPrefilter, RadarScan } from '@/domain/analysis/topgainRadar';
import { mapWithConcurrency } from '@/lib/concurrency';

const CONCURRENCY = 6;

type State =
  | { status: 'idle' }
  | { status: 'scanning'; nonce: number; checked: number; total: number }
  | { status: 'done'; nonce: number; scan: RadarScan }
  | { status: 'error'; nonce: number; message: string };

let cache: RadarScan | null = null;

/**
 * Runs the topgain radar (domain/analysis/topgainRadar.ts) on live data: Pasardana prefilter → 1-year Yahoo bars
 * (52-week low/high is one of the conditions) → score. Cached for the session; `rescan()` refetches.
 */
export function useRadar() {
  const [state, setState] = useState<State>({ status: 'idle' });
  const [nonce, setNonce] = useState(0);
  const tokenRef = useRef(0);

  useEffect(() => {
    const token = ++tokenRef.current;
    let cancelled = false;
    const live = () => !cancelled && tokenRef.current === token;

    (async () => {
      if (nonce === 0 && cache) {
        setState({ status: 'done', nonce, scan: cache });
        return;
      }
      try {
        const candidates = radarPrefilter(await getStockSummaries());
        if (!live()) return;
        setState({ status: 'scanning', nonce, checked: 0, total: candidates.length });

        let checked = 0;
        const inputs = await mapWithConcurrency(candidates, CONCURRENCY, async (summary) => {
          const bars = await getStockHistory(summary.ticker, '1y').catch(() => []);
          checked += 1;
          if (live()) setState({ status: 'scanning', nonce, checked, total: candidates.length });
          return { summary, bars };
        });
        if (!live()) return;

        cache = buildRadarScan(inputs, new Date());
        setState({ status: 'done', nonce, scan: cache });
      } catch {
        if (!cancelled) setState({ status: 'error', nonce, message: 'Gagal memindai saham. Periksa koneksi lalu coba lagi.' });
      }
    })();

    return () => { cancelled = true; };
  }, [nonce]);

  const rescan = useCallback(() => {
    cache = null;
    setNonce((x) => x + 1);
  }, []);

  const current = state.status !== 'idle' && state.nonce === nonce ? state : null;
  return {
    loading: !current || current.status === 'scanning',
    progress: current?.status === 'scanning' ? { checked: current.checked, total: current.total } : null,
    scan: current?.status === 'done' ? current.scan : null,
    error: current?.status === 'error' ? current.message : null,
    rescan,
  };
}
