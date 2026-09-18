import { NewsAgeBucket, NewsSentimentSummary, StockNewsItem } from '@/domain/models/News';

export async function getStockNews(ticker: string): Promise<{
  items: StockNewsItem[];
  summary: NewsSentimentSummary;
}> {
  try {
    const res = await fetch(`/api/stocks/${ticker}/news`);
    if (!res.ok) throw new Error('Gagal memuat berita');
    const items: StockNewsItem[] = await res.json();
    return processNewsSummary(items);
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
    return processNewsSummary(fallbackItems);
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

export function processNewsSummary(items: StockNewsItem[]): {
  items: StockNewsItem[];
  summary: NewsSentimentSummary;
} {
  const totalNews = items.length;
  let bullishCount = 0;
  let bearishCount = 0;
  let neutralCount = 0;
  let weightedBullish = 0;
  let weightedNeutral = 0;
  let totalWeight = 0;

  const now = Date.now();
  items.forEach((item) => {
    const weight = NEWS_AGE_WEIGHT[classifyNewsAge(item.publishedAtMs, now)];
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
    items,
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
