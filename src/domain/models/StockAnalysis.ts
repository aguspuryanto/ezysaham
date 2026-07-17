/**
 * Full 7-aspect technical analysis derived from OHLCV bars + summary.
 * Computed client-side via stockAnalysisEngine.ts.
 */

export type Trend = 'bullish' | 'bearish' | 'sideways';

// ── 1. Trend & EMA ────────────────────────────────────────────────────────────
export interface TrendEmaAnalysis {
  ema20: number;
  ema50: number;
  ema200: number;
  priceVsEma20: 'above' | 'below' | 'at';
  priceVsEma50: 'above' | 'below' | 'at';
  trend: Trend;
  trendDescription: string;
  higherLows: boolean; // last 3 swing lows forming higher low pattern
}

// ── 2. Level Penting (Resistance & Support) ──────────────────────────────────
export interface PriceLevel {
  price: number;
  label: string; // e.g. "R1", "S1"
  description: string; // e.g. "Resistance terdekat"
}

export interface SupportResistanceAnalysis {
  resistances: PriceLevel[];
  supports: PriceLevel[];
}

// ── 3. Price Action ───────────────────────────────────────────────────────────
export type CandlePattern =
  | 'bullish_engulfing'
  | 'bearish_engulfing'
  | 'doji'
  | 'hammer'
  | 'shooting_star'
  | 'marubozu_bullish'
  | 'marubozu_bearish'
  | 'none';

export interface PriceActionAnalysis {
  lastCandleColor: 'green' | 'red' | 'doji';
  pattern: CandlePattern;
  patternLabel: string;
  aboveEma20: boolean;
  aboveEma50: boolean;
  canContinueUp: boolean; // price above nearest resistance zone
  notes: string[];
}

// ── 4. Volume ─────────────────────────────────────────────────────────────────
export interface VolumeAnalysis {
  lastVolume: number;
  volumeMa20: number;
  relativeVolume: number; // lastVolume / volumeMa20
  volumeTrend: 'increasing' | 'decreasing' | 'normal';
  isHighVolume: boolean; // RVOL > 1.5
  idealBreakoutVolume: number; // approximate 1.3x MA20 target
  notes: string[];
}

// ── 5. Indikator ──────────────────────────────────────────────────────────────
export type RsiZone = 'oversold' | 'bullish_zone' | 'overbought_risk' | 'overbought' | 'neutral';
export type StochZone = 'oversold' | 'neutral' | 'overbought';
export type MacdSignal = 'bullish_crossover' | 'bullish' | 'bearish_crossover' | 'bearish' | 'neutral';

export interface IndicatorAnalysis {
  rsi14: number;
  rsiZone: RsiZone;
  rsiNote: string;
  macdValue: number;
  macdSignal: number;
  macdHistogram: number;
  macdSignalType: MacdSignal;
  macdNote: string;
  stochK: number;
  stochD: number;
  stochZone: StochZone;
  stochNote: string;
}

// ── 6. Rencana Trading ────────────────────────────────────────────────────────
export interface TradeScenario {
  entry: number;
  tp1: number;
  tp2: number;
  sl: number;
  riskRewardRatio: number;
  notes: string;
}

export interface TradingPlanAnalysis {
  bullish: TradeScenario;
  bearish: TradeScenario;
  recommendedBias: 'bullish' | 'bearish' | 'neutral';
}

// ── 7. Kesimpulan ─────────────────────────────────────────────────────────────
export interface ConclusionAnalysis {
  overallBias: Trend;
  summary: string;
  keyLevel: string; // "Kunci utama area X.XXX"
  watchOut: string; // risk warning
}

// ── Composite ─────────────────────────────────────────────────────────────────
export interface StockAnalysis {
  ticker: string;
  generatedAt: Date;
  trendEma: TrendEmaAnalysis;
  supportResistance: SupportResistanceAnalysis;
  priceAction: PriceActionAnalysis;
  volume: VolumeAnalysis;
  indicators: IndicatorAnalysis;
  tradingPlan: TradingPlanAnalysis;
  conclusion: ConclusionAnalysis;
}
