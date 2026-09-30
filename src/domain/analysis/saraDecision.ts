/**
 * saraDecision.ts
 *
 * SARA AI decision — never equates "fundamental bagus" with "layak dibeli sekarang".
 * Three separate dimensions, read in this hierarchy:
 *
 *   FUNDAMENTAL → VALUATION → TREND → MOMENTUM → VOLUME → ENTRY → RISK/REWARD
 *   (layak dimiliki?) (harga masuk akal?) (———————— TIMING: entry sekarang punya edge? ————————)
 *
 * Every decision answers WHY BUY? · WHY NOW? · WHERE WRONG?. BUY NOW is only issued when entry,
 * invalidation and R:R are all explicit and the timing is confirmed — a single good metric (laba naik,
 * ROE tinggi, di bawah fair value, EMA bullish, volume tinggi) is never enough on its own.
 */

import type { FundamentalPillars } from '@/domain/analysis/fundamentalPillars';
import { roundToTick } from '@/domain/analysis/idxTick';
import type { StockAnalysis, TradeScenario } from '@/domain/models/StockAnalysis';
import { formatRupiah } from '@/lib/format';

export type SaraDecisionType = 'BUY_NOW' | 'ACCUMULATE' | 'WAIT' | 'NO_BUY' | 'HOLD' | 'REDUCE' | 'SELL';
export type SaraConfidence = 'HIGH' | 'MEDIUM' | 'LOW';
export type SaraTone = 'positive' | 'negative' | 'warning' | 'info' | 'neutral';
export type DimensionStatus = 'SUPPORT' | 'NEUTRAL' | 'FAIL' | 'UNKNOWN';

export const SARA_DECISION_LABEL: Record<SaraDecisionType, string> = {
  BUY_NOW: 'BUY NOW',
  ACCUMULATE: 'ACCUMULATE',
  WAIT: 'WAIT',
  NO_BUY: 'NO BUY',
  HOLD: 'HOLD',
  REDUCE: 'REDUCE',
  SELL: 'SELL',
};

export const SARA_DECISION_TONE: Record<SaraDecisionType, SaraTone> = {
  BUY_NOW: 'positive',
  ACCUMULATE: 'info',
  WAIT: 'warning',
  NO_BUY: 'negative',
  HOLD: 'info',
  REDUCE: 'warning',
  SELL: 'negative',
};

/** Minimum reward-to-risk (to TP1) before any buy decision is allowed. */
export const SARA_MIN_RR = 1.5;
/** FOMO thresholds. */
const MAX_DIST_EMA20_PCT = 8;
const MAX_DIST_SUPPORT_PCT = 12;
const RSI_HOT = 70;
/** Price must be within this % of the planned entry to count as "di zona entry". */
const ENTRY_ZONE_PCT = 3;

export interface SaraDimension {
  key: 'fundamental' | 'valuation' | 'timing';
  title: string;
  question: string;
  status: DimensionStatus;
  label: string;
  tone: SaraTone;
  detail: string;
}

export interface SaraCheck {
  label: string;
  passed: boolean;
  detail: string;
}

export interface SaraDecision {
  decision: SaraDecisionType;
  /** One-line verdict, e.g. "FUNDAMENTAL BAGUS, TAPI BELUM LAYAK DIBELI SEKARANG." */
  headline: string;
  dimensions: SaraDimension[];
  whyBuy: string[];
  /** Confirmations that give the entry an edge — empty = BELUM ADA EDGE. */
  whyNow: string[];
  hasEdge: boolean;
  /** What still has to happen before an entry has an edge. */
  waitingFor: string[];
  entry: { low: number; high: number; text: string } | null;
  whereWrong: { price: number; reason: string } | null;
  targets: { tp1: number; tp2: number } | null;
  riskReward: { planned: number | null; fromPrice: number | null; ok: boolean; text: string };
  confidence: { level: SaraConfidence; passed: number; total: number; checks: SaraCheck[] };
  fomo: { triggered: boolean; reasons: string[]; message: string | null };
}

export interface SaraDecisionInput {
  price: number;
  pillars: FundamentalPillars;
  analysis: StockAnalysis;
  /** User already owns the stock → HOLD / REDUCE / SELL instead of entry decisions. */
  holding: boolean;
}

const rp = (n: number) => formatRupiah(Math.round(n));
const pct = (n: number, dec = 1) => `${n >= 0 ? '+' : ''}${n.toFixed(dec)}%`;
const rr = (n: number) => `1:${n.toFixed(1)}`;

function fundamentalDimension(p: FundamentalPillars): SaraDimension {
  const v = p.health.verdict;
  const status: DimensionStatus = v === 'SEHAT' ? 'SUPPORT' : v === 'CUKUP' ? 'NEUTRAL' : v === 'LEMAH' ? 'FAIL' : 'UNKNOWN';
  const meta = {
    SUPPORT: { label: 'Layak dimiliki', tone: 'positive' as SaraTone },
    NEUTRAL: { label: 'Cukup', tone: 'info' as SaraTone },
    FAIL: { label: 'Tidak mendukung', tone: 'negative' as SaraTone },
    UNKNOWN: { label: 'Data kurang', tone: 'neutral' as SaraTone },
  }[status];
  return { key: 'fundamental', title: 'Fundamental', question: 'Layak dimiliki?', status, ...meta, detail: p.health.summary };
}

function valuationDimension(p: FundamentalPillars): SaraDimension {
  const v = p.valuation.verdict;
  const status: DimensionStatus =
    v === 'UNDERVALUED' || v === 'WAJAR' ? 'SUPPORT' : v === 'PREMIUM' ? 'NEUTRAL' : v === 'OVERVALUED' ? 'FAIL' : 'UNKNOWN';
  const meta = {
    SUPPORT: { label: v === 'UNDERVALUED' ? 'Murah' : 'Wajar', tone: 'positive' as SaraTone },
    NEUTRAL: { label: 'Premium', tone: 'warning' as SaraTone },
    FAIL: { label: 'Terlalu mahal', tone: 'negative' as SaraTone },
    UNKNOWN: { label: 'Tidak dapat dinilai', tone: 'neutral' as SaraTone },
  }[status];
  return { key: 'valuation', title: 'Valuasi', question: 'Harga masuk akal?', status, ...meta, detail: p.valuation.summary };
}

/** A long setup is only usable when the math is valid and it's an actual buy entry type. */
function usableLongPlan(s: TradeScenario): boolean {
  return s.direction === 'LONG'
    && s.validationErrors.length === 0
    && (s.entryType === 'BUY_ON_SUPPORT' || s.entryType === 'BUY_ON_PULLBACK' || s.entryType === 'BUY_ON_BREAKOUT')
    && s.sl > 0 && s.sl < s.entry && s.tp1 > s.entry;
}

export function computeSaraDecision({ price, pillars, analysis, holding }: SaraDecisionInput): SaraDecision {
  const { trendEma, indicators, volume, priceAction, supportResistance, tradingPlan } = analysis;
  const plan = tradingPlan.bullish;
  const planOk = usableLongPlan(plan);

  const fundamental = fundamentalDimension(pillars);
  const valuation = valuationDimension(pillars);

  // ── TIMING: Trend → Momentum → Volume → Entry ──────────────────────────────
  const hasEma200 = Number.isFinite(trendEma.ema200) && trendEma.ema200 > 0;
  const trendUp = trendEma.trend === 'bullish' && price > trendEma.ema50 && (!hasEma200 || price > trendEma.ema200);
  const macdBull = indicators.macdSignalType === 'bullish' || indicators.macdSignalType === 'bullish_crossover';
  const momentumOk = macdBull && indicators.rsi14 >= 50 && indicators.rsi14 < RSI_HOT;
  const rvol = volume.relativeVolume;
  const volumeOk = Number.isFinite(rvol) && rvol >= 1.5 && priceAction.lastCandleColor === 'green';
  const bullishCandle = ['bullish_engulfing', 'hammer', 'marubozu_bullish'].includes(priceAction.pattern);
  const breakout = plan.entryType === 'BUY_ON_BREAKOUT' && price >= plan.entry;
  const triggerOk = bullishCandle || breakout;

  const entryDistPct = planOk ? ((price - plan.entry) / plan.entry) * 100 : null;
  const inEntryZone = entryDistPct != null && Math.abs(entryDistPct) <= ENTRY_ZONE_PCT;

  const rrPlanned = planOk ? plan.riskRewardRatio : null;
  const rrFromPrice = planOk && price > plan.sl && plan.tp1 > price ? (plan.tp1 - price) / (price - plan.sl) : null;
  const rrOk = rrFromPrice != null && rrFromPrice >= SARA_MIN_RR;

  // ── FOMO CHECK ──────────────────────────────────────────────────────────────
  const distEma20 = trendEma.ema20 > 0 ? ((price - trendEma.ema20) / trendEma.ema20) * 100 : 0;
  const nearestSupport = supportResistance.supports.map((s) => s.price).filter((s) => s < price).sort((a, b) => b - a)[0];
  const distSupport = nearestSupport ? ((price - nearestSupport) / nearestSupport) * 100 : null;
  const fomoReasons: string[] = [];
  if (distEma20 > MAX_DIST_EMA20_PCT) fomoReasons.push(`Harga ${pct(distEma20)} di atas EMA20 (maks ${MAX_DIST_EMA20_PCT}%)`);
  if (distSupport != null && distSupport > MAX_DIST_SUPPORT_PCT) fomoReasons.push(`Harga ${pct(distSupport)} dari support terdekat ${rp(nearestSupport!)}`);
  if (indicators.rsi14 >= RSI_HOT) fomoReasons.push(`RSI ${indicators.rsi14.toFixed(0)} — sudah panas`);
  if (planOk && rrFromPrice != null && rrFromPrice < SARA_MIN_RR) fomoReasons.push(`R:R dari harga sekarang hanya ${rr(rrFromPrice)}`);
  if (planOk && price > plan.tp1) fomoReasons.push(`Harga sudah melewati TP1 ${rp(plan.tp1)}`);
  const fomo = fomoReasons.length > 0;

  // ── CONFIDENCE: count of objective confirmations ───────────────────────────
  const checks: SaraCheck[] = [
    { label: 'Fundamental', passed: fundamental.status === 'SUPPORT', detail: fundamental.label },
    { label: 'Valuasi', passed: valuation.status === 'SUPPORT', detail: valuation.label },
    { label: 'Trend', passed: trendUp, detail: trendUp ? 'Harga > EMA50 & EMA200, trend naik' : trendEma.trendDescription },
    { label: 'Momentum', passed: momentumOk, detail: `RSI ${indicators.rsi14.toFixed(0)} · MACD ${macdBull ? 'bullish' : 'belum bullish'}` },
    { label: 'Volume', passed: volumeOk, detail: Number.isFinite(rvol) ? `${rvol.toFixed(1)}x rata-rata 20 hari` : 'Data volume kurang' },
    { label: 'Entry', passed: planOk && inEntryZone && triggerOk, detail: !planOk ? 'Belum ada setup entry valid' : inEntryZone ? (triggerOk ? 'Di zona entry + ada trigger' : 'Di zona entry, trigger belum muncul') : `Harga ${pct(entryDistPct!)} dari entry` },
    { label: 'Risk/Reward', passed: rrOk, detail: rrFromPrice != null ? `${rr(rrFromPrice)} dari harga sekarang` : 'Belum bisa dihitung' },
  ];
  const passed = checks.filter((c) => c.passed).length;
  // A failed fundamental or valuation is a veto: the buy case cannot be more than LOW, however good the chart.
  const vetoed = fundamental.status === 'FAIL' || valuation.status === 'FAIL';
  const level: SaraConfidence = vetoed ? 'LOW' : passed >= 6 ? 'HIGH' : passed >= 4 ? 'MEDIUM' : 'LOW';

  // Timing edge needs trend + entry zone + R:R, plus at least one of momentum/volume/trigger, and no FOMO.
  const timingConfirmed = planOk && trendUp && inEntryZone && rrOk && !fomo && [momentumOk, volumeOk, triggerOk].filter(Boolean).length >= 2;

  const whyNow: string[] = [];
  if (timingConfirmed) {
    if (breakout) whyNow.push(`Breakout ${rp(plan.entry)} terkonfirmasi`);
    if (bullishCandle) whyNow.push(`Candle konfirmasi: ${priceAction.patternLabel}`);
    if (volumeOk) whyNow.push(`Volume ${rvol.toFixed(1)}x rata-rata — ada partisipasi besar`);
    if (momentumOk) whyNow.push(`Momentum searah (RSI ${indicators.rsi14.toFixed(0)}, MACD bullish)`);
    whyNow.push(`Harga di zona entry dengan R:R ${rr(rrFromPrice!)}`);
  }

  const waitingFor: string[] = [];
  if (!planOk) waitingFor.push('Setup entry yang valid (support/pullback/breakout)');
  if (!trendUp) waitingFor.push('Trend naik terkonfirmasi (harga > EMA50 & EMA200)');
  if (planOk && !inEntryZone) waitingFor.push(entryDistPct! > 0 ? `Harga kembali ke zona entry sekitar ${rp(plan.entry)}` : `Harga naik ke area entry ${rp(plan.entry)}`);
  if (!momentumOk) waitingFor.push('Momentum bullish (MACD > signal, RSI 50–70)');
  if (!volumeOk) waitingFor.push('Volume > 1,5x rata-rata dengan candle hijau');
  if (!triggerOk) waitingFor.push(plan.entryType === 'BUY_ON_BREAKOUT' ? `Close di atas ${rp(plan.entry)}` : 'Candle konfirmasi (bullish engulfing/hammer)');
  if (planOk && !rrOk) waitingFor.push(`R:R minimal ${rr(SARA_MIN_RR)}`);

  const timing: SaraDimension = {
    key: 'timing',
    title: 'Timing',
    question: 'Entry sekarang punya edge?',
    status: timingConfirmed ? 'SUPPORT' : fomo ? 'FAIL' : 'NEUTRAL',
    label: timingConfirmed ? 'Terkonfirmasi' : fomo ? 'FOMO — terlalu tinggi' : 'Belum terkonfirmasi',
    tone: timingConfirmed ? 'positive' : fomo ? 'negative' : 'warning',
    detail: timingConfirmed ? whyNow.join(' · ') : fomo ? fomoReasons.join(' · ') : `Menunggu: ${waitingFor.slice(0, 2).join('; ') || 'konfirmasi'}.`,
  };

  // ── WHY BUY? (max 3, strongest first, positives only) ──────────────────────
  const whyBuy: string[] = [];
  if (fundamental.status === 'SUPPORT') whyBuy.push(pillars.health.summary);
  if (valuation.status === 'SUPPORT' && pillars.valuation.upsidePct != null && pillars.valuation.fairValue != null) {
    whyBuy.push(pillars.valuation.upsidePct > 0
      ? `Harga ${pillars.valuation.upsidePct.toFixed(0)}% di bawah nilai wajar ${rp(pillars.valuation.fairValue)}`
      : `Harga di sekitar nilai wajar ${rp(pillars.valuation.fairValue)}`);
  }
  if (trendUp) whyBuy.push('Trend jangka menengah–panjang naik (di atas EMA50 & EMA200)');
  if (whyBuy.length < 3 && fundamental.status === 'NEUTRAL') whyBuy.push(pillars.health.summary);
  if (whyBuy.length < 3 && volumeOk) whyBuy.push(`Akumulasi volume ${rvol.toFixed(1)}x rata-rata`);

  // ── ENTRY / WHERE WRONG / TARGET ───────────────────────────────────────────
  const inAccumulation = pillars.valuation.accumulationHigh != null && price <= pillars.valuation.accumulationHigh;
  let entry: SaraDecision['entry'] = null;
  if (planOk) {
    const low = plan.entryType === 'BUY_ON_BREAKOUT' ? plan.entry : roundToTick(plan.entry * 0.99);
    const high = plan.entryType === 'BUY_ON_BREAKOUT' ? roundToTick(plan.entry * 1.01) : plan.entry;
    entry = { low, high, text: `${rp(low)} – ${rp(high)}` };
  }

  const supportBelowSl = supportResistance.supports.map((s) => s.price).filter((s) => s > plan.sl && s < plan.entry).sort((a, b) => b - a)[0];
  const whereWrong: SaraDecision['whereWrong'] = planOk
    ? {
        price: plan.sl,
        reason: `${plan.invalidationRule}${supportBelowSl ? ` — support ${rp(supportBelowSl)} jebol berarti struktur naik gagal` : ' — struktur naik gagal'}. Fundamental: thesis batal jika kinerja keuangan memburuk.`,
      }
    : nearestSupport
      ? { price: roundToTick(nearestSupport * 0.97), reason: `3% di bawah support terdekat ${rp(nearestSupport)} — setup belum valid, level ini hanya acuan risiko.` }
      : null;

  const targets = planOk ? { tp1: plan.tp1, tp2: plan.tp2 } : null;

  const riskReward: SaraDecision['riskReward'] = {
    planned: rrPlanned,
    fromPrice: rrFromPrice,
    ok: rrOk,
    text: rrFromPrice == null
      ? 'R:R belum bisa dihitung — entry/SL/target belum jelas. Jangan BUY.'
      : rrOk
        ? `R:R ${rr(rrFromPrice)} dari harga sekarang${rrPlanned != null ? ` (${rr(rrPlanned)} dari entry ideal)` : ''} — layak.`
        : `R:R hanya ${rr(rrFromPrice)} dari harga sekarang — risiko terlalu besar dibanding reward.${rrPlanned != null && rrPlanned >= SARA_MIN_RR ? ` Tunggu entry ideal (${rr(rrPlanned)}).` : ''}`,
  };

  // ── DECISION ────────────────────────────────────────────────────────────────
  const fundamentalFail = fundamental.status === 'FAIL';
  const valuationFail = valuation.status === 'FAIL';
  const goodBusiness = fundamental.status === 'SUPPORT' || fundamental.status === 'NEUTRAL';
  const thesisBrokenTechnically = trendEma.trend === 'bearish' && hasEma200 && price < trendEma.ema200 && (!planOk || price < plan.sl);

  let decision: SaraDecisionType;
  let headline: string;

  if (holding) {
    if (fundamentalFail) {
      decision = 'SELL';
      headline = 'THESIS INVESTASI RUSAK — fundamental tidak lagi mendukung.';
    } else if (valuationFail || thesisBrokenTechnically) {
      decision = 'REDUCE';
      headline = valuationFail
        ? 'VALUASI SUDAH TERLALU MAHAL — kurangi posisi / amankan profit.'
        : 'LEVEL INVALIDATION TERLEWATI — kurangi posisi, disiplin risk.';
    } else {
      decision = 'HOLD';
      headline = 'THESIS MASIH VALID — pertahankan posisi, pantau level invalidation.';
    }
  } else if (fundamentalFail || valuationFail) {
    decision = 'NO_BUY';
    headline = timingConfirmed || trendUp
      ? `TIMING BAGUS, TAPI ${fundamentalFail ? 'FUNDAMENTAL' : 'VALUASI'} TIDAK MENDUKUNG → NO BUY.`
      : `${fundamentalFail ? 'FUNDAMENTAL' : 'VALUASI'} TIDAK MENDUKUNG → NO BUY.`;
  } else if (timingConfirmed && goodBusiness && valuation.status === 'SUPPORT') {
    decision = 'BUY_NOW';
    headline = 'FUNDAMENTAL, VALUASI & TIMING SELARAS — entry sekarang punya edge.';
  } else if (goodBusiness && valuation.status === 'SUPPORT' && (pillars.valuation.verdict === 'UNDERVALUED' || inAccumulation) && !fomo && whereWrong != null) {
    decision = 'ACCUMULATE';
    headline = 'FUNDAMENTAL BAGUS & HARGA MENARIK — beli bertahap, belum ada konfirmasi timing penuh.';
  } else {
    decision = 'WAIT';
    headline = goodBusiness
      ? fomo
        ? 'NO FOMO — FUNDAMENTAL BAGUS ≠ HARUS MEMBELI SEKARANG.'
        : 'FUNDAMENTAL BAGUS, TAPI BELUM LAYAK DIBELI SEKARANG.'
      : 'DATA FUNDAMENTAL KURANG & TIMING BELUM TERKONFIRMASI — tunggu.';
  }

  return {
    decision,
    headline,
    dimensions: [fundamental, valuation, timing],
    whyBuy: whyBuy.slice(0, 3),
    whyNow,
    hasEdge: timingConfirmed,
    waitingFor,
    entry,
    whereWrong,
    targets,
    riskReward,
    confidence: { level, passed, total: checks.length, checks },
    fomo: {
      triggered: fomo,
      reasons: fomoReasons,
      message: fomo ? 'NO FOMO — fundamental bagus ≠ harus membeli sekarang.' : null,
    },
  };
}

/** Plain-text version for Copy/Share. */
export function formatSaraDecision(ticker: string, d: SaraDecision): string {
  const lines = [
    `🤖 SARA AI — ${ticker}`,
    '',
    `📌 DECISION: ${SARA_DECISION_LABEL[d.decision]}`,
    d.headline,
    '',
    ...d.dimensions.map((x) => `• ${x.title} (${x.question}) — ${x.label}`),
    '',
    '💡 WHY BUY?',
    ...(d.whyBuy.length ? d.whyBuy.map((w) => `- ${w}`) : ['- Belum ada alasan kuat']),
    '',
    '⚡ WHY NOW?',
    ...(d.hasEdge ? d.whyNow.map((w) => `- ${w}`) : ['- BELUM ADA EDGE', ...d.waitingFor.slice(0, 3).map((w) => `  · Menunggu: ${w}`)]),
    '',
    `🎯 ENTRY: ${d.entry?.text ?? 'Belum ada entry valid'}`,
    `🛑 WHERE WRONG?: ${d.whereWrong ? `${rp(d.whereWrong.price)} — ${d.whereWrong.reason}` : 'Belum jelas'}`,
    `🎯 TARGET: ${d.targets ? `TP1 ${rp(d.targets.tp1)} · TP2 ${rp(d.targets.tp2)}` : '—'}`,
    `⚖️ RISK/REWARD: ${d.riskReward.text}`,
    `📊 CONFIDENCE: ${d.confidence.level} (${d.confidence.passed}/${d.confidence.total} konfirmasi)`,
  ];
  if (d.fomo.triggered) lines.push('', `🚨 FOMO CHECK: ${d.fomo.message}`, ...d.fomo.reasons.map((r) => `- ${r}`));
  lines.push('', 'Bukan ajakan jual/beli. Keputusan & risiko sepenuhnya milik investor.');
  return lines.join('\n');
}
