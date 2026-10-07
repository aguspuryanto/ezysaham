/**
 * Momentum Trade Engine — scenario tests (docs/features_momentum_engine.md).
 * Run: npm test
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { MomentumInput } from '@/domain/analysis/momentumSpeculation';
import { buildMomentumTrade } from '@/domain/analysis/momentumTradeEngine';
import { atr } from '@/domain/indicators/atr';
import { macd } from '@/domain/indicators/macd';
import { ema, lastValid } from '@/domain/indicators/movingAverages';
import { rsi } from '@/domain/indicators/rsi';
import { volumeMA } from '@/domain/indicators/volume';
import { OHLCVBar } from '@/domain/models/History';

type Step = { pct: number; vol?: number; wick?: number };

/** Daily bars from % steps; `wick` = high/low wick as % of price (volatility). */
function barsFrom(start: number, steps: Step[], baseVol = 5_000_000): OHLCVBar[] {
  const bars: OHLCVBar[] = [];
  let prev = start;
  steps.forEach((s, idx) => {
    const open = prev;
    const close = prev * (1 + s.pct / 100);
    const w = (s.wick ?? 1.5) / 100;
    bars.push({ date: `d${idx}`, open, close, high: Math.max(open, close) * (1 + w), low: Math.min(open, close) * (1 - w), volume: s.vol ?? baseVol });
    prev = close;
  });
  return bars;
}

const zigzag = (n: number, up: number, down: number, extra: Partial<Step> = {}): Step[] =>
  Array.from({ length: n }, (_, k) => ({ pct: k % 2 === 0 ? up : -down, ...extra }));

function inputFrom(bars: OHLCVBar[], over: Partial<MomentumInput> = {}): MomentumInput {
  const closes = bars.map((b) => b.close);
  const last = bars[bars.length - 1];
  const at = (k: number) => bars[bars.length - 1 - k]?.close;
  const chg = (k: number) => (at(k) ? (last.close / at(k)! - 1) * 100 : null);
  const volMa20 = volumeMA(bars, 20);
  return {
    bars,
    price: last.close,
    change1D: chg(1), change1W: chg(5), change1M: chg(21),
    annualHigh: null,
    ema9: lastValid(ema(closes, 9)),
    ema20: lastValid(ema(closes, 20)),
    ema50: lastValid(ema(closes, 50)),
    vwap: null,
    rvol: last.volume / volMa20,
    volumeMa20: volMa20,
    rsi14: lastValid(rsi(bars, 14)),
    macdHistogram: lastValid(macd(bars).histogram),
    atr14: lastValid(atr(bars, 14)),
    tradedValue: last.close * last.volume,
    capitalization: null, freeFloat: null,
    per: null, pbv: null, roe: null, revenueGrowth: null, earningsGrowth: null, debtToEquity: null, currentRatio: null, netMargin: null,
    isFinancial: false,
    healthVerdict: 'DATA_KURANG', valuationVerdict: 'TIDAK_DAPAT_DINILAI',
    fairValue: null, accumulationLow: null, accumulationHigh: null,
    supports: [],
    resistances: [],
    ...over,
  };
}

/** Uptrend, a ~20%-deep base under the high, then a volume breakout bar (measured move ≈ +20%). */
function breakoutBars(breakoutVol: number): OHLCVBar[] {
  const base: Step[] = [
    ...Array.from({ length: 6 }, () => ({ pct: -3.6, wick: 1.5 })),
    ...Array.from({ length: 14 }, (_, k) => ({ pct: k % 2 === 0 ? 3.6 : -0.6, wick: 1.5 })),
  ];
  return barsFrom(800, [...zigzag(60, 2.5, 1.5, { wick: 1.5 }), ...base, { pct: 3.5, vol: breakoutVol, wick: 0.3 }]);
}

describe('Momentum Trade Engine', () => {
  test('insufficient data → N/A', () => {
    const r = buildMomentumTrade(inputFrom(barsFrom(1000, zigzag(30, 1, 0.5))));
    assert.equal(r.status, 'N/A');
    assert.equal(r.entryLow, null);
    assert.equal(r.tp2, null);
  });

  test('valid breakout, blue sky, ATR supports 20% → MOMENTUM BUY with TP2 ≥ 20%', () => {
    const r = buildMomentumTrade(inputFrom(breakoutBars(12_000_000)));
    assert.equal(r.setup, 'BREAKOUT', JSON.stringify(r.checks.structure));
    assert.equal(r.status, 'MOMENTUM BUY', r.reasons.join(' | '));
    assert.ok(r.tp2 && r.tp2.pct >= 20);
    assert.ok(r.target20Realistic);
    assert.ok(r.riskReward != null && r.riskReward >= 2);
    assert.ok(r.sl != null && r.sl < r.entryLow!);
    assert.equal(r.riskGate.length, 6);
    assert.ok(r.riskGate.every((g) => g.pass), JSON.stringify(r.riskGate));
    assert.equal(r.conditional, false);
  });

  test('resistance only +10% away → not BUY (WAIT BREAKOUT / NO TRADE)', () => {
    const bars = breakoutBars(12_000_000);
    const price = bars[bars.length - 1].close;
    const r = buildMomentumTrade(inputFrom(bars, { resistances: [price * 1.1, price * 1.35] }));
    assert.ok(r.status === 'WAIT BREAKOUT' || r.status === 'NO TRADE', r.status);
    assert.ok(r.conditional);
    assert.ok(r.riskGate.some((g) => !g.pass));
  });

  test('breakout without volume → not a valid breakout', () => {
    const r = buildMomentumTrade(inputFrom(breakoutBars(4_000_000)));
    assert.notEqual(r.setup, 'BREAKOUT');
    assert.notEqual(r.status, 'MOMENTUM BUY');
  });

  test('low volatility → TP2 not forced to +20%', () => {
    const base: Step[] = Array.from({ length: 20 }, (_, k) => ({ pct: [0.4, -0.4, 0.3, -0.3][k % 4], wick: 0.3 }));
    const bars = barsFrom(800, [...zigzag(60, 0.8, 0.5, { wick: 0.3 }), ...base, { pct: 1.5, vol: 12_000_000, wick: 0.1 }]);
    const r = buildMomentumTrade(inputFrom(bars));
    assert.equal(r.status, 'NO TRADE');
    assert.equal(r.target20Realistic, false);
    assert.equal(r.riskGate.find((g) => g.key === 'potential')?.pass, false);
  });

  test('RSI > 70 alone is not AVOID', () => {
    const r = buildMomentumTrade(inputFrom(breakoutBars(12_000_000)));
    assert.ok(r.metrics.rsi14! > 60);
    assert.ok(!r.status.startsWith('AVOID'));
  });

  test('resistance +10% with no next resistance & small base → NO TRADE (upside gate)', () => {
    const bars = breakoutBars(12_000_000);
    const price = bars[bars.length - 1].close;
    const r = buildMomentumTrade(inputFrom(bars, { resistances: [price * 1.1] }));
    assert.notEqual(r.status, 'MOMENTUM BUY');
    assert.equal(r.riskGate.find((g) => g.key === 'upside')?.pass, r.status === 'WAIT BREAKOUT');
  });

  test('parabolic run → AVOID, never BUY', () => {
    const bars = barsFrom(1000, [...zigzag(60, 1.5, 0.8), ...Array.from({ length: 6 }, () => ({ pct: 9, vol: 15_000_000 }))]);
    const r = buildMomentumTrade(inputFrom(bars));
    assert.equal(r.structure, 'EXTENDED');
    assert.ok(r.status === 'AVOID CHASING' || r.status === 'AVOID REVERSAL', r.status);
    assert.equal(r.entryLow, null);
  });

  test('downtrend → AVOID REVERSAL with no plan', () => {
    const bars = barsFrom(2000, zigzag(80, 0.7, 1.3));
    const r = buildMomentumTrade(inputFrom(bars));
    assert.equal(r.status, 'AVOID REVERSAL');
    assert.equal(r.entryLow, null);
    assert.equal(r.tp1, null);
    assert.equal(r.riskGate.find((g) => g.key === 'distribution')?.pass, false);
  });
});
