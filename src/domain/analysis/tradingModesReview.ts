/**
 * tradingModesReview.ts
 *
 * 3 SISTEM TRADING for EquityResearchReportCardv6 — each mode reads ONLY its own indicators and is
 * never mixed with the others:
 *
 *   ⚡ INTRADAY   VWAP + Volume + Price Action (1-minute session bars)
 *                BUY  price > VWAP + volume rising + breakout / Higher High
 *                WAIT breakout not confirmed yet
 *                SELL price back < VWAP + selling pressure rising
 *   📈 SWING      EMA20 + EMA50 + Volume + Support/Resistance (daily bars)
 *                BUY  price > EMA20 > EMA50 + pullback to support/EMA20 + volume confirms
 *                WAIT trend not clear
 *                SELL support / Higher Low broken
 *   🏦 INVESTING  Earnings growth + ROE + Debt + Cash Flow + PER/PBV/fair value
 *                BUY  healthy fundamentals + good growth + reasonable valuation
 *                WAIT good fundamentals but expensive valuation
 *                SELL fundamental thesis broken
 *
 * Rules: missing data → "N/A" (never invented), DATA (`data`) is kept apart from INTERPRETATION
 * (`signals`), a single signal is never a BUY, and not enough confirmation = WAIT. Targets are
 * projections, not promised profit.
 */

import { formatRupiah } from '@/lib/format';
import type { IntradayBar } from '@/domain/models/Intraday';
import type { OHLCVBar } from '@/domain/models/History';
import { vwap as sessionVwap } from '@/domain/indicators/vwap';
import { roundToTick } from '@/domain/analysis/idxTick';

export type TradingMode = 'INTRADAY' | 'SWING' | 'INVESTING';
export type ModeDecision = 'BUY' | 'WAIT' | 'SELL';

export const TRADING_MODE_LABEL: Record<TradingMode, string> = { INTRADAY: '⚡ INTRADAY', SWING: '📈 SWING', INVESTING: '🏦 INVESTING' };
export const MODE_DECISION_LABEL: Record<ModeDecision, string> = { BUY: 'BUY', WAIT: 'WAIT', SELL: 'SELL' };

export const NA = 'N/A';

export interface ModeDataPoint {
  label: string;
  value: string;
}

export interface ModeReview {
  mode: TradingMode;
  decision: ModeDecision;
  /** Market/Trend read (interpretation). */
  trend: string;
  /** Raw indicator values — DATA only, "N/A" when unavailable. */
  data: ModeDataPoint[];
  /** What the data means for this mode — INTERPRETATION. */
  signals: string[];
  entry: string;
  stop: string;
  target: string;
  risk: string;
  /** One-line reason for the decision. */
  reason: string;
  /** Inputs this mode needed but did not get. */
  missing: string[];
}

const rp = (n: number | null | undefined) => (n != null && Number.isFinite(n) && n > 0 ? formatRupiah(Math.round(n)) : NA);
const pct = (n: number | null | undefined, dec = 1) =>
  (n == null || !Number.isFinite(n) ? NA : `${n >= 0 ? '+' : ''}${n.toFixed(dec)}%`);
const valid = (n: number | null | undefined): n is number => n != null && Number.isFinite(n) && n > 0;
const riskText = (entry: number, stop: number, target: number | null) => {
  const riskPct = ((entry - stop) / entry) * 100;
  const rr = target != null && entry > stop ? (target - entry) / (entry - stop) : null;
  return `Risiko ${riskPct.toFixed(1)}% ke stop${rr != null ? ` · R/R 1:${rr.toFixed(1)}` : ''}`;
};

// ─── ⚡ INTRADAY ─────────────────────────────────────────────────────────────────

/** Minutes compared for "recent" vs "earlier" volume and structure. */
const INTRADAY_WINDOW = 15;
const VWAP_BAND = 0.001;
const VOLUME_RISING_X = 1.2;
const INTRADAY_TARGET_R = 2;

export interface IntradayModeInput {
  /** null = still loading or fetch failed. */
  bars: IntradayBar[] | null;
  /** Fallback price when there are no intraday bars (last daily close). */
  lastClose: number;
}

export function buildIntradayModeReview({ bars, lastClose }: IntradayModeInput): ModeReview {
  const b = bars ?? [];
  const vwap = b.length > 0 ? sessionVwap(b) : null;
  const price = b.length > 0 ? b[b.length - 1].price : lastClose;

  if (vwap == null || b.length < INTRADAY_WINDOW * 2) {
    return {
      mode: 'INTRADAY',
      decision: 'WAIT',
      trend: NA,
      data: [
        { label: 'Harga', value: rp(price) },
        { label: 'VWAP', value: vwap != null ? rp(vwap) : NA },
        { label: 'Volume', value: NA },
        { label: 'Price Action', value: NA },
      ],
      signals: [b.length === 0
        ? 'Data intraday tidak tersedia (sesi tertutup / belum ada data).'
        : `Data intraday baru ${b.length} menit — butuh ≥ ${INTRADAY_WINDOW * 2} menit untuk membaca volume & struktur.`],
      entry: NA,
      stop: NA,
      target: NA,
      risk: NA,
      reason: 'Konfirmasi intraday tidak cukup → WAIT.',
      missing: ['Data intraday 1 menit'],
    };
  }

  const recent = b.slice(-INTRADAY_WINDOW);
  const prior = b.slice(-INTRADAY_WINDOW * 2, -INTRADAY_WINDOW);
  const earlier = b.slice(0, -INTRADAY_WINDOW);
  const avgVol = (xs: IntradayBar[]) => xs.reduce((s, x) => s + x.volume, 0) / xs.length;
  const recentVol = avgVol(recent);
  const sessionVol = avgVol(b);
  const volumeX = sessionVol > 0 ? recentVol / sessionVol : null;
  const volumeRising = volumeX != null && volumeX >= VOLUME_RISING_X;

  const maxP = (xs: IntradayBar[]) => Math.max(...xs.map((x) => x.price));
  const minP = (xs: IntradayBar[]) => Math.min(...xs.map((x) => x.price));
  const priorSessionHigh = maxP(earlier);
  const sessionLow = minP(b);
  const recentLow = minP(recent);
  const breakout = price > priorSessionHigh;
  const higherHigh = maxP(recent) > maxP(prior) && recentLow > minP(prior);
  const lowerLow = maxP(recent) < maxP(prior) && recentLow < minP(prior);

  // Selling pressure = volume on down-ticks outweighs volume on up-ticks in the recent window.
  let upVol = 0;
  let downVol = 0;
  for (let i = b.length - INTRADAY_WINDOW; i < b.length; i++) {
    const d = b[i].price - b[i - 1].price;
    if (d > 0) upVol += b[i].volume;
    else if (d < 0) downVol += b[i].volume;
  }
  const sellingPressure = downVol > upVol * 1.2 && (volumeRising || lowerLow);

  const aboveVwap = price > vwap * (1 + VWAP_BAND);
  const belowVwap = price < vwap * (1 - VWAP_BAND);
  const vwapDistPct = ((price - vwap) / vwap) * 100;

  const signals = [
    aboveVwap ? 'Harga di atas VWAP — pembeli menguasai sesi.' : belowVwap ? 'Harga di bawah VWAP — penjual menguasai sesi.' : 'Harga menempel VWAP — belum ada pihak dominan.',
    volumeRising ? `Volume ${INTRADAY_WINDOW} menit terakhir meningkat (${volumeX!.toFixed(2)}× rata-rata sesi).` : `Volume ${INTRADAY_WINDOW} menit terakhir tidak meningkat (${volumeX != null ? `${volumeX.toFixed(2)}×` : NA} rata-rata sesi).`,
    breakout ? `Breakout: harga menembus high sesi sebelumnya ${rp(priorSessionHigh)}.`
      : higherHigh ? 'Struktur Higher High / Higher Low terbentuk.'
        : lowerLow ? 'Struktur Lower High / Lower Low — tekanan turun.'
          : `Belum breakout — high sesi ${rp(priorSessionHigh)} belum ditembus.`,
  ];
  if (sellingPressure) signals.push('Volume turun (down-tick) lebih besar dari volume naik — tekanan jual meningkat.');

  const data: ModeDataPoint[] = [
    { label: 'Harga', value: rp(price) },
    { label: 'VWAP', value: `${rp(vwap)} (${pct(vwapDistPct, 2)})` },
    { label: 'Volume', value: volumeX != null ? `${volumeX.toFixed(2)}× rata-rata/menit sesi` : NA },
    { label: 'High / Low sesi', value: `${rp(Math.max(priorSessionHigh, maxP(recent)))} / ${rp(sessionLow)}` },
  ];
  const trend = aboveVwap ? 'Bullish intraday (di atas VWAP)' : belowVwap ? 'Bearish intraday (di bawah VWAP)' : 'Netral (di sekitar VWAP)';

  if (belowVwap && sellingPressure) {
    return {
      mode: 'INTRADAY', decision: 'SELL', trend, data, signals,
      entry: 'Tidak membuka posisi baru.',
      stop: `Batal jika harga kembali di atas VWAP ${rp(vwap)}.`,
      target: NA,
      risk: 'Tekanan jual aktif — posisi long intraday berisiko lanjut turun.',
      reason: 'Harga kembali < VWAP dan tekanan jual meningkat → SELL / keluar.',
      missing: [],
    };
  }

  if (aboveVwap && volumeRising && (breakout || higherHigh)) {
    const stop = roundToTick(Math.max(vwap, recentLow) * 0.997);
    const target = roundToTick(price + (price - stop) * INTRADAY_TARGET_R);
    return {
      mode: 'INTRADAY', decision: 'BUY', trend, data, signals,
      entry: `${rp(price)} atau pullback ke area VWAP ${rp(vwap)} – ${rp(price)}`,
      stop: `${rp(stop)} (di bawah VWAP / low ${INTRADAY_WINDOW} menit)`,
      target: `${rp(target)} (proyeksi ${INTRADAY_TARGET_R}R, bukan janji)`,
      risk: `${riskText(price, stop, target)} · data intraday tertunda, konfirmasi di chart.`,
      reason: 'Harga > VWAP + volume meningkat + breakout/Higher High → 3 konfirmasi terpenuhi.',
      missing: [],
    };
  }

  const pending = [
    !aboveVwap && 'harga > VWAP',
    !volumeRising && 'volume meningkat',
    !(breakout || higherHigh) && `breakout di atas ${rp(priorSessionHigh)} / Higher High`,
  ].filter(Boolean);
  return {
    mode: 'INTRADAY', decision: 'WAIT', trend, data, signals,
    entry: `Tunggu: ${pending.join(' + ')}.`,
    stop: `Invalidasi setup bila harga < VWAP ${rp(vwap)} dengan tekanan jual.`,
    target: NA,
    risk: 'Breakout belum terkonfirmasi — entry sekarang rawan false break.',
    reason: 'Breakout belum terkonfirmasi → WAIT.',
    missing: [],
  };
}

// ─── 📈 SWING ────────────────────────────────────────────────────────────────────

/** Price within this % above EMA20/support counts as a pullback entry, not a chase. */
const PULLBACK_MAX_PCT = 3;
/** Bars (before the last) used for the most recent Higher Low / swing low. */
const SWING_LOW_LOOKBACK = 10;

export interface SwingModeInput {
  bars: OHLCVBar[];
  price: number;
  ema20: number;
  ema50: number;
  relativeVolume: number;
  lastCandleColor: 'green' | 'red' | 'doji';
  /** Nearest first. */
  supports: number[];
  /** Nearest first. */
  resistances: number[];
}

export function buildSwingModeReview(input: SwingModeInput): ModeReview {
  const { bars, price, ema20, ema50, relativeVolume, lastCandleColor } = input;
  const support = input.supports.find((s) => valid(s) && s < price) ?? null;
  const resistance = input.resistances.find((r) => valid(r) && r > price) ?? null;
  const rvol = Number.isFinite(relativeVolume) && relativeVolume > 0 ? relativeVolume : null;
  const prevBars = bars.slice(-(SWING_LOW_LOOKBACK + 1), -1);
  const swingLow = prevBars.length >= 3 ? Math.min(...prevBars.map((x) => x.low)) : null;

  const missing = [
    !valid(ema20) && 'EMA20',
    !valid(ema50) && 'EMA50',
    rvol == null && 'Volume',
    support == null && 'Support',
    resistance == null && 'Resistance',
  ].filter((x): x is string => Boolean(x));

  const data: ModeDataPoint[] = [
    { label: 'Harga', value: rp(price) },
    { label: 'EMA20 / EMA50', value: `${rp(ema20)} / ${rp(ema50)}` },
    { label: 'Volume (RVOL)', value: rvol != null ? `${rvol.toFixed(2)}× MA20 · candle ${lastCandleColor === 'green' ? 'hijau' : lastCandleColor === 'red' ? 'merah' : 'doji'}` : NA },
    { label: 'Support / Resistance', value: `${rp(support)} / ${rp(resistance)}` },
    { label: 'Higher Low terakhir', value: rp(swingLow) },
  ];

  if (!valid(ema20) || !valid(ema50)) {
    return {
      mode: 'SWING', decision: 'WAIT', trend: NA, data,
      signals: ['EMA20/EMA50 tidak tersedia — trend swing tidak bisa dibaca.'],
      entry: NA, stop: NA, target: NA, risk: NA,
      reason: 'Data EMA tidak cukup → WAIT.',
      missing,
    };
  }

  const stacked = price > ema20 && ema20 > ema50;
  const bearStack = price < ema20 && ema20 < ema50;
  const pullbackRef = Math.max(ema20, support ?? 0);
  const pullbackPct = ((price - pullbackRef) / pullbackRef) * 100;
  const atPullback = pullbackPct >= 0 && pullbackPct <= PULLBACK_MAX_PCT;
  const volumeConfirms = rvol != null && rvol >= 1 && lastCandleColor === 'green';
  const higherLowBroken = swingLow != null && price < swingLow;
  const supportBroken = higherLowBroken || (price < ema50 && ema20 < ema50);

  const trend = stacked ? 'Uptrend (Harga > EMA20 > EMA50)'
    : bearStack ? 'Downtrend (Harga < EMA20 < EMA50)'
      : 'Belum jelas / sideways (EMA belum tersusun)';

  const signals = [
    stacked ? 'Susunan EMA bullish: harga > EMA20 > EMA50.' : bearStack ? 'Susunan EMA bearish: harga < EMA20 < EMA50.' : 'Susunan EMA campur — trend belum jelas.',
    atPullback ? `Harga dekat area pullback ${rp(pullbackRef)} (${pct(pullbackPct)}).`
      : pullbackPct > PULLBACK_MAX_PCT ? `Harga ${pct(pullbackPct)} di atas EMA20/support — bukan pullback, rawan kejar harga.`
        : 'Harga di bawah EMA20/support.',
    volumeConfirms ? `Volume mengonfirmasi (RVOL ${rvol!.toFixed(2)}× dengan candle hijau).` : `Volume belum mengonfirmasi${rvol != null ? ` (RVOL ${rvol.toFixed(2)}×)` : ''}.`,
  ];
  if (higherLowBroken) signals.push(`Higher Low ${rp(swingLow)} rusak — close di bawahnya.`);

  if (supportBroken) {
    return {
      mode: 'SWING', decision: 'SELL', trend, data, signals,
      entry: 'Tidak membuka posisi baru.',
      stop: higherLowBroken ? `Struktur rusak di bawah ${rp(swingLow)}.` : `Harga < EMA50 ${rp(ema50)} dengan EMA20 < EMA50.`,
      target: NA,
      risk: 'Support/Higher Low rusak — potensi lanjut turun ke support berikutnya.',
      reason: 'Support/Higher Low rusak → SELL / keluar.',
      missing,
    };
  }

  const stopBase = swingLow != null && swingLow < price ? Math.min(swingLow, ema20) : Math.min(ema50, support ?? ema50);
  const stop = roundToTick(stopBase * 0.99);

  if (stacked && atPullback && volumeConfirms) {
    return {
      mode: 'SWING', decision: 'BUY', trend, data, signals,
      entry: `${rp(pullbackRef)} – ${rp(price)} (area pullback EMA20/support)`,
      stop: `${rp(stop)} (close di bawah Higher Low/EMA20)`,
      target: resistance != null ? `${rp(resistance)} (resistance terdekat)` : NA,
      risk: riskText(price, stop, resistance),
      reason: 'Trend EMA bullish + pullback ke EMA20/support + volume konfirmasi → BUY.',
      missing,
    };
  }

  const pending = [
    !stacked && 'harga > EMA20 > EMA50',
    !atPullback && `pullback ke ${rp(pullbackRef)}`,
    !volumeConfirms && 'volume konfirmasi (RVOL ≥ 1× + candle hijau)',
  ].filter(Boolean);
  return {
    mode: 'SWING', decision: 'WAIT', trend, data, signals,
    entry: `Tunggu: ${pending.join(' + ')}.`,
    stop: `Invalidasi bila close < ${rp(stop)}.`,
    target: resistance != null ? `${rp(resistance)} (resistance terdekat)` : NA,
    risk: stacked ? 'Trend bagus tetapi entry belum di area pullback / volume belum konfirmasi.' : 'Trend belum jelas.',
    reason: stacked ? 'Konfirmasi swing belum lengkap → WAIT.' : 'Trend belum jelas → WAIT.',
    missing,
  };
}

// ─── 🏦 INVESTING ────────────────────────────────────────────────────────────────

const ROE_GOOD = 15;
const ROE_BROKEN = 5;
const GROWTH_GOOD = 10;
const GROWTH_BROKEN = -20;
/** DER in % (100 = 1×). */
const DER_OK = 100;
const DER_BROKEN = 200;
const PER_FAIR_MAX = 15;

export interface InvestingModeInput {
  price: number;
  per: number;
  pbv: number;
  /** % */
  roe: number;
  /** % YoY, null = unavailable. */
  earningsGrowth: number | null;
  revenueGrowth: number | null;
  /** % (100 = 1×), null = unavailable (often banks). */
  debtToEquity: number | null;
  netMargin: number | null;
  /** Not in the current data feed — pass null until a source exists. */
  operatingCashFlow: number | null;
  isFinancial: boolean;
  fairValue: number | null;
  accumulationLow: number | null;
  accumulationHigh: number | null;
}

export function buildInvestingModeReview(i: InvestingModeInput): ModeReview {
  const roe = Number.isFinite(i.roe) && i.roe !== 0 ? i.roe : null;
  const per = Number.isFinite(i.per) && i.per !== 0 ? i.per : null;
  const pbv = Number.isFinite(i.pbv) && i.pbv > 0 ? i.pbv : null;
  const eg = i.earningsGrowth;
  const der = i.debtToEquity;
  const upsidePct = valid(i.fairValue) ? ((i.fairValue - i.price) / i.price) * 100 : null;

  const missing = [
    eg == null && 'Pertumbuhan laba',
    roe == null && 'ROE',
    der == null && !i.isFinancial && 'Debt (DER)',
    i.operatingCashFlow == null && 'Cash Flow',
    per == null && 'PER',
    pbv == null && 'PBV',
  ].filter((x): x is string => Boolean(x));

  const data: ModeDataPoint[] = [
    { label: 'Pertumbuhan Laba (YoY)', value: pct(eg) + (i.revenueGrowth != null ? ` · Pendapatan ${pct(i.revenueGrowth)}` : '') },
    { label: 'ROE', value: roe != null ? `${roe.toFixed(1)}%` : NA },
    { label: 'Debt (DER)', value: der != null ? `${(der / 100).toFixed(2)}×` : i.isFinancial ? `${NA} (sektor keuangan)` : NA },
    { label: 'Cash Flow', value: i.operatingCashFlow != null ? rp(i.operatingCashFlow) : NA },
    { label: 'PER / PBV', value: `${per != null ? `${per.toFixed(1)}×` : NA} / ${pbv != null ? `${pbv.toFixed(2)}×` : NA}` },
    { label: 'Nilai Wajar', value: valid(i.fairValue) ? `${rp(i.fairValue)} (${pct(upsidePct, 0)} dari harga)` : NA },
  ];

  const growthGood = eg != null && eg >= GROWTH_GOOD;
  const roeGood = roe != null && roe >= ROE_GOOD;
  const debtOk = der != null ? der <= DER_OK : i.isFinancial;
  const marginOk = i.netMargin == null || i.netMargin > 0;
  const healthy = roeGood && debtOk && marginOk;
  const valuationFair = upsidePct != null ? upsidePct >= 0 : per != null && per > 0 && per <= PER_FAIR_MAX;

  const broken = [
    eg != null && eg <= GROWTH_BROKEN && `laba turun ${pct(eg)} YoY`,
    roe != null && roe < ROE_BROKEN && `ROE hanya ${roe.toFixed(1)}%`,
    per != null && per < 0 && 'emiten merugi (PER negatif)',
    der != null && !i.isFinancial && der > DER_BROKEN && `DER ${(der / 100).toFixed(2)}× terlalu tinggi`,
  ].filter((x): x is string => Boolean(x));

  const signals = [
    eg == null ? 'Pertumbuhan laba N/A.' : growthGood ? 'Laba bertumbuh baik.' : eg >= 0 ? 'Laba bertumbuh tipis.' : 'Laba menurun.',
    roe == null ? 'ROE N/A.' : roeGood ? 'ROE tinggi — modal dipakai efisien.' : 'ROE di bawah 15%.',
    der == null ? (i.isFinancial ? 'DER tidak relevan untuk bank/keuangan.' : 'Debt N/A.') : debtOk ? 'Utang terkendali (DER ≤ 1×).' : 'Utang tinggi (DER > 1×).',
    'Cash flow N/A — belum ada di sumber data, cek laporan arus kas manual.',
    upsidePct != null
      ? (valuationFair ? `Harga di bawah nilai wajar (${pct(upsidePct, 0)}).` : `Harga di atas nilai wajar (${pct(upsidePct, 0)}) — valuasi mahal.`)
      : per != null && per > 0 ? (valuationFair ? `PER ${per.toFixed(1)}× masih wajar (≤ ${PER_FAIR_MAX}×).` : `PER ${per.toFixed(1)}× mahal (> ${PER_FAIR_MAX}×).`) : 'Valuasi N/A.',
  ];

  const trend = broken.length > 0 ? 'Fundamental melemah'
    : healthy && growthGood ? 'Fundamental sehat & bertumbuh'
      : healthy ? 'Fundamental sehat, pertumbuhan terbatas'
        : 'Fundamental campuran';
  const accZone = valid(i.accumulationLow) && valid(i.accumulationHigh) ? `${rp(i.accumulationLow)} – ${rp(i.accumulationHigh)}` : null;
  const invalidation = `Thesis batal bila laba turun > ${Math.abs(GROWTH_BROKEN)}% YoY, ROE < ${ROE_BROKEN}%, atau DER > ${DER_BROKEN / 100}×.`;
  const target = valid(i.fairValue) && i.fairValue > i.price ? `${rp(i.fairValue)} (nilai wajar, jangka menengah–panjang)` : NA;

  if (broken.length > 0) {
    return {
      mode: 'INVESTING', decision: 'SELL', trend, data, signals: [...signals, `Thesis rusak: ${broken.join(', ')}.`],
      entry: 'Tidak menambah posisi.',
      stop: invalidation,
      target: NA,
      risk: 'Thesis fundamental rusak — risiko value trap.',
      reason: `Thesis fundamental rusak (${broken.join(', ')}) → SELL.`,
      missing,
    };
  }

  if (healthy && growthGood && valuationFair) {
    return {
      mode: 'INVESTING', decision: 'BUY', trend, data, signals,
      entry: accZone ? `Akumulasi bertahap di ${accZone}` : `Akumulasi bertahap ≤ ${rp(i.fairValue ?? i.price)}`,
      stop: invalidation,
      target,
      risk: `Cash flow belum terverifikasi dari data${missing.length ? ` · data N/A: ${missing.join(', ')}` : ''}.`,
      reason: 'Fundamental sehat + laba bertumbuh + valuasi masuk akal → BUY (akumulasi).',
      missing,
    };
  }

  const why = healthy && growthGood ? 'Fundamental baik tetapi valuasi mahal'
    : missing.length >= 3 ? 'Data fundamental tidak cukup'
      : 'Fundamental belum memenuhi semua syarat';
  return {
    mode: 'INVESTING', decision: 'WAIT', trend, data, signals,
    entry: accZone ? `Tunggu harga masuk area akumulasi ${accZone}` : 'Tunggu konfirmasi fundamental / valuasi lebih murah.',
    stop: invalidation,
    target,
    risk: healthy && growthGood ? 'Membeli di valuasi premium mengurangi margin of safety.' : `Syarat belum lengkap${missing.length ? ` · data N/A: ${missing.join(', ')}` : ''}.`,
    reason: `${why} → WAIT.`,
    missing,
  };
}

// ─── Share text ──────────────────────────────────────────────────────────────────

export function formatTradingModesReview(ticker: string, reviews: ModeReview[]): string {
  const blocks = reviews.map((r) => [
    `📊 ${ticker} — ${TRADING_MODE_LABEL[r.mode]}`,
    '',
    `Market/Trend: ${r.trend}`,
    `Indikator (DATA): ${r.data.map((d) => `${d.label} ${d.value}`).join(' · ')}`,
    `Sinyal (INTERPRETASI): ${r.signals.join(' ')}`,
    `Entry: ${r.entry}`,
    `Stop/Invalidation: ${r.stop}`,
    `Target: ${r.target}`,
    `Risk: ${r.risk}`,
    `Keputusan: ${MODE_DECISION_LABEL[r.decision]} — ${r.reason}`,
  ].join('\n'));
  return [
    ...blocks,
    '⚠️ Edukasi, bukan ajakan jual/beli. Target adalah proyeksi, bukan janji profit.',
  ].join('\n\n');
}
