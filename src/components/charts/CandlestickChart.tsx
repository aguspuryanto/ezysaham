"use client";
import { useEffect, useMemo, useRef } from "react";
import { useTheme } from "next-themes";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createChart,
  type IChartApi,
  type Time,
} from "lightweight-charts";
import type { Candle } from "@/lib/types";
import { macdSeries, rsiSeries, smaSeries, toLine } from "@/lib/indicators";

export type IndicatorPane = "none" | "rsi" | "macd";

export interface CandlestickChartProps {
  data: Candle[];
  showSma20?: boolean;
  showSma50?: boolean;
  showVolume?: boolean;
  pane?: IndicatorPane;
  height?: number;
}

const COLORS = {
  up: "#16a34a",
  down: "#dc2626",
  sma20: "#f59e0b",
  sma50: "#3b82f6",
  rsi: "#8b5cf6",
  macd: "#3b82f6",
  signal: "#f97316",
};

export default function CandlestickChart({
  data,
  showSma20 = true,
  showSma50 = true,
  showVolume = true,
  pane = "rsi",
  height = 420,
}: CandlestickChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";

  const series = useMemo(() => {
    const closes = data.map((c) => c.close);
    const macd = macdSeries(closes);
    return {
      candles: data.map((c) => ({ time: c.time as Time, open: c.open, high: c.high, low: c.low, close: c.close })),
      volume: data.map((c, i) => ({
        time: c.time as Time,
        value: c.volume,
        color: (i > 0 ? c.close >= data[i - 1].close : c.close >= c.open) ? "rgba(22,163,74,0.35)" : "rgba(220,38,38,0.35)",
      })),
      sma20: toLine(data, smaSeries(closes, 20)),
      sma50: toLine(data, smaSeries(closes, 50)),
      rsi: toLine(data, rsiSeries(closes, 14)),
      macd: toLine(data, macd.macd),
      signal: toLine(data, macd.signal),
      hist: data
        .map((c, i) => ({ time: c.time as Time, value: macd.histogram[i] }))
        .filter((p): p is { time: Time; value: number } => p.value != null)
        .map((p) => ({ ...p, color: p.value >= 0 ? "rgba(22,163,74,0.6)" : "rgba(220,38,38,0.6)" })),
    };
  }, [data]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !data.length) return;

    const text = dark ? "#a1a7b3" : "#5b6270";
    const grid = dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
    const border = dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)";

    const chart = createChart(el, {
      width: el.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: text,
        fontFamily: "inherit",
        attributionLogo: false,
        panes: { separatorColor: border, separatorHoverColor: border },
      },
      grid: { vertLines: { color: grid }, horzLines: { color: grid } },
      rightPriceScale: { borderColor: border },
      timeScale: { borderColor: border, rightOffset: 4, fixLeftEdge: true },
      crosshair: { mode: CrosshairMode.Normal },
      localization: {
        priceFormatter: (p: number) => p.toLocaleString("id-ID", { maximumFractionDigits: 2 }),
      },
    });
    chartRef.current = chart;

    const candles = chart.addSeries(CandlestickSeries, {
      upColor: COLORS.up,
      downColor: COLORS.down,
      wickUpColor: COLORS.up,
      wickDownColor: COLORS.down,
      borderVisible: false,
      priceLineVisible: true,
    });
    candles.setData(series.candles);

    if (showVolume) {
      const vol = chart.addSeries(HistogramSeries, {
        priceScaleId: "vol",
        priceFormat: { type: "volume" },
        lastValueVisible: false,
        priceLineVisible: false,
      });
      vol.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
      vol.setData(series.volume);
      candles.priceScale().applyOptions({ scaleMargins: { top: 0.08, bottom: 0.22 } });
    }

    const lineOpts = { lineWidth: 2 as const, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false };
    if (showSma20 && series.sma20.length) {
      chart.addSeries(LineSeries, { ...lineOpts, color: COLORS.sma20 }).setData(series.sma20 as { time: Time; value: number }[]);
    }
    if (showSma50 && series.sma50.length) {
      chart.addSeries(LineSeries, { ...lineOpts, color: COLORS.sma50 }).setData(series.sma50 as { time: Time; value: number }[]);
    }

    if (pane === "rsi") {
      const rsi = chart.addSeries(LineSeries, { color: COLORS.rsi, lineWidth: 2, priceLineVisible: false }, 1);
      rsi.setData(series.rsi as { time: Time; value: number }[]);
      rsi.createPriceLine({ price: 70, color: COLORS.down, lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: "" });
      rsi.createPriceLine({ price: 30, color: COLORS.up, lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: "" });
      rsi.priceScale().applyOptions({ autoScale: false, scaleMargins: { top: 0.1, bottom: 0.1 } });
      rsi.applyOptions({ autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 100 } }) });
    } else if (pane === "macd") {
      chart.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false }, 1).setData(series.hist);
      chart.addSeries(LineSeries, { color: COLORS.macd, lineWidth: 2, priceLineVisible: false }, 1).setData(series.macd as { time: Time; value: number }[]);
      chart.addSeries(LineSeries, { color: COLORS.signal, lineWidth: 2, priceLineVisible: false, lastValueVisible: false }, 1).setData(series.signal as { time: Time; value: number }[]);
    }

    const panes = chart.panes();
    if (panes.length > 1) {
      panes[0].setStretchFactor(3);
      panes[1].setStretchFactor(1);
    }

    chart.timeScale().fitContent();

    const ro = new ResizeObserver(([entry]) => {
      chart.applyOptions({ width: Math.floor(entry.contentRect.width) });
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [series, data.length, dark, height, pane, showSma20, showSma50, showVolume]);

  return <div ref={ref} className="w-full" style={{ height }} />;
}

export const CHART_COLORS = COLORS;
