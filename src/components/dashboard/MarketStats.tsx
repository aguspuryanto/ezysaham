import { Triangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { calcSMA } from "@/lib/indicators";
import { formatCompact, formatNumber } from "@/lib/format";
import type { MarketBreadth } from "@/lib/screener";
import type { MarketIndex } from "@/lib/types";
import { cn } from "@/lib/utils";

/* Chart di sini berupa SVG yang dirender di server: ringan, tanpa JavaScript di browser. */

const toneClass = (v: number) => (v > 0 ? "text-up" : v < 0 ? "text-down" : "text-muted-foreground");

function buildPath(values: number[], w: number, h: number, pad = 2) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = values.length > 1 ? w / (values.length - 1) : 0;
  const pts = values.map((v, i) => [i * step, pad + (1 - (v - min) / span) * (h - pad * 2)] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return { line, area: `${line} L${w},${h} L0,${h} Z`, min, max };
}

export function Sparkline({ values, tone, className }: { values: number[]; tone: number; className?: string }) {
  if (values.length < 2) return null;
  const { line } = buildPath(values, 100, 32);
  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" className={cn("h-8 w-24", toneClass(tone), className)} aria-hidden>
      <path d={line} fill="none" stroke="currentColor" strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

function ChangeLine({ change, pct, digits }: { change: number; pct: number; digits: number }) {
  return (
    <p className={cn("flex items-center gap-1 text-sm font-medium tabular-nums", toneClass(change))}>
      {change !== 0 && <Triangle className={cn("size-2.5 fill-current", change < 0 && "rotate-180")} />}
      {change > 0 ? "+" : ""}
      {formatNumber(change, digits)} ({change > 0 ? "+" : ""}
      {formatNumber(pct, 2)}%)
    </p>
  );
}

export function IndexCard({ index, digits = 2 }: { index: MarketIndex; digits?: number }) {
  // Sparkline 1 bulan terakhir (±22 hari bursa)
  const spark = index.points.slice(-22).map((p) => p.value);
  return (
    <Card className="flex min-w-0 flex-col gap-1 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold">{index.name}</p>
        <Sparkline values={spark} tone={spark.length > 1 ? spark.at(-1)! - spark[0] : 0} className="-mt-0.5 shrink-0" />
      </div>
      <p className="truncate text-xl font-bold tabular-nums sm:text-2xl">{formatNumber(index.price, digits)}</p>
      <ChangeLine change={index.change} pct={index.changePct} digits={digits} />
      {index.high != null && index.low != null && (
        <p className="mt-auto pt-1 text-xs text-muted-foreground tabular-nums">
          H {formatNumber(index.high, digits)} · L {formatNumber(index.low, digits)}
        </p>
      )}
    </Card>
  );
}

export function BreadthCard({ breadth }: { breadth: MarketBreadth }) {
  const t = breadth.total || 1;
  return (
    <Card className="flex min-w-0 flex-col gap-3 p-4">
      <p className="text-sm font-semibold">Market Breadth</p>
      <div className="grid grid-cols-3 text-center">
        {[
          ["Naik", breadth.up, "text-up"],
          ["Turun", breadth.down, "text-down"],
          ["Stagnan", breadth.flat, "text-foreground"],
        ].map(([label, v, cls]) => (
          <div key={label as string}>
            <p className={cn("text-lg font-bold tabular-nums sm:text-xl", cls as string)}>{v as number}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className="bg-up" style={{ width: `${(breadth.up / t) * 100}%` }} />
        <div className="bg-down" style={{ width: `${(breadth.down / t) * 100}%` }} />
      </div>
      <p className="mt-auto text-xs text-muted-foreground">
        Nilai Rp{formatCompact(breadth.totalValue)} · {formatCompact(breadth.totalFrequency)} transaksi
      </p>
    </Card>
  );
}

export type Regime = "BULLISH" | "BEARISH" | "NEUTRAL";

/** Kondisi pasar dari posisi IHSG terhadap SMA20 & SMA50, diperkuat market breadth. */
export function marketRegime(index: MarketIndex, breadth: MarketBreadth): Regime {
  const closes = index.points.map((p) => p.value);
  const sma20 = calcSMA(closes, 20);
  const sma50 = calcSMA(closes, 50);
  const price = closes.at(-1)!;
  const ratio = breadth.down ? breadth.up / breadth.down : 2;
  if (sma20 && sma50 && price > sma20 && sma20 > sma50 && ratio >= 0.8) return "BULLISH";
  if (sma20 && sma50 && price < sma20 && sma20 < sma50 && ratio <= 1.25) return "BEARISH";
  return "NEUTRAL";
}

const REGIME_STYLE: Record<Regime, string> = {
  BULLISH: "bg-up-soft text-up",
  BEARISH: "bg-down-soft text-down",
  NEUTRAL: "bg-muted text-muted-foreground",
};

export function IndexTrendCard({ index, regime, days = 63 }: { index: MarketIndex; regime: Regime; days?: number }) {
  const pts = index.points.slice(-days); // ±3 bulan bursa
  const W = 400;
  const H = 120;
  const values = pts.map((p) => p.value);
  const tone = values.length > 1 ? values.at(-1)! - values[0] : 0;
  const { line, area, min, max } = buildPath(values, W, H, 6);
  const gid = `grad-${index.symbol.replace(/\W/g, "")}`;
  // 4 label tanggal yang tersebar rata
  const labels = [0, 1, 2, 3].map((k) => {
    const i = Math.round((k / 3) * (pts.length - 1));
    return { i, text: new Date(pts[i].time).toLocaleDateString("id-ID", { day: "numeric", month: "short" }) };
  });

  return (
    <Card className="flex min-w-0 flex-col gap-2 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold">
          Pergerakan {index.name} <span className="font-normal text-muted-foreground">(3 bulan)</span>
        </p>
        <span className={cn("shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold tracking-wide", REGIME_STYLE[regime])}>
          {regime} MARKET
        </span>
      </div>
      <div className={cn("relative", toneClass(tone))}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-28 w-full" role="img" aria-label={`Grafik ${index.name} 3 bulan, dari ${formatNumber(values[0], 0)} ke ${formatNumber(values.at(-1), 0)}`}>
          <defs>
            <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity={0.22} />
              <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#${gid})`} />
          <path d={line} fill="none" stroke="currentColor" strokeWidth={1.75} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        </svg>
        <span className="absolute top-0 right-0 text-[10px] text-muted-foreground tabular-nums">{formatNumber(max, 0)}</span>
        <span className="absolute right-0 bottom-0 text-[10px] text-muted-foreground tabular-nums">{formatNumber(min, 0)}</span>
      </div>
      <div className="flex justify-between text-[11px] text-muted-foreground">
        {labels.map((l) => (
          <span key={l.i}>{l.text}</span>
        ))}
      </div>
    </Card>
  );
}
