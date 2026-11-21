import "server-only";
import { fetchFundamentals } from "./api";
import type { DividendPick, Stock } from "./types";

/**
 * API daftar saham tidak menyertakan dividend yield, jadi kita ambil
 * fundamental untuk N saham berkapitalisasi terbesar (di-cache 1 jam per saham)
 * lalu urutkan berdasarkan yield.
 */
export async function fetchTopDividends(stocks: Stock[], universe = 40): Promise<DividendPick[]> {
  const candidates = [...stocks]
    .filter((s) => s.volume > 0)
    .sort((a, b) => b.marketCap - a.marketCap)
    .slice(0, universe);

  const results = await Promise.allSettled(candidates.map((s) => fetchFundamentals(s.symbol)));

  const picks: DividendPick[] = [];
  results.forEach((r, i) => {
    if (r.status !== "fulfilled" || !r.value) return;
    const y = r.value.dividendYield;
    // Buang nilai yang tidak masuk akal (data kotor dari sumber)
    if (y == null || y <= 0 || y > 30) return;
    picks.push({ stock: candidates[i], dividendYield: y, payoutRatio: r.value.payoutRatio });
  });
  return picks.sort((a, b) => b.dividendYield - a.dividendYield);
}
