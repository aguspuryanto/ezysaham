'use client';

/**
 * IhsgChart.tsx
 *
 * IHSG (Jakarta Composite Index) mini overview card: last value, change vs.
 * the start of the selected range, and an area chart with range tabs.
 */

import { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { getIhsgHistory } from '@/data/repositories/MarketRepository';
import { OHLCVBar } from '@/domain/models/History';
import { cn, formatPercent } from '@/lib/format';

const RANGES = [
  { key: '1mo', label: '1 bulan' },
  { key: '1y', label: '1 tahun' },
  { key: '5y', label: '5 tahun' },
  { key: 'max', label: 'Maks' },
] as const;
type RangeKey = (typeof RANGES)[number]['key'];

function shortDate(dateStr: string, range: RangeKey): string {
  try {
    const d = new Date(dateStr);
    if (range === '1mo') return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    return d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });
  } catch {
    return dateStr;
  }
}

function fmtIndex(n: number): string {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(n);
}

export function IhsgChart() {
  const [range, setRange] = useState<RangeKey>('1mo');
  const [cache, setCache] = useState<Partial<Record<RangeKey, OHLCVBar[]>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (cache[range]) return;
    let cancelled = false;
    setLoading(true);
    setError(false);
    getIhsgHistory(range)
      .then((bars) => {
        if (cancelled) return;
        if (bars.length === 0) {
          setError(true);
          return;
        }
        setCache((c) => ({ ...c, [range]: bars }));
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range, cache]);

  const bars = cache[range] ?? [];
  const chartData = useMemo(
    () => bars.map((b) => ({ date: shortDate(b.date, range), close: b.close })),
    [bars, range]
  );

  const first = bars[0];
  const last = bars[bars.length - 1];
  const change = last && first ? last.close - first.close : 0;
  const changePct = last && first && first.close !== 0 ? (change / first.close) * 100 : 0;
  const isUp = change >= 0;
  const lineColor = isUp ? '#10b981' : '#f43f5e';

  const domainMin = useMemo(
    () => (bars.length ? Math.min(...bars.map((b) => b.close)) * 0.995 : 0),
    [bars]
  );
  const domainMax = useMemo(
    () => (bars.length ? Math.max(...bars.map((b) => b.close)) * 1.005 : 0),
    [bars]
  );

  return (
    <div className="mb-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            IHSG: {new Date(last?.date).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
          {last ? (
            <div className="mt-0.5 flex items-baseline gap-2">
              <span className="text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
                {fmtIndex(last.close)}
              </span>
              <span
                className={cn(
                  'text-sm font-semibold tabular-nums',
                  isUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                )}
              >
                {isUp ? '+' : ''}
                {fmtIndex(change)} ({formatPercent(changePct)})
              </span>
            </div>
          ) : (
            <div className="mt-1 h-8 w-40 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
          )}
        </div>

        <div className="flex gap-0.5 rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-700">
          {RANGES.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setRange(key)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-semibold transition-colors',
                range === key
                  ? 'bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900'
                  : 'text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3">
        {error ? (
          <div className="flex h-56 items-center justify-center text-sm text-zinc-400 dark:text-zinc-500">
            Gagal memuat data IHSG.
          </div>
        ) : loading && chartData.length === 0 ? (
          <div className="flex h-56 items-center justify-center text-sm text-zinc-400 dark:text-zinc-500">
            Memuat grafik...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={224}>
            <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="ihsgFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={lineColor} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: '#71717a' }}
                tickLine={false}
                axisLine={false}
                interval={Math.max(Math.floor(chartData.length / 6), 0)}
                minTickGap={24}
              />
              <YAxis domain={[domainMin, domainMax]} hide />
              <Tooltip
                formatter={(value) => [fmtIndex(Number(value)), 'IHSG']}
                labelStyle={{ fontSize: 11 }}
                contentStyle={{ fontSize: 11, borderRadius: 8 }}
              />
              <Area
                type="monotone"
                dataKey="close"
                stroke={lineColor}
                strokeWidth={2}
                fill="url(#ihsgFill)"
                isAnimationActive={false}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
