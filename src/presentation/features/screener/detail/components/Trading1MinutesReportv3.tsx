'use client';

/**
 * Trading1MinutesReportv3.tsx
 *
 * "EzySaham AI" report on the detail page's `.sv-theme`, driven by Decision Engine v3
 * (domain/analysis/decisionEngineV3.ts · features_decision_enginev3.md). Information levels:
 *   Level 1 — 10 detik: BUY / WAIT / AVOID, price · trend · condition, reason, plan / better entry, risk, conclusion.
 *   Analisa Teknikal — 7 steps: Fase → Trend → Tenaga → Posisi → Ruang Naik → Risiko → Keputusan (technicalAnalysisV3.ts).
 *   Level 2 — "Kenapa?": plain-language reasons + Trading / Swing / Investing verdicts.
 *   Level 3 — "Detail Analisis": trend, momentum, setups, liquidity, risk, hot money, rules, fundamentals, sizing.
 * Every verdict comes from the engine; this file only wires data in and lays the levels out.
 */

import { Zap } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { FundamentalScreeningResult } from '@/domain/analysis/aiStockEngine';
import { buildDecisionWithTechnical } from '@/domain/analysis/decisionInput';
import { buildFundamentalPillars } from '@/domain/analysis/fundamentalPillars';
import { FundamentalDetail } from '@/domain/models/Fundamentals';
import { OHLCVBar } from '@/domain/models/History';
import { StockSummary } from '@/domain/models/Stock';
import { StockAnalysis } from '@/domain/models/StockAnalysis';
import { DetailAnalysis } from './gemini1m/DetailAnalysis';
import { QuickDecision, WhyPanel } from './gemini1m/QuickDecision';
import { buildShareText } from './gemini1m/shareText';
import { TechnicalAnalysisPanel } from './gemini1m/TechnicalAnalysisPanel';
import { useSessionVwap } from './gemini1m/useSessionVwap';
import { CopyShareButton } from './TradingModesReport';
import { Card, PanelTitle, Skeleton } from './ui';

export function Trading1MinutesReportv3({
  summary,
  bars,
  longBars,
  analysis,
  fundamentals,
  fundamentalScreening,
}: {
  summary: StockSummary;
  bars: OHLCVBar[];
  /** Longer daily history (2y chart bars) — only used so EMA 200 can be computed. */
  longBars?: OHLCVBar[];
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

  const { report, technical } = useMemo(
    () => buildDecisionWithTechnical({ summary, bars, analysis, fundamentals, pillars, vwap, longBars }),
    [summary, bars, analysis, fundamentals, pillars, vwap, longBars],
  );
  const getShareText = useCallback(() => buildShareText(ticker, report, technical), [ticker, report, technical]);

  return (
    <Card aria-labelledby="momentum-report-title">
      <PanelTitle icon={Zap} id="momentum-report-title" action={<CopyShareButton getText={getShareText} />}>
        ⚡ EzySaham AI — {ticker}
      </PanelTitle>

      <div className="space-y-4 p-4">
        <QuickDecision ticker={ticker} report={report} />
        <TechnicalAnalysisPanel ta={technical} />
        <WhyPanel report={report} />
        <DetailAnalysis report={report} vwapLoading={vwapLoading} />

        <p className="text-xs leading-relaxed text-(--sv-muted)">
          Analisa otomatis dari candle harian terakhir + VWAP intraday (kuotasi tertunda). Target adalah proyeksi, bukan janji profit.
        </p>
      </div>
    </Card>
  );
}

export function Trading1MinutesReportv3Skeleton() {
  return (
    <Card as="div" className="space-y-4 p-4">
      <Skeleton className="h-5 w-72" />
      <Skeleton className="h-56" />
      <Skeleton className="h-72" />
      <Skeleton className="h-12" />
      <Skeleton className="h-12" />
    </Card>
  );
}
