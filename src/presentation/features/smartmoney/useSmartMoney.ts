'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getStockFundamentals, getStockHistory, getStockSmartMoneyFlows, getStockSummaries } from '@/data/repositories/StockRepository';
import { evaluateSmartMoney, measureSmartMoney, rankSmartMoney, SmartMoneyInput, smartMoneyPrefilter, SmartMoneyResult } from '@/domain/analysis/smartMoneyHunter';
import { mapWithConcurrency } from '@/lib/concurrency';

const CONCURRENCY = 6;

export interface SmartMoneyScan {
  universe: number;
  scanned: number;
  results: SmartMoneyResult[];
  scannedAt: string;
}

/** `note` = partial data (e.g. daily quota hit midway); the missing parts stay N/A. */
export type FlowState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'done'; asOf: string; note?: string };

type State =
  | { status: 'idle' }
  | { status: 'scanning'; nonce: number; checked: number; total: number }
  | { status: 'done'; nonce: number; scan: SmartMoneyScan }
  | { status: 'error'; nonce: number; message: string };

let cache: { scan: SmartMoneyScan; inputs: Map<string, SmartMoneyInput> } | null = null;

const FLOW_ERRORS: Record<string, string> = {
  not_configured: 'INDEX_ALPHA_API_KEY belum diisi.',
  quota_exceeded: 'Kuota Index Alpha habis atau ditolak.',
  rate_limited: 'Batas permintaan per menit Index Alpha tercapai. Coba lagi sebentar.',
};

/**
 * Smart Money Accumulation Hunter on live data (domain/analysis/smartMoneyHunter.ts): Pasardana prefilter →
 * 1-year Yahoo bars + Yahoo fundamentals → score without flows. Foreign/broker flows cost Index Alpha quota, so
 * they are fetched per stock only on `fetchFlows(ticker)` and the row is re-scored. Cached for the session.
 */
export function useSmartMoney() {
  const [state, setState] = useState<State>({ status: 'idle' });
  const [nonce, setNonce] = useState(0);
  const [flows, setFlows] = useState<Record<string, FlowState>>({});
  const tokenRef = useRef(0);

  useEffect(() => {
    const token = ++tokenRef.current;
    let cancelled = false;
    const live = () => !cancelled && tokenRef.current === token;

    (async () => {
      if (nonce === 0 && cache) {
        setState({ status: 'done', nonce, scan: cache.scan });
        return;
      }
      try {
        const summaries = await getStockSummaries();
        const candidates = smartMoneyPrefilter(summaries);
        if (!live()) return;
        setState({ status: 'scanning', nonce, checked: 0, total: candidates.length });

        let checked = 0;
        const now = new Date();
        const inputs = await mapWithConcurrency(candidates, CONCURRENCY, async (summary): Promise<SmartMoneyInput> => {
          const [bars, fundamentals] = await Promise.all([
            getStockHistory(summary.ticker, '1y').catch(() => []),
            getStockFundamentals(summary.ticker),
          ]);
          checked += 1;
          if (live()) setState({ status: 'scanning', nonce, checked, total: candidates.length });
          return { summary, bars, fundamentals, flows: null, now };
        });
        if (!live()) return;

        const scan: SmartMoneyScan = {
          universe: summaries.length,
          scanned: inputs.length,
          results: rankSmartMoney(inputs.map((i) => evaluateSmartMoney(measureSmartMoney(i)))),
          scannedAt: now.toISOString(),
        };
        cache = { scan, inputs: new Map(inputs.map((i) => [i.summary.ticker, i])) };
        setFlows({});
        setState({ status: 'done', nonce, scan });
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

  /** Fetches foreign + broker flows for one stock (4 Index Alpha requests on a server cache miss) and re-scores it. */
  const fetchFlows = useCallback(async (ticker: string) => {
    const input = cache?.inputs.get(ticker);
    if (!input || !cache) return;
    setFlows((f) => ({ ...f, [ticker]: { status: 'loading' } }));
    const res = await getStockSmartMoneyFlows(ticker);
    if (!res.ok || !res.data) {
      const message = (res.reason && FLOW_ERRORS[res.reason]) ?? res.message ?? 'Data flow tidak tersedia.';
      setFlows((f) => ({ ...f, [ticker]: { status: 'error', message } }));
      return;
    }
    const next = { ...input, flows: res.data };
    cache.inputs.set(ticker, next);
    const result = evaluateSmartMoney(measureSmartMoney(next));
    const scan = { ...cache.scan, results: rankSmartMoney(cache.scan.results.map((r) => (r.measures.ticker === ticker ? result : r))) };
    cache.scan = scan;
    const note = res.reason ? `Sebagian data tidak terambil: ${(res.reason && FLOW_ERRORS[res.reason]) ?? ''} ${res.message ?? ''}`.trim() : undefined;
    setFlows((f) => ({ ...f, [ticker]: { status: 'done', asOf: res.data!.asOf, note } }));
    setState((s) => (s.status === 'done' ? { ...s, scan } : s));
  }, []);

  const current = state.status !== 'idle' && state.nonce === nonce ? state : null;
  return {
    loading: !current || current.status === 'scanning',
    progress: current?.status === 'scanning' ? { checked: current.checked, total: current.total } : null,
    scan: current?.status === 'done' ? current.scan : null,
    error: current?.status === 'error' ? current.message : null,
    flows,
    fetchFlows,
    rescan,
  };
}
