'use client';

/**
 * TradingModesReport.tsx
 *
 * "Equity Research Report — 3 Sistem Trading" (EquityResearchReportCardv6 from StockAnalysisPage)
 * restyled for the detail page's `.sv-theme`. Same engines (tradingModesReview.ts): each mode reads
 * only its own indicators — INTRADAY = VWAP + Volume + Price Action, SWING = EMA20/50 + Volume + S/R,
 * INVESTING = growth + ROE + debt + PER/PBV. Missing data stays "N/A".
 */

import { Check, Copy, Loader2, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getStockIntraday } from '@/data/repositories/StockRepository';
import { buildFundamentalPillars, isFinancial } from '@/domain/analysis/fundamentalPillars';
import {
  buildIntradayModeReview,
  buildInvestingModeReview,
  buildSwingModeReview,
  formatTradingModesReview,
  MODE_DECISION_LABEL,
  ModeDecision,
  ModeReview,
  NA,
  TRADING_MODE_LABEL,
} from '@/domain/analysis/tradingModesReview';
import { FundamentalScreeningResult } from '@/domain/analysis/aiStockEngine';
import { FundamentalDetail } from '@/domain/models/Fundamentals';
import { OHLCVBar } from '@/domain/models/History';
import { IntradayResponse } from '@/domain/models/Intraday';
import { StockSummary } from '@/domain/models/Stock';
import { StockAnalysis } from '@/domain/models/StockAnalysis';
import { cn } from '@/lib/format';
import { SITE_NAME } from '@/lib/site';
import { Tone } from '../format';
import { Badge, Card, PanelTitle, Skeleton } from './ui';

const DECISION_STYLE: Record<ModeDecision, { tone: Tone; box: string }> = {
  BUY: { tone: 'positive', box: 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-400/25 dark:bg-emerald-400/5' },
  WAIT: { tone: 'warning', box: 'border-amber-200 bg-amber-50/60 dark:border-amber-400/25 dark:bg-amber-400/5' },
  SELL: { tone: 'negative', box: 'border-rose-200 bg-rose-50/60 dark:border-rose-400/25 dark:bg-rose-400/5' },
};

/** Copies the report as plain text (for WhatsApp/Telegram) with a source line. */
export function CopyShareButton({ getText }: { getText: () => string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      const url = typeof window !== 'undefined' ? window.location.href : '';
      await navigator.clipboard.writeText(`${getText()}\n\nSumber: ${SITE_NAME}${url ? ` — ${url}` : ''}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable */ }
  }, [getText]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? 'Teks disalin' : 'Salin laporan sebagai teks'}
      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-(--sv-border) bg-(--sv-surface) px-2.5 text-xs font-medium text-(--sv-text) hover:bg-(--sv-bg)"
    >
      {copied ? <Check className="size-3.5 text-emerald-600" strokeWidth={2.5} /> : <Copy className="size-3.5" strokeWidth={2} />}
      <span className="hidden sm:inline">{copied ? 'Disalin!' : 'Salin Teks'}</span>
    </button>
  );
}

function Label({ children }: { children: string }) {
  return <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-(--sv-muted)">{children}</p>;
}

function PlanRow({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <dt className="shrink-0 text-(--sv-muted) sm:w-36">{label}</dt>
      <dd className={cn('font-medium', className ?? 'text-(--sv-text)')}>{value}</dd>
    </div>
  );
}

function TradingModeSection({ ticker, review }: { ticker: string; review: ModeReview }) {
  const style = DECISION_STYLE[review.decision];
  return (
    <div className={cn('space-y-3 rounded-xl border p-4', style.box)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-(--sv-text)">{ticker} — {TRADING_MODE_LABEL[review.mode]}</h3>
        <Badge tone={style.tone}>{MODE_DECISION_LABEL[review.decision]}</Badge>
      </div>

      <div>
        <Label>Market / Trend</Label>
        <p className="text-sm leading-relaxed text-(--sv-text)">{review.trend}</p>
      </div>

      <div>
        <Label>Indikator (Data)</Label>
        <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
          {review.data.map((d) => (
            <div key={d.label} className="flex justify-between gap-3 border-b border-(--sv-border)/70 py-1">
              <dt className="text-(--sv-muted)">{d.label}</dt>
              <dd className={cn('text-right font-medium tabular-nums', d.value.startsWith(NA) ? 'text-(--sv-muted)' : 'text-(--sv-text)')}>{d.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div>
        <Label>Sinyal (Interpretasi)</Label>
        <ul className="space-y-1 text-sm text-(--sv-text)">
          {review.signals.map((s) => (
            <li key={s} className="flex items-start gap-2">
              <span className="mt-2 size-1 shrink-0 rounded-full bg-(--sv-muted)" />
              {s}
            </li>
          ))}
        </ul>
      </div>

      <dl className="space-y-1.5 rounded-lg bg-(--sv-surface) p-3 text-sm">
        <PlanRow label="Entry" value={review.entry} className="text-emerald-700 dark:text-emerald-400" />
        <PlanRow label="Stop / Invalidation" value={review.stop} className="text-rose-600 dark:text-rose-400" />
        <PlanRow label="Target" value={review.target} />
        <PlanRow label="Risk" value={review.risk} />
      </dl>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-(--sv-muted)">Keputusan</span>
        <Badge tone={style.tone}>{MODE_DECISION_LABEL[review.decision]}</Badge>
        <span className="text-(--sv-text)">{review.reason}</span>
      </div>
    </div>
  );
}

export function TradingModesReport({
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
  const { trendEma, volume, priceAction, supportResistance } = analysis;

  // Yahoo 1-minute feed for the INTRADAY mode; keyed by ticker so a stale response is ignored.
  const [intradayState, setIntradayState] = useState<{ ticker: string; data: IntradayResponse } | null>(null);
  useEffect(() => {
    let cancelled = false;
    getStockIntraday(summary.ticker).then((data) => {
      if (!cancelled) setIntradayState({ ticker: summary.ticker, data });
    });
    return () => { cancelled = true; };
  }, [summary.ticker]);
  const intraday = intradayState?.ticker === summary.ticker ? intradayState.data : null;

  const pillars = useMemo(
    () => buildFundamentalPillars(summary, fundamentals, fundamentalScreening),
    [summary, fundamentals, fundamentalScreening],
  );

  const reviews = useMemo(() => [
    buildIntradayModeReview({ bars: intraday?.ok ? intraday.bars : null, lastClose: summary.lastClose, lastPrice: intraday?.ok ? intraday.lastPrice : null }),
    buildSwingModeReview({
      bars,
      price: summary.lastClose,
      ema20: trendEma.ema20,
      ema50: trendEma.ema50,
      relativeVolume: volume.relativeVolume,
      lastCandleColor: priceAction.lastCandleColor,
      supports: supportResistance.supports.map((s) => s.price),
      resistances: supportResistance.resistances.map((r) => r.price),
    }),
    buildInvestingModeReview({
      price: summary.lastClose,
      per: summary.per,
      pbv: summary.pbv,
      roe: summary.roe,
      earningsGrowth: fundamentals?.earningsGrowth ?? null,
      revenueGrowth: fundamentals?.revenueGrowth ?? null,
      debtToEquity: fundamentals?.debtToEquity ?? null,
      netMargin: fundamentals?.netMargin ?? null,
      operatingCashFlow: null,
      isFinancial: isFinancial(summary),
      fairValue: pillars.valuation.fairValue,
      accumulationLow: pillars.valuation.accumulationLow,
      accumulationHigh: pillars.valuation.accumulationHigh,
    }),
  ], [intraday, summary, bars, trendEma, volume, priceAction, supportResistance, fundamentals, pillars]);

  const getShareText = useCallback(() => formatTradingModesReview(summary.ticker, reviews), [summary.ticker, reviews]);

  return (
    <Card aria-labelledby="trading-modes-title">
      <PanelTitle icon={Sparkles} id="trading-modes-title" action={<CopyShareButton getText={getShareText} />}>
        Equity Research Report — 3 Sistem Trading
      </PanelTitle>
      <div className="space-y-4 p-4">
        {intraday === null && (
          <p className="flex items-center gap-1.5 text-xs text-(--sv-muted)">
            <Loader2 className="size-3.5 animate-spin" /> Memuat data intraday…
          </p>
        )}
        {reviews.map((r) => <TradingModeSection key={r.mode} ticker={summary.ticker} review={r} />)}
        <p className="text-xs leading-relaxed text-(--sv-muted)">
          Setiap mode hanya memakai indikatornya sendiri. Satu sinyal saja bukan alasan BUY — konfirmasi tidak cukup = WAIT.
          Data intraday adalah kuotasi tertunda. Target adalah proyeksi, bukan janji profit. Edukasi, bukan ajakan jual/beli.
        </p>
      </div>
    </Card>
  );
}

export function TradingModesReportSkeleton() {
  return (
    <Card as="div" className="space-y-4 p-4">
      <Skeleton className="h-5 w-72" />
      {[0, 1, 2].map((i) => <Skeleton key={i} className="h-56" />)}
    </Card>
  );
}
