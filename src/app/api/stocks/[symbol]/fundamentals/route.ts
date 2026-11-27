import { NextResponse } from "next/server";
import { fetchFundamentals } from "@/lib/api";

export async function GET(_req: Request, ctx: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await ctx.params;
  if (!/^[A-Za-z0-9]{2,8}$/.test(symbol)) {
    return NextResponse.json({ error: "Kode saham tidak valid" }, { status: 400 });
  }
  const data = await fetchFundamentals(symbol);
  if (!data) return NextResponse.json({ error: "Data fundamental tidak tersedia" }, { status: 404 });
  return NextResponse.json(data, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200" },
  });
}
