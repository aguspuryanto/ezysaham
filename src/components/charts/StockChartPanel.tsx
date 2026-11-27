"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Info, RefreshCw } from "lucide-react";
import { HISTORY_RANGES, type Candle, type HistoryRange } from "@/lib/types";
import { Skeleton } from "@/components/ui/misc";
import { cn } from "@/lib/utils";
import type { IndicatorPane } from "./CandlestickChart";

// lightweight-charts membutuhkan DOM → muat hanya di browser
const CandlestickChart = dynamic(() => import("./CandlestickChart"), {
  ssr: false,
  loading: () => <Skeleton className="h-[420px] w-full" />,
});

const PANES: { value: IndicatorPane; label: string; help: string }[] = [
  { value: "rsi", label: "RSI", help: "RSI (14) mengukur kekuatan kenaikan vs penurunan. >70 jenuh beli (overbought), <30 jenuh jual (oversold)." },
  { value: "macd", label: "MACD", help: "MACD (12,26,9): garis biru memotong garis oranye ke atas = momentum naik (golden cross), ke bawah = melemah." },
  { value: "none", label: "Tanpa", help: "Sembunyikan panel indikator bawah." },
];

export function StockChartPanel({
  symbol,
  initialData,
  initialRange,
}: {
  symbol: string;
  initialData: Candle[];
  initialRange: HistoryRange;
}) {
  const [range, setRange] = useState<HistoryRange>(initialRange);
  const [data, setData] = useState<Candle[]>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pane, setPane] = useState<IndicatorPane>("rsi");
  const [sma20, setSma20] = useState(true);
  const [sma50, setSma50] = useState(true);
  const cache = useRef(new Map<HistoryRange, Candle[]>([[initialRange, initialData]]));

  useEffect(() => {
    const cached = cache.current.get(range);
    if (cached) {
      setData(cached);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    fetch(`/api/stocks/${symbol}/history?range=${range}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<Candle[]>) : Promise.reject(new Error("Gagal memuat chart"))))
      .then((d) => {
        cache.current.set(range, d);
        setData(d);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [range, symbol]);

  const help = PANES.find((p) => p.value === pane)?.help;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border bg-muted/50 p-0.5" role="group" aria-label="Rentang waktu">
          {HISTORY_RANGES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setRange(r.value)}
              aria-pressed={range === r.value}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-semibold transition-colors",
                range === r.value ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <Toggle active={sma20} onClick={() => setSma20((v) => !v)} color="bg-amber-500">SMA20</Toggle>
          <Toggle active={sma50} onClick={() => setSma50((v) => !v)} color="bg-blue-500">SMA50</Toggle>
          <span className="mx-1 h-4 w-px bg-border" />
          {PANES.map((p) => (
            <Toggle key={p.value} active={pane === p.value} onClick={() => setPane(p.value)}>
              {p.label}
            </Toggle>
          ))}
        </div>
      </div>

      <div className="relative">
        {data.length > 0 ? (
          <CandlestickChart data={data} pane={pane} showSma20={sma20} showSma50={sma50} />
        ) : (
          <div className="grid h-[420px] place-items-center rounded-lg bg-muted/40 text-sm text-muted-foreground">
            {loading ? "Memuat chart…" : "Data historis tidak tersedia."}
          </div>
        )}
        {loading && data.length > 0 && (
          <div className="absolute top-2 left-2 flex items-center gap-1.5 rounded-md bg-card/90 px-2 py-1 text-xs shadow">
            <RefreshCw className="size-3 animate-spin" /> Memuat…
          </div>
        )}
        {error && <p className="mt-2 text-sm text-down">{error}</p>}
      </div>

      {help && (
        <p className="flex gap-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" /> {help}
        </p>
      )}
    </div>
  );
}

function Toggle({
  active,
  onClick,
  children,
  color,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-medium transition-colors",
        active ? "border-primary/40 bg-primary/10 text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {color && <span className={cn("size-2 rounded-full", color, !active && "opacity-40")} />}
      {children}
    </button>
  );
}
