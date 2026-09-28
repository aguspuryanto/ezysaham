'use client';

/**
 * PriceChart.tsx
 *
 * Candlestick + volume chart for the Screener detail page. 1W–1Y slice the daily
 * EOD bars; 1D switches to the existing 1-minute intraday feed (getStockIntraday).
 * EMA series are computed over the full history before slicing so long EMAs stay
 * accurate at the left edge of short ranges. Price and volume panes share a
 * syncId so the crosshair moves across both.
 */

import { AlertCircle, CandlestickChart, Loader2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Bar, CartesianGrid, Cell, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { getStockIntraday } from '@/data/repositories/StockRepository';
import { ema } from '@/domain/indicators/movingAverages';
import { OHLCVBar } from '@/domain/models/History';
import { IntradayResponse } from '@/domain/models/Intraday';
import { cn } from '@/lib/format';
import { fmtCompact, fmtNum, fmtPct } from '../format';
import { ChartToolbar, IndicatorKey, IndicatorState, INDICATORS, Timeframe, TIMEFRAMES } from './ChartToolbar';
import { Card, TONE_TEXT } from './ui';

const UP = '#16a34a';
const DOWN = '#ef4444';
const AXIS = '#94a3b8';
const GRID = 'rgba(148,163,184,0.18)';
const Y_WIDTH = 58;
const PRICE_HEIGHT = 340;
const VOLUME_HEIGHT = 96;

interface ChartPoint {
  label: string;
  fullLabel: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  range: [number, number];
  ema9: number | null;
  ema21: number | null;
  ema50: number | null;
  ema200: number | null;
  vwap: number | null;
}

const finiteOrNull = (n: number) => (Number.isFinite(n) ? n : null);

function dailyPoints(bars: OHLCVBar[], count: number): ChartPoint[] {
  const closes = bars.map((b) => b.close);
  const series = { ema9: ema(closes, 9), ema21: ema(closes, 21), ema50: ema(closes, 50), ema200: ema(closes, 200) };
  const start = Math.max(0, bars.length - count);
  let pv = 0;
  let vol = 0;
  return bars.slice(start).map((b, j) => {
    const i = start + j;
    // Anchored VWAP from the first bar of the visible range (typical price × volume).
    pv += ((b.high + b.low + b.close) / 3) * b.volume;
    vol += b.volume;
    const d = new Date(b.date);
    return {
      label: d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
      fullLabel: d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
      volume: b.volume,
      range: [b.low, b.high],
      ema9: finiteOrNull(series.ema9[i]),
      ema21: finiteOrNull(series.ema21[i]),
      ema50: finiteOrNull(series.ema50[i]),
      ema200: finiteOrNull(series.ema200[i]),
      vwap: vol > 0 ? pv / vol : null,
    };
  });
}

function intradayPoints(res: IntradayResponse): ChartPoint[] {
  let pv = 0;
  let vol = 0;
  let prev = res.previousClose ?? res.bars[0]?.price ?? 0;
  return res.bars.map((b) => {
    pv += b.price * b.volume;
    vol += b.volume;
    const t = new Date(b.time * 1000);
    const label = t.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
    const point: ChartPoint = {
      label,
      fullLabel: `${t.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' })} · ${label} WIB`,
      open: prev,
      high: Math.max(prev, b.price),
      low: Math.min(prev, b.price),
      close: b.price,
      volume: b.volume,
      range: [Math.min(prev, b.price), Math.max(prev, b.price)],
      ema9: null, ema21: null, ema50: null, ema200: null,
      vwap: vol > 0 ? pv / vol : null,
    };
    prev = b.price;
    return point;
  });
}

/** Recharts has no native candlestick: a [low, high] range bar is re-drawn as wick + body. */
function Candle(props: { x?: number; y?: number; width?: number; height?: number; payload?: ChartPoint }) {
  const { x = 0, y = 0, width = 0, height = 0, payload } = props;
  if (!payload) return null;
  const { open, close, high, low } = payload;
  const span = high - low;
  const pxPerUnit = span > 0 ? height / span : 0;
  const yOf = (v: number) => y + (high - v) * pxPerUnit;
  const color = close >= open ? UP : DOWN;
  const bodyTop = Math.min(yOf(open), yOf(close));
  const bodyH = Math.max(Math.abs(yOf(open) - yOf(close)), 1);
  const bodyW = Math.max(Math.min(width * 0.7, 12), 1.5);
  const cx = x + width / 2;
  return (
    <g>
      <line x1={cx} x2={cx} y1={y} y2={y + height} stroke={color} strokeWidth={1} />
      <rect x={cx - bodyW / 2} y={bodyTop} width={bodyW} height={bodyH} fill={color} rx={0.5} />
    </g>
  );
}

function PriceTag({ viewBox, value, up }: { viewBox?: { x?: number; y?: number; width?: number }; value: number; up: boolean }) {
  if (!viewBox) return null;
  const x = (viewBox.x ?? 0) + (viewBox.width ?? 0);
  const y = viewBox.y ?? 0;
  return (
    <g>
      <rect x={x + 2} y={y - 10} width={Y_WIDTH - 4} height={20} rx={4} fill={up ? UP : DOWN} />
      <text x={x + Y_WIDTH / 2} y={y + 4} textAnchor="middle" fontSize={11} fontWeight={700} fill="#fff">
        {fmtNum(value)}
      </text>
    </g>
  );
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ChartPoint }> }) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  return (
    <div className="rounded-lg border border-(--sv-border) bg-(--sv-surface) px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-(--sv-text)">{p.fullLabel}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 tabular-nums">
        <span className="text-(--sv-muted)">Close</span><span className="text-right font-semibold text-(--sv-text)">{fmtNum(p.close)}</span>
        <span className="text-(--sv-muted)">Volume</span><span className="text-right text-(--sv-text)">{fmtCompact(p.volume)}</span>
      </div>
    </div>
  );
}

export function PriceChart({
  ticker,
  bars,
  currentPrice,
  height = PRICE_HEIGHT,
}: {
  ticker: string;
  bars: OHLCVBar[];
  currentPrice: number;
  height?: number;
}) {
  const [timeframe, setTimeframe] = useState<Timeframe>('3M');
  const [indicators, setIndicators] = useState<IndicatorState>({ ema9: true, ema21: true, ema50: true, ema200: true, vwap: false });
  const [intraday, setIntraday] = useState<{ status: 'idle' | 'loading' | 'ready' | 'error'; data: IntradayResponse | null }>({ status: 'idle', data: null });
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const isIntraday = timeframe === '1D';

  useEffect(() => {
    if (!isIntraday) return;
    let cancelled = false;
    Promise.resolve().then(() => { if (!cancelled) setIntraday((s) => ({ ...s, status: 'loading' })); });
    getStockIntraday(ticker).then((res) => {
      if (cancelled) return;
      setIntraday({ status: res.ok && res.bars.length > 0 ? 'ready' : 'error', data: res });
    });
    return () => { cancelled = true; };
  }, [isIntraday, ticker]);

  const points = useMemo<ChartPoint[]>(() => {
    if (isIntraday) return intraday.data?.ok ? intradayPoints(intraday.data) : [];
    const count = TIMEFRAMES.find((t) => t.key === timeframe)?.bars ?? 66;
    return dailyPoints(bars, count);
  }, [isIntraday, intraday.data, bars, timeframe]);

  const domain = useMemo<[number, number]>(() => {
    if (points.length === 0) return [0, 1];
    const values = points.flatMap((p) => [p.low, p.high]);
    for (const ind of INDICATORS) {
      if (!indicators[ind.key]) continue;
      for (const p of points) {
        const v = p[ind.key as keyof ChartPoint];
        if (typeof v === 'number') values.push(v);
      }
    }
    values.push(currentPrice);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = (max - min) * 0.06 || max * 0.01;
    return [Math.max(0, min - pad), max + pad];
  }, [points, indicators, currentPrice]);

  const shown = hoverIndex != null && points[hoverIndex] ? points[hoverIndex] : points[points.length - 1];
  const shownChange = shown ? shown.close - (points[0]?.open ?? shown.open) : 0;
  const lastUp = points.length > 1 ? currentPrice >= points[points.length - 2].close : true;
  const tickInterval = Math.max(0, Math.floor(points.length / 7));
  const volumeAvg = points.length ? points.reduce((s, p) => s + p.volume, 0) / points.length : 0;
  const loading = isIntraday && (intraday.status === 'loading' || intraday.status === 'idle');
  const errored = isIntraday && intraday.status === 'error';

  const toggle = (k: IndicatorKey) => setIndicators((s) => ({ ...s, [k]: !s[k] }));
  const onMove = (state: { activeTooltipIndex?: number | string | null }) => {
    const idx = state?.activeTooltipIndex;
    setHoverIndex(idx == null ? null : Number(idx));
  };

  return (
    <Card aria-labelledby="price-chart-title" className="flex flex-col gap-3 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="price-chart-title" className="text-base font-semibold text-(--sv-text)">Grafik Harga</h2>
      </div>
      <ChartToolbar timeframe={timeframe} onTimeframe={setTimeframe} indicators={indicators} onToggleIndicator={toggle} />

      <div className="rounded-lg border border-(--sv-border)">
        {/* OHLC legend (follows the crosshair, falls back to the latest bar) */}
        <div className="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-0.5 border-b border-(--sv-border) px-3 py-2 text-xs tabular-nums">
          <span className="font-semibold text-(--sv-text)">{ticker} · {timeframe}</span>
          {shown && (
            <>
              <span className="text-(--sv-muted)">{shown.fullLabel}</span>
              {!isIntraday && (
                <>
                  <span><span className="text-(--sv-muted)">O</span> {fmtNum(shown.open)}</span>
                  <span><span className="text-(--sv-muted)">H</span> {fmtNum(shown.high)}</span>
                  <span><span className="text-(--sv-muted)">L</span> {fmtNum(shown.low)}</span>
                </>
              )}
              <span><span className="text-(--sv-muted)">C</span> {fmtNum(shown.close)}</span>
              <span className={cn('font-semibold', shownChange >= 0 ? TONE_TEXT.positive : TONE_TEXT.negative)}>
                {shownChange >= 0 ? '+' : ''}{fmtNum(shownChange)} ({fmtPct(points[0]?.open ? (shownChange / points[0].open) * 100 : null)})
              </span>
            </>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 text-sm text-(--sv-muted)" style={{ height: height + VOLUME_HEIGHT }}>
            <Loader2 className="size-4 animate-spin" /> Memuat data intraday…
          </div>
        ) : errored ? (
          <div className="flex flex-col items-center justify-center gap-2 px-6 text-center text-sm text-(--sv-muted)" style={{ height: height + VOLUME_HEIGHT }}>
            <AlertCircle className="size-5 text-amber-500" />
            Data intraday belum tersedia untuk {ticker}. Coba rentang 1W atau lebih.
          </div>
        ) : points.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 text-sm text-(--sv-muted)" style={{ height: height + VOLUME_HEIGHT }}>
            <CandlestickChart className="size-6" />
            Belum ada data harga.
          </div>
        ) : (
          <div className="px-1 pt-2" onMouseLeave={() => setHoverIndex(null)}>
            <ResponsiveContainer width="100%" height={height}>
              <ComposedChart data={points} syncId={`sv-${ticker}`} margin={{ top: 8, right: 0, left: 8, bottom: 0 }} onMouseMove={onMove}>
                <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
                <XAxis dataKey="label" hide />
                <YAxis
                  orientation="right"
                  domain={domain}
                  width={Y_WIDTH}
                  tick={{ fontSize: 11, fill: AXIS }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => fmtNum(v)}
                  allowDataOverflow
                />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: AXIS, strokeDasharray: '4 3' }} isAnimationActive={false} />
                {isIntraday ? (
                  <Line dataKey="close" stroke="#2563eb" strokeWidth={1.75} dot={false} isAnimationActive={false} />
                ) : (
                  <Bar dataKey="range" shape={<Candle />} isAnimationActive={false} />
                )}
                {INDICATORS.map((ind) =>
                  indicators[ind.key] ? (
                    <Line
                      key={ind.key}
                      dataKey={ind.key}
                      stroke={ind.color}
                      strokeWidth={ind.key === 'vwap' ? 1.25 : 1.5}
                      strokeDasharray={ind.key === 'vwap' ? '5 4' : undefined}
                      dot={false}
                      activeDot={false}
                      connectNulls
                      isAnimationActive={false}
                    />
                  ) : null,
                )}
                <ReferenceLine
                  y={currentPrice}
                  stroke={lastUp ? UP : DOWN}
                  strokeDasharray="2 3"
                  label={<PriceTag value={currentPrice} up={lastUp} />}
                />
              </ComposedChart>
            </ResponsiveContainer>

            <div className="flex items-center gap-2 px-2 pt-1 text-xs text-(--sv-muted)">
              Volume <span className="font-semibold tabular-nums text-(--sv-text)">{fmtCompact(shown?.volume)}</span>
              {volumeAvg > 0 && shown && (
                <span className="tabular-nums">· {fmtNum(shown.volume / volumeAvg, 1)}x rata-rata periode</span>
              )}
            </div>
            <ResponsiveContainer width="100%" height={VOLUME_HEIGHT}>
              <ComposedChart data={points} syncId={`sv-${ticker}`} margin={{ top: 4, right: 0, left: 8, bottom: 0 }} onMouseMove={onMove}>
                <XAxis
                  dataKey="label"
                  interval={tickInterval}
                  tick={{ fontSize: 11, fill: AXIS }}
                  tickLine={false}
                  axisLine={{ stroke: GRID }}
                  minTickGap={16}
                />
                <YAxis orientation="right" width={Y_WIDTH} tick={{ fontSize: 10, fill: AXIS }} tickLine={false} axisLine={false} tickFormatter={(v: number) => fmtCompact(v)} tickCount={3} />
                <Tooltip content={() => null} cursor={{ fill: 'rgba(148,163,184,0.12)' }} isAnimationActive={false} />
                <Bar dataKey="volume" isAnimationActive={false} maxBarSize={10}>
                  {points.map((p, i) => (
                    <Cell key={i} fill={p.close >= p.open ? UP : DOWN} fillOpacity={0.45} />
                  ))}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
      <p className="text-[11px] text-(--sv-muted)">
        {isIntraday
          ? 'Data intraday tertunda (delayed) dari Yahoo Finance, bukan real-time.'
          : 'Candle harian (EOD). EMA dihitung dari seluruh histori; VWAP ter-anchor dari awal rentang yang ditampilkan.'}
      </p>
    </Card>
  );
}

export function PriceChartSkeleton() {
  return (
    <Card className="p-5">
      <div className="mb-4 h-5 w-32 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
      <div className="mb-3 h-8 w-72 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
      <div className="h-[436px] animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
    </Card>
  );
}
