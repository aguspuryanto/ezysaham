'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getStockFundamentals, getStockHistory, getStockIntraday, getStockSummaries } from '@/data/repositories/StockRepository';
import {
  intradayNeedsVwap,
  MoonstockMode,
  moonstockPrefilter,
  MoonstockScan,
  MoonstockStockInput,
  screenMoonstock,
} from '@/domain/analysis/moonstockScreener';
import { vwap as sessionVwap } from '@/domain/indicators/vwap';
import { mapWithConcurrency } from '@/lib/concurrency';

const CONCURRENCY = 6;
/** Swing needs ~200 sessions for EMA 200. */
const HISTORY_RANGE: Record<MoonstockMode, string> = { intraday: '6mo', swing: '1y', investing: '6mo' };

type State =
  | { status: 'idle' }
  | { status: 'scanning'; key: string; phase: string; checked: number; total: number }
  | { status: 'done'; key: string; scan: MoonstockScan }
  | { status: 'error'; key: string; message: string };

const cache = new Map<MoonstockMode, MoonstockScan>();

/** YYYY-MM-DD in WIB for a unix-seconds timestamp. */
function wibDate(unixSeconds: number): string {
  return new Date((unixSeconds + 7 * 3600) * 1000).toISOString().slice(0, 10);
}

/**
 * Fetches the Moonstock universe for `mode` on real data and screens it (moonstockScreener.ts).
 * Results are cached per mode for the session; `rescan()` refetches.
 */
export function useMoonstock(mode: MoonstockMode) {
  const [state, setState] = useState<State>({ status: 'idle' });
  const [nonce, setNonce] = useState(0);
  const tokenRef = useRef(0);
  const key = `${mode}#${nonce}`;

  useEffect(() => {
    const cached = nonce === 0 ? cache.get(mode) : undefined;
    const token = ++tokenRef.current;
    let cancelled = false;
    const live = () => !cancelled && tokenRef.current === token;

    (async () => {
      if (cached) {
        setState({ status: 'done', key, scan: cached });
        return;
      }
      try {
        const summaries = await getStockSummaries();
        const list = summaries.filter((s) => moonstockPrefilter(mode, s)).sort((a, b) => a.ticker.localeCompare(b.ticker));
        if (!live()) return;
        setState({ status: 'scanning', key, phase: 'Memuat harga harian', checked: 0, total: list.length });

        let checked = 0;
        const inputs: MoonstockStockInput[] = await mapWithConcurrency(list, CONCURRENCY, async (summary) => {
          const [bars, fundamentals] = await Promise.all([
            getStockHistory(summary.ticker, HISTORY_RANGE[mode]).catch(() => []),
            mode === 'investing' ? getStockFundamentals(summary.ticker).catch(() => null) : Promise.resolve(undefined),
          ]);
          checked += 1;
          if (live() && checked % 5 === 0) setState({ status: 'scanning', key, phase: 'Memuat harga harian', checked, total: list.length });
          return { summary, bars, fundamentals };
        });
        if (!live()) return;

        if (mode === 'intraday') {
          // VWAP only for stocks that already pass the daily-bar filters.
          const needVwap = inputs.filter(intradayNeedsVwap);
          let done = 0;
          setState({ status: 'scanning', key, phase: 'Memuat VWAP intraday', checked: 0, total: needVwap.length });
          await mapWithConcurrency(needVwap, CONCURRENCY, async (input) => {
            const res = await getStockIntraday(input.summary.ticker);
            const last = res.ok && res.bars.length ? res.bars[res.bars.length - 1] : null;
            const value = res.ok ? sessionVwap(res.bars) : null;
            input.vwap = last && value != null ? { value, sessionDate: wibDate(last.time) } : null;
            done += 1;
            if (live() && done % 3 === 0) setState({ status: 'scanning', key, phase: 'Memuat VWAP intraday', checked: done, total: needVwap.length });
          });
          if (!live()) return;
        }

        const scan = screenMoonstock(mode, inputs, new Date());
        cache.set(mode, scan);
        setState({ status: 'done', key, scan });
      } catch {
        if (!cancelled) setState({ status: 'error', key, message: 'Gagal memindai saham. Periksa koneksi lalu coba lagi.' });
      }
    })();

    return () => { cancelled = true; };
  }, [mode, nonce, key]);

  const rescan = useCallback(() => {
    cache.delete(mode);
    setNonce((x) => x + 1);
  }, [mode]);

  const current = state.status !== 'idle' && state.key === key ? state : null;
  return {
    loading: !current || current.status === 'scanning',
    progress: current?.status === 'scanning' ? { phase: current.phase, checked: current.checked, total: current.total } : null,
    scan: current?.status === 'done' ? current.scan : null,
    error: current?.status === 'error' ? current.message : null,
    rescan,
  };
}
