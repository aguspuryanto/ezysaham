/**
 * screenerVerdict.ts
 *
 * Bulk-scan companion to riskGate.ts / tradeValidation.ts / stockAnalysisEngine.ts for the
 * Screener's ResultsTableNew. It computes, per row, the same three reads the single-stock
 * "10-Second Review" (StockAnalysisPageV3.tsx) already shows — Market Phase, a Setup label,
 * and a collapsed BUY/WAIT/NO_TRADE Trade Status — by calling those exact existing functions
 * in the same order (see StockAnalysisPageV3.tsx's `decision` useMemo). No new scoring math,
 * no price prediction: this module only orchestrates already-published pure functions against
 * whatever bars/fundamentals the caller has already fetched for a visible row.
 */

import { OHLCVBar } from '@/domain/models/History';
import { StockSummary } from '@/domain/models/Stock';
import { FundamentalDetail } from '@/domain/models/Fundamentals';
import { computeMarketPhase, MarketPhaseResult } from '@/domain/analysis/marketPhase';
import { computeStockAnalysis } from '@/domain/analysis/stockAnalysisEngine';
import { computeBandarScore } from '@/domain/analysis/bandarScore';
import {
  classifyZoneStatus,
  isEntryConfirmed,
  isPriceAtEntryTrigger,
  isSetupInvalidated,
} from '@/domain/analysis/tradeValidation';
import { classifyRvol, evaluateRiskGate, RiskGateStatus, TradeStatus } from '@/domain/analysis/riskGate';
import { computeFundamentalScore, FundamentalScore } from '@/domain/screener/presets';
import { evaluateFundamentalScreening, evaluateTechnicalScreening } from '@/domain/analysis/aiStockEngine';
import { buildFundamentalPillars, ValuationVerdict } from '@/domain/analysis/fundamentalPillars';
import { Trend } from '@/domain/models/StockAnalysis';

/** Minimum bars computeStockAnalysis needs for a non-degenerate read (mirrors its own internal guard). */
const MIN_ANALYSIS_BARS = 20;

/**
 * Rule-based setup label derived purely from the existing Market Phase classification — no
 * indicator of its own, no price forecast. Mapping is a fixed lookup, not a probability.
 */
export type SetupLabel = 'BOW/BOS' | 'BOB' | 'BOS' | 'NO CHASE' | 'NO TRADE' | '—';

/** Collapsed, long-only-screener view of riskGate.ts's TradeStatus — SHORT_SETUP has no place
 *  here (same rationale as StockAnalysisPageV3.tsx's deriveSwingStatus), WAIT_FOR_PULLBACK reads
 *  as WAIT. `null` means there isn't enough bar history to run the analysis at all. */
export type SwingTradeStatus = 'BUY' | 'WAIT' | 'NO_TRADE';

export type MomentumLevel = 'STRONG' | 'MODERATE' | 'WEAK';
export type VolumeLevel = 'HIGH' | 'MEDIUM' | 'LOW';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

/** Fair value read straight from fundamentalPillars.ts's valuation pillar — never recomputed here. */
export interface ScreenerValuation {
  verdict: ValuationVerdict;
  /** Lowest / highest of the per-method fair values that could be computed. */
  fairLow: number | null;
  fairHigh: number | null;
  /** Median of the methods (fundamentalPillars.ts's `fairValue`). */
  fairMedian: number | null;
  /** % from price to median fair value (positive = price below fair value). */
  upsidePct: number | null;
}

export interface ScreenerVerdict {
  marketPhase: MarketPhaseResult | null;
  setup: SetupLabel;
  /** Always computed from at least StockSummary's ROE/PER/PBV — computeFundamentalScore's own
   *  formula is untouched; a null `fundamentals` fetch just degrades gracefully (see its dataNotes). */
  fundamentalScore: FundamentalScore;
  tradeStatus: SwingTradeStatus | null;
  /** Screener display reads — each one a label on top of an existing function's output
   *  (trendEma.trend, evaluateTechnicalScreening's momentum tone, classifyRvol, riskGate status).
   *  null = not enough bar history. */
  trend: Trend | null;
  momentum: MomentumLevel | null;
  volume: VolumeLevel | null;
  relativeVolume: number | null;
  risk: RiskLevel | null;
  riskReasons: string[];
  valuation: ScreenerValuation;
}

const MOMENTUM_FROM_TONE: Record<'green' | 'amber' | 'red', MomentumLevel> = { green: 'STRONG', amber: 'MODERATE', red: 'WEAK' };
const RISK_FROM_GATE: Record<RiskGateStatus, RiskLevel> = { CLEAR: 'LOW', CONDITIONAL: 'MEDIUM', BLOCKED: 'HIGH' };

function volumeLevel(relativeVolume: number): VolumeLevel | null {
  const { tier } = classifyRvol(relativeVolume);
  if (tier === 'NO_DATA') return null;
  if (tier === 'VERY_LOW' || tier === 'LOW') return 'LOW';
  if (tier === 'NORMAL') return 'MEDIUM';
  return 'HIGH';
}

function valuationRead(summary: StockSummary, fundamentals: FundamentalDetail | null): ScreenerValuation {
  const { valuation } = buildFundamentalPillars(summary, fundamentals, evaluateFundamentalScreening(summary));
  const values = valuation.methods.map((m) => m.fairValue).filter((v): v is number => v != null && Number.isFinite(v) && v > 0);
  return {
    verdict: valuation.verdict,
    fairLow: values.length ? Math.min(...values) : null,
    fairHigh: values.length ? Math.max(...values) : null,
    fairMedian: valuation.fairValue,
    upsidePct: valuation.upsidePct,
  };
}

function setupFromPhase(phase: MarketPhaseResult | null): SetupLabel {
  if (!phase) return '—';
  switch (phase.phase) {
    case 'BULLISH_AWAL':
      return 'BOW/BOS';
    case 'BREAKOUT':
      return 'BOB';
    case 'PULLBACK':
      return 'BOS';
    case 'EXTENDED':
      return 'NO CHASE';
    case 'DISTRIBUTION':
    case 'BEARISH':
      return 'NO TRADE';
    default:
      return '—'; // NEUTRAL
  }
}

/** SHORT_SETUP has no place in a long-only screener view — collapses to NO_TRADE, same
 *  rationale as StockAnalysisPageV3.tsx's deriveSwingStatus. */
function collapseTradeStatus(status: TradeStatus): SwingTradeStatus {
  if (status === 'BUY') return 'BUY';
  if (status === 'NO_TRADE' || status === 'SHORT_SETUP') return 'NO_TRADE';
  return 'WAIT';
}

/**
 * Given a shortlisted row's OHLCV bars + (optional) Yahoo fundamentals, reproduces the exact
 * Risk Gate decision pipeline StockAnalysisPageV3.tsx runs for a single ticker — same field
 * derivation, same function calls, same order — so a row's Trade Status here can never disagree
 * with what the ticker's own detail page would show for the same EOD data.
 */
export function computeScreenerVerdict(
  summary: StockSummary,
  bars: OHLCVBar[],
  fundamentals: FundamentalDetail | null
): ScreenerVerdict {
  const marketPhase = computeMarketPhase(summary, bars);
  const setup = setupFromPhase(marketPhase);
  const fundamentalScore = computeFundamentalScore(summary, fundamentals);

  const valuation = valuationRead(summary, fundamentals);

  if (bars.length < MIN_ANALYSIS_BARS) {
    return {
      marketPhase, setup, fundamentalScore, tradeStatus: null,
      trend: null, momentum: null, volume: null, relativeVolume: null, risk: null, riskReasons: [], valuation,
    };
  }

  const analysis = computeStockAnalysis(summary, bars);
  const bandarScore = computeBandarScore(summary, bars);

  const bias = analysis.tradingPlan.recommendedBias === 'bearish' ? 'bearish' : 'bullish';
  const scenario = analysis.tradingPlan[bias];
  const isLong = scenario.direction === 'LONG';
  const price = summary.lastClose;

  const isStrongDistribution = bandarScore.classification.label === 'Strong Distribution';
  const isDistributionRisk = bandarScore.classification.label === 'Distribution Risk';
  const priceAtEntryTrigger = isPriceAtEntryTrigger(scenario.direction, price, scenario.entry);
  const setupInvalidated = isSetupInvalidated(scenario.direction, price, scenario.sl);

  const nearestSupport = analysis.supportResistance.supports[0];
  const entryZoneLow = isLong && nearestSupport ? nearestSupport.price : scenario.entry;
  const entryZoneHigh = scenario.entry;
  const zoneStatus = classifyZoneStatus(price, entryZoneLow, entryZoneHigh);

  const der = fundamentals?.debtToEquity ?? null;

  const bullishReversalCandle =
    analysis.priceAction.lastCandleColor === 'green' ||
    analysis.priceAction.pattern === 'bullish_engulfing' ||
    analysis.priceAction.pattern === 'hammer' ||
    analysis.priceAction.pattern === 'marubozu_bullish';
  const bearishReversalCandle =
    analysis.priceAction.lastCandleColor === 'red' ||
    analysis.priceAction.pattern === 'bearish_engulfing' ||
    analysis.priceAction.pattern === 'shooting_star' ||
    analysis.priceAction.pattern === 'marubozu_bearish';

  const entryConfirmed = isEntryConfirmed({
    priceAtEntryTrigger,
    setupInvalidated,
    trendValid: isLong ? analysis.trendEma.trend !== 'bearish' : analysis.trendEma.trend !== 'bullish',
    reversalConfirmed: isLong ? bullishReversalCandle : bearishReversalCandle,
    volumeSupportive: analysis.volume.relativeVolume >= 1,
  });

  const riskGate = evaluateRiskGate({
    direction: scenario.direction,
    trend: analysis.trendEma.trend,
    rsi14: analysis.indicators.rsi14,
    // Fundamental Score alone can only ever help block a BUY (riskGate.ts's hard/soft reasons) —
    // it never enables one by itself, so it can't "automatically produce a BUY" here either.
    fundamentalScore: fundamentalScore.composite,
    isStrongDistribution,
    priceBelowEma50: price <= analysis.trendEma.ema50,
    priceBelowEma200: price <= analysis.trendEma.ema200,
    priceAtEntryTrigger,
    setupInvalidated,
    entryConfirmed,
    extremeDistanceWarning: scenario.extremeDistanceWarning,
    isDistributionRisk,
    zoneStatus,
    der,
    roe: summary.roe,
  });

  const rawTradeStatus: TradeStatus = scenario.validationErrors.length > 0 ? 'NO_TRADE' : riskGate.tradeStatus;

  const technical = evaluateTechnicalScreening(analysis, summary);
  const rvol = analysis.volume.relativeVolume;

  return {
    marketPhase,
    setup,
    fundamentalScore,
    tradeStatus: collapseTradeStatus(rawTradeStatus),
    trend: analysis.trendEma.trend,
    momentum: MOMENTUM_FROM_TONE[technical.momentumStatus.tone],
    volume: volumeLevel(rvol),
    relativeVolume: Number.isFinite(rvol) ? rvol : null,
    risk: RISK_FROM_GATE[riskGate.riskGateStatus],
    riskReasons: riskGate.reasons,
    valuation,
  };
}
