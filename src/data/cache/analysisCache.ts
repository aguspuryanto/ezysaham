/**
 * analysisCache.ts
 *
 * Client-side in-memory & sessionStorage cache manager for Stock Pilot AI.
 * Prevents redundant HTTP requests, recalculations, and slow page re-renders.
 */

import { OHLCVBar } from '@/domain/models/History';
import { AiStockAdvisor, NewsSentimentSummary, StockNewsItem } from '@/domain/models/News';
import { StockSummary } from '@/domain/models/Stock';
import { StockAnalysis } from '@/domain/models/StockAnalysis';
import { BreakoutScores } from '@/domain/screener/presets';

export interface CachedTickerAnalysis {
  summary: StockSummary;
  bars: OHLCVBar[];
  analysis: StockAnalysis;
  newsItems: StockNewsItem[];
  newsSummary: NewsSentimentSummary;
  breakoutScores: BreakoutScores;
  advisor: AiStockAdvisor;
  cachedAt: number; // timestamp ms
}

const DEFAULT_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes TTL

// In-memory memory map for instant 0ms access within active session
const memoryAnalysisCache = new Map<string, CachedTickerAnalysis>();
let memorySummariesCache: { summaries: StockSummary[]; fetchedAt: number } | null = null;
let memorySummariesPromise: Promise<StockSummary[]> | null = null;

export const AnalysisCacheManager = {
  /**
   * Get cached full ticker analysis
   */
  getTickerAnalysis(ticker: string, ttlMs = DEFAULT_CACHE_TTL_MS): CachedTickerAnalysis | null {
    const key = ticker.toUpperCase();

    // 1. Check in-memory map
    const memEntry = memoryAnalysisCache.get(key);
    if (memEntry && Date.now() - memEntry.cachedAt < ttlMs) {
      return memEntry;
    }

    // 2. Fallback check sessionStorage
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        const raw = sessionStorage.getItem(`stockpilot_analysis_${key}`);
        if (raw) {
          const parsed: CachedTickerAnalysis = JSON.parse(raw);
          if (Date.now() - parsed.cachedAt < ttlMs) {
            memoryAnalysisCache.set(key, parsed);
            return parsed;
          }
        }
      } catch {
        // Ignore session storage errors
      }
    }

    return null;
  },

  /**
   * Save computed ticker analysis to memory and session storage
   */
  setTickerAnalysis(ticker: string, data: Omit<CachedTickerAnalysis, 'cachedAt'>): void {
    const key = ticker.toUpperCase();
    const entry: CachedTickerAnalysis = {
      ...data,
      cachedAt: Date.now(),
    };

    memoryAnalysisCache.set(key, entry);

    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        sessionStorage.setItem(`stockpilot_analysis_${key}`, JSON.stringify(entry));
      } catch {
        // Ignore storage quota exceeded errors
      }
    }
  },

  /**
   * Get cached stock summaries list
   */
  getSummaries(ttlMs = DEFAULT_CACHE_TTL_MS): StockSummary[] | null {
    if (memorySummariesCache && Date.now() - memorySummariesCache.fetchedAt < ttlMs) {
      return memorySummariesCache.summaries;
    }

    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        const raw = sessionStorage.getItem('stockpilot_summaries');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Date.now() - parsed.fetchedAt < ttlMs) {
            memorySummariesCache = parsed;
            return parsed.summaries;
          }
        }
      } catch {
        // Ignore session storage parse error
      }
    }

    return null;
  },

  /**
   * Save stock summaries list
   */
  setSummaries(summaries: StockSummary[]): void {
    const entry = { summaries, fetchedAt: Date.now() };
    memorySummariesCache = entry;

    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        sessionStorage.setItem('stockpilot_summaries', JSON.stringify(entry));
      } catch {
        // Ignore session storage errors
      }
    }
  },

  /**
   * Flight deduplication helper for fetching stock summaries promise
   */
  getSummariesPromise(): Promise<StockSummary[]> | null {
    return memorySummariesPromise;
  },

  setSummariesPromise(promise: Promise<StockSummary[]> | null): void {
    memorySummariesPromise = promise;
  },

  /**
   * Clear cache if user requests force refresh
   */
  clearTickerCache(ticker: string): void {
    const key = ticker.toUpperCase();
    memoryAnalysisCache.delete(key);
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        sessionStorage.removeItem(`stockpilot_analysis_${key}`);
      } catch {
        // Ignore
      }
    }
  },
};
