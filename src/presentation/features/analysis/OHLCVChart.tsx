'use client';

/**
 * OHLCVChart.tsx
 *
 * Interactive price chart for the stock analysis detail page.
 *
 * Built with Recharts (already in dependencies).
 * Shows:
 *   • Candlestick-style price via a composed chart (high-low shadow + open-close body)
 *   • EMA 20 / EMA 50 / EMA 200 overlays
 *   • Volume bars below (dual-axis)
 *   • Tooltip with OHLCV + EMA values
 *   • Period selector: 1D / 1W / 1M / 3M / YTD / 1Y / 3Y / 5Y
 */

import {
  CartesianGrid,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
  Legend,
} from 'recharts';
import { useMemo, useState } from 'react';
import { OHLCVBar } from '@/domain/models/History';
import { ema } from '@/domain/indicators/movingAverages';
import { cn } from '@/lib/format';

// ─── Period selector ──────────────────────────────────────────────────────────
// `bars` is the trading-day lookback used to slice history. YTD is special-cased
// (filtered by calendar date, not a fixed count) — its `bars` value is unused.
const PERIODS = [
  { key: '1D', bars: 1 },
  { key: '1W', bars: 5 },
  { key: '1M', bars: 22 },
  { key: '3M', bars: 66 },
  { key: 'YTD', bars: 252 },
  { key: '1Y', bars: 252 },
  { key: '3Y', bars: 756 },
  { key: '5Y', bars: 1260 },
] as const;
type Period = (typeof PERIODS)[number]['key'];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function shortDate(dateStr: string): string {
  // dateStr is usually "YYYY-MM-DD"
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  } catch {
    return dateStr.slice(5); // MM-DD fallback
  }
}

function fmtRp(n: number): string {
  if (Number.isNaN(n) || n == null) return '–';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtVol(v: number): string {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}M lot`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}jt`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────
function OHLCVTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const map: Record<string, { value: number; color: string }> = {};
  for (const p of payload) if (p.value != null && !Number.isNaN(p.value)) map[p.name] = p;

  const get = (key: string) => map[key]?.value ?? NaN;
  const open = get('open');
  const close = get('close');
  const isGreen = close >= open;

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 shadow-xl text-xs space-y-1.5 min-w-[180px]">
      <p className="font-semibold text-zinc-700 dark:text-zinc-200 pb-1 border-b border-zinc-100 dark:border-zinc-800">{label}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {[
          { key: 'high', label: 'High' },
          { key: 'low', label: 'Low' },
          { key: 'open', label: 'Open' },
          { key: 'close', label: 'Close' },
        ].map(({ key, label: lbl }) => {
          const v = get(key);
          return !Number.isNaN(v) ? (
            <div key={key} className="flex justify-between gap-2">
              <span className="text-zinc-400 dark:text-zinc-500">{lbl}</span>
              <span className={cn('font-mono tabular-nums font-medium', key === 'close' ? isGreen ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400' : 'text-zinc-700 dark:text-zinc-200')}>
                {fmtRp(v)}
              </span>
            </div>
          ) : null;
        })}
      </div>
      {!Number.isNaN(get('volume')) && (
        <div className="flex justify-between gap-2 pt-1 border-t border-zinc-100 dark:border-zinc-800">
          <span className="text-zinc-400 dark:text-zinc-500">Volume</span>
          <span className="font-mono tabular-nums text-zinc-600 dark:text-zinc-300">{fmtVol(get('volume'))}</span>
        </div>
      )}
      {[
        { key: 'ema20', label: 'EMA 20', color: '#f59e0b' },
        { key: 'ema50', label: 'EMA 50', color: '#3b82f6' },
        { key: 'ema200', label: 'EMA 200', color: '#a855f7' },
      ].map(({ key, label: lbl, color }) => {
        const v = get(key);
        return !Number.isNaN(v) ? (
          <div key={key} className="flex justify-between gap-2">
            <span style={{ color }} className="font-semibold">{lbl}</span>
            <span className="font-mono tabular-nums text-zinc-600 dark:text-zinc-300">{fmtRp(v)}</span>
          </div>
        ) : null;
      })}
    </div>
  );
}

// ─── Candle body custom bar ───────────────────────────────────────────────────
// Recharts doesn't have native candlestick, so we use a custom Bar shape.
function CandleShape(props: {
  x?: number; y?: number; width?: number; height?: number;
  open?: number; close?: number; high?: number; low?: number;
  yAxis?: { scale?: (v: number) => number };
  payload?: { open: number; close: number; high: number; low: number };
}) {
  const { x = 0, width = 0, payload, yAxis } = props;
  if (!payload || !yAxis?.scale) return null;

  const scale = yAxis.scale!;
  const { open, close, high, low } = payload;
  const isGreen = close >= open;

  const yHigh = scale(high);
  const yLow = scale(low);
  const yOpen = scale(open);
  const yClose = scale(close);

  const bodyTop = Math.min(yOpen, yClose);
  const bodyH = Math.max(Math.abs(yOpen - yClose), 1.5);
  const cx = x + width / 2;

  const color = isGreen ? '#10b981' : '#f43f5e';

  return (
    <g>
      {/* Wick */}
      <line x1={cx} x2={cx} y1={yHigh} y2={yLow} stroke={color} strokeWidth={1} />
      {/* Body */}
      <rect
        x={x + 1}
        y={bodyTop}
        width={Math.max(width - 2, 2)}
        height={bodyH}
        fill={isGreen ? color : color}
        fillOpacity={isGreen ? 1 : 0.85}
        rx={1}
      />
    </g>
  );
}

// ─── Main chart component ─────────────────────────────────────────────────────
interface OHLCVChartProps {
  bars: OHLCVBar[];
  currentClose: number;
}

export function OHLCVChart({ bars, currentClose }: OHLCVChartProps) {
  const [period, setPeriod] = useState<Period>('3M');

  const chartData = useMemo(() => {
    let slice: OHLCVBar[];
    if (period === 'YTD') {
      const lastDate = bars.length > 0 ? new Date(bars[bars.length - 1].date) : new Date();
      const yearStart = new Date(lastDate.getFullYear(), 0, 1);
      slice = bars.filter((b) => new Date(b.date) >= yearStart);
    } else {
      const periodBars = PERIODS.find((p) => p.key === period)?.bars ?? 66;
      slice = bars.slice(-periodBars);
    }
    if (slice.length === 0) slice = bars.slice(-5);

    // Compute EMA series for the slice
    const closes = slice.map((b) => b.close);
    const ema20Arr = ema(closes, 20);
    const ema50Arr = ema(closes, 50);
    const ema200Full = ema(bars.map((b) => b.close), 200); // need full history for EMA200
    const ema200Slice = ema200Full.slice(-slice.length);

    return slice.map((bar, i) => ({
      date: shortDate(bar.date),
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      volume: bar.volume,
      // Use null (not NaN) so Recharts skips gracefully
      ema20: Number.isNaN(ema20Arr[i]) ? null : +ema20Arr[i].toFixed(0),
      ema50: Number.isNaN(ema50Arr[i]) ? null : +ema50Arr[i].toFixed(0),
      ema200: Number.isNaN(ema200Slice[i]) ? null : +ema200Slice[i].toFixed(0),
      // For the custom candle bar, we need a height placeholder
      candleRange: bar.high - bar.low,
    }));
  }, [bars, period]);

  // Compute price domain with small padding
  const priceMin = useMemo(() => Math.min(...chartData.map((d) => d.low)) * 0.995, [chartData]);
  const priceMax = useMemo(() => Math.max(...chartData.map((d) => d.high)) * 1.005, [chartData]);
  const volMax = useMemo(() => Math.max(...chartData.map((d) => d.volume)), [chartData]);

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-3 pb-2 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Grafik Harga
          </p>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="flex items-center gap-1"><span className="inline-block size-2 rounded-full bg-amber-400" />EMA20</span>
            <span className="flex items-center gap-1"><span className="inline-block size-2 rounded-full bg-blue-500" />EMA50</span>
            <span className="flex items-center gap-1"><span className="inline-block size-2 rounded-full bg-purple-500" />EMA200</span>
          </div>
        </div>
        {/* Period tabs */}
        <div className="flex flex-wrap gap-0.5 rounded-lg border border-zinc-200 dark:border-zinc-700 p-0.5">
          {PERIODS.map(({ key }) => (
            <button
              key={key}
              type="button"
              onClick={() => setPeriod(key)}
              className={cn(
                'rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors',
                period === key
                  ? 'bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900'
                  : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              )}
            >
              {key}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="px-2 pt-2 pb-1">
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(113,113,122,0.12)"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: '#71717a' }}
              tickLine={false}
              axisLine={false}
              interval={Math.floor(chartData.length / 6)}
            />
            {/* Price Y axis (left) */}
            <YAxis
              yAxisId="price"
              orientation="left"
              domain={[priceMin, priceMax]}
              tick={{ fontSize: 10, fill: '#71717a' }}
              tickLine={false}
              axisLine={false}
              width={62}
              tickFormatter={(v) =>
                new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 0 }).format(v)
              }
            />
            {/* Volume Y axis (right, hidden ticks) */}
            <YAxis
              yAxisId="vol"
              orientation="right"
              domain={[0, volMax * 4]} // scale down volume bars to ~25% chart height
              hide
            />
            <Tooltip
              content={<OHLCVTooltip />}
              cursor={{ stroke: 'rgba(113,113,122,0.3)', strokeWidth: 1, strokeDasharray: '4 2' }}
            />

            {/* Volume bars (background, right axis) */}
            <Bar
              yAxisId="vol"
              dataKey="volume"
              name="volume"
              maxBarSize={16}
              isAnimationActive={false}
              opacity={0.35}
            >
              {chartData.map((d, i) => (
                <Cell key={i} fill={d.close >= d.open ? '#10b981' : '#f43f5e'} />
              ))}
            </Bar>

            {/* Candlestick bars (custom shape, price axis) */}
            <Bar
              yAxisId="price"
              dataKey="candleRange"
              name="price"
              maxBarSize={14}
              isAnimationActive={false}
              shape={<CandleShape />}
            >
              {chartData.map((_, i) => (
                <Cell key={i} fill="transparent" />
              ))}
            </Bar>

            {/* Hidden bars for OHLCV tooltip data */}
            {(['open', 'high', 'low', 'close'] as const).map((k) => (
              <Bar key={k} yAxisId="price" dataKey={k} name={k} hide isAnimationActive={false} />
            ))}

            {/* EMA overlays */}
            <Line
              yAxisId="price"
              type="monotone"
              dataKey="ema20"
              name="ema20"
              stroke="#f59e0b"
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
            <Line
              yAxisId="price"
              type="monotone"
              dataKey="ema50"
              name="ema50"
              stroke="#3b82f6"
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
            <Line
              yAxisId="price"
              type="monotone"
              dataKey="ema200"
              name="ema200"
              stroke="#a855f7"
              strokeWidth={1.5}
              dot={false}
              strokeDasharray="4 3"
              isAnimationActive={false}
              connectNulls
            />

            {/* Current price reference line */}
            <ReferenceLine
              yAxisId="price"
              y={currentClose}
              stroke="rgba(16,185,129,0.5)"
              strokeDasharray="3 3"
              strokeWidth={1}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Footer caption */}
      <p className="px-4 pb-3 text-[10px] text-zinc-400 dark:text-zinc-600">
        Data EOD (End-of-Day). Candle hijau = close {'>'} open. Garis unuh = EMA200 (long-term trend).
      </p>
    </div>
  );
}
