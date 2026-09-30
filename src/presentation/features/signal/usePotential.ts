'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getStockHistory, getStockSummaries } from '@/data/repositories/StockRepository';
import { computeMarketRegime, MarketRegime } from '@/domain/analysis/marketRegimeEngine';
import { evaluatePotential, POT_MAX_PRICE, POT_MIN_PRICE, PotentialResult, PotentialTarget } from '@/domain/analysis/potentialUpside';
import { OHLCVBar } from '@/domain/models/History';
import { mapWithConcurrency } from '@/lib/concurrency';

export interface PotentialCandidate {
  ticker: string;
  companyName: string;
  sector: string;
  result: PotentialResult;
}

export interface PotentialScan {
  date: string;
  target: PotentialTarget;
  candidates: PotentialCandidate[];
  /** Stocks whose history was evaluated. */
  scanned: number;
  market: MarketRegime | null;
  /** Latest EOD bar date actually used (≤ requested date). */
  dataDate: string | null;
}

/** Everything fetched for one date — shared by every target, so switching 10/20/25/30% re-scores without refetching. */
interface Universe {
  stocks: Array<{ ticker: string; companyName: string; sector: string; bars: OHLCVBar[] }>;
  market: MarketRegime | null;
  dataDate: string | null;
}

type State =
  | { status: 'idle' }
  | { status: 'scanning'; key: string; checked: number; total: number }
  | { status: 'done'; key: string; universe: Universe }
  | { status: 'error'; key: string; message: string };

const CONCURRENCY = 6;
/** Summary price is today's; keep a margin so a past-date scan still sees stocks that crossed the band. */
const COARSE_MIN = POT_MIN_PRICE * 0.8;
const COARSE_MAX = POT_MAX_PRICE * 1.25;
/** Single-day value gate before fetching history; the engine applies the real 20-day average. */
const COARSE_MIN_VALUE = 300_000_000;

const cache = new Map<string, Universe>();

/**
 * Runs the POTENTIAL X% scan on real EOD data for `date` when `target` is set.
 * Bars are fetched once per date (cached for the session); `rescan()` refetches.
 */
export function usePotential(date: string, target: PotentialTarget | null, ihsgBars: OHLCVBar[], marketReady: boolean) {
  const [state, setState] = useState<State>({ status: 'idle' });
  const [nonce, setNonce] = useState(0);
  const tokenRef = useRef(0);
  const enabled = target != null;
  const key = `${date}#${nonce}`;

  useEffect(() => {
    if (!enabled || !marketReady) return;
    const cached = nonce === 0 ? cache.get(date) : undefined;
    const token = ++tokenRef.current;
    let cancelled = false;

    (async () => {
      if (cached) {
        setState({ status: 'done', key, universe: cached });
        return;
      }
      try {
        const summaries = await getStockSummaries();
        const list = summaries.filter((s) => s.lastClose >= COARSE_MIN && s.lastClose <= COARSE_MAX && s.value >= COARSE_MIN_VALUE);
        if (cancelled) return;
        setState({ status: 'scanning', key, checked: 0, total: list.length });

        const market = computeMarketRegime(ihsgBars.filter((b) => b.date <= date))?.regime ?? null;
        let checked = 0;
        let dataDate: string | null = null;
        const stocks = await mapWithConcurrency(list, CONCURRENCY, async (s) => {
          const bars = (await getStockHistory(s.ticker, '1y').catch(() => [])).filter((b) => b.date <= date);
          checked += 1;
          if (!cancelled && tokenRef.current === token && checked % 5 === 0) setState({ status: 'scanning', key, checked, total: list.length });
          if (bars.length && (!dataDate || bars[bars.length - 1].date > dataDate)) dataDate = bars[bars.length - 1].date;
          return { ticker: s.ticker, companyName: s.name, sector: s.sector, bars };
        });
        if (cancelled || tokenRef.current !== token) return;

        const universe: Universe = { stocks, market, dataDate };
        cache.set(date, universe);
        setState({ status: 'done', key, universe });
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
  const universe = current?.status === 'done' ? current.universe : null;

  const scan = useMemo<PotentialScan | null>(() => {
    if (!universe || target == null) return null;
    const candidates: PotentialCandidate[] = [];
    for (const s of universe.stocks) {
      const result = evaluatePotential(s.bars, universe.market, target);
      if (result) candidates.push({ ticker: s.ticker, companyName: s.companyName, sector: s.sector, result });
    }
    candidates.sort((a, b) => b.result.score - a.result.score);
    return { date, target, candidates, scanned: universe.stocks.length, market: universe.market, dataDate: universe.dataDate };
  }, [universe, target, date]);

  return {
    loading: enabled && (!current || current.status === 'scanning'),
    progress: current?.status === 'scanning' ? { checked: current.checked, total: current.total } : null,
    scan,
    error: current?.status === 'error' ? current.message : null,
    rescan,
  };
}
