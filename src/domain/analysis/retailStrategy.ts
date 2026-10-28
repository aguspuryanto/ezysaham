/**
 * retailStrategy.ts
 *
 * Strategi Retail EOD (docs/features_strategi_retail.md): HARD GATE per saham setelah pasar tutup, dihitung di sini
 * supaya AI hanya menarasikan — tidak pernah memutuskan status atau membuat angka sendiri.
 *
 *   Gate: likuiditas 20 hari ≥ Rp1 M · trigger valid (breakout / pullback) · stop-loss ≤ 8% dan ≤ 2,5×ATR14 ·
 *         potensi kenaikan ≥ 7% · net R:R setelah biaya ≥ 2 · tidak ada indikasi distribusi kuat · tidak extended.
 *   Satu gate gagal / tidak diketahui → TUNGGU atau GUGUR, tidak pernah LOLOS.
 *
 * Measures, trade plan (entry/SL/target) dan gate "extended" memakai Smart Money Hunter yang sudah ada, sehingga
 * definisi EMA, ATR, ADTV dan trigger sama di seluruh aplikasi. Pure — pemanggil yang mengambil data.
 */

import { evaluateSmartMoney, measureSmartMoney, SmartMoneyMeasures, SmTradePlan } from '@/domain/analysis/smartMoneyHunter';
import { SmartMoneyFlows } from '@/domain/models/BrokerSummary';
import { OHLCVBar } from '@/domain/models/History';
import { StockSummary } from '@/domain/models/Stock';

export const RETAIL_STRATEGY_CONFIG = {
  minAdtv20: 1e9,
  maxStopPct: 0.08,
  maxStopAtr: 2.5,
  minUpside: 0.07,
  minNetRR: 2,
  /** Fee beli / jual broker retail umum (jual termasuk PPh final 0,1%). */
  buyFee: 0.0015,
  sellFee: 0.0025,
  /** Distribusi kuat: net sell 3 broker terbawah ≥ 2× net buy 3 broker teratas (imbalance ≤ 0,5). */
  maxDistributionImbalance: 0.5,
  lotSize: 100,
  maxStocks: 10,
} as const;

export type RetailStatus = 'LOLOS' | 'TUNGGU' | 'GUGUR';
export type RetailGateResult = 'PASS' | 'FAIL' | 'UNKNOWN';
export type RetailGateKey = 'data' | 'liquidity' | 'trigger' | 'stop' | 'upside' | 'netRR' | 'distribution' | 'extended';

export interface RetailGate {
  key: RetailGateKey;
  label: string;
  result: RetailGateResult;
  reason: string;
}

export interface RetailRiskProfile {
  /** Modal trading (IDR). */
  capital: number;
  /** Batas risiko per transaksi, rasio (0,01 = 1%). */
  riskPerTrade: number;
}

export interface RetailPosition {
  lots: number;
  shares: number;
  value: number;
  /** Kerugian bila SL tersentuh, termasuk biaya. */
  maxLoss: number;
  /** Yang membatasi jumlah lot. */
  limitedBy: 'risk' | 'capital';
}

export interface RetailCandle {
  open: number;
  high: number;
  low: number;
  close: number;
  label: string;
}

export interface RetailStrategyResult {
  ticker: string;
  name: string;
  measures: SmartMoneyMeasures;
  candle: RetailCandle | null;
  /** Volume sesi terakhir ÷ rata-rata volume 20 sesi sebelumnya. */
  rvol1: number | null;
  volumeMa20: number | null;
  plan: SmTradePlan | null;
  netRR: number | null;
  /** Biaya transaksi pulang-pergi per lembar di harga entry & target (IDR). */
  costPerShare: number | null;
  stopAtr: number | null;
  position: RetailPosition | null;
  gates: RetailGate[];
  status: RetailStatus;
  cancelReasons: string[];
}

export interface RetailStrategyInput {
  summary: StockSummary;
  bars: OHLCVBar[];
  flows: SmartMoneyFlows | null;
  now: Date;
}

const rp = (v: number) => `Rp${Math.round(v).toLocaleString('id-ID')}`;
const pct = (v: number, dec = 1) => `${(v * 100).toLocaleString('id-ID', { maximumFractionDigits: dec })}%`;

function lastCandle(bars: OHLCVBar[]): RetailCandle | null {
  const b = bars[bars.length - 1];
  if (!b) return null;
  const range = b.high - b.low;
  const body = Math.abs(b.close - b.open);
  const upper = b.high - Math.max(b.open, b.close);
  const lower = Math.min(b.open, b.close) - b.low;
  const color = b.close > b.open ? 'hijau' : b.close < b.open ? 'merah' : 'doji';
  let shape = 'body normal';
  if (range <= 0) shape = 'tanpa range';
  else if (body / range >= 0.7) shape = 'body penuh (marubozu-like)';
  else if (upper / range >= 0.5) shape = 'upper wick panjang (tekanan jual)';
  else if (lower / range >= 0.5) shape = 'lower wick panjang (ditopang beli)';
  else if (body / range <= 0.1) shape = 'body sangat kecil (ragu-ragu)';
  return { open: b.open, high: b.high, low: b.low, close: b.close, label: `${color}, ${shape}` };
}

export function positionSize(entry: number, netRiskPerShare: number, profile: RetailRiskProfile): RetailPosition | null {
  const { lotSize, buyFee } = RETAIL_STRATEGY_CONFIG;
  if (!(entry > 0) || !(netRiskPerShare > 0) || !(profile.capital > 0) || !(profile.riskPerTrade > 0)) return null;
  const byRisk = Math.floor((profile.capital * profile.riskPerTrade) / (netRiskPerShare * lotSize));
  const byCapital = Math.floor(profile.capital / (entry * (1 + buyFee) * lotSize));
  const lots = Math.max(0, Math.min(byRisk, byCapital));
  const shares = lots * lotSize;
  return { lots, shares, value: shares * entry, maxLoss: shares * netRiskPerShare, limitedBy: byRisk <= byCapital ? 'risk' : 'capital' };
}

export function evaluateRetailStrategy({ summary, bars, flows, now }: RetailStrategyInput, profile: RetailRiskProfile): RetailStrategyResult {
  const cfg = RETAIL_STRATEGY_CONFIG;
  const sm = evaluateSmartMoney(measureSmartMoney({ summary, bars, fundamentals: null, flows, now }));
  const m = sm.measures;
  const plan = sm.plan;
  const smGate = (k: string) => sm.gates.find((g) => g.key === k)!;

  const prior20 = bars.slice(-21, -1).map((b) => b.volume);
  const volumeMa20 = prior20.length === 20 ? prior20.reduce((a, b) => a + b, 0) / 20 : null;
  const rvol1 = volumeMa20 && volumeMa20 > 0 && m.lastVolume != null ? m.lastVolume / volumeMa20 : null;

  let netRR: number | null = null, costPerShare: number | null = null, stopAtr: number | null = null, netRisk: number | null = null;
  if (plan) {
    const buy = plan.entry * (1 + cfg.buyFee);
    netRisk = buy - plan.stop * (1 - cfg.sellFee);
    const netReward = plan.target * (1 - cfg.sellFee) - buy;
    netRR = netRisk > 0 ? netReward / netRisk : null;
    costPerShare = plan.entry * cfg.buyFee + plan.target * cfg.sellFee;
    stopAtr = m.atr14 != null && m.atr14 > 0 ? (plan.entry - plan.stop) / m.atr14 : null;
  }

  const gates: RetailGate[] = [];
  const data = smGate('data');
  gates.push({ key: 'data', label: 'Data harga EOD', result: data.result === 'PASS' ? 'PASS' : 'FAIL', reason: data.reason });
  gates.push({
    key: 'liquidity', label: 'Likuiditas 20 hari ≥ Rp1 M',
    result: m.adtv20 == null ? 'UNKNOWN' : m.adtv20 >= cfg.minAdtv20 ? 'PASS' : 'FAIL',
    reason: m.adtv20 == null ? 'Rata-rata nilai 20 sesi tidak tersedia.' : `Rata-rata nilai 20 sesi ${rp(m.adtv20)}.`,
  });
  gates.push({
    key: 'trigger', label: 'Trigger valid',
    result: !plan ? 'UNKNOWN' : plan.trigger ? 'PASS' : 'FAIL',
    reason: plan ? plan.triggerNote : 'Trade plan tidak dapat dihitung (histori/indikator kurang).',
  });
  const stopPass = plan != null && stopAtr != null && plan.riskPct <= cfg.maxStopPct && stopAtr <= cfg.maxStopAtr;
  gates.push({
    key: 'stop', label: 'Stop-loss ≤ 8% dan ≤ 2,5×ATR',
    result: !plan || stopAtr == null ? 'UNKNOWN' : stopPass ? 'PASS' : 'FAIL',
    reason: plan && stopAtr != null ? `SL ${rp(plan.stop)} = ${pct(plan.riskPct)} dari entry, ${stopAtr.toFixed(2).replace('.', ',')}×ATR14.` : 'SL/ATR tidak tersedia.',
  });
  gates.push({
    key: 'upside', label: 'Potensi kenaikan ≥ 7%',
    result: !plan ? 'UNKNOWN' : plan.returnPct >= cfg.minUpside ? 'PASS' : 'FAIL',
    reason: plan ? `Target ${rp(plan.target)} (${plan.targetBasis}) = ${pct(plan.returnPct)} dari entry.` : 'Target tidak tersedia.',
  });
  gates.push({
    key: 'netRR', label: 'Net R:R setelah biaya ≥ 1:2',
    result: netRR == null ? 'UNKNOWN' : netRR >= cfg.minNetRR ? 'PASS' : 'FAIL',
    reason: netRR == null ? 'R:R tidak dapat dihitung.' : `Net R:R 1:${netRR.toFixed(2).replace('.', ',')} (fee beli ${pct(cfg.buyFee, 2)}, jual ${pct(cfg.sellFee, 2)}).`,
  });
  const flowsKnown = m.brokerImbalance != null || m.brokerTopNet != null;
  const distribution = flowsKnown && ((m.brokerImbalance != null && m.brokerImbalance <= cfg.maxDistributionImbalance) || (m.brokerTopNet != null && m.brokerTopNet <= 0));
  gates.push({
    key: 'distribution', label: 'Tidak ada indikasi distribusi kuat',
    result: !flowsKnown ? 'UNKNOWN' : distribution ? 'FAIL' : 'PASS',
    reason: !flowsKnown
      ? 'Broker summary TIDAK TERSEDIA — distribusi tidak dapat disingkirkan.'
      : distribution
        ? m.brokerTopNet != null && m.brokerTopNet <= 0
          ? 'Tidak ada broker net buy dalam 5 sesi.'
          : `Net sell 3 broker terbawah ≥ 2× net buy 3 broker teratas (imbalance ${m.brokerImbalance!.toFixed(2).replace('.', ',')}x).`
        : `Imbalance broker 5 sesi ${m.brokerImbalance != null ? `${m.brokerImbalance.toFixed(2).replace('.', ',')}x` : 'N/A'}, broker teratas ${m.brokerTopCode ?? 'N/A'} net buy.`,
  });
  const chase = smGate('chase');
  gates.push({ key: 'extended', label: 'Harga tidak terlalu extended', result: chase.result, reason: chase.reason });

  const result = (k: RetailGateKey) => gates.find((g) => g.key === k)!.result;
  const structural = result('data') === 'FAIL' || result('liquidity') === 'FAIL' || result('distribution') === 'FAIL' || !plan;
  const status: RetailStatus = structural ? 'GUGUR' : gates.every((g) => g.result === 'PASS') ? 'LOLOS' : 'TUNGGU';
  const cancelReasons = gates.filter((g) => g.result !== 'PASS').map((g) => `${g.label}: ${g.reason}`);
  if (plan) cancelReasons.push(`Setup batal bila ${plan.invalidation.charAt(0).toLowerCase()}${plan.invalidation.slice(1)}`);

  return {
    ticker: summary.ticker,
    name: summary.name,
    measures: m,
    candle: lastCandle(bars),
    rvol1,
    volumeMa20,
    plan,
    netRR,
    costPerShare,
    stopAtr,
    position: plan && netRisk != null ? positionSize(plan.entry, netRisk, profile) : null,
    gates,
    status,
    cancelReasons,
  };
}

const STATUS_ORDER: Record<RetailStatus, number> = { LOLOS: 0, TUNGGU: 1, GUGUR: 2 };

/** Urut: status, lalu jumlah gate lolos (kelengkapan sinyal), lalu net R:R (kualitas risiko) — bukan prediksi profit. */
export function rankRetailStrategy(results: RetailStrategyResult[]): RetailStrategyResult[] {
  const passed = (r: RetailStrategyResult) => r.gates.filter((g) => g.result === 'PASS').length;
  return [...results].sort((a, b) =>
    STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || passed(b) - passed(a) || (b.netRR ?? -Infinity) - (a.netRR ?? -Infinity) || a.ticker.localeCompare(b.ticker));
}
