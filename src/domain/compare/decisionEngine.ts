/**
 * decisionEngine.ts
 *
 * Turns the raw metrics from metricConfig.ts into the six weighted category
 * scores (Quality/Value/Growth/Dividend/Momentum/Risk) that drive the
 * Compare page's "who's actually better" verdict — reusing the same
 * profitability/valuation/financial-health/dividend scorers the Screener's
 * Fundamental preset already relies on (see presets.ts) so the two features
 * never disagree about what counts as a "good" ROE or a "healthy" DER.
 */
import { StockSummary } from '@/domain/models/Stock';
import { FundamentalDetail } from '@/domain/models/Fundamentals';
import {
  calcDividendScore,
  calcFinancialHealthScore,
  calcProfitabilityScore,
  calcValuationScore,
  weightedComposite,
} from '@/domain/screener/presets';

export interface CategoryScores {
  quality: number | null;
  value: number | null;
  growth: number | null;
  dividend: number | null;
  momentum: number | null;
  risk: number | null;
}

export const CATEGORY_LABELS: Record<keyof CategoryScores, string> = {
  quality: 'Quality',
  value: 'Value',
  growth: 'Growth',
  dividend: 'Dividend',
  momentum: 'Momentum',
  risk: 'Risk',
};

/** Category weights per spec: Quality 25 / Value 20 / Growth 20 / Dividend 15 / Momentum 10 / Risk 10. */
export const CATEGORY_WEIGHTS: Record<keyof CategoryScores, number> = {
  quality: 25,
  value: 20,
  growth: 20,
  dividend: 15,
  momentum: 10,
  risk: 10,
};

const CATEGORY_KEYS = Object.keys(CATEGORY_WEIGHTS) as (keyof CategoryScores)[];

function calcGrowthScore(revenueGrowth: number | null): number | null {
  if (revenueGrowth == null) return null;
  if (revenueGrowth >= 20) return 100;
  if (revenueGrowth >= 10) return 80;
  if (revenueGrowth >= 5) return 60;
  if (revenueGrowth >= 0) return 40;
  if (revenueGrowth >= -10) return 20;
  return 5;
}

/** Blends ROE with net margin when Yahoo has it — two efficiency signals
 *  instead of ROE alone, still degrading gracefully to ROE-only. */
function calcQualityScore(summary: StockSummary, fundamentals: FundamentalDetail | null): number {
  const roeScore = calcProfitabilityScore(summary.roe);
  const netMargin = fundamentals?.netMargin ?? null;
  if (netMargin == null) return roeScore;

  let marginScore: number;
  if (netMargin >= 20) marginScore = 100;
  else if (netMargin >= 10) marginScore = 75;
  else if (netMargin > 0) marginScore = 45;
  else marginScore = 10;

  return Math.round(roeScore * 0.6 + marginScore * 0.4);
}

/** Momentum is the only category read straight off real price action already
 *  present on StockSummary (1M/3M/6M % change) — no new data source, and it
 *  keeps this a genuine "market is already reacting" signal rather than a
 *  restatement of the fundamental categories. */
function calcMomentumScore(summary: StockSummary): number {
  const avg = (summary.percentChange1M + summary.percentChange3M + summary.percentChange6M) / 3;
  if (avg >= 15) return 100;
  if (avg >= 8) return 85;
  if (avg >= 3) return 65;
  if (avg >= 0) return 50;
  if (avg >= -8) return 30;
  return 10;
}

export interface DecisionResult {
  scores: CategoryScores;
  /** Weighted average over only the categories that have data — a missing
   *  category (e.g. no Yahoo fundamentals at all) drops out instead of
   *  dragging the score toward 0. */
  overall: number;
}

export function computeDecisionScore(summary: StockSummary, fundamentals: FundamentalDetail | null): DecisionResult {
  const scores: CategoryScores = {
    quality: calcQualityScore(summary, fundamentals),
    value: calcValuationScore(summary.per, summary.pbv),
    growth: calcGrowthScore(fundamentals?.revenueGrowth ?? null),
    dividend: fundamentals ? calcDividendScore(fundamentals.dividendYield, fundamentals.dividendPayoutRatio) : null,
    momentum: calcMomentumScore(summary),
    risk: fundamentals ? calcFinancialHealthScore(fundamentals.debtToEquity, fundamentals.currentRatio) : null,
  };

  const overall = weightedComposite(CATEGORY_KEYS.map((key) => ({ score: scores[key], weight: CATEGORY_WEIGHTS[key] })));

  return { scores, overall };
}

// ─── Investor profiles ──────────────────────────────────────────────────────
export type InvestorProfileKey = 'dividend' | 'value' | 'growth' | 'conservative';

export const INVESTOR_PROFILE_LABELS: Record<InvestorProfileKey, string> = {
  dividend: 'Dividend Investor',
  value: 'Value Investor',
  growth: 'Growth Investor',
  conservative: 'Conservative Investor',
};

const INVESTOR_PROFILE_WEIGHTS: Record<InvestorProfileKey, Partial<Record<keyof CategoryScores, number>>> = {
  dividend: { dividend: 40, quality: 25, risk: 20, value: 15 },
  value: { value: 40, quality: 25, risk: 20, dividend: 15 },
  growth: { growth: 40, quality: 25, momentum: 20, value: 15 },
  conservative: { quality: 35, risk: 30, dividend: 20, value: 15 },
};

export function computeInvestorProfileScore(scores: CategoryScores, profile: InvestorProfileKey): number {
  const weights = INVESTOR_PROFILE_WEIGHTS[profile];
  const dims = (Object.keys(weights) as (keyof CategoryScores)[]).map((key) => ({
    score: scores[key],
    weight: weights[key]!,
  }));
  return weightedComposite(dims);
}

export interface InvestorProfileResult {
  key: InvestorProfileKey;
  label: string;
  scoreA: number;
  scoreB: number;
  winner: 'a' | 'b' | null;
}

export function buildInvestorProfiles(scoresA: CategoryScores, scoresB: CategoryScores): InvestorProfileResult[] {
  return (Object.keys(INVESTOR_PROFILE_LABELS) as InvestorProfileKey[]).map((key) => {
    const scoreA = computeInvestorProfileScore(scoresA, key);
    const scoreB = computeInvestorProfileScore(scoresB, key);
    return {
      key,
      label: INVESTOR_PROFILE_LABELS[key],
      scoreA,
      scoreB,
      winner: scoreA === scoreB ? null : scoreA > scoreB ? 'a' : 'b',
    };
  });
}

// ─── AI verdict ─────────────────────────────────────────────────────────────
export interface AiVerdict {
  winner: 'a' | 'b' | null;
  winnerOverall: number;
  loserOverall: number;
  /** Category labels where the winning side leads by a meaningful margin. */
  winnerStrengths: string[];
  /** Category labels where the losing side actually leads — its bright spots. */
  loserStrengths: string[];
  /** Plain-language caution notes derived from the loser-side strengths (i.e. the winner's weak spots). */
  risks: string[];
}

const MEANINGFUL_GAP = 8;

export function buildAiVerdict(
  tickerA: string,
  scoresA: CategoryScores,
  overallA: number,
  tickerB: string,
  scoresB: CategoryScores,
  overallB: number
): AiVerdict {
  const winner = overallA === overallB ? null : overallA > overallB ? 'a' : 'b';
  const [winnerScores, loserScores] = winner === 'b' ? [scoresB, scoresA] : [scoresA, scoresB];
  const [winnerOverall, loserOverall] = winner === 'b' ? [overallB, overallA] : [overallA, overallB];

  const winnerStrengths: string[] = [];
  const loserStrengths: string[] = [];

  for (const key of CATEGORY_KEYS) {
    const w = winnerScores[key];
    const l = loserScores[key];
    if (w == null || l == null) continue;
    const diff = w - l;
    if (diff >= MEANINGFUL_GAP) winnerStrengths.push(CATEGORY_LABELS[key]);
    else if (diff <= -MEANINGFUL_GAP) loserStrengths.push(CATEGORY_LABELS[key]);
  }

  const winnerTicker = winner === 'b' ? tickerB : tickerA;
  const loserTicker = winner === 'b' ? tickerA : tickerB;
  const risks = loserStrengths.map((label) => `${winnerTicker} memiliki ${label} yang lebih lemah dibanding ${loserTicker}.`);

  return { winner, winnerOverall, loserOverall, winnerStrengths, loserStrengths, risks };
}
