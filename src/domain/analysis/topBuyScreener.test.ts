/**
 * Top BUY screener — funnel, snapshot and ranking tests (docs/features_topbuy.md).
 * Run: npm test
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { buildTopBuyScan, rankTopBuy, TopBuyRow, topBuyPrefilter, topBuySnapshot } from '@/domain/analysis/topBuyScreener';
import { OHLCVBar } from '@/domain/models/History';
import { SignalAction, StockSignal } from '@/domain/models/Signal';
import { StockSummary } from '@/domain/models/Stock';

const NOW = new Date('2026-10-15T03:00:00Z');

function summary(ticker: string, o: Partial<StockSummary> = {}): StockSummary {
  return {
    ticker, name: ticker, sector: '', subSector: '', lastClose: 1000, prevClose: 980,
    percentChange1D: 2, percentChange1W: 4, percentChange1M: 0, percentChange3M: 0, percentChange6M: 0, percentChangeYtd: 0,
    percentChange1Y: 0, percentChange3Y: 0, percentChange5Y: 0, percentChange10Y: 0,
    high: 1000, low: 970, volume: 5e6, value: 5e9, frequency: 0, capitalization: 0,
    per: 10, pbv: 1.5, roe: 12, freeFloat: 30, annualHigh: 1200, annualLow: 800, ...o,
  };
}

const bar = (date: string): OHLCVBar => ({ date, open: 1, high: 1, low: 1, close: 1, volume: 1 });

function row(ticker: string, action: SignalAction, saraScore: number, rulesPct: number): TopBuyRow {
  const signal = { id: ticker, ticker, action, saraScore } as StockSignal;
  return { signal, summary: summary(ticker), rulesPct };
}

describe('Top BUY — tahap 1', () => {
  test('each filter drops exactly its failing stock and the funnel counts survivors', () => {
    const list = [
      summary('AAAA'),
      summary('BBBB', { percentChange1W: -1 }),
      summary('CCCC', { value: 9e8 }),
      summary('DDDD', { per: 31 }),
      summary('EEEE', { pbv: 0 }),
      summary('FFFF', { freeFloat: 9 }),
      summary('GGGG', { lastClose: 0 }),
    ];
    const { funnel, candidates } = topBuyPrefilter(list);
    assert.deepEqual(candidates.map((s) => s.ticker), ['AAAA']);
    assert.deepEqual(funnel.map((f) => f.remaining), [6, 5, 4, 3, 2, 1]);
  });
});

describe('Top BUY — snapshot', () => {
  test('drops tickers whose bars do not end on the latest date', () => {
    const inputs = [
      { summary: summary('AAAA'), bars: [bar('2026-10-13'), bar('2026-10-14')] },
      { summary: summary('BBBB'), bars: [bar('2026-10-12'), bar('2026-10-13')] },
    ];
    const snap = topBuySnapshot(inputs, NOW);
    assert.equal(snap.dataDate, '2026-10-14');
    assert.equal(snap.stale, false);
    assert.deepEqual(snap.current.map((x) => x.summary.ticker), ['AAAA']);
  });

  test('old snapshot is STALE and shows no rows', () => {
    const snap = topBuySnapshot([{ summary: summary('AAAA'), bars: [bar('2026-08-03'), bar('2026-08-04')] }], NOW);
    assert.equal(snap.stale, true);
    const scan = buildTopBuyScan([], snap.dataDate, snap.stale, [row('AAAA', 'BUY', 70, 100)]);
    assert.equal(scan.state, 'STALE');
    assert.equal(scan.rows.BUY.length, 0);
  });
});

describe('Top BUY — ranking', () => {
  test('BUY by SARA, WAIT by rules passed then SARA', () => {
    const r = rankTopBuy([
      row('W1', 'WAIT', 70, 70), row('W2', 'WAIT', 56, 90), row('W3', 'WAIT', 71, 90),
      row('B1', 'BUY', 60, 100), row('B2', 'BUY', 71, 100), row('A1', 'AVOID', 40, 50),
    ]);
    assert.deepEqual(r.BUY.map((x) => x.signal.ticker), ['B2', 'B1']);
    assert.deepEqual(r.WAIT.map((x) => x.signal.ticker), ['W3', 'W2', 'W1']);
    assert.deepEqual(r.AVOID.map((x) => x.signal.ticker), ['A1']);
  });
});
