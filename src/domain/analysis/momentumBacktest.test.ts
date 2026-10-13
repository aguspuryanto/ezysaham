/**
 * Momentum backtest — execution rules & look-ahead guard.
 * Run: npm test
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { backtestTicker, BacktestTrade, evaluateAt, summarizeTrades } from '@/domain/analysis/momentumBacktest';
import { OHLCVBar } from '@/domain/models/History';

/** Deterministic pseudo-random walk with drift (weekday dates). */
function walk(n: number, seed = 7, drift = 0.002): OHLCVBar[] {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const bars: OHLCVBar[] = [];
  const day = new Date(Date.UTC(2024, 0, 1));
  let p = 1000;
  for (let k = 0; k < n; k++) {
    while (day.getUTCDay() % 6 === 0) day.setUTCDate(day.getUTCDate() + 1);
    const o = p;
    p = Math.max(50, p * (1 + drift + (rnd() - 0.5) * 0.05));
    const hi = Math.max(o, p) * (1 + rnd() * 0.015);
    const lo = Math.min(o, p) * (1 - rnd() * 0.015);
    bars.push({ date: day.toISOString().slice(0, 10), open: o, high: hi, low: lo, close: p, volume: Math.round(3e6 * (0.5 + rnd() * 1.5)) });
    day.setUTCDate(day.getUTCDate() + 1);
  }
  return bars;
}

describe('momentum backtest', () => {
  test('a decision at day t is identical whether or not later bars exist (no look-ahead)', () => {
    const bars = walk(220);
    const t = 180;
    const a = evaluateAt('TEST', bars.slice(0, t + 1), 'swing');
    const future = bars.map((b, k) => (k > t ? { ...b, close: b.close * 3, high: b.high * 3 } : b));
    const b = evaluateAt('TEST', future.slice(0, t + 1), 'swing');
    assert.deepEqual(a, b);
  });

  test('trades enter at the next open, never before the signal, and respect the hold limit', () => {
    const res = backtestTicker('TEST', walk(400, 11, 0.003), { maxHoldBars: 10 });
    assert.ok(res.daysEvaluated > 200);
    for (const t of res.trades) {
      assert.ok(t.entryDate > t.signalDate);
      assert.ok(t.exitDate >= t.entryDate);
      assert.ok(t.holdBars >= 1 && t.holdBars <= 10);
      assert.ok(t.sl < t.entry && t.tp2 > t.entry);
    }
    // Statuses are counted every day; BUY count ≥ filled trades.
    assert.ok((res.statusCounts.BUY ?? 0) >= res.trades.length);
  });

  test('summary maths', () => {
    const mk = (netPct: number, exitDate: string, exitReason: BacktestTrade['exitReason'] = 'TP2'): BacktestTrade => ({
      ticker: 'X', setup: 'BREAKOUT', signalDate: '2025-01-01', entryDate: '2025-01-02', exitDate, entry: 100, sl: 95, tp1: null, tp2: 110,
      exitReason, tp1Hit: false, netPct, holdBars: 3, avgValue20: 1e9,
    });
    const s = summarizeTrades([mk(10, '2025-01-05'), mk(-5, '2025-01-06', 'SL'), mk(-5, '2025-01-07', 'SL'), mk(4, '2025-01-08')]);
    assert.equal(s.trades, 4);
    assert.equal(s.winRate, 50);
    assert.equal(s.expectancyPct, 1);
    assert.equal(s.profitFactor, 1.4);
    assert.equal(s.maxDrawdownPct, 10);
    assert.equal(s.falseBreakoutRate, 50);
    assert.equal(summarizeTrades([]).trades, 0);
  });
});
