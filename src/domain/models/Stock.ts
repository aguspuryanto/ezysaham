/**
 * EOD summary snapshot for one ticker, as shown in the Screener list.
 * Deliberately excludes swingScore/scalpingScore/recommendation-from-summary-only
 * fields — that heuristic (legacy scoringEngine.ts) is retired per ADR-002.
 */
export interface StockSummary {
  ticker: string;
  name: string;
  sector: string;
  subSector: string;
  lastClose: number;
  prevClose: number;
  percentChange1D: number;
  percentChange1W: number;
  percentChange1M: number;
  high: number;
  low: number;
  volume: number;
  value: number;
  frequency: number;
  capitalization: number;
  per: number;
  pbv: number;
  roe: number;
  annualHigh: number;
  annualLow: number;
}
