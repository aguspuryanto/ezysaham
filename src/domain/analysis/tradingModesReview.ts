/**
 * tradingModesReview.ts
 *
 * 3 SISTEM TRADING for EquityResearchReportCardv6 / TradingModesReport — three separate reads that are
 * never merged into one signal:
 *
 *   ⚡ INTRADAY   timing hari ini — VWAP + RVOL + High/Low sesi + breakout + HH/LL (1-minute bars)
 *   📈 SWING      setup beberapa hari/minggu — EMA20/50/200 + RSI/MACD + RVOL + S/R + breakout/pullback + HH/HL
 *   🏦 INVESTING  kualitas bisnis + valuasi — growth + ROE + debt + PER/PBV + cash flow + fair value gap
 *
 * Decisions are BUY / WAIT / WATCHLIST / NO TRADE — never SELL, since we don't know whether the user
 * holds a position.
 *   BUY        setup + confirmation + Risk Gate (target from resistance/fair value, R/R, risk %, not extended)
 *   WAIT       setup not confirmed yet / data not enough
 *   WATCHLIST  good business, but valuation expensive or technical bearish
 *   NO TRADE   no edge (bearish structure, broken thesis, weak fundamentals)
 *
 * Rules: missing data → "N/A" (never invented), DATA (`data`, or the left side of "→") is kept apart from
 * INTERPRETATION, targets come only from available resistance / fair value, and are never promised profit.
 */

import { formatRupiah } from '@/lib/format';
import type { IntradayBar } from '@/domain/models/Intraday';
import type { OHLCVBar } from '@/domain/models/History';
import { vwap as sessionVwap } from '@/domain/indicators/vwap';
import { roundToTick } from '@/domain/analysis/idxTick';

export type TradingMode = 'INTRADAY' | 'SWING' | 'INVESTING';
export type ModeDecision = 'BUY' | 'WAIT' | 'WATCHLIST' | 'NO_TRADE';

export const TRADING_MODE_LABEL: Record<TradingMode, string> = { INTRADAY: '⚡ INTRADAY', SWING: '📈 SWING', INVESTING: '🏦 INVESTING' };
export const MODE_DECISION_LABEL: Record<ModeDecision, string> = { BUY: 'BUY', WAIT: 'WAIT', WATCHLIST: 'WATCHLIST', NO_TRADE: 'NO TRADE' };

export const NA = 'N/A';

export interface ModeDataPoint {
  label: string;
  value: string;
}

/** One line of the per-mode report format, in display order. An array renders as a bullet list. */
export interface ModeField {
  label: string;
  value: string | string[];
  tone?: 'positive' | 'negative';
}

export interface ModeReview {
  mode: TradingMode;
  decision: ModeDecision;
  /** First line of the format — "Trend" (INTRADAY/SWING) or "Fundamental" (INVESTING). */
  headline: ModeField;
  /** Raw indicator values — DATA only, "N/A" when unavailable. Empty when the format has no Data line. */
  data: ModeDataPoint[];
  /** Remaining format lines (Signal/Setup, Entry, Confirmation, …, Risk), in order. */
  fields: ModeField[];
  /** One-line reason for the decision. */
  reason: string;
  /** Inputs this mode needed but did not get. */
  missing: string[];
  /** Numeric levels behind Entry/TP/SL text — fed to validatePlanLevels(). Absent when there is no plan (NO TRADE / no data). */
  levels?: PlanLevels;
}

/** Numeric plan levels. `entry` is the trigger/entry reference (for WAIT: the level that must be reclaimed first). */
export interface PlanLevels {
  side: 'LONG' | 'SHORT';
  entry: number | null;
  tp1: number | null;
  tp2: number | null;
  sl: number | null;
}

/**
 * Hard validation — a plan whose targets/stop sit on the wrong side of entry is INVALID, never shown as a trade.
 *   LONG:  TP1 > ENTRY, TP2 > TP1, SL < ENTRY
 *   SHORT: TP1 < ENTRY, TP2 < TP1, SL > ENTRY
 * Missing levels are not violations (they render "N/A"). Returns the violated rules; empty = valid.
 */
export function validatePlanLevels(l: PlanLevels | undefined): string[] {
  if (!l || !valid(l.entry)) return [];
  const { entry, tp1, tp2, sl } = l;
  const long = l.side === 'LONG';
  const errors: string[] = [];
  if (valid(tp1) && (long ? tp1 <= entry : tp1 >= entry)) errors.push(`TP1 ${rp(tp1)} ${long ? '≤' : '≥'} Entry ${rp(entry)}`);
  if (valid(tp1) && valid(tp2) && (long ? tp2 <= tp1 : tp2 >= tp1)) errors.push(`TP2 ${rp(tp2)} ${long ? '≤' : '≥'} TP1 ${rp(tp1)}`);
  if (valid(sl) && (long ? sl >= entry : sl <= entry)) errors.push(`SL ${rp(sl)} ${long ? '≥' : '≤'} Entry ${rp(entry)}`);
  return errors;
}

const rp = (n: number | null | undefined) => (n != null && Number.isFinite(n) && n > 0 ? formatRupiah(Math.round(n)) : NA);
const pct = (n: number | null | undefined, dec = 1) =>
  (n == null || !Number.isFinite(n) ? NA : `${n >= 0 ? '+' : ''}${n.toFixed(dec)}%`);
const valid = (n: number | null | undefined): n is number => n != null && Number.isFinite(n) && n > 0;
const check = (ok: boolean) => (ok ? '✓' : '✗');

/** Risk Gate math for a long setup: % risked to stop and R/R to the target (null when no target). */
function riskReward(entry: number, stop: number, target: number | null) {
  const riskPct = ((entry - stop) / entry) * 100;
  const rr = target != null && entry > stop ? (target - entry) / (entry - stop) : null;
  return { riskPct, rr };
}

// ─── ⚡ INTRADAY ─────────────────────────────────────────────────────────────────

/** Minutes compared for "recent" vs "earlier" volume and structure. */
const INTRADAY_WINDOW = 15;
const VWAP_BAND = 0.001;
const RVOL_RISING_X = 1.2;
/** Price more than this % above VWAP is extended — wait for a pullback instead of chasing. */
const INTRADAY_EXTENDED_PCT = 2;
const INTRADAY_MIN_RR = 1.5;
const INTRADAY_MAX_RISK_PCT = 2.5;

export interface IntradayModeInput {
  /** null = still loading or fetch failed. */
  bars: IntradayBar[] | null;
  /** Fallback price when there are no intraday bars (last daily close). */
  lastClose: number;
  /** Live quote (Yahoo meta.regularMarketPrice) — preferred over the last 1m bar so this matches the hero price. */
  lastPrice?: number | null;
  /** Daily resistance levels, nearest first — the only source for the target besides the session high. */
  resistances: number[];
}

export function buildIntradayModeReview({ bars, lastClose, lastPrice, resistances }: IntradayModeInput): ModeReview {
  const b = bars ?? [];
  const vwap = b.length > 0 ? sessionVwap(b) : null;
  const price = lastPrice != null && lastPrice > 0 ? lastPrice : b.length > 0 ? b[b.length - 1].price : lastClose;

  if (vwap == null || b.length < INTRADAY_WINDOW * 2) {
    return {
      mode: 'INTRADAY',
      decision: 'WAIT',
      headline: { label: 'Trend', value: NA },
      data: [
        { label: 'Harga', value: rp(price) },
        { label: 'VWAP', value: vwap != null ? rp(vwap) : NA },
        { label: 'RVOL (15m vs sesi)', value: NA },
        { label: 'High / Low sesi', value: NA },
        { label: 'Struktur', value: NA },
      ],
      fields: [
        {
          label: 'Signal',
          value: [b.length === 0
            ? 'Data intraday tidak tersedia (sesi tertutup / belum ada data).'
            : `Data intraday baru ${b.length} menit — butuh ≥ ${INTRADAY_WINDOW * 2} menit untuk membaca volume & struktur.`],
        },
        { label: 'Entry', value: NA },
        { label: 'Confirmation', value: NA },
        { label: 'Invalidation', value: NA },
        { label: 'Target', value: NA },
        { label: 'Risk', value: NA },
      ],
      reason: 'Data intraday belum cukup untuk konfirmasi → WAIT.',
      missing: ['Data intraday 1 menit'],
    };
  }

  const recent = b.slice(-INTRADAY_WINDOW);
  const prior = b.slice(-INTRADAY_WINDOW * 2, -INTRADAY_WINDOW);
  const earlier = b.slice(0, -INTRADAY_WINDOW);
  const avgVol = (xs: IntradayBar[]) => xs.reduce((s, x) => s + x.volume, 0) / xs.length;
  const sessionVol = avgVol(b);
  const rvol = sessionVol > 0 ? avgVol(recent) / sessionVol : null;
  const volumeRising = rvol != null && rvol >= RVOL_RISING_X;

  const maxP = (xs: IntradayBar[]) => Math.max(...xs.map((x) => x.price));
  const minP = (xs: IntradayBar[]) => Math.min(...xs.map((x) => x.price));
  const priorSessionHigh = maxP(earlier);
  const sessionHigh = Math.max(priorSessionHigh, maxP(recent));
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
  const extended = vwapDistPct > INTRADAY_EXTENDED_PCT;

  // Entry reference = the highest level still to be reclaimed (VWAP, then the session-high breakout) — never below price.
  // Target = nearest resistance ABOVE that entry, so a "breakout > X" plan never targets a level below X.
  const breakoutPending = !(breakout || higherHigh);
  const entryRef = Math.max(price, !aboveVwap ? vwap : 0, breakoutPending ? priorSessionHigh : 0);
  const targetCandidates = [...new Set([priorSessionHigh, ...resistances].filter((r) => valid(r) && r > entryRef * (1 + VWAP_BAND)))].sort((x, y) => x - y);
  const target = targetCandidates.length > 0 ? roundToTick(targetCandidates[0]) : null;
  const target2 = targetCandidates.length > 1 ? roundToTick(targetCandidates[1]) : null;
  const stop = roundToTick(Math.max(vwap, recentLow) * 0.997);
  const { riskPct, rr } = riskReward(entryRef, stop, target);
  const levels: PlanLevels = { side: 'LONG', entry: roundToTick(entryRef), tp1: target, tp2: target2, sl: stop };
  const gateOk = !extended && target != null && rr != null && rr >= INTRADAY_MIN_RR && riskPct > 0 && riskPct <= INTRADAY_MAX_RISK_PCT;

  const structure = higherHigh ? 'Higher High / Higher Low' : lowerLow ? 'Lower High / Lower Low' : 'Sideways';
  const data: ModeDataPoint[] = [
    { label: 'Harga', value: rp(price) },
    { label: 'VWAP', value: `${rp(vwap)} (${pct(vwapDistPct, 2)})` },
    { label: 'RVOL (15m vs sesi)', value: rvol != null ? `${rvol.toFixed(2)}×` : NA },
    { label: 'High / Low sesi', value: `${rp(sessionHigh)} / ${rp(sessionLow)}` },
    { label: 'Struktur', value: structure },
  ];

  const signals = [
    aboveVwap ? 'Harga di atas VWAP — pembeli menguasai sesi.' : belowVwap ? 'Harga di bawah VWAP — penjual menguasai sesi.' : 'Harga menempel VWAP — belum ada pihak dominan.',
    volumeRising ? `Volume ${INTRADAY_WINDOW} menit terakhir meningkat (RVOL ${rvol!.toFixed(2)}×).` : `Volume ${INTRADAY_WINDOW} menit terakhir belum meningkat (RVOL ${rvol != null ? `${rvol.toFixed(2)}×` : NA}).`,
    breakout ? `Breakout: harga menembus high sesi sebelumnya ${rp(priorSessionHigh)}.`
      : higherHigh ? 'Momentum naik: Higher High / Higher Low terbentuk.'
        : lowerLow ? 'Momentum turun: Lower High / Lower Low.'
          : `Belum breakout — high sesi ${rp(priorSessionHigh)} belum ditembus.`,
  ];
  if (extended) signals.push(`Harga sudah ${pct(vwapDistPct, 2)} di atas VWAP — extended, jangan dikejar.`);
  if (sellingPressure) signals.push('Volume down-tick lebih besar dari up-tick — tekanan jual meningkat.');

  const trend = aboveVwap ? 'Bullish intraday (di atas VWAP)' : belowVwap ? 'Bearish intraday (di bawah VWAP)' : 'Netral (di sekitar VWAP)';
  const setupOk = aboveVwap && (breakout || higherHigh);
  const confirmation = `${check(volumeRising)} RVOL ≥ ${RVOL_RISING_X}× · ${check(aboveVwap)} bertahan > VWAP · ${check(breakout || higherHigh)} breakout/Higher High`;
  const targetText = target != null
    ? `${rp(target)} (resistance terdekat di atas entry ${rp(entryRef)}${target === roundToTick(priorSessionHigh) ? ' — high sesi' : ''})${target2 != null ? ` · berikutnya ${rp(target2)}` : ''}`
    : `${NA} — tidak ada resistance di atas level entry ${rp(entryRef)}`;
  const gateText = `Risk Gate: risiko ${riskPct > 0 ? `${riskPct.toFixed(1)}%` : NA} (maks ${INTRADAY_MAX_RISK_PCT}%) · R/R ${rr != null ? `1:${rr.toFixed(1)}` : NA} (min 1:${INTRADAY_MIN_RR})${extended ? ' · extended' : ''}`;
  const fields = (entry: string, invalidation: string, risk: string): ModeField[] => [
    { label: 'Signal', value: signals },
    { label: 'Entry', value: entry, tone: 'positive' },
    { label: 'Confirmation', value: confirmation },
    { label: 'Invalidation', value: invalidation, tone: 'negative' },
    { label: 'Target', value: targetText },
    { label: 'Risk', value: risk },
  ];

  if (belowVwap && (sellingPressure || lowerLow)) {
    return {
      mode: 'INTRADAY', decision: 'NO_TRADE', headline: { label: 'Trend', value: trend }, data,
      fields: fields(
        'Tidak ada entry — tidak ada edge long hari ini.',
        `Setup baru valid bila harga kembali > VWAP ${rp(vwap)} dengan volume.`,
        'Penjual menguasai sesi — entry long melawan arus.',
      ),
      reason: 'Harga < VWAP dengan tekanan jual / Lower Low → tidak ada edge → NO TRADE.',
      missing: [],
    };
  }

  if (setupOk && volumeRising && gateOk) {
    return {
      mode: 'INTRADAY', decision: 'BUY', headline: { label: 'Trend', value: trend }, data,
      fields: fields(
        `${rp(price)} atau pullback ke area VWAP ${rp(vwap)} – ${rp(price)}`,
        `${rp(stop)} (di bawah VWAP / low ${INTRADAY_WINDOW} menit)`,
        `${gateText} · data intraday tertunda, konfirmasi di chart.`,
      ),
      reason: 'Harga > VWAP + breakout/Higher High + volume meningkat + Risk Gate valid → BUY.',
      missing: [],
      levels,
    };
  }

  const pending = [
    !aboveVwap && 'harga > VWAP',
    !(breakout || higherHigh) && `breakout di atas ${rp(priorSessionHigh)} / Higher High`,
    !volumeRising && `RVOL ≥ ${RVOL_RISING_X}×`,
    extended && `pullback ke area VWAP ${rp(vwap)}`,
    !extended && setupOk && volumeRising && !gateOk && 'Risk Gate (target/R/R/risiko) valid',
  ].filter(Boolean);
  return {
    mode: 'INTRADAY', decision: 'WAIT', headline: { label: 'Trend', value: trend }, data,
    fields: fields(
      `Tunggu: ${pending.join(' + ')}.`,
      `${rp(stop)} — setup batal bila harga < VWAP ${rp(vwap)} dengan tekanan jual.`,
      extended ? `Harga extended di atas VWAP — rawan pullback. ${gateText}` : `Belum terkonfirmasi — entry sekarang rawan false break. ${gateText}`,
    ),
    reason: extended ? 'Harga extended — jangan kejar → WAIT.' : 'Setup intraday belum terkonfirmasi → WAIT.',
    missing: [],
    levels,
  };
}

// ─── 📈 SWING ────────────────────────────────────────────────────────────────────

/** Price within this % above EMA20/support counts as a pullback entry, not a chase. */
const PULLBACK_MAX_PCT = 3;
/** Breakout above the prior high is only an entry while price is within this % of the broken level. */
const BREAKOUT_MAX_PCT = 3;
/** Bars compared for Higher High / Higher Low and the recent swing low. */
const SWING_LOOKBACK = 10;
/** Bars (before the last) whose high defines the breakout level. */
const BREAKOUT_LOOKBACK = 20;
const RSI_OVERBOUGHT = 70;
const SWING_MIN_RR = 1.5;
const SWING_MAX_RISK_PCT = 8;

export interface SwingModeInput {
  bars: OHLCVBar[];
  price: number;
  ema20: number;
  ema50: number;
  ema200: number;
  /** null = unavailable. */
  rsi14: number | null;
  /** MACD histogram, null = unavailable. */
  macdHistogram: number | null;
  relativeVolume: number;
  lastCandleColor: 'green' | 'red' | 'doji';
  /** Nearest first. */
  supports: number[];
  /** Nearest first. */
  resistances: number[];
}

/** Technical bearish read used by INVESTING's "fundamental bagus tetapi teknikal bearish → WATCHLIST" rule. */
export function isTechnicalBearish({ price, ema20, ema50, ema200 }: { price: number; ema20: number; ema50: number; ema200: number }): boolean | null {
  if (!valid(price) || !valid(ema20) || !valid(ema50)) return null;
  return (price < ema20 && ema20 < ema50) || (valid(ema200) && price < ema200 && ema50 < ema200);
}

export function buildSwingModeReview(input: SwingModeInput): ModeReview {
  const { bars, price, ema20, ema50, ema200, lastCandleColor } = input;
  const support = input.supports.find((s) => valid(s) && s < price) ?? null;
  const levelsAbove = input.resistances.filter((r) => valid(r) && r > price);
  const nearestResistance = levelsAbove[0] ?? null;
  const rvol = Number.isFinite(input.relativeVolume) && input.relativeVolume > 0 ? input.relativeVolume : null;
  const rsi = input.rsi14 != null && Number.isFinite(input.rsi14) ? input.rsi14 : null;
  const macd = input.macdHistogram != null && Number.isFinite(input.macdHistogram) ? input.macdHistogram : null;

  const prev = bars.slice(0, -1);
  const lastN = prev.slice(-SWING_LOOKBACK);
  const priorN = prev.slice(-SWING_LOOKBACK * 2, -SWING_LOOKBACK);
  const swingLow = lastN.length >= 3 ? Math.min(...lastN.map((x) => x.low)) : null;
  const hasStructure = lastN.length >= 3 && priorN.length >= 3;
  const higherHigh = hasStructure && Math.max(...lastN.map((x) => x.high)) > Math.max(...priorN.map((x) => x.high));
  const higherLow = hasStructure && swingLow! > Math.min(...priorN.map((x) => x.low));
  const breakoutBars = prev.slice(-BREAKOUT_LOOKBACK);
  const breakoutLevel = breakoutBars.length >= 5 ? Math.max(...breakoutBars.map((x) => x.high)) : null;

  const missing = [
    !valid(ema20) && 'EMA20',
    !valid(ema50) && 'EMA50',
    !valid(ema200) && 'EMA200',
    rsi == null && 'RSI',
    macd == null && 'MACD',
    rvol == null && 'RVOL',
    support == null && 'Support',
    nearestResistance == null && 'Resistance',
  ].filter((x): x is string => Boolean(x));

  const data: ModeDataPoint[] = [
    { label: 'Harga', value: rp(price) },
    { label: 'EMA20 / 50 / 200', value: `${rp(ema20)} / ${rp(ema50)} / ${rp(ema200)}` },
    { label: 'RSI14 / MACD hist', value: `${rsi != null ? rsi.toFixed(1) : NA} / ${macd != null ? macd.toFixed(2) : NA}` },
    { label: 'RVOL', value: rvol != null ? `${rvol.toFixed(2)}× MA20 · candle ${lastCandleColor === 'green' ? 'hijau' : lastCandleColor === 'red' ? 'merah' : 'doji'}` : NA },
    { label: 'Support / Resistance', value: `${rp(support)} / ${rp(nearestResistance)}` },
    { label: 'Struktur', value: hasStructure ? `${higherHigh ? 'Higher High' : 'Lower High'} · ${higherLow ? 'Higher Low' : 'Lower Low'}` : NA },
  ];

  if (!valid(ema20) || !valid(ema50)) {
    return {
      mode: 'SWING', decision: 'WAIT', headline: { label: 'Trend', value: NA }, data,
      fields: [
        { label: 'Setup', value: ['EMA20/EMA50 tidak tersedia — trend swing tidak bisa dibaca.'] },
        ...['Entry', 'Confirmation', 'SL/Invalidation', 'TP1', 'TP2', 'Risk/Reward', 'Risk'].map((label) => ({ label, value: NA })),
      ],
      reason: 'Data EMA tidak cukup → WAIT.',
      missing,
    };
  }

  const stacked = price > ema20 && ema20 > ema50;
  const bearStack = price < ema20 && ema20 < ema50;
  const aboveEma200 = valid(ema200) ? price > ema200 : null;
  const pullbackRef = Math.max(ema20, support ?? 0);
  const pullbackPct = ((price - pullbackRef) / pullbackRef) * 100;
  const atPullback = pullbackPct >= 0 && pullbackPct <= PULLBACK_MAX_PCT;
  const breakoutPct = breakoutLevel != null ? ((price - breakoutLevel) / breakoutLevel) * 100 : null;
  const atBreakout = breakoutPct != null && breakoutPct > 0 && breakoutPct <= BREAKOUT_MAX_PCT;
  const setup: 'pullback' | 'breakout' | null = !stacked ? null : atBreakout ? 'breakout' : atPullback ? 'pullback' : null;
  const higherLowBroken = swingLow != null && price < swingLow;
  const rsiOverbought = rsi != null && rsi >= RSI_OVERBOUGHT;
  const extended = rsiOverbought || (stacked && !atPullback && !atBreakout && pullbackPct > PULLBACK_MAX_PCT);

  const minRvol = setup === 'breakout' ? 1.5 : 1;
  const volumeOk = rvol != null && rvol >= minRvol && lastCandleColor === 'green';
  const macdOk = macd == null || macd > 0;
  const confirmed = volumeOk && macdOk;

  const trend = stacked
    ? (aboveEma200 === false ? 'Rebound di bawah EMA200 (Harga > EMA20 > EMA50, < EMA200)' : `Uptrend (Harga > EMA20 > EMA50${aboveEma200 ? ' > EMA200' : ''})`)
    : bearStack ? `Downtrend (Harga < EMA20 < EMA50${aboveEma200 === false ? ', < EMA200' : ''})`
      : 'Belum jelas / sideways (EMA belum tersusun)';

  const setupLines = [
    stacked ? 'Susunan EMA bullish: harga > EMA20 > EMA50.' : bearStack ? 'Susunan EMA bearish: harga < EMA20 < EMA50.' : 'Susunan EMA campur — trend belum jelas.',
    aboveEma200 == null ? 'EMA200 N/A — trend jangka panjang tidak bisa dibaca.' : aboveEma200 ? 'Harga di atas EMA200 — trend jangka panjang mendukung.' : 'Harga di bawah EMA200 — trend jangka panjang belum mendukung.',
    setup === 'breakout' ? `Breakout di atas high ${BREAKOUT_LOOKBACK} hari ${rp(breakoutLevel)} (${pct(breakoutPct)}).`
      : setup === 'pullback' ? `Pullback ke area EMA20/support ${rp(pullbackRef)} (${pct(pullbackPct)}).`
        : pullbackPct > PULLBACK_MAX_PCT ? `Harga ${pct(pullbackPct)} di atas EMA20/support — bukan pullback, rawan kejar harga.`
          : 'Belum ada setup pullback/breakout.',
    hasStructure ? `Struktur: ${higherHigh ? 'Higher High' : 'Lower High'} · ${higherLow ? 'Higher Low' : 'Lower Low'}.` : 'Struktur HH/HL N/A.',
  ];
  if (rsiOverbought) setupLines.push(`RSI ${rsi!.toFixed(1)} overbought — extended.`);
  if (higherLowBroken) setupLines.push(`Higher Low ${rp(swingLow)} rusak — close di bawahnya.`);

  const entryRef = setup === 'breakout' ? breakoutLevel! : pullbackRef;
  const stopBase = setup === 'breakout' ? breakoutLevel! * 0.98
    : swingLow != null && swingLow < price ? Math.min(swingLow, ema20) : Math.min(ema50, support ?? ema50);
  const sl = roundToTick(stopBase * (setup === 'breakout' ? 1 : 0.99));
  // Below EMA20 the plan only starts once EMA20 is reclaimed — so EMA20 is the entry trigger and TP1/TP2 must sit above it
  // (a resistance between price and EMA20 is a first hurdle, not a target).
  const trigger = price < ema20 ? ema20 : price;
  const targets = levelsAbove.filter((r) => r > trigger);
  const tp1 = targets[0] ?? null;
  const tp2 = targets[1] ?? null;
  const { riskPct, rr } = riskReward(trigger, sl, tp1);
  const levels: PlanLevels = { side: 'LONG', entry: roundToTick(trigger), tp1, tp2, sl };
  const gateOk = !extended && tp1 != null && rr != null && rr >= SWING_MIN_RR && riskPct > 0 && riskPct <= SWING_MAX_RISK_PCT && aboveEma200 !== false;

  const confirmation = `${check(volumeOk)} RVOL ≥ ${minRvol}× + candle hijau · ${macd == null ? `MACD ${NA}` : `${check(macd > 0)} MACD hist > 0`} · ${rsi == null ? `RSI ${NA}` : `${check(!rsiOverbought)} RSI < ${RSI_OVERBOUGHT}`}`;
  const rrText = rr != null ? `1:${rr.toFixed(1)} (risiko ${riskPct.toFixed(1)}%, min R/R 1:${SWING_MIN_RR}, maks risiko ${SWING_MAX_RISK_PCT}%)` : `${NA} — tidak ada resistance di atas level entry ${rp(trigger)}`;
  const fields = (entry: string, slText: string, risk: string): ModeField[] => [
    { label: 'Setup', value: setupLines },
    { label: 'Entry', value: entry, tone: 'positive' },
    { label: 'Confirmation', value: confirmation },
    { label: 'SL/Invalidation', value: slText, tone: 'negative' },
    { label: 'TP1', value: tp1 != null ? `${rp(tp1)} (resistance terdekat di atas entry ${rp(trigger)})` : `${NA} — tidak ada resistance di atas entry ${rp(trigger)}` },
    { label: 'TP2', value: tp2 != null ? `${rp(tp2)} (resistance berikutnya)` : NA },
    { label: 'Risk/Reward', value: rrText },
    { label: 'Risk', value: risk },
  ];
  const headline: ModeField = { label: 'Trend', value: trend };

  if (bearStack || higherLowBroken || (price < ema50 && ema20 < ema50)) {
    return {
      mode: 'SWING', decision: 'NO_TRADE', headline, data,
      fields: fields(
        'Tidak ada entry — struktur swing bearish.',
        higherLowBroken ? `Struktur rusak di bawah Higher Low ${rp(swingLow)}.` : `Harga < EMA50 ${rp(ema50)} dengan EMA20 < EMA50.`,
        'Support/Higher Low rusak — potensi lanjut turun ke support berikutnya.',
      ),
      reason: 'Struktur bearish / Higher Low rusak → tidak ada edge → NO TRADE.',
      missing,
    };
  }

  if (setup != null && confirmed && gateOk) {
    return {
      mode: 'SWING', decision: 'BUY', headline, data,
      fields: fields(
        setup === 'breakout' ? `${rp(entryRef)} – ${rp(price)} (retest area breakout)` : `${rp(entryRef)} – ${rp(price)} (area pullback EMA20/support)`,
        setup === 'breakout' ? `${rp(sl)} (close kembali di bawah level breakout)` : `${rp(sl)} (close di bawah Higher Low/EMA20)`,
        'Risk Gate valid · gunakan position sizing sesuai risiko.',
      ),
      reason: `Uptrend + ${setup === 'breakout' ? 'breakout' : 'pullback'} + konfirmasi volume/momentum + Risk Gate valid → BUY.`,
      missing,
      levels,
    };
  }

  const pending = [
    !stacked && (price < ema20 ? `close > EMA20 ${rp(ema20)}${ema20 > ema50 ? '' : ' + EMA20 > EMA50'}` : 'harga > EMA20 > EMA50'),
    aboveEma200 === false && 'harga > EMA200',
    stacked && setup == null && `pullback ke ${rp(pullbackRef)}${breakoutLevel != null ? ` atau breakout > ${rp(breakoutLevel)}` : ''}`,
    !volumeOk && `RVOL ≥ ${minRvol}× + candle hijau`,
    !macdOk && 'MACD hist > 0',
    rsiOverbought && `RSI turun < ${RSI_OVERBOUGHT}`,
    setup != null && confirmed && !gateOk && aboveEma200 !== false && `R/R ≥ 1:${SWING_MIN_RR} dengan risiko ≤ ${SWING_MAX_RISK_PCT}%`,
  ].filter(Boolean);
  return {
    mode: 'SWING', decision: 'WAIT', headline, data,
    fields: fields(
      `Tunggu: ${pending.join(' + ')}.`,
      `Invalidasi bila close < ${rp(sl)}.`,
      extended ? 'Harga extended — jangan kejar, tunggu pullback.' : stacked ? 'Trend bagus tetapi setup/konfirmasi/Risk Gate belum lengkap.' : 'Trend belum jelas.',
    ),
    reason: extended ? 'Harga extended → WAIT.' : stacked ? 'Setup swing belum terkonfirmasi → WAIT.' : 'Trend belum jelas → WAIT.',
    missing,
    levels,
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
  /** From isTechnicalBearish(); null = unknown. Good fundamentals + bearish technicals → WATCHLIST, never BUY. */
  technicalBearish: boolean | null;
}

export function buildInvestingModeReview(i: InvestingModeInput): ModeReview {
  const roe = Number.isFinite(i.roe) && i.roe !== 0 ? i.roe : null;
  const per = Number.isFinite(i.per) && i.per !== 0 ? i.per : null;
  const pbv = Number.isFinite(i.pbv) && i.pbv > 0 ? i.pbv : null;
  const eg = i.earningsGrowth;
  const rg = i.revenueGrowth;
  const der = i.debtToEquity;
  const upsidePct = valid(i.fairValue) ? ((i.fairValue - i.price) / i.price) * 100 : null;

  const missing = [
    rg == null && 'Pertumbuhan pendapatan',
    eg == null && 'Pertumbuhan laba',
    roe == null && 'ROE',
    der == null && !i.isFinancial && 'Debt (DER)',
    i.operatingCashFlow == null && 'Cash Flow',
    per == null && 'PER',
    pbv == null && 'PBV',
    !valid(i.fairValue) && 'Fair Value',
  ].filter((x): x is string => Boolean(x));

  const growthGood = eg != null && eg >= GROWTH_GOOD;
  const roeGood = roe != null && roe >= ROE_GOOD;
  const debtOk = der != null ? der <= DER_OK : i.isFinancial;
  const marginOk = i.netMargin == null || i.netMargin > 0;
  const healthy = roeGood && debtOk && marginOk;
  const attractive = healthy && growthGood;
  const valuationFair = upsidePct != null ? upsidePct >= 0 : per != null && per > 0 && per <= PER_FAIR_MAX;
  const accZone = valid(i.accumulationLow) && valid(i.accumulationHigh) ? `${rp(i.accumulationLow)} – ${rp(i.accumulationHigh)}` : null;
  const inAccZone = valid(i.accumulationHigh) ? i.price <= i.accumulationHigh : valuationFair;
  const coreMissing = [eg == null, roe == null, per == null].filter(Boolean).length;

  const broken = [
    eg != null && eg <= GROWTH_BROKEN && `laba turun ${pct(eg)} YoY`,
    roe != null && roe < ROE_BROKEN && `ROE hanya ${roe.toFixed(1)}%`,
    per != null && per < 0 && 'emiten merugi (PER negatif)',
    der != null && !i.isFinancial && der > DER_BROKEN && `DER ${(der / 100).toFixed(2)}× terlalu tinggi`,
  ].filter((x): x is string => Boolean(x));
  const weak = broken.length > 0 || (roe != null && !roeGood && eg != null && !growthGood);

  const growth = `Laba ${pct(eg)} YoY · Pendapatan ${pct(rg)} YoY → ${eg == null ? 'pertumbuhan laba N/A.' : growthGood ? 'laba bertumbuh baik.' : eg >= 0 ? 'laba bertumbuh tipis.' : 'laba menurun.'}`;
  const profitability = `ROE ${roe != null ? `${roe.toFixed(1)}%` : NA} · Net margin ${i.netMargin != null ? `${i.netMargin.toFixed(1)}%` : NA} → ${roe == null ? 'ROE N/A.' : roeGood ? 'modal dipakai efisien.' : `ROE di bawah ${ROE_GOOD}%.`}`;
  const balanceSheet = `DER ${der != null ? `${(der / 100).toFixed(2)}×` : NA} · Cash Flow ${i.operatingCashFlow != null ? rp(i.operatingCashFlow) : NA} → ${der == null ? (i.isFinancial ? 'DER tidak relevan untuk bank/keuangan.' : 'Debt N/A.') : debtOk ? 'utang terkendali (DER ≤ 1×).' : 'utang tinggi (DER > 1×).'}${i.operatingCashFlow == null ? ' Cash flow belum ada di sumber data — cek laporan arus kas manual.' : ''}`;
  const valuation = `PER ${per != null ? `${per.toFixed(1)}×` : NA} · PBV ${pbv != null ? `${pbv.toFixed(2)}×` : NA} → ${per == null ? 'valuasi N/A.' : per < 0 ? 'emiten merugi.' : per <= PER_FAIR_MAX ? `PER masih wajar (≤ ${PER_FAIR_MAX}×).` : `PER mahal (> ${PER_FAIR_MAX}×).`}`;
  const fairValue = valid(i.fairValue)
    ? `${rp(i.fairValue)} · gap ${pct(upsidePct, 0)} dari harga ${rp(i.price)} → ${valuationFair ? 'harga di bawah nilai wajar' : 'harga di atas nilai wajar (mahal)'}${accZone ? ` · area akumulasi ${accZone}` : ''}.`
    : `${NA} — valuation gap tidak bisa dihitung.`;

  const headlineValue = broken.length > 0 ? 'Fundamental melemah'
    : attractive ? 'Fundamental sehat & bertumbuh'
      : healthy ? 'Fundamental sehat, pertumbuhan terbatas'
        : coreMissing >= 2 ? 'Data fundamental tidak cukup'
          : 'Fundamental campuran';
  const invalidation = `Thesis batal bila laba turun > ${Math.abs(GROWTH_BROKEN)}% YoY, ROE < ${ROE_BROKEN}%, atau DER > ${DER_BROKEN / 100}×.`;
  const naNote = missing.length ? ` Data N/A: ${missing.join(', ')}.` : '';
  const result = (decision: ModeDecision, thesis: string, risk: string, reason: string): ModeReview => ({
    mode: 'INVESTING', decision, headline: { label: 'Fundamental', value: headlineValue }, data: [],
    fields: [
      { label: 'Growth', value: growth },
      { label: 'Profitability', value: profitability },
      { label: 'Balance Sheet', value: balanceSheet },
      { label: 'Valuation', value: valuation },
      { label: 'Fair Value', value: fairValue },
      { label: 'Thesis', value: thesis },
      { label: 'Risk', value: `${risk} ${invalidation}${naNote}`, tone: 'negative' },
    ],
    reason,
    missing,
  });

  if (coreMissing >= 2) {
    return result('WAIT', 'Belum bisa dibentuk — data laba/ROE/PER tidak cukup.', 'Keputusan tanpa data inti tidak valid.', 'Data fundamental tidak cukup → WAIT.');
  }

  if (weak) {
    const why = broken.length > 0 ? `thesis rusak: ${broken.join(', ')}` : `ROE < ${ROE_GOOD}% dan laba tumbuh < ${GROWTH_GOOD}%`;
    return result(
      'NO_TRADE',
      `Bukan kandidat investasi (${why})${i.technicalBearish === false ? ' — meski teknikal bullish, itu bukan alasan investasi' : ''}.`,
      'Risiko value trap.',
      `Fundamental lemah (${why}) → NO TRADE.`,
    );
  }

  if (attractive && valuationFair && inAccZone && i.technicalBearish !== true) {
    return result(
      'BUY',
      `Bisnis sehat (ROE ${roe!.toFixed(1)}%, laba ${pct(eg)} YoY) di valuasi wajar — akumulasi bertahap${accZone ? ` di ${accZone}` : ` ≤ ${rp(i.fairValue ?? i.price)}`}.`,
      `Upside ${pct(upsidePct, 0)} ke nilai wajar adalah estimasi, bukan janji.${i.technicalBearish == null ? ' Teknikal N/A — cek trend sebelum akumulasi.' : ''}`,
      'Fundamental sehat + bertumbuh + valuasi wajar + teknikal tidak bearish → BUY (akumulasi).',
    );
  }

  if (attractive) {
    const why = !valuationFair ? 'valuasi masih mahal'
      : !inAccZone ? `harga belum masuk area akumulasi${accZone ? ` ${accZone}` : ''}`
        : 'teknikal masih bearish';
    return result(
      'WATCHLIST',
      `Bisnis menarik, tetapi ${why} — pantau${accZone ? `, tunggu harga di ${accZone}` : ''}${i.technicalBearish ? ' dan trend berbalik' : ''}.`,
      !valuationFair ? 'Membeli di valuasi premium mengurangi margin of safety.' : i.technicalBearish ? 'Trend turun bisa berlanjut meski fundamental bagus.' : 'Jangan mengejar harga di atas area akumulasi.',
      `Fundamental menarik tetapi ${why} → WATCHLIST.`,
    );
  }

  return result(
    'WAIT',
    'Fundamental belum memenuhi semua syarat (ROE ≥ 15%, laba ≥ +10% YoY, utang terkendali).',
    'Syarat kualitas bisnis belum lengkap.',
    'Fundamental belum memenuhi semua syarat → WAIT.',
  );
}

// ─── Share text ──────────────────────────────────────────────────────────────────

const fieldText = (f: ModeField) => `${f.label}: ${Array.isArray(f.value) ? f.value.join(' ') : f.value}`;

export function formatTradingModesReview(ticker: string, reviews: ModeReview[]): string {
  const blocks = reviews.map((r) => [
    `📊 ${ticker} — ${TRADING_MODE_LABEL[r.mode]}`,
    fieldText(r.headline),
    ...(r.data.length > 0 ? [`Data: ${r.data.map((d) => `${d.label} ${d.value}`).join(' · ')}`] : []),
    ...r.fields.map(fieldText),
    `Decision: ${MODE_DECISION_LABEL[r.decision]} — ${r.reason}`,
  ].join('\n'));
  return [
    ...blocks,
    '⚠️ INTRADAY = timing hari ini · SWING = setup beberapa hari/minggu · INVESTING = kualitas bisnis + valuasi. Edukasi, bukan ajakan jual/beli. Target adalah proyeksi, bukan janji profit.',
  ].join('\n\n');
}
