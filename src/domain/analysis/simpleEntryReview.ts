/**
 * simpleEntryReview.ts
 *
 * Short, simple, actionable stock INSIGHT (EquityResearchReportCardv4). Answers 3 questions:
 *   1. What is happening to the price?            → INSIGHT
 *   2. Is there a reason to enter?                 → DECISION + WHY
 *   3. If not yet, what should we wait for?        → NEXT SETUP (WAIT / NO TRADE only)
 *
 * Four reads, in this order: QUALITY (fundamental) → MOMENTUM → VOLUME → FOMO → ENTRY.
 *  - Fundamental decides quality, momentum decides timing, FOMO decides whether entry is still fair.
 *  - BUY     = Fundamental GOOD/ACCEPTABLE + Momentum BULLISH + Volume supportive + FOMO LOW (near zone).
 *  - WAIT    = Quality OK, but momentum not strong enough, volume not supportive, or price ran too far.
 *  - NO TRADE = Fundamental WEAK, momentum BEARISH, or risk too high.
 *  - Rising price, big volume or good fundamentals are never BUY on their own.
 *
 * Never recomputes Entry/SL/TP, Risk Gate or catalysts — the caller passes the already-derived
 * reads from tenSecondReview.ts / todayMoveAnalysis.ts, and a NO TRADE there is never upgraded here.
 */

import { formatRupiah } from '@/lib/format';
import { FundamentalRiskLevel } from '@/domain/analysis/riskGate';
import { CatalystStatus, MoveType, RiskLevel3, TodayTradeStatus } from '@/domain/analysis/todayMoveAnalysis';

export type SimpleFundamental = 'GOOD' | 'ACCEPTABLE' | 'WEAK';
export type SimpleMomentum = 'BULLISH' | 'NEUTRAL' | 'BEARISH';
/** SUPPORTIVE = buyers backing the move, SELLING = sellers pressing, NEUTRAL = nothing decisive. */
export type SimpleVolume = 'SUPPORTIVE' | 'NEUTRAL' | 'SELLING';
export type FomoRisk = 'LOW' | 'MEDIUM' | 'HIGH';
export type SimpleEntry = 'BUY' | 'WAIT' | 'NO_TRADE';

export const SIMPLE_ENTRY_LABEL: Record<SimpleEntry, string> = { BUY: 'BUY', WAIT: 'WAIT', NO_TRADE: 'NO TRADE' };
export const SIMPLE_FUNDAMENTAL_LABEL: Record<SimpleFundamental, string> = { GOOD: 'Good', ACCEPTABLE: 'Acceptable', WEAK: 'Weak' };
export const SIMPLE_MOMENTUM_LABEL: Record<SimpleMomentum, string> = { BULLISH: 'Bullish', NEUTRAL: 'Neutral', BEARISH: 'Bearish' };
export const SIMPLE_VOLUME_LABEL: Record<SimpleVolume, string> = { SUPPORTIVE: 'Mendukung', NEUTRAL: 'Biasa', SELLING: 'Tekanan Jual' };
export const FOMO_RISK_LABEL: Record<FomoRisk, string> = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High' };

export interface SimpleEntryInput {
  price: number;
  changePct: number;
  percentChange1M: number;
  rvol: number | null;
  volume: number;
  prevVolume: number | null;
  trend: 'bullish' | 'bearish' | 'sideways';
  rsi14: number;
  macdBullish: boolean;
  macdBearish: boolean;
  ema50: number;
  ema200: number;
  support: number | null;
  resistance: number | null;
  moveType: MoveType;
  catalystStatus: CatalystStatus;
  entryZoneLow: number;
  entryZoneHigh: number;
  fundamentalRisk: FundamentalRiskLevel;
  chaseRisk: RiskLevel3;
  eventRisk: RiskLevel3;
  isStrongDistribution: boolean;
  setupInvalidated: boolean;
  /** Trade status from todayMoveAnalysis.ts — a NO_TRADE there is never upgraded. */
  baseTradeStatus: TodayTradeStatus;
}

export interface SimpleEntryReview {
  price: number;
  changePct: number;
  fundamental: SimpleFundamental;
  momentum: SimpleMomentum;
  volume: SimpleVolume;
  fomoRisk: FomoRisk;
  /** % price sits above the top of the entry zone (negative = inside/below zone). */
  distanceFromZonePct: number | null;
  /** 1–2 sentences: what is happening to the price. */
  insight: string;
  decision: SimpleEntry;
  /** 1 sentence: why this decision. */
  why: string;
  /** What to wait for — only for WAIT / NO TRADE. */
  nextSetup: string | null;
}

/** FOMO thresholds: distance above the entry-zone top. */
const FOMO_LOW_MAX_PCT = 3;
const FOMO_MEDIUM_MAX_PCT = 8;
/** |changePct| below this counts as a flat day. */
const FLAT_PCT = 0.5;

function rp(n: number | null | undefined): string | null {
  return n != null && n > 0 ? formatRupiah(Math.round(n)) : null;
}
function pct(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

export function buildSimpleEntryReview(i: SimpleEntryInput): SimpleEntryReview {
  const volumeRising = i.prevVolume != null && i.prevVolume > 0 && i.volume > i.prevVolume;
  const rvol = i.rvol ?? 0;

  // ── QUALITY
  const fundamental: SimpleFundamental =
    i.fundamentalRisk === 'LOW' ? 'GOOD' : i.fundamentalRisk === 'MODERATE' ? 'ACCEPTABLE' : 'WEAK';

  // ── MOMENTUM (timing)
  const momentum: SimpleMomentum =
    i.trend === 'bullish' && i.macdBullish && i.rsi14 >= 50
      ? 'BULLISH'
      : i.trend === 'bearish' || (i.macdBearish && i.rsi14 < 45)
        ? 'BEARISH'
        : 'NEUTRAL';

  // ── VOLUME: big volume only counts when it backs the direction of the move.
  const volume: SimpleVolume =
    i.isStrongDistribution || (i.changePct < 0 && rvol >= 1.5)
      ? 'SELLING'
      : i.changePct > 0 && (rvol >= 1.5 || (rvol >= 1 && volumeRising))
        ? 'SUPPORTIVE'
        : 'NEUTRAL';

  // ── FOMO: distance from entry zone, escalated by a too-fast move.
  const zoneTop = i.entryZoneHigh > 0 ? i.entryZoneHigh : null;
  const distanceFromZonePct = zoneTop != null ? ((i.price - zoneTop) / zoneTop) * 100 : null;
  let fomoRisk: FomoRisk =
    distanceFromZonePct == null ? 'MEDIUM'
      : distanceFromZonePct <= FOMO_LOW_MAX_PCT ? 'LOW'
        : distanceFromZonePct <= FOMO_MEDIUM_MAX_PCT ? 'MEDIUM' : 'HIGH';
  if (i.changePct >= 10 || i.rsi14 >= 80 || i.chaseRisk === 'HIGH') fomoRisk = 'HIGH';
  else if (fomoRisk === 'LOW' && (i.changePct >= 5 || i.rsi14 >= 70)) fomoRisk = 'MEDIUM';

  // ── DECISION
  const noTradeReason =
    fundamental === 'WEAK' ? 'kualitas bisnisnya lemah'
      : momentum === 'BEARISH' ? 'harga masih dalam tren turun'
        : i.isStrongDistribution ? 'ada tanda aksi jual besar'
          : i.setupInvalidated ? 'harga sudah jatuh di bawah batas setup'
            : i.eventRisk === 'HIGH' ? 'ada risiko event yang tinggi'
              : i.baseTradeStatus === 'NO_TRADE' ? 'risikonya saat ini terlalu tinggi'
                : null;
  const belowEma200 = i.ema200 > 0 && i.price < i.ema200;

  const decision: SimpleEntry =
    noTradeReason ? 'NO_TRADE'
      : momentum === 'BULLISH' && volume === 'SUPPORTIVE' && fomoRisk === 'LOW' && !belowEma200 ? 'BUY'
        : 'WAIT';

  const zoneTxt = rp(i.entryZoneLow) && i.entryZoneLow !== i.entryZoneHigh
    ? `${rp(i.entryZoneLow)}–${rp(i.entryZoneHigh)}`
    : rp(i.entryZoneHigh);
  const qualityTxt = fundamental === 'GOOD' ? 'bagus' : 'cukup';

  // ── INSIGHT (1–2 kalimat): apa yang terjadi pada harga + arahnya.
  const move = describeMove(i, volume);
  const context =
    momentum === 'BULLISH'
      ? fomoRisk === 'HIGH'
        ? distanceFromZonePct != null && distanceFromZonePct > 0
          ? `Tren sedang naik, tapi harga sudah ${distanceFromZonePct.toFixed(0)}% di atas area beli.`
          : 'Tren sedang naik, tapi harga bergerak terlalu cepat.'
        : fomoRisk === 'LOW' ? 'Tren sedang naik dan harga masih dekat area beli.' : 'Tren sedang naik, tapi harga mulai menjauh dari area beli.'
      : momentum === 'BEARISH' ? 'Arah besarnya masih turun.' : 'Arah harga belum jelas.';
  const insight = `${move} ${context}`;

  // ── WHY (1 kalimat) + NEXT SETUP
  let why: string;
  let nextSetup: string | null = null;
  if (decision === 'BUY') {
    why = `Bisnis ${qualityTxt}, harga sedang naik dengan dukungan pembeli, dan masih dekat area beli${zoneTxt ? ` ${zoneTxt}` : ''}.`;
  } else if (decision === 'NO_TRADE') {
    why = `Jangan masuk dulu karena ${noTradeReason}.`;
    nextSetup = noTradeNextSetup(i, fundamental, momentum);
  } else {
    // Blockers in decision order: MOMENTUM → VOLUME → FOMO (+ long-term trend).
    const blockers: string[] = [];
    const waitFor: string[] = [];
    if (fomoRisk !== 'LOW') {
      waitFor.push(zoneTxt ? `harga turun kembali ke area beli ${zoneTxt}` : 'harga turun kembali ke area beli');
    }
    if (momentum !== 'BULLISH') {
      blockers.push('arah naiknya belum jelas');
      const level = rp(i.resistance);
      waitFor.push(level ? `harga bertahan di atas ${level}` : 'harga mulai naik secara konsisten');
    }
    if (volume !== 'SUPPORTIVE') {
      blockers.push(volume === 'SELLING' ? 'penjual masih menekan' : 'pembeli belum cukup ramai');
      waitFor.push('volume beli naik jelas (±1,5× rata-rata)');
    }
    if (fomoRisk !== 'LOW') {
      blockers.push(fomoRisk === 'HIGH' ? 'harga sudah naik terlalu jauh' : 'harga mulai menjauh dari area beli');
    }
    if (belowEma200) {
      blockers.push('tren jangka panjang masih turun');
      waitFor.push(`harga kembali di atas ${rp(i.ema200)}`);
    }
    why = `Bisnisnya ${qualityTxt}, tapi ${blockers.slice(0, 2).join(' dan ')}.`;
    nextSetup = `Tunggu ${waitFor.slice(0, 2).join(' dan ')}.`;
  }

  return {
    price: i.price,
    changePct: i.changePct,
    fundamental,
    momentum,
    volume,
    fomoRisk,
    distanceFromZonePct,
    insight,
    decision,
    why,
    nextSetup,
  };
}

/** First insight sentence: today's price move and its most likely driver. */
function describeMove(i: SimpleEntryInput, volume: SimpleVolume): string {
  const chg = pct(i.changePct);
  if (i.changePct <= -FLAT_PCT) {
    return volume === 'SELLING' ? `Harga turun ${chg} dengan tekanan jual yang besar.` : `Harga turun ${chg} hari ini.`;
  }
  if (i.changePct < FLAT_PCT) return `Harga cenderung datar hari ini (${chg}).`;

  const resistance = rp(i.resistance);
  if (i.catalystStatus === 'VERIFIED' && (i.moveType === 'EVENT' || i.moveType === 'REOPENING')) {
    return i.moveType === 'REOPENING'
      ? `Harga naik ${chg} setelah saham dibuka kembali dari suspensi.`
      : `Harga naik ${chg} karena ada berita/event yang jelas.`;
  }
  if (i.moveType === 'BREAKOUT' || (resistance && i.price > (i.resistance ?? 0) && volume === 'SUPPORTIVE')) {
    return `Harga naik ${chg} dan menembus batas atas${resistance ? ` ${resistance}` : ''}.`;
  }
  if (volume === 'SUPPORTIVE') return `Harga naik ${chg} dengan pembeli yang ramai.`;
  if (i.percentChange1M < 0 || i.trend === 'bearish' || (i.ema50 > 0 && i.price < i.ema50)) {
    return `Harga memantul ${chg} setelah sempat turun — belum tentu berbalik naik.`;
  }
  return `Harga naik ${chg} tanpa pemicu yang jelas.`;
}

function noTradeNextSetup(i: SimpleEntryInput, fundamental: SimpleFundamental, momentum: SimpleMomentum): string {
  if (fundamental === 'WEAK') return 'Lewati dulu sampai kinerja bisnisnya membaik.';
  if (momentum === 'BEARISH') {
    const level = rp(i.resistance) ?? rp(i.ema50);
    return level
      ? `Tunggu harga kembali di atas ${level} dan berhenti membuat titik terendah baru.`
      : 'Tunggu harga berhenti membuat titik terendah baru dan mulai naik.';
  }
  const support = rp(i.support);
  if (i.isStrongDistribution) return `Tunggu aksi jual mereda dan harga stabil${support ? ` di atas ${support}` : ''}.`;
  if (i.setupInvalidated) return 'Tunggu harga membentuk dasar baru sebelum mencari setup berikutnya.';
  if (i.eventRisk === 'HIGH') return 'Tunggu event selesai dan harga kembali stabil.';
  return 'Tunggu risiko mereda dan setup baru muncul.';
}

/** Plain-text version in the exact output format, for copy/share. */
export function formatSimpleEntryReview(ticker: string, r: SimpleEntryReview): string {
  const lines = [
    `${ticker} — ${rp(r.price) ?? '–'} (${pct(r.changePct)})`,
    '',
    '🧠 INSIGHT',
    r.insight,
    '',
    '🎯 DECISION',
    SIMPLE_ENTRY_LABEL[r.decision],
    '',
    '💡 WHY',
    r.why,
  ];
  if (r.nextSetup) lines.push('', '⏳ NEXT SETUP', r.nextSetup);
  return lines.join('\n');
}
