import "server-only";
import type { RawStock } from "../types";

/** Daftar seluruh saham BEI beserta harga & rasio (dipindahkan dari branch main). */
export const PASARDANA_LIST_URL =
  "https://pasardana.id/api/StockSearchResult/GetAll?pageBegin=0&pageLength=1000&sortField=Code&sortOrder=ASC";

export async function fetchPasardanaStocks(): Promise<RawStock[]> {
  const res = await fetch(PASARDANA_LIST_URL, {
    headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
    next: { revalidate: 300 }, // 5 menit
  });
  if (!res.ok) throw new Error(`Gagal memuat data saham (Pasardana HTTP ${res.status})`);
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) throw new Error("Format data Pasardana tidak dikenali");
  return data as RawStock[];
}
