/**
 * smartMoneyHunter.ts
 *
 * Smart Money Accumulation Hunter (docs/features_smartmoney_hunter.md): a probabilistic screen for foreign/broker
 * accumulation + rising activity + positive momentum + healthy fundamentals. Not proof of "bandar" activity and not a
 * validated profit probability.
 *
 *   measureSmartMoney()  raw measures from EOD bars (Yahoo), the Pasardana snapshot, Yahoo fundamentals and
 *                        Index Alpha flows. Anything missing stays null.
 *   evaluateSmartMoney() 0–100 score over the indicators that ARE available (coverage + confidence shown
 *                        separately), hard Risk Gate, status and trade plan. The Risk Gate beats the score.
 *
 * Statuses are this feature's own (BUY CANDIDATE / WAIT / AVOID CHASING / NO TRADE / INSUFFICIENT DATA); the
 * Decision Engine's BUY/WAIT/AVOID is not touched. Pure — the caller fetches the data.
 */

import { computeDataFreshness } from '@/domain/analysis/dataFreshness';
import { roundToTick } from '@/domain/analysis/idxTick';
import { priorHigh } from '@/domain/history/breakoutEvents';
import { atr } from '@/domain/indicators/atr';
import { closes, ema, sma } from '@/domain/indicators/movingAverages';
import { rsi } from '@/domain/indicators/rsi';
import { SmartMoneyFlows } from '@/domain/models/BrokerSummary';
import { FundamentalDetail } from '@/domain/models/Fundamentals';
import { OHLCVBar } from '@/domain/models/History';
import { StockSummary } from '@/domain/models/Stock';

// ── Config ────────────────────────────────────────────────────────────────────
export const SMART_MONEY_CONFIG = {
  minAdtv20: 1e9,          // Risk Gate likuiditas: rata-rata nilai 20 hari ≥ Rp1 M
  minBars: 60,             // MA60 butuh 60 sesi
  minScoreWatch: 50,       // di bawah ini: indikasi akumulasi lemah → NO TRADE
  minScoreBuy: 70,
  minRR: 2,
  chaseRsi: 75,            // AVOID CHASING bila RSI14 > 75 …
  chaseAboveMa20: 0.15,    // … atau close > MA20 + 15% …
  chaseDayGain: 0.1,       // … atau naik ≥ 10% hari ini
  maxDer: 2,               // DER > 2x → flag
  prefilterMax: 60,
} as const;

export type SmStatus = 'BUY_CANDIDATE' | 'WAIT' | 'AVOID_CHASING' | 'NO_TRADE' | 'INSUFFICIENT_DATA';
export type SmCategoryKey = 'foreign' | 'broker' | 'activity' | 'momentum' | 'fundamental';
export type SmConfidence = 'HIGH' | 'MEDIUM' | 'LOW';
export type SmGateResult = 'PASS' | 'FAIL' | 'UNKNOWN';
export type SmSource = 'Index Alpha' | 'Yahoo Finance' | 'Pasardana';

/** Raw measures. Ratios are plain (0,05 = 5%); money in IDR. Null = not available — never scored as PASS or 0. */
export interface SmartMoneyMeasures {
  ticker: string;
  name: string;
  sector: string;
  /** Last daily bar date (YYYY-MM-DD). */
  priceDate: string | null;
  bars: number;
  stale: boolean;
  close: number | null;
  change1D: number | null;
  lastVolume: number | null;
  adtv20: number | null;
  relValue5: number | null;
  rvol5: number | null;
  upCloses5: number | null;
  aboveMa20Count5: number | null;
  ma20: number | null;
  ma20Rising: boolean | null;
  ma60: number | null;
  ema8: number | null;
  ema18: number | null;
  ema200: number | null;
  high52: number | null;
  /** close / high 52 minggu. */
  distHigh52: number | null;
  rsi14: number | null;
  priorHigh20: number | null;
  low10: number | null;
  low20: number | null;
  high60: number | null;
  atr14: number | null;
  // Flows (Index Alpha)
  flowsAsOf: string | null;
  flowsFetchedAt: string | null;
  foreignNet5: number | null;
  /** Total value traded over the same 5 sessions (bars), the denominator of foreign intensity. */
  value5: number | null;
  foreignBuyDays: number | null;
  foreignDays: number | null;
  foreignNet20: number | null;
  brokerTopCode: string | null;
  brokerTopNet: number | null;
  brokerTopShare: number | null;
  brokerImbalance: number | null;
  brokerConsistent: boolean | null;
  relTxCount: number | null;
  // Fundamentals
  profitPositive: boolean | null;
  per: number | null;
  pbv: number | null;
  der: number | null;
  dividendRecent: boolean | null;
  fundamentalsFetchedAt: string | null;
}

export interface SmIndicator {
  key: string;
  label: string;
  formula: string;
  period: string;
  source: SmSource;
  value: number | null;
  display: string;
  points: number;
  max: number;
  available: boolean;
}

export interface SmCategory {
  key: SmCategoryKey;
  label: string;
  max: number;
  earned: number;
  /** Max points of the indicators that have data. */
  knownMax: number;
  indicators: SmIndicator[];
}

export interface SmGate {
  key: string;
  label: string;
  result: SmGateResult;
  reason: string;
}

export interface SmTradePlan {
  trigger: 'BREAKOUT' | 'PULLBACK' | null;
  triggerNote: string;
  entry: number;
  stop: number;
  target: number;
  targetBasis: string;
  returnPct: number;
  riskPct: number;
  rr: number;
  invalidation: string;
  support: number | null;
  resistance: number | null;
}

export interface SmartMoneyResult {
  measures: SmartMoneyMeasures;
  categories: SmCategory[];
  /** 0–100 over available indicators. */
  score: number;
  /** % of the 100 points that had data. */
  coverage: number;
  confidence: SmConfidence;
  gates: SmGate[];
  status: SmStatus;
  statusReason: string;
  plan: SmTradePlan | null;
  positives: string[];
  negatives: string[];
  conclusion: { reason: string; risk: string; confirm: string };
}

// ── Measures ──────────────────────────────────────────────────────────────────
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const num = (n: number) => (Number.isFinite(n) ? n : null);
/** a / b, null when the baseline is missing or not positive (no division by zero). */
const ratio = (a: number | null, b: number | null) => (a != null && b != null && b > 0 ? a / b : null);

export interface SmartMoneyInput {
  summary: StockSummary;
  bars: OHLCVBar[];
  fundamentals: FundamentalDetail | null;
  flows: SmartMoneyFlows | null;
  now: Date;
}

export function measureSmartMoney({ summary, bars, fundamentals, flows, now }: SmartMoneyInput): SmartMoneyMeasures {
  const n = bars.length;
  const c = closes(bars);
  const last = n - 1;
  const values = bars.map((b) => b.close * b.volume);
  const at = (series: number[]) => (n ? num(series[last]) : null);
  const ma20 = sma(c, 20), ma60 = sma(c, 60), e8 = ema(c, 8), e18 = ema(c, 18), e200 = ema(c, 200);
  const rsi14 = n ? rsi(bars, 14) : [], atr14 = n ? atr(bars, 14) : [];
  const window = (from: number, to: number) => (from >= 0 ? { v: values.slice(from, to), vol: bars.slice(from, to).map((b) => b.volume) } : null);
  const recent5 = window(n - 5, n), base20 = window(n - 25, n - 5);

  // 52-week high only when the history really covers a year.
  let high52: number | null = null;
  if (n) {
    const lastDate = new Date(`${bars[last].date.slice(0, 10)}T00:00:00Z`);
    const yearAgo = new Date(lastDate.getTime() - 365 * 864e5).toISOString().slice(0, 10);
    const covered = new Date(lastDate.getTime() - 350 * 864e5).toISOString().slice(0, 10);
    if (bars[0].date.slice(0, 10) <= covered) high52 = Math.max(...bars.filter((b) => b.date.slice(0, 10) >= yearAgo).map((b) => b.high));
  }
  const close = n ? c[last] : null;

  // Flows: foreign intensity is measured against the value traded on the same 5 sessions.
  let foreignNet5: number | null = null, foreignBuyDays: number | null = null, foreignDays: number | null = null, value5: number | null = null;
  let brokerTopCode: string | null = null, brokerTopNet: number | null = null, brokerTopShare: number | null = null;
  let brokerImbalance: number | null = null, brokerConsistent: boolean | null = null, relTxCount: number | null = null;
  if (flows) {
    // Daily consistency needs all 5 days; a partial count would overstate or understate it.
    const known = flows.foreignDaily.filter((d) => d.netForeign != null);
    foreignDays = known.length;
    const dailyComplete = known.length === 5 && flows.foreignDaily.length === 5;
    if (dailyComplete) foreignBuyDays = known.filter((d) => d.netForeign! > 0).length;
    foreignNet5 = flows.foreign5?.netForeign ?? (dailyComplete ? known.reduce((s, d) => s + d.netForeign!, 0) : null);
    const k = bars.findIndex((b) => b.date.slice(0, 10) === flows.asOf);
    if (k >= 4) value5 = values.slice(k - 4, k + 1).reduce((a, b) => a + b, 0);
    if (flows.broker5 && flows.broker5.length) {
      const rows = [...flows.broker5].sort((a, b) => b.netValue - a.netValue);
      const totalBuy = rows.reduce((s, r) => s + r.buyValue, 0);
      const top = rows[0];
      brokerTopCode = top.code;
      brokerTopNet = top.netValue;
      brokerTopShare = top.netValue > 0 ? ratio(top.buyValue, totalBuy) : 0;
      const buy3 = rows.slice(0, 3).filter((r) => r.netValue > 0).reduce((s, r) => s + r.netValue, 0);
      const sell3 = -rows.slice(-3).filter((r) => r.netValue < 0).reduce((s, r) => s + r.netValue, 0);
      brokerImbalance = ratio(buy3, sell3);
      const tx5 = rows.reduce((s, r) => s + r.buyFreq, 0);
      if (flows.broker20 && flows.broker20.length) {
        const tx20 = flows.broker20.reduce((s, r) => s + r.buyFreq, 0);
        relTxCount = ratio(tx5 / 5, tx20 / 20);
        brokerConsistent = top.netValue > 0 && (flows.broker20.find((r) => r.code === top.code)?.netValue ?? 0) > 0;
      }
    }
  }

  // Pasardana PER/PBV: 0 means "not reported"; negative PER = loss, negative PBV = negative equity.
  const per = summary.per !== 0 && Number.isFinite(summary.per) ? summary.per : null;
  const pbv = summary.pbv !== 0 && Number.isFinite(summary.pbv) ? summary.pbv : null;
  const roe = summary.roe !== 0 && Number.isFinite(summary.roe) ? summary.roe : null;
  const twoYearsAgo = new Date(now.getTime() - 730 * 864e5).toISOString().slice(0, 10);

  return {
    ticker: summary.ticker,
    name: summary.name,
    sector: summary.sector,
    priceDate: n ? bars[last].date.slice(0, 10) : null,
    bars: n,
    stale: n ? computeDataFreshness([{ ...bars[last], date: bars[last].date.slice(0, 10) }], now)?.tier === 'stale' : false,
    close,
    change1D: n >= 2 ? c[last] / c[last - 1] - 1 : null,
    lastVolume: n ? bars[last].volume : null,
    adtv20: n >= 20 ? avg(values.slice(-20)) : null,
    relValue5: recent5 && base20 ? ratio(avg(recent5.v), avg(base20.v)) : null,
    rvol5: recent5 && base20 ? ratio(avg(recent5.vol), avg(base20.vol)) : null,
    upCloses5: n >= 6 ? [1, 2, 3, 4, 5].filter((k) => c[n - k] > c[n - k - 1]).length : null,
    aboveMa20Count5: n >= 24 ? [1, 2, 3, 4, 5].filter((k) => c[n - k] > ma20[n - k]).length : null,
    ma20: at(ma20),
    ma20Rising: n >= 25 ? ma20[last] > ma20[last - 5] : null,
    ma60: at(ma60),
    ema8: at(e8),
    ema18: at(e18),
    ema200: n >= 200 ? at(e200) : null,
    high52,
    distHigh52: ratio(close, high52),
    rsi14: n ? num(rsi14[last]) : null,
    priorHigh20: n > 20 ? num(priorHigh(bars, last)) : null,
    low10: n >= 10 ? Math.min(...bars.slice(-10).map((b) => b.low)) : null,
    low20: n >= 20 ? Math.min(...bars.slice(-20).map((b) => b.low)) : null,
    high60: n > 60 ? num(priorHigh(bars, last, 60)) : null,
    atr14: n ? num(atr14[last]) : null,
    flowsAsOf: flows?.asOf ?? null,
    flowsFetchedAt: flows?.fetchedAt ?? null,
    foreignNet5,
    value5,
    foreignBuyDays,
    foreignDays,
    foreignNet20: flows?.foreign20?.netForeign ?? null,
    brokerTopCode,
    brokerTopNet,
    brokerTopShare,
    brokerImbalance,
    brokerConsistent,
    relTxCount,
    profitPositive: per != null ? per > 0 : roe != null ? roe > 0 : null,
    per,
    pbv,
    der: fundamentals?.debtToEquity != null ? fundamentals.debtToEquity / 100 : null,
    dividendRecent: fundamentals?.dividendHistory ? fundamentals.dividendHistory.some((d) => d.date >= twoYearsAgo) : null,
    fundamentalsFetchedAt: fundamentals?.fetchedAt ?? null,
  };
}

// ── Scoring ───────────────────────────────────────────────────────────────────
type Tier = [threshold: number, points: number];
/** Points of the first tier whose threshold the value reaches (tiers sorted high → low). */
const tier = (v: number, tiers: Tier[]) => tiers.find(([t]) => v >= t)?.[1] ?? 0;

const pct = (v: number, dec = 1) => `${(v * 100).toLocaleString('id-ID', { maximumFractionDigits: dec })}%`;
const x = (v: number) => `${v.toLocaleString('id-ID', { maximumFractionDigits: 2 })}x`;
const rp = (v: number) => {
  const a = Math.abs(v), s = v < 0 ? '−' : '';
  if (a >= 1e12) return `${s}Rp${(a / 1e12).toLocaleString('id-ID', { maximumFractionDigits: 2 })} T`;
  if (a >= 1e9) return `${s}Rp${(a / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 2 })} M`;
  if (a >= 1e6) return `${s}Rp${(a / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`;
  return `${s}Rp${a.toLocaleString('id-ID', { maximumFractionDigits: 0 })}`;
};
const px = (v: number) => v.toLocaleString('id-ID', { maximumFractionDigits: 0 });

interface Def {
  key: string; label: string; formula: string; period: string; source: SmSource; max: number;
  value: (m: SmartMoneyMeasures) => number | null;
  points: (v: number, m: SmartMoneyMeasures) => number;
  display: (v: number, m: SmartMoneyMeasures) => string;
}

const bool = (b: boolean | null) => (b == null ? null : b ? 1 : 0);

export const SMART_MONEY_CATEGORIES: Array<{ key: SmCategoryKey; label: string; defs: Def[] }> = [
  {
    key: 'foreign', label: 'Foreign Flow', defs: [
      { key: 'foreignIntensity', label: 'Net buy asing 5 hari', formula: 'Σ net foreign 5 hari ÷ nilai transaksi 5 sesi yang sama', period: '5 sesi', source: 'Index Alpha', max: 10,
        value: (m) => (m.foreignNet5 != null ? ratio(m.foreignNet5, m.value5) : null),
        points: (v) => (v > 0 ? tier(v, [[0.05, 10], [0.02, 7], [0, 4]]) : 0),
        display: (v, m) => `${rp(m.foreignNet5!)} (${pct(v)} dari nilai)` },
      { key: 'foreignDays', label: 'Hari net buy asing', formula: 'Jumlah hari net foreign > 0', period: '5 sesi', source: 'Index Alpha', max: 10,
        value: (m) => m.foreignBuyDays,
        points: (v) => tier(v, [[5, 10], [4, 8], [3, 4]]),
        display: (v) => `${v} dari 5 hari` },
      { key: 'foreign20', label: 'Tren asing 20 hari', formula: 'Net foreign 20 hari > 0', period: '20 sesi', source: 'Index Alpha', max: 5,
        value: (m) => m.foreignNet20,
        points: (v) => (v > 0 ? 5 : 0),
        display: (v) => rp(v) },
    ],
  },
  {
    key: 'broker', label: 'Broker Accumulation', defs: [
      { key: 'brokerConcentration', label: 'Konsentrasi broker net buy terbesar', formula: 'Buy value broker net-buy terbesar ÷ total buy value semua broker', period: '5 sesi, pasar RG', source: 'Index Alpha', max: 8,
        value: (m) => m.brokerTopShare,
        points: (v) => tier(v, [[0.3, 8], [0.2, 5], [0.1, 2]]),
        display: (v, m) => (m.brokerTopNet != null && m.brokerTopNet > 0 ? `${m.brokerTopCode} ${pct(v)} (net ${rp(m.brokerTopNet)})` : 'Tidak ada broker net buy') },
      { key: 'brokerImbalance', label: 'Net buy top-3 vs net sell top-3', formula: 'Σ net buy 3 broker teratas ÷ |Σ net sell 3 broker terbawah|', period: '5 sesi, pasar RG', source: 'Index Alpha', max: 6,
        value: (m) => m.brokerImbalance,
        points: (v) => tier(v, [[1.5, 6], [1, 3]]),
        display: (v) => x(v) },
      { key: 'brokerConsistency', label: 'Konsistensi broker', formula: 'Broker net buy terbesar 5 hari juga net buy 20 hari', period: '5 & 20 sesi', source: 'Index Alpha', max: 6,
        value: (m) => bool(m.brokerConsistent),
        points: (v) => (v ? 6 : 0),
        display: (v, m) => (v ? `${m.brokerTopCode} net buy di 5 & 20 hari` : 'Tidak konsisten') },
    ],
  },
  {
    key: 'activity', label: 'Activity & Liquidity', defs: [
      { key: 'relValue', label: 'Nilai transaksi relatif', formula: 'Rata-rata nilai 5 sesi terakhir ÷ rata-rata 20 sesi sebelumnya', period: '5 vs 20 sesi', source: 'Yahoo Finance', max: 6,
        value: (m) => m.relValue5,
        points: (v) => tier(v, [[2, 6], [1.5, 4], [1.2, 2]]),
        display: (v) => x(v) },
      { key: 'rvol', label: 'Volume relatif (RVOL)', formula: 'Rata-rata volume 5 sesi terakhir ÷ rata-rata 20 sesi sebelumnya', period: '5 vs 20 sesi', source: 'Yahoo Finance', max: 4,
        value: (m) => m.rvol5,
        points: (v) => tier(v, [[2, 4], [1.5, 3], [1.2, 1]]),
        display: (v) => x(v) },
      { key: 'relTx', label: 'Jumlah transaksi relatif', formula: '(Σ buy freq 5 sesi ÷ 5) ÷ (Σ buy freq 20 sesi ÷ 20); 20 sesi termasuk 5 sesi terakhir', period: '5 vs 20 sesi', source: 'Index Alpha', max: 4,
        value: (m) => m.relTxCount,
        points: (v) => tier(v, [[2, 4], [1.5, 3], [1.2, 1]]),
        display: (v) => x(v) },
      { key: 'adtv', label: 'Rata-rata nilai transaksi harian', formula: 'Rata-rata close × volume', period: '20 sesi', source: 'Yahoo Finance', max: 6,
        value: (m) => m.adtv20,
        points: (v) => tier(v, [[1e10, 6], [5e9, 4], [1e9, 2]]),
        display: (v) => rp(v) },
    ],
  },
  {
    key: 'momentum', label: 'Price Momentum', defs: [
      { key: 'upCloses', label: 'Penutupan menguat', formula: 'Jumlah hari close > close sebelumnya', period: '5 sesi', source: 'Yahoo Finance', max: 5,
        value: (m) => m.upCloses5,
        points: (v) => tier(v, [[5, 5], [4, 4], [3, 2]]),
        display: (v) => `${v} dari 5 hari` },
      { key: 'aboveMa20', label: 'Close di atas MA20', formula: 'Jumlah hari close > SMA20', period: '5 sesi', source: 'Yahoo Finance', max: 4,
        value: (m) => m.aboveMa20Count5,
        points: (v) => tier(v, [[5, 4], [4, 3], [3, 1]]),
        display: (v) => `${v} dari 5 hari` },
      { key: 'ma60', label: 'Close vs MA60', formula: 'Close > SMA 60 sesi', period: '60 sesi', source: 'Yahoo Finance', max: 5,
        value: (m) => (m.close != null && m.ma60 != null ? m.close / m.ma60 - 1 : null),
        points: (v) => (v > 0 ? 5 : 0),
        display: (v, m) => `MA60 ${px(m.ma60!)} (${v >= 0 ? '+' : ''}${pct(v)})` },
      { key: 'ema818', label: 'EMA8 > EMA18', formula: 'EMA8 > EMA18', period: '8 & 18 sesi', source: 'Yahoo Finance', max: 3,
        value: (m) => (m.ema8 != null && m.ema18 != null ? m.ema8 / m.ema18 - 1 : null),
        points: (v) => (v > 0 ? 3 : 0),
        display: (v) => (v > 0 ? 'Ya' : 'Tidak') },
      { key: 'ema200', label: 'Close vs EMA200', formula: 'Close > EMA200', period: '200 sesi', source: 'Yahoo Finance', max: 3,
        value: (m) => (m.close != null && m.ema200 != null ? m.close / m.ema200 - 1 : null),
        points: (v) => (v > 0 ? 3 : 0),
        display: (v, m) => `EMA200 ${px(m.ema200!)}` },
      { key: 'high52', label: 'Jarak ke high 52 minggu', formula: 'Close ÷ high 52 minggu', period: '52 minggu', source: 'Yahoo Finance', max: 5,
        value: (m) => m.distHigh52,
        points: (v) => tier(v, [[0.9, 5], [0.8, 3], [0.7, 1]]),
        display: (v, m) => `${pct(v, 0)} dari ${px(m.high52!)}` },
    ],
  },
  {
    key: 'fundamental', label: 'Fundamental Quality', defs: [
      { key: 'profit', label: 'Laba bersih positif', formula: 'PER > 0 (atau ROE > 0 bila PER tidak tersedia)', period: 'TTM', source: 'Pasardana', max: 4,
        value: (m) => bool(m.profitPositive),
        points: (v) => (v ? 4 : 0),
        display: (v) => (v ? 'Laba' : 'Rugi') },
      { key: 'der', label: 'DER (total utang ÷ ekuitas)', formula: 'Total debt ÷ total equity (definisi Yahoo, bukan total liabilitas)', period: 'Laporan terakhir', source: 'Yahoo Finance', max: 3,
        value: (m) => m.der,
        points: (v) => (v < 0 ? 0 : v < 0.5 ? 3 : v < 1 ? 2 : v < 2 ? 1 : 0),
        display: (v) => x(v) },
      { key: 'pbv', label: 'PBV', formula: 'Harga ÷ nilai buku per saham', period: 'Snapshot', source: 'Pasardana', max: 2,
        value: (m) => m.pbv,
        points: (v) => (v <= 0 ? 0 : v <= 1.5 ? 2 : v <= 3 ? 1 : 0),
        display: (v) => (v < 0 ? `${x(v)} (ekuitas negatif)` : x(v)) },
      { key: 'dividend', label: 'Riwayat dividen', formula: 'Ada pembagian dividen dalam 2 tahun terakhir (bukan jaminan dividen berikutnya)', period: '2 tahun', source: 'Yahoo Finance', max: 1,
        value: (m) => bool(m.dividendRecent),
        points: (v) => (v ? 1 : 0),
        display: (v) => (v ? 'Ada' : 'Tidak ada') },
    ],
  },
];

function scoreCategories(m: SmartMoneyMeasures): SmCategory[] {
  return SMART_MONEY_CATEGORIES.map(({ key, label, defs }) => {
    const indicators = defs.map((d): SmIndicator => {
      const v = d.value(m);
      const available = v != null && Number.isFinite(v);
      return {
        key: d.key, label: d.label, formula: d.formula, period: d.period, source: d.source, max: d.max, value: v, available,
        points: available ? d.points(v, m) : 0,
        display: available ? d.display(v, m) : 'N/A',
      };
    });
    return {
      key, label, indicators,
      max: defs.reduce((s, d) => s + d.max, 0),
      earned: indicators.reduce((s, i) => s + i.points, 0),
      knownMax: indicators.filter((i) => i.available).reduce((s, i) => s + i.max, 0),
    };
  });
}

// ── Trade plan ────────────────────────────────────────────────────────────────
function buildPlan(m: SmartMoneyMeasures): SmTradePlan | null {
  const { close, atr14, low10, ma20, priorHigh20 } = m;
  if (close == null || atr14 == null || low10 == null || ma20 == null || priorHigh20 == null || m.bars < SMART_MONEY_CONFIG.minBars) return null;
  const breakout = close > priorHigh20;
  const pullback = m.ma20Rising === true && close >= ma20 && close <= ma20 * 1.03 && (m.ma60 == null || close > m.ma60);
  const trigger = breakout ? 'BREAKOUT' : pullback ? 'PULLBACK' : null;
  const stop = roundToTick(Math.max(low10, close - 2 * atr14));
  if (stop <= 0 || stop >= close) return null;
  const [rawTarget, targetBasis] =
    m.high60 != null && m.high60 >= close * 1.05 ? [m.high60, 'Resistance 60 sesi']
    : m.high52 != null && m.high52 >= close * 1.05 ? [m.high52, 'High 52 minggu']
    : [close + 3 * atr14, 'Proyeksi close + 3×ATR14'];
  const target = roundToTick(rawTarget);
  return {
    trigger,
    triggerNote: breakout
      ? `Breakout: close di atas high 20 sesi (${px(priorHigh20)}).`
      : pullback
        ? `Pullback ke MA20 (${px(ma20)}) yang sedang naik.`
        : `Belum ada trigger. Tunggu close di atas ${px(priorHigh20)} (high 20 sesi) atau pullback ke MA20 ${px(ma20)}.`,
    entry: close,
    stop,
    target,
    targetBasis,
    returnPct: target / close - 1,
    riskPct: 1 - stop / close,
    rr: (target - close) / (close - stop),
    invalidation: `Close di bawah ${px(stop)}.`,
    support: m.low20,
    resistance: m.high60,
  };
}

// ── Evaluation ────────────────────────────────────────────────────────────────
export const STATUS_LABEL: Record<SmStatus, string> = {
  BUY_CANDIDATE: 'BUY CANDIDATE',
  WAIT: 'WATCHLIST / WAIT',
  AVOID_CHASING: 'AVOID CHASING',
  NO_TRADE: 'NO TRADE',
  INSUFFICIENT_DATA: 'INSUFFICIENT DATA',
};

export function evaluateSmartMoney(m: SmartMoneyMeasures): SmartMoneyResult {
  const cfg = SMART_MONEY_CONFIG;
  const categories = scoreCategories(m);
  const earned = categories.reduce((s, k) => s + k.earned, 0);
  const coverage = categories.reduce((s, k) => s + k.knownMax, 0);
  const score = coverage > 0 ? Math.round((earned / coverage) * 100) : 0;
  const confidence: SmConfidence = coverage >= 85 ? 'HIGH' : coverage >= 60 ? 'MEDIUM' : 'LOW';
  const flowsKnown = categories.filter((k) => k.key === 'foreign' || k.key === 'broker').some((k) => k.knownMax > 0);

  // ── Risk Gate ──
  const gates: SmGate[] = [];
  const dataOk = m.close != null && m.bars >= cfg.minBars && !m.stale;
  gates.push({
    key: 'data', label: 'Kualitas data harga', result: dataOk ? 'PASS' : 'FAIL',
    reason: m.close == null ? 'Data harga tidak tersedia.' : m.bars < cfg.minBars ? `Histori ${m.bars} sesi, butuh ≥ ${cfg.minBars}.` : m.stale ? `Bar terakhir ${m.priceDate} sudah basi.` : `${m.bars} sesi, bar terakhir ${m.priceDate}.`,
  });
  gates.push({
    key: 'liquidity', label: 'Likuiditas', result: m.adtv20 == null ? 'UNKNOWN' : m.adtv20 >= cfg.minAdtv20 ? 'PASS' : 'FAIL',
    reason: m.adtv20 == null ? 'Rata-rata nilai 20 sesi tidak tersedia.' : `Rata-rata nilai 20 sesi ${rp(m.adtv20)} (minimum ${rp(cfg.minAdtv20)}).`,
  });
  gates.push({
    key: 'trading', label: 'Status perdagangan', result: m.lastVolume == null ? 'UNKNOWN' : m.lastVolume > 0 ? 'PASS' : 'FAIL',
    reason: m.lastVolume == null ? 'Tidak diketahui.' : m.lastVolume > 0 ? 'Ada transaksi pada sesi terakhir.' : 'Tidak ada transaksi pada sesi terakhir (kemungkinan suspensi).',
  });
  gates.push({
    key: 'notation', label: 'Notasi khusus / pemantauan bursa', result: 'UNKNOWN',
    reason: 'Sumber resmi IDX belum terhubung. Notasi khusus tidak sama dengan suspensi — cek manual di idx.co.id.',
  });
  const fFlags: string[] = [];
  if (m.profitPositive === false) fFlags.push('rugi');
  if (m.pbv != null && m.pbv < 0) fFlags.push('ekuitas negatif');
  if (m.der != null && m.der > cfg.maxDer) fFlags.push(`DER ${x(m.der)} > ${cfg.maxDer}x`);
  const fKnown = m.profitPositive != null || m.pbv != null || m.der != null;
  gates.push({
    key: 'fundamental', label: 'Risiko fundamental', result: fFlags.length ? 'FAIL' : fKnown ? 'PASS' : 'UNKNOWN',
    reason: fFlags.length ? `Flag: ${fFlags.join(', ')}. Maksimal WAIT.` : fKnown ? 'Tidak ada flag rugi, ekuitas negatif, atau DER tinggi.' : 'Data fundamental tidak tersedia.',
  });
  const chase: string[] = [];
  if (m.rsi14 != null && m.rsi14 > cfg.chaseRsi) chase.push(`RSI ${m.rsi14.toFixed(0)}`);
  if (m.close != null && m.ma20 != null && m.close > m.ma20 * (1 + cfg.chaseAboveMa20)) chase.push(`${pct(m.close / m.ma20 - 1, 0)} di atas MA20`);
  if (m.change1D != null && m.change1D >= cfg.chaseDayGain) chase.push(`naik ${pct(m.change1D, 1)} hari ini`);
  gates.push({
    key: 'chase', label: 'Jarak dari area entry', result: m.close == null ? 'UNKNOWN' : chase.length ? 'FAIL' : 'PASS',
    reason: chase.length ? `Harga sudah jauh: ${chase.join(', ')}.` : 'Harga belum terlalu jauh dari MA20.',
  });
  gates.push({
    key: 'flows', label: 'Data foreign & broker', result: flowsKnown ? 'PASS' : 'UNKNOWN',
    reason: flowsKnown ? `Index Alpha s/d ${m.flowsAsOf}.` : 'Belum diambil. Buka detail lalu ambil data flow untuk konfirmasi akumulasi.',
  });
  const gate = (k: string) => gates.find((g) => g.key === k)!.result;

  const plan = dataOk ? buildPlan(m) : null;

  // ── Status: Risk Gate first, then score ──
  let status: SmStatus;
  let statusReason: string;
  if (gate('data') === 'FAIL') {
    status = 'INSUFFICIENT_DATA'; statusReason = gates[0].reason;
  } else if (gate('trading') === 'FAIL') {
    status = 'NO_TRADE'; statusReason = gates.find((g) => g.key === 'trading')!.reason;
  } else if (gate('liquidity') === 'FAIL') {
    status = 'NO_TRADE'; statusReason = `Likuiditas di bawah ambang: ${gates.find((g) => g.key === 'liquidity')!.reason}`;
  } else if (gate('liquidity') === 'UNKNOWN') {
    status = 'INSUFFICIENT_DATA'; statusReason = 'Likuiditas tidak dapat dihitung.';
  } else if (score < cfg.minScoreWatch) {
    status = 'NO_TRADE'; statusReason = `Skor ${score} < ${cfg.minScoreWatch}: indikasi akumulasi lemah.`;
  } else if (gate('chase') === 'FAIL') {
    status = 'AVOID_CHASING'; statusReason = gates.find((g) => g.key === 'chase')!.reason;
  } else {
    const missing: string[] = [];
    if (score < cfg.minScoreBuy) missing.push(`skor ${score} < ${cfg.minScoreBuy}`);
    if (!flowsKnown) missing.push('data foreign/broker belum dikonfirmasi');
    else if (confidence === 'LOW') missing.push(`coverage data ${coverage}% (rendah)`);
    if (gate('fundamental') === 'FAIL') missing.push(`flag fundamental (${fFlags.join(', ')})`);
    if (!plan) missing.push('trade plan tidak dapat dihitung');
    else {
      if (!plan.trigger) missing.push('trigger entry belum terjadi');
      if (plan.rr < cfg.minRR) missing.push(`R:R ${plan.rr.toFixed(1)} < ${cfg.minRR}`);
    }
    status = missing.length ? 'WAIT' : 'BUY_CANDIDATE';
    statusReason = missing.length ? `Potensi akumulasi ada, tetapi ${missing.join('; ')}.` : `Skor ${score}, semua gate lolos, ${plan!.trigger === 'BREAKOUT' ? 'breakout' : 'pullback'} tervalidasi, R:R ${plan!.rr.toFixed(1)}.`;
  }

  const all = categories.flatMap((k) => k.indicators.filter((i) => i.available));
  const positives = all.filter((i) => i.points >= i.max * 0.75 && i.points > 0).map((i) => `${i.label}: ${i.display}`);
  const negatives = [
    ...gates.filter((g) => g.result === 'FAIL').map((g) => `${g.label}: ${g.reason}`),
    ...all.filter((i) => i.points === 0).map((i) => `${i.label}: ${i.display}`),
  ];
  const missingData = categories.flatMap((k) => k.indicators.filter((i) => !i.available).map((i) => i.label));

  return {
    measures: m, categories, score, coverage, confidence, gates, status, statusReason, plan, positives, negatives,
    conclusion: {
      reason: positives.length ? positives.slice(0, 2).join('; ') + '.' : 'Belum ada indikator yang kuat.',
      risk: negatives.length ? negatives[0] : 'Tidak ada risiko besar yang terdeteksi dari data yang tersedia.',
      confirm: missingData.length
        ? `Data belum tersedia: ${missingData.slice(0, 4).join(', ')}${missingData.length > 4 ? `, +${missingData.length - 4} lainnya` : ''}. Notasi khusus bursa dicek manual.`
        : 'Notasi khusus bursa dicek manual di idx.co.id.',
    },
  };
}

// ── Screener ──────────────────────────────────────────────────────────────────
/** Tahap 1 on the Pasardana snapshot: tradable today, positive week; most liquid first (bounded fetch). */
export function smartMoneyPrefilter(summaries: StockSummary[], max: number = SMART_MONEY_CONFIG.prefilterMax): StockSummary[] {
  return summaries
    .filter((s) => s.ticker && s.lastClose > 0 && s.value >= SMART_MONEY_CONFIG.minAdtv20 && s.percentChange1W > 0)
    .sort((a, b) => b.value - a.value || a.ticker.localeCompare(b.ticker))
    .slice(0, max);
}

const STATUS_ORDER: Record<SmStatus, number> = { BUY_CANDIDATE: 0, WAIT: 1, AVOID_CHASING: 2, NO_TRADE: 3, INSUFFICIENT_DATA: 4 };

export function rankSmartMoney(results: SmartMoneyResult[]): SmartMoneyResult[] {
  return [...results].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.score - a.score || a.measures.ticker.localeCompare(b.measures.ticker));
}
