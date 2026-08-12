import { OHLCVBar } from '@/domain/models/History';
import { MacdResult } from '@/domain/indicators/macd';
import { IndicatorCrossHistoryResult, TechnicalEvent } from '@/domain/models/TechnicalHistory';
import { crossesAbove, crossesBelow } from './crossUtils';

export function detectIndicatorCrossEvents(
  bars: OHLCVBar[],
  ema20: number[],
  ema50: number[],
  ema200: number[],
  macd: MacdResult,
  rsi: number[]
): IndicatorCrossHistoryResult {
  const events: TechnicalEvent[] = [];
  const rsi30 = new Array(rsi.length).fill(30);
  const rsi70 = new Array(rsi.length).fill(70);

  for (let i = 1; i < bars.length; i++) {
    const bar = bars[i];
    const priceMetric = { Close: bar.close.toLocaleString('id-ID') };

    if (crossesAbove(ema20, ema50, i)) {
      events.push({
        date: bar.date, category: 'indicatorCross', type: 'golden_cross_20_50', label: 'Golden Cross EMA20/50',
        tone: 'bullish', icon: '🟢', metrics: { ...priceMetric, EMA20: Math.round(ema20[i]).toLocaleString('id-ID'), EMA50: Math.round(ema50[i]).toLocaleString('id-ID') },
        summary: 'EMA20 memotong ke atas EMA50 — sinyal perubahan momentum jangka pendek menjadi bullish.',
      });
    } else if (crossesBelow(ema20, ema50, i)) {
      events.push({
        date: bar.date, category: 'indicatorCross', type: 'death_cross_20_50', label: 'Death Cross EMA20/50',
        tone: 'bearish', icon: '🔴', metrics: { ...priceMetric, EMA20: Math.round(ema20[i]).toLocaleString('id-ID'), EMA50: Math.round(ema50[i]).toLocaleString('id-ID') },
        summary: 'EMA20 memotong ke bawah EMA50 — sinyal perubahan momentum jangka pendek menjadi bearish.',
      });
    }

    if (crossesAbove(ema50, ema200, i)) {
      events.push({
        date: bar.date, category: 'indicatorCross', type: 'golden_cross_50_200', label: 'Golden Cross EMA50/200 (Mayor)',
        tone: 'bullish', icon: '🟢', metrics: { ...priceMetric, EMA50: Math.round(ema50[i]).toLocaleString('id-ID'), EMA200: Math.round(ema200[i]).toLocaleString('id-ID') },
        summary: 'EMA50 memotong ke atas EMA200 — sinyal perubahan tren jangka panjang menjadi bullish.',
      });
    } else if (crossesBelow(ema50, ema200, i)) {
      events.push({
        date: bar.date, category: 'indicatorCross', type: 'death_cross_50_200', label: 'Death Cross EMA50/200 (Mayor)',
        tone: 'bearish', icon: '🔴', metrics: { ...priceMetric, EMA50: Math.round(ema50[i]).toLocaleString('id-ID'), EMA200: Math.round(ema200[i]).toLocaleString('id-ID') },
        summary: 'EMA50 memotong ke bawah EMA200 — sinyal perubahan tren jangka panjang menjadi bearish.',
      });
    }

    if (crossesAbove(macd.macdLine, macd.signalLine, i)) {
      events.push({
        date: bar.date, category: 'indicatorCross', type: 'macd_bullish_cross', label: 'MACD Bullish Crossover',
        tone: 'bullish', icon: '🟢', metrics: { ...priceMetric, MACD: macd.macdLine[i].toFixed(1), Signal: macd.signalLine[i].toFixed(1) },
        summary: 'Garis MACD memotong ke atas garis sinyal — momentum berbalik positif.',
      });
    } else if (crossesBelow(macd.macdLine, macd.signalLine, i)) {
      events.push({
        date: bar.date, category: 'indicatorCross', type: 'macd_bearish_cross', label: 'MACD Bearish Crossover',
        tone: 'bearish', icon: '🔴', metrics: { ...priceMetric, MACD: macd.macdLine[i].toFixed(1), Signal: macd.signalLine[i].toFixed(1) },
        summary: 'Garis MACD memotong ke bawah garis sinyal — momentum berbalik negatif.',
      });
    }

    if (crossesAbove(rsi, rsi30, i)) {
      events.push({
        date: bar.date, category: 'indicatorCross', type: 'rsi_exit_oversold', label: 'RSI Keluar dari Oversold',
        tone: 'bullish', icon: '🟡', metrics: { ...priceMetric, RSI: rsi[i].toFixed(0) },
        summary: 'RSI(14) naik melewati level 30 — potensi rebound dari kondisi jenuh jual.',
      });
    }
    if (crossesAbove(rsi, rsi70, i)) {
      events.push({
        date: bar.date, category: 'indicatorCross', type: 'rsi_enter_overbought', label: 'RSI Masuk Overbought',
        tone: 'neutral', icon: '🟠', metrics: { ...priceMetric, RSI: rsi[i].toFixed(0) },
        summary: 'RSI(14) naik melewati level 70 — mulai memasuki zona jenuh beli, waspadai koreksi.',
      });
    }
  }

  return { events: events.sort((a, b) => (a.date < b.date ? 1 : -1)) };
}
