/**
 * Technical History: chronological event log + simple pattern backtest,
 * derived from OHLCV bars. Computed client-side via
 * src/domain/history/technicalHistoryEngine.ts.
 */

export type TechnicalEventCategory =
  | 'volume'
  | 'priceAction'
  | 'breakout'
  | 'accumDist'
  | 'indicatorCross';

export type EventTone = 'bullish' | 'bearish' | 'neutral';

export interface TechnicalEvent {
  date: string;
  category: TechnicalEventCategory;
  type: string;
  label: string;
  tone: EventTone;
  icon: string;
  summary: string;
  metrics: Record<string, string>;
}

export interface ExtremeVolumeBar {
  date: string;
  volume: number;
  rvol: number;
  percentChange: number;
  interpretation: string;
}

export interface VolumeHistoryResult {
  events: TechnicalEvent[];
  maxVolumeBar: ExtremeVolumeBar | null;
  minVolumeBar: ExtremeVolumeBar | null;
}

export interface PriceActionHistoryResult {
  events: TechnicalEvent[];
}

export interface BreakoutHistoryResult {
  events: TechnicalEvent[];
}

export interface AccumDistHistoryResult {
  events: TechnicalEvent[];
}

export interface IndicatorCrossHistoryResult {
  events: TechnicalEvent[];
}

export interface PatternHorizonStat {
  label: '5D' | '10D' | '20D';
  winRate: number;
  avgReturn: number;
  maxGain: number;
  maxDrawdown: number;
}

export interface PatternSetupResult {
  key: string;
  label: string;
  description: string;
  occurrences: number;
  horizons: PatternHorizonStat[];
  matchesToday: boolean;
  lowSample: boolean;
}

export interface HistoricalPatternResult {
  setups: PatternSetupResult[];
}

export interface TechnicalHistoryResult {
  ticker: string;
  barCount: number;
  volume: VolumeHistoryResult;
  priceAction: PriceActionHistoryResult;
  breakout: BreakoutHistoryResult;
  accumDist: AccumDistHistoryResult;
  indicatorCross: IndicatorCrossHistoryResult;
  historicalPattern: HistoricalPatternResult;
  timeline: TechnicalEvent[];
}
