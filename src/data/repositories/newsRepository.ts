import { NewsSentimentSummary, StockNewsItem } from '@/domain/models/News';

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
        sentiment: 'neutral',
        impactScore: 3,
      },
    ];
    return processNewsSummary(fallbackItems);
  }
}

export function processNewsSummary(items: StockNewsItem[]): {
  items: StockNewsItem[];
  summary: NewsSentimentSummary;
} {
  const totalNews = items.length;
  let bullishCount = 0;
  let bearishCount = 0;
  let neutralCount = 0;

  items.forEach((item) => {
    if (item.sentiment === 'bullish') bullishCount++;
    else if (item.sentiment === 'bearish') bearishCount++;
    else neutralCount++;
  });

  const rawScore =
    totalNews > 0 ? ((bullishCount * 100 + neutralCount * 50) / (totalNews * 100)) * 100 : 50;
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
