/**
 * Smart Money Accumulation Hunter — formulas, Risk Gate and status tests (docs/features_smartmoney_hunter.md).
 * Run: npm test
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  evaluateSmartMoney, measureSmartMoney, rankSmartMoney, SmartMoneyMeasures, smartMoneyPrefilter, SmartMoneyResult,
} from '@/domain/analysis/smartMoneyHunter';
import { BrokerSummaryRow, SmartMoneyFlows } from '@/domain/models/BrokerSummary';
import { OHLCVBar } from '@/domain/models/History';
import { StockSummary } from '@/domain/models/Stock';

const NOW = new Date('2026-10-16T12:00:00Z'); // 19.00 WIB

function summary(ticker: string, o: Partial<StockSummary> = {}): StockSummary {
  return {
    ticker, name: ticker, sector: 'Keuangan', subSector: '', lastClose: 600, prevClose: 590,
    percentChange1D: 1, percentChange1W: 3, percentChange1M: 0, percentChange3M: 0, percentChange6M: 0, percentChangeYtd: 0,
    percentChange1Y: 0, percentChange3Y: 0, percentChange5Y: 0, percentChange10Y: 0,
    high: 600, low: 590, volume: 1e7, value: 6e9, frequency: 0, capitalization: 1e13,
    per: 12, pbv: 1.2, roe: 10, freeFloat: 30, annualHigh: 0, annualLow: 0, ...o,
  };
}

/** Weekday bars ending on `end`. */
function bars(n: number, end: string, closeAt: (i: number) => number, volAt: (i: number) => number = () => 1e7): OHLCVBar[] {
  const dates: string[] = [];
  const d = new Date(`${end}T00:00:00Z`);
  while (dates.length < n) {
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) dates.unshift(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return dates.map((date, i) => {
    const c = closeAt(i);
    return { date, open: c, high: c * 1.01, low: c * 0.99, close: c, volume: volAt(i) };
  });
}

/** All-null measures; tests fill only what they need. */
function blank(o: Partial<SmartMoneyMeasures> = {}): SmartMoneyMeasures {
  const nulls = Object.fromEntries([
    'priceDate', 'close', 'change1D', 'lastVolume', 'adtv20', 'relValue5', 'rvol5', 'upCloses5', 'aboveMa20Count5', 'ma20', 'ma20Rising',
    'ma60', 'ema8', 'ema18', 'ema200', 'high52', 'distHigh52', 'rsi14', 'priorHigh20', 'low10', 'low20', 'high60', 'atr14', 'flowsAsOf',
    'flowsFetchedAt', 'foreignNet5', 'value5', 'foreignBuyDays', 'foreignDays', 'foreignNet20', 'brokerTopCode', 'brokerTopNet',
    'brokerTopShare', 'brokerImbalance', 'brokerConsistent', 'relTxCount', 'profitPositive', 'per', 'pbv', 'der', 'dividendRecent',
    'fundamentalsFetchedAt',
  ].map((k) => [k, null]));
  return { ticker: 'TEST', name: 'TEST', sector: '', bars: 0, stale: false, ...nulls, ...o } as SmartMoneyMeasures;
}

const ind = (r: SmartMoneyResult, key: string) => r.categories.flatMap((c) => c.indicators).find((i) => i.key === key)!;

const broker = (code: string, buyValue: number, sellValue: number, buyFreq = 100): BrokerSummaryRow => ({
  code, buyFreq, buyVolume: 0, buyValue, sellFreq: 0, sellVolume: 0, sellValue, buyAvg: 0, sellAvg: 0, netValue: buyValue - sellValue,
});

describe('Smart Money — fixture dokumen (sintetis, bukan data pasar)', () => {
  // Foreign net buy Rp3,3 M 4/5 hari; keramaian 2,56x; broker LG 35,4%; close naik 5/5; di atas MA 5/5;
  // MA 3 bulan Rp562; high 52 minggu Rp685; transaksi 2,17x; DER 0,16x; PBV 3,78x. Harga terakhir tidak diketahui.
  const fixture = blank({
    bars: 0, foreignNet5: 3.3e9, foreignBuyDays: 4, foreignDays: 5, relValue5: 2.56, brokerTopCode: 'LG', brokerTopNet: 1e9,
    brokerTopShare: 0.354, relTxCount: 2.17, upCloses5: 5, aboveMa20Count5: 5, ma60: 562, high52: 685, der: 0.16, pbv: 3.78,
  });
  const r = evaluateSmartMoney(fixture);

  test('sub-indicator points follow the documented tiers', () => {
    assert.equal(ind(r, 'foreignDays').points, 8);        // 4 dari 5 hari
    assert.equal(ind(r, 'brokerConcentration').points, 8); // ≥ 30%
    assert.equal(ind(r, 'relValue').points, 6);            // ≥ 2x
    assert.equal(ind(r, 'relTx').points, 4);               // ≥ 2x
    assert.equal(ind(r, 'upCloses').points, 5);
    assert.equal(ind(r, 'aboveMa20').points, 4);
    assert.equal(ind(r, 'der').points, 3);                 // < 0,5x
    assert.equal(ind(r, 'pbv').points, 0);                 // > 3x
  });

  test('unknown units/prices stay NOT AVAILABLE, never PASS', () => {
    // Nilai transaksi Rp5,2 "M" ambigu → value5 tidak diisi → intensitas asing N/A.
    assert.equal(ind(r, 'foreignIntensity').available, false);
    assert.equal(ind(r, 'ma60').available, false, 'MA60 known but last price unknown');
    assert.equal(ind(r, 'high52').available, false);
    assert.ok(r.coverage < 100);
  });

  test('no BUY from this fixture: price, entry and stop are unknown', () => {
    assert.equal(r.status, 'INSUFFICIENT_DATA');
    assert.equal(r.plan, null);
    assert.equal(r.gates.find((g) => g.key === 'data')!.result, 'FAIL');
  });
});

describe('Smart Money — rumus dari data', () => {
  const up = bars(260, '2026-10-16', (i) => 400 + i, (i) => (i >= 255 ? 3e7 : 1e7));

  test('activity ratios use the previous 20 sessions as baseline', () => {
    const m = measureSmartMoney({ summary: summary('AAAA'), bars: up, fundamentals: null, flows: null, now: NOW });
    assert.equal(m.rvol5, 3);
    // value = close × volume; closes 655–659 vs 635–654 → 3 × 657 / 644,5
    assert.ok(Math.abs(m.relValue5! - (3 * 657) / 644.5) < 1e-9);
    assert.equal(m.upCloses5, 5);
    assert.equal(m.aboveMa20Count5, 5);
    assert.ok(m.ma60! < m.close!);
    assert.equal(m.distHigh52, m.close! / m.high52!);
  });

  test('zero baseline volume → ratio null (no division by zero)', () => {
    const halted = bars(80, '2026-10-16', () => 500, (i) => (i >= 75 ? 1e7 : 0));
    const m = measureSmartMoney({ summary: summary('BBBB'), bars: halted, fundamentals: null, flows: null, now: NOW });
    assert.equal(m.rvol5, null);
    assert.equal(m.relValue5, null);
  });

  test('52-week high needs a full year of history', () => {
    const m = measureSmartMoney({ summary: summary('CCCC'), bars: up.slice(-120), fundamentals: null, flows: null, now: NOW });
    assert.equal(m.high52, null);
    assert.equal(m.ema200, null);
  });

  test('flows: foreign days, broker concentration and transaction count', () => {
    const dates = up.slice(-5).map((b) => b.date);
    const flows: SmartMoneyFlows = {
      ticker: 'AAAA', asOf: dates[4], from5: dates[0], from20: up[up.length - 20].date,
      foreignDaily: dates.map((date, k) => ({ date, netForeign: k === 2 ? -1e8 : 5e8 })),
      foreign5: null,
      foreign20: { foreignBuy: 9e9, foreignSell: 6e9, netForeign: 3e9 },
      broker5: [broker('LG', 4e9, 1e9, 300), broker('YP', 3e9, 3.5e9, 300), broker('CC', 3e9, 5.5e9, 400)],
      broker20: [broker('LG', 9e9, 4e9, 800), broker('YP', 9e9, 9e9, 800), broker('CC', 9e9, 14e9, 800)],
      source: 'indexalpha', fetchedAt: NOW.toISOString(),
    };
    const m = measureSmartMoney({ summary: summary('AAAA'), bars: up, fundamentals: null, flows, now: NOW });
    assert.equal(m.foreignBuyDays, 4);
    assert.equal(m.foreignNet5, 1.9e9);
    assert.equal(m.brokerTopCode, 'LG');
    assert.equal(m.brokerTopShare, 0.4);
    assert.equal(m.brokerImbalance, 3e9 / 3e9);
    assert.equal(m.brokerConsistent, true);
    assert.equal(m.relTxCount, (1000 / 5) / (2400 / 20));
  });

  test('a failed foreign day makes the 5-day totals unknown, not partial', () => {
    const dates = up.slice(-5).map((b) => b.date);
    const flows: SmartMoneyFlows = {
      ticker: 'AAAA', asOf: dates[4], from5: dates[0], from20: dates[0],
      foreignDaily: dates.map((date, k) => ({ date, netForeign: k === 1 ? null : 1e9 })),
      foreign5: null, foreign20: null, broker5: null, broker20: null, source: 'indexalpha', fetchedAt: NOW.toISOString(),
    };
    const m = measureSmartMoney({ summary: summary('AAAA'), bars: up, fundamentals: null, flows, now: NOW });
    assert.equal(m.foreignNet5, null);
    assert.equal(m.foreignBuyDays, null);
    assert.equal(m.foreignDays, 4);
  });

  test('daily calls disabled (Free plan): 5-day aggregate still scores, consistency stays N/A', () => {
    const dates = up.slice(-5).map((b) => b.date);
    const flows: SmartMoneyFlows = {
      ticker: 'AAAA', asOf: dates[4], from5: dates[0], from20: dates[0], foreignDaily: [],
      foreign5: { foreignBuy: 4e9, foreignSell: 1e9, netForeign: 3e9 }, foreign20: null, broker5: null, broker20: null,
      source: 'indexalpha', fetchedAt: NOW.toISOString(),
    };
    const r = evaluateSmartMoney(measureSmartMoney({ summary: summary('AAAA'), bars: up, fundamentals: null, flows, now: NOW }));
    assert.equal(r.measures.foreignNet5, 3e9);
    assert.equal(ind(r, 'foreignIntensity').available, true);
    assert.equal(ind(r, 'foreignDays').available, false);
  });

  test('PER/PBV 0 means not reported; negative PBV is negative equity', () => {
    const m0 = measureSmartMoney({ summary: summary('DDDD', { per: 0, roe: 0, pbv: 0 }), bars: up, fundamentals: null, flows: null, now: NOW });
    assert.equal(m0.profitPositive, null);
    assert.equal(m0.pbv, null);
    const neg = evaluateSmartMoney(measureSmartMoney({ summary: summary('EEEE', { per: -5, pbv: -0.4 }), bars: up, fundamentals: null, flows: null, now: NOW }));
    const g = neg.gates.find((x) => x.key === 'fundamental')!;
    assert.equal(g.result, 'FAIL');
    assert.match(g.reason, /rugi/);
    assert.match(g.reason, /ekuitas negatif/);
    assert.notEqual(neg.status, 'BUY_CANDIDATE');
  });
});

describe('Smart Money — Risk Gate dan status', () => {
  // Strong, liquid, fully covered stock: used as the base; each test breaks one thing.
  const strong = (o: Partial<SmartMoneyMeasures> = {}) => blank({
    bars: 250, priceDate: '2026-10-16', close: 600, change1D: 0.02, lastVolume: 1e7, adtv20: 2e10, relValue5: 2.2, rvol5: 2.1,
    upCloses5: 5, aboveMa20Count5: 5, ma20: 580, ma20Rising: true, ma60: 540, ema8: 590, ema18: 575, ema200: 500, high52: 760,
    distHigh52: 600 / 760, rsi14: 64, priorHigh20: 590, low10: 575, low20: 560, high60: 700, atr14: 15,
    flowsAsOf: '2026-10-16', foreignNet5: 3e9, value5: 5e10, foreignBuyDays: 5, foreignDays: 5, foreignNet20: 8e9,
    brokerTopCode: 'LG', brokerTopNet: 2e9, brokerTopShare: 0.35, brokerImbalance: 2, brokerConsistent: true, relTxCount: 2.1,
    profitPositive: true, per: 10, pbv: 1.2, der: 0.3, dividendRecent: true, ...o,
  });

  test('all gates pass + breakout + R:R ≥ 2 → BUY CANDIDATE', () => {
    const r = evaluateSmartMoney(strong());
    assert.ok(r.score >= 90, `score ${r.score}`);
    assert.equal(r.coverage, 100);
    assert.equal(r.plan!.trigger, 'BREAKOUT');
    assert.equal(r.plan!.stop, 575);   // max(low10 575, 600 − 2×15 = 570)
    assert.equal(r.plan!.target, 700); // resistance 60 sesi
    assert.equal(r.plan!.rr, 4);
    assert.equal(r.status, 'BUY_CANDIDATE');
  });

  test('Risk Gate beats score: illiquid → NO TRADE', () => {
    assert.equal(evaluateSmartMoney(strong({ adtv20: 5e8 })).status, 'NO_TRADE');
  });

  test('no trade on the last session (suspension proxy) → NO TRADE', () => {
    assert.equal(evaluateSmartMoney(strong({ lastVolume: 0 })).status, 'NO_TRADE');
  });

  test('stale or short history → INSUFFICIENT DATA', () => {
    assert.equal(evaluateSmartMoney(strong({ stale: true })).status, 'INSUFFICIENT_DATA');
    assert.equal(evaluateSmartMoney(strong({ bars: 40 })).status, 'INSUFFICIENT_DATA');
  });

  test('extended price → AVOID CHASING', () => {
    assert.equal(evaluateSmartMoney(strong({ rsi14: 80 })).status, 'AVOID_CHASING');
    assert.equal(evaluateSmartMoney(strong({ change1D: 0.12 })).status, 'AVOID_CHASING');
  });

  test('flows not fetched → coverage drops, max WAIT', () => {
    const r = evaluateSmartMoney(strong({
      flowsAsOf: null, foreignNet5: null, value5: null, foreignBuyDays: null, foreignDays: null, foreignNet20: null, brokerTopCode: null,
      brokerTopNet: null, brokerTopShare: null, brokerImbalance: null, brokerConsistent: null, relTxCount: null,
    }));
    assert.equal(r.coverage, 51);
    assert.equal(r.confidence, 'LOW');
    assert.equal(r.status, 'WAIT');
    assert.match(r.statusReason, /foreign\/broker/);
  });

  test('no trigger yet → WAIT with the trigger level', () => {
    const r = evaluateSmartMoney(strong({ close: 585, priorHigh20: 610, ma20: 560, change1D: 0 }));
    assert.equal(r.plan!.trigger, null);
    assert.equal(r.status, 'WAIT');
    assert.match(r.plan!.triggerNote, /610/);
  });

  test('fundamental flag caps at WAIT', () => {
    assert.equal(evaluateSmartMoney(strong({ der: 3 })).status, 'WAIT');
  });

  test('weak accumulation score → NO TRADE', () => {
    const r = evaluateSmartMoney(strong({
      foreignNet5: -3e9, foreignBuyDays: 0, foreignNet20: -1e9, brokerTopShare: 0.05, brokerImbalance: 0.5, brokerConsistent: false,
      relValue5: 0.8, rvol5: 0.8, relTxCount: 0.9, upCloses5: 1, aboveMa20Count5: 0, close: 530, priorHigh20: 600,
    }));
    assert.ok(r.score < 50, `score ${r.score}`);
    assert.equal(r.status, 'NO_TRADE');
  });
});

describe('Smart Money — screener', () => {
  test('prefilter keeps liquid stocks with a positive week, most liquid first', () => {
    const kept = smartMoneyPrefilter([
      summary('AAAA', { value: 2e9 }),
      summary('BBBB', { value: 9e9 }),
      summary('CCCC', { value: 5e8 }),
      summary('DDDD', { value: 9e9, percentChange1W: -1 }),
    ]).map((s) => s.ticker);
    assert.deepEqual(kept, ['BBBB', 'AAAA']);
  });

  test('ranking: status first, then score', () => {
    const mk = (t: string, status: SmartMoneyResult['status'], score: number) => ({ measures: blank({ ticker: t }), status, score }) as SmartMoneyResult;
    const ranked = rankSmartMoney([mk('A', 'WAIT', 90), mk('B', 'BUY_CANDIDATE', 70), mk('C', 'WAIT', 95), mk('D', 'NO_TRADE', 99)]);
    assert.deepEqual(ranked.map((r) => r.measures.ticker), ['B', 'C', 'A', 'D']);
  });
});
