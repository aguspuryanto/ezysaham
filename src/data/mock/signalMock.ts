/**
 * signalMock.ts
 *
 * Signal universe + TEMPORARY performance numbers for the /signal dashboard.
 * Signals themselves are no longer mocked — SignalRepository computes them with Decision Engine v3.
 */

import { SignalPerformanceSummary } from '@/domain/models/Signal';

/** Tickers scanned for the daily SARA signal batch. */
export const SIGNAL_UNIVERSE = ['BBRI', 'ADRO', 'TLKM', 'ANTM', 'BBCA', 'ASII', 'GOTO', 'PTBA', 'UNVR', 'MDKA', 'ICBP', 'BMRI'] as const;

/** TEMPORARY — illustrative until signal outcomes (TP/SL hit) are tracked. */
export const MOCK_PERFORMANCE: SignalPerformanceSummary = {
  totalSignals: 146,
  winRate: 58.2,
  avgReturn: 2.4,
  activeSignals: 9,
  periodLabel: '30 hari terakhir',
};
