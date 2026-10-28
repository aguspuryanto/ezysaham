/**
 * Strategi Retail EOD — hard gate, status and position sizing (docs/features_strategi_retail.md).
 * Run: npm test
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { evaluateRetailStrategy, positionSize, rankRetailStrategy, RetailStrategyResult } from '@/domain/analysis/retailStrategy';
import { BrokerSummaryRow, SmartMoneyFlows } from '@/domain/models/BrokerSummary';
import { OHLCVBar } from '@/domain/models/History';
import { StockSummary } from '@/domain/models/Stock';

const NOW = new Date('2026-10-16T12:00:00Z');
const PROFILE = { capital: 100_000_000, riskPerTrade: 0.01 };

function summary(ticker: string): StockSummary {
  return {
    ticker, name: ticker, sector: 'Keuangan', subSector: '', lastClose: 1000, prevClose: 990,
    percentChange1D: 1, percentChange1W: 3, percentChange1M: 0, percentChange3M: 0, percentChange6M: 0, percentChangeYtd: 0,
    percentChange1Y: 0, percentChange3Y: 0, percentChange5Y: 0, percentChange10Y: 0,
    high: 1000, low: 990, volume: 1e7, value: 1e10, frequency: 0, capitalization: 1e13,
    per: 12, pbv: 1.2, roe: 10, freeFloat: 30, annualHigh: 0, annualLow: 0,
  };
}

/** Weekday bars ending 2026-10-16: a gentle zig-zag uptrend, so RSI stays below the "extended" threshold. */
function bars(n: number, volume: number): OHLCVBar[] {
  const dates: string[] = [];
  const d = new Date('2026-10-16T00:00:00Z');
  while (dates.length < n) {
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) dates.unshift(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return dates.map((date, i) => {
    const c = 800 + i * 0.8 + (i % 4 < 2 ? 15 : -15);
    return { date, open: c - 2, high: c + 10, low: c - 10, close: c, volume };
  });
}

const broker = (code: string, buyValue: number, sellValue: number): BrokerSummaryRow => ({
  code, buyFreq: 100, buyVolume: 0, buyValue, sellFreq: 100, sellVolume: 0, sellValue, buyAvg: 0, sellAvg: 0, netValue: buyValue - sellValue,
});

function flows(rows: BrokerSummaryRow[]): SmartMoneyFlows {
  return {
    ticker: 'TEST', asOf: '2026-10-16', from5: '2026-10-12', from20: '2026-09-18', foreignDaily: [],
    foreign5: { foreignBuy: 2e9, foreignSell: 1e9, netForeign: 1e9 }, foreign20: { foreignBuy: 5e9, foreignSell: 4e9, netForeign: 1e9 },
    broker5: rows, broker20: rows, source: 'indexalpha', fetchedAt: NOW.toISOString(),
  };
}

const gate = (r: RetailStrategyResult, key: string) => r.gates.find((g) => g.key === key)!;

describe('Strategi Retail — hard gate', () => {
  test('without broker summary the distribution gate is UNKNOWN and the stock can never be LOLOS', () => {
    const r = evaluateRetailStrategy({ summary: summary('AAAA'), bars: bars(260, 5e6), flows: null, now: NOW }, PROFILE);
    assert.equal(gate(r, 'distribution').result, 'UNKNOWN');
    assert.notEqual(r.status, 'LOLOS');
    assert.ok(r.cancelReasons.some((c) => c.includes('TIDAK TERSEDIA')));
  });

  test('ADTV below Rp1 M fails liquidity → GUGUR', () => {
    const r = evaluateRetailStrategy({ summary: summary('BBBB'), bars: bars(260, 1000), flows: null, now: NOW }, PROFILE);
    assert.equal(gate(r, 'liquidity').result, 'FAIL');
    assert.equal(r.status, 'GUGUR');
  });

  test('strong broker distribution (net sell ≥ 2× net buy) → GUGUR', () => {
    const rows = [broker('AA', 2e9, 1e9), broker('BB', 1e9, 3e9), broker('CC', 0, 2e9), broker('DD', 0, 1e9)];
    const r = evaluateRetailStrategy({ summary: summary('CCCC'), bars: bars(260, 5e6), flows: flows(rows), now: NOW }, PROFILE);
    assert.equal(gate(r, 'distribution').result, 'FAIL');
    assert.equal(r.status, 'GUGUR');
  });

  test('balanced broker flow passes the distribution gate', () => {
    const rows = [broker('AA', 5e9, 1e9), broker('BB', 3e9, 1e9), broker('CC', 1e9, 2e9), broker('DD', 1e9, 2e9)];
    const r = evaluateRetailStrategy({ summary: summary('DDDD'), bars: bars(260, 5e6), flows: flows(rows), now: NOW }, PROFILE);
    assert.equal(gate(r, 'distribution').result, 'PASS');
  });

  test('net R:R includes fees, so it is below the gross R:R', () => {
    const r = evaluateRetailStrategy({ summary: summary('EEEE'), bars: bars(260, 5e6), flows: null, now: NOW }, PROFILE);
    assert.ok(r.plan && r.netRR != null);
    assert.ok(r.netRR! < r.plan!.rr);
  });
});

describe('Strategi Retail — ukuran posisi & urutan', () => {
  test('position is capped by the risk budget, in whole lots', () => {
    // Risiko Rp1 juta ÷ (Rp50 × 100) = 200 lot; modal cukup untuk 999 lot.
    const p = positionSize(1000, 50, PROFILE)!;
    assert.equal(p.lots, 200);
    assert.equal(p.shares, 20_000);
    assert.equal(p.limitedBy, 'risk');
  });

  test('position is capped by capital when the stop is very tight', () => {
    const p = positionSize(1000, 1, PROFILE)!;
    assert.equal(p.lots, 998); // 100 jt ÷ (1000 × 1,0015 × 100)
    assert.equal(p.limitedBy, 'capital');
  });

  test('ranking: status first, then gates passed', () => {
    const mk = (ticker: string, status: RetailStrategyResult['status'], pass: number) => ({
      ticker, status, netRR: 1, gates: Array.from({ length: 8 }, (_, i) => ({ result: i < pass ? 'PASS' : 'FAIL' })),
    }) as unknown as RetailStrategyResult;
    const ranked = rankRetailStrategy([mk('G', 'GUGUR', 7), mk('T1', 'TUNGGU', 5), mk('T2', 'TUNGGU', 6), mk('L', 'LOLOS', 8)]);
    assert.deepEqual(ranked.map((r) => r.ticker), ['L', 'T2', 'T1', 'G']);
  });
});
