'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Loader2 } from 'lucide-react';
import { OHLCVBar } from '@/domain/models/History';
import { getStockHistory } from '@/data/repositories/StockRepository';
import { cn } from '@/lib/format';

type Mode = 'absolute' | 'percent';

const COLOR_A = '#3b82f6'; // blue — ticker A
const COLOR_B = '#10b981'; // emerald — ticker B

function shortDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  } catch {
    return dateStr.slice(5);
  }
}

function fmtRp(n: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
}

interface ChartPoint {
  date: string;
  label: string;
  a?: number;
  b?: number;
}

function CompareTooltip({
  active, payload, label, mode, tickerA, tickerB,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number }>;
  label?: string;
  mode: Mode;
  tickerA: string;
  tickerB: string;
}) {
  if (!active || !payload?.length) return null;
  const map: Record<string, number> = {};
  for (const p of payload) if (p.value != null && !Number.isNaN(p.value)) map[p.dataKey] = p.value;

  const fmt = (v: number) => (mode === 'percent' ? `${v >= 0 ? '+' : ''}${v.toFixed(2)}%` : fmtRp(v));

  return (
    <div className="neo-border neo-shadow-sm bg-white dark:bg-zinc-900 p-3 text-xs space-y-1.5 min-w-[160px]">
      <p className="font-bold text-zinc-700 dark:text-zinc-200 pb-1 border-b-2 border-(--neo-line)">{label}</p>
      {map.a != null && (
        <div className="flex justify-between gap-3">
          <span style={{ color: COLOR_A }} className="font-semibold">{tickerA}</span>
          <span className="font-mono tabular-nums text-zinc-700 dark:text-zinc-200">{fmt(map.a)}</span>
        </div>
      )}
      {map.b != null && (
        <div className="flex justify-between gap-3">
          <span style={{ color: COLOR_B }} className="font-semibold">{tickerB}</span>
          <span className="font-mono tabular-nums text-zinc-700 dark:text-zinc-200">{fmt(map.b)}</span>
        </div>
      )}
    </div>
  );
}

interface PriceComparisonChartProps {
  tickerA: string;
  tickerB: string;
}

export function PriceComparisonChart({ tickerA, tickerB }: PriceComparisonChartProps) {
  const [barsA, setBarsA] = useState<OHLCVBar[]>([]);
  const [barsB, setBarsB] = useState<OHLCVBar[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>('absolute');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([getStockHistory(tickerA, '1y'), getStockHistory(tickerB, '1y')]).then(([a, b]) => {
      if (cancelled) return;
      setBarsA(a);
      setBarsB(b);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [tickerA, tickerB]);

  const chartData: ChartPoint[] = useMemo(() => {
    const firstA = barsA[0]?.close;
    const firstB = barsB[0]?.close;
    const map = new Map<string, ChartPoint>();

    for (const bar of barsA) {
      const point = map.get(bar.date) ?? { date: bar.date, label: shortDate(bar.date) };
      point.a = mode === 'percent' && firstA ? ((bar.close - firstA) / firstA) * 100 : bar.close;
      map.set(bar.date, point);
    }
    for (const bar of barsB) {
      const point = map.get(bar.date) ?? { date: bar.date, label: shortDate(bar.date) };
      point.b = mode === 'percent' && firstB ? ((bar.close - firstB) / firstB) * 100 : bar.close;
      map.set(bar.date, point);
    }

    return Array.from(map.values()).sort((x, y) => x.date.localeCompare(y.date));
  }, [barsA, barsB, mode]);

  return (
    <div className="neo-border neo-shadow bg-white dark:bg-zinc-900 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-3 pb-2 border-b-[3px] border-(--neo-line)">
        <div className="flex items-center gap-3">
          <p className="text-xs font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Perbandingan Harga
          </p>
          <div className="flex items-center gap-2 text-[11px] font-semibold">
            <span className="flex items-center gap-1">
              <span className="inline-block size-2 border border-(--neo-line)" style={{ backgroundColor: COLOR_A }} />
              {tickerA}
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block size-2 border border-(--neo-line)" style={{ backgroundColor: COLOR_B }} />
              {tickerB}
            </span>
          </div>
        </div>

        <div className="flex gap-0.5 neo-border p-0.5">
          {(['absolute', 'percent'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                'px-2.5 py-1 text-[11px] font-bold uppercase transition-colors',
                mode === m
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                  : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              )}
            >
              {m === 'absolute' ? 'Absolute' : '% Change'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-24 text-sm font-semibold text-zinc-400">
          <Loader2 className="size-4 animate-spin text-emerald-500" /> Memuat data harga…
        </div>
      ) : (
        <div className="px-2 pt-2 pb-3">
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(113,113,122,0.12)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: '#71717a' }}
                tickLine={false}
                axisLine={false}
                interval={Math.floor(chartData.length / 8)}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#71717a' }}
                tickLine={false}
                axisLine={false}
                width={56}
                tickFormatter={(v) =>
                  mode === 'percent'
                    ? `${v.toFixed(0)}%`
                    : new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 0 }).format(v)
                }
              />
              <Tooltip
                content={<CompareTooltip mode={mode} tickerA={tickerA} tickerB={tickerB} />}
                cursor={{ stroke: 'rgba(113,113,122,0.3)', strokeWidth: 1, strokeDasharray: '4 2' }}
              />
              <Line
                type="monotone"
                dataKey="a"
                name={tickerA}
                stroke={COLOR_A}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="b"
                name={tickerB}
                stroke={COLOR_B}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
