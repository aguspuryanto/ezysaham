'use client';

/**
 * IhsgChart.tsx
 *
 * IHSG (Jakarta Composite Index) mini overview card: last value, change vs.
 * the start of the selected range, and an area chart with range tabs.
 * Includes automatic background refresh every 15 minutes.
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { getIhsgHistory } from '@/data/repositories/MarketRepository';
import { OHLCVBar } from '@/domain/models/History';
import { computeMarketRegime, MarketRegimeEma, MarketRegimeResult } from '@/domain/analysis/marketRegimeEngine';
import { cn, formatPercent } from '@/lib/format';

/** Needs 200+ daily bars to seed EMA200 — '1y' gives ~250 trading days, independent of the chart's own range selector. */
const REGIME_RANGE = '1y';

const RANGES = [
  { key: '5d', label: '1W' },
  { key: '1mo', label: '1M' },
  { key: '3mo', label: '3M' },
  { key: '1y', label: '1Y' },
  { key: '5y', label: '5Y' },
  { key: 'max', label: 'MAX' },
] as const;
type RangeKey = (typeof RANGES)[number]['key'];

/** Ranges short enough that day-level tick labels stay distinguishable; longer ranges switch to month/year. */
const DAY_LEVEL_RANGES: RangeKey[] = ['5d', '1mo', '3mo'];

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

/**
 * Determines whether the IDX (BEI) market is currently open.
 * Trading hours (WIB / UTC+7):
 *   Sesi I  : Mon–Fri 09:00 – 11:30
 *   Sesi II : Mon–Fri 13:30 – 15:50
 * Pre-opening : 08:45 – 09:00 (included as "open" for UX purposes)
 */
function isIdxOpen(now: Date): boolean {
  // Convert to WIB (UTC+7)
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const day = wib.getUTCDay(); // 0 = Sun, 6 = Sat
  if (day === 0 || day === 6) return false;

  const h = wib.getUTCHours();
  const m = wib.getUTCMinutes();
  const totalMin = h * 60 + m;

  const PRE_OPEN = 8 * 60 + 45;  // 08:45
  const S1_CLOSE = 11 * 60 + 30; // 11:30
  const S2_OPEN = 13 * 60 + 30; // 13:30
  const S2_CLOSE = 15 * 60 + 50; // 15:50

  return (
    (totalMin >= PRE_OPEN && totalMin < S1_CLOSE) ||
    (totalMin >= S2_OPEN && totalMin < S2_CLOSE)
  );
}

function useMarketStatus() {
  const [open, setOpen] = useState(() => isIdxOpen(new Date()));
  useEffect(() => {
    const tick = () => setOpen(isIdxOpen(new Date()));
    const id = setInterval(tick, 60_000); // recheck every minute
    return () => clearInterval(id);
  }, []);
  return open;
}

function shortDate(dateStr: string, range: RangeKey): string {
  try {
    const d = new Date(dateStr);
    if (DAY_LEVEL_RANGES.includes(range)) return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    return d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });
  } catch {
    return dateStr;
  }
}

function fmtIndex(n: number): string {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(n);
}

function EmaTrendRow({ label, ema }: { label: string; ema: MarketRegimeEma }) {
  const Icon = ema.rising ? ChevronUp : ChevronDown;
  return (
    <div className="flex items-center justify-between gap-2 text-[11px]">
      <span className="font-semibold text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className={cn(
        'flex items-center gap-0.5 font-mono font-bold',
        ema.rising ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
      )}>
        {fmtIndex(ema.value)}
        <Icon className="size-3" strokeWidth={3} />
      </span>
    </div>
  );
}

function MarketRegimeBadge({ regime }: { regime: MarketRegimeResult }) {
  const toneMap = {
    bullish: {
      badge: 'bg-emerald-600 text-white',
      icon: '🟢',
    },
    neutral: {
      badge: 'bg-amber-500 text-white',
      icon: '🟡',
    },
    bearish: {
      badge: 'bg-rose-600 text-white',
      icon: '🔴',
    },
  } as const;
  const tone = toneMap[regime.regime];

  return (
    <div className="neo-border bg-zinc-50 p-3 dark:bg-zinc-800/60">
      <div className="flex items-center justify-between gap-2">
        <span className={cn('neo-border px-2.5 py-1 text-xs font-bold tracking-wide', tone.badge)}>
          {tone.icon} {regime.label}
        </span>
        <span className="font-mono text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
          RSI {fmtIndex(regime.rsi14)} · MACD {regime.macdBullish ? 'Bullish' : 'Bearish'}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
        <EmaTrendRow label="EMA 9" ema={regime.ema9} />
        <EmaTrendRow label="EMA 21" ema={regime.ema21} />
        <EmaTrendRow label="EMA 50" ema={regime.ema50} />
        <EmaTrendRow label="EMA 200" ema={regime.ema200} />
      </div>
    </div>
  );
}

export function IhsgChart() {
  const marketOpen = useMarketStatus();
  const [range, setRange] = useState<RangeKey>('1mo');
  const [cache, setCache] = useState<Partial<Record<RangeKey, OHLCVBar[]>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchIhsg = useCallback(async (selectedRange: RangeKey, isBackground = false) => {
    if (!isBackground && !cache[selectedRange]) {
      setLoading(true);
    }
    try {
      const bars = await getIhsgHistory(selectedRange);
      if (bars.length > 0) {
        setCache((c) => ({ ...c, [selectedRange]: bars }));
        setError(false);
      } else if (!cache[selectedRange]) {
        setError(true);
      }
    } catch {
      if (!cache[selectedRange]) {
        setError(true);
      }
    } finally {
      if (!isBackground) {
        setLoading(false);
      }
    }
  }, [cache]);

  // Fetch when range changes or initial mount
  useEffect(() => {
    fetchIhsg(range, false);
  }, [range]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh IHSG history every 15 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      fetchIhsg(range, true);
    }, FIFTEEN_MINUTES_MS);

    return () => clearInterval(interval);
  }, [range, fetchIhsg]);

  // Market Regime needs 200+ daily bars to seed EMA200, independent of whatever
  // display range the user picked for the chart itself — fetched separately.
  // Deliberately mount-only: fetchIhsg's identity changes every time `cache`
  // updates, so depending on it here would refetch in a loop.
  useEffect(() => {
    fetchIhsg(REGIME_RANGE, true);
    const interval = setInterval(() => fetchIhsg(REGIME_RANGE, true), FIFTEEN_MINUTES_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const regimeBars = cache[REGIME_RANGE];
  const marketRegime = useMemo(() => (regimeBars ? computeMarketRegime(regimeBars) : null), [regimeBars]);

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
    <div className="mb-4 neo-border neo-shadow bg-white p-4 dark:bg-zinc-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex flex-wrap items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            <span>IHSG</span>
            <span className="text-zinc-300 dark:text-zinc-600">·</span>
            <span>{last?.date ? new Date(last.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '–'}</span>
            <span className="text-zinc-300 dark:text-zinc-600">·</span>
            <span
              className={cn(
                'inline-flex items-center gap-1',
                marketOpen ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400 dark:text-zinc-500'
              )}
            >
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  marketOpen
                    ? 'animate-pulse bg-emerald-500'
                    : 'bg-zinc-400 dark:bg-zinc-500'
                )}
              />
              {marketOpen ? 'Market Open' : 'Market Close'}
            </span>
          </p>
          {last ? (
            <>
              <div className="mt-0.5 flex items-baseline gap-2">
                <span className="text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
                  {fmtIndex(last.close)}
                </span>
                <span
                  className={cn(
                    'text-sm font-bold tabular-nums',
                    isUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                  )}
                >
                  {isUp ? '+' : ''}
                  {fmtIndex(change)} ({formatPercent(changePct)})
                </span>
              </div>
              <p className="mt-1 font-mono text-[11px] font-semibold tabular-nums text-zinc-500 dark:text-zinc-400">
                Open: {fmtIndex(last.open)} · High: {fmtIndex(last.high)} · Low: {fmtIndex(last.low)} · Close: {fmtIndex(last.close)}
              </p>
            </>
          ) : (
            <div className="mt-1 h-8 w-40 animate-pulse bg-zinc-100 dark:bg-zinc-800" />
          )}
        </div>

        <div className="flex gap-1 neo-border neo-shadow-sm bg-white p-1 dark:bg-zinc-900">
          {RANGES.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setRange(key)}
              className={cn(
                'px-2.5 py-1 text-xs font-bold transition-colors',
                range === key
                  ? 'bg-(--neo-accent) text-black'
                  : 'text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* {marketRegime && (
        <div className="mt-3">
          <MarketRegimeBadge regime={marketRegime} />
        </div>
      )} */}

      <div className="mt-3">
        {error ? (
          <div className="flex h-56 items-center justify-center text-sm font-semibold text-zinc-400 dark:text-zinc-500">
            Gagal memuat data IHSG.
          </div>
        ) : loading && chartData.length === 0 ? (
          <div className="flex h-56 items-center justify-center text-sm font-semibold text-zinc-400 dark:text-zinc-500">
            Memuat grafik...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={224}>
            <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="ihsgAreaFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={lineColor} stopOpacity={0.12} />
                  <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                horizontal
                vertical={false}
                stroke="#71717a"
                strokeOpacity={0.15}
                strokeDasharray="0"
              />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: '#71717a', fontWeight: 600 }}
                tickLine={false}
                axisLine={false}
                interval={Math.max(Math.floor(chartData.length / 6), 0)}
                minTickGap={24}
              />
              <YAxis
                domain={[domainMin, domainMax]}
                tick={{ fontSize: 10, fill: '#71717a', fontWeight: 600 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => fmtIndex(Number(v))}
                width={52}
              />
              <Tooltip
                formatter={(value) => [fmtIndex(Number(value)), 'IHSG']}
                labelStyle={{ fontSize: 11, fontWeight: 700 }}
                contentStyle={{ fontSize: 11, borderRadius: 0, border: '2px solid #0a0a0a', boxShadow: '3px 3px 0 0 #0a0a0a' }}
              />
              <Area
                type="linear"
                dataKey="close"
                stroke={lineColor}
                strokeWidth={2}
                fill="url(#ihsgAreaFill)"
                isAnimationActive={true}
                dot={false}
                activeDot={{ r: 3, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
