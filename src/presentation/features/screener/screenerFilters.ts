/**
 * screenerFilters.ts
 *
 * Sidebar filter model for the Screener. "Basic" filters read StockSummary only (available for
 * every row instantly); "advanced" filters read a row's ScreenerVerdict, which is fetched lazily —
 * the page computes verdicts for every candidate while an advanced filter is active.
 */

import { MarketPhase } from '@/domain/analysis/marketPhase';
import { ValuationVerdict } from '@/domain/analysis/fundamentalPillars';
import { MomentumLevel, RiskLevel, ScreenerVerdict } from '@/domain/analysis/screenerVerdict';
import { StockSummary } from '@/domain/models/Stock';
import { Trend } from '@/domain/models/StockAnalysis';
import { FundamentalScore } from '@/domain/screener/presets';

type All = 'all';

export interface ScreenerFilterState {
  sector: string;
  cap: All | 'small' | 'mid' | 'large';
  price: All | 'lt500' | '500to2000' | '2000to10000' | 'gt10000';
  volume: All | 'lt1m' | '1mTo50m' | 'gt50m';
  phase: All | MarketPhase;
  trend: All | Trend;
  fundamental: All | FundamentalScore['status'];
  momentum: All | MomentumLevel;
  valuation: All | ValuationVerdict;
  risk: All | RiskLevel;
}

export const DEFAULT_FILTERS: ScreenerFilterState = {
  sector: 'all', cap: 'all', price: 'all', volume: 'all',
  phase: 'all', trend: 'all', fundamental: 'all', momentum: 'all', valuation: 'all', risk: 'all',
};

export interface FilterOption<V extends string> { value: V; label: string }

export const CAP_OPTIONS: FilterOption<ScreenerFilterState['cap']>[] = [
  { value: 'all', label: 'Semua' },
  { value: 'small', label: 'Small (< Rp1 T)' },
  { value: 'mid', label: 'Mid (Rp1–10 T)' },
  { value: 'large', label: 'Large (> Rp10 T)' },
];
export const PRICE_OPTIONS: FilterOption<ScreenerFilterState['price']>[] = [
  { value: 'all', label: 'Semua' },
  { value: 'lt500', label: '< Rp500' },
  { value: '500to2000', label: 'Rp500 – 2.000' },
  { value: '2000to10000', label: 'Rp2.000 – 10.000' },
  { value: 'gt10000', label: '> Rp10.000' },
];
export const VOLUME_OPTIONS: FilterOption<ScreenerFilterState['volume']>[] = [
  { value: 'all', label: 'Semua' },
  { value: 'lt1m', label: '< 1 jt lembar' },
  { value: '1mTo50m', label: '1 – 50 jt lembar' },
  { value: 'gt50m', label: '> 50 jt lembar' },
];
export const PHASE_OPTIONS: FilterOption<ScreenerFilterState['phase']>[] = [
  { value: 'all', label: 'Semua' },
  { value: 'BULLISH_AWAL', label: 'Bullish Awal' },
  { value: 'BREAKOUT', label: 'Breakout' },
  { value: 'PULLBACK', label: 'Pullback' },
  { value: 'EXTENDED', label: 'Extended' },
  { value: 'DISTRIBUTION', label: 'Distribution' },
  { value: 'BEARISH', label: 'Bearish' },
  { value: 'NEUTRAL', label: 'Netral' },
];
export const TREND_OPTIONS: FilterOption<ScreenerFilterState['trend']>[] = [
  { value: 'all', label: 'Semua' },
  { value: 'bullish', label: 'Bullish' },
  { value: 'sideways', label: 'Sideways' },
  { value: 'bearish', label: 'Bearish' },
];
export const FUNDAMENTAL_OPTIONS: FilterOption<ScreenerFilterState['fundamental']>[] = [
  { value: 'all', label: 'Semua' },
  { value: 'EXCELLENT', label: 'Excellent' },
  { value: 'GOOD', label: 'Good' },
  { value: 'FAIR', label: 'Neutral' },
  { value: 'WEAK', label: 'Weak' },
];
export const MOMENTUM_OPTIONS: FilterOption<ScreenerFilterState['momentum']>[] = [
  { value: 'all', label: 'Semua' },
  { value: 'STRONG', label: 'Strong' },
  { value: 'MODERATE', label: 'Moderate' },
  { value: 'WEAK', label: 'Weak' },
];
export const VALUATION_OPTIONS: FilterOption<ScreenerFilterState['valuation']>[] = [
  { value: 'all', label: 'Semua' },
  { value: 'UNDERVALUED', label: 'Undervalued' },
  { value: 'WAJAR', label: 'Fair Value' },
  { value: 'PREMIUM', label: 'Premium' },
  { value: 'OVERVALUED', label: 'Overvalued' },
];
export const RISK_OPTIONS: FilterOption<ScreenerFilterState['risk']>[] = [
  { value: 'all', label: 'Semua' },
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
];

const T = 1_000_000_000_000;

export function matchesBasicFilters(s: StockSummary, f: ScreenerFilterState): boolean {
  if (f.sector !== 'all' && s.sector !== f.sector) return false;
  if (f.cap !== 'all') {
    const c = s.capitalization;
    if (!(c > 0)) return false;
    if (f.cap === 'small' && !(c < T)) return false;
    if (f.cap === 'mid' && !(c >= T && c <= 10 * T)) return false;
    if (f.cap === 'large' && !(c > 10 * T)) return false;
  }
  if (f.price !== 'all') {
    const p = s.lastClose;
    if (f.price === 'lt500' && !(p < 500)) return false;
    if (f.price === '500to2000' && !(p >= 500 && p <= 2000)) return false;
    if (f.price === '2000to10000' && !(p > 2000 && p <= 10000)) return false;
    if (f.price === 'gt10000' && !(p > 10000)) return false;
  }
  if (f.volume !== 'all') {
    const v = s.volume;
    if (f.volume === 'lt1m' && !(v < 1_000_000)) return false;
    if (f.volume === '1mTo50m' && !(v >= 1_000_000 && v <= 50_000_000)) return false;
    if (f.volume === 'gt50m' && !(v > 50_000_000)) return false;
  }
  return true;
}

export function hasAdvancedFilters(f: ScreenerFilterState): boolean {
  return f.phase !== 'all' || f.trend !== 'all' || f.fundamental !== 'all' || f.momentum !== 'all' || f.valuation !== 'all' || f.risk !== 'all';
}

/** undefined verdict = not loaded yet → excluded while an advanced filter is active. */
export function matchesAdvancedFilters(v: ScreenerVerdict | undefined, f: ScreenerFilterState): boolean {
  if (!hasAdvancedFilters(f)) return true;
  if (!v) return false;
  if (f.phase !== 'all' && v.marketPhase?.phase !== f.phase) return false;
  if (f.trend !== 'all' && v.trend !== f.trend) return false;
  if (f.fundamental !== 'all' && v.fundamentalScore.status !== f.fundamental) return false;
  if (f.momentum !== 'all' && v.momentum !== f.momentum) return false;
  if (f.valuation !== 'all' && v.valuation.verdict !== f.valuation) return false;
  if (f.risk !== 'all' && v.risk !== f.risk) return false;
  return true;
}

export function countActiveFilters(f: ScreenerFilterState): number {
  return (Object.keys(f) as (keyof ScreenerFilterState)[]).filter((k) => f[k] !== DEFAULT_FILTERS[k]).length;
}
