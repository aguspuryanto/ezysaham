import { NextResponse, type NextRequest } from "next/server";
import { fetchHistory } from "@/lib/api";
import { isHistoryRange } from "@/lib/types";

export async function GET(req: NextRequest, ctx: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await ctx.params;
  if (!/^[A-Za-z0-9]{2,8}$/.test(symbol)) {
    return NextResponse.json({ error: "Kode saham tidak valid" }, { status: 400 });
  }
  const r = req.nextUrl.searchParams.get("range");
  const range = isHistoryRange(r) ? r : "1y";
  const candles = await fetchHistory(symbol, range);
  return NextResponse.json(candles, {
    headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200" },
  });
}
