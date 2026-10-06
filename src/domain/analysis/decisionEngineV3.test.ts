/**
 * Decision Engine v3 — scenario tests (features_decision_enginev3.md §VALIDATION).
 * Run: npm test
 *
 * Bars are synthetic; every indicator is derived from them the same way the app does (EMA, RSI, ATR, MACD,
 * RVOL = last volume / SMA20 volume). A test overrides a derived value only where the scenario is defined by
 * that number (e.g. the CSMI top-gainer case). No ticker is hard-coded in the engine.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { buildDecisionV3 } from '@/domain/analysis/decisionEngineV3';
import { MomentumInput } from '@/domain/analysis/momentumSpeculation';
import { atr } from '@/domain/indicators/atr';
import { macd } from '@/domain/indicators/macd';
import { ema, lastValid } from '@/domain/indicators/movingAverages';
import { rsi } from '@/domain/indicators/rsi';
import { volumeMA } from '@/domain/indicators/volume';
import { OHLCVBar } from '@/domain/models/History';

// ─── Fixtures ───────────────────────────────────────────────────────────────────

type Step = { pct: number; vol?: number };

/** Builds daily bars from % steps: open = previous close, small wicks around the body. */
function barsFrom(start: number, steps: Step[], baseVol = 5_000_000): OHLCVBar[] {
  const bars: OHLCVBar[] = [];
  let prev = start;
  steps.forEach((s, idx) => {
    const open = prev;
    const close = prev * (1 + s.pct / 100);
    bars.push({
      date: `2026-01-${String(idx + 1).padStart(3, '0')}`,
      open,
      close,
      high: Math.max(open, close) * 1.002,
      low: Math.min(open, close) * 0.998,
      volume: s.vol ?? baseVol,
    });
    prev = close;
  });
  return bars;
}

/** Zigzag trend: `up`% then `down`% alternately. */
const zigzag = (n: number, up: number, down: number, vol?: number): Step[] =>
  Array.from({ length: n }, (_, k) => ({ pct: k % 2 === 0 ? up : -down, vol }));

const GOOD_FUNDAMENTALS: Partial<MomentumInput> = {
  per: 12, pbv: 1.6, roe: 16, revenueGrowth: 9, earningsGrowth: 12, debtToEquity: 45, currentRatio: 1.6, netMargin: 12,
  healthVerdict: 'SEHAT', valuationVerdict: 'WAJAR', capitalization: 8e12, freeFloat: 40,
};
const WEAK_FUNDAMENTALS: Partial<MomentumInput> = {
  per: -6, pbv: 2.5, roe: -4, revenueGrowth: -12, earningsGrowth: -40, debtToEquity: 260, currentRatio: 0.8, netMargin: -5,
  healthVerdict: 'LEMAH', valuationVerdict: 'TIDAK_DAPAT_DINILAI', capitalization: 3e12, freeFloat: 35,
};

function inputFrom(bars: OHLCVBar[], over: Partial<MomentumInput> = {}): MomentumInput {
  const closes = bars.map((b) => b.close);
  const last = bars[bars.length - 1];
  const at = (k: number) => bars[bars.length - 1 - k]?.close;
  const chg = (k: number) => (at(k) ? (last.close / at(k)! - 1) * 100 : null);
  const volMa20 = volumeMA(bars, 20);
  const price = last.close;
  return {
    bars,
    price,
    change1D: chg(1),
    change1W: chg(5),
    change1M: chg(21),
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
    capitalization: null,
    freeFloat: null,
    per: null, pbv: null, roe: null, revenueGrowth: null, earningsGrowth: null, debtToEquity: null, currentRatio: null, netMargin: null,
    isFinancial: false,
    healthVerdict: 'DATA_KURANG',
    valuationVerdict: 'TIDAK_DAPAT_DINILAI',
    fairValue: null,
    accumulationLow: null,
    accumulationHigh: null,
    supports: [],
    resistances: [price * 1.12, price * 1.2],
    ...GOOD_FUNDAMENTALS,
    ...over,
  };
}

/** Healthy uptrend: +1,2% / −0,7% zigzag, last bar a green +1,2% candle on slightly above-average volume. */
function healthyUptrend(): OHLCVBar[] {
  return barsFrom(1000, [...zigzag(79, 1.2, 0.7), { pct: 1.2, vol: 5_600_000 }]);
}

/** 60-bar uptrend, 20-bar tight base under ~resistance, then a breakout bar with `breakoutVol`. */
function breakoutBars(breakoutVol: number): OHLCVBar[] {
  const base: Step[] = Array.from({ length: 20 }, (_, k) => ({ pct: [0.8, -0.8, 0.6, -0.6][k % 4] }));
  return barsFrom(800, [...zigzag(60, 1.0, 0.6), ...base, { pct: 3.2, vol: breakoutVol }]);
}

/** Uptrend, then a 4-bar low-volume dip into EMA 9–20, then a green rebound bar on rising volume. */
function pullbackBars(): OHLCVBar[] {
  const dip: Step[] = [
    { pct: -1.6, vol: 3_800_000 }, { pct: -1.4, vol: 3_400_000 }, { pct: -1.2, vol: 3_000_000 }, { pct: -0.6, vol: 2_800_000 },
  ];
  return barsFrom(1000, [...zigzag(75, 1.3, 0.6), ...dip, { pct: 1.1, vol: 4_600_000 }]);
}

/** Flat range: closes oscillate ±4% around 1000 (period ~25 bars), ending mid-range. */
function sideways(): OHLCVBar[] {
  const closes = Array.from({ length: 78 }, (_, k) => 1000 * (1 + 0.04 * Math.sin((k * 2 * Math.PI) / 25)));
  return barsFrom(closes[0], closes.slice(1).map((c, k) => ({ pct: (c / closes[k] - 1) * 100 })));
}

const run = (i: MomentumInput) => buildDecisionV3(i);

// ─── Scenarios ──────────────────────────────────────────────────────────────────

describe('Decision Engine v3', () => {
  test('1. bullish healthy momentum → BUY with a valid setup and R:R ≥ 1.5', () => {
    const r = run(inputFrom(healthyUptrend()));
    assert.equal(r.trend.direction, 'BULLISH');
    assert.equal(r.momentum.quality, 'GOOD');
    assert.equal(r.decisions.trading.status, 'BUY');
    assert.equal(r.primarySetup?.state, 'VALID');
    assert.ok((r.primarySetup?.riskReward ?? 0) >= 1.5);
    assert.ok(r.simple.plan && !r.simple.plan.conditional);
    assert.equal(r.simple.conclusion, 'Layak dibeli dengan risiko terukur.');
  });

  test('2. bullish breakout with volume → BUY on the BREAKOUT setup', () => {
    const r = run(inputFrom(breakoutBars(11_000_000)));
    assert.equal(r.trend.direction, 'BULLISH');
    assert.equal(r.primarySetup?.kind, 'BREAKOUT');
    assert.equal(r.primarySetup?.state, 'VALID');
    assert.equal(r.decisions.trading.status, 'BUY');
  });

  test('3. bullish pullback → BUY on the PULLBACK setup', () => {
    const r = run(inputFrom(pullbackBars()));
    assert.equal(r.trend.direction, 'BULLISH');
    assert.equal(r.primarySetup?.kind, 'PULLBACK');
    assert.equal(r.primarySetup?.state, 'VALID');
    assert.equal(r.decisions.trading.status, 'BUY');
  });

  test('4. early momentum is flagged as a BUY candidate', () => {
    const r = run(inputFrom(barsFrom(1000, [...zigzag(79, 1.0, 0.75), { pct: 1.0, vol: 5_600_000 }])));
    assert.equal(r.momentum.stage, 'EARLY');
    assert.ok(r.earlyMomentum);
    assert.ok(r.decisions.trading.tag === 'EARLY MOMENTUM' || r.decisions.trading.tag === 'BUY CANDIDATE');
  });

  test('5. extended momentum → WAIT for a pullback, not BUY', () => {
    const bars = barsFrom(1000, [...zigzag(72, 1.2, 0.6), ...Array.from({ length: 8 }, () => ({ pct: 2.2 }))]);
    const i = inputFrom(bars, { rsi14: 71, change1M: 30, change1W: 8, change1D: 1.5 });
    const r = run(i);
    assert.ok((r.momentum.distEma20 ?? 0) > 8 && (r.momentum.distEma20 ?? 0) < 15, `dist ${r.momentum.distEma20}`);
    assert.equal(r.momentum.stage, 'EXTENDED');
    assert.equal(r.decisions.trading.status, 'WAIT');
    assert.equal(r.simple.conclusion, 'Tunggu pullback terlebih dahulu.');
    assert.match(r.simple.waitFor ?? '', /turun mendekati/);
  });

  test('6. parabolic momentum (CSMI-like) → AVOID CHASING, no entry / TP / SL', () => {
    const bars = healthyUptrend();
    const price = bars[bars.length - 1].close;
    const r = run(inputFrom(bars, { ema20: price / 1.898, ema9: price / 1.3, ema50: price / 2.3, rsi14: 85, change1M: 125, change1W: 40, change1D: 8, rvol: 2.03 }));
    assert.ok((r.momentum.strength ?? 0) >= 65, `strength ${r.momentum.strength}`);
    assert.equal(r.momentum.stage, 'PARABOLIC');
    assert.equal(r.entryQuality, 'BAD');
    assert.equal(r.decisions.trading.status, 'AVOID');
    assert.equal(r.decisions.trading.tag, 'AVOID CHASING');
    assert.equal(r.decisions.swing.status, 'AVOID');
    assert.equal(r.simple.plan, null);
    assert.equal(r.simple.conclusion, 'Tunggu pullback — jangan kejar harga.');
    assert.equal(r.simple.condition, 'Overextended (parabolik)');
    assert.ok(r.simple.betterEntry && r.simple.betterEntry.price < r.simple.price);
    assert.match(r.simple.reason, /Momentumnya kuat, tetapi harga sudah naik terlalu jauh/);
  });

  test('7. breakout without volume → WAIT', () => {
    const r = run(inputFrom(breakoutBars(3_500_000)));
    assert.ok((r.liquidity.rvol ?? 9) < 1);
    assert.equal(r.primarySetup?.kind, 'BREAKOUT');
    assert.notEqual(r.primarySetup?.state, 'VALID');
    assert.equal(r.decisions.trading.status, 'WAIT');
    assert.match(r.simple.reason, /belum didukung transaksi/);
  });

  test('8. bearish trend → Trading AVOID; Swing AVOID when fundamentals are weak', () => {
    const bars = barsFrom(2000, zigzag(80, 0.6, 1.2));
    const r = run(inputFrom(bars, { ...WEAK_FUNDAMENTALS, resistances: [] }));
    assert.equal(r.trend.direction, 'BEARISH');
    assert.equal(r.decisions.trading.status, 'AVOID');
    assert.equal(r.decisions.swing.status, 'AVOID');
    assert.equal(r.simple.plan, null);
  });

  test('9. sideways trend → WAIT, never BUY', () => {
    const bars = sideways();
    const r = run(inputFrom(bars));
    assert.equal(r.trend.direction, 'SIDEWAYS');
    assert.equal(r.decisions.trading.status, 'WAIT');
    assert.equal(r.decisions.swing.status, 'WAIT');
  });

  test('10. low liquidity → AVOID (thin) · limited liquidity is still tradable', () => {
    const thin = run(inputFrom(barsFrom(100, [...zigzag(79, 1.2, 0.7, 500_000), { pct: 1.2, vol: 560_000 }])));
    assert.equal(thin.liquidity.trading, 'FAIL');
    assert.equal(thin.decisions.trading.status, 'AVOID');
    assert.match(thin.simple.reason, /sepi transaksi/);

    const limited = run(inputFrom(barsFrom(100, [...zigzag(79, 1.2, 0.7, 4_000_000), { pct: 1.2, vol: 4_400_000 }])));
    assert.equal(limited.liquidity.trading, 'LIMITED');
    assert.notEqual(limited.decisions.trading.status, 'AVOID');
    assert.notEqual(limited.decisions.swing.status, 'BUY');
  });

  test('11. poor R:R (target too close) → WAIT', () => {
    const bars = healthyUptrend();
    const price = bars[bars.length - 1].close;
    const r = run(inputFrom(bars, { resistances: [price * 1.025] }));
    assert.ok((r.primarySetup?.riskReward ?? 0) < 1.5);
    assert.equal(r.decisions.trading.status, 'WAIT');
    assert.match(r.simple.reason, /target terlalu dekat/);
  });

  test('12. strong technical + poor fundamental → Trading BUY with warning, Investing AVOID', () => {
    const r = run(inputFrom(healthyUptrend(), WEAK_FUNDAMENTALS));
    assert.equal(r.decisions.trading.status, 'BUY');
    assert.ok(r.decisions.trading.warnings.some((w) => /Fundamental lemah/.test(w)));
    assert.equal(r.decisions.investing.status, 'AVOID');
  });

  test('13. strong fundamental + weak technical → Trading AVOID, Swing WAIT, Investing BUY', () => {
    const bars = barsFrom(2000, zigzag(80, 0.6, 1.2));
    const r = run(inputFrom(bars, { resistances: [] }));
    assert.equal(r.decisions.trading.status, 'AVOID');
    assert.equal(r.decisions.swing.status, 'WAIT');
    assert.equal(r.decisions.investing.status, 'BUY');
  });

  test('14. top gainer / FOMO → AVOID CHASING on Trading and Swing', () => {
    const bars = barsFrom(500, [...zigzag(76, 1.5, 0.6), { pct: 6 }, { pct: 9 }, { pct: 12, vol: 9_000_000 }, { pct: 20, vol: 22_000_000 }]);
    const r = run(inputFrom(bars));
    assert.ok(r.momentum.chaseFlags.length > 0);
    assert.equal(r.decisions.trading.status, 'AVOID');
    assert.equal(r.decisions.trading.tag, 'AVOID CHASING');
    assert.equal(r.decisions.swing.status, 'AVOID');
    assert.equal(r.simple.plan, null);
  });

  test('consistency checks all pass across scenarios', () => {
    const inputs = [
      inputFrom(healthyUptrend()), inputFrom(breakoutBars(11_000_000)), inputFrom(breakoutBars(3_500_000)), inputFrom(pullbackBars()),
      inputFrom(barsFrom(2000, zigzag(80, 0.6, 1.2)), WEAK_FUNDAMENTALS),
    ];
    for (const i of inputs) {
      const failed = run(i).consistency.filter((c) => !c.passed);
      assert.deepEqual(failed, []);
    }
  });
});
