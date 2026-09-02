'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { OHLCVBar } from '@/domain/models/History';
import { StockSummary } from '@/domain/models/Stock';
import { StockAnalysis } from '@/domain/models/StockAnalysis';
import { FundamentalDetail } from '@/domain/models/Fundamentals';
import { computeStockAnalysis } from '@/domain/analysis/stockAnalysisEngine';
import { computeDataFreshness, DataFreshness } from '@/domain/analysis/dataFreshness';
import { BreakoutScores, computeBreakoutScores } from '@/domain/screener/presets';
import { getStockFundamentals, getStockHistory, getStockSummaries } from '@/data/repositories/StockRepository';
import { getStockNews } from '@/data/repositories/newsRepository';
import { StockNewsItem, NewsSentimentSummary, AiStockAdvisor } from '@/domain/models/News';
import {
  computeAiStockAdvisor,
  FundamentalScreeningResult,
  TechnicalScreeningResult,
} from '@/domain/analysis/aiStockEngine';
import { AnalysisCacheManager } from '@/data/cache/analysisCache';

export type StockAnalysisStatus = 'loading' | 'ready' | 'error';

export interface UseStockAnalysisResult {
  status: StockAnalysisStatus;
  summary: StockSummary | null;
  analysis: StockAnalysis | null;
  bars: OHLCVBar[];
  newsItems: StockNewsItem[];
  newsSummary: NewsSentimentSummary;
  newsLoading: boolean;
  allSummaries: StockSummary[];
  breakoutScores: BreakoutScores | null;
  freshness: DataFreshness | null;
  advisor: AiStockAdvisor | null;
  fundamentalScreening: FundamentalScreeningResult | null;
  technicalScreening: TechnicalScreeningResult | null;
  /** Dividend & balance-sheet-ratio detail from Yahoo Finance. Null while loading
   *  or when unavailable for this ticker — never coerced to zero. */
  fundamentals: FundamentalDetail | null;
  fundamentalsLoading: boolean;
  reload: (forceRefresh?: boolean) => Promise<void>;
}

const EMPTY_NEWS_SUMMARY: NewsSentimentSummary = {
  totalNews: 0,
  bullishCount: 0,
  bearishCount: 0,
  neutralCount: 0,
  netSentimentScore: 50,
  overallSentiment: 'neutral',
};

/**
 * Fetches + computes everything needed to render a single ticker's full
 * analysis (summary, bars, technical/fundamental/news/breakout, AI verdict).
 * Extracted from StockAnalysisPage so it can also run per-side on the
 * Compare page without duplicating the fetch/compute pipeline.
 */
export function useStockAnalysis(ticker: string): UseStockAnalysisResult {
  const [status, setStatus] = useState<StockAnalysisStatus>('loading');
  const [summary, setSummary] = useState<StockSummary | null>(null);
  const [analysis, setAnalysis] = useState<StockAnalysis | null>(null);
  const [bars, setBars] = useState<OHLCVBar[]>([]);
  const [newsItems, setNewsItems] = useState<StockNewsItem[]>([]);
  const [newsSummary, setNewsSummary] = useState<NewsSentimentSummary>(EMPTY_NEWS_SUMMARY);
  const [newsLoading, setNewsLoading] = useState(false);
  const [allSummaries, setAllSummaries] = useState<StockSummary[]>([]);
  const [fundamentals, setFundamentals] = useState<FundamentalDetail | null>(null);
  const [fundamentalsLoading, setFundamentalsLoading] = useState(false);

  const load = useCallback(async (forceRefresh = false) => {
    const code = ticker.toUpperCase();

    // ⚡ Fast-path: Check Client Cache first for 0ms loading!
    if (!forceRefresh) {
      const cached = AnalysisCacheManager.getTickerAnalysis(code);
      if (cached) {
        setSummary(cached.summary);
        setBars(cached.bars);
        setAnalysis(cached.analysis);
        setNewsItems(cached.newsItems);
        setNewsSummary(cached.newsSummary);
        setStatus('ready');
        getStockSummaries().then(setAllSummaries).catch(() => { }); // cache-backed, non-blocking
        return; // 0ms instant render!
      }
    } else {
      AnalysisCacheManager.clearTickerCache(code);
    }

    setStatus('loading');
    setNewsLoading(true);
    try {
      const [summaries, bars, newsData] = await Promise.all([
        getStockSummaries(),
        getStockHistory(code),
        getStockNews(code),
      ]);

      const found = summaries.find((s) => s.ticker === code);
      if (!found) throw new Error('Ticker tidak ditemukan');

      // Pasardana dipakai di Screener untuk daftar ~1000 saham sekaligus, tapi
      // datanya kadang stale untuk ticker tertentu. Yahoo (via history bars)
      // lebih akurat/live per-ticker, jadi halaman detail ini memakainya
      // sebagai acuan harga — sinkronkan juga percentChange1D dari bar yang
      // sama supaya harga & persentase di header tetap konsisten satu sama
      // lain (harga dan persentase boleh beda dari Screener bila Pasardana
      // sedang stale untuk ticker ini).
      if (bars.length > 0) {
        const lastBar = bars[bars.length - 1];
        const prevBar = bars.length > 1 ? bars[bars.length - 2] : null;
        found.lastClose = lastBar.close;
        if (prevBar) {
          found.prevClose = prevBar.close;
          found.percentChange1D = ((lastBar.close - prevBar.close) / prevBar.close) * 100;
        }
      }

      setSummary(found);
      setBars(bars);
      setAllSummaries(summaries);

      // Computations
      const computedAnalysis = computeStockAnalysis(found, bars);
      const computedBreakout = computeBreakoutScores(found, bars);
      const computedFreshness = computeDataFreshness(bars, new Date());
      const computedAdvisor = computeAiStockAdvisor(
        found,
        computedAnalysis,
        newsData.summary,
        computedBreakout,
        computedFreshness
      ).advisor;

      setAnalysis(computedAnalysis);
      setNewsItems(newsData.items);
      setNewsSummary(newsData.summary);
      setNewsLoading(false);
      setStatus('ready');

      // 💾 Save to Instant Cache
      AnalysisCacheManager.setTickerAnalysis(code, {
        summary: found,
        bars,
        analysis: computedAnalysis,
        newsItems: newsData.items,
        newsSummary: newsData.summary,
        breakoutScores: computedBreakout,
        advisor: computedAdvisor,
      });
    } catch {
      setStatus('error');
      setNewsLoading(false);
    }
  }, [ticker]);

  useEffect(() => { load(false); }, [load]);

  // Dividend/balance-sheet detail is fetched separately from the summary/bars/news
  // pipeline above: it's not part of the instant-cache shape (it changes slowly and
  // the API route itself is cached 6h server-side), so it loads independently and
  // doesn't block or get blocked by the 0ms cached-summary fast path.
  useEffect(() => {
    const code = ticker.toUpperCase();
    let cancelled = false;
    setFundamentals(null);
    setFundamentalsLoading(true);
    getStockFundamentals(code)
      .then((data) => {
        if (!cancelled) setFundamentals(data);
      })
      .finally(() => {
        if (!cancelled) setFundamentalsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  const breakoutScores = useMemo(() => {
    if (!summary || bars.length === 0) return null;
    return computeBreakoutScores(summary, bars);
  }, [summary, bars]);

  const freshness = useMemo(() => computeDataFreshness(bars, new Date()), [bars]);

  const { advisor, fundamentalScreening, technicalScreening } = useMemo(() => {
    if (!summary || !analysis || !breakoutScores) {
      return { advisor: null, fundamentalScreening: null, technicalScreening: null };
    }
    return computeAiStockAdvisor(summary, analysis, newsSummary, breakoutScores, freshness);
  }, [summary, analysis, newsSummary, breakoutScores, freshness]);

  return {
    status,
    summary,
    analysis,
    bars,
    newsItems,
    newsSummary,
    newsLoading,
    allSummaries,
    breakoutScores,
    freshness,
    advisor,
    fundamentalScreening,
    technicalScreening,
    fundamentals,
    fundamentalsLoading,
    reload: load,
  };
}
