"use client";
import { useMemo } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LOT_SIZE, usePortfolio, type Sale } from "@/hooks/usePortfolio";
import { saleResult } from "@/lib/fees";
import { changeColor, formatDate, formatNumber, formatPercent, formatPrice, formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";

const lotText = (shares: number) => formatNumber(shares / LOT_SIZE, shares % LOT_SIZE ? 2 : 0);
const signed = (v: number, compact = false) => `${v > 0 ? "+" : ""}${formatRupiah(v, compact)}`;

/** Riwayat penjualan beserta untung/rugi terealisasi (sudah termasuk fee beli & jual). */
export function SalesHistory() {
  const { sales, removeSale } = usePortfolio();

  const rows = useMemo(() => sales.map((s) => ({ ...s, ...saleResult(s) })), [sales]);
  const total = useMemo(() => {
    const cost = rows.reduce((a, r) => a + r.cost, 0);
    const pl = rows.reduce((a, r) => a + r.pl, 0);
    const fees = rows.reduce((a, r) => a + r.buyFee + r.sellFee, 0);
    return { pl, fees, plPct: cost ? (pl / cost) * 100 : 0 };
  }, [rows]);

  if (!sales.length) return null;

  const remove = (s: Sale) => {
    if (confirm(`Hapus catatan penjualan ${s.symbol} (${formatDate(s.soldAt)})? Saham tidak dikembalikan ke kepemilikan.`)) removeSale(s.id);
  };

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-end justify-between gap-2">
        <div>
          <CardTitle className="text-base">Riwayat Penjualan ({rows.length})</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">Untung/rugi sudah dipotong fee beli 0,15% & fee jual 0,25%.</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Untung/Rugi terealisasi</p>
          <p className={cn("text-lg font-bold tabular-nums", changeColor(total.pl))}>
            {signed(total.pl)} <span className="text-xs font-medium">({formatPercent(total.plPct)})</span>
          </p>
          <p className="text-xs text-muted-foreground tabular-nums">Total fee {formatRupiah(total.fees)}</p>
        </div>
      </CardHeader>
      <CardContent className="px-0 sm:px-0">
        {/* Desktop */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm whitespace-nowrap">
            <thead className="border-y bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-5 py-2.5 font-medium">Tanggal</th>
                <th className="px-3 py-2.5 font-medium">Saham</th>
                <th className="px-3 py-2.5 text-right font-medium">Lot</th>
                <th className="px-3 py-2.5 text-right font-medium">Avg beli</th>
                <th className="px-3 py-2.5 text-right font-medium">Harga jual</th>
                <th className="px-3 py-2.5 text-right font-medium">Fee</th>
                <th className="px-3 py-2.5 text-right font-medium">U/R</th>
                <th className="w-10 px-3 py-2.5"><span className="sr-only">Aksi</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="px-5 py-2.5 text-muted-foreground">{formatDate(r.soldAt)}</td>
                  <td className="px-3 py-2.5">
                    <Link href={`/stock/${r.symbol}`} className="font-semibold hover:text-primary">{r.symbol}</Link>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{lotText(r.shares)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatPrice(r.buyPrice)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatPrice(r.sellPrice)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{formatRupiah(r.buyFee + r.sellFee, true)}</td>
                  <td className={cn("px-3 py-2.5 text-right tabular-nums", changeColor(r.pl))}>
                    <p className="font-medium">{signed(r.pl, true)}</p>
                    <p className="text-xs">{formatPercent(r.plPct)}</p>
                  </td>
                  <td className="px-3 py-2.5">
                    <Button variant="ghost" size="icon-sm" aria-label={`Hapus catatan ${r.symbol}`} onClick={() => remove(r)}>
                      <Trash2 />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile */}
        <ul className="divide-y border-t md:hidden">
          {rows.map((r) => (
            <li key={r.id} className="px-4 py-3">
              <div className="flex items-start gap-3">
                <Link href={`/stock/${r.symbol}`} className="min-w-0 flex-1">
                  <p className="font-semibold">{r.symbol}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatDate(r.soldAt)} · {lotText(r.shares)} lot
                  </p>
                </Link>
                <div className={cn("text-right tabular-nums", changeColor(r.pl))}>
                  <p className="font-semibold">{signed(r.pl, true)}</p>
                  <p className="text-xs">{formatPercent(r.plPct)}</p>
                </div>
                <Button variant="ghost" size="icon-sm" aria-label={`Hapus catatan ${r.symbol}`} onClick={() => remove(r)}>
                  <Trash2 />
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground tabular-nums">
                Beli {formatPrice(r.buyPrice)} → Jual {formatPrice(r.sellPrice)} · fee {formatRupiah(r.buyFee + r.sellFee, true)}
              </p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
