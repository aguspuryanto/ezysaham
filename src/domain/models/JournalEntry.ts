/**
 * Trading journal entry — a deliberate snapshot of a screener/analysis pick's
 * Entry/TP1/TP2/SL plan, graded against the single next trading day's EOD
 * closing price (H+1, not intraday high/low, not a multi-day walk-forward)
 * until it resolves.
 */

export type JournalStatus = 'open' | 'tp_hit' | 'sl_hit' | 'sideways';
export type JournalPresetId = 'dayTrading' | 'swingHunter' | null;

export interface JournalEntry {
  id: string;
  ticker: string;
  addedAt: string; // ISO date, trading day the entry was created
  presetId: JournalPresetId;
  entry: number;
  tp1: number;
  tp2: number;
  sl: number;
  riskRewardPlanned: number;
  reasonBuy: string; // Alasan Membeli — from PresetEvaluation.reasons at add-time
  reasonAvoid: string; // Alasan Menghindari — from ConclusionAnalysis.watchOut at add-time
  status: JournalStatus;
  resolvedAt: string | null;
  exitPrice: number | null;
  gainLossPct: number | null;
  daysTracked: number;
}

export interface NewJournalEntryInput {
  ticker: string;
  presetId: JournalPresetId;
  entry: number;
  tp1: number;
  tp2: number;
  sl: number;
  riskRewardPlanned: number;
  reasonBuy: string;
  reasonAvoid: string;
}
