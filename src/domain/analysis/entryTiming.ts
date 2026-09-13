/**
 * entryTiming.ts
 *
 * Combines the Bandar Detector's Wyckoff phase (bandarScore.ts — accumulation/
 * markup/distribution/markdown, already includes Spring detection) with the
 * momentum read from stockAnalysisEngine.ts (RSI/MACD) into one "when" verdict:
 * when bandar accumulation is starting, and when the momentum entry window is
 * actually open — vs. just a static support/resistance price level. Pure
 * synthesis over already-computed values, no new indicators, no fabricated data.
 */

import { BandarScoreResult } from '@/domain/analysis/bandarScore';
import { IndicatorAnalysis } from '@/domain/models/StockAnalysis';

export type EntryTimingVerdict = 'accumulation_start' | 'optimal_now' | 'late_markup' | 'wait_pullback' | 'avoid_distribution';
export type EntryTimingTone = 'green' | 'blue' | 'amber' | 'red' | 'zinc';

export interface EntryTimingResult {
  verdict: EntryTimingVerdict;
  label: string;
  tone: EntryTimingTone;
  headline: string;
  reasons: string[];
}

function isRsiOverbought(indicators: IndicatorAnalysis): boolean {
  return indicators.rsiZone === 'overbought' || indicators.rsiZone === 'overbought_risk';
}

function isMacdBullish(indicators: IndicatorAnalysis): boolean {
  return indicators.macdSignalType === 'bullish_crossover' || indicators.macdSignalType === 'bullish';
}

export function computeEntryTiming(bandar: BandarScoreResult, indicators: IndicatorAnalysis): EntryTimingResult {
  const rsiReason = `RSI ${indicators.rsi14.toFixed(1)} (${indicators.rsiNote})`;
  const macdReason = indicators.macdNote;
  const phaseReason = `Fase Wyckoff: ${bandar.phaseLabel}.`;

  if (bandar.hiddenDistributionWarning || bandar.phase === 'markdown') {
    return {
      verdict: 'avoid_distribution',
      label: 'Hindari — Sinyal Distribusi',
      tone: 'red',
      headline: bandar.hiddenDistributionWarning
        ? 'Harga naik tapi OBV melemah — indikasi hidden distribution, bukan waktu untuk entry baru.'
        : 'Struktur harga sudah masuk fase markdown (breakdown) — bukan waktu untuk entry beli.',
      reasons: [phaseReason, `Volume Signature: ${bandar.factors.find((f) => f.key === 'volumeSignature')?.detail ?? '–'}`],
    };
  }

  if (bandar.phase === 'accumulation' && indicators.macdSignalType === 'bullish_crossover' && !isRsiOverbought(indicators)) {
    return {
      verdict: 'optimal_now',
      label: 'Entry Timing Optimal',
      tone: 'green',
      headline: 'Fase akumulasi bandar terkonfirmasi dan momentum baru saja menyala (MACD golden cross) — kombinasi entry timing terbaik.',
      reasons: [phaseReason, macdReason, rsiReason],
    };
  }

  if (bandar.phase === 'accumulation') {
    return {
      verdict: 'accumulation_start',
      label: 'Bandar Mulai Akumulasi',
      tone: 'blue',
      headline: 'Bandar terindikasi sedang mengumpulkan posisi, tapi momentum harga belum terkonfirmasi — masuk watchlist, tahan entry penuh dulu.',
      reasons: [phaseReason, macdReason, rsiReason],
    };
  }

  if (bandar.phase === 'markup' && isMacdBullish(indicators) && !isRsiOverbought(indicators)) {
    return {
      verdict: 'optimal_now',
      label: 'Entry Timing Optimal',
      tone: 'green',
      headline: 'Breakout dari basing sudah terjadi (markup) dan momentum masih sehat — jendela entry masih terbuka.',
      reasons: [phaseReason, macdReason, rsiReason],
    };
  }

  if (bandar.phase === 'markup' && isRsiOverbought(indicators)) {
    return {
      verdict: 'late_markup',
      label: 'Momentum Sudah Lanjut',
      tone: 'amber',
      headline: 'Harga sudah breakout dan RSI mulai overbought — risiko mengejar harga (chasing) meningkat, tunggu pullback sehat.',
      reasons: [phaseReason, rsiReason],
    };
  }

  return {
    verdict: 'wait_pullback',
    label: 'Tunggu Konfirmasi',
    tone: 'zinc',
    headline: 'Belum ada keselarasan yang cukup kuat antara fase Bandar dan momentum — tunggu sinyal yang lebih jelas sebelum entry.',
    reasons: [phaseReason, macdReason, rsiReason],
  };
}
