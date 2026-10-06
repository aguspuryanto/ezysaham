/** dayTradingReport — "⚡ EzySaham AI — DAY TRADING" format and the EOD/trigger rules. */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { OHLCVBar } from '@/domain/models/History';
import { StockSummary } from '@/domain/models/Stock';
import { computeDayTradingSetup, DT_MIN_RR } from './dayTrading';
import { buildDayTradingReport, dayTradingReportText } from './dayTradingReport';

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
  return { ticker: 'TEST', name: 'Test', lastClose: last.close, percentChange1D: ((last.close - prev.close) / prev.close) * 100 } as StockSummary;
};

const run = (b: OHLCVBar[]) => {
  const dt = computeDayTradingSetup(summaryOf(b), b, new Date(2026, 0, 1));
  return { dt, r: buildDayTradingReport('TEST', dt) };
};

describe('dayTradingReport', () => {
  test('text follows the fixed format and never says "beli sekarang"', () => {
    const { r } = run(bars(120, 1.2, 0.6));
    const text = dayTradingReportText(r);
    const order = ['⚡ EzySaham AI — DAY TRADING', 'TEST', 'Status:', 'Trend:', 'Momentum:', 'Volume:', 'Likuiditas:', 'Trigger: ', 'Entry:', 'SL:', 'TP:', 'R:R:', '💡 Kesimpulan:', '⚠️ Data EOD, bukan realtime.', 'Trigger wajib dikonfirmasi'];
    const at = order.map((k) => text.indexOf(k));
    assert.ok(at.every((x, i) => x >= 0 && (i === 0 || x > at[i - 1])), at.join(','));
    assert.doesNotMatch(text.toLowerCase(), /beli sekarang|buy sekarang/);
    assert.match(text, /Volume: .* · RVOL /);
  });

  test('uptrend → trend BULLISH; trigger is a break-high level, entry only after it', () => {
    const { dt, r } = run(bars(120, 1.2, 0.6));
    assert.equal(dt.trend, 'BULLISH');
    if (dt.entryTrigger != null) {
      assert.match(r.trigger, /^Break High > Rp/);
      if (dt.verdict === 'SETUP' || dt.verdict === 'WATCH') assert.match(r.entry, /setelah trigger/);
    }
  });

  test('downtrend → trend BEARISH, never DAY TRADE SETUP', () => {
    const { dt } = run(bars(120, 0.6, 1.2));
    assert.equal(dt.trend, 'BEARISH');
    assert.notEqual(dt.verdict, 'SETUP');
  });

  test('DAY TRADE SETUP requires R:R ≥ minimum; chasing is AVOID CHASING with no entry', () => {
    for (const b of [bars(120, 1.2, 0.6), bars(120, 2.5, 0.3), bars(120, 0.8, 0.5, 2_000_000)]) {
      const { dt, r } = run(b);
      if (dt.verdict === 'SETUP') assert.ok((dt.riskReward ?? 0) >= DT_MIN_RR);
      if (dt.chasing && dt.status === 'WATCH') {
        assert.equal(dt.verdict, 'AVOID_CHASING');
        assert.match(r.entry, /jangan entry/);
      }
      if (dt.status === 'NO_TRADE') assert.equal(dt.verdict, 'AVOID');
    }
  });
});
