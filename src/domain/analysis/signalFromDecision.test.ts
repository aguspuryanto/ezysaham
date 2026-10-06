/**
 * Parity: a SARA signal must carry exactly the stock detail page's Trading verdict (Decision Engine v3).
 * Regression for "BBRI: Signal = BUY, detail page = WAIT" — signals used to be hard-coded mock seeds.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { buildDecisionForStock } from '@/domain/analysis/decisionInput';
import { buildSignalFromDecision } from '@/domain/analysis/signalFromDecision';
import { OHLCVBar } from '@/domain/models/History';
import { StockSummary } from '@/domain/models/Stock';

function barsFrom(start: number, steps: Array<{ pct: number; vol?: number }>): OHLCVBar[] {
  let prev = start;
  return steps.map((s, idx) => {
    const open = prev;
    const close = prev * (1 + s.pct / 100);
    prev = close;
    return {
      date: `2026-01-${String(idx + 1).padStart(3, '0')}`,
      open, close, high: Math.max(open, close) * 1.002, low: Math.min(open, close) * 0.998, volume: s.vol ?? 50_000_000,
    };
  });
}
const zigzag = (n: number, up: number, down: number) => Array.from({ length: n }, (_, k) => ({ pct: k % 2 === 0 ? up : -down }));

function summaryFor(bars: OHLCVBar[]): StockSummary {
  const last = bars[bars.length - 1];
  const prev = bars[bars.length - 2];
  const chg = (k: number) => ((last.close / bars[bars.length - 1 - k].close) - 1) * 100;
  return {
    ticker: 'TEST', name: 'Test Tbk', sector: 'Keuangan', subSector: '',
    lastClose: last.close, prevClose: prev.close,
    percentChange1D: chg(1), percentChange1W: chg(5), percentChange1M: chg(21),
    percentChange3M: 0, percentChange6M: 0, percentChangeYtd: 0, percentChange1Y: 0, percentChange3Y: 0, percentChange5Y: 0, percentChange10Y: 0,
    high: last.high, low: last.low, volume: last.volume, value: last.close * last.volume, frequency: 10_000,
    capitalization: 400e12, per: 11, pbv: 2, roe: 18, freeFloat: 45, annualHigh: last.close * 1.25, annualLow: last.close * 0.7,
  };
}

const CASES: Array<[string, OHLCVBar[]]> = [
  ['uptrend', barsFrom(3000, [...zigzag(119, 1.2, 0.7), { pct: 1.2, vol: 56_000_000 }])],
  ['downtrend', barsFrom(5000, zigzag(120, 0.6, 1.2))],
  ['sideways', barsFrom(3000, Array.from({ length: 120 }, (_, k) => ({ pct: [0.8, -0.8, 0.5, -0.5][k % 4] })))],
  ['top gainer', barsFrom(3000, [...zigzag(116, 1.5, 0.6), { pct: 6 }, { pct: 9 }, { pct: 12, vol: 90_000_000 }, { pct: 20, vol: 220_000_000 }])],
];

describe('SARA signal = detail page Trading verdict', () => {
  for (const [name, bars] of CASES) {
    test(name, () => {
      const summary = summaryFor(bars);
      const detail = buildDecisionForStock({ summary, bars, fundamentals: null, vwap: null });
      const signal = buildSignalFromDecision({ summary, bars, fundamentals: null, vwap: null, date: '2026-10-06' });
      assert.equal(signal.action, detail.decisions.trading.status);
      assert.equal(signal.decision.buyAllowed, detail.decisions.trading.status === 'BUY');
      if (signal.action === 'AVOID') assert.equal(signal.tradePlan, null);
      if (signal.action === 'BUY') assert.ok(signal.tradePlan && signal.tradePlan.riskReward >= 1.5);
    });
  }
});
