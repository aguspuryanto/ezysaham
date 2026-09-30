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
import { LineChart } from 'lucide-react';
import { OHLCVBar } from '@/domain/models/History';
import { getStockHistory } from '@/data/repositories/StockRepository';
import { cn } from '@/lib/format';
import { Card, Skeleton } from '@/presentation/features/screener/detail/components/ui';

type Mode = 'absolute' | 'percent';

export const COLOR_A = '#3b82f6'; // blue — ticker A
export const COLOR_B = '#10b981'; // emerald — ticker B

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
    <div className="min-w-[160px] space-y-1.5 rounded-lg border border-(--sv-border) bg-(--sv-surface) p-3 text-xs shadow-lg">
      <p className="border-b border-(--sv-border) pb-1 font-semibold text-(--sv-text)">{label}</p>
      {map.a != null && (
        <div className="flex justify-between gap-3">
          <span style={{ color: COLOR_A }} className="font-semibold">{tickerA}</span>
          <span className="tabular-nums text-(--sv-text)">{fmt(map.a)}</span>
        </div>
      )}
      {map.b != null && (
        <div className="flex justify-between gap-3">
          <span style={{ color: COLOR_B }} className="font-semibold">{tickerB}</span>
          <span className="tabular-nums text-(--sv-text)">{fmt(map.b)}</span>
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
  const pairKey = `${tickerA}|${tickerB}`;
  const [loaded, setLoaded] = useState<{ key: string; a: OHLCVBar[]; b: OHLCVBar[] } | null>(null);
  const loading = loaded?.key !== pairKey;
  const barsA = useMemo(() => (loading ? [] : loaded.a), [loading, loaded]);
  const barsB = useMemo(() => (loading ? [] : loaded.b), [loading, loaded]);
  const [mode, setMode] = useState<Mode>('absolute');

  useEffect(() => {
    let cancelled = false;
    Promise.all([getStockHistory(tickerA, '1y'), getStockHistory(tickerB, '1y')]).then(([a, b]) => {
      if (!cancelled) setLoaded({ key: `${tickerA}|${tickerB}`, a, b });
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
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-(--sv-border) px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold text-(--sv-text)">
            <LineChart className="size-4.5 text-(--sv-primary)" strokeWidth={2} />
            Perbandingan Harga <span className="text-xs font-normal text-(--sv-muted)">· 1 tahun</span>
          </h2>
          <div className="flex items-center gap-3 text-xs font-medium text-(--sv-text)">
            <span className="flex items-center gap-1.5"><span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: COLOR_A }} />{tickerA}</span>
            <span className="flex items-center gap-1.5"><span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: COLOR_B }} />{tickerB}</span>
          </div>
        </div>

        <div role="group" aria-label="Mode grafik" className="flex gap-0.5 rounded-lg border border-(--sv-border) bg-(--sv-bg) p-0.5">
          {(['absolute', 'percent'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                mode === m ? 'bg-(--sv-surface) text-(--sv-text) shadow-sm' : 'text-(--sv-muted) hover:text-(--sv-text)',
              )}
            >
              {m === 'absolute' ? 'Harga' : '% Perubahan'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="p-4"><Skeleton className="h-[320px] w-full rounded-lg" /></div>
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
    </Card>
  );
}
