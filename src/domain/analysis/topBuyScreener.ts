/**
 * topBuyScreener.ts
 *
 * Top BUY (docs/features_topbuy.md): picks BUY stocks that did not merely jump for one day, on real data only.
 *
 *   Tahap 1 — Pasardana snapshot filters (1D & 1W positive, value ≥ Rp1 M, PER 0–30x, PBV 0–3x, ROE > 0,
 *             free float ≥ 10%), then only tickers whose daily bars end on the snapshot date.
 *   Tahap 2 — Decision Engine v3 via buildSignalFromDecision (same verdict as /signal and the detail page).
 *
 * Nothing is padded: if the engine finds 1 BUY, the list has 1 BUY. Pure — the caller fetches the data.
 */

import { computeDataFreshness } from '@/domain/analysis/dataFreshness';
import { OHLCVBar } from '@/domain/models/History';
import { SignalAction, StockSignal } from '@/domain/models/Signal';
import { StockSummary } from '@/domain/models/Stock';

export interface TopBuyFilter {
  label: string;
  /** Field shown next to the criterion (Pasardana naming). */
  field: string;
  test: (s: StockSummary) => boolean;
}

/** Tahap 1, applied in order; each step's survivor count is reported in the funnel. */
export const TOPBUY_FILTERS: TopBuyFilter[] = [
  { label: 'Perubahan harian & mingguan positif', field: '1D > 0 · 1W > 0', test: (s) => s.percentChange1D > 0 && s.percentChange1W > 0 },
  { label: 'Nilai transaksi harian ≥ Rp1 miliar', field: 'Value ≥ 1e9', test: (s) => s.value >= 1e9 },
  { label: 'PER positif, maks 30x', field: '0 < PER ≤ 30', test: (s) => s.per > 0 && s.per <= 30 },
  { label: 'PBV positif, maks 3x', field: '0 < PBV ≤ 3', test: (s) => s.pbv > 0 && s.pbv <= 3 },
  { label: 'ROE positif & free float ≥ 10%', field: 'ROE > 0 · FF ≥ 10%', test: (s) => s.roe > 0 && s.freeFloat >= 10 },
];

export interface FunnelStep {
  label: string;
  field: string;
  remaining: number;
}

/** Tahap 1 on the Pasardana snapshot. Returns the funnel (starting with the full universe) and the survivors. */
export function topBuyPrefilter(summaries: StockSummary[]): { funnel: FunnelStep[]; candidates: StockSummary[] } {
  let list = summaries.filter((s) => s.ticker && s.lastClose > 0);
  const funnel: FunnelStep[] = [{ label: 'Semua emiten', field: 'Last > 0', remaining: list.length }];
  for (const f of TOPBUY_FILTERS) {
    list = list.filter(f.test);
    funnel.push({ label: f.label, field: f.field, remaining: list.length });
  }
  return { funnel, candidates: list.sort((a, b) => a.ticker.localeCompare(b.ticker)) };
}

/** Share of the engine's trading rules that passed, 0–100. */
export function rulesPassedPct(s: StockSignal): number {
  return s.reasons.length ? Math.round((s.reasons.filter((r) => r.passed).length / s.reasons.length) * 100) : 0;
}

export interface TopBuyRow {
  signal: StockSignal;
  summary: StockSummary;
  rulesPct: number;
}

export interface TopBuyInput {
  summary: StockSummary;
  bars: OHLCVBar[];
}

export type TopBuyState = 'OK' | 'EMPTY' | 'STALE';

export interface TopBuyScan {
  state: TopBuyState;
  stateNote: string;
  /** Snapshot date (YYYY-MM-DD) = latest daily bar among the candidates. */
  dataDate: string | null;
  funnel: FunnelStep[];
  rows: Record<SignalAction, TopBuyRow[]>;
}

const lastDate = (bars: OHLCVBar[]) => (bars.length ? bars[bars.length - 1].date.slice(0, 10) : '');

/**
 * Snapshot date of the fetched candidates and the inputs whose bars end on it (suspended / lagging tickers
 * drop out — the "data bertanggal sama" step). `stale` when the snapshot is too old to trade on.
 */
export function topBuySnapshot<T extends TopBuyInput>(inputs: T[], now: Date): { dataDate: string | null; current: T[]; stale: boolean } {
  const dataDate = inputs.reduce((d, x) => (lastDate(x.bars) > d ? lastDate(x.bars) : d), '');
  if (!dataDate) return { dataDate: null, current: [], stale: false };
  const fresh = computeDataFreshness([{ date: dataDate, open: 0, high: 0, low: 0, close: 0, volume: 0 }], now);
  return { dataDate, current: inputs.filter((x) => x.bars.length >= 2 && lastDate(x.bars) === dataDate), stale: fresh?.tier === 'stale' };
}

/** BUY by SARA score; WAIT by % rules passed then SARA score (the watchlist order); AVOID by SARA score. */
export function rankTopBuy(rows: TopBuyRow[]): Record<SignalAction, TopBuyRow[]> {
  const by = (a: SignalAction) => rows.filter((r) => r.signal.action === a);
  const sara = (a: TopBuyRow, b: TopBuyRow) => b.signal.saraScore - a.signal.saraScore || a.signal.ticker.localeCompare(b.signal.ticker);
  return {
    BUY: by('BUY').sort(sara),
    WAIT: by('WAIT').sort((a, b) => b.rulesPct - a.rulesPct || sara(a, b)),
    AVOID: by('AVOID').sort(sara),
  };
}

export function buildTopBuyScan(funnel: FunnelStep[], dataDate: string | null, stale: boolean, rows: TopBuyRow[]): TopBuyScan {
  const ranked = rankTopBuy(rows);
  const steps = dataDate ? [...funnel, { label: `Data bertanggal ${dataDate}`, field: 'Bar harian terakhir', remaining: rows.length }] : funnel;
  if (!dataDate) {
    return { state: 'EMPTY', stateNote: 'Tidak ada saham yang lolos kriteria awal atau data harga tidak tersedia.', dataDate, funnel: steps, rows: ranked };
  }
  if (stale) {
    return { state: 'STALE', stateNote: `Snapshot terakhir ${dataDate} sudah terlalu lama. Kandidat tidak ditampilkan.`, dataDate, funnel: steps, rows: rankTopBuy([]) };
  }
  const n = ranked.BUY.length;
  return {
    state: rows.length ? 'OK' : 'EMPTY',
    stateNote: rows.length
      ? `${n} BUY, ${ranked.WAIT.length} WAIT, ${ranked.AVOID.length} AVOID dari ${rows.length} kandidat.`
      : 'Tidak ada kandidat pada snapshot ini.',
    dataDate,
    funnel: steps,
    rows: ranked,
  };
}
