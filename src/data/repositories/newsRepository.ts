import { NewsAgeBucket, NewsRelevance, NewsSentimentSummary, StockNewsItem } from '@/domain/models/News';

/** Extra context to classify relevance beyond the ticker alone — not known until the stock summary
 * has loaded, so the first pass (inside getStockNews) only has `ticker` and a second, fuller pass
 * re-runs once useStockAnalysis has the summary (see useStockAnalysis.ts). */
export interface NewsClassificationContext {
  ticker: string;
  name?: string;
  sector?: string;
}

export async function getStockNews(ticker: string): Promise<{
  items: StockNewsItem[];
  summary: NewsSentimentSummary;
}> {
  try {
    const res = await fetch(`/api/stocks/${ticker}/news`);
    if (!res.ok) throw new Error('Gagal memuat berita');
    const items: StockNewsItem[] = await res.json();
    return processNewsSummary(items, { ticker });
  } catch {
    const fallbackItems: StockNewsItem[] = [
      {
        id: `${ticker}-fallback-1`,
        title: `Analisis Sentimen & Berita Terkini Emiten ${ticker}`,
        snippet: `Pantau pergerakan harga saham ${ticker} dan katalis berita sektor terkini.`,
        url: `https://www.google.com/search?q=${ticker}+saham+idx`,
        publisher: 'Market Desk',
        publishedAt: new Date().toLocaleDateString('id-ID'),
        publishedAtMs: Date.now(),
        sentiment: 'neutral',
        impactScore: 3,
      },
    ];
    return processNewsSummary(fallbackItems, { ticker });
  }
}

/** features_analisa.md rule 10: 0–7d CURRENT, 8–30d RECENT, 31–90d AGING, >90d HISTORICAL. */
export function classifyNewsAge(publishedAtMs: number | undefined, now = Date.now()): NewsAgeBucket {
  if (publishedAtMs == null || Number.isNaN(publishedAtMs)) return 'UNKNOWN';
  const ageDays = (now - publishedAtMs) / 86_400_000;
  if (ageDays <= 7) return 'CURRENT';
  if (ageDays <= 30) return 'RECENT';
  if (ageDays <= 90) return 'AGING';
  return 'HISTORICAL';
}

/** A HISTORICAL item (e.g. an FY2023 dividend announcement resurfacing in a September 2026 scan)
 * must not move the sentiment score the same amount as today's news — see classifyNewsAge and
 * features_analisa.md rule 10. UNKNOWN (no reliable timestamp) is treated as full weight rather than
 * penalized, since the source simply didn't provide one. */
const NEWS_AGE_WEIGHT: Record<NewsAgeBucket, number> = {
  CURRENT: 1,
  RECENT: 0.7,
  AGING: 0.4,
  HISTORICAL: 0.15,
  UNKNOWN: 1,
};

const MARKET_KEYWORDS = [
  'ihsg', 'bursa efek indonesia', ' bei ', 'pasar modal', 'pasar saham',
  'rupiah', 'the fed', 'suku bunga', 'inflasi', 'bank indonesia',
];

const COMPANY_NAME_STOPWORDS = new Set(['pt', 'tbk', 'persero', 'indonesia', 'group', 'holding', 'holdings']);

/**
 * features_analisa.md "FINAL PATCH" rule 4: "Berita perusahaan lain tidak boleh menjadi sentiment
 * saham" — every item must be tagged with how directly it relates to THIS ticker before it's allowed
 * to move the sentiment score. Heuristic, text-only (title+snippet): a ticker/company-name mention is
 * DIRECT, a sector mention without the company is SECTOR, generic market-wide news is MARKET,
 * otherwise UNRELATED. INDIRECT (a related parent/subsidiary entity) isn't detectable from title text
 * alone without a company-relationship dataset this app doesn't have — reserved for a future source.
 */
export function classifyNewsRelevance(
  item: Pick<StockNewsItem, 'title' | 'snippet'>,
  context: NewsClassificationContext
): NewsRelevance {
  const text = ` ${item.title} ${item.snippet} `.toLowerCase();

  const tickerPattern = new RegExp(`[^a-z]${context.ticker.toLowerCase()}[^a-z]`);
  if (tickerPattern.test(text)) return 'DIRECT';

  const nameTokens = (context.name ?? '')
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3 && !COMPANY_NAME_STOPWORDS.has(w));
  if (nameTokens.some((w) => text.includes(w))) return 'DIRECT';

  if (context.sector && context.sector.length > 2 && text.includes(context.sector.toLowerCase())) return 'SECTOR';

  if (MARKET_KEYWORDS.some((k) => text.includes(k))) return 'MARKET';

  return 'UNRELATED';
}

export function processNewsSummary(
  items: StockNewsItem[],
  context: NewsClassificationContext
): {
  items: StockNewsItem[];
  summary: NewsSentimentSummary;
} {
  const now = Date.now();
  const classified = items.map((item) => ({
    ...item,
    relevance: classifyNewsRelevance(item, context),
    ageBucket: classifyNewsAge(item.publishedAtMs, now),
  }));

  const totalNews = classified.length;
  let bullishCount = 0;
  let bearishCount = 0;
  let neutralCount = 0;
  let weightedBullish = 0;
  let weightedNeutral = 0;
  let totalWeight = 0;

  classified.forEach((item) => {
    // UNRELATED news is excluded from the score entirely — a headline about a different company
    // must not move this ticker's sentiment (rule 4), only age discounts the rest.
    const weight = item.relevance === 'UNRELATED' ? 0 : NEWS_AGE_WEIGHT[item.ageBucket];
    totalWeight += weight;
    if (item.sentiment === 'bullish') {
      bullishCount++;
      weightedBullish += weight;
    } else if (item.sentiment === 'bearish') {
      bearishCount++;
    } else {
      neutralCount++;
      weightedNeutral += weight;
    }
  });

  const rawScore =
    totalWeight > 0 ? ((weightedBullish * 100 + weightedNeutral * 50) / (totalWeight * 100)) * 100 : 50;
  const netSentimentScore = Math.round(rawScore);

  let overallSentiment: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  if (netSentimentScore >= 60) overallSentiment = 'bullish';
  else if (netSentimentScore <= 40) overallSentiment = 'bearish';

  return {
    items: classified,
    summary: {
      totalNews,
      bullishCount,
      bearishCount,
      neutralCount,
      netSentimentScore,
      overallSentiment,
    },
  };
}
