import { NextResponse, type NextRequest } from "next/server";
import { fetchYahooChart } from "@/lib/sources/yahoo";

const MAX_SYMBOLS = 60;

export interface Quote {
  symbol: string;
  price: number;
  change: number | null;
}

/**
 * GET /api/stocks/quotes?symbols=BBCA,BBRI — harga intraday (Yahoo, cache 60 detik)
 * khusus untuk saham tertentu, mis. isi portofolio. Lebih segar daripada daftar
 * Pasardana (/api/stocks) yang di-cache 5 menit.
 */
export async function GET(req: NextRequest) {
  const symbols = [
    ...new Set(
      (req.nextUrl.searchParams.get("symbols") ?? "")
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter((s) => /^[A-Z0-9]{2,6}$/.test(s)),
    ),
  ].slice(0, MAX_SYMBOLS);

  if (symbols.length === 0) return NextResponse.json([]);

  const charts = await Promise.all(symbols.map((s) => fetchYahooChart(s, "5d", 60)));
  const quotes: Quote[] = [];
  charts.forEach((c, i) => {
    if (!c || c.price == null) return;
    quotes.push({
      symbol: symbols[i],
      price: c.price,
      change: c.prevClose ? ((c.price - c.prevClose) / c.prevClose) * 100 : null,
    });
  });

  return NextResponse.json(quotes, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
  });
}
