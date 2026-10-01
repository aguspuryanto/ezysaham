'use client';

/**
 * TradingModesReport.tsx
 *
 * "Equity Research Report — 3 Sistem Trading" (EquityResearchReportCardv6 from StockAnalysisPage)
 * restyled for the detail page's `.sv-theme`. Same engines (tradingModesReview.ts), three separate reads:
 * INTRADAY = VWAP + RVOL + session High/Low + breakout, SWING = EMA20/50/200 + RSI/MACD + RVOL + S/R,
 * INVESTING = growth + ROE + debt + PER/PBV + fair value. Decisions: BUY / WAIT / WATCHLIST / NO TRADE.
 * Missing data stays "N/A".
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
  isTechnicalBearish,
  ModeDecision,
  ModeField,
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
  WATCHLIST: { tone: 'info', box: 'border-blue-200 bg-blue-50/60 dark:border-blue-400/25 dark:bg-blue-400/5' },
  NO_TRADE: { tone: 'neutral', box: 'border-(--sv-border) bg-(--sv-bg)' },
};

const FIELD_TONE: Record<NonNullable<ModeField['tone']>, string> = {
  positive: 'text-emerald-700 dark:text-emerald-400',
  negative: 'text-rose-600 dark:text-rose-400',
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

function FieldRow({ field }: { field: ModeField }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <dt className="shrink-0 text-(--sv-muted) sm:w-36">{field.label}</dt>
      <dd className={cn('min-w-0 font-medium', field.tone ? FIELD_TONE[field.tone] : 'text-(--sv-text)')}>
        {Array.isArray(field.value) ? (
          <ul className="space-y-1">
            {field.value.map((s) => (
              <li key={s} className="flex items-start gap-2">
                <span className="mt-2 size-1 shrink-0 rounded-full bg-(--sv-muted)" />
                {s}
              </li>
            ))}
          </ul>
        ) : field.value}
      </dd>
    </div>
  );
}

function TradingModeSection({ ticker, review }: { ticker: string; review: ModeReview }) {
  const style = DECISION_STYLE[review.decision];
  return (
    <div className={cn('space-y-3 rounded-xl border p-4', style.box)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-(--sv-text)">📊 {ticker} — {TRADING_MODE_LABEL[review.mode]}</h3>
        <Badge tone={style.tone}>{MODE_DECISION_LABEL[review.decision]}</Badge>
      </div>

      <div>
        <Label>{review.headline.label}</Label>
        <p className="text-sm leading-relaxed text-(--sv-text)">{review.headline.value}</p>
      </div>

      {review.data.length > 0 && (
        <div>
          <Label>Data</Label>
          <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
            {review.data.map((d) => (
              <div key={d.label} className="flex justify-between gap-3 border-b border-(--sv-border)/70 py-1">
                <dt className="text-(--sv-muted)">{d.label}</dt>
                <dd className={cn('text-right font-medium tabular-nums', d.value.startsWith(NA) ? 'text-(--sv-muted)' : 'text-(--sv-text)')}>{d.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <dl className="space-y-2 rounded-lg bg-(--sv-surface) p-3 text-sm">
        {review.fields.map((f) => <FieldRow key={f.label} field={f} />)}
      </dl>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-(--sv-muted)">Decision</span>
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
  const { trendEma, indicators, volume, priceAction, supportResistance } = analysis;

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
    buildIntradayModeReview({
      bars: intraday?.ok ? intraday.bars : null,
      lastClose: summary.lastClose,
      lastPrice: intraday?.ok ? intraday.lastPrice : null,
      resistances: supportResistance.resistances.map((r) => r.price),
    }),
    buildSwingModeReview({
      bars,
      price: summary.lastClose,
      ema20: trendEma.ema20,
      ema50: trendEma.ema50,
      ema200: trendEma.ema200,
      rsi14: indicators.rsi14,
      macdHistogram: indicators.macdHistogram,
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
      technicalBearish: isTechnicalBearish({ price: summary.lastClose, ema20: trendEma.ema20, ema50: trendEma.ema50, ema200: trendEma.ema200 }),
    }),
  ], [intraday, summary, bars, trendEma, indicators, volume, priceAction, supportResistance, fundamentals, pillars]);

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
          Tiga timeframe terpisah, bukan satu sinyal: INTRADAY = timing hari ini, SWING = setup beberapa hari/minggu,
          INVESTING = kualitas bisnis + valuasi. BUY hanya bila setup + konfirmasi + Risk Gate valid; belum valid = WAIT.
          Tidak ada sinyal SELL karena posisi Anda tidak diketahui. Data intraday adalah kuotasi tertunda. Target adalah proyeksi, bukan janji profit. Edukasi, bukan ajakan jual/beli.
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
