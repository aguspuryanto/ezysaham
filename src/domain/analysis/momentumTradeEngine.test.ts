/**
 * Momentum Trade Engine — scenario tests (docs/features_momentum_engine.md).
 * Synthetic OHLCV only; the regression check on real BIKE/TFCO/ZONE/IFSH/MINE history lives in the docs.
 * Run: npm test
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { buildMomentumTrade, MOMENTUM_MODES, MomentumTradeReport } from '@/domain/analysis/momentumTradeEngine';
import { barsFrom, inputFrom, Step, zigzag } from '@/domain/analysis/momentumTestFixtures';
import { OHLCVBar } from '@/domain/models/History';

const lastClose = (bars: OHLCVBar[]) => bars[bars.length - 1].close;
const gate = (r: MomentumTradeReport, key: string) => r.riskGate.find((g) => g.key === key)!;

/** Uptrend, a ~20%-deep base under the high, then a volume breakout bar (measured move ≈ +20%). */
function breakoutBars(breakoutVol: number): OHLCVBar[] {
  const base: Step[] = [
    ...Array.from({ length: 6 }, () => ({ pct: -3.6, wick: 1.5 })),
    ...Array.from({ length: 14 }, (_, k) => ({ pct: k % 2 === 0 ? 3.6 : -0.6, wick: 1.5 })),
  ];
  return barsFrom(800, [...zigzag(60, 2.5, 1.5, { wick: 1.5 }), ...base, { pct: 3.5, vol: breakoutVol, wick: 0.3 }]);
}

/** Uptrend, tight 20-session base, then (optionally) the last bar. */
const tightBase: Step[] = Array.from({ length: 20 }, (_, k) => ({ pct: [1.2, -1.0, 0.8, -1.1][k % 4], wick: 0.8 }));
const swingBars = (...tail: Step[]) => barsFrom(1000, [...zigzag(60, 1.6, 1.0, { wick: 0.8 }), ...tightBase, ...tail]);
/** Volume breakout ~0,4% above the base high. */
const swingBreakout = () => swingBars({ pct: 3.0, vol: 15_000_000, wick: 0.2 });

/** FINAL GATE PASS ⇔ BUY with a full plan; anything else → every trading parameter is N/A. */
function assertGateConsistency(r: MomentumTradeReport) {
  const params = [r.entryLow, r.entryHigh, r.entryRef, r.sl, r.tp1, r.tp2, r.potentialPct, r.riskReward, r.riskRewardNet, r.riskPct];
  if (r.finalGate === 'PASS') {
    assert.equal(r.status, 'BUY');
    assert.ok(r.riskGate.every((g) => g.pass && g.state === 'PASS'));
    assert.ok(r.entryLow != null && r.sl != null && r.tp2 != null && r.potentialPct != null && r.riskReward != null);
    assert.ok(r.sl! < r.entryLow!, 'SL below entry');
    assert.ok(r.tp2!.price > r.entryHigh!, 'TP2 above entry');
  } else {
    assert.notEqual(r.status, 'BUY');
    assert.ok(r.riskGate.length === 0 || r.riskGate.some((g) => !g.pass), 'BLOCKED needs a failing gate');
    for (const v of params) assert.equal(v, null, `${r.status}: trading parameter must be N/A when BLOCKED`);
  }
  // Every gate's boolean matches its state.
  for (const g of r.riskGate) assert.equal(g.pass, g.state === 'PASS');
}

describe('Momentum Trade Engine — modes', () => {
  test('modes are explicit: swing does not require +20%, momentum20 keeps it; both keep R:R ≥ 1:2', () => {
    assert.equal(MOMENTUM_MODES.swing.minRewardPct, 5);
    assert.equal(MOMENTUM_MODES.momentum20.minRewardPct, 20);
    assert.equal(MOMENTUM_MODES.swing.minRR, 2);
    assert.equal(MOMENTUM_MODES.momentum20.minRR, 2);
  });

  test('the same +10% breakout: BUY in swing, blocked in momentum20 (potential / upside < 20%)', () => {
    const bars = swingBreakout();
    const inp = inputFrom(bars, { resistances: [lastClose(bars) * 1.1] });
    const swing = buildMomentumTrade(inp);
    assert.equal(swing.mode, 'swing');
    assert.equal(swing.status, 'BUY', swing.reasons.join(' | '));
    assertGateConsistency(swing);
    const m20 = buildMomentumTrade(inp, { mode: 'momentum20' });
    assert.notEqual(m20.status, 'BUY');
    assert.equal(gate(m20, 'potential').pass, false);
    assert.equal(gate(m20, 'upside').pass, false);
    assertGateConsistency(m20);
  });

  test('a stricter R:R override is honoured', () => {
    const bars = swingBreakout();
    const r = buildMomentumTrade(inputFrom(bars, { resistances: [lastClose(bars) * 1.1] }), { config: { minRR: 50 } });
    assert.notEqual(r.status, 'BUY');
    assert.equal(gate(r, 'rr').pass, false);
  });
});

describe('Momentum Trade Engine — swing scenarios', () => {
  test('1. strong but extended trend (BIKE-like) → AVOID CHASING, never BUY, objective re-evaluation', () => {
    const bars = barsFrom(1000, [...zigzag(60, 1.5, 0.8), ...Array.from({ length: 6 }, () => ({ pct: 9, vol: 15_000_000 }))]);
    const r = buildMomentumTrade(inputFrom(bars));
    assert.equal(r.structure, 'EXTENDED');
    assert.equal(r.status, 'AVOID CHASING');
    assert.equal(gate(r, 'chase').pass, false);
    assert.equal(gate(r, 'trigger').pass, false);
    assert.match(r.reEvaluation, /pullback ke zona EMA 9–20/);
    assert.ok(r.metrics.distEma20Atr! > 3.5);
    assertGateConsistency(r);
  });

  test('2. valid breakout with volume confirmation + room to resistance → BUY with structural SL', () => {
    const bars = swingBreakout();
    const r = buildMomentumTrade(inputFrom(bars, { resistances: [lastClose(bars) * 1.1] }));
    assert.equal(r.setup, 'BREAKOUT');
    assert.equal(r.status, 'BUY', JSON.stringify(r.riskGate));
    assert.ok(r.riskRewardNet! >= 2 && r.riskRewardNet! < r.riskReward!, 'net R:R pays costs');
    assert.ok(r.potentialPct! >= 5 && r.potentialPct! <= 15);
    assert.match(r.slBasis!, /level breakout/);
    assertGateConsistency(r);
  });

  test('2b. breakout without volume → not a valid breakout, not BUY', () => {
    const r = buildMomentumTrade(inputFrom(breakoutBars(4_000_000)));
    assert.notEqual(r.setup, 'BREAKOUT');
    assert.equal(r.setups.find((s) => s.type === 'BREAKOUT')!.state, 'INVALID');
    assert.notEqual(r.status, 'BUY');
    assertGateConsistency(r);
  });

  test('3. false breakout + rejection (ZONE-like) → failed-breakout flag, never BUY', () => {
    const bars = swingBars(
      { pct: 3.0, vol: 15_000_000, wick: 0.2 },
      { pct: -2, vol: 8_000_000, wick: 0.5 },
      // Spike to the high then close back under the level: long upper wick on volume.
      { pct: -2.5, open: 1.5, vol: 9_000_000, wick: 0.3 },
    );
    bars[bars.length - 1].high = bars[bars.length - 1].open * 1.06;
    const r = buildMomentumTrade(inputFrom(bars));
    assert.equal(r.setups.find((s) => s.type === 'RETEST')!.state, 'INVALID');
    assert.ok(r.distributionFlags.some((f) => f.key === 'failedBreakout'));
    assert.ok(r.distributionFlags.some((f) => f.key === 'rejection'));
    assert.notEqual(r.status, 'BUY');
    assertGateConsistency(r);
  });

  test('4. healthy trend without a trigger (MINE-like) → WAIT BREAKOUT, trigger price shown, no plan', () => {
    const bars = barsFrom(1000, [...zigzag(60, 2.0, 0.8, { wick: 0.8 }), { pct: -0.4, wick: 0.3 }]);
    const r = buildMomentumTrade(inputFrom(bars, { resistances: [lastClose(bars) * 1.12] }));
    assert.equal(r.structure, 'HEALTHY');
    assert.equal(r.status, 'WAIT BREAKOUT', r.reasons.join(' | '));
    assert.equal(r.setupType, 'BREAKOUT');
    assert.equal(gate(r, 'trigger').pass, false);
    assert.match(r.reEvaluation, /CLOSE di atas Rp/);
    assert.match(r.entryCondition, /^Belum ada entry/);
    assertGateConsistency(r);
  });

  test('5. confirmed pullback to EMA 9–20 on light volume → BUY', () => {
    const bars = swingBars({ pct: 0.3, wick: 0.5 });
    const r = buildMomentumTrade(inputFrom(bars, { resistances: [lastClose(bars) * 1.12] }));
    assert.equal(r.setup, 'PULLBACK');
    assert.equal(r.status, 'BUY', JSON.stringify(r.riskGate));
    assert.match(r.slBasis!, /swing low pullback/);
    assertGateConsistency(r);
  });

  test('6. structural SL too far → Valid SL FAIL, WATCHLIST (SL is never tightened to pass)', () => {
    const bars = swingBreakout();
    const r = buildMomentumTrade(inputFrom(bars, { resistances: [lastClose(bars) * 1.1] }), { config: { maxSlPct: 1 } });
    assert.equal(gate(r, 'slPct').state, 'FAIL');
    assert.match(gate(r, 'slPct').detail, /> 1,0%/);
    assert.equal(r.status, 'WATCHLIST');
    assert.match(r.reEvaluation, /SL struktural ≤ 1%/);
    assertGateConsistency(r);
  });

  test('7. R:R below 1:2 (resistance only +4%) → BUY blocked', () => {
    const bars = swingBreakout();
    const r = buildMomentumTrade(inputFrom(bars, { resistances: [lastClose(bars) * 1.04] }));
    assert.notEqual(r.status, 'BUY');
    assert.ok(!gate(r, 'rr').pass || !gate(r, 'potential').pass);
    assertGateConsistency(r);
  });

  test('8a. insufficient history → NO TRADE, final gate N/A', () => {
    const r = buildMomentumTrade(inputFrom(barsFrom(1000, zigzag(30, 1, 0.5))));
    assert.equal(r.status, 'NO TRADE');
    assert.equal(r.finalGate, 'N/A');
    assert.equal(r.dataOk, false);
    assertGateConsistency(r);
  });

  test('8b. stale data → NO TRADE even on a valid breakout', () => {
    const bars = swingBreakout();
    const r = buildMomentumTrade(inputFrom(bars, { resistances: [lastClose(bars) * 1.1] }), { asOf: new Date('2025-08-29T10:00:00Z') });
    assert.equal(r.data.status, 'STALE');
    assert.equal(r.status, 'NO TRADE');
    assert.equal(gate(r, 'data').pass, false);
    assertGateConsistency(r);
  });

  test('8c. candle not closed yet (11:00 WIB) → no BUY; the setup waits for the close', () => {
    const bars = swingBreakout();
    const day = bars[bars.length - 1].date;
    const r = buildMomentumTrade(inputFrom(bars, { resistances: [lastClose(bars) * 1.1] }), { asOf: new Date(`${day}T04:00:00Z`) });
    assert.equal(r.data.lastBarClosed, false);
    assert.equal(r.status, 'WAIT BREAKOUT');
    assert.equal(gate(r, 'trigger').pass, false);
    // Same data after the close (17:00 WIB) → the breakout is final.
    const closed = buildMomentumTrade(inputFrom(bars, { resistances: [lastClose(bars) * 1.1] }), { asOf: new Date(`${day}T10:00:00Z`) });
    assert.equal(closed.status, 'BUY');
  });

  test('9a. suspension pattern (zero-volume sessions) → data gate FAIL, never BUY', () => {
    const bars = swingBreakout();
    for (let k = 2; k <= 7; k++) bars[bars.length - k].volume = 0;
    const r = buildMomentumTrade(inputFrom(bars, { resistances: [lastClose(bars) * 1.1] }));
    assert.equal(r.data.status, 'SUSPECT');
    assert.equal(gate(r, 'data').pass, false);
    assert.notEqual(r.status, 'BUY');
    assertGateConsistency(r);
  });

  test('9b. illiquid stock (avg value < Rp 1 M) → liquidity FAIL, never BUY', () => {
    const bars = swingBreakout().map((b) => ({ ...b, volume: b.volume / 100 }));
    const r = buildMomentumTrade(inputFrom(bars, { resistances: [lastClose(bars) * 1.1] }));
    assert.equal(gate(r, 'liquidity').pass, false);
    assert.equal(r.status, 'NO TRADE');
    assertGateConsistency(r);
  });

  test('9c. gap up far above EMA → extended / gap warning, not BUY', () => {
    const bars = swingBars({ pct: 14, open: 12, vol: 20_000_000, wick: 0.3 });
    const r = buildMomentumTrade(inputFrom(bars));
    assert.notEqual(r.status, 'BUY');
    assert.ok(r.riskWarnings.some((w) => /Gap up/.test(w)));
    assertGateConsistency(r);
  });

  test('10. no look-ahead: the verdict at bar t ignores everything after t', () => {
    const full = swingBars({ pct: 3.0, vol: 15_000_000, wick: 0.2 }, { pct: -6, vol: 30_000_000 }, { pct: -6 });
    const t = full.length - 2; // the breakout bar
    const res = { resistances: [full[t - 1].close * 1.1] };
    const a = buildMomentumTrade(inputFrom(full.slice(0, t), res));
    const mutated = full.map((b, k) => (k >= t ? { ...b, close: b.close * 0.5, low: b.low * 0.5 } : b));
    const b = buildMomentumTrade(inputFrom(mutated.slice(0, t), res));
    assert.deepEqual(a, b);
  });
});

describe('Momentum Trade Engine — invariants', () => {
  test('RSI > 70 alone is not AVOID', () => {
    const r = buildMomentumTrade(inputFrom(breakoutBars(12_000_000)));
    assert.ok(r.metrics.rsi14! > 60);
    assert.notEqual(r.status, 'AVOID CHASING');
  });

  test('downtrend → NO TRADE with no plan and no candidate', () => {
    const r = buildMomentumTrade(inputFrom(barsFrom(2000, zigzag(80, 0.7, 1.3))));
    assert.equal(r.status, 'NO TRADE');
    assert.equal(gate(r, 'distribution').pass, false);
    assert.equal(r.candidateSetup, null);
    if (r.structure !== 'DISTRIBUTION') assert.equal(r.structure, 'DOWNTREND');
    assertGateConsistency(r);
  });

  test('structure label agrees with the status driver (EXTENDED ⇔ chase gate FAIL)', () => {
    for (const bars of [swingBreakout(), breakoutBars(12_000_000), barsFrom(1000, [...zigzag(60, 1.5, 0.8), ...Array.from({ length: 6 }, () => ({ pct: 9 }))])]) {
      const r = buildMomentumTrade(inputFrom(bars));
      assert.equal(r.structure === 'EXTENDED', !gate(r, 'chase').pass, `${r.structure} vs chase gate`);
      if (r.status === 'AVOID CHASING') assert.equal(r.structure, 'EXTENDED');
    }
  });

  test('order prices are valid IDX ticks', () => {
    const bars = swingBreakout();
    const r = buildMomentumTrade(inputFrom(bars, { resistances: [lastClose(bars) * 1.1] }));
    for (const v of [r.entryLow, r.entryHigh, r.sl, r.tp1?.price, r.tp2?.price].filter((x): x is number => x != null)) {
      assert.equal(v % 5, 0, `${v} on the Rp 5 tick (price 500–2.000)`);
    }
  });
});

describe('Momentum Trade Engine — momentum20 mode (Moonstock)', () => {
  const m20 = { mode: 'momentum20' as const };

  test('valid breakout, blue sky, ATR supports 20% → BUY with TP2 ≥ 20%', () => {
    const r = buildMomentumTrade(inputFrom(breakoutBars(12_000_000)), m20);
    assert.equal(r.setup, 'BREAKOUT', JSON.stringify(r.checks.structure));
    assert.equal(r.status, 'BUY', JSON.stringify(r.riskGate));
    assert.ok(r.tp2 && r.tp2.pct >= 20);
    assert.ok(r.target20Realistic);
    assert.ok(r.riskRewardNet != null && r.riskRewardNet >= 2);
    assertGateConsistency(r);
  });

  test('resistance only +10% away → blocked by upside / potential', () => {
    const bars = breakoutBars(12_000_000);
    const r = buildMomentumTrade(inputFrom(bars, { resistances: [lastClose(bars) * 1.1, lastClose(bars) * 1.35] }), m20);
    assert.notEqual(r.status, 'BUY');
    assert.equal(gate(r, 'upside').pass, false);
    assertGateConsistency(r);
  });

  test('price left the breakout zone → no plan', () => {
    const bars = breakoutBars(12_000_000);
    const r = buildMomentumTrade(inputFrom(bars, { price: lastClose(bars) * 1.06 }), m20);
    assert.notEqual(r.status, 'BUY');
    assertGateConsistency(r);
  });

  test('low volatility → TP2 not forced to +20%', () => {
    const base: Step[] = Array.from({ length: 20 }, (_, k) => ({ pct: [0.4, -0.4, 0.3, -0.3][k % 4], wick: 0.3 }));
    const bars = barsFrom(800, [...zigzag(60, 0.8, 0.5, { wick: 0.3 }), ...base, { pct: 1.5, vol: 12_000_000, wick: 0.1 }]);
    const r = buildMomentumTrade(inputFrom(bars), m20);
    assert.notEqual(r.status, 'BUY');
    assert.equal(r.target20Realistic, false);
    assert.equal(gate(r, 'potential').pass, false);
    assertGateConsistency(r);
  });

  test('candidateStats exposes percentages only, never a plan', () => {
    const bars = breakoutBars(12_000_000);
    const r = buildMomentumTrade(inputFrom(bars, { resistances: [lastClose(bars) * 1.1] }), m20);
    assert.ok(r.candidateStats);
    assert.equal(r.entryLow, null);
  });
});
