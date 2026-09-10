/**
 * Backtest: replays a screener preset's rules across historical daily bars for a
 * set of tickers, resolving each signal purely off EOD closing prices over a
 * configurable holding-day horizon. Distinct from the Jurnal Trading feature,
 * which only grades manually-added entries H+1 using daily high/low.
 */

export type BacktestPresetId = 'dayTrading' | 'swingHunter';
export type BacktestSignalStatus = 'tp_hit' | 'sl_hit' | 'timeout';

export interface BacktestSignal {
  ticker: string;
  presetId: BacktestPresetId;
  signalDate: string; // YYYY-MM-DD, the bar the preset passed on
  entry: number;
  tp1: number;
  tp2: number;
  sl: number;
  riskRewardPlanned: number;
  reasonBuy: string;
  status: BacktestSignalStatus;
  resolvedDate: string;
  exitPrice: number;
  gainLossPct: number;
  daysHeld: number;
}

export interface BacktestRunConfig {
  presetId: BacktestPresetId;
  tickers: string[];
  range: string; // Yahoo range string, e.g. '6mo' | '1y' | '2y'
  holdingDays: number;
}

export interface BacktestTickerStats {
  signals: number;
  wins: number;
  losses: number;
  timeouts: number;
}

export interface BacktestRunResult {
  config: BacktestRunConfig;
  signals: BacktestSignal[];
  perTicker: Record<string, BacktestTickerStats>;
  winRate: number | null; // wins / (wins + losses), null if none resolved
  avgGainLossPct: number | null; // over resolved (non-timeout) signals
}
