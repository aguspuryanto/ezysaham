/**
 * fundamentalPillars.ts
 *
 * 3 Pilar Fundamental for EquityResearchReportCardv5 — the main filter before any technical entry:
 *   1. 🏢 PAHAMI BISNISNYA      — sector / sub-sector, size & liquidity (from the EOD summary).
 *   2. 💰 CEK KESEHATAN KEUANGAN — revenue & profit growth, margin, ROE, DER, current ratio.
 *   3. ⚖️ NILAI KEWAJARAN HARGA  — fair value from Graham Number, justified PBV and a PER-15× anchor,
 *                                   plus a medium-term accumulation range (margin of safety 10–20%).
 *
 * Only reads data that exists — business-model text and cash-flow statements are not in the feed,
 * so they are reported as unavailable instead of being guessed.
 */

import { formatRupiah } from '@/lib/format';
import type { StockSummary } from '@/domain/models/Stock';
import type { FundamentalDetail } from '@/domain/models/Fundamentals';
import type { FundamentalScreeningResult } from '@/domain/analysis/aiStockEngine';
import type { EarlyBullishReview } from '@/domain/analysis/earlyBullishReview';

export type PillarTone = 'green' | 'amber' | 'red' | 'zinc';
export type HealthVerdict = 'SEHAT' | 'CUKUP' | 'LEMAH' | 'DATA_KURANG';
export type ValuationVerdict = 'UNDERVALUED' | 'WAJAR' | 'PREMIUM' | 'OVERVALUED' | 'TIDAK_DAPAT_DINILAI';
/** PASS = lolos filter, CAUTION = boleh dengan catatan, FAIL = tidak layak dibeli. */
export type FundamentalFilter = 'PASS' | 'CAUTION' | 'FAIL';

export const HEALTH_VERDICT_LABEL: Record<HealthVerdict, string> = { SEHAT: 'Sehat', CUKUP: 'Cukup', LEMAH: 'Lemah', DATA_KURANG: 'Data Kurang' };
export const VALUATION_VERDICT_LABEL: Record<ValuationVerdict, string> = {
  UNDERVALUED: 'Undervalued', WAJAR: 'Wajar', PREMIUM: 'Premium', OVERVALUED: 'Overvalued', TIDAK_DAPAT_DINILAI: 'Tidak Dapat Dinilai',
};
export const FUNDAMENTAL_FILTER_LABEL: Record<FundamentalFilter, string> = { PASS: 'LOLOS', CAUTION: 'HATI-HATI', FAIL: 'TIDAK LOLOS' };

export interface PillarMetric {
  label: string;
  value: string;
  tone: PillarTone;
  note: string;
}

export interface FundamentalPillars {
  business: {
    name: string;
    sector: string;
    subSector: string;
    sizeNote: string;
    sizeTone: PillarTone;
    freeFloat: string;
    note: string;
  };
  health: {
    verdict: HealthVerdict;
    metrics: PillarMetric[];
    summary: string;
  };
  valuation: {
    verdict: ValuationVerdict;
    methods: { label: string; fairValue: number | null }[];
    fairValue: number | null;
    /** % from price to fair value (positive = price below fair value). */
    upsidePct: number | null;
    accumulationLow: number | null;
    accumulationHigh: number | null;
    per: string;
    pbv: string;
    summary: string;
  };
  filter: FundamentalFilter;
  filterReason: string;
}

/** Cost of equity used for justified PBV (ROE ÷ COE) — typical IDX assumption. */
const COST_OF_EQUITY_PCT = 12;
/** Long-run IHSG average PER used as a neutral earnings anchor. */
const MARKET_PER = 15;
/** Medium-term accumulation = fair value minus this margin of safety range. */
const MOS_MIN_PCT = 10;
const MOS_MAX_PCT = 20;

const rp = (n: number | null) => (n != null && n > 0 ? formatRupiah(Math.round(n)) : '–');
const pctTxt = (n: number | null, dec = 1) => (n == null || Number.isNaN(n) ? '–' : `${n >= 0 ? '+' : ''}${n.toFixed(dec)}%`);

function isFinancial(s: StockSummary): boolean {
  return /financ|keuangan|bank|asuransi|insurance/i.test(`${s.sector} ${s.subSector}`);
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function band(v: number | null, good: number, ok: number, higherIsBetter = true): PillarTone {
  if (v == null || Number.isNaN(v)) return 'zinc';
  if (higherIsBetter) return v >= good ? 'green' : v >= ok ? 'amber' : 'red';
  return v <= good ? 'green' : v <= ok ? 'amber' : 'red';
}

export function buildFundamentalPillars(
  summary: StockSummary,
  fundamentals: FundamentalDetail | null,
  screening: FundamentalScreeningResult,
): FundamentalPillars {
  const price = summary.lastClose;
  const financial = isFinancial(summary);

  // ── 1. BISNIS
  const business = {
    name: summary.name || summary.ticker,
    sector: summary.sector || '–',
    subSector: summary.subSector || '–',
    sizeNote: screening.capStatus.detail,
    sizeTone: screening.capStatus.tone,
    freeFloat: summary.freeFloat > 0 ? `${summary.freeFloat.toFixed(1)}%` : '–',
    note: 'Deskripsi model bisnis & sumber pendapatan tidak tersedia di data — cek profil emiten & laporan tahunan di IDX untuk relevansi produk/jasanya.',
  };

  // ── 2. KESEHATAN KEUANGAN
  const rev = fundamentals?.revenueGrowth ?? null;
  const earn = fundamentals?.earningsGrowth ?? null;
  const margin = fundamentals?.netMargin ?? null;
  const der = fundamentals?.debtToEquity ?? null;
  const cr = fundamentals?.currentRatio ?? null;
  const roe = summary.roe !== 0 ? summary.roe : null;

  const metrics: PillarMetric[] = [
    { label: 'Revenue Growth (YoY)', value: pctTxt(rev), tone: band(rev, 10, 0), note: rev == null ? 'data belum tersedia' : rev >= 10 ? 'pendapatan tumbuh' : rev >= 0 ? 'pertumbuhan tipis' : 'pendapatan turun' },
    { label: 'Laba Bersih Growth (YoY)', value: pctTxt(earn), tone: band(earn, 10, 0), note: earn == null ? 'data belum tersedia' : earn >= 10 ? 'laba tumbuh' : earn >= 0 ? 'laba stagnan' : 'laba turun' },
    { label: 'Net Profit Margin', value: margin != null ? `${margin.toFixed(1)}%` : '–', tone: band(margin, 10, 0), note: margin == null ? 'data belum tersedia' : margin < 0 ? 'perusahaan merugi' : margin >= 10 ? 'margin sehat' : 'margin tipis' },
    { label: 'ROE', value: roe != null ? `${roe.toFixed(1)}%` : '–', tone: band(roe, 15, 8), note: roe == null ? 'data belum tersedia' : roe >= 15 ? 'efisien mengelola modal' : roe >= 8 ? 'cukup' : 'imbal hasil modal rendah' },
    financial
      ? { label: 'DER', value: der != null ? `${(der / 100).toFixed(2)}×` : '–', tone: 'zinc', note: 'sektor keuangan — DER tinggi wajar, nilai dengan CAR/NPL' }
      : { label: 'DER', value: der != null ? `${(der / 100).toFixed(2)}×` : '–', tone: band(der, 100, 200, false), note: der == null ? 'data belum tersedia' : der <= 100 ? 'utang terkendali' : der <= 200 ? 'utang cukup tinggi' : 'utang berat' },
    financial
      ? { label: 'Current Ratio', value: cr != null ? `${cr.toFixed(2)}×` : '–', tone: 'zinc', note: 'tidak relevan untuk bank' }
      : { label: 'Current Ratio', value: cr != null ? `${cr.toFixed(2)}×` : '–', tone: band(cr, 1.5, 1), note: cr == null ? 'data belum tersedia' : cr >= 1.5 ? 'likuiditas jangka pendek aman' : cr >= 1 ? 'likuiditas pas-pasan' : 'aset lancar < utang lancar' },
    { label: 'Arus Kas', value: '–', tone: 'zinc', note: 'data arus kas belum tersedia — cek laporan keuangan (CFO positif & konsisten)' },
  ];
  const scored = metrics.filter((m) => m.tone !== 'zinc');
  const reds = scored.filter((m) => m.tone === 'red').length;
  const greens = scored.filter((m) => m.tone === 'green').length;
  const loss = (margin != null && margin < 0) || summary.per < 0;
  const healthVerdict: HealthVerdict =
    scored.length < 2 ? 'DATA_KURANG'
      : loss || reds >= 3 ? 'LEMAH'
        : reds === 0 && greens >= Math.min(3, scored.length) ? 'SEHAT' : 'CUKUP';
  const weakPoints = metrics.filter((m) => m.tone === 'red').map((m) => m.label.split(' (')[0]);
  const strongPoints = metrics.filter((m) => m.tone === 'green').map((m) => m.label.split(' (')[0]);
  const healthSummary =
    healthVerdict === 'DATA_KURANG' ? 'Data keuangan belum cukup untuk menilai kesehatan — cek laporan keuangan terbaru.'
      : healthVerdict === 'SEHAT' ? `Keuangan sehat: ${strongPoints.join(', ')} positif.`
        : healthVerdict === 'LEMAH' ? `Keuangan lemah${loss ? ' (perusahaan merugi)' : ''}: ${weakPoints.join(', ') || 'beberapa rasio buruk'}.`
          : `Keuangan cukup${strongPoints.length ? ` — kuat di ${strongPoints.join(', ')}` : ''}${weakPoints.length ? `, perlu dicermati: ${weakPoints.join(', ')}` : ''}.`;

  // ── 3. VALUASI
  const eps = summary.per > 0 ? price / summary.per : null;
  const bvps = summary.pbv > 0 ? price / summary.pbv : null;
  const graham = eps != null && bvps != null ? Math.sqrt(22.5 * eps * bvps) : null;
  const justifiedPbv = bvps != null && roe != null && roe > 0
    ? bvps * Math.min(Math.max(roe / COST_OF_EQUITY_PCT, 0.5), 4)
    : null;
  const perAnchor = eps != null ? eps * MARKET_PER : null;
  const methods = [
    { label: 'Graham Number', fairValue: graham },
    { label: `Justified PBV (ROE ÷ ${COST_OF_EQUITY_PCT}%)`, fairValue: justifiedPbv },
    { label: `PER ${MARKET_PER}× (rata-rata IHSG)`, fairValue: perAnchor },
  ];
  const fairValue = median(methods.map((m) => m.fairValue).filter((v): v is number => v != null && v > 0));
  const upsidePct = fairValue != null && price > 0 ? ((fairValue - price) / price) * 100 : null;
  const valuationVerdict: ValuationVerdict =
    upsidePct == null ? 'TIDAK_DAPAT_DINILAI'
      : upsidePct >= 20 ? 'UNDERVALUED'
        : upsidePct >= -10 ? 'WAJAR'
          : upsidePct >= -35 ? 'PREMIUM' : 'OVERVALUED';
  const accumulationHigh = fairValue != null ? fairValue * (1 - MOS_MIN_PCT / 100) : null;
  const accumulationLow = fairValue != null ? fairValue * (1 - MOS_MAX_PCT / 100) : null;
  const accTxt = `${rp(accumulationLow)} – ${rp(accumulationHigh)}`;
  const valuationSummary =
    valuationVerdict === 'TIDAK_DAPAT_DINILAI'
      ? 'Nilai wajar tidak dapat dihitung (laba/ekuitas negatif atau data PER/PBV kosong).'
      : valuationVerdict === 'UNDERVALUED'
        ? `Harga ${Math.abs(upsidePct!).toFixed(0)}% di bawah nilai wajar ${rp(fairValue)} — ada margin of safety.${price <= (accumulationHigh ?? 0) ? ' Harga sudah di area akumulasi.' : ''}`
        : valuationVerdict === 'WAJAR'
          ? `Harga di sekitar nilai wajar ${rp(fairValue)}. Area akumulasi jangka menengah ${accTxt}.`
          : valuationVerdict === 'PREMIUM'
            ? `Harga ${Math.abs(upsidePct!).toFixed(0)}% di atas nilai wajar ${rp(fairValue)} — sudah dihargai premium. Area akumulasi ideal ${accTxt}.`
            : `Harga ${Math.abs(upsidePct!).toFixed(0)}% di atas nilai wajar ${rp(fairValue)} — terlalu mahal untuk investasi. Area akumulasi ideal ${accTxt}.`;

  // ── FILTER UTAMA
  const filter: FundamentalFilter =
    healthVerdict === 'LEMAH' ? 'FAIL'
      : healthVerdict === 'DATA_KURANG' || valuationVerdict === 'OVERVALUED' || valuationVerdict === 'TIDAK_DAPAT_DINILAI' ? 'CAUTION'
        : 'PASS';
  const filterReason =
    filter === 'FAIL' ? 'Keuangan lemah — tidak layak dibeli walau grafiknya menarik.'
      : filter === 'CAUTION'
        ? valuationVerdict === 'OVERVALUED' ? 'Bisnis layak, tapi harga terlalu mahal — hanya untuk trading jangka pendek dengan disiplin stop loss.'
          : 'Data fundamental belum lengkap — perlakukan sebagai trading, bukan investasi.'
        : `Bisnis & keuangan ${HEALTH_VERDICT_LABEL[healthVerdict].toLowerCase()}, valuasi ${VALUATION_VERDICT_LABEL[valuationVerdict].toLowerCase()} — lolos filter fundamental.`;

  return {
    business,
    health: { verdict: healthVerdict, metrics, summary: healthSummary },
    valuation: {
      verdict: valuationVerdict,
      methods,
      fairValue,
      upsidePct,
      accumulationLow,
      accumulationHigh,
      per: summary.per > 0 ? `${summary.per.toFixed(1)}×` : summary.per < 0 ? 'negatif (rugi)' : '–',
      pbv: summary.pbv > 0 ? `${summary.pbv.toFixed(2)}×` : '–',
      summary: valuationSummary,
    },
    filter,
    filterReason,
  };
}

/**
 * Fundamental is only a quality filter — never a BUY trigger. It only ever caps the technical decision:
 *  - FAIL    → BUY/WAIT become "NO TRADE — FUNDAMENTAL LEMAH".
 *  - CAUTION → a BUY stays a BUY but is labelled trading-only.
 */
export function applyFundamentalFilter(r: EarlyBullishReview, p: FundamentalPillars): EarlyBullishReview {
  if (p.filter === 'FAIL' && r.decision !== 'NO_TRADE') {
    return {
      ...r,
      decision: 'NO_TRADE',
      tag: 'FUNDAMENTAL',
      why: `${p.filterReason} (teknikal: ${r.why.charAt(0).toLowerCase()}${r.why.slice(1)})`,
      buyTrigger: `Tunggu perbaikan kinerja keuangan (laba & margin kembali positif), baru evaluasi trigger teknikal: ${r.buyTrigger.charAt(0).toLowerCase()}${r.buyTrigger.slice(1)}`,
    };
  }
  if (p.filter === 'CAUTION' && r.decision === 'BUY') {
    return { ...r, why: `${r.why} Catatan fundamental: ${p.filterReason}` };
  }
  return r;
}

export function formatFundamentalPillars(p: FundamentalPillars): string[] {
  return [
    '🏢 PAHAMI BISNISNYA',
    `${p.business.name} · Sektor ${p.business.sector} / ${p.business.subSector} · Free float ${p.business.freeFloat}`,
    p.business.sizeNote,
    p.business.note,
    '',
    `💰 KESEHATAN KEUANGAN — ${HEALTH_VERDICT_LABEL[p.health.verdict]}`,
    ...p.health.metrics.map((m) => `- ${m.label}: ${m.value} (${m.note})`),
    p.health.summary,
    '',
    `⚖️ NILAI KEWAJARAN — ${VALUATION_VERDICT_LABEL[p.valuation.verdict]}`,
    `PER ${p.valuation.per} · PBV ${p.valuation.pbv}`,
    ...p.valuation.methods.map((m) => `- ${m.label}: ${rp(m.fairValue)}`),
    `Nilai wajar (median): ${rp(p.valuation.fairValue)} (${pctTxt(p.valuation.upsidePct, 0)} dari harga)`,
    p.valuation.summary,
    '',
    `Filter Fundamental: ${FUNDAMENTAL_FILTER_LABEL[p.filter]} — ${p.filterReason}`,
  ];
}
