import { NextResponse, type NextRequest } from "next/server";
import { fetchStocks } from "@/lib/api";

/** BFF proxy: GET /api/stocks[?lite=1] — menghindari CORS & menyembunyikan URL asli. */
export async function GET(req: NextRequest) {
  try {
    const stocks = await fetchStocks();
    const lite = req.nextUrl.searchParams.get("lite");
    const body = lite
      ? stocks.map((s) => ({ symbol: s.symbol, name: s.name, sector: s.sector, price: s.price, change: s.change }))
      : stocks;
    return NextResponse.json(body, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Gagal memuat data" }, { status: 502 });
  }
}
