/**
 * Topgain radar — prefilter, scoring and snapshot tests (docs/features_topgain_radar.md).
 * Run: npm test
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { buildRadarScan, radarPrefilter, radarScore, radarTop } from '@/domain/analysis/topgainRadar';
import { OHLCVBar } from '@/domain/models/History';
import { StockSummary } from '@/domain/models/Stock';

function summary(ticker: string, o: Partial<StockSummary> = {}): StockSummary {
  return {
    ticker, name: ticker, sector: '', subSector: '', lastClose: 100, prevClose: 100,
    percentChange1D: 0, percentChange1W: 0, percentChange1M: 0, percentChange3M: 0, percentChange6M: 0, percentChangeYtd: 0,
    percentChange1Y: 0, percentChange3Y: 0, percentChange5Y: 0, percentChange10Y: 0,
    high: 100, low: 100, volume: 0, value: 0, frequency: 0, capitalization: 5e11,
    per: 0, pbv: 0, roe: 0, freeFloat: 30, annualHigh: 0, annualLow: 0, ...o,
  };
}

/** Weekday bars ending on `end`, close path from `closeAt(i)`, constant volume unless `volAt` says otherwise. */
function bars(n: number, end: string, closeAt: (i: number) => number, volAt: (i: number) => number = () => 1e7): OHLCVBar[] {
  const dates: string[] = [];
  const d = new Date(`${end}T00:00:00Z`);
  while (dates.length < n) {
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) dates.unshift(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return dates.map((date, i) => {
    const c = closeAt(i);
    return { date, open: c, high: c * 1.01, low: c * 0.99, close: c, volume: volAt(i) };
  });
}

const END = '2026-10-15';
const AFTER_CLOSE = new Date('2026-10-15T13:00:00Z'); // 20.00 WIB
const IN_SESSION = new Date('2026-10-15T04:00:00Z');  // 11.00 WIB

describe('Radar — prefilter', () => {
  test('keeps only stocks that moved enough to score high', () => {
    const kept = radarPrefilter([
      summary('FLAT'),
      summary('UP1D', { percentChange1D: 12 }),
      summary('DN1D', { percentChange1D: -6 }),
      summary('UP1W', { percentChange1W: 10 }),
      summary('UP1M', { percentChange1M: 30 }),
      summary('DN1M', { percentChange1M: -25 }),
      summary('DEAD', { lastClose: 0, percentChange1D: 20 }),
    ]).map((s) => s.ticker);
    assert.deepEqual(kept, ['DN1D', 'DN1M', 'UP1D', 'UP1M', 'UP1W']);
  });
});

describe('Radar — skor', () => {
  test('a hot stock (ARA after a run-up) outscores a flat one', () => {
    const run = bars(120, END, (i) => (i < 100 ? 100 : 100 * 1.04 ** (i - 99)) * (i === 119 ? 1.25 : 1), (i) => (i >= 110 ? 4e7 : 1e7));
    const flat = bars(120, END, () => 100);
    const scan = buildRadarScan([{ summary: summary('HOT'), bars: run }, { summary: summary('FLAT'), bars: flat }], AFTER_CLOSE);
    assert.equal(scan.state, 'OK');
    assert.deepEqual(scan.rows.map((r) => r.summary.ticker), ['HOT', 'FLAT']);
    assert.ok(scan.rows[0].score > 5);
    assert.ok(scan.rows[1].score < 0, 'tight 10-day range has a strong negative weight');
    assert.ok(scan.rows[0].reasons.includes('Hari ini naik ≥ 10%'));
  });

  test('score is the sum of the weights of the conditions met', () => {
    const flat = bars(120, END, () => 100);
    const scan = buildRadarScan([{ summary: summary('FLAT'), bars: flat }], AFTER_CLOSE);
    const { score, met } = radarScore(scan.rows[0].features);
    assert.equal(score, met.reduce((s, k) => s + k.weight, 0));
  });
});

describe('Radar — snapshot', () => {
  test('drops today\'s live bar while the session is open', () => {
    const b = bars(120, END, () => 100);
    const live = buildRadarScan([{ summary: summary('AAAA'), bars: b }], IN_SESSION);
    assert.equal(live.liveBarDropped, true);
    assert.equal(live.dataDate, '2026-10-14');
    const closed = buildRadarScan([{ summary: summary('AAAA'), bars: b }], AFTER_CLOSE);
    assert.equal(closed.liveBarDropped, false);
    assert.equal(closed.dataDate, END);
  });

  test('stocks without a trade on the snapshot date are excluded and listed', () => {
    const traded = bars(120, END, () => 100);
    const halted = bars(120, END, () => 100, (i) => (i >= 117 ? 0 : 1e7));
    const scan = buildRadarScan([{ summary: summary('AAAA'), bars: traded }, { summary: summary('SUSP'), bars: halted }], AFTER_CLOSE);
    assert.deepEqual(scan.rows.map((r) => r.summary.ticker), ['AAAA']);
    assert.deepEqual(scan.noTrade, ['SUSP']);
  });

  test('liquidity filter hides thin stocks unless asked', () => {
    const liquid = bars(120, END, () => 100, () => 1e7);  // Rp1 M/hari
    const thin = bars(120, END, () => 100, () => 1e5);    // Rp10 jt/hari
    const scan = buildRadarScan([{ summary: summary('LIQD'), bars: liquid }, { summary: summary('THIN'), bars: thin }], AFTER_CLOSE);
    assert.deepEqual(radarTop(scan, false).map((r) => r.summary.ticker), ['LIQD']);
    assert.equal(radarTop(scan, true).length, 2);
  });

  test('old snapshot → STALE with no rows', () => {
    const old = bars(120, '2026-10-01', () => 100);
    const scan = buildRadarScan([{ summary: summary('AAAA'), bars: old }], AFTER_CLOSE);
    assert.equal(scan.state, 'STALE');
    assert.equal(scan.rows.length, 0);
  });
});
