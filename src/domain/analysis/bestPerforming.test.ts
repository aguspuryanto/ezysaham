/**
 * Kinerja Terbaik — ranking, liquidity and rise-shape tests.
 * Run: npm test
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  analyzePerformer,
  bestPerformingCandidates,
  maxDrawdownPct,
  periodBars,
  rankBestPerforming,
  top5GainShare,
  trendOf,
} from '@/domain/analysis/bestPerforming';
import { OHLCVBar } from '@/domain/models/History';
import { StockSummary } from '@/domain/models/Stock';

function summary(ticker: string, o: Partial<StockSummary> = {}): StockSummary {
  return {
    ticker, name: ticker, sector: 'Energi', subSector: '', lastClose: 1000, prevClose: 990,
    percentChange1D: 1, percentChange1W: 0, percentChange1M: 0, percentChange3M: 0, percentChange6M: 0, percentChangeYtd: 0,
    percentChange1Y: 0, percentChange3Y: 0, percentChange5Y: 0, percentChange10Y: 0,
    high: 1000, low: 980, volume: 1e6, value: 1e9, frequency: 0, capitalization: 0,
    per: 10, pbv: 1, roe: 10, freeFloat: 30, annualHigh: 1000, annualLow: 500, ...o,
  };
}

/** Weekday bars from closes, starting 2025-10-01. */
function bars(closeSeries: number[], volume = 1e7): OHLCVBar[] {
  const d = new Date('2025-10-01T00:00:00Z');
  return closeSeries.map((close) => {
    while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
    const date = d.toISOString().slice(0, 10);
    d.setUTCDate(d.getUTCDate() + 1);
    return { date, open: close, high: close, low: close, close, volume };
  });
}

const steady = (n: number, start: number, step: number) => Array.from({ length: n }, (_, k) => start * (1 + step) ** k);

describe('Kinerja Terbaik — kandidat & ranking', () => {
  test('candidates are sorted by the period field', () => {
    const list = [summary('AAAA', { percentChange1Y: 50 }), summary('BBBB', { percentChange1Y: 200 }), summary('CCCC', { percentChange1Y: 120, lastClose: 0 })];
    assert.deepEqual(bestPerformingCandidates(list, '1Y').map((s) => s.ticker), ['BBBB', 'AAAA']);
  });

  test('illiquid rows are dropped before taking the top', () => {
    const liquid = analyzePerformer(summary('LIQD', { percentChange1Y: 80 }), bars(steady(60, 100, 0.01), 1e8), '1Y');
    const thin = analyzePerformer(summary('THIN', { percentChange1Y: 300 }), bars(steady(60, 100, 0.01), 1e4), '1Y');
    assert.deepEqual(rankBestPerforming([thin, liquid, null]).map((r) => r.summary.ticker), ['LIQD']);
  });
});

describe('Kinerja Terbaik — bentuk kenaikan', () => {
  test('a steady climb is "Tren bertahap", a few jumps are "Didorong lonjakan"', () => {
    const steadyRow = analyzePerformer(summary('STDY'), bars(steady(120, 100, 0.01)), '1Y')!;
    assert.equal(steadyRow.character, 'Tren bertahap');
    assert.equal(steadyRow.spikeDays, 0);

    const flat = Array.from({ length: 100 }, () => 100);
    const jumpy = [...flat, 125, 156, 195, 195, 195];
    const spikeRow = analyzePerformer(summary('SPKE'), bars(jumpy), '1Y')!;
    assert.equal(spikeRow.character, 'Didorong lonjakan');
    assert.equal(spikeRow.spikeDays, 3);
  });

  test('top5GainShare is null for a falling period', () => {
    assert.equal(top5GainShare(bars([100, 90, 80, 70])), null);
  });

  test('max drawdown and distance from high', () => {
    const series = [100, 200, 100, 150];
    assert.equal(Math.round(maxDrawdownPct(bars(series))), -50);
    const row = analyzePerformer(summary('DRAW'), bars([...steady(30, 100, 0), ...series]), '1Y')!;
    assert.equal(Math.round(row.fromHigh52), -25);
  });

  test('periodBars keeps the base bar before the window', () => {
    const b = bars(steady(100, 100, 0.01));
    assert.equal(periodBars(b, '1M').length, 22);
    assert.equal(periodBars(b, '1Y').length, 100);
  });
});

describe('Kinerja Terbaik — trend', () => {
  test('without 200 bars the best is "Uptrend"', () => {
    assert.equal(trendOf(bars(steady(120, 100, 0.01))), 'Uptrend');
    assert.equal(trendOf(bars(steady(230, 100, 0.01))), 'Uptrend kuat');
    assert.equal(trendOf(bars(steady(120, 100, -0.01))), 'Melemah');
  });
});
