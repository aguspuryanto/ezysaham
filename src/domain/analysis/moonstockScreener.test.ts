/**
 * Moonstock screener — rule tests (docs/features_moonstock.md).
 * Run: npm test
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { capSize, MoonstockStockInput, screenMoonstock } from '@/domain/analysis/moonstockScreener';
import { FundamentalDetail } from '@/domain/models/Fundamentals';
import { OHLCVBar } from '@/domain/models/History';
import { StockSummary } from '@/domain/models/Stock';

const NOW = new Date('2026-10-08T10:00:00Z');

/** Weekday dates ending 2026-10-07 (Wed). */
function weekdays(n: number, end = '2026-10-07'): string[] {
  const out: string[] = [];
  const d = new Date(`${end}T00:00:00Z`);
  while (out.length < n) {
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) out.unshift(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return out;
}

function barsFrom(start: number, steps: Array<{ pct: number; vol?: number }>, end?: string): OHLCVBar[] {
  const dates = weekdays(steps.length, end);
  let prev = start;
  return steps.map((s, k) => {
    const open = prev;
    const close = prev * (1 + s.pct / 100);
    prev = close;
    return { date: dates[k], open, close, high: Math.max(open, close) * 1.015, low: Math.min(open, close) * 0.985, volume: s.vol ?? 20_000_000 };
  });
}

function summary(ticker: string, over: Partial<StockSummary> = {}): StockSummary {
  return {
    ticker, name: `${ticker} Tbk`, sector: 'Industrials', subSector: '', lastClose: 1000, prevClose: 1000,
    percentChange1D: 0, percentChange1W: 0, percentChange1M: 0, percentChange3M: 0, percentChange6M: 0, percentChangeYtd: 0,
    percentChange1Y: 0, percentChange3Y: 0, percentChange5Y: 0, percentChange10Y: 0, high: 0, low: 0,
    volume: 20_000_000, value: 30e9, frequency: 0, capitalization: 20e12, per: 10, pbv: 1.5, roe: 22, freeFloat: 40,
    annualHigh: 0, annualLow: 0, ...over,
  };
}

function fundamentals(over: Partial<FundamentalDetail> = {}): FundamentalDetail {
  return {
    ticker: 'X', dividendYield: null, dividendPayoutRatio: null, dividendPerShareTtm: null, dividendHistory: null,
    debtToEquity: 40, currentRatio: 1.5, netMargin: 18, revenueGrowth: 22, earningsGrowth: 25, source: 'yahoo', fetchedAt: '', ...over,
  };
}

/** Uptrend zigzag with a rising close — clean swing structure. */
const uptrend = () => barsFrom(800, Array.from({ length: 200 }, (_, k) => ({ pct: k % 2 === 0 ? 1.1 : -0.7 })));
/** Downtrend. */
const downtrend = () => barsFrom(2000, Array.from({ length: 200 }, (_, k) => ({ pct: k % 2 === 0 ? 0.6 : -1.1 })));

describe('Moonstock screener', () => {
  test('cap size buckets', () => {
    assert.equal(capSize(15e12), 'L');
    assert.equal(capSize(2e12), 'M');
    assert.equal(capSize(5e11), 'S');
  });

  test('no data → EMPTY, never invented candidates', () => {
    const r = screenMoonstock('swing', [{ summary: summary('AAAA'), bars: [] }], NOW);
    assert.equal(r.state, 'EMPTY');
    assert.equal(r.rows.length, 0);
  });

  test('old snapshot → STALE, candidates hidden', () => {
    const bars = barsFrom(800, Array.from({ length: 200 }, (_, k) => ({ pct: k % 2 === 0 ? 1.1 : -0.7 })), '2026-09-21');
    const r = screenMoonstock('swing', [{ summary: summary('AAAA'), bars }], NOW);
    assert.equal(r.state, 'STALE');
    assert.equal(r.rows.length, 0);
  });

  test('downtrend never appears in swing', () => {
    const r = screenMoonstock('swing', [{ summary: summary('DOWN'), bars: downtrend() }], NOW);
    assert.equal(r.rows.length, 0);
    assert.equal(r.state, 'EMPTY');
  });

  test('stock whose bars end before the snapshot date is skipped as incompatible', () => {
    const late = uptrend();
    const early = barsFrom(800, Array.from({ length: 200 }, (_, k) => ({ pct: k % 2 === 0 ? 1.1 : -0.7 })), '2026-10-06');
    const r = screenMoonstock('swing', [{ summary: summary('LATE'), bars: late }, { summary: summary('EARL'), bars: early }], NOW);
    assert.equal(r.dataDate, '2026-10-07');
    assert.ok(r.incompatible >= 1);
    assert.ok(!r.rows.some((x) => x.ticker === 'EARL'));
  });

  test('intraday without a VWAP for the snapshot session → incompatible, not a candidate', () => {
    const bars = barsFrom(800, [...Array.from({ length: 80 }, (_, k) => ({ pct: k % 2 === 0 ? 1.1 : -0.7 })), { pct: 3, vol: 80_000_000 }]);
    const inputs: MoonstockStockInput[] = [
      { summary: summary('NOVW'), bars, vwap: null },
      { summary: summary('OLDV'), bars, vwap: { value: 900, sessionDate: '2026-10-06' } },
    ];
    const r = screenMoonstock('intraday', inputs, NOW);
    assert.equal(r.rows.length, 0);
    assert.equal(r.incompatible, 2);
  });

  test('small cap is excluded everywhere', () => {
    const r = screenMoonstock('swing', [{ summary: summary('SMOL', { capitalization: 3e11 }), bars: uptrend() }], NOW);
    assert.equal(r.rows.length, 0);
  });

  test('investing: quality growth stock passes; missing fundamentals → incompatible', () => {
    const bars = uptrend();
    const r = screenMoonstock('investing', [
      { summary: summary('GOOD', { value: 80e9 }), bars: bars.map((b) => ({ ...b, volume: 100_000_000 })), fundamentals: fundamentals() },
      { summary: summary('NOFD', { value: 80e9 }), bars: bars.map((b) => ({ ...b, volume: 100_000_000 })), fundamentals: null },
    ], NOW);
    assert.equal(r.incompatible, 1);
    const good = r.rows.find((x) => x.ticker === 'GOOD');
    assert.ok(good, r.stateNote);
    assert.equal(good!.mode, 'investing');
    if (good!.mode === 'investing') assert.equal(good!.cashFlow, null);
  });

  test('investing: shrinking profit fails the growth filter (no forced candidate)', () => {
    const bars = uptrend().map((b) => ({ ...b, volume: 100_000_000 }));
    const r = screenMoonstock('investing', [{ summary: summary('SHRK', { value: 80e9 }), bars, fundamentals: fundamentals({ earningsGrowth: -30 }) }], NOW);
    assert.ok(r.rows.every((x) => x.label === 'VALUE TRAP RISK'));
  });

  test('deterministic: same input → identical output', () => {
    const inputs: MoonstockStockInput[] = [
      { summary: summary('BBBB'), bars: uptrend() },
      { summary: summary('AAAA'), bars: uptrend() },
    ];
    const a = screenMoonstock('swing', inputs, NOW);
    const b = screenMoonstock('swing', inputs, NOW);
    assert.deepEqual(a, b);
    // Same label + same rank → ticker order.
    for (let k = 1; k < a.rows.length; k++) {
      const [p, c] = [a.rows[k - 1], a.rows[k]];
      if (p.label === c.label && p.rank === c.rank) assert.ok(p.ticker < c.ticker);
    }
  });

  test('swing rows always respect the hard filters', () => {
    const r = screenMoonstock('swing', [{ summary: summary('UPTR'), bars: uptrend() }], NOW);
    for (const row of r.rows) {
      if (row.mode !== 'swing') continue;
      assert.ok(row.rsi >= 50 && row.rsi <= 70);
      assert.ok(row.rvol >= 1.2);
      assert.ok(row.riskReward != null && row.riskReward >= 2);
    }
  });
});
