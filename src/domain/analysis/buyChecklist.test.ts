/**
 * Buy checklist (docs/features_checklist_buy.md): structural rules + oscillator sanity.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { buildBuyChecklist, BuyChecklistInput } from '@/domain/analysis/buyChecklist';
import { barsFrom, zigzag } from '@/domain/analysis/momentumTestFixtures';
import { computeStockAnalysis } from '@/domain/analysis/stockAnalysisEngine';
import { cci, cmo, mfi, stochasticSlow, williamsR } from '@/domain/indicators/oscillators';
import { OHLCVBar } from '@/domain/models/History';
import { StockNewsItem } from '@/domain/models/News';
import { StockSummary } from '@/domain/models/Stock';

const AS_OF = new Date('2025-07-01T10:00:00Z');

function summaryFor(bars: OHLCVBar[]): StockSummary {
  const last = bars[bars.length - 1];
  const prev = bars[bars.length - 2];
  const chg = (k: number) => ((last.close / bars[bars.length - 1 - k].close) - 1) * 100;
  const highs = bars.map((b) => b.high);
  const lows = bars.map((b) => b.low);
  return {
    ticker: 'TEST', name: 'Test Tbk', sector: 'Keuangan', subSector: '',
    lastClose: last.close, prevClose: prev.close,
    percentChange1D: chg(1), percentChange1W: chg(5), percentChange1M: chg(21),
    percentChange3M: 0, percentChange6M: 0, percentChangeYtd: 0, percentChange1Y: 0, percentChange3Y: 0, percentChange5Y: 0, percentChange10Y: 0,
    high: last.high, low: last.low, volume: last.volume, value: last.close * last.volume, frequency: 10_000,
    capitalization: 40e12, per: 11, pbv: 2, roe: 18, freeFloat: 45, annualHigh: Math.max(...highs), annualLow: Math.min(...lows),
  };
}

const okNews: StockNewsItem = {
  id: '1', title: 'TEST bukukan kinerja stabil', snippet: '', url: '', publisher: 'x', publishedAt: '',
  publishedAtMs: AS_OF.getTime() - 3 * 86_400_000, sentiment: 'neutral', impactScore: 2, relevance: 'DIRECT',
};

function inputFor(bars: OHLCVBar[], over: Partial<BuyChecklistInput> = {}): BuyChecklistInput {
  const summary = summaryFor(bars);
  return {
    summary, bars, analysis: computeStockAnalysis(summary, bars), fundamentals: null,
    news: [okNews], newsLoading: false, ihsgBars: barsFrom(7000, zigzag(120, 0.3, 0.3)), asOf: AS_OF, ...over,
  };
}

describe('oscillators', () => {
  const bars = barsFrom(1000, zigzag(80, 1, 0.8));
  test('ranges', () => {
    const last = (s: number[]) => s[s.length - 1];
    const k = last(stochasticSlow(bars).k);
    assert.ok(k >= 0 && k <= 100);
    assert.ok(last(mfi(bars)) >= 0 && last(mfi(bars)) <= 100);
    assert.ok(last(williamsR(bars)) <= 0 && last(williamsR(bars)) >= -100);
    assert.ok(Math.abs(last(cmo(bars))) <= 100);
    assert.ok(Number.isFinite(last(cci(bars))));
  });
  test('NaN without history, never 0', () => {
    assert.ok(Number.isNaN(mfi(bars.slice(0, 5))[4]));
    assert.ok(Number.isNaN(cci(bars.slice(0, 5))[4]));
  });
  test('sell-off is oversold', () => {
    const down = barsFrom(1000, [...zigzag(40, 0.5, 0.5), ...Array.from({ length: 12 }, () => ({ pct: -3 }))]);
    const last = (s: number[]) => s[s.length - 1];
    assert.ok(last(williamsR(down)) < -80);
    assert.ok(last(cmo(down)) < -50);
    assert.ok(last(stochasticSlow(down).k) < 20);
  });
});

describe('buy checklist', () => {
  test('sharp downtrend ⇒ JANGAN BELI', () => {
    const r = buildBuyChecklist(inputFor(barsFrom(5000, zigzag(120, 0.6, 1.8))));
    assert.equal(r.mandatory[0].status, 'TIDAK');
    assert.equal(r.decision, 'JANGAN BELI');
  });

  test('severe news ⇒ syarat 2 TIDAK and never BELI', () => {
    const bars = barsFrom(3000, zigzag(120, 1.2, 0.7));
    const bad: StockNewsItem = { ...okNews, id: '2', title: 'BEI suspensi saham TEST', sentiment: 'bearish', impactScore: 5 };
    const r = buildBuyChecklist(inputFor(bars, { news: [bad] }));
    assert.equal(r.mandatory[1].status, 'TIDAK');
    assert.notEqual(r.decision, 'BELI BERTAHAP');
  });

  test('no news ⇒ TIDAK CUKUP DATA, so not BELI', () => {
    const r = buildBuyChecklist(inputFor(barsFrom(3000, zigzag(120, 1.2, 0.7)), { news: [] }));
    assert.equal(r.mandatory[1].status, 'TIDAK CUKUP DATA');
    assert.notEqual(r.decision, 'BELI BERTAHAP');
  });

  test('fresh breakout on volume ⇒ scenario B evaluated with SL below broken resistance', () => {
    const bars = barsFrom(3000, [...zigzag(100, 0.9, 0.85), ...zigzag(19, 0.4, 0.4), { pct: 4, vol: 15_000_000, wick: 0.3 }]);
    const r = buildBuyChecklist(inputFor(bars));
    const b = r.scenarios.find((s) => s.id === 'B')!;
    assert.equal(b.criteria[0].ok, true);
    assert.equal(b.criteria[2].ok, true);
    assert.equal(b.criteria[1].ok, true);
    if (b.plan) assert.ok(b.plan.sl < b.plan.entryLow);
  });

  test('BELI only when all mandatory pass, a scenario matches and ≥ 2 confirmations', () => {
    const cases = [
      barsFrom(3000, zigzag(120, 1.2, 0.7)),
      barsFrom(3000, [...zigzag(100, 0.9, 0.85), ...zigzag(19, 0.4, 0.4), { pct: 4, vol: 15_000_000 }]),
      barsFrom(1000, [...zigzag(80, 0.5, 0.5), ...Array.from({ length: 10 }, () => ({ pct: -3 })), { pct: 3, vol: 9_000_000, open: -1.5 }]),
    ];
    for (const bars of cases) {
      const r = buildBuyChecklist(inputFor(bars));
      if (r.decision === 'BELI BERTAHAP') {
        assert.ok(r.mandatory.every((m) => m.status === 'LOLOS'));
        assert.ok(r.selected);
        assert.ok(r.confirmCount >= 2);
        assert.ok(r.riskReward != null && r.riskReward >= 2);
      }
      if (r.plan) assert.ok(r.plan.sl < r.plan.entryLow && r.plan.riskPerShare > 0);
    }
  });

  test('short history ⇒ WATCHLIST with missing data, no crash', () => {
    const r = buildBuyChecklist(inputFor(barsFrom(1000, zigzag(25, 1, 0.5))));
    assert.equal(r.dataOk, false);
    assert.equal(r.decision, 'WATCHLIST');
    assert.ok(r.missing.length > 0);
  });
});
