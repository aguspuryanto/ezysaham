/** swingTradingReport — "⚡ EzySaham AI — SWING" format and the setup/trigger rules. */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { OHLCVBar } from '@/domain/models/History';
import { StockSummary } from '@/domain/models/Stock';
import { computeSwingTradingSetup, SW_MIN_RR, SW_TARGET_MAX_PCT, SW_TARGET_MIN_PCT } from './swingTrading';
import { buildSwingTradingReport, swingTradingReportText } from './swingTradingReport';

function bars(n: number, up: number, down: number, vol = 40_000_000, start = 1000): OHLCVBar[] {
  const out: OHLCVBar[] = [];
  let prev = start;
  for (let k = 0; k < n; k++) {
    const close = prev * (1 + (k % 2 === 0 ? up : -down) / 100);
    out.push({ date: `2026-01-${String(k + 1).padStart(3, '0')}`, open: prev, close, high: Math.max(prev, close) * 1.003, low: Math.min(prev, close) * 0.997, volume: vol });
    prev = close;
  }
  return out;
}

const summaryOf = (b: OHLCVBar[]): StockSummary => {
  const last = b[b.length - 1];
  const prev = b[b.length - 2];
  return { ticker: 'TEST', name: 'Test', lastClose: last.close, percentChange1D: ((last.close - prev.close) / prev.close) * 100, roe: 12 } as StockSummary;
};

const run = (b: OHLCVBar[]) => {
  const sw = computeSwingTradingSetup(summaryOf(b), b, new Date(2026, 0, 1));
  return { sw, r: buildSwingTradingReport('TEST', sw) };
};

const scenarios = () => [bars(240, 1.0, 0.6), bars(240, 0.6, 1.0), bars(240, 2.5, 0.3), bars(240, 0.7, 0.6, 3_000_000)];

describe('swingTradingReport', () => {
  test('text follows the fixed format and never says "beli sekarang"', () => {
    const text = swingTradingReportText(run(bars(240, 1.0, 0.6)).r);
    const order = ['⚡ EzySaham AI — SWING', 'TEST', 'Status:', 'Setup:', 'Trend:', 'Momentum:', 'Volume:', 'Support:', 'Resistance:',
      '🎯 Trigger:', 'Entry:', 'SL:', 'TP:', 'Target:', 'R:R:', '💡 Kesimpulan:', '⚠️ Data EOD, bukan realtime.', 'Entry hanya setelah trigger valid.'];
    const at = order.map((k) => text.indexOf(k));
    assert.ok(at.every((x, i) => x >= 0 && (i === 0 || x > at[i - 1])), at.join(','));
    assert.doesNotMatch(text.toLowerCase(), /beli sekarang|buy sekarang/);
  });

  test('uptrend → BULLISH, downtrend → BEARISH and never SWING SETUP', () => {
    assert.equal(run(bars(240, 1.0, 0.6)).sw.trendCall, 'BULLISH');
    const down = run(bars(240, 0.6, 1.0)).sw;
    assert.equal(down.trendCall, 'BEARISH');
    assert.notEqual(down.verdict, 'SETUP');
  });

  test('verdict rules: SETUP needs setup + R:R ≥ 1:2 + target 5–15% + agreeing data; chasing / no setup → no entry', () => {
    for (const b of scenarios()) {
      const { sw, r } = run(b);
      if (sw.verdict === 'SETUP') {
        assert.notEqual(sw.setupType, 'NONE');
        assert.ok((sw.riskReward ?? 0) >= SW_MIN_RR);
        assert.ok((sw.tp1Pct ?? 0) >= SW_TARGET_MIN_PCT && (sw.tp1Pct ?? 0) <= SW_TARGET_MAX_PCT);
        assert.equal(sw.trendCall, 'BULLISH');
        assert.notEqual(sw.momentumCall, 'LEMAH');
      }
      if (sw.status === 'NO_TRADE') assert.equal(sw.verdict, 'AVOID');
      if (sw.chasing && sw.status === 'WAIT') assert.equal(sw.verdict, 'AVOID_CHASING');
      if (sw.verdict === 'AVOID' || sw.verdict === 'AVOID_CHASING' || sw.setupType === 'NONE') assert.match(r.entry, /jangan entry/);
      if (sw.setupType === 'NONE') assert.equal(r.setup, 'NO SETUP');
    }
  });
});
