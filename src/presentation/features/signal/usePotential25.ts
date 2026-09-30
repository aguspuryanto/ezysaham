'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getStockHistory, getStockSummaries } from '@/data/repositories/StockRepository';
import { computeMarketRegime, MarketRegime } from '@/domain/analysis/marketRegimeEngine';
import { evaluatePotential25, P25_MAX_PRICE, P25_MIN_PRICE, Potential25Result } from '@/domain/analysis/potential25';
import { OHLCVBar } from '@/domain/models/History';
import { mapWithConcurrency } from '@/lib/concurrency';

export interface Potential25Candidate {
  ticker: string;
  companyName: string;
  sector: string;
  result: Potential25Result;
}

export interface Potential25Scan {
  date: string;
  candidates: Potential25Candidate[];
  /** Stocks whose history was evaluated. */
  scanned: number;
  market: MarketRegime | null;
  /** Latest EOD bar date actually used (≤ requested date). */
  dataDate: string | null;
}

type State =
  | { status: 'idle' }
  | { status: 'scanning'; key: string; checked: number; total: number }
  | { status: 'done'; key: string; scan: Potential25Scan }
  | { status: 'error'; key: string; message: string };

const CONCURRENCY = 6;
/** Summary price is today's; keep a margin so a past-date scan still sees stocks that crossed the band. */
const COARSE_MIN = P25_MIN_PRICE * 0.8;
const COARSE_MAX = P25_MAX_PRICE * 1.25;
/** Single-day value gate before fetching history; the engine applies the real 20-day average. */
const COARSE_MIN_VALUE = 300_000_000;

const cache = new Map<string, Potential25Scan>();

/**
 * Runs the POTENTIAL 25% scan on real EOD data for `date` when `enabled`.
 * Results are cached per date for the session; `rescan()` bypasses the cache.
 */
export function usePotential25(date: string, enabled: boolean, ihsgBars: OHLCVBar[], marketReady: boolean) {
  const [state, setState] = useState<State>({ status: 'idle' });
  const [nonce, setNonce] = useState(0);
  const tokenRef = useRef(0);
  const key = `${date}#${nonce}`;

  useEffect(() => {
    if (!enabled || !marketReady) return;
    const cached = nonce === 0 ? cache.get(date) : undefined;
    const token = ++tokenRef.current;
    let cancelled = false;

    (async () => {
      if (cached) {
        setState({ status: 'done', key, scan: cached });
        return;
      }
      try {
        const summaries = await getStockSummaries();
        const universe = summaries.filter((s) => s.lastClose >= COARSE_MIN && s.lastClose <= COARSE_MAX && s.value >= COARSE_MIN_VALUE);
        if (cancelled) return;
        setState({ status: 'scanning', key, checked: 0, total: universe.length });

        const ihsgUntil = ihsgBars.filter((b) => b.date <= date);
        const market = computeMarketRegime(ihsgUntil)?.regime ?? null;

        let checked = 0;
        let dataDate: string | null = null;
        const evaluated = await mapWithConcurrency(universe, CONCURRENCY, async (s) => {
          const bars = (await getStockHistory(s.ticker, '1y').catch(() => [])).filter((b) => b.date <= date);
          checked += 1;
          if (!cancelled && tokenRef.current === token && checked % 5 === 0) setState({ status: 'scanning', key, checked, total: universe.length });
          const result = evaluatePotential25(bars, market);
          if (bars.length && (!dataDate || bars[bars.length - 1].date > dataDate)) dataDate = bars[bars.length - 1].date;
          return result ? { ticker: s.ticker, companyName: s.name, sector: s.sector, result } : null;
        });
        if (cancelled || tokenRef.current !== token) return;

        const scan: Potential25Scan = {
          date,
          candidates: evaluated.filter((c): c is Potential25Candidate => c !== null).sort((a, b) => b.result.score - a.result.score),
          scanned: universe.length,
          market,
          dataDate,
        };
        cache.set(date, scan);
        setState({ status: 'done', key, scan });
      } catch {
        if (!cancelled) setState({ status: 'error', key, message: 'Gagal memindai saham. Periksa koneksi lalu coba lagi.' });
      }
    })();

    return () => { cancelled = true; };
  }, [enabled, marketReady, date, nonce, key, ihsgBars]);

  const rescan = useCallback(() => {
    cache.delete(date);
    setNonce((x) => x + 1);
  }, [date]);

  const current = state.status !== 'idle' && state.key === key ? state : null;
  return {
    loading: enabled && (!current || current.status === 'scanning'),
    progress: current?.status === 'scanning' ? { checked: current.checked, total: current.total } : null,
    scan: current?.status === 'done' ? current.scan : null,
    error: current?.status === 'error' ? current.message : null,
    rescan,
  };
}
