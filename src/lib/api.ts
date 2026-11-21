import "server-only";
import type { Candle, Fundamentals, HistoryRange, RawStock, Stock } from "./types";

const BASE = process.env.EZYSAHAM_API_BASE ?? "https://ezysaham.vercel.app/api";

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

/** Daftar semua saham. Cache 5 menit. */
export async function fetchStocks(): Promise<Stock[]> {
  const res = await fetch(`${BASE}/stocks`, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error("Gagal memuat data saham");
  const raw = (await res.json()) as RawStock[];
  return raw.filter((r) => r.Code && r.Last != null).map(normalizeStock);
}

export async function fetchStock(symbol: string): Promise<Stock | null> {
  const all = await fetchStocks();
  return all.find((s) => s.symbol === symbol.toUpperCase()) ?? null;
}

interface RawBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
}

/** Data OHLCV historis. Cache 10 menit. */
export async function fetchHistory(symbol: string, range: HistoryRange = "1y"): Promise<Candle[]> {
  try {
    const res = await fetch(
      `${BASE}/stocks/${encodeURIComponent(symbol.toUpperCase())}/history?range=${range}`,
      { next: { revalidate: 600 } },
    );
    if (!res.ok) return [];
    const json = (await res.json()) as { ok?: boolean; bars?: RawBar[] } | null;
    if (!json?.bars) return [];
    const byDate = new Map<string, Candle>();
    for (const b of json.bars) {
      if (!b?.date || b.close == null) continue;
      byDate.set(b.date, {
        time: b.date,
        open: b.open ?? b.close,
        high: b.high ?? b.close,
        low: b.low ?? b.close,
        close: b.close,
        volume: b.volume ?? 0,
      });
    }
    return [...byDate.values()].sort((a, b) => (a.time < b.time ? -1 : 1));
  } catch {
    return [];
  }
}

interface RawFundamentals {
  ticker?: string;
  dividendYield?: number | null;
  dividendPayoutRatio?: number | null;
  dividendPerShareTtm?: number | null;
  dividendHistory?: { date: string; amount: number }[] | null;
  debtToEquity?: number | null;
  currentRatio?: number | null;
  netMargin?: number | null;
  revenueGrowth?: number | null;
  earningsGrowth?: number | null;
  source?: string | null;
  fetchedAt?: string | null;
}

/** Data fundamental & dividen. Cache 1 jam. Mengembalikan null bila tidak tersedia. */
export async function fetchFundamentals(symbol: string): Promise<Fundamentals | null> {
  try {
    const res = await fetch(
      `${BASE}/stocks/${encodeURIComponent(symbol.toUpperCase())}/fundamentals`,
      { next: { revalidate: 3600 } },
    );
    if (!res.ok) return null;
    const f = (await res.json()) as RawFundamentals | null;
    if (!f) return null;
    return {
      symbol: f.ticker ?? symbol.toUpperCase(),
      dividendYield: num(f.dividendYield),
      payoutRatio: num(f.dividendPayoutRatio),
      dividendPerShare: num(f.dividendPerShareTtm),
      dividendHistory: f.dividendHistory ?? [],
      der: num(f.debtToEquity),
      currentRatio: num(f.currentRatio),
      netMargin: num(f.netMargin),
      revenueGrowth: num(f.revenueGrowth),
      earningsGrowth: num(f.earningsGrowth),
      source: f.source ?? null,
      fetchedAt: f.fetchedAt ?? null,
    };
  } catch {
    return null;
  }
}
