"use client";
// Fungsi format tidak bisa dikirim dari Server Component, jadi dibungkus di sini.
import { StockTable, type StockRow } from "@/components/dashboard/StockTable";
import { formatNumber } from "@/lib/format";

export function DividendFormat({ rows }: { rows: StockRow[] }) {
  return (
    <StockTable rows={rows} ranked extraLabel="Yield" extraFormat={(v) => (v == null ? "-" : `${formatNumber(v, 2)}%`)} />
  );
}

export function ScoreFormat({ rows }: { rows: StockRow[] }) {
  return <StockTable rows={rows} ranked extraLabel="Skor" extraFormat={(v) => (v == null ? "-" : String(v))} />;
}
