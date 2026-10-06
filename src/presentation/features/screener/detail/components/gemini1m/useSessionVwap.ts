import { useEffect, useState } from 'react';
import { getStockIntraday } from '@/data/repositories/StockRepository';
import { vwap as sessionVwap } from '@/domain/indicators/vwap';
import { IntradayResponse } from '@/domain/models/Intraday';

/**
 * Session VWAP from the Yahoo 1-minute feed. Keyed by ticker so a stale response is ignored.
 * `loading` = no response yet for this ticker; `vwap` stays null when the feed is empty.
 */
export function useSessionVwap(ticker: string): { vwap: number | null; loading: boolean } {
  const [state, setState] = useState<{ ticker: string; data: IntradayResponse } | null>(null);
  useEffect(() => {
    let cancelled = false;
    getStockIntraday(ticker).then((data) => {
      if (!cancelled) setState({ ticker, data });
    });
    return () => { cancelled = true; };
  }, [ticker]);
  const data = state?.ticker === ticker ? state.data : null;
  const bars = data?.ok ? data.bars : null;
  return { vwap: bars && bars.length > 0 ? sessionVwap(bars) : null, loading: data === null };
}
