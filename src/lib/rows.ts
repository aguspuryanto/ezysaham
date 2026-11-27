import type { StockRow } from "@/components/dashboard/StockTable";
import type { Stock } from "./types";
import { isHsc } from "./hsc";
import { isLikelySuspended } from "./suspension";

export function toRow(s: Stock, extra?: number | null): StockRow {
  return {
    symbol: s.symbol,
    name: s.name,
    sector: s.sector,
    price: s.price,
    change: Math.round(s.change * 100) / 100,
    value: s.value,
    volume: s.volume,
    marketCap: s.marketCap,
    peRatio: s.peRatio == null ? null : Math.round(s.peRatio * 100) / 100,
    pbv: s.pbv == null ? null : Math.round(s.pbv * 100) / 100,
    roe: s.roe == null ? null : Math.round(s.roe * 10) / 10,
    week: s.returns.week == null ? null : Math.round(s.returns.week * 10) / 10,
    month: s.returns.month == null ? null : Math.round(s.returns.month * 10) / 10,
    ...(isHsc(s.symbol) ? { hsc: true } : {}),
    ...(isLikelySuspended(s) ? { suspended: true } : {}),
    ...(extra !== undefined ? { extra } : {}),
  };
}
