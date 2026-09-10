import { OHLCVBar } from '@/domain/models/History';
import { StockSummary } from '@/domain/models/Stock';
import { SCREENER_PRESETS } from '@/domain/screener/presets';
import { computeStockAnalysis } from '@/domain/analysis/stockAnalysisEngine';
import {
  BacktestPresetId,
  BacktestRunConfig,
  BacktestRunResult,
  BacktestSignal,
  BacktestTickerStats,
} from './BacktestEntry';

/** Minimum bars of lookback before a signal can be evaluated (EMA50/ADX(14) need warmup). */
const MIN_LOOKBACK = 60;

function buildHistoricalSummary(ticker: string, bars: OHLCVBar[], i: number): StockSummary {
  const bar = bars[i];
  const prevBar = bars[i - 1];
  const percentChange1D = prevBar.close > 0 ? ((bar.close - prevBar.close) / prevBar.close) * 100 : 0;

  return {
    ticker,
    name: ticker,
    sector: '',
    subSector: '',
    lastClose: bar.close,
    prevClose: prevBar.close,
    percentChange1D,
    percentChange1W: 0,
    percentChange1M: 0,
    percentChange3M: 0,
    percentChange6M: 0,
    percentChangeYtd: 0,
    percentChange1Y: 0,
    percentChange3Y: 0,
    percentChange5Y: 0,
    percentChange10Y: 0,
    high: bar.high,
    low: bar.low,
    volume: bar.volume,
    // Proxy for daily transaction value (close * volume) — not the true VWAP-based
    // figure, but close enough for the liquidity gates in dayTrading/swingHunter.
    value: bar.close * bar.volume,
    frequency: 0,
    capitalization: 0,
    per: 0,
    pbv: 0,
    roe: 0,
    freeFloat: 0,
    annualHigh: bar.high,
    annualLow: bar.low,
  };
}

function backtestTicker(
  ticker: string,
  bars: OHLCVBar[],
  presetId: BacktestPresetId,
  holdingDays: number
): BacktestSignal[] {
  const preset = SCREENER_PRESETS[presetId];
  const signals: BacktestSignal[] = [];

  let i = MIN_LOOKBACK;
  while (i < bars.length - 1) {
    const bar = bars[i];
    const summary = buildHistoricalSummary(ticker, bars, i);
    const slice = bars.slice(0, i + 1);
    const evaluation = preset.evaluate(summary, slice, null, new Date(bar.date));

    if (!evaluation.passed) {
      i += 1;
      continue;
    }

    const analysis = computeStockAnalysis(summary, slice);
    const scenario =
      analysis.tradingPlan.recommendedBias === 'bearish'
        ? analysis.tradingPlan.bearish
        : analysis.tradingPlan.bullish;

    const entry = scenario.entry;
    const tp1 = scenario.tp1;
    const sl = scenario.sl;

    let resolved: BacktestSignal | null = null;
    const horizonEnd = Math.min(i + holdingDays, bars.length - 1);
    for (let j = i + 1; j <= horizonEnd; j++) {
      const close = bars[j].close;
      if (close >= tp1) {
        resolved = {
          ticker,
          presetId,
          signalDate: bar.date,
          entry,
          tp1,
          tp2: scenario.tp2,
          sl,
          riskRewardPlanned: scenario.riskRewardRatio,
          reasonBuy: evaluation.reasons.join(', '),
          status: 'tp_hit',
          resolvedDate: bars[j].date,
          exitPrice: tp1,
          gainLossPct: ((tp1 - entry) / entry) * 100,
          daysHeld: j - i,
        };
        break;
      }
      if (close <= sl) {
        resolved = {
          ticker,
          presetId,
          signalDate: bar.date,
          entry,
          tp1,
          tp2: scenario.tp2,
          sl,
          riskRewardPlanned: scenario.riskRewardRatio,
          reasonBuy: evaluation.reasons.join(', '),
          status: 'sl_hit',
          resolvedDate: bars[j].date,
          exitPrice: sl,
          gainLossPct: ((sl - entry) / entry) * 100,
          daysHeld: j - i,
        };
        break;
      }
    }

    if (!resolved) {
      const lastBar = bars[horizonEnd];
      resolved = {
        ticker,
        presetId,
        signalDate: bar.date,
        entry,
        tp1,
        tp2: scenario.tp2,
        sl,
        riskRewardPlanned: scenario.riskRewardRatio,
        reasonBuy: evaluation.reasons.join(', '),
        status: 'timeout',
        resolvedDate: lastBar.date,
        exitPrice: lastBar.close,
        gainLossPct: ((lastBar.close - entry) / entry) * 100,
        daysHeld: horizonEnd - i,
      };
    }

    signals.push(resolved);
    // Skip past this signal's holding window — don't open a new signal while one is "open".
    i = i + Math.max(resolved.daysHeld, 1) + 1;
  }

  return signals;
}

export function runPresetBacktest(
  tickersWithBars: Array<{ ticker: string; bars: OHLCVBar[] }>,
  config: Omit<BacktestRunConfig, 'tickers'>
): BacktestRunResult {
  const signals: BacktestSignal[] = [];
  const perTicker: Record<string, BacktestTickerStats> = {};

  for (const { ticker, bars } of tickersWithBars) {
    if (bars.length < MIN_LOOKBACK + 1) {
      perTicker[ticker] = { signals: 0, wins: 0, losses: 0, timeouts: 0 };
      continue;
    }
    const tickerSignals = backtestTicker(ticker, bars, config.presetId, config.holdingDays);
    signals.push(...tickerSignals);
    perTicker[ticker] = {
      signals: tickerSignals.length,
      wins: tickerSignals.filter((s) => s.status === 'tp_hit').length,
      losses: tickerSignals.filter((s) => s.status === 'sl_hit').length,
      timeouts: tickerSignals.filter((s) => s.status === 'timeout').length,
    };
  }

  const wins = signals.filter((s) => s.status === 'tp_hit').length;
  const losses = signals.filter((s) => s.status === 'sl_hit').length;
  const resolved = signals.filter((s) => s.status !== 'timeout');

  return {
    config: { ...config, tickers: tickersWithBars.map((t) => t.ticker) },
    signals,
    perTicker,
    winRate: wins + losses > 0 ? (wins / (wins + losses)) * 100 : null,
    avgGainLossPct:
      resolved.length > 0 ? resolved.reduce((sum, s) => sum + s.gainLossPct, 0) / resolved.length : null,
  };
}
