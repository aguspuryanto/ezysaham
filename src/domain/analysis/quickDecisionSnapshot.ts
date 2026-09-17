/**
 * quickDecisionSnapshot.ts
 *
 * Lightweight, rule-based TRADE / WAIT / NO_TRADE snapshot bolted onto the
 * existing "Kesimpulan Objektif" card, built entirely from data already
 * computed elsewhere on the stock page (trend, momentum, volume, the Bandar/
 * Wyckoff score, market cycle phase, entry timing, support). No R:R is used
 * anywhere in this verdict (EzySaham 2.0's Decision Engine deliberately does
 * not gate on reward:risk — see decisionEngine.ts).
 *
 * This is an interim stand-in, not the full EzySaham 2.0 Decision Engine: it
 * has no Market Regime check (IHSG regime lives in marketRegimeEngine.ts,
 * not wired in here), no real Setup Engine (entryTiming.ts's verdict is used
 * as a Trigger proxy), and no Risk/SL/position-sizing gate. Expect this to be
 * superseded once decisionEngine.ts (Sprint 4) ships.
 */

import { OHLCVBar } from '@/domain/models/History';
import { closes, ema, lastValid } from '@/domain/indicators/movingAverages';
import {
  IndicatorAnalysis,
  SupportResistanceAnalysis,
  TrendEmaAnalysis,
  VolumeAnalysis,
} from '@/domain/models/StockAnalysis';
import { BandarScoreResult, MarketCyclePhaseResult } from '@/domain/analysis/bandarScore';
import { EntryTimingResult } from '@/domain/analysis/entryTiming';

export type QuickTone = 'green' | 'red' | 'amber' | 'blue' | 'zinc';
export type QuickVerdict = 'TRADE' | 'WAIT' | 'NO_TRADE';

export interface QuickDecisionFactor {
  label: string;
  value: string;
  tone: QuickTone;
}

export interface QuickDecisionSnapshotResult {
  verdict: QuickVerdict;
  market: QuickDecisionFactor;
  trend: QuickDecisionFactor;
  momentum: QuickDecisionFactor[];
  volume: QuickDecisionFactor;
  bandar: QuickDecisionFactor;
  location: QuickDecisionFactor;
  trigger: QuickDecisionFactor;
  reasons: string[];
}

function toQuickTone(tone: 'green' | 'amber' | 'orange' | 'red' | 'blue'): QuickTone {
  return tone === 'orange' ? 'amber' : tone;
}

export function computeQuickDecisionSnapshot(params: {
  bars: OHLCVBar[];
  trendEma: TrendEmaAnalysis;
  indicators: IndicatorAnalysis;
  volume: VolumeAnalysis;
  supportResistance: SupportResistanceAnalysis;
  bandarScore: BandarScoreResult;
  marketCyclePhase: MarketCyclePhaseResult;
  entryTiming: EntryTimingResult;
}): QuickDecisionSnapshotResult {
  const { bars, trendEma, indicators, volume, supportResistance, bandarScore, marketCyclePhase, entryTiming } = params;

  // Daily EMA9/EMA21 stack — deliberately from daily bars (not the page's separate
  // intraday-minute EMA9/21 used for the VWAP checklist), so this factor stays
  // available after hours and doesn't depend on the intraday feed.
  const cls = closes(bars);
  const ema9 = lastValid(ema(cls, 9));
  const ema21 = lastValid(ema(cls, 21));
  const hasEmaStack = !Number.isNaN(ema9) && !Number.isNaN(ema21);
  const ema9AboveEma21 = hasEmaStack && ema9 > ema21;

  const isOverbought = indicators.rsiZone === 'overbought' || indicators.rsiZone === 'overbought_risk';
  const isMacdBullish = indicators.macdSignalType === 'bullish_crossover' || indicators.macdSignalType === 'bullish';

  const market: QuickDecisionFactor = {
    label: 'Market Cycle',
    value: marketCyclePhase.number != null ? `Fase ${marketCyclePhase.number} — ${marketCyclePhase.label}` : marketCyclePhase.label,
    tone: toQuickTone(marketCyclePhase.tone),
  };

  const trendLabel = trendEma.trend === 'bullish' ? 'Uptrend' : trendEma.trend === 'bearish' ? 'Downtrend' : 'Sideways';
  const trend: QuickDecisionFactor = {
    label: 'Trend',
    value: trendLabel,
    tone: trendEma.trend === 'bullish' ? 'green' : trendEma.trend === 'bearish' ? 'red' : 'amber',
  };

  const momentum: QuickDecisionFactor[] = [
    {
      label: 'RSI',
      value: `${indicators.rsi14.toFixed(1)}${isOverbought ? ' Overbought' : ''}`,
      tone: isOverbought ? 'red' : indicators.rsiZone === 'oversold' ? 'amber' : 'green',
    },
    {
      label: 'EMA9 vs EMA21',
      value: hasEmaStack ? (ema9AboveEma21 ? 'EMA9 > EMA21' : 'EMA9 < EMA21') : 'Data belum cukup',
      tone: !hasEmaStack ? 'zinc' : ema9AboveEma21 ? 'green' : 'red',
    },
    {
      label: 'MACD',
      value: isMacdBullish ? 'Bullish' : 'Bearish',
      tone: isMacdBullish ? 'green' : 'red',
    },
  ];

  const relativeVolume = volume.relativeVolume;
  const volumeWeak = relativeVolume < 1;
  const volumeFactor: QuickDecisionFactor = {
    label: 'Volume',
    value: `RVOL ${relativeVolume.toFixed(2)}×`,
    tone: volume.isHighVolume ? 'green' : relativeVolume < 0.5 ? 'red' : 'amber',
  };

  const bandarDistribution =
    bandarScore.phase === 'distribution' || bandarScore.phase === 'markdown' || bandarScore.hiddenDistributionWarning;
  const bandar: QuickDecisionFactor = {
    label: 'Bandar',
    value: bandarScore.classification.label,
    tone: toQuickTone(bandarScore.classification.tone),
  };

  const nearestSupport = supportResistance.supports[0];
  const location: QuickDecisionFactor = {
    label: 'Location',
    value: nearestSupport ? `Support ${Math.round(nearestSupport.price).toLocaleString('id-ID')}` : 'Support tidak teridentifikasi',
    tone: nearestSupport ? 'green' : 'zinc',
  };

  const triggerConfirmed = entryTiming.verdict === 'optimal_now';
  const trigger: QuickDecisionFactor = {
    label: 'Trigger',
    value: triggerConfirmed ? 'Confirmed' : 'Not Confirmed',
    tone: entryTiming.tone,
  };

  const redFlagCount = [
    isOverbought,
    hasEmaStack && !ema9AboveEma21,
    bandarDistribution,
    !triggerConfirmed,
    volumeWeak,
  ].filter(Boolean).length;

  let verdict: QuickVerdict;
  if (bandarDistribution || redFlagCount >= 3) {
    verdict = 'NO_TRADE';
  } else if (triggerConfirmed && trendEma.trend === 'bullish' && !isOverbought && ema9AboveEma21 && !volumeWeak) {
    verdict = 'TRADE';
  } else {
    verdict = 'WAIT';
  }

  const biasLabel = trendEma.trend === 'bearish' ? 'Sell on Rejection' : 'Buy on Support';
  const reasons: string[] = [];
  if (!triggerConfirmed) reasons.push(`Setup ${biasLabel} belum aktif`);
  if (isOverbought) reasons.push('Momentum menunjukkan kondisi overbought');
  if (hasEmaStack && !ema9AboveEma21) reasons.push('EMA9 < EMA21');
  if (bandarDistribution) reasons.push('Distribution risk terdeteksi');
  if (volumeWeak) reasons.push('Volume belum memberikan confirmation');
  if (!triggerConfirmed && nearestSupport) {
    reasons.push(
      `Entry di area ${Math.round(nearestSupport.price).toLocaleString('id-ID')} belum berada pada kondisi trigger yang tervalidasi`
    );
  }
  if (reasons.length === 0) {
    reasons.push('Seluruh faktor Trend, Momentum, Volume, Bandar, dan Trigger saling mendukung.');
  }

  return { verdict, market, trend, momentum, volume: volumeFactor, bandar, location, trigger, reasons };
}
