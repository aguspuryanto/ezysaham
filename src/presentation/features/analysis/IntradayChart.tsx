'use client';

/**
 * IntradayChart.tsx
 *
 * Yahoo Finance-style "1D" view: a smooth gradient area chart built from 1-minute
 * bars for the current/last trading session, with a dashed previous-close
 * reference line. Modeled on IhsgChart.tsx's AreaChart pattern. Independently
 * fetched/polled (bypasses the whole-page 15-min analysis cache) since this is
 * fast-changing, tab-scoped data — same reasoning as IhsgChart for IHSG.
 *
 * Data is Yahoo's own unofficial, unauthenticated chart endpoint — a delayed
 * quote, not real-time. Never label it "LIVE" (see dataFreshness.ts convention).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { getStockIntraday } from '@/data/repositories/StockRepository';
import { IntradayResponse } from '@/domain/models/Intraday';
import { cn, formatPercent, formatRupiah } from '@/lib/format';

const REFRESH_MS = 60_000;

interface IntradayChartProps {
  ticker: string;
  fallbackPrevClose?: number;
}

function timeLabel(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  });
}

function sessionDateLabel(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  });
}

type SessionState = 'before' | 'regular' | 'after' | 'unknown';

function sessionState(session: IntradayResponse['session']): SessionState {
  if (!session) return 'unknown';
  const now = Date.now() / 1000;
  if (now < session.regularStart) return 'before';
  if (now <= session.regularEnd) return 'regular';
  return 'after';
}

const SESSION_LABEL: Record<SessionState, string> = {
  before: 'Sebelum sesi',
  regular: 'Sesi berjalan',
  after: 'Sesi ditutup',
  unknown: 'Status sesi tidak diketahui',
};

export function IntradayChart({ ticker, fallbackPrevClose }: IntradayChartProps) {
  const [data, setData] = useState<IntradayResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const isMountedRef = useRef(true);

  const fetchIntraday = useCallback(async (isBackground: boolean) => {
    if (!isBackground) setLoading(true);
    const result = await getStockIntraday(ticker);
    if (!isMountedRef.current) return;
    setData(result);
    if (!isBackground) setLoading(false);
  }, [ticker]);

  useEffect(() => {
    isMountedRef.current = true;
    fetchIntraday(false);
    const interval = setInterval(() => fetchIntraday(true), REFRESH_MS);
    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
    };
  }, [fetchIntraday]);

  const bars = data?.bars ?? [];
  const previousClose = data?.previousClose ?? fallbackPrevClose;

  const chartData = useMemo(
    () => bars.map((b) => ({ time: timeLabel(b.time), price: b.price, volume: b.volume })),
    [bars]
  );

  const lastBar = bars[bars.length - 1];
  const lastPrice = lastBar?.price;
  const change = lastPrice != null && previousClose != null ? lastPrice - previousClose : undefined;
  const changePct = change != null && previousClose ? (change / previousClose) * 100 : undefined;
  const isUp = (change ?? 0) >= 0;
  const lineColor = isUp ? '#10b981' : '#f43f5e';

  const domainMin = useMemo(() => {
    const values = bars.map((b) => b.price);
    if (previousClose != null) values.push(previousClose);
    return values.length ? Math.min(...values) * 0.999 : 0;
  }, [bars, previousClose]);
  const domainMax = useMemo(() => {
    const values = bars.map((b) => b.price);
    if (previousClose != null) values.push(previousClose);
    return values.length ? Math.max(...values) * 1.001 : 0;
  }, [bars, previousClose]);

  const state = sessionState(data?.session);
  const hasData = data?.ok && bars.length > 0;

  return (
    <div>
      {/* Header: big price + change + session-state pill */}
      <div className="px-4 pt-3 pb-2 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          {hasData && lastPrice != null ? (
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
                {formatRupiah(lastPrice)}
              </span>
              {change != null && changePct != null && (
                <span
                  className={cn(
                    'text-sm font-semibold tabular-nums',
                    isUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                  )}
                >
                  {isUp ? '+' : ''}
                  {formatRupiah(change)} ({formatPercent(changePct)})
                </span>
              )}
            </div>
          ) : (
            <div className="h-8 w-40 animate-pulse bg-zinc-100 dark:bg-zinc-800" />
          )}
          {lastBar && (
            <p className="mt-0.5 text-[11px] font-semibold text-zinc-400 dark:text-zinc-500">
              Sesi {sessionDateLabel(lastBar.time)}
            </p>
          )}
        </div>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase text-zinc-500 dark:text-zinc-400">
          <span className="size-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500" />
          {SESSION_LABEL[state]}
        </span>
      </div>

      {/* Chart */}
      <div className="px-2 pt-1 pb-1">
        {loading && chartData.length === 0 ? (
          <div className="flex h-72 items-center justify-center text-sm font-semibold text-zinc-400 dark:text-zinc-500">
            Memuat data intraday...
          </div>
        ) : !hasData ? (
          <div className="flex h-72 flex-col items-center justify-center gap-1 text-center text-sm font-semibold text-zinc-400 dark:text-zinc-500">
            <p>Data intraday tidak tersedia saat ini.</p>
            <p className="text-xs">Coba beberapa saat lagi, atau gunakan tab 1W/1M untuk riwayat harian.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={chartData} margin={{ top: 4, right: 84, left: 0, bottom: 0 }}>
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10, fill: '#71717a', fontWeight: 600 }}
                tickLine={false}
                axisLine={false}
                interval={Math.max(Math.floor(chartData.length / 6), 0)}
                minTickGap={24}
              />
              <YAxis domain={[domainMin, domainMax]} hide />
              <Tooltip
                formatter={(value) => [formatRupiah(Number(value)), 'Harga']}
                labelStyle={{ fontSize: 11, fontWeight: 700 }}
                contentStyle={{ fontSize: 11, borderRadius: 0, border: '2px solid #0a0a0a', boxShadow: '3px 3px 0 0 #0a0a0a' }}
              />
              {previousClose != null && (
                <ReferenceLine
                  y={previousClose}
                  stroke="#71717a"
                  strokeDasharray="4 4"
                  strokeWidth={1}
                  label={{ value: 'Tutup sebelumnya', position: 'right', fontSize: 10, fill: '#71717a' }}
                />
              )}
              <Area
                type="monotone"
                dataKey="price"
                stroke={lineColor}
                strokeWidth={3}
                fill={lineColor}
                fillOpacity={0.18}
                isAnimationActive={false}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Footer caption */}
      <p className="px-4 pb-3 text-[10px] font-semibold text-zinc-400 dark:text-zinc-600">
        Data intraday 1 menit dari Yahoo Finance — kuotasi tertunda (delayed quote), bukan real-time. Diperbarui otomatis setiap ±60 detik.
      </p>
    </div>
  );
}
