/**
 * BrokerSummary.ts
 *
 * Real broker transaction & foreign-flow data, sourced from the paid Index
 * Alpha API (https://indexalpha.id) — unlike the Wyckoff-style proxy in
 * `bandarScore.ts`, this is actual per-broker buy/sell activity reported by
 * IDX. Requires a Starter+ subscription (INDEX_ALPHA_API_KEY); when the key
 * is missing or the quota is exhausted, callers get `ok: false` and must
 * treat `data` as unavailable, never fall back to zeros.
 */

/** One broker's aggregated buy/sell activity for the requested date range. */
export interface BrokerSummaryRow {
  code: string;
  buyFreq: number;
  buyVolume: number;
  buyValue: number;
  sellFreq: number;
  sellVolume: number;
  sellValue: number;
  buyAvg: number;
  sellAvg: number;
  /** buyValue - sellValue — positive means net accumulation by this broker. */
  netValue: number;
}

export interface ForeignFlowDetail {
  foreignBuy: number;
  foreignSell: number;
  netForeign: number;
}

export interface BrokerActivityDetail {
  ticker: string;
  rangeFrom: string;
  rangeTo: string;
  /** Top 5 brokers by netValue descending (biggest net buyers). */
  topBuyers: BrokerSummaryRow[];
  /** Top 5 brokers by netValue ascending (biggest net sellers). */
  topSellers: BrokerSummaryRow[];
  /** Null when the foreign-flow call failed independently of broker-summary. */
  foreignFlow: ForeignFlowDetail | null;
  source: 'indexalpha';
  fetchedAt: string;
}

export type BrokerActivityUnavailableReason =
  | 'not_configured'
  | 'quota_exceeded'
  | 'rate_limited'
  | 'unavailable'
  | 'error';

/** Net foreign flow of one trading day (IDR). Null = that day's call failed, not zero flow. */
export interface SmartMoneyForeignDay {
  date: string;
  netForeign: number | null;
}

/** Inputs of the Smart Money Accumulation Hunter (docs/features_smartmoney_hunter.md). EOD, published 19:00 WIB. */
export interface SmartMoneyFlows {
  ticker: string;
  /** Last trading date covered (YYYY-MM-DD). */
  asOf: string;
  from5: string;
  from20: string;
  /** Oldest → newest, 5 trading days. Empty when daily calls are disabled (INDEX_ALPHA_FOREIGN_DAILY). */
  foreignDaily: SmartMoneyForeignDay[];
  /** 5- and 20-trading-day totals. */
  foreign5: ForeignFlowDetail | null;
  foreign20: ForeignFlowDetail | null;
  /** All brokers, RG market, 5- and 20-trading-day totals. */
  broker5: BrokerSummaryRow[] | null;
  broker20: BrokerSummaryRow[] | null;
  source: 'indexalpha';
  fetchedAt: string;
}

export interface SmartMoneyFlowsResponse {
  ticker: string;
  ok: boolean;
  reason?: BrokerActivityUnavailableReason;
  message?: string;
  data: SmartMoneyFlows | null;
}

export interface BrokerActivityResponse {
  ticker: string;
  ok: boolean;
  reason?: BrokerActivityUnavailableReason;
  message?: string;
  data: BrokerActivityDetail | null;
}
