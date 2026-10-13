/**
 * Breakout-retest, Valid SL and HARD RISK GATE — regression for the OILS case (docs/features_momentum_engine.md § v2.1).
 * Run: npm test
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { detectRetest, IDX_COSTS, netRiskReward, RETEST_RULES, SetupContext } from '@/domain/analysis/momentumSetups';
import { buildMomentumTrade, evaluateSl, MOMENTUM_MODES, MomentumTradeReport } from '@/domain/analysis/momentumTradeEngine';
import { barsFrom, inputFrom, zigzag } from '@/domain/analysis/momentumTestFixtures';
import { OHLCVBar } from '@/domain/models/History';

const swing = MOMENTUM_MODES.swing; // maxSlPct 8, maxSlAtr 2,5
const gate = (r: MomentumTradeReport, key: string) => r.riskGate.find((g) => g.key === key)!;

describe('Valid SL — two separate hard limits', () => {
  test('SL 7,9% and 2,5× ATR → both PASS (limits are inclusive)', () => {
    const e = evaluateSl(1000, 921, 31.6, swing);
    assert.ok(Math.abs(e.slRiskPct - 7.9) < 1e-9);
    assert.ok(Math.abs(e.slAtrMultiple - 2.5) < 1e-9);
    assert.equal(e.pctPass, true);
    assert.equal(e.atrPass, true);
    assert.equal(e.atrText, '2,5× ATR ≤ 2,5× ATR');
  });

  test('SL 8,2% and 1,0× ATR → % FAIL, ATR PASS, shown separately', () => {
    const e = evaluateSl(1000, 918, 82, swing);
    assert.equal(e.pctPass, false);
    assert.equal(e.atrPass, true);
    assert.equal(e.pctText, 'risiko 8,2% > 8,0%');
    assert.equal(e.atrText, '1,0× ATR ≤ 2,5× ATR');
  });

  test('SL exactly at 8% → PASS; 8,04% → FAIL and the text never reads "8,0% > 8,0%"', () => {
    assert.equal(evaluateSl(1000, 920, 50, swing).pctPass, true);
    const over = evaluateSl(1000, 919.6, 50, swing);
    assert.equal(over.pctPass, false);
    assert.equal(over.pctText, 'risiko 8,04% > 8,00%');
  });
});

describe('HARD RISK GATE — entry not valid yet', () => {
  // Healthy trend just under resistance: the breakout has not happened (MINE-like).
  const bars = barsFrom(1000, [...zigzag(60, 2.0, 0.8, { wick: 0.8 }), { pct: -0.4, wick: 0.3 }]);
  const r = buildMomentumTrade(inputFrom(bars, { resistances: [bars[bars.length - 1].close * 1.12] }));

  test('trigger FAIL; SL % / SL ATR / R:R are PENDING ENTRY (simulation), never PASS or a final SL', () => {
    assert.equal(gate(r, 'trigger').state, 'FAIL');
    assert.equal(r.slStage, 'PROVISIONAL');
    for (const k of ['slPct', 'slAtr', 'rr']) {
      assert.equal(gate(r, k).state, 'PENDING', k);
      assert.equal(gate(r, k).pass, false, k);
      assert.match(gate(r, k).detail, /^PENDING ENTRY — entry belum terkonfirmasi\. Simulasi/, k);
    }
    assert.equal(r.sl, null);
    assert.equal(r.riskReward, null);
    assert.notEqual(r.status, 'BUY');
  });

  test('once the entry is valid the same gates become FINAL PASS/FAIL', () => {
    const tail = { pct: 3.0, vol: 15_000_000, wick: 0.2 };
    const base = Array.from({ length: 20 }, (_, k) => ({ pct: [1.2, -1.0, 0.8, -1.1][k % 4], wick: 0.8 }));
    const b = barsFrom(1000, [...zigzag(60, 1.6, 1.0, { wick: 0.8 }), ...base, tail]);
    const v = buildMomentumTrade(inputFrom(b, { resistances: [b[b.length - 1].close * 1.1] }));
    assert.equal(v.slStage, 'FINAL');
    assert.equal(gate(v, 'slPct').state, 'PASS');
    assert.match(gate(v, 'slPct').detail, /^risiko \d+,\d+% ≤ 8,0% \(entry Rp/);
    assert.match(gate(v, 'rr').detail, /^net 1:\d+,\d ≥ 1:2,0/);
    assert.equal(v.status, 'BUY');
  });

  test('no technical target → R:R PENDING (not a made-up number), BUY blocked by Potential', () => {
    const base = Array.from({ length: 20 }, (_, k) => ({ pct: [1.2, -1.0, 0.8, -1.1][k % 4], wick: 0.8 }));
    const b = barsFrom(1000, [...zigzag(60, 1.6, 1.0, { wick: 0.8 }), ...base, { pct: 3.0, vol: 15_000_000, wick: 0.2 }]);
    const v = buildMomentumTrade(inputFrom(b)); // blue sky, measured move beyond the swing ATR reach
    assert.equal(gate(v, 'rr').state, 'PENDING');
    assert.match(gate(v, 'rr').detail, /target teknikal .* belum tersedia/);
    assert.equal(gate(v, 'potential').state, 'FAIL');
    assert.notEqual(v.status, 'BUY');
  });
});

describe('net R:R — fees and slippage', () => {
  test('exact formula: buy = (entry + slip)(1 + 0,15%), sell = (p − slip)(1 − 0,25%), slip ≥ 1 tick', () => {
    // Rp 1.000 → tick Rp 5 > 0,1% → slip Rp 5 each side.
    const buy = 1005 * 1.0015;
    const sell = (p: number) => (p - 5) * 0.9975;
    const expected = (sell(1100) - buy) / (buy - sell(950));
    const got = netRiskReward(1000, 950, 1100, IDX_COSTS);
    assert.ok(Math.abs(got.rr! - expected) < 1e-12);
    assert.ok(got.rr! < (1100 - 1000) / (1000 - 950));
  });
});

// ─── Breakout-retest on an OILS-like tape (tick Rp 2) ─────────────────────────────

const bar = (date: string, o: number, h: number, l: number, c: number, v = 5_000_000): OHLCVBar => ({ date, open: o, high: h, low: l, close: c, volume: v });
/** 40 sessions ranging 290–318 with one 358 spike (the future breakout level), then the breakout bar. */
function oilsBase(breakoutVol = 30_000_000): OHLCVBar[] {
  const bars: OHLCVBar[] = [];
  for (let k = 0; k < 40; k++) {
    const c = k % 2 ? 300 : 310;
    bars.push(bar(`2026-08-${String(k + 1).padStart(2, '0')}`, 305, k === 30 ? 358 : 318, 290, c));
  }
  bars.push(bar('2026-10-07', 342, 408, 324, 394, breakoutVol)); // close 394 > 358 on volume
  return bars;
}
const ctx = (bars: OHLCVBar[]): SetupContext => ({ bars, atr: 30, ema9: null, ema20: 320, ema50: 310, trendBullish: false });

describe('breakout-retest', () => {
  test('level = high of the completed sessions BEFORE the breakout; invalidation snapped to a tick (Rp 350)', () => {
    const s = detectRetest(ctx([...oilsBase(), bar('d1', 394, 400, 362, 380, 8_000_000)]));
    assert.equal(s.level, 358);
    assert.equal(s.breakoutDate, '2026-10-07');
    assert.equal(s.invalidationPrice, 350); // floorTick(358 − 0,25 × 30 = 350,5)
    assert.deepEqual(s.levels!.map((l) => l.role).sort(), ['BREAKOUT', 'INVALIDATION', 'RETEST_LOW', 'ZONE_TOP']);
    assert.equal(RETEST_RULES.invalidationAtr, 0.25);
  });

  test('retest succeeds: tested the level, then a green candle closes back above it inside the zone', () => {
    const s = detectRetest(ctx([...oilsBase(), bar('d1', 394, 396, 362, 366, 8_000_000), bar('d2', 360, 368, 356, 366.5, 6_000_000)]));
    assert.equal(s.state, 'TRIGGERED', s.reason);
    assert.equal(s.retestLow, 356);
  });

  test('close below the level but above invalidation (OILS 354) → PENDING with the specific reason', () => {
    const s = detectRetest(ctx([...oilsBase(), bar('d1', 394, 404, 380, 388, 9_000_000), bar('d2', 388, 388, 350, 354, 10_000_000)]));
    assert.equal(s.state, 'PENDING');
    assert.match(s.reason, /Close Rp 354 di bawah level breakout Rp 358 \(masih di atas invalidasi Rp 350\)/);
  });

  test('close exactly at the shown invalidation (Rp 350) holds; one tick below (Rp 348) fails → wait for new structure', () => {
    const at = detectRetest(ctx([...oilsBase(), bar('d1', 380, 382, 349, 350)]));
    assert.notEqual(at.state, 'INVALID');
    const below = detectRetest(ctx([...oilsBase(), bar('d1', 380, 382, 346, 348)]));
    assert.equal(below.state, 'INVALID');
    assert.match(below.reason, /di bawah invalidasi Rp 350; tunggu struktur baru/);
    assert.equal(below.structuralLow, null);
  });

  test('false breakout: breakout then close collapses back into the base → INVALID', () => {
    const s = detectRetest(ctx([...oilsBase(), bar('d1', 390, 392, 300, 305, 25_000_000)]));
    assert.equal(s.state, 'INVALID');
  });

  test('volume is required AT THE BREAKOUT: a low-volume breakout is not a retest setup even if the retest is heavy', () => {
    const s = detectRetest(ctx([...oilsBase(5_000_000), bar('d1', 394, 396, 360, 362, 40_000_000)]));
    assert.equal(s.state, 'ABSENT');
  });

  test('heavy selling on the retest (red candle volume ≥ breakout volume) blocks the confirmation', () => {
    const s = detectRetest(ctx([...oilsBase(), bar('d1', 394, 396, 356, 360, 35_000_000), bar('d2', 360, 368, 358, 366, 6_000_000)]));
    assert.equal(s.state, 'PENDING');
    assert.match(s.reason, /volume ≥ volume breakout/);
    assert.match(s.volumeRule!, /candle breakout 2026-10-07/);
  });

  test('no look-ahead: the verdict on bar t ignores later bars (a later collapse does not change it)', () => {
    const upToT = [...oilsBase(), bar('d1', 394, 396, 362, 366, 8_000_000), bar('d2', 360, 368, 356, 366.5, 6_000_000)];
    const a = detectRetest(ctx(upToT));
    const withFuture = [...upToT, bar('d3', 360, 361, 300, 301, 50_000_000)];
    const b = detectRetest(ctx(withFuture.slice(0, upToT.length)));
    assert.deepEqual(a, b);
    assert.equal(a.state, 'TRIGGERED');
  });
});
