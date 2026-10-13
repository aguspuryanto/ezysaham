/**
 * Momentum setup primitives — unit tests (pivots, data quality, costs, each setup detector on its own).
 * Run: npm test
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  assessData,
  detectBreakout,
  detectConsolidation,
  detectPullback,
  detectRetest,
  IDX_COSTS,
  liquidityOf,
  netRiskReward,
  relVolume,
  SetupContext,
  swingPivots,
} from '@/domain/analysis/momentumSetups';
import { atr } from '@/domain/indicators/atr';
import { ema, lastValid } from '@/domain/indicators/movingAverages';
import { OHLCVBar } from '@/domain/models/History';

const bar = (date: string, o: number, h: number, l: number, c: number, v = 1_000_000): OHLCVBar => ({ date, open: o, high: h, low: l, close: c, volume: v });
const flat = (n: number, p = 1000, v = 1_000_000): OHLCVBar[] =>
  Array.from({ length: n }, (_, k) => bar(`2025-01-${String(k + 1).padStart(2, '0')}`, p, p * 1.01, p * 0.99, p, v));

function ctxOf(bars: OHLCVBar[], trendBullish = true): SetupContext {
  const closes = bars.map((b) => b.close);
  return {
    bars, atr: lastValid(atr(bars, 14)), ema9: lastValid(ema(closes, 9)), ema20: lastValid(ema(closes, 20)), ema50: lastValid(ema(closes, 50)), trendBullish,
  };
}

describe('swingPivots — no look-ahead', () => {
  const highs = [10, 11, 15, 12, 11, 13, 18, 14, 13, 12, 20];
  const bars = highs.map((h, k) => bar(`d${k}`, h - 1, h, h - 2, h - 0.5));

  test('a pivot needs k completed bars on its right; the last k bars are never pivots', () => {
    const { highs: ph } = swingPivots(bars, 2);
    assert.deepEqual(ph.map((p) => p.index), [2, 6]);
    assert.ok(ph.every((p) => p.index < bars.length - 2));
  });

  test('pivots known at bar t never change when future bars are appended', () => {
    for (let t = 5; t <= bars.length; t++) {
      const early = swingPivots(bars.slice(0, t), 2).highs;
      const late = swingPivots(bars, 2).highs.filter((p) => p.index < t - 2);
      assert.deepEqual(early, late, `t=${t}`);
    }
  });
});

describe('assessData', () => {
  test('insufficient bars → not usable', () => {
    const d = assessData(flat(20), 50);
    assert.equal(d.usable, false);
    assert.equal(d.status, 'INSUFFICIENT');
  });

  test('today before 16:15 WIB → PROVISIONAL; after → OK', () => {
    const bars = flat(60);
    bars[bars.length - 1].date = '2026-10-12';
    assert.equal(assessData(bars, 50, new Date('2026-10-12T03:00:00Z')).status, 'PROVISIONAL'); // 10:00 WIB
    assert.equal(assessData(bars, 50, new Date('2026-10-12T09:30:00Z')).status, 'OK'); // 16:30 WIB
  });

  test('≥ 3 weekdays old → STALE; Friday bar read on Monday → OK', () => {
    const bars = flat(60);
    bars[bars.length - 1].date = '2026-10-09'; // Friday
    assert.equal(assessData(bars, 50, new Date('2026-10-12T10:00:00Z')).status, 'OK');
    assert.equal(assessData(bars, 50, new Date('2026-10-16T10:00:00Z')).status, 'STALE');
  });

  test('≥ 5 zero-volume sessions in 20 → SUSPECT (suspension pattern)', () => {
    const bars = flat(60);
    for (let k = 1; k <= 5; k++) bars[bars.length - 1 - k].volume = 0;
    const d = assessData(bars, 50);
    assert.equal(d.status, 'SUSPECT');
    assert.equal(d.gateOk, false);
  });
});

describe('liquidity, RVOL & costs', () => {
  test('average traded value of the last 20 sessions', () => {
    assert.equal(liquidityOf(flat(30, 1000, 2_000_000)).avgValue20, 2e9);
  });

  test('RVOL uses the PRIOR 20 sessions as baseline', () => {
    const bars = flat(30, 1000, 1_000_000);
    bars[bars.length - 1].volume = 3_000_000;
    assert.equal(relVolume(bars), 3);
  });

  test('net R:R is lower than gross and slippage is at least one tick', () => {
    // Rp 100 stock: tick Rp 1 = 1% slippage per side dominates the 0,1% default.
    const gross = (110 - 100) / (100 - 95);
    const net = netRiskReward(100, 95, 110, IDX_COSTS);
    assert.ok(net.rr! < gross);
    assert.ok(net.rr! < 1.5, `tick slippage must bite on cheap stocks, got ${net.rr}`);
    const zero = netRiskReward(1000, 950, 1100, { buyFeePct: 0, sellFeePct: 0, slippagePct: 0 });
    // Even with zero % costs, one Rp 5 tick of slippage applies on each side.
    assert.ok(Math.abs(zero.rr! - (1095 - 1005) / (1005 - 945)) < 1e-9);
  });
});

describe('setup detectors', () => {
  // 40 flat sessions in a 990–1010 range, then the bar under test.
  const base = () => flat(40);

  test('breakout: close above the 20-session high on volume → TRIGGERED', () => {
    const bars = [...base(), bar('x', 1005, 1035, 1003, 1030, 3_000_000)];
    const s = detectBreakout(ctxOf(bars));
    assert.equal(s.state, 'TRIGGERED');
    assert.equal(s.level, 1010);
    assert.equal(s.structuralLow, 1010);
  });

  test('breakout without volume → INVALID; far above the zone → PRESENT (wait retest)', () => {
    assert.equal(detectBreakout(ctxOf([...base(), bar('x', 1005, 1035, 1003, 1030, 1_000_000)])).state, 'INVALID');
    assert.equal(detectBreakout(ctxOf([...base(), bar('x', 1005, 1120, 1003, 1115, 3_000_000)])).state, 'PRESENT');
  });

  test('breakout pending: just under the level', () => {
    const s = detectBreakout(ctxOf([...base(), bar('x', 1000, 1008, 998, 1005)]));
    assert.equal(s.state, 'PENDING');
    assert.equal(s.triggerPrice, 1010);
  });

  test('retest: volume breakout, pull back to the level, green candle holds → TRIGGERED', () => {
    const bars = [
      ...base(),
      bar('b', 1005, 1045, 1003, 1040, 3_000_000),
      bar('r1', 1040, 1042, 1015, 1020),
      bar('r2', 1020, 1025, 1008, 1012),
      bar('r3', 1012, 1030, 1010, 1028),
    ];
    const s = detectRetest(ctxOf(bars));
    assert.equal(s.state, 'TRIGGERED', s.reason);
    assert.equal(s.level, 1010);
  });

  test('retest: close back under the level → INVALID (false breakout)', () => {
    const bars = [...base(), bar('b', 1005, 1045, 1003, 1040, 3_000_000), bar('f', 1035, 1036, 960, 965, 2_000_000)];
    assert.equal(detectRetest(ctxOf(bars)).state, 'INVALID');
  });

  test('pullback: needs a bullish trend; dip into the EMA zone on light volume + bounce → TRIGGERED', () => {
    // Steady uptrend, 3 light-volume red bars into EMA 20, then a green bounce.
    const up: OHLCVBar[] = [];
    let p = 1000;
    for (let k = 0; k < 60; k++) { const o = p; p *= k % 2 === 0 ? 1.02 : 0.992; up.push(bar(`u${k}`, o, Math.max(o, p) * 1.005, Math.min(o, p) * 0.995, p)); }
    for (let k = 0; k < 4; k++) { const o = p; p *= 0.985; up.push(bar(`d${k}`, o, o * 1.002, p * 0.995, p, 600_000)); }
    const o = p; p *= 1.015;
    up.push(bar('bounce', o, p * 1.002, o * 0.998, p));
    assert.equal(detectPullback(ctxOf(up, false)).state, 'ABSENT');
    const s = detectPullback(ctxOf(up, true));
    assert.equal(s.state, 'TRIGGERED', s.reason);
    assert.ok(s.structuralLow! < p);
  });

  test('consolidation: tight range → PENDING with range-high trigger; wide range → ABSENT', () => {
    const tight = detectConsolidation(ctxOf([...base(), bar('x', 1000, 1006, 995, 1002)]));
    assert.equal(tight.state, 'PENDING');
    assert.equal(tight.triggerPrice, 1010);
    // A 3%-a-day run is not a range: width ≫ max(10%, 3 × ATR%). (Width is judged relative to volatility.)
    const run = [...flat(30)];
    let p = 1000;
    for (let k = 0; k < 11; k++) { const o = p; p *= 1.03; run.push(bar(`r${k}`, o, p * 1.003, o * 0.997, p)); }
    assert.equal(detectConsolidation(ctxOf(run)).state, 'ABSENT');
  });
});
