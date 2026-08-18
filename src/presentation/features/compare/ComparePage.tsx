'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, GitCompare } from 'lucide-react';
import { StockSummary } from '@/domain/models/Stock';
import { getStockSummaries } from '@/data/repositories/StockRepository';
import { useStockAnalysis } from '@/presentation/features/analysis/useStockAnalysis';
import { TickerPicker } from './TickerPicker';
import { StockSummaryCard } from './StockSummaryCard';
import { PriceComparisonChart } from './PriceComparisonChart';
import { FundamentalsComparisonTable } from './FundamentalsComparisonTable';

interface ComparePageProps {
  initialTickerA: string;
  initialTickerB: string;
}

export function ComparePage({ initialTickerA, initialTickerB }: ComparePageProps) {
  const router = useRouter();
  const [tickerA, setTickerA] = useState(initialTickerA);
  const [tickerB, setTickerB] = useState(initialTickerB);
  const [summaries, setSummaries] = useState<StockSummary[]>([]);

  useEffect(() => {
    getStockSummaries().then(setSummaries).catch(() => { });
  }, []);

  const sideA = useStockAnalysis(tickerA);
  const sideB = useStockAnalysis(tickerB);

  const updateTicker = useCallback((side: 'a' | 'b', ticker: string) => {
    const nextA = side === 'a' ? ticker : tickerA;
    const nextB = side === 'b' ? ticker : tickerB;
    if (side === 'a') setTickerA(ticker); else setTickerB(ticker);
    router.replace(`/compare?a=${nextA}&b=${nextB}`, { scroll: false });
  }, [router, tickerA, tickerB]);

  const bothReady = sideA.status === 'ready' && sideB.status === 'ready' && sideA.summary && sideB.summary;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-20 neo-border border-x-0 border-t-0 bg-white dark:bg-zinc-950">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link
            href="/screener"
            className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            <ArrowLeft className="size-4" strokeWidth={2.5} />
            <span className="hidden sm:inline">Screener</span>
          </Link>
          <div className="h-5 w-[3px] bg-(--neo-line)" />
          <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
            <GitCompare className="size-4" strokeWidth={2.5} />
            <span className="font-bold uppercase tracking-wide">Bandingkan Saham</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 pb-16 space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-3">
            <TickerPicker
              label="Saham A"
              value={tickerA}
              onChange={(t) => updateTicker('a', t)}
              summaries={summaries}
              excludeTicker={tickerB}
            />
            <StockSummaryCard status={sideA.status} summary={sideA.summary} advisor={sideA.advisor} />
          </div>
          <div className="space-y-3">
            <TickerPicker
              label="Saham B"
              value={tickerB}
              onChange={(t) => updateTicker('b', t)}
              summaries={summaries}
              excludeTicker={tickerA}
            />
            <StockSummaryCard status={sideB.status} summary={sideB.summary} advisor={sideB.advisor} />
          </div>
        </div>

        <PriceComparisonChart tickerA={tickerA} tickerB={tickerB} />

        {bothReady ? (
          <FundamentalsComparisonTable summaryA={sideA.summary!} summaryB={sideB.summary!} />
        ) : (
          <div className="flex items-center justify-center neo-border neo-shadow bg-white p-8 text-sm font-semibold text-zinc-400 dark:bg-zinc-900">
            Memuat data fundamental…
          </div>
        )}
      </main>
    </div>
  );
}
