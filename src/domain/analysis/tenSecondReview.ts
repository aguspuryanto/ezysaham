/**
 * tenSecondReview.ts
 *
 * "EzySaham 10-Second Review" — collapses the full Equity Research Report (EquityResearchReportCard2)
 * into one beginner-readable verdict: KONDISI → STRATEGI → LEVEL → KONFIRMASI → RISIKO → KESIMPULAN.
 *
 * This module never recomputes indicators, Entry/SL/TP or Risk Gate — the caller passes the already
 * derived reads (same riskGate.ts / tradeValidation.ts / swingSuitability.ts outputs the full report
 * shows), and this only decides how to phrase them. Rules it enforces:
 *  - Status is never just Market Status: trend, entry confirmation, zone, risk all feed it, and when
 *    reads conflict the more conservative status wins (with a short conflict note).
 *  - BUY SETUP only when the entry is actually confirmed (and, for BOB, breakout + volume).
 *  - Entry zone already passed → say so and describe the Next Setup instead of the stale zone.
 *  - No TP/SL, no AI score, no R:R, no price prediction.
 */

import { formatRupiah } from '@/lib/format';
import { TradeDirection } from '@/domain/models/StockAnalysis';
import { FundamentalRiskLevel, TradeStatus } from '@/domain/analysis/riskGate';
import { ZoneStatus } from '@/domain/analysis/tradeValidation';
import { SwingSetup } from '@/domain/analysis/swingSuitability';

export type ReviewStatus = 'BUY_SETUP' | 'WAIT' | 'WATCHLIST' | 'NO_TRADE';
/** BOW = Buy on Weakness · BOS = Buy on Support · BOB = Buy on Breakout. */
export type ReviewStrategy = 'BOW' | 'BOS' | 'BOB';

export const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = {
  BUY_SETUP: 'BUY SETUP',
  WAIT: 'WAIT',
  WATCHLIST: 'WATCHLIST',
  NO_TRADE: 'NO TRADE',
};

export const REVIEW_STRATEGY_LABEL: Record<ReviewStrategy, string> = {
  BOW: 'BOW — Buy on Weakness',
  BOS: 'BOS — Buy on Support',
  BOB: 'BOB — Buy on Breakout',
};

export interface TenSecondReviewInput {
  ticker: string;
  price: number;
  trend: 'bullish' | 'bearish' | 'sideways';
  rsi14: number;
  macdBullish: boolean;
  macdBearish: boolean;
  relativeVolume: number;
  lastCandleColor: 'green' | 'red' | 'doji';
  support: number | null;
  resistance: number | null;
  direction: TradeDirection;
  swingSetup: SwingSetup;
  /** LONG entry zone as displayed on the full report (already tick-rounded). */
  entryZoneLow: number;
  entryZoneHigh: number;
  zoneStatus: ZoneStatus;
  tradeStatus: TradeStatus;
  entryConfirmed: boolean;
  setupInvalidated: boolean;
  /** Price at/above resistance AND volume confirmed (swingSetup === 'BREAKOUT'). */
  breakoutConfirmed: boolean;
  aboveEma50: boolean;
  aboveEma200: boolean;
  fundamentalRisk: FundamentalRiskLevel;
  isStrongDistribution: boolean;
  isDistributionRisk: boolean;
  hiddenDistribution: boolean;
  hasSetupErrors: boolean;
}

export interface TenSecondReview {
  status: ReviewStatus;
  trendLabel: 'Bullish' | 'Sideways' | 'Bearish';
  momentumLabel: 'Positif' | 'Netral' | 'Lemah';
  volumeLabel: 'Kuat' | 'Normal' | 'Lemah' | 'Data belum tersedia';
  mainRisks: string[];
  strategy: ReviewStrategy | null;
  strategyNote: string | null;
  support: number | null;
  resistance: number | null;
  scenario: string;
  confirmation: string;
  warnings: string[];
  conclusion: string;
}

/** Price within this % below resistance counts as "near breakout" for the Next Setup choice. */
const NEAR_RESISTANCE_PCT = 3;
/** Price within this % above support counts as "near support" for BOS. */
const NEAR_SUPPORT_PCT = 3;

function rp(n: number | null): string {
  return n != null && n > 0 ? formatRupiah(n) : '–';
}

function pctAbove(price: number, level: number | null): number | null {
  return level != null && level > 0 ? ((price - level) / level) * 100 : null;
}

export function buildTenSecondReview(i: TenSecondReviewInput): TenSecondReview {
  const trendLabel = i.trend === 'bullish' ? 'Bullish' : i.trend === 'bearish' ? 'Bearish' : 'Sideways';
  const momentumLabel =
    i.macdBullish && i.rsi14 >= 50 ? 'Positif' : i.macdBearish || i.rsi14 < 40 ? 'Lemah' : 'Netral';
  const rvolMissing = Number.isNaN(i.relativeVolume) || i.relativeVolume === 0;
  const volumeLabel = rvolMissing
    ? 'Data belum tersedia'
    : i.relativeVolume >= 1.5
      ? 'Kuat'
      : i.relativeVolume >= 0.8
        ? 'Normal'
        : 'Lemah';
  const heavySellVolume = volumeLabel === 'Kuat' && i.lastCandleColor === 'red';

  const isLong = i.direction === 'LONG';
  const distToSupport = pctAbove(i.price, i.support);
  const distToResistance = i.resistance != null ? ((i.resistance - i.price) / i.resistance) * 100 : null;
  const nearResistance = distToResistance != null && distToResistance >= 0 && distToResistance <= NEAR_RESISTANCE_PCT;
  const nearSupport = distToSupport != null && distToSupport >= 0 && distToSupport <= NEAR_SUPPORT_PCT;
  const entryZonePassed = isLong && i.zoneStatus === 'ABOVE_ZONE';
  const chasing = i.rsi14 >= 80 || (entryZonePassed && i.rsi14 >= 70);

  // ── Strategy: the setup the engine detected; once the entry zone is passed, the Next Setup —
  // breakout if price is already pressing resistance, otherwise wait for weakness back to support.
  let strategy: ReviewStrategy | null = null;
  if (isLong && !i.setupInvalidated && !i.hasSetupErrors) {
    if (i.swingSetup === 'BREAKOUT' || i.swingSetup === 'BREAKOUT_WATCH') strategy = 'BOB';
    else if (entryZonePassed) strategy = nearResistance ? 'BOB' : 'BOW';
    else if (i.swingSetup === 'BUY_ON_SUPPORT') strategy = 'BOS';
    else if (i.swingSetup === 'BUY_ON_PULLBACK') strategy = 'BOW';
  }

  // ── Risks, most material first. Short labels for KONDISI, longer text for PERINGATAN.
  const risks: { label: string; warning: string }[] = [];
  if (i.setupInvalidated) risks.push({ label: 'Setup lama sudah batal', warning: 'Harga sudah menembus batas invalidasi — setup lama tidak berlaku lagi.' });
  if (i.fundamentalRisk === 'HIGH') risks.push({ label: 'Fundamental lemah', warning: 'Risiko fundamental tinggi — kinerja/keuangan perusahaan lemah.' });
  if (i.isStrongDistribution) risks.push({ label: 'Distribusi kuat', warning: 'Ada indikasi distribusi kuat (bandar cenderung jualan).' });
  if (!i.aboveEma200) risks.push({ label: 'Di bawah EMA200', warning: 'Harga di bawah EMA200 — tren jangka panjang masih lemah.' });
  if (chasing) risks.push({ label: 'Rawan kejar harga', warning: `RSI ${i.rsi14.toFixed(0)} sudah tinggi — beli sekarang berisiko "mengejar" harga.` });
  if (i.isDistributionRisk) risks.push({ label: 'Risiko distribusi', warning: 'Ada tanda distribusi — waspada aksi jual besar.' });
  if (i.hiddenDistribution) risks.push({ label: 'Distribusi tersembunyi', warning: 'Harga naik tapi OBV melemah — waspada distribusi tersembunyi.' });
  if (heavySellVolume) risks.push({ label: 'Volume jual besar', warning: 'Volume tinggi di candle merah — tekanan jual sedang besar.' });
  if (i.trend === 'bearish' && i.aboveEma200) risks.push({ label: 'Tren turun', warning: 'Tren jangka pendek masih turun.' });
  if (volumeLabel === 'Lemah') risks.push({ label: 'Volume sepi', warning: 'Volume di bawah rata-rata — pergerakan belum didukung minat beli.' });
  if (!i.aboveEma50 && i.aboveEma200) risks.push({ label: 'Di bawah EMA50', warning: 'Harga di bawah EMA50 — momentum menengah belum pulih.' });
  const mainRisks = risks.slice(0, 2).map((r) => r.label);

  // Hard conflicts that must keep a technically-confirmed entry from reading BUY SETUP (rule 15).
  const hardConflict = i.fundamentalRisk === 'HIGH' || i.isStrongDistribution || !i.aboveEma200;

  // ── Status: start from the engine's Trade Status, then only ever move toward caution.
  let status: ReviewStatus;
  if (i.hasSetupErrors || i.setupInvalidated || i.tradeStatus === 'NO_TRADE' || !isLong || strategy == null) {
    status = 'NO_TRADE';
  } else if (
    i.tradeStatus === 'BUY' &&
    i.entryConfirmed &&
    (strategy !== 'BOB' || i.breakoutConfirmed) &&
    (strategy !== 'BOS' || nearSupport || i.zoneStatus === 'IN_ZONE') &&
    !hardConflict
  ) {
    status = 'BUY_SETUP';
  } else if (entryZonePassed && !nearResistance) {
    status = 'WATCHLIST';
  } else if (i.trend === 'sideways' && momentumLabel !== 'Positif' && strategy !== 'BOB') {
    status = 'WATCHLIST';
  } else {
    status = 'WAIT';
  }
  // A bearish primary trend under the long-term average is never better than WATCHLIST.
  if ((status === 'WAIT' || status === 'BUY_SETUP') && i.trend === 'bearish' && !i.aboveEma200) status = 'WATCHLIST';

  const supportTxt = rp(i.support);
  const resistanceTxt = rp(i.resistance);
  const zoneTxt = i.entryZoneLow === i.entryZoneHigh ? rp(i.entryZoneHigh) : `${rp(i.entryZoneLow)}–${rp(i.entryZoneHigh)}`;

  // ── Scenario + confirmation.
  let scenario: string;
  let confirmation: string;
  let strategyNote: string | null = null;
  if (i.hasSetupErrors) {
    scenario = 'Data setup belum konsisten — tunggu data diperbarui.';
    confirmation = 'Cek ulang chart secara manual sebelum mengambil keputusan.';
  } else if (i.setupInvalidated) {
    scenario = 'Setup lama batal. Tunggu harga membentuk dasar baru (higher-low).';
    confirmation = `Harga kembali di atas ${resistanceTxt} dengan volume naik.`;
  } else if (!isLong || strategy == null) {
    scenario = `Tunggu tren berhenti turun: harga kembali di atas ${resistanceTxt} dan membentuk higher-low.`;
    confirmation = 'MACD berbalik positif dan volume beli meningkat.';
  } else if (status === 'BUY_SETUP') {
    scenario = strategy === 'BOB'
      ? `Breakout di atas ${resistanceTxt} sudah terjadi dengan volume.`
      : `Harga sudah di area entry ${zoneTxt} dan mulai memantul.`;
    confirmation = `Setup batal jika harga close di bawah ${strategy === 'BOB' ? resistanceTxt : supportTxt}.`;
  } else if (strategy === 'BOB') {
    scenario = `Harga menembus dan bertahan di atas resistance ${resistanceTxt}.`;
    confirmation = 'Close di atas resistance dengan volume di atas rata-rata (RVOL ≥ 1,5×).';
  } else if (strategy === 'BOS') {
    scenario = `Harga turun mendekati support ${supportTxt} dan bertahan di sana.`;
    confirmation = 'Muncul candle pembalikan (hijau/hammer) di support dengan volume normal atau naik.';
  } else {
    scenario = entryZonePassed
      ? `Tunggu harga koreksi sehat kembali ke area support ${supportTxt}.`
      : `Harga koreksi ke area ${zoneTxt} tanpa menembus support ${supportTxt}.`;
    confirmation = 'Penurunan dengan volume mengecil, lalu candle hijau tanda rebound.';
  }
  if (entryZonePassed && strategy != null) {
    strategyNote = `Entry zone ${zoneTxt} sudah terlewati — fokus ke Next Setup.`;
  }

  // ── Warnings: top risks + a short note when reads disagree.
  const warnings = risks.slice(0, 2).map((r) => r.warning);
  const technicallyPositive = i.trend === 'bullish' || momentumLabel === 'Positif';
  if (technicallyPositive && hardConflict) {
    warnings.push('Teknikal terlihat positif, tapi ada risiko besar — status dibuat lebih hati-hati.');
  }
  if (warnings.length === 0) warnings.push('Tidak ada risiko besar terdeteksi, tetap disiplin dengan batas risiko.');

  // ── Kesimpulan 10 detik: kondisi → entry menarik/tidak → yang ditunggu.
  const condition =
    i.trend === 'bullish'
      ? `${i.ticker} sedang dalam tren naik${momentumLabel === 'Lemah' ? ' tapi momentumnya melemah' : ''}`
      : i.trend === 'bearish'
        ? `${i.ticker} masih dalam tren turun`
        : `${i.ticker} sedang bergerak sideways`;
  const entryRead =
    status === 'BUY_SETUP'
      ? 'setup beli sudah terkonfirmasi, tapi tetap disiplin dengan batas risiko'
      : status === 'WAIT'
        ? 'harga sudah dekat area setup, tapi konfirmasinya belum muncul'
        : status === 'WATCHLIST'
          ? entryZonePassed
            ? 'entry belum menarik karena harga sudah lewat area beli'
            : 'entry belum menarik karena setupnya belum jelas'
          : 'belum ada setup beli yang layak';
  const waitFor =
    status === 'BUY_SETUP'
      ? `Pantau agar harga tetap bertahan di atas ${strategy === 'BOB' ? resistanceTxt : supportTxt}.`
      : strategy === 'BOB'
        ? `Tunggu breakout ${resistanceTxt} dengan volume kuat.`
        : strategy === 'BOS'
          ? `Tunggu pantulan di support ${supportTxt}.`
          : strategy === 'BOW'
            ? `Tunggu koreksi sehat ke area ${entryZonePassed ? supportTxt : zoneTxt} lalu rebound.`
            : 'Tunggu tren berbalik dulu sebelum mempertimbangkan beli.';
  const conclusion = `${condition}; ${entryRead}. ${waitFor}`;

  return {
    status,
    trendLabel,
    momentumLabel,
    volumeLabel,
    mainRisks,
    strategy,
    strategyNote,
    support: i.support,
    resistance: i.resistance,
    scenario,
    confirmation,
    warnings,
    conclusion,
  };
}

/** Plain-text version in the exact "10-Second Review" format, for copy/share. */
export function formatTenSecondReview(ticker: string, price: number, r: TenSecondReview): string {
  return [
    `🚨 ${ticker} — Review Singkat`,
    `Harga: ${rp(price)}`,
    '',
    REVIEW_STATUS_LABEL[r.status],
    '',
    '📈 KONDISI',
    `- Trend: ${r.trendLabel}`,
    `- Momentum: ${r.momentumLabel}`,
    `- Volume: ${r.volumeLabel}`,
    `- Risiko utama: ${r.mainRisks.length > 0 ? r.mainRisks.join(', ') : 'Tidak ada risiko besar'}`,
    '',
    '🎯 STRATEGI',
    r.strategy ? REVIEW_STRATEGY_LABEL[r.strategy] : 'Belum ada strategi beli',
    ...(r.strategyNote ? [r.strategyNote] : []),
    '',
    `Support: ${rp(r.support)}`,
    `Resistance: ${rp(r.resistance)}`,
    '',
    '🔎 YANG PERLU DITUNGGU',
    `- Skenario utama: ${r.scenario}`,
    `- Konfirmasi: ${r.confirmation}`,
    '',
    '⚠️ PERINGATAN',
    ...r.warnings,
    '',
    '🧠 KESIMPULAN 10 DETIK',
    r.conclusion,
  ].join('\n');
}
