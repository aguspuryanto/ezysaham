'use client';

/**
 * useStockDetail.ts
 *
 * View-model layer for ScreenerDetailPage. It reuses the existing data pipeline
 * (useStockAnalysis → computeStockAnalysis / AI advisor, computeScreenerVerdict,
 * computeBandarScore) and only reshapes those outputs into props for the detail
 * components — no new scoring, valuation or prediction math lives here.
 */

import { useEffect, useMemo, useState } from 'react';
import { getStockHistory } from '@/data/repositories/StockRepository';
import { computeBandarScore, getMarketCyclePhase } from '@/domain/analysis/bandarScore';
import { computeScreenerVerdict, RiskLevel, ScreenerVerdict } from '@/domain/analysis/screenerVerdict';
import { OHLCVBar } from '@/domain/models/History';
import { Trend } from '@/domain/models/StockAnalysis';
import { useStockAnalysis } from '@/presentation/features/analysis/useStockAnalysis';
import { fmtNum, fmtRp, Tone } from './format';

/** Longer history than the analysis pipeline's 6mo default so the 1Y view and EMA 200 have enough bars. */
const CHART_RANGE = '2y';

export interface StockHeaderData {
  ticker: string;
  name: string;
  sector: string;
  price: number;
  change: number;
  changePct: number;
  high: number | null;
  low: number | null;
  volume: number | null;
}

export interface TechnicalItem {
  key: 'trend' | 'momentum' | 'volume' | 'rsi' | 'macd';
  label: string;
  value: string;
  description: string;
  hint?: string;
  tone: Tone;
  tooltip: string;
  /** RSI shows its numeric reading in a ring. */
  gauge?: number;
}

export interface InsightSignal {
  text: string;
  tone: 'positive' | 'negative' | 'warning';
}

export interface AIInsightData {
  summary: string;
  signals: InsightSignal[];
}

export interface SnapshotData {
  marketPhase: { label: string; tone: Tone } | null;
  fairLow: number | null;
  fairHigh: number | null;
  upsidePct: number | null;
  valuationStatus: { label: string; tone: Tone } | null;
  risk: { label: string; tone: Tone } | null;
}

export interface KeyLevel {
  label: string;
  price: number;
  tone: Tone;
  description: string;
}

export interface FundamentalData {
  roe: number | null;
  per: number | null;
  pbv: number | null;
  der: number | null;
  revenueGrowth: number | null;
  netProfitGrowth: number | null;
}

export interface FlowData {
  /** Real IDX broker data (Index Alpha) — null when not configured / quota exhausted. */
  netForeign: number | null;
  brokerActivity: { label: string; tone: Tone } | null;
  /** Wyckoff-style proxy from EOD bars — always available with enough history. */
  bandarEstimate: { label: string; tone: Tone; score: number; max: number } | null;
  hasRealBrokerData: boolean;
}

export interface PerformanceItem {
  label: string;
  value: number | null;
}

export interface StockDetailData {
  header: StockHeaderData;
  chartBars: OHLCVBar[];
  technical: TechnicalItem[];
  insight: AIInsightData | null;
  snapshot: SnapshotData;
  keyLevels: KeyLevel[];
  fundamental: FundamentalData;
  flow: FlowData;
  performance: PerformanceItem[];
}

const TREND_LABEL: Record<Trend, string> = { bullish: 'Bullish', bearish: 'Bearish', sideways: 'Sideways' };
const TREND_TONE: Record<Trend, Tone> = { bullish: 'positive', bearish: 'negative', sideways: 'warning' };
const RISK_META: Record<RiskLevel, { label: string; tone: Tone }> = {
  LOW: { label: 'Low', tone: 'positive' },
  MEDIUM: { label: 'Medium', tone: 'warning' },
  HIGH: { label: 'High', tone: 'negative' },
};
const VALUATION_META: Record<ScreenerVerdict['valuation']['verdict'], { label: string; tone: Tone }> = {
  UNDERVALUED: { label: 'UNDERVALUED', tone: 'positive' },
  WAJAR: { label: 'WAJAR', tone: 'info' },
  PREMIUM: { label: 'PREMIUM', tone: 'warning' },
  OVERVALUED: { label: 'OVERVALUED', tone: 'negative' },
  TIDAK_DAPAT_DINILAI: { label: 'TIDAK DAPAT DINILAI', tone: 'neutral' },
};
const BANDAR_TONE: Record<string, Tone> = { green: 'positive', amber: 'warning', orange: 'warning', red: 'negative', blue: 'info' };

export function useStockDetail(ticker: string) {
  const base = useStockAnalysis(ticker);
  const [chartHistory, setChartHistory] = useState<{ ticker: string; bars: OHLCVBar[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getStockHistory(ticker, CHART_RANGE)
      .then((bars) => { if (!cancelled) setChartHistory({ ticker, bars }); })
      .catch(() => { if (!cancelled) setChartHistory({ ticker, bars: [] }); });
    return () => { cancelled = true; };
  }, [ticker]);

  const { summary, analysis, bars, fundamentals, brokerActivity } = base;

  const verdict = useMemo(
    () => (summary && bars.length > 0 ? computeScreenerVerdict(summary, bars, fundamentals) : null),
    [summary, bars, fundamentals],
  );
  const bandar = useMemo(() => (summary && bars.length > 0 ? computeBandarScore(summary, bars) : null), [summary, bars]);

  const data = useMemo<StockDetailData | null>(() => {
    if (!summary || !analysis) return null;
    const price = summary.lastClose;
    const lastBar = bars[bars.length - 1];
    const { trendEma, indicators, volume, supportResistance } = analysis;
    const aboveEma50 = price > trendEma.ema50;
    const aboveEma200 = Number.isFinite(trendEma.ema200) && price > trendEma.ema200;

    // ── Header ──
    const header: StockHeaderData = {
      ticker: summary.ticker,
      name: summary.name,
      sector: summary.sector || summary.subSector || '—',
      price,
      change: price - summary.prevClose,
      changePct: summary.percentChange1D,
      high: lastBar?.high ?? summary.high ?? null,
      low: lastBar?.low ?? summary.low ?? null,
      volume: lastBar?.volume ?? summary.volume ?? null,
    };

    // ── Technical summary (labels on top of existing engine outputs) ──
    const emaText = aboveEma50 && aboveEma200
      ? 'Harga di atas EMA 50 & EMA 200'
      : !aboveEma50 && !aboveEma200
        ? 'Harga di bawah EMA 50 & EMA 200'
        : aboveEma50
          ? 'Harga di atas EMA 50, di bawah EMA 200'
          : 'Harga di bawah EMA 50, di atas EMA 200';

    const momentum = verdict?.momentum ?? null;
    const momentumMeta = momentum === 'STRONG'
      ? { value: 'Strong', tone: 'positive' as Tone }
      : momentum === 'WEAK'
        ? { value: 'Weak', tone: 'negative' as Tone }
        : { value: 'Moderate', tone: 'warning' as Tone };

    const rvol = volume.relativeVolume;
    const volLevel = verdict?.volume ?? null;
    const volMeta = volLevel === 'HIGH'
      ? { value: 'High', tone: 'positive' as Tone }
      : volLevel === 'LOW'
        ? { value: 'Low', tone: 'negative' as Tone }
        : { value: 'Normal', tone: 'info' as Tone };

    const rsiMeta = (() => {
      switch (indicators.rsiZone) {
        case 'overbought': return { value: 'Overbought', tone: 'warning' as Tone, hint: '(bukan sinyal jual otomatis)' };
        case 'overbought_risk': return { value: 'Mendekati Overbought', tone: 'warning' as Tone, hint: '(momentum mulai panas)' };
        case 'oversold': return { value: 'Oversold', tone: 'warning' as Tone, hint: '(bukan sinyal beli otomatis)' };
        case 'bullish_zone': return { value: 'Zona Bullish', tone: 'positive' as Tone, hint: undefined };
        default: return { value: 'Netral', tone: 'info' as Tone, hint: undefined };
      }
    })();

    const macdBull = indicators.macdSignalType === 'bullish' || indicators.macdSignalType === 'bullish_crossover';
    const macdBear = indicators.macdSignalType === 'bearish' || indicators.macdSignalType === 'bearish_crossover';
    const macdMeta = macdBull
      ? { value: 'Bullish', tone: 'positive' as Tone, description: indicators.macdSignalType === 'bullish_crossover' ? 'Baru golden cross di atas signal line' : 'MACD di atas signal line' }
      : macdBear
        ? { value: 'Bearish', tone: 'negative' as Tone, description: indicators.macdSignalType === 'bearish_crossover' ? 'Baru dead cross di bawah signal line' : 'MACD di bawah signal line' }
        : { value: 'Netral', tone: 'info' as Tone, description: 'MACD berhimpit dengan signal line' };

    const technical: TechnicalItem[] = [
      {
        key: 'trend', label: 'Trend', value: TREND_LABEL[trendEma.trend], tone: TREND_TONE[trendEma.trend], description: emaText,
        tooltip: 'Arah tren dari posisi harga terhadap EMA (Exponential Moving Average). Di atas EMA 50 & 200 = tren naik jangka menengah–panjang.',
      },
      {
        key: 'momentum', label: 'Momentum', value: momentumMeta.value, tone: momentumMeta.tone,
        description: indicators.macdHistogram > 0 ? 'MACD positif, histogram menguat' : 'Histogram MACD melemah',
        tooltip: 'Kekuatan dorongan harga saat ini, dibaca dari RSI dan histogram MACD.',
      },
      {
        key: 'volume', label: 'Volume', value: volMeta.value, tone: volMeta.tone,
        description: Number.isFinite(rvol) ? `Volume ${fmtNum(rvol, 1)}x rata-rata 20 hari` : 'Data volume belum cukup',
        tooltip: 'Relative Volume (RVOL): volume hari terakhir dibanding rata-rata 20 hari. >1,5x = partisipasi tinggi.',
      },
      {
        key: 'rsi', label: 'RSI', value: rsiMeta.value, tone: rsiMeta.tone, hint: rsiMeta.hint, gauge: Math.round(indicators.rsi14),
        description: `RSI(14) ${fmtNum(indicators.rsi14, 0)}`,
        tooltip: 'Relative Strength Index (14): 0–100. >70 overbought, <30 oversold. Overbought di tren kuat bisa bertahan lama.',
      },
      {
        key: 'macd', label: 'MACD', value: macdMeta.value, tone: macdMeta.tone, description: macdMeta.description,
        tooltip: 'Moving Average Convergence Divergence (12, 26, 9). MACD di atas signal line = momentum bullish.',
      },
    ];

    // ── Key levels ──
    const s1 = supportResistance.supports[0];
    const r1 = supportResistance.resistances[0];
    const r2 = supportResistance.resistances[1];
    const bullishPlan = analysis.tradingPlan.bullish;
    const keyLevels: KeyLevel[] = [];
    if (s1) keyLevels.push({ label: 'Support', price: s1.price, tone: 'positive', description: s1.description });
    if (r1) keyLevels.push({ label: 'Resistance', price: r1.price, tone: 'negative', description: r1.description });
    if (bullishPlan.entryType === 'BUY_ON_BREAKOUT' && bullishPlan.validationErrors.length === 0) {
      keyLevels.push({ label: 'Breakout', price: bullishPlan.entry, tone: 'info', description: 'Area konfirmasi breakout dari rencana trading' });
    } else if (r2) {
      keyLevels.push({ label: 'Resistance 2', price: r2.price, tone: 'info', description: r2.description });
    }

    // ── AI insight: rule-based, data-backed statements only (never "pasti naik") ──
    const signals: InsightSignal[] = [];
    signals.push(
      trendEma.trend === 'bullish'
        ? { text: 'Trend utama bullish', tone: 'positive' }
        : trendEma.trend === 'bearish'
          ? { text: 'Trend utama bearish', tone: 'negative' }
          : { text: 'Trend masih sideways', tone: 'warning' },
    );
    signals.push({ text: emaText, tone: aboveEma50 && aboveEma200 ? 'positive' : !aboveEma50 && !aboveEma200 ? 'negative' : 'warning' });
    if (momentum) {
      signals.push(
        momentum === 'STRONG'
          ? { text: 'Momentum menguat', tone: 'positive' }
          : momentum === 'WEAK'
            ? { text: 'Momentum melemah', tone: 'negative' }
            : { text: 'Momentum moderat', tone: 'warning' },
      );
    }
    if (s1) signals.push({ text: `Waspada jika kehilangan ${fmtRp(s1.price)}`, tone: 'negative' });

    const insight: AIInsightData = {
      summary: [analysis.conclusion.summary, analysis.conclusion.keyLevel].filter(Boolean).join(' '),
      signals,
    };

    // ── Snapshot ──
    const cycle = bandar ? getMarketCyclePhase(bandar, indicators) : null;
    const snapshot: SnapshotData = {
      marketPhase: cycle
        ? { label: cycle.label.charAt(0) + cycle.label.slice(1).toLowerCase(), tone: BANDAR_TONE[cycle.tone] ?? 'neutral' }
        : verdict?.marketPhase ? { label: verdict.marketPhase.label, tone: 'info' } : null,
      fairLow: verdict?.valuation.fairLow ?? null,
      fairHigh: verdict?.valuation.fairHigh ?? null,
      upsidePct: verdict?.valuation.upsidePct ?? null,
      valuationStatus: verdict ? VALUATION_META[verdict.valuation.verdict] : null,
      risk: verdict?.risk ? RISK_META[verdict.risk] : null,
    };

    // ── Fundamental (null = not available, never coerced to 0) ──
    const pos = (n: number | null | undefined) => (n != null && Number.isFinite(n) && n !== 0 ? n : null);
    const fundamental: FundamentalData = {
      roe: pos(summary.roe),
      per: pos(summary.per),
      pbv: pos(summary.pbv),
      // Yahoo reports D/E as a percentage (18.1 = 0,18x).
      der: fundamentals?.debtToEquity != null ? fundamentals.debtToEquity / 100 : null,
      revenueGrowth: fundamentals?.revenueGrowth ?? null,
      netProfitGrowth: fundamentals?.earningsGrowth ?? null,
    };

    // ── Ownership / flow ──
    const netForeign = brokerActivity?.foreignFlow?.netForeign ?? null;
    const brokerNet = brokerActivity
      ? [...brokerActivity.topBuyers, ...brokerActivity.topSellers].reduce((sum, b) => sum + b.netValue, 0)
      : null;
    const flow: FlowData = {
      netForeign,
      brokerActivity: brokerNet == null
        ? null
        : brokerNet > 0 ? { label: 'Akumulasi', tone: 'positive' } : brokerNet < 0 ? { label: 'Distribusi', tone: 'negative' } : { label: 'Netral', tone: 'warning' },
      bandarEstimate: bandar
        ? { label: bandar.classification.label, tone: BANDAR_TONE[bandar.classification.tone] ?? 'neutral', score: bandar.total, max: bandar.max }
        : null,
      hasRealBrokerData: brokerActivity != null,
    };

    const performance: PerformanceItem[] = [
      { label: '1D', value: summary.percentChange1D },
      { label: '1W', value: summary.percentChange1W },
      { label: '1M', value: summary.percentChange1M },
      { label: '3M', value: summary.percentChange3M },
      { label: '1Y', value: summary.percentChange1Y },
    ];

    const chartBars = chartHistory?.ticker === ticker && chartHistory.bars.length >= bars.length ? chartHistory.bars : bars;

    return { header, chartBars, technical, insight, snapshot, keyLevels, fundamental, flow, performance };
  }, [summary, analysis, bars, verdict, bandar, fundamentals, brokerActivity, chartHistory, ticker]);

  return {
    status: base.status,
    data,
    analysis,
    fundamentals: base.fundamentals,
    fundamentalsLoading: base.fundamentalsLoading,
    brokerActivity: base.brokerActivity,
    brokerActivityLoading: base.brokerActivityLoading,
    bandar,
    newsItems: base.newsItems,
    newsLoading: base.newsLoading,
    freshness: base.freshness,
    reload: base.reload,
  };
}
