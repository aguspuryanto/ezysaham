/**
 * structureMomentumBacktest.ts
 *
 * Objective EOD backtest of: Market Structure + EMA 8/18/200 + Momentum Candle + Volume.
 * Every decision on candle T uses ONLY candles ≤ T (no look-ahead):
 *
 *   TREND      Close > EMA200 AND EMA8 > EMA18 (recursive EMAs — value at T uses only bars ≤ T).
 *   STRUCTURE  Swing High/Low with N=2 bars each side. A swing at j is only CONFIRMED at j+N, so on
 *              candle T only swings with j ≤ T−N exist. Bullish = last 2 confirmed highs HH AND last
 *              2 confirmed lows HL.
 *   MOMENTUM   Close > Open, Body/Range ≥ 0.60, Close ≥ High − 0.25·Range.
 *   VOLUME     Volume ≥ SMA(Volume, 20) × 1.5 (SMA over bars T−19..T).
 *   ENTRY      All four true on signal candle T → BUY at Open of T+1 (never the signal Close).
 *   STOP       Last confirmed swing low as of T. SL ≥ Entry → INVALID trade (skipped, counted).
 *   EXIT       Low ≤ SL (fill at SL, or at Open when it gaps below SL) · Close < EMA18 · bullish
 *              structure invalid. Signal exits are known only at the close → filled at next Open.
 *              SL and a signal exit on the same candle → SL first (conservative).
 *
 * Fixed parameters, one position at a time, full capital per trade, no fees/slippage. Trades are
 * split In-Sample / Out-of-Sample by the signal candle's position in the data (70% / 30%).
 */

import type { OHLCVBar } from '@/domain/models/History';
import { ema, sma } from '@/domain/indicators/movingAverages';

export const BACKTEST_PARAMS = {
  emaFast: 8,
  emaSlow: 18,
  emaTrend: 200,
  swingN: 2,
  minBodyRatio: 0.6,
  maxUpperWickRatio: 0.25,
  volumeSma: 20,
  volumeMultiplier: 1.5,
  inSampleRatio: 0.7,
  /** Below this many closed trades a sample is flagged as too small to conclude anything. */
  minTradesForConfidence: 30,
} as const;

export type ExitReason = 'STOP_LOSS' | 'CLOSE_BELOW_EMA18' | 'STRUCTURE_INVALID';
export type SampleSet = 'IN_SAMPLE' | 'OUT_OF_SAMPLE';

export const EXIT_REASON_LABEL: Record<ExitReason, string> = {
  STOP_LOSS: 'Stop Loss',
  CLOSE_BELOW_EMA18: 'Close < EMA18',
  STRUCTURE_INVALID: 'Struktur bullish invalid',
};

export interface BacktestTrade {
  signalDate: string;
  entryDate: string;
  entryPrice: number;
  stopLoss: number;
  exitDate: string;
  exitPrice: number;
  plPct: number;
  /** Trading days from entry candle to exit candle. */
  holdingDays: number;
  exitReason: ExitReason;
  set: SampleSet;
}

export interface OpenPosition {
  signalDate: string;
  entryDate: string;
  entryPrice: number;
  stopLoss: number;
  lastDate: string;
  lastClose: number;
  unrealizedPct: number;
  set: SampleSet;
}

export interface InvalidSignal {
  signalDate: string;
  entryPrice: number;
  stopLoss: number;
}

export interface BacktestStats {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number | null;
  avgWinPct: number | null;
  avgLossPct: number | null;
  /** Gross win % ÷ |gross loss %|. null when there are no losses (undefined, not infinite edge). */
  profitFactor: number | null;
  /** Average P/L % per trade. */
  expectancyPct: number | null;
  /** Peak-to-trough of the compounded closed-trade equity curve, in % (negative). */
  maxDrawdownPct: number | null;
  avgHoldingDays: number | null;
  /** Compounded return of all closed trades, full capital per trade. */
  totalReturnPct: number | null;
  tooFewTrades: boolean;
}

export interface BacktestResult {
  barCount: number;
  firstDate: string;
  lastDate: string;
  splitDate: string;
  /** First bar where EMA200 exists — no signal can fire before it. */
  warmupDate: string | null;
  trades: BacktestTrade[];
  invalidSignals: InvalidSignal[];
  openPosition: OpenPosition | null;
  all: BacktestStats;
  inSample: BacktestStats;
  outOfSample: BacktestStats;
  verdict: string;
}

interface Swing {
  index: number;
  price: number;
}

/** Swings confirmed by candle i (swing index ≤ i − N). */
function confirmedSwings(bars: OHLCVBar[], n: number) {
  const highs: (Swing | null)[] = new Array(bars.length).fill(null);
  const lows: (Swing | null)[] = new Array(bars.length).fill(null);
  for (let j = n; j < bars.length - n; j++) {
    let isHigh = true;
    let isLow = true;
    for (let k = 1; k <= n; k++) {
      if (!(bars[j].high > bars[j - k].high && bars[j].high > bars[j + k].high)) isHigh = false;
      if (!(bars[j].low < bars[j - k].low && bars[j].low < bars[j + k].low)) isLow = false;
    }
    // Registered at the candle that confirms it, never earlier.
    if (isHigh) highs[j + n] = { index: j, price: bars[j].high };
    if (isLow) lows[j + n] = { index: j, price: bars[j].low };
  }
  return { highs, lows };
}

function pctChange(from: number, to: number) {
  return ((to - from) / from) * 100;
}

export function computeStats(trades: BacktestTrade[]): BacktestStats {
  const n = trades.length;
  const tooFewTrades = n < BACKTEST_PARAMS.minTradesForConfidence;
  if (n === 0) {
    return {
      totalTrades: 0, wins: 0, losses: 0, winRate: null, avgWinPct: null, avgLossPct: null, profitFactor: null,
      expectancyPct: null, maxDrawdownPct: null, avgHoldingDays: null, totalReturnPct: null, tooFewTrades,
    };
  }
  const wins = trades.filter((t) => t.plPct > 0);
  const losses = trades.filter((t) => t.plPct <= 0);
  const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
  const grossWin = sum(wins.map((t) => t.plPct));
  const grossLoss = Math.abs(sum(losses.map((t) => t.plPct)));

  let equity = 1;
  let peak = 1;
  let maxDd = 0;
  for (const t of trades) {
    equity *= 1 + t.plPct / 100;
    peak = Math.max(peak, equity);
    maxDd = Math.min(maxDd, (equity - peak) / peak);
  }

  return {
    totalTrades: n,
    wins: wins.length,
    losses: losses.length,
    winRate: (wins.length / n) * 100,
    avgWinPct: wins.length ? grossWin / wins.length : null,
    avgLossPct: losses.length ? -grossLoss / losses.length : null,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : null,
    expectancyPct: sum(trades.map((t) => t.plPct)) / n,
    maxDrawdownPct: maxDd * 100,
    avgHoldingDays: sum(trades.map((t) => t.holdingDays)) / n,
    totalReturnPct: (equity - 1) * 100,
    tooFewTrades,
  };
}

function buildVerdict(inS: BacktestStats, oos: BacktestStats): string {
  if (inS.totalTrades === 0 && oos.totalTrades === 0) {
    return 'Tidak ada trade — sistem tidak memberi sinyal pada periode ini. Tidak ada kesimpulan yang bisa diambil.';
  }
  const edge = (s: BacktestStats) => s.expectancyPct != null && s.expectancyPct > 0 && (s.profitFactor == null || s.profitFactor > 1);
  const parts: string[] = [];
  if (inS.tooFewTrades || oos.tooFewTrades) {
    parts.push(`Jumlah trade terlalu sedikit (In-Sample ${inS.totalTrades}, Out-of-Sample ${oos.totalTrades}; minimal ${BACKTEST_PARAMS.minTradesForConfidence} per set) — hasil belum signifikan secara statistik.`);
  }
  if (edge(inS) && edge(oos)) {
    parts.push('Expectancy positif dan profit factor > 1 di In-Sample maupun Out-of-Sample — ada indikasi edge, tetapi bukan jaminan kinerja ke depan.');
  } else if (edge(inS) && !edge(oos)) {
    parts.push('Positif di In-Sample tetapi tidak bertahan di Out-of-Sample — indikasi hasil kebetulan/overfit, bukan edge yang terbukti.');
  } else {
    parts.push('Expectancy/profit factor tidak menunjukkan edge positif yang konsisten.');
  }
  parts.push('Win rate saja tidak menentukan profitabilitas — lihat expectancy, profit factor, dan drawdown. Belum termasuk fee & slippage.');
  return parts.join(' ');
}

export function runStructureMomentumBacktest(bars: OHLCVBar[]): BacktestResult | null {
  const P = BACKTEST_PARAMS;
  if (bars.length < P.emaTrend + P.swingN + 2) return null;

  const closes = bars.map((b) => b.close);
  const ema8 = ema(closes, P.emaFast);
  const ema18 = ema(closes, P.emaSlow);
  const ema200 = ema(closes, P.emaTrend);
  const volSma = sma(bars.map((b) => b.volume), P.volumeSma);
  const swings = confirmedSwings(bars, P.swingN);
  const splitIndex = Math.floor(bars.length * P.inSampleRatio);

  // Rolling "last two confirmed" swings as of candle i.
  const lastHighs: Swing[] = [];
  const lastLows: Swing[] = [];
  const structureAt: boolean[] = new Array(bars.length).fill(false);
  const lastLowAt: (number | null)[] = new Array(bars.length).fill(null);
  for (let i = 0; i < bars.length; i++) {
    const h = swings.highs[i];
    const l = swings.lows[i];
    if (h) { lastHighs.push(h); if (lastHighs.length > 2) lastHighs.shift(); }
    if (l) { lastLows.push(l); if (lastLows.length > 2) lastLows.shift(); }
    structureAt[i] = lastHighs.length === 2 && lastLows.length === 2
      && lastHighs[1].price > lastHighs[0].price && lastLows[1].price > lastLows[0].price;
    lastLowAt[i] = lastLows.length ? lastLows[lastLows.length - 1].price : null;
  }

  const isSignal = (i: number) => {
    const b = bars[i];
    if (!Number.isFinite(ema200[i]) || !Number.isFinite(ema18[i]) || !Number.isFinite(volSma[i])) return false;
    const trend = b.close > ema200[i] && ema8[i] > ema18[i];
    const range = b.high - b.low;
    const momentum = range > 0 && b.close > b.open
      && Math.abs(b.close - b.open) / range >= P.minBodyRatio
      && b.close >= b.high - range * P.maxUpperWickRatio;
    const volume = volSma[i] > 0 && b.volume >= volSma[i] * P.volumeMultiplier;
    return trend && structureAt[i] && momentum && volume;
  };

  const trades: BacktestTrade[] = [];
  const invalidSignals: InvalidSignal[] = [];
  let openPosition: OpenPosition | null = null;

  let i = 0;
  while (i < bars.length - 1) {
    if (!isSignal(i)) { i++; continue; }
    const signal = i;
    const entryIdx = i + 1;
    const entryPrice = bars[entryIdx].open;
    const stopLoss = lastLowAt[signal];
    if (stopLoss == null || stopLoss >= entryPrice) {
      invalidSignals.push({ signalDate: bars[signal].date, entryPrice, stopLoss: stopLoss ?? 0 });
      i++;
      continue;
    }
    const set: SampleSet = signal < splitIndex ? 'IN_SAMPLE' : 'OUT_OF_SAMPLE';

    let exitIdx: number | null = null;
    let exitPrice = 0;
    let exitReason: ExitReason | null = null;
    for (let d = entryIdx; d < bars.length; d++) {
      const b = bars[d];
      // SL is checked first — conservative when a signal exit fires on the same candle.
      if (b.low <= stopLoss) {
        exitIdx = d;
        exitPrice = d > entryIdx && b.open < stopLoss ? b.open : stopLoss;
        exitReason = 'STOP_LOSS';
        break;
      }
      const belowEma = b.close < ema18[d];
      const structureBroken = !structureAt[d];
      if (belowEma || structureBroken) {
        if (d + 1 >= bars.length) break; // known only at the last close — still open
        exitIdx = d + 1;
        exitPrice = bars[d + 1].open;
        exitReason = belowEma ? 'CLOSE_BELOW_EMA18' : 'STRUCTURE_INVALID';
        break;
      }
    }

    if (exitIdx == null || exitReason == null) {
      const last = bars[bars.length - 1];
      openPosition = {
        signalDate: bars[signal].date, entryDate: bars[entryIdx].date, entryPrice, stopLoss,
        lastDate: last.date, lastClose: last.close, unrealizedPct: pctChange(entryPrice, last.close), set,
      };
      break;
    }

    trades.push({
      signalDate: bars[signal].date,
      entryDate: bars[entryIdx].date,
      entryPrice,
      stopLoss,
      exitDate: bars[exitIdx].date,
      exitPrice,
      plPct: pctChange(entryPrice, exitPrice),
      holdingDays: exitIdx - entryIdx,
      exitReason,
      set,
    });
    // Flat again from the exit candle; the next signal can be that candle at the earliest.
    i = exitIdx;
  }

  const inTrades = trades.filter((t) => t.set === 'IN_SAMPLE');
  const oosTrades = trades.filter((t) => t.set === 'OUT_OF_SAMPLE');
  const inSample = computeStats(inTrades);
  const outOfSample = computeStats(oosTrades);
  const warmup = ema200.findIndex((v) => Number.isFinite(v));

  return {
    barCount: bars.length,
    firstDate: bars[0].date,
    lastDate: bars[bars.length - 1].date,
    splitDate: bars[splitIndex].date,
    warmupDate: warmup >= 0 ? bars[warmup].date : null,
    trades,
    invalidSignals,
    openPosition,
    all: computeStats(trades),
    inSample,
    outOfSample,
    verdict: buildVerdict(inSample, outOfSample),
  };
}
