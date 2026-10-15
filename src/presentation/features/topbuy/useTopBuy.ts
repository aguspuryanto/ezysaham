'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { syncSummary, todayWib } from '@/data/repositories/SignalRepository';
import { getStockFundamentals, getStockHistory, getStockIntraday, getStockSummaries } from '@/data/repositories/StockRepository';
import { buildSignalFromDecision } from '@/domain/analysis/signalFromDecision';
import { buildTopBuyScan, rulesPassedPct, TopBuyRow, TopBuyScan, topBuyPrefilter, topBuySnapshot } from '@/domain/analysis/topBuyScreener';
import { vwap as sessionVwap } from '@/domain/indicators/vwap';
import { mapWithConcurrency } from '@/lib/concurrency';

const CONCURRENCY = 6;

type State =
  | { status: 'idle' }
  | { status: 'scanning'; nonce: number; phase: string; checked: number; total: number }
  | { status: 'done'; nonce: number; scan: TopBuyScan }
  | { status: 'error'; nonce: number; message: string };

let cache: TopBuyScan | null = null;

/**
 * Runs the Top BUY pipeline (domain/analysis/topBuyScreener.ts) on live data: Pasardana prefilter →
 * 6-month Yahoo bars + fundamentals (+ session VWAP when the snapshot is today) → Decision Engine v3.
 * Cached for the session; `rescan()` refetches.
 */
export function useTopBuy() {
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
        const { funnel, candidates } = topBuyPrefilter(await getStockSummaries());
        if (!live()) return;
        setState({ status: 'scanning', nonce, phase: 'Memuat harga harian', checked: 0, total: candidates.length });

        let checked = 0;
        const inputs = await mapWithConcurrency(candidates, CONCURRENCY, async (summary) => {
          const bars = await getStockHistory(summary.ticker).catch(() => []);
          checked += 1;
          if (live()) setState({ status: 'scanning', nonce, phase: 'Memuat harga harian', checked, total: candidates.length });
          return { summary, bars };
        });
        if (!live()) return;

        const { dataDate, current, stale } = topBuySnapshot(inputs, new Date());
        const isToday = dataDate != null && dataDate >= todayWib();
        let done = 0;
        setState({ status: 'scanning', nonce, phase: 'Decision Engine v3', checked: 0, total: current.length });
        const rows: TopBuyRow[] = stale ? [] : await mapWithConcurrency(current, CONCURRENCY, async ({ summary, bars }) => {
          const [fundamentals, intraday] = await Promise.all([
            getStockFundamentals(summary.ticker).catch(() => null),
            isToday ? getStockIntraday(summary.ticker).catch(() => null) : Promise.resolve(null),
          ]);
          const vwap = intraday?.ok && intraday.bars.length > 0 ? sessionVwap(intraday.bars) : null;
          const synced = syncSummary(summary, bars, false);
          const signal = buildSignalFromDecision({ summary: synced, bars, fundamentals, vwap, date: dataDate! });
          done += 1;
          if (live()) setState({ status: 'scanning', nonce, phase: 'Decision Engine v3', checked: done, total: current.length });
          return { signal, summary: synced, rulesPct: rulesPassedPct(signal) };
        });
        if (!live()) return;

        cache = buildTopBuyScan(funnel, dataDate, stale, rows);
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
    progress: current?.status === 'scanning' ? { phase: current.phase, checked: current.checked, total: current.total } : null,
    scan: current?.status === 'done' ? current.scan : null,
    error: current?.status === 'error' ? current.message : null,
    rescan,
  };
}
