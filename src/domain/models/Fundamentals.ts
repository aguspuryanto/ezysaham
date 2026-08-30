/**
 * Fundamentals.ts
 *
 * Financial-statement-derived fields not present in the EOD summary
 * (StockSummary) — sourced from Yahoo Finance's unofficial quoteSummary
 * endpoint. Any field can be null: Yahoo's fundamental data has real gaps,
 * especially for financial-sector (bank) tickers where the balance sheet
 * shape doesn't map to Yahoo's standard template. Callers must treat null
 * as "not available" and never coerce it to zero.
 */
export interface FundamentalDetail {
  ticker: string;
  /** % — trailing dividend yield, e.g. 5.65 means 5.65%. */
  dividendYield: number | null;
  /** % — dividend paid / net income, e.g. 75.4 means 75.4%. */
  dividendPayoutRatio: number | null;
  /** % — total debt / total equity, e.g. 18.1 means a 0.18x ratio. Often null for banks. */
  debtToEquity: number | null;
  /** Current assets / current liabilities. Often null for banks. */
  currentRatio: number | null;
  /** % — trailing net profit margin, e.g. 12.3 means 12.3%. */
  netMargin: number | null;
  /** % — year-over-year revenue growth (most recent quarter). */
  revenueGrowth: number | null;
  source: 'yahoo';
  fetchedAt: string;
}
