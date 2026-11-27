import "server-only";
import { fetchFundamentals } from "./api";
import type { DividendPick, Fundamentals, Stock } from "./types";

/** Jalankan fn untuk setiap item dengan batas paralel (dari branch main). */
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * Daftar saham tidak menyertakan dividend yield, jadi kita ambil fundamental
 * untuk N saham berkapitalisasi terbesar (di-cache 6 jam per saham) lalu
 * urutkan berdasarkan yield. Paralel dibatasi agar tidak kena rate limit Yahoo.
 */
export async function fetchTopDividends(stocks: Stock[], universe = 40): Promise<DividendPick[]> {
  const candidates = [...stocks]
    .filter((s) => s.volume > 0)
    .sort((a, b) => b.marketCap - a.marketCap)
    .slice(0, universe);

  const results = await mapWithConcurrency<Stock, Fundamentals | null>(candidates, 6, (s) =>
    fetchFundamentals(s.symbol).catch(() => null),
  );

  const picks: DividendPick[] = [];
  results.forEach((f, i) => {
    const y = f?.dividendYield;
    // Buang nilai yang tidak masuk akal (data kotor dari sumber)
    if (y == null || y <= 0 || y > 30) return;
    picks.push({ stock: candidates[i], dividendYield: y, payoutRatio: f!.payoutRatio });
  });
  return picks.sort((a, b) => b.dividendYield - a.dividendYield);
}
