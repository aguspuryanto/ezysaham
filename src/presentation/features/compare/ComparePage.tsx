'use client';

/**
 * ComparePage.tsx
 *
 * /compare — side-by-side comparison of two tickers in the Screener's
 * `.sv-theme` shell, laid out like Detail Emiten (content column + sticky
 * right panel with the overall result).
 */

import { ArrowLeftRight, ArrowRight, ChevronRight, Home } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getStockFundamentals, getStockSummaries } from '@/data/repositories/StockRepository';
import { buildAiVerdict, computeDecisionScore } from '@/domain/compare/decisionEngine';
import { FundamentalDetail } from '@/domain/models/Fundamentals';
import { StockSummary } from '@/domain/models/Stock';
import { useStockAnalysis } from '@/presentation/features/analysis/useStockAnalysis';
import { AppShell } from '../screener/components/AppShell';
import { Card, Skeleton } from '../screener/detail/components/ui';
import { ComparisonResultCard } from './ComparisonResultCard';
import { FundamentalsComparisonTable } from './FundamentalsComparisonTable';
import { COLOR_A, COLOR_B, PriceComparisonChart } from './PriceComparisonChart';
import { StockSummaryCard } from './StockSummaryCard';
import { TickerPicker } from './TickerPicker';

interface ComparePageProps {
  initialTickerA: string;
  initialTickerB: string;
}

function PanelSkeleton({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <div className="space-y-3 p-4"><Skeleton className="h-5 w-1/3" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-5/6" /><Skeleton className="h-4 w-2/3" /></div>
    </Card>
  );
}

export function ComparePage({ initialTickerA, initialTickerB }: ComparePageProps) {
  const router = useRouter();
  const [tickerA, setTickerA] = useState(initialTickerA);
  const [tickerB, setTickerB] = useState(initialTickerB);
  const [summaries, setSummaries] = useState<StockSummary[]>([]);
  // Tagged with their ticker so a stale response never shows under a newly picked ticker.
  const [fundA, setFundA] = useState<{ ticker: string; data: FundamentalDetail | null } | null>(null);
  const [fundB, setFundB] = useState<{ ticker: string; data: FundamentalDetail | null } | null>(null);
  const fundamentalsA = fundA?.ticker === tickerA ? fundA.data : null;
  const fundamentalsB = fundB?.ticker === tickerB ? fundB.data : null;

  useEffect(() => {
    getStockSummaries().then(setSummaries).catch(() => { });
  }, []);

  useEffect(() => {
    getStockFundamentals(tickerA).then((data) => setFundA({ ticker: tickerA, data })).catch(() => { });
  }, [tickerA]);

  useEffect(() => {
    getStockFundamentals(tickerB).then((data) => setFundB({ ticker: tickerB, data })).catch(() => { });
  }, [tickerB]);

  const sideA = useStockAnalysis(tickerA);
  const sideB = useStockAnalysis(tickerB);

  const setPair = useCallback((a: string, b: string) => {
    setTickerA(a);
    setTickerB(b);
    router.replace(`/compare?a=${a}&b=${b}`, { scroll: false });
  }, [router]);

  const updateTicker = useCallback((side: 'a' | 'b', ticker: string) => {
    if (side === 'a') setPair(ticker, tickerB);
    else setPair(tickerA, ticker);
  }, [setPair, tickerA, tickerB]);

  const bothReady = sideA.status === 'ready' && sideB.status === 'ready' && sideA.summary && sideB.summary;

  const decision = useMemo(() => {
    if (!bothReady || !sideA.summary || !sideB.summary) return null;
    const { scores: scoresA, overall: overallA } = computeDecisionScore(sideA.summary, fundamentalsA);
    const { scores: scoresB, overall: overallB } = computeDecisionScore(sideB.summary, fundamentalsB);
    const verdict = buildAiVerdict(tickerA, scoresA, overallA, tickerB, scoresB, overallB);
    return { overallA, overallB, verdict };
  }, [bothReady, sideA.summary, sideB.summary, fundamentalsA, fundamentalsB, tickerA, tickerB]);

  const btnSecondary = 'inline-flex h-9 items-center gap-2 rounded-lg border border-(--sv-border) bg-(--sv-surface) px-3 text-sm font-medium text-(--sv-text) hover:bg-(--sv-bg)';

  return (
    <AppShell>
      <nav aria-label="Breadcrumb" className="text-sm">
        <ol className="flex items-center gap-1.5 text-(--sv-muted)">
          <li><Link href="/" aria-label="Beranda" className="flex items-center hover:text-(--sv-text)"><Home className="size-4" strokeWidth={2} /></Link></li>
          <ChevronRight className="size-3.5" aria-hidden="true" />
          <li><Link href="/screener" className="hover:text-(--sv-text)">Screener Saham</Link></li>
          <ChevronRight className="size-3.5" aria-hidden="true" />
          <li aria-current="page" className="font-medium text-(--sv-text)">Bandingkan <span className="text-(--sv-muted)">· {tickerA} vs {tickerB}</span></li>
        </ol>
      </nav>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-(--sv-text) sm:text-2xl">Bandingkan Saham</h1>
          <p className="mt-0.5 text-sm text-(--sv-muted)">Adu harga, fundamental, dan skor keseluruhan dua emiten secara berdampingan.</p>
        </div>
        <button type="button" onClick={() => setPair(tickerB, tickerA)} className={btnSecondary} title="Tukar posisi Saham A dan B">
          <ArrowLeftRight className="size-4" strokeWidth={2} /> Tukar
        </button>
      </div>

      <div className="relative grid gap-4 md:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-3">
          <TickerPicker label="Saham A" value={tickerA} color={COLOR_A} onChange={(t) => updateTicker('a', t)} summaries={summaries} excludeTicker={tickerB} />
          <StockSummaryCard status={sideA.status} summary={sideA.summary} advisor={sideA.advisor} color={COLOR_A} />
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <TickerPicker label="Saham B" value={tickerB} color={COLOR_B} onChange={(t) => updateTicker('b', t)} summaries={summaries} excludeTicker={tickerA} />
          <StockSummaryCard status={sideB.status} summary={sideB.summary} advisor={sideB.advisor} color={COLOR_B} />
        </div>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-[calc(50%+2rem)] z-10 hidden size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-(--sv-border) bg-(--sv-surface) text-xs font-bold text-(--sv-muted) shadow-(--sv-shadow) md:flex"
        >
          VS
        </span>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] 2xl:grid-cols-[minmax(0,1fr)_22rem]">
        <main className="flex min-w-0 flex-col gap-4">
          <PriceComparisonChart tickerA={tickerA} tickerB={tickerB} />
          {bothReady && decision ? (
            <FundamentalsComparisonTable summaryA={sideA.summary!} summaryB={sideB.summary!} fundamentalsA={fundamentalsA} fundamentalsB={fundamentalsB} />
          ) : (
            <PanelSkeleton />
          )}
        </main>

        <aside aria-label="Hasil perbandingan" className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
          {bothReady && decision ? (
            <ComparisonResultCard
              tickerA={tickerA}
              tickerB={tickerB}
              overallA={decision.overallA}
              overallB={decision.overallB}
              winner={decision.verdict.winner}
              winnerStrengths={decision.verdict.winnerStrengths}
              colorA={COLOR_A}
              colorB={COLOR_B}
            />
          ) : (
            <PanelSkeleton />
          )}

          <Card>
            <div className="border-b border-(--sv-border) px-4 py-3 text-[15px] font-semibold text-(--sv-text)">Analisis Lengkap</div>
            <ul className="divide-y divide-(--sv-border)">
              {[{ t: tickerA, c: COLOR_A }, { t: tickerB, c: COLOR_B }].map(({ t, c }) => (
                <li key={t}>
                  <Link href={`/screener/${t}`} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-(--sv-bg)">
                    <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: c }} aria-hidden="true" />
                    <span className="flex-1 font-semibold text-(--sv-text)">Detail Emiten {t}</span>
                    <ArrowRight className="size-4 text-(--sv-muted)" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>

          <p className="text-xs leading-relaxed text-(--sv-muted)">
            Skor dihitung dari data EOD dan fundamental terakhir — alat bantu keputusan, bukan rekomendasi beli/jual.
          </p>
        </aside>
      </div>
    </AppShell>
  );
}
