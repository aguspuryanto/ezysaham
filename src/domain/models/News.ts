/**
 * News.ts
 *
 * Types for stock news items, news sentiment analysis, and the AI Stock Advisor synthesis.
 */

export type NewsSentiment = 'bullish' | 'bearish' | 'neutral';

export interface StockNewsItem {
  id: string;
  title: string;
  snippet: string;
  url: string;
  publisher: string;
  /** Locale-formatted display string (id-ID) — not machine-parseable, see publishedAtMs. */
  publishedAt: string;
  /** Epoch ms of publish time, when known — lets sentiment weighting discount stale news
   * (features_analisa.md rule 10) without depending on parsing the locale-formatted `publishedAt`
   * string. Absent when the source didn't provide a reliable timestamp. */
  publishedAtMs?: number;
  sentiment: NewsSentiment;
  impactScore: number; // 1 to 5
}

/** features_analisa.md rule 10: berita lama tidak boleh diberi bobot seperti katalis terbaru. */
export type NewsAgeBucket = 'CURRENT' | 'RECENT' | 'AGING' | 'HISTORICAL' | 'UNKNOWN';

export interface NewsSentimentSummary {
  totalNews: number;
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
  /** Age-weighted sentiment score, 0-100 — a bullish item from 6 months ago counts for much less
   * than one from today (features_analisa.md rule 10). */
  netSentimentScore: number; // 0 to 100
  overallSentiment: NewsSentiment;
}

export type AiVerdict = 'SANGAT_BELI' | 'BELI' | 'TAHAN' | 'HINDARI';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface AiStockAdvisor {
  verdict: AiVerdict;
  verdictLabel: string;
  verdictTone: 'green' | 'amber' | 'red' | 'blue';
  confidenceScore: number; // 0 to 100
  compositeScore: number; // 0 to 100
  fundamentalScore: number; // 0 to 100
  technicalScore: number; // 0 to 100
  newsScore: number; // 0 to 100
  breakoutScore: number; // 0 to 100
  /** 0-100, higher = riskier (RSI overbought, distribution flags, dsb). Score ≠ signal — lihat verdict untuk keputusan. */
  riskScore: number;
  riskLevel: RiskLevel;
  buyReasons: string[];
  avoidReasons: string[];
  executiveSummary: string;
  tradingRecommendation: string;
}
