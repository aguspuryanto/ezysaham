import "server-only";
import type { Candle, Fundamentals, HistoryRange, MarketIndex, RawStock, Stock } from "./types";
import { fetchPasardanaStocks } from "./sources/pasardana";
import { fetchYahooChart, fetchYahooFundamentals } from "./sources/yahoo";

/*
 * Semua data diambil langsung dari sumber aslinya (Pasardana & Yahoo Finance),
 * tidak lagi lewat ezysaham.vercel.app/api — sehingga aplikasi tidak bergantung
 * pada deployment lain (dan tidak bisa memanggil dirinya sendiri).
 */

const pct = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? null : v * 100);
const num = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? null : v);

export function normalizeStock(r: RawStock): Stock {
  const price = r.Last ?? 0;
  const prev = r.PrevClosingPrice ?? price;
  return {
    symbol: r.Code,
    name: r.Name,
    sector: r.NewSectorName ?? "Lainnya",
    subSector: r.NewSubSectorName ?? "-",
    industry: r.NewIndustryName ?? "-",
    price,
    prevClose: prev,
    open: r.AdjustedOpenPrice ?? price,
    high: r.AdjustedHighPrice ?? price,
    low: r.AdjustedLowPrice ?? price,
    change: pct(r.OneDay) ?? (prev ? ((price - prev) / prev) * 100 : 0),
    changeValue: price - prev,
    volume: r.Volume ?? 0,
    value: r.Value ?? 0,
    frequency: r.Frequency ?? 0,
    marketCap: r.Capitalization ?? 0,
    peRatio: num(r.Per),
    pbv: num(r.Pbr),
    roe: pct(r.Roe),
    beta: num(r.BetaOneYear),
    freeFloat: num(r.FreeFloatPct),
    high52: num(r.AdjustedAnnualHighPrice),
    low52: num(r.AdjustedAnnualLowPrice),
    returns: {
      week: pct(r.OneWeek),
      month: pct(r.OneMonth),
      threeMonth: pct(r.ThreeMonth),
      sixMonth: pct(r.SixMonth),
      year: pct(r.OneYear),
      ytd: pct(r.Ytd),
    },
    lastDate: r.LastDate,
  };
}

/** Daftar semua saham (Pasardana). Cache 5 menit. */
export async function fetchStocks(): Promise<Stock[]> {
  const raw = await fetchPasardanaStocks();
  return raw.filter((r) => r.Code && r.Last != null).map(normalizeStock);
}

export async function fetchStock(symbol: string): Promise<Stock | null> {
  const all = await fetchStocks();
  return all.find((s) => s.symbol === symbol.toUpperCase()) ?? null;
}

/** OHLCV harian (Yahoo). Cache 10 menit. */
export async function fetchHistory(symbol: string, range: HistoryRange = "1y"): Promise<Candle[]> {
  const chart = await fetchYahooChart(symbol.toUpperCase(), range, 600);
  return (chart?.bars ?? []).map((b) => ({
    time: b.date,
    open: b.open,
    high: b.high,
    low: b.low,
    close: b.close,
    volume: b.volume,
  }));
}

/** Fundamental & dividen (Yahoo quoteSummary). Cache 6 jam. null bila tidak tersedia. */
export async function fetchFundamentals(symbol: string): Promise<Fundamentals | null> {
  const f = await fetchYahooFundamentals(symbol.toUpperCase());
  if (!f) return null;
  return { symbol: symbol.toUpperCase(), ...f, source: "yahoo", fetchedAt: new Date().toISOString() };
}

export const MARKET_INDICES = [
  { symbol: "^JKSE", name: "IHSG" },
  { symbol: "^JKLQ45", name: "LQ45" },
  { symbol: "IDR=X", name: "USD/IDR" },
] as const;

/** Indeks / kurs dengan data harian untuk sparkline & chart. Cache 15 menit. */
export async function fetchMarketIndex(symbol: string, name: string, range = "6mo"): Promise<MarketIndex | null> {
  const chart = await fetchYahooChart(symbol, range, 900);
  if (!chart || chart.price == null || !chart.bars.length) return null;
  const prev = chart.prevClose ?? chart.price;
  return {
    symbol,
    name,
    price: chart.price,
    change: chart.price - prev,
    changePct: prev ? ((chart.price - prev) / prev) * 100 : 0,
    high: chart.dayHigh,
    low: chart.dayLow,
    points: chart.bars.map((b) => ({ time: b.date, value: b.close })),
  };
}
