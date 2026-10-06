/**
 * decisionInput.ts
 *
 * The ONE mapping from page data (summary, daily bars, StockAnalysis, fundamentals) to Decision Engine v3.
 * Every screen that shows a BUY / WAIT / AVOID (detail page report, SARA Signals) goes through
 * `buildDecisionForStock`, so the same stock on the same data always gets the same verdict.
 */

import { evaluateFundamentalScreening } from '@/domain/analysis/aiStockEngine';
import { buildDecisionV3, DecisionV3Report } from '@/domain/analysis/decisionEngineV3';
import { buildFundamentalPillars, FundamentalPillars, isFinancial } from '@/domain/analysis/fundamentalPillars';
import { MomentumInput } from '@/domain/analysis/momentumSpeculation';
import { computeStockAnalysis } from '@/domain/analysis/stockAnalysisEngine';
import { buildTechnicalAnalysis, TechnicalAnalysisV3 } from '@/domain/analysis/technicalAnalysisV3';
import { atr } from '@/domain/indicators/atr';
import { ema, lastValid } from '@/domain/indicators/movingAverages';
import { FundamentalDetail } from '@/domain/models/Fundamentals';
import { OHLCVBar } from '@/domain/models/History';
import { StockSummary } from '@/domain/models/Stock';
import { StockAnalysis } from '@/domain/models/StockAnalysis';

const num = (n: number | null | undefined): number | null => (n != null && Number.isFinite(n) ? n : null);
const pos = (n: number | null | undefined): number | null => (n != null && Number.isFinite(n) && n > 0 ? n : null);

/** EMA 9 & ATR 14 aren't part of StockAnalysis — derived from the same daily bars. */
export function deriveEma9Atr14(bars: OHLCVBar[]): { ema9: number | null; atr14: number | null } {
  return { ema9: pos(lastValid(ema(bars.map((b) => b.close), 9))), atr14: pos(lastValid(atr(bars, 14))) };
}

export function buildMomentumInput(a: {
  summary: StockSummary;
  bars: OHLCVBar[];
  analysis: StockAnalysis;
  fundamentals: FundamentalDetail | null;
  pillars: FundamentalPillars;
  vwap: number | null;
  longBars?: OHLCVBar[];
}): MomentumInput {
  const { summary, analysis, fundamentals, pillars } = a;
  const { ema9, atr14 } = deriveEma9Atr14(a.bars);
  const history = a.longBars && a.longBars.length > a.bars.length ? a.longBars : a.bars;
  const emaOf = (bars: OHLCVBar[], p: number) => (bars.length >= p ? pos(lastValid(ema(bars.map((b) => b.close), p))) : null);
  const { trendEma, indicators, volume, supportResistance } = analysis;
  return {
    bars: a.bars,
    price: summary.lastClose,
    change1D: num(summary.percentChange1D),
    change1W: num(summary.percentChange1W),
    change1M: num(summary.percentChange1M),
    annualHigh: pos(summary.annualHigh),
    ema9,
    ema20: pos(trendEma.ema20),
    ema50: pos(trendEma.ema50),
    ema21: emaOf(history, 21),
    ema200: emaOf(history, 200),
    longBars: history,
    vwap: a.vwap,
    rvol: pos(volume.relativeVolume),
    volumeMa20: pos(volume.volumeMa20),
    rsi14: num(indicators.rsi14),
    macdHistogram: num(indicators.macdHistogram),
    atr14,
    tradedValue: pos(summary.value),
    capitalization: pos(summary.capitalization),
    freeFloat: pos(summary.freeFloat),
    per: summary.per !== 0 ? num(summary.per) : null,
    pbv: pos(summary.pbv),
    roe: summary.roe !== 0 ? num(summary.roe) : null,
    revenueGrowth: num(fundamentals?.revenueGrowth),
    earningsGrowth: num(fundamentals?.earningsGrowth),
    debtToEquity: num(fundamentals?.debtToEquity),
    currentRatio: num(fundamentals?.currentRatio),
    netMargin: num(fundamentals?.netMargin),
    isFinancial: isFinancial(summary),
    healthVerdict: pillars.health.verdict,
    valuationVerdict: pillars.valuation.verdict,
    fairValue: pillars.valuation.fairValue,
    accumulationLow: pillars.valuation.accumulationLow,
    accumulationHigh: pillars.valuation.accumulationHigh,
    supports: supportResistance.supports.map((s) => s.price),
    resistances: supportResistance.resistances.map((r) => r.price),
  };
}

/**
 * Full pipeline for one stock. `analysis` / `pillars` may be passed when the caller already has them
 * (detail page); otherwise they are computed exactly as the detail page computes them.
 */
export function buildDecisionForStock(a: {
  summary: StockSummary;
  bars: OHLCVBar[];
  fundamentals: FundamentalDetail | null;
  vwap: number | null;
  analysis?: StockAnalysis;
  pillars?: FundamentalPillars;
}): DecisionV3Report {
  const analysis = a.analysis ?? computeStockAnalysis(a.summary, a.bars);
  const pillars = a.pillars ?? buildFundamentalPillars(a.summary, a.fundamentals, evaluateFundamentalScreening(a.summary));
  return buildDecisionV3(buildMomentumInput({ summary: a.summary, bars: a.bars, analysis, fundamentals: a.fundamentals, pillars, vwap: a.vwap }));
}

/**
 * Detail page: the v3 decision plus the 7-step technical analysis built from the SAME input, so step 7
 * (Keputusan) is the engine verdict. `longBars` (e.g. 2y chart history) lets EMA 200 be computed.
 */
export function buildDecisionWithTechnical(a: {
  summary: StockSummary;
  bars: OHLCVBar[];
  analysis: StockAnalysis;
  fundamentals: FundamentalDetail | null;
  pillars: FundamentalPillars;
  vwap: number | null;
  longBars?: OHLCVBar[];
}): { report: DecisionV3Report; technical: TechnicalAnalysisV3 } {
  const input = buildMomentumInput(a);
  const report = buildDecisionV3(input);
  return { report, technical: buildTechnicalAnalysis(input, report) };
}
