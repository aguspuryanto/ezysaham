import { OHLCVBar } from '@/domain/models/History';
import { MacdResult } from '@/domain/indicators/macd';
import { HistoricalPatternResult, PatternHorizonStat, PatternSetupResult } from '@/domain/models/TechnicalHistory';
import { crossesAbove } from './crossUtils';
import { priorHigh } from './breakoutEvents';

const HORIZONS: Array<{ label: '5D' | '10D' | '20D'; days: number }> = [
  { label: '5D', days: 5 },
  { label: '10D', days: 10 },
  { label: '20D', days: 20 },
];
const MAX_HORIZON_DAYS = 20;
const LOW_SAMPLE_THRESHOLD = 5;

interface PatternContext {
  bars: OHLCVBar[];
  ema20: number[];
  ema50: number[];
  rsi: number[];
  rsi30: number[];
  macd: MacdResult;
}

interface PatternSetupDef {
  key: string;
  label: string;
  description: string;
  matches(ctx: PatternContext, i: number): boolean;
}

const SETUPS: PatternSetupDef[] = [
  {
    key: 'volume_breakout',
    label: 'Volume Breakout',
    description: 'RVOL ≥ 2×, harga di atas EMA20, dan menembus resistance 20 hari terakhir.',
    matches: (ctx, i) => {
      const bar = ctx.bars[i];
      const high20 = priorHigh(ctx.bars, i, 20);
      return bar.close > high20 && bar.close > ctx.ema20[i] && !Number.isNaN(ctx.ema20[i]);
    },
  },
  {
    key: 'golden_cross',
    label: 'Golden Cross EMA20/50',
    description: 'EMA20 baru saja memotong ke atas EMA50.',
    matches: (ctx, i) => crossesAbove(ctx.ema20, ctx.ema50, i),
  },
  {
    key: 'rsi_oversold_bounce',
    label: 'RSI Oversold Bounce',
    description: 'RSI(14) baru keluar dari zona oversold (naik melewati level 30).',
    matches: (ctx, i) => crossesAbove(ctx.rsi, ctx.rsi30, i),
  },
  {
    key: 'macd_bullish_cross',
    label: 'MACD Bullish Cross',
    description: 'Garis MACD baru memotong ke atas garis sinyal.',
    matches: (ctx, i) => crossesAbove(ctx.macd.macdLine, ctx.macd.signalLine, i),
  },
];

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function forwardReturn(bars: OHLCVBar[], i: number, days: number): number {
  const j = i + days;
  if (j >= bars.length || bars[i].close === 0) return NaN;
  return ((bars[j].close - bars[i].close) / bars[i].close) * 100;
}

function computeSetupResult(def: PatternSetupDef, ctx: PatternContext): PatternSetupResult {
  const { bars } = ctx;
  const backtestEnd = bars.length - MAX_HORIZON_DAYS; // exclude tail bars without a full 20D forward window
  const matchIndices: number[] = [];
  for (let i = 1; i < backtestEnd; i++) {
    if (def.matches(ctx, i)) matchIndices.push(i);
  }

  const horizons: PatternHorizonStat[] = HORIZONS.map(({ label, days }) => {
    const returns = matchIndices
      .map((i) => forwardReturn(bars, i, days))
      .filter((r) => !Number.isNaN(r));
    if (returns.length === 0) {
      return { label, winRate: 0, avgReturn: 0, maxGain: 0, maxDrawdown: 0 };
    }
    const wins = returns.filter((r) => r > 0).length;
    const avg = returns.reduce((a, b) => a + b, 0) / returns.length;
    return {
      label,
      winRate: Math.round((wins / returns.length) * 100),
      avgReturn: round1(avg),
      maxGain: round1(Math.max(...returns)),
      maxDrawdown: round1(Math.min(...returns)),
    };
  });

  const matchesToday = bars.length > 1 && def.matches(ctx, bars.length - 1);

  return {
    key: def.key,
    label: def.label,
    description: def.description,
    occurrences: matchIndices.length,
    horizons,
    matchesToday,
    lowSample: matchIndices.length < LOW_SAMPLE_THRESHOLD,
  };
}

export function computeHistoricalPatterns(
  bars: OHLCVBar[],
  series: { ema20: number[]; ema50: number[]; rsi: number[]; macd: MacdResult }
): HistoricalPatternResult {
  const ctx: PatternContext = {
    bars,
    ema20: series.ema20,
    ema50: series.ema50,
    rsi: series.rsi,
    rsi30: new Array(series.rsi.length).fill(30),
    macd: series.macd,
  };

  return { setups: SETUPS.map((def) => computeSetupResult(def, ctx)) };
}
