'use client';

/**
 * ScreenerDetailPage.tsx
 *
 * Detail Emiten redesign (features_redesign_detail.md) sharing the Screener's
 * header, sidebar nav and `.sv-theme` tokens. Data comes from the existing
 * useStockAnalysis pipeline via useStockDetail — this file only lays it out.
 */

import { AlertCircle, RefreshCw, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/format';
import { SITE_NAME } from '@/lib/site';
import { useJournal } from '@/presentation/features/journal/hooks/useJournal';
import { useMarketSeries } from '../components/MarketSummary';
import { ScreenerHeader } from '../components/ScreenerHeader';
import { ScreenerNav } from '../components/ScreenerNav';
import { screenerInter } from '../fonts';
import { useWatchlist } from '../hooks/useWatchlist';
import { AIInsight } from './components/AIInsight';
import { Breadcrumb } from './components/Breadcrumb';
import {
  FundamentalCard,
  InsightPanelSkeleton,
  KeyLevelsCard,
  OwnershipFlowCard,
  PerformanceCard,
  PriceTargetCard,
  SnapshotCard,
} from './components/InsightCards';
import { PriceChart, PriceChartSkeleton } from './components/PriceChart';
import { SaraDecisionCard } from './components/SaraDecisionCard';
import { StockHeader, StockHeaderSkeleton } from './components/StockHeader';
import { StockTabId, StockTabs } from './components/StockTabs';
import { BandarmologyPanel, CorporateActionPanel, FundamentalDetailPanel, NewsPanel, TechnicalDetail } from './components/TabPanels';
import { TechnicalSummary } from './components/TechnicalSummary';
import { TradingModesReport, TradingModesReportSkeleton } from './components/TradingModesReport';
import { TradingMomentumReport, TradingMomentumReportSkeleton } from './components/TradingMomentumReport';
import { Card } from './components/ui';
import { useStockDetail } from './useStockDetail';

type PlanState = 'idle' | 'saving' | 'saved';

export function ScreenerDetailPage({ ticker }: { ticker: string }) {
  const router = useRouter();
  const detail = useStockDetail(ticker);
  const { data, status, analysis } = detail;
  const market = useMarketSeries();
  const watchlist = useWatchlist();
  const journal = useJournal();

  const [tab, setTab] = useState<StockTabId>('ringkasan');
  const [query, setQuery] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [planState, setPlanState] = useState<PlanState>('idle');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Mobile/tablet drawer: lock body scroll and close on Escape (same behaviour as ScreenerPage).
  useEffect(() => {
    if (!drawerOpen) return;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawerOpen(false); };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [drawerOpen]);

  const handleSearch = useCallback((q: string) => {
    const code = q.trim().toUpperCase();
    if (/^[A-Z]{4}$/.test(code)) router.push(`/screener/${code}`);
    else if (code) router.push('/screener');
  }, [router]);

  // Same Entry/TP/SL snapshot the Screener's "Create Jurnal" saves, for this one ticker.
  const handleCreatePlan = useCallback(async () => {
    if (!analysis || !data) return;
    const scenario = analysis.tradingPlan.recommendedBias === 'bearish' ? analysis.tradingPlan.bearish : analysis.tradingPlan.bullish;
    if (scenario.validationErrors.length > 0) {
      setMessage({ type: 'error', text: `Rencana trading ${ticker} belum valid: ${scenario.validationErrors[0]}` });
      return;
    }
    setPlanState('saving');
    setMessage(null);
    const res = await journal.addEntries([{
      ticker,
      presetId: null,
      entry: scenario.entry,
      tp1: scenario.tp1,
      tp2: scenario.tp2,
      sl: scenario.sl,
      riskRewardPlanned: scenario.riskRewardRatio,
      reasonBuy: analysis.conclusion.summary,
      reasonAvoid: analysis.conclusion.watchOut,
    }]);
    if (res.ok) {
      setPlanState('saved');
      setMessage({ type: 'success', text: `Trading plan ${ticker} disimpan ke Jurnal.` });
    } else {
      setPlanState('idle');
      setMessage({ type: 'error', text: res.message ?? 'Gagal menyimpan ke Jurnal.' });
    }
  }, [analysis, data, journal, ticker]);

  const loading = status === 'loading' && !data;

  return (
    <div className={cn('sv-theme flex min-h-screen w-full flex-col', screenerInter.variable)}>
      <ScreenerHeader
        query={query}
        onQueryChange={setQuery}
        onSubmitQuery={handleSearch}
        lastUpdatedAt={null}
        ihsg={market.ihsg}
        onOpenDrawer={() => setDrawerOpen(true)}
      />

      <div className="flex flex-1">
        {drawerOpen && <div className="fixed inset-0 z-40 bg-slate-900/40 xl:hidden" onClick={() => setDrawerOpen(false)} aria-hidden="true" />}
        <aside
          aria-label="Menu utama"
          className={cn(
            'fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col gap-6 overflow-y-auto border-r border-(--sv-border) bg-(--sv-surface) p-4 transition-transform duration-300 ease-out',
            drawerOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full',
            'xl:sticky xl:top-16 xl:z-auto xl:h-[calc(100vh-4rem)] xl:w-64 xl:max-w-none xl:shrink-0 xl:translate-x-0 xl:shadow-none',
          )}
        >
          <div className="flex items-center justify-between xl:hidden">
            <span className="text-sm font-semibold text-(--sv-text)">Menu</span>
            <button type="button" onClick={() => setDrawerOpen(false)} aria-label="Tutup" className="flex size-8 items-center justify-center rounded-lg border border-(--sv-border) text-(--sv-text)">
              <X className="size-4" strokeWidth={2} />
            </button>
          </div>
          <ScreenerNav watchlistCount={watchlist.tickers.length} />
          <p className="mt-auto text-[11px] text-(--sv-muted)">© {new Date().getFullYear()} {SITE_NAME} · Data EOD, bukan prediksi harga.</p>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-4 px-4 py-5 pb-24 sm:px-6 xl:pb-8">
          <Breadcrumb ticker={ticker} />

          {status === 'error' && !data ? (
            <Card className="flex flex-col items-center gap-3 px-6 py-14 text-center">
              <AlertCircle className="size-8 text-rose-500" />
              <p className="text-base font-semibold text-(--sv-text)">Data {ticker} tidak dapat dimuat</p>
              <p className="max-w-md text-sm text-(--sv-muted)">Kode saham mungkin tidak ditemukan atau sumber data sedang bermasalah.</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => detail.reload(true)} className="inline-flex h-9 items-center gap-2 rounded-lg bg-(--sv-primary) px-4 text-sm font-semibold text-(--sv-primary-fg)">
                  <RefreshCw className="size-4" /> Coba lagi
                </button>
                <Link href="/screener" className="inline-flex h-9 items-center rounded-lg border border-(--sv-border) px-4 text-sm font-medium text-(--sv-text) hover:bg-(--sv-bg)">
                  Kembali ke Screener
                </Link>
              </div>
            </Card>
          ) : (
            <>
              {loading || !data ? (
                <StockHeaderSkeleton />
              ) : (
                <StockHeader
                  stock={data.header}
                  watchlisted={watchlist.has(ticker)}
                  onToggleWatchlist={() => watchlist.toggle(ticker)}
                  onCreatePlan={handleCreatePlan}
                  planState={planState}
                />
              )}

              {message && (
                <div
                  role="status"
                  className={cn(
                    'flex items-center justify-between gap-2 rounded-xl border px-4 py-3 text-sm font-medium',
                    message.type === 'success'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-200'
                      : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-200',
                  )}
                >
                  <span>{message.text}</span>
                  {message.type === 'success' ? (
                    <Link href="/jurnal" className="shrink-0 underline underline-offset-2">Lihat Jurnal →</Link>
                  ) : (
                    <button type="button" onClick={() => setMessage(null)} aria-label="Tutup pesan"><X className="size-4" /></button>
                  )}
                </div>
              )}

              <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] 2xl:grid-cols-[minmax(0,1fr)_22rem]">
                <main className="flex min-w-0 flex-col gap-4">
                  <StockTabs active={tab} onChange={setTab} />
                  {loading || !data || !analysis ? (
                    <PriceChartSkeleton />
                  ) : (
                    <div key={tab} id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="flex min-w-0 flex-col gap-4 animate-in fade-in duration-200">
                      {tab === 'ringkasan' && (
                        <>
                          {/* <PriceChart ticker={ticker} bars={data.chartBars} currentPrice={data.header.price} /> */}
                          <TechnicalSummary indicators={data.technical} />
                          {data.insight && <AIInsight analysis={data.insight} />}
                          {/* {detail.pillars && (
                            <SaraDecisionCard key={ticker} ticker={ticker} price={data.header.price} pillars={detail.pillars} analysis={analysis} />
                          )} */}
                          {detail.summary && detail.fundamentalScreening ? (
                            // <TradingModesReport
                            //   summary={detail.summary}
                            //   bars={detail.bars}
                            //   analysis={analysis}
                            //   fundamentals={detail.fundamentals}
                            //   fundamentalScreening={detail.fundamentalScreening}
                            // />

                            <TradingMomentumReport
                              summary={detail.summary}
                              bars={detail.bars}
                              longBars={data.chartBars}
                              analysis={analysis}
                              fundamentals={detail.fundamentals}
                              fundamentalScreening={detail.fundamentalScreening}
                            />
                          ) : (
                            <TradingMomentumReportSkeleton />
                          )}
                        </>
                      )}
                      {tab === 'chart' && <PriceChart ticker={ticker} bars={data.chartBars} currentPrice={data.header.price} height={480} />}
                      {tab === 'technical' && (
                        <>
                          <TechnicalSummary indicators={data.technical} />
                          <TechnicalDetail analysis={analysis} price={data.header.price} />
                        </>
                      )}
                      {tab === 'fundamental' && (
                        <FundamentalDetailPanel
                          fundamentals={detail.fundamentals}
                          loading={detail.fundamentalsLoading}
                          roe={data.fundamental.roe}
                          per={data.fundamental.per}
                          pbv={data.fundamental.pbv}
                        />
                      )}
                      {tab === 'bandarmology' && (
                        <BandarmologyPanel bandar={detail.bandar} broker={detail.brokerActivity} loading={detail.brokerActivityLoading} />
                      )}
                      {tab === 'valuation' && (
                        <div className="grid gap-4 md:grid-cols-2">
                          <SnapshotCard snapshot={data.snapshot} />
                          <PriceTargetCard price={data.header.price} fairLow={data.snapshot.fairLow} fairHigh={data.snapshot.fairHigh} upsidePct={data.snapshot.upsidePct} />
                        </div>
                      )}
                      {tab === 'corporate-action' && <CorporateActionPanel fundamentals={detail.fundamentals} loading={detail.fundamentalsLoading} />}
                      {tab === 'news' && <NewsPanel items={detail.newsItems} loading={detail.newsLoading} />}
                    </div>
                  )}
                </main>

                {/* Right insight panel — sticky on desktop, flows below the content on tablet/mobile. */}
                <aside aria-label="Insight emiten" className="min-w-0 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto lg:pr-0.5 [scrollbar-width:thin]">
                  {loading || !data ? (
                    <InsightPanelSkeleton />
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                      <SnapshotCard snapshot={data.snapshot} />
                      <KeyLevelsCard levels={data.keyLevels} price={data.header.price} />
                      <FundamentalCard fundamental={data.fundamental} loading={detail.fundamentalsLoading} />
                      <OwnershipFlowCard flow={data.flow} loading={detail.brokerActivityLoading} />
                      <PerformanceCard items={data.performance} />
                      <PriceTargetCard price={data.header.price} fairLow={data.snapshot.fairLow} fairHigh={data.snapshot.fairHigh} upsidePct={data.snapshot.upsidePct} />
                    </div>
                  )}
                </aside>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
