import { ScreenerVerdict } from '@/domain/analysis/screenerVerdict';
import { ScreenerResult } from './components/ResultsTable';
import { ScreenerSort, ScreenerSortKey } from './components/ScreenerTable';

function sortValue(r: ScreenerResult, key: ScreenerSortKey, v?: ScreenerVerdict): number | string | null {
  switch (key) {
    case 'ticker': return r.summary.ticker;
    case 'change': return r.summary.percentChange1D;
    case 'price': return r.summary.lastClose;
    case 'volume': return r.summary.volume;
    case 'fundamental': return v ? v.fundamentalScore.composite : null;
    case 'upside': return v?.valuation.upsidePct ?? null;
    case 'score': return r.evaluation.dayTrading?.scores.total ?? r.evaluation.swingTrading?.scores.total ?? null;
  }
}

/** Sorts screener rows; rows whose value isn't known yet (verdict still loading) always go last. */
export function sortScreenerRows(rows: ScreenerResult[], sort: ScreenerSort, verdictByTicker: Record<string, ScreenerVerdict>): ScreenerResult[] {
  const mul = sort.dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = sortValue(a, sort.key, verdictByTicker[a.summary.ticker]);
    const vb = sortValue(b, sort.key, verdictByTicker[b.summary.ticker]);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    if (typeof va === 'string' && typeof vb === 'string') return mul * va.localeCompare(vb);
    return mul * ((va as number) - (vb as number));
  });
}

/** Header-click behaviour: same column flips direction; a new column starts desc (ticker: asc). */
export function nextSort(prev: ScreenerSort, key: ScreenerSortKey): ScreenerSort {
  return prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'ticker' ? 'asc' : 'desc' };
}
