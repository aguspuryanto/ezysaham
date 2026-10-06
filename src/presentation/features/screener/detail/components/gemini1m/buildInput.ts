/**
 * Maps the detail page's data (summary, daily bars, StockAnalysis, fundamentals) to the engine input.
 * Pure — no React — so the mapping can be reasoned about apart from the component.
 */

import { FundamentalPillars, isFinancial } from '@/domain/analysis/fundamentalPillars';
import { MomentumInput } from '@/domain/analysis/momentumSpeculation';
import { FundamentalDetail } from '@/domain/models/Fundamentals';
import { OHLCVBar } from '@/domain/models/History';
import { StockSummary } from '@/domain/models/Stock';
import { StockAnalysis } from '@/domain/models/StockAnalysis';

const num = (n: number | null | undefined): number | null => (n != null && Number.isFinite(n) ? n : null);
const pos = (n: number | null | undefined): number | null => (n != null && Number.isFinite(n) && n > 0 ? n : null);

export function buildMomentumInput(a: {
  summary: StockSummary;
  bars: OHLCVBar[];
  analysis: StockAnalysis;
  fundamentals: FundamentalDetail | null;
  pillars: FundamentalPillars;
  ema9: number | null;
  atr14: number | null;
  vwap: number | null;
}): MomentumInput {
  const { summary, analysis, fundamentals, pillars } = a;
  const { trendEma, indicators, volume, supportResistance } = analysis;
  return {
    bars: a.bars,
    price: summary.lastClose,
    change1D: num(summary.percentChange1D),
    change1W: num(summary.percentChange1W),
    change1M: num(summary.percentChange1M),
    annualHigh: pos(summary.annualHigh),
    ema9: pos(a.ema9),
    ema20: pos(trendEma.ema20),
    ema50: pos(trendEma.ema50),
    vwap: a.vwap,
    rvol: pos(volume.relativeVolume),
    volumeMa20: pos(volume.volumeMa20),
    rsi14: num(indicators.rsi14),
    macdHistogram: num(indicators.macdHistogram),
    atr14: pos(a.atr14),
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
