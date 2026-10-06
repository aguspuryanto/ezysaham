/**
 * technicalAnalysisV3 — 7-step order, step 7 = engine verdict, indicator rows for the share text.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { buildDecisionV3, classifyHorizon, PriceStructure } from '@/domain/analysis/decisionEngineV3';
import { MomentumInput } from '@/domain/analysis/momentumSpeculation';
import { buildTechnicalAnalysis, priceStructure } from '@/domain/analysis/technicalAnalysisV3';
import { atr } from '@/domain/indicators/atr';
import { macd } from '@/domain/indicators/macd';
import { ema, lastValid } from '@/domain/indicators/movingAverages';
import { rsi } from '@/domain/indicators/rsi';
import { volumeMA } from '@/domain/indicators/volume';
import { OHLCVBar } from '@/domain/models/History';
import { coreTechnicalLines } from '@/presentation/features/screener/detail/components/gemini1m/shareText';

type Step = { pct: number; vol?: number };

function barsFrom(start: number, steps: Step[], baseVol = 5_000_000): OHLCVBar[] {
  const bars: OHLCVBar[] = [];
  let prev = start;
  steps.forEach((s, idx) => {
    const open = prev;
    const close = prev * (1 + s.pct / 100);
    bars.push({
      date: `2026-01-${String(idx + 1).padStart(3, '0')}`,
      open, close,
      high: Math.max(open, close) * 1.002,
      low: Math.min(open, close) * 0.998,
      volume: s.vol ?? baseVol,
    });
    prev = close;
  });
  return bars;
}

const zigzag = (n: number, up: number, down: number): Step[] => Array.from({ length: n }, (_, k) => ({ pct: k % 2 === 0 ? up : -down }));

function inputFrom(bars: OHLCVBar[], over: Partial<MomentumInput> = {}): MomentumInput {
  const closes = bars.map((b) => b.close);
  const last = bars[bars.length - 1];
  const at = (k: number) => bars[bars.length - 1 - k]?.close;
  const chg = (k: number) => (at(k) ? (last.close / at(k)! - 1) * 100 : null);
  const volMa20 = volumeMA(bars, 20);
  const price = last.close;
  return {
    bars, price,
    change1D: chg(1), change1W: chg(5), change1M: chg(21),
    annualHigh: null,
    ema9: lastValid(ema(closes, 9)), ema20: lastValid(ema(closes, 20)), ema50: lastValid(ema(closes, 50)),
    vwap: null,
    rvol: last.volume / volMa20, volumeMa20: volMa20,
    rsi14: lastValid(rsi(bars, 14)),
    macdHistogram: lastValid(macd(bars).histogram),
    atr14: lastValid(atr(bars, 14)),
    tradedValue: last.close * last.volume,
    capitalization: 8e12, freeFloat: 40,
    per: 12, pbv: 1.6, roe: 16, revenueGrowth: 9, earningsGrowth: 12, debtToEquity: 45, currentRatio: 1.6, netMargin: 12,
    isFinancial: false,
    healthVerdict: 'SEHAT', valuationVerdict: 'WAJAR',
    fairValue: null, accumulationLow: null, accumulationHigh: null,
    supports: [price * 0.95], resistances: [price * 1.12, price * 1.2],
    ...over,
  };
}

const run = (i: MomentumInput, longBars?: OHLCVBar[]) => {
  const input = longBars ? { ...i, longBars, ema200: lastValid(ema(longBars.map((b) => b.close), 200)), ema21: lastValid(ema(longBars.map((b) => b.close), 21)) } : i;
  const r = buildDecisionV3(input);
  return { r, ta: buildTechnicalAnalysis(input, r) };
};

const uptrend = () => barsFrom(1000, [...zigzag(79, 1.2, 0.7), { pct: 1.2, vol: 5_600_000 }]);
const downtrend = () => barsFrom(2000, zigzag(80, 0.7, 1.3));
/** 200 sessions down, then a 26-session bounce with higher highs / higher lows — still under EMA 200. */
const recovery = () => barsFrom(2000, [...zigzag(200, 0.6, 1.0), ...zigzag(26, 1.5, 0.6)]);
function parabolic(): MomentumInput {
  const bars = barsFrom(1000, [...zigzag(79, 1.2, 0.7), { pct: 1.2 }]);
  const price = bars[bars.length - 1].close;
  return inputFrom(bars, { ema20: price / 1.9, ema9: price / 1.3, ema50: price / 2.3, rsi14: 85, change1M: 125, change1W: 40, change1D: 8, rvol: 2 });
}

describe('technicalAnalysisV3 — Core Technical', () => {
  test('price structure: rising zigzag = Higher High + Higher Low', () => {
    const s = priceStructure(barsFrom(1000, zigzag(40, 1.2, 0.7)));
    assert.equal(s.highs, 'HH');
    assert.equal(s.lows, 'HL');
  });

  test('trend rule table: price + EMA + structure, never one indicator', () => {
    const S = (highs: PriceStructure['highs'], lows: PriceStructure['lows']): PriceStructure => ({ highs, lows, label: '' });
    assert.equal(classifyHorizon(3, S('HH', 'HL'), true, 2), 'BULLISH');
    assert.equal(classifyHorizon(-3, S('HH', 'HL'), false, 2), 'RECOVERY');
    assert.equal(classifyHorizon(3, S('LH', 'LL'), true, 2), 'MELEMAH');
    assert.equal(classifyHorizon(-3, S('LH', 'LL'), false, 2), 'BEARISH');
    assert.equal(classifyHorizon(1, S('HH', 'LL'), true, 2), 'NETRAL');
    assert.equal(classifyHorizon(5, S('EQ', 'EQ'), true, 2), 'NETRAL');
    // Above the EMA is never BEARISH without a bearish structure.
    for (const s of [S('HH', 'LL'), S('LH', 'HL'), S('EQ', 'LL'), S('LH', 'EQ')]) assert.notEqual(classifyHorizon(6, s, false, 2), 'BEARISH');
  });

  test('healthy uptrend → MARKUP, trend up on short & medium', () => {
    const { ta } = run(inputFrom(uptrend()));
    assert.equal(ta.phase.value, 'MARKUP');
    assert.equal(ta.trend.short, 'BULLISH');
    assert.equal(ta.trend.medium, 'BULLISH');
  });

  test('recovery under EMA 200 → RECOVERY: short up, long BEARISH, both shown', () => {
    const long = recovery();
    const { r, ta } = run(inputFrom(long.slice(-120)), long);
    assert.equal(ta.phase.value, 'RECOVERY');
    assert.equal(ta.trend.short, 'BULLISH');
    assert.equal(ta.trend.long, 'BEARISH');
    assert.notEqual(ta.trend.medium, 'NETRAL');
    assert.notEqual(r.simple.trendLabel, 'Sideways');
    assert.match(ta.trend.detail, /Pendek BULLISH · Menengah \w+ · Panjang BEARISH/);
    assert.ok(ta.decision.conflicts.some((c) => /jangka panjang masih turun/.test(c)), ta.decision.conflicts.join(' | '));
  });

  test('parabolic run → TERLALU JAUH, entry BELUM ADA, AVOID CHASING', () => {
    const { ta } = run(parabolic());
    assert.equal(ta.position.value, 'TERLALU JAUH');
    assert.equal(ta.entry.value, 'BELUM ADA');
    assert.ok(ta.risk.flags.some((f) => f.key === 'OVEREXTENDED'));
    assert.equal(ta.decision.value, 'AVOID CHASING');
  });

  test('downtrend → MARKDOWN / BEARISH, never BUY', () => {
    const { ta } = run(inputFrom(downtrend()));
    assert.equal(ta.phase.value, 'MARKDOWN');
    assert.equal(ta.trend.medium, 'BEARISH');
    assert.ok(ta.risk.flags.some((f) => f.key === 'TREND BEARISH'));
    assert.notEqual(ta.decision.value, 'BUY');
  });

  test('consistency invariants hold on every scenario', () => {
    const long = recovery();
    const cases = [run(inputFrom(uptrend())), run(inputFrom(downtrend())), run(parabolic()), run(inputFrom(long.slice(-120)), long)];
    for (const { r, ta } of cases) {
      // Decision = engine verdict; entry ADA only with a BUY; TERLALU JAUH ⇔ AVOID CHASING.
      assert.equal(ta.decision.value === 'AVOID CHASING' ? 'AVOID' : ta.decision.value, r.simple.status);
      assert.equal(ta.entry.value === 'ADA', ta.decision.value === 'BUY');
      assert.equal(ta.position.value === 'TERLALU JAUH', ta.decision.value === 'AVOID CHASING');
      // A clear HH/HL or LH/LL is never called sideways / netral.
      const s = r.trend.structure;
      if ((s.highs === 'HH' && s.lows === 'HL') || (s.highs === 'LH' && s.lows === 'LL')) {
        assert.notEqual(ta.trend.short, 'NETRAL');
      }
      // Phase follows the trend: MARKUP only with a bullish medium trend, MARKDOWN only with a bearish one.
      if (ta.phase.value === 'MARKUP') assert.equal(ta.trend.medium, 'BULLISH');
      if (ta.phase.value === 'MARKDOWN') assert.equal(ta.trend.medium, 'BEARISH');
      // Headline trend label = medium horizon.
      assert.equal(r.simple.trendLabel.toUpperCase(), ta.trend.medium === 'N/A' ? 'N/A' : ta.trend.medium);
      {
      }
      // A good R:R without a BUY is labelled potential only.
      if (ta.decision.value !== 'BUY' && (ta.indicators.rr ?? 0) >= 1.5) assert.match(ta.risk.explain, /POTENSI/);
      assert.ok(r.consistency.every((c) => c.passed), JSON.stringify(r.consistency.filter((c) => !c.passed)));
    }
  });

  test('EMA 200 needs ≥ 200 bars — taken from longBars when given', () => {
    const long = barsFrom(500, zigzag(260, 1.0, 0.7));
    const short = long.slice(-120);
    assert.equal(run(inputFrom(short)).ta.indicators.ema200, null);
    assert.ok((run(inputFrom(short), long).ta.indicators.ema200 ?? 0) > 0);
  });

  test('share text: CORE TECHNICAL block in the fixed order', () => {
    const { ta } = run(parabolic());
    const text = coreTechnicalLines(ta).join('\n');
    const order = ['📊 CORE TECHNICAL', '1️⃣ Fase', '2️⃣ Trend', '3️⃣ Tenaga', '4️⃣ Momentum', '5️⃣ Posisi Harga', '6️⃣ Entry', '7️⃣ Risiko', '🎯 KEPUTUSAN'];
    const at = order.map((k) => text.indexOf(k));
    assert.ok(at.every((x, k) => x >= 0 && (k === 0 || x > at[k - 1])), at.join(','));
    assert.match(text, /→ Volume [\d,]+ (jt|M) lbr · RVOL [\d,]+× rata-rata/);
    assert.match(text, /Pendek \w+\n· Menengah \w+\n· Panjang [\w/]+\n→ /);
    assert.match(text, /→ RSI \d+ · MACD (POSITIF|NEGATIF)/);
    assert.match(text, /→ SL .* · R:R/);
    assert.match(text, /🎯 KEPUTUSAN\n🔴 AVOID CHASING/);
    // Strong volume / momentum without a safe entry is called out as a conflict, not a BUY.
    assert.match(text, /⚖️ Konflik data:\n• /);
  });
});
