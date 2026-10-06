'use client';

/**
 * Trading1MinutesGeminiReport.tsx
 *
 * "EzySaham AI" report on the detail page's `.sv-theme`, driven by Decision Engine v3
 * (domain/analysis/decisionEngineV3.ts · features_decision_enginev3.md). Three levels of information:
 *   Level 1 — 10 detik: BUY / WAIT / AVOID, one-line reason, Entry · Target · SL · R:R, risk, what to wait for.
 *   Level 2 — "Kenapa?": plain-language reasons + Trading / Swing / Investing verdicts.
 *   Level 3 — "Detail Analisis": trend, momentum, setups, liquidity, risk, hot money, rules, fundamentals, sizing.
 * Every verdict comes from the engine; this file only wires data in and lays the levels out.
 */

import { Zap } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { FundamentalScreeningResult } from '@/domain/analysis/aiStockEngine';
import { buildDecisionV3 } from '@/domain/analysis/decisionEngineV3';
import { buildFundamentalPillars } from '@/domain/analysis/fundamentalPillars';
import { atr } from '@/domain/indicators/atr';
import { ema, lastValid } from '@/domain/indicators/movingAverages';
import { FundamentalDetail } from '@/domain/models/Fundamentals';
import { OHLCVBar } from '@/domain/models/History';
import { StockSummary } from '@/domain/models/Stock';
import { StockAnalysis } from '@/domain/models/StockAnalysis';
import { buildMomentumInput } from './gemini1m/buildInput';
import { DetailAnalysis } from './gemini1m/DetailAnalysis';
import { QuickDecision, WhyPanel } from './gemini1m/QuickDecision';
import { buildShareText } from './gemini1m/shareText';
import { useSessionVwap } from './gemini1m/useSessionVwap';
import { CopyShareButton } from './TradingModesReport';
import { Card, PanelTitle, Skeleton } from './ui';

const pos = (n: number) => (Number.isFinite(n) && n > 0 ? n : null);

export function Trading1MinutesGeminiReport({
  summary,
  bars,
  analysis,
  fundamentals,
  fundamentalScreening,
}: {
  summary: StockSummary;
  bars: OHLCVBar[];
  analysis: StockAnalysis;
  fundamentals: FundamentalDetail | null;
  fundamentalScreening: FundamentalScreeningResult;
}) {
  const ticker = summary.ticker;
  const { vwap, loading: vwapLoading } = useSessionVwap(ticker);

  const pillars = useMemo(
    () => buildFundamentalPillars(summary, fundamentals, fundamentalScreening),
    [summary, fundamentals, fundamentalScreening],
  );
  // EMA9 & ATR14 aren't part of StockAnalysis — derive from the same daily bars. EMA20/50 come from the analysis engine.
  const ema9 = useMemo(() => pos(lastValid(ema(bars.map((b) => b.close), 9))), [bars]);
  const atr14 = useMemo(() => pos(lastValid(atr(bars, 14))), [bars]);

  const report = useMemo(
    () => buildDecisionV3(buildMomentumInput({ summary, bars, analysis, fundamentals, pillars, ema9, atr14, vwap })),
    [summary, bars, analysis, fundamentals, pillars, ema9, atr14, vwap],
  );
  const getShareText = useCallback(() => buildShareText(ticker, report), [ticker, report]);

  return (
    <Card aria-labelledby="momentum-report-title">
      <PanelTitle icon={Zap} id="momentum-report-title" action={<CopyShareButton getText={getShareText} />}>
        ⚡ EzySaham AI — {ticker}
      </PanelTitle>

      <div className="space-y-4 p-4">
        <QuickDecision ticker={ticker} report={report} />
        <WhyPanel report={report} />
        <DetailAnalysis report={report} vwapLoading={vwapLoading} />

        <p className="text-xs leading-relaxed text-(--sv-muted)">
          Analisa otomatis dari candle harian terakhir + VWAP intraday (kuotasi tertunda). Target adalah proyeksi, bukan janji profit.
          Edukasi, bukan ajakan jual/beli.
        </p>
      </div>
    </Card>
  );
}

export function Trading1MinutesGeminiReportSkeleton() {
  return (
    <Card as="div" className="space-y-4 p-4">
      <Skeleton className="h-5 w-72" />
      <Skeleton className="h-56" />
      <Skeleton className="h-12" />
      <Skeleton className="h-12" />
    </Card>
  );
}
