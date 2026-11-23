import { NextResponse, type NextRequest } from "next/server";
import { fetchQuotes } from "@/lib/api";

/**
 * GET /api/stocks/quotes?symbols=BBCA,BBRI — harga intraday (Yahoo) khusus untuk
 * saham tertentu, mis. isi portofolio. Pasardana (/api/stocks) hanya data penutupan.
 */
export async function GET(req: NextRequest) {
  const symbols = (req.nextUrl.searchParams.get("symbols") ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^[A-Z0-9]{2,6}$/.test(s));

  if (symbols.length === 0) return NextResponse.json([]);

  const quotes = await fetchQuotes(symbols);
  return NextResponse.json(quotes, {
    headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
  });
}
