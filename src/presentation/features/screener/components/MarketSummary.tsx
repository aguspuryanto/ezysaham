'use client';

/**
 * MarketSummary.tsx
 *
 * Top-of-screener market cards: IHSG, LQ45, USD/IDR (Yahoo daily bars via /api/market/*),
 * Market Breadth (from the already-loaded stock summaries) and a 3-month IHSG chart with the
 * existing market regime read. Missing series render "--", never placeholder numbers.
 */

import { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { getIhsgHistory, getMarketSeriesHistory } from '@/data/repositories/MarketRepository';
import { computeMarketRegime } from '@/domain/analysis/marketRegimeEngine';
import { OHLCVBar } from '@/domain/models/History';
import { StockSummary } from '@/domain/models/Stock';
import { cn } from '@/lib/format';

export interface MarketSeriesSnapshot {
  value: number;
  change: number;
  changePct: number;
  high: number;
  low: number;
  closes: number[];
}

const SPARK_BARS = 22;
const CHART_BARS = 66;

function snapshot(bars: OHLCVBar[]): MarketSeriesSnapshot | null {
  const valid = bars.filter((b) => Number.isFinite(b.close) && b.close > 0);
  if (valid.length < 2) return null;
  const last = valid[valid.length - 1];
  const prev = valid[valid.length - 2];
  return {
    value: last.close,
    change: last.close - prev.close,
    changePct: ((last.close - prev.close) / prev.close) * 100,
    high: last.high,
    low: last.low,
    closes: valid.slice(-SPARK_BARS).map((b) => b.close),
  };
}

type LoadState<T> = { status: 'loading' } | { status: 'ready'; data: T };

/** IHSG (1y — also feeds the regime), LQ45 and USD/IDR, fetched once per page load. */
export function useMarketSeries() {
  const [state, setState] = useState<LoadState<{ ihsg: OHLCVBar[]; lq45: OHLCVBar[]; usdidr: OHLCVBar[] }>>({ status: 'loading' });
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getIhsgHistory('1y').catch(() => []),
      getMarketSeriesHistory('lq45', '1mo'),
      getMarketSeriesHistory('usdidr', '1mo'),
    ]).then(([ihsg, lq45, usdidr]) => {
      if (!cancelled) setState({ status: 'ready', data: { ihsg, lq45, usdidr } });
    });
    return () => { cancelled = true; };
  }, []);

  return useMemo(() => {
    if (state.status === 'loading') return { loading: true as const, ihsg: null, lq45: null, usdidr: null, ihsgBars: [] as OHLCVBar[] };
    const { ihsg, lq45, usdidr } = state.data;
    return { loading: false as const, ihsg: snapshot(ihsg), lq45: snapshot(lq45), usdidr: snapshot(usdidr), ihsgBars: ihsg };
  }, [state]);
}

const idNum = (n: number, dec = 2) => n.toLocaleString('id-ID', { minimumFractionDigits: dec, maximumFractionDigits: dec });

function Sparkline({ values, up }: { values: number[]; up: boolean }) {
  if (values.length < 2) return null;
  const w = 88;
  const h = 32;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - min) / span) * (h - 4) - 2}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden="true" className={up ? 'text-emerald-500' : 'text-rose-500'}>
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('rounded-xl border border-(--sv-border) bg-(--sv-surface) p-4 shadow-(--sv-shadow)', className)}>
      {children}
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="space-y-2.5">
      <div className="h-3.5 w-16 animate-pulse rounded bg-slate-200/70 dark:bg-slate-700/50" />
      <div className="h-6 w-28 animate-pulse rounded bg-slate-200/70 dark:bg-slate-700/50" />
      <div className="h-3 w-24 animate-pulse rounded bg-slate-200/70 dark:bg-slate-700/50" />
    </div>
  );
}

function SeriesCard({ title, data, loading, dec = 2 }: { title: string; data: MarketSeriesSnapshot | null; loading: boolean; dec?: number }) {
  const up = data != null && data.change >= 0;
  return (
    <Card>
      {loading ? <CardSkeleton /> : (
        <>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-(--sv-text)">{title}</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-(--sv-text) sm:text-2xl">{data ? idNum(data.value, dec) : '--'}</p>
            </div>
            {data && <Sparkline values={data.closes} up={up} />}
          </div>
          <p className={cn('mt-1 text-sm font-medium tabular-nums', data == null ? 'text-(--sv-muted)' : up ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
            {data ? `${up ? '▲' : '▼'} ${up ? '+' : ''}${idNum(data.change, dec)} (${up ? '+' : ''}${idNum(data.changePct)}%)` : 'Data tidak tersedia'}
          </p>
          {data && (
            <p className="mt-2 text-xs tabular-nums text-(--sv-muted)">
              High <span className="text-(--sv-text)">{idNum(data.high, dec)}</span>
              <span className="mx-1.5">·</span>
              Low <span className="text-(--sv-text)">{idNum(data.low, dec)}</span>
            </p>
          )}
        </>
      )}
    </Card>
  );
}

function BreadthCard({ summaries }: { summaries: StockSummary[] | null }) {
  const breadth = useMemo(() => {
    if (!summaries) return null;
    let up = 0, down = 0, flat = 0;
    for (const s of summaries) {
      if (s.percentChange1D > 0) up++;
      else if (s.percentChange1D < 0) down++;
      else flat++;
    }
    return { up, down, flat, total: up + down + flat };
  }, [summaries]);

  return (
    <Card>
      <p className="text-sm font-semibold text-(--sv-text)">Market Breadth</p>
      {!breadth ? <div className="mt-3"><CardSkeleton /></div> : (
        <>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div><p className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{breadth.up}</p><p className="text-xs text-(--sv-muted)">Naik</p></div>
            <div><p className="text-lg font-bold tabular-nums text-rose-600 dark:text-rose-400">{breadth.down}</p><p className="text-xs text-(--sv-muted)">Turun</p></div>
            <div><p className="text-lg font-bold tabular-nums text-(--sv-text)">{breadth.flat}</p><p className="text-xs text-(--sv-muted)">Stagnan</p></div>
          </div>
          <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" role="img" aria-label={`${breadth.up} naik, ${breadth.down} turun, ${breadth.flat} stagnan`}>
            <span className="bg-emerald-500" style={{ width: `${(breadth.up / breadth.total) * 100}%` }} />
            <span className="bg-rose-500" style={{ width: `${(breadth.down / breadth.total) * 100}%` }} />
          </div>
        </>
      )}
    </Card>
  );
}

function IhsgMovementCard({ bars, loading }: { bars: OHLCVBar[]; loading: boolean }) {
  const data = useMemo(() => bars.slice(-CHART_BARS).map((b) => ({
    date: new Date(b.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
    close: b.close,
  })), [bars]);
  const regime = useMemo(() => (bars.length ? computeMarketRegime(bars) : null), [bars]);
  const up = data.length > 1 && data[data.length - 1].close >= data[0].close;
  const color = up ? '#10b981' : '#f43f5e';

  return (
    <Card className="col-span-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-(--sv-text)">Pergerakan IHSG <span className="font-normal text-(--sv-muted)">(3 bulan)</span></p>
        {regime && <span className="rounded-md bg-(--sv-primary-soft) px-2 py-0.5 text-xs font-medium text-(--sv-primary)">{regime.label}</span>}
      </div>
      {loading ? <div className="mt-3 h-24 animate-pulse rounded-lg bg-slate-200/60 dark:bg-slate-700/40" /> : data.length < 2 ? (
        <p className="mt-6 text-sm text-(--sv-muted)">Data IHSG tidak tersedia.</p>
      ) : (
        <div className="mt-2 h-28">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="svIhsgFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval={Math.max(0, Math.floor(data.length / 4))} />
              <YAxis domain={['dataMin', 'dataMax']} hide />
              <Tooltip
                formatter={(v) => [idNum(Number(v)), 'IHSG']}
                contentStyle={{ borderRadius: 8, border: '1px solid #e4e8ef', fontSize: 12 }}
              />
              <Area type="monotone" dataKey="close" stroke={color} strokeWidth={1.75} fill="url(#svIhsgFill)" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

export function MarketSummary({ market, summaries }: { market: ReturnType<typeof useMarketSeries>; summaries: StockSummary[] | null }) {
  return (
    <section aria-label="Ringkasan pasar" className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
      <SeriesCard title="IHSG" data={market.ihsg} loading={market.loading} />
      <SeriesCard title="LQ45" data={market.lq45} loading={market.loading} />
      <SeriesCard title="USD/IDR" data={market.usdidr} loading={market.loading} dec={0} />
      <BreadthCard summaries={summaries} />
      <IhsgMovementCard bars={market.ihsgBars} loading={market.loading} />
    </section>
  );
}
