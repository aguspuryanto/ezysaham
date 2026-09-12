'use client';

import { useMemo } from 'react';
import { StockSummary } from '@/domain/models/Stock';
import { PresetEvaluation } from '@/domain/screener/presets';
import { getRowDisplay } from '../lib/rowDisplay';
import { useLazyRvol } from './useLazyRvol';

const RVOL_CANDIDATE_COUNT = 20;

export interface MarketPulseCard {
  ticker: string;
  name: string;
  metric: string;
  sub: string;
}

export interface MarketPulse {
  topRvol: MarketPulseCard | null;
  topRanked: MarketPulseCard | null;
  topValue: MarketPulseCard | null;
  topGainer: MarketPulseCard | null;
}

/**
 * Powers the 4 stat cards with real, bounded computations only:
 *  - Top RVOL Spike: relative volume, lazily fetched for the 20 highest-value
 *    tickers only (not the whole ~900-stock universe).
 *  - AI Top Ranked Setup: highest composite/quick score among current results.
 *  - Top Value Traded / Top Gainer: instant, no fetch (already on StockSummary).
 * Replaces the mockup's "Foreign Flow Leader" / "Smart Money Inflow" cards,
 * which would need market-wide broker/foreign-flow data ezysaham doesn't have.
 */
export function useMarketPulse(
  summaries: StockSummary[] | null,
  results: Array<{ summary: StockSummary; evaluation: PresetEvaluation }>
): MarketPulse {
  const rvolCandidates = useMemo(() => {
    if (!summaries) return [];
    return [...summaries].sort((a, b) => b.value - a.value).slice(0, RVOL_CANDIDATE_COUNT);
  }, [summaries]);

  const rvolByTicker = useLazyRvol(rvolCandidates.map((s) => s.ticker));

  return useMemo(() => {
    if (!summaries || summaries.length === 0) {
      return { topRvol: null, topRanked: null, topValue: null, topGainer: null };
    }

    let topRvol: MarketPulseCard | null = null;
    let bestRvol = 0;
    for (const s of rvolCandidates) {
      const rvol = rvolByTicker[s.ticker];
      if (rvol != null && rvol > bestRvol) {
        bestRvol = rvol;
        topRvol = { ticker: s.ticker, name: s.name, metric: `${rvol.toFixed(2)}x Vol SMA20`, sub: `${s.percentChange1D >= 0 ? '+' : ''}${s.percentChange1D.toFixed(2)}%` };
      }
    }

    const pool = results.length > 0 ? results : summaries.map((s) => ({ summary: s, evaluation: { passed: true, reasons: [], failed: [] } as PresetEvaluation }));

    let topRanked: MarketPulseCard | null = null;
    let bestScore = -1;
    for (const { summary, evaluation } of pool) {
      const { scoreComposite } = getRowDisplay(summary, evaluation);
      if (scoreComposite > bestScore) {
        bestScore = scoreComposite;
        topRanked = { ticker: summary.ticker, name: summary.name, metric: `${scoreComposite} / 100 Score`, sub: getRowDisplay(summary, evaluation).signalLabel };
      }
    }

    const topValueStock = [...summaries].sort((a, b) => b.value - a.value)[0];
    const topValue: MarketPulseCard = {
      ticker: topValueStock.ticker,
      name: topValueStock.name,
      metric: `Rp ${new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 }).format(topValueStock.value)}`,
      sub: `${topValueStock.percentChange1D >= 0 ? '+' : ''}${topValueStock.percentChange1D.toFixed(2)}%`,
    };

    const topGainerStock = [...summaries].sort((a, b) => b.percentChange1D - a.percentChange1D)[0];
    const topGainer: MarketPulseCard = {
      ticker: topGainerStock.ticker,
      name: topGainerStock.name,
      metric: `${topGainerStock.percentChange1D >= 0 ? '+' : ''}${topGainerStock.percentChange1D.toFixed(2)}%`,
      sub: `Rp ${new Intl.NumberFormat('id-ID').format(topGainerStock.lastClose)}`,
    };

    return { topRvol, topRanked, topValue, topGainer };
  }, [summaries, results, rvolByTicker, rvolCandidates]);
}
