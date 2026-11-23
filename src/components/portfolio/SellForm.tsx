"use client";
import { useState } from "react";
import { HandCoins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/misc";
import { LOT_SIZE, usePortfolio, type Holding } from "@/hooks/usePortfolio";
import { BUY_FEE_RATE, SELL_FEE_RATE, saleFees, saleResult } from "@/lib/fees";
import { changeColor, formatNumber, formatPercent, formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Tanggal hari ini (zona waktu lokal) dalam format yyyy-mm-dd untuk <input type="date">. */
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function SellForm({ holding, currentPrice, onDone }: { holding: Holding; currentPrice: number | null; onDone?: () => void }) {
  const { sellHolding } = usePortfolio();
  const maxLots = holding.shares / LOT_SIZE;
  const [lots, setLots] = useState(formatNumber(maxLots, Number.isInteger(maxLots) ? 0 : 2).replace(/\./g, ""));
  const [price, setPrice] = useState(currentPrice ? String(Math.round(currentPrice)) : "");
  const [date, setDate] = useState(today);
  const [error, setError] = useState<string | null>(null);

  const p = Number(price.replace(/\./g, "").replace(",", "."));
  const l = Number(lots.replace(",", "."));
  // "Jual semua" memakai jumlah lembar persis agar tidak tersisa pecahan karena pembulatan
  const shares = l === maxLots || Math.abs(l - maxLots) < 0.005 ? holding.shares : Math.round(l * LOT_SIZE);
  const valid = p > 0 && shares > 0 && shares <= holding.shares;
  const preview = valid ? saleResult({ shares, buyPrice: holding.avgPrice, sellPrice: p, ...saleFees(shares, holding.avgPrice, p) }) : null;
  const fees = valid ? saleFees(shares, holding.avgPrice, p) : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!(p > 0)) return setError("Harga jual harus lebih dari 0.");
    if (!(shares > 0)) return setError("Jumlah lot harus lebih dari 0.");
    if (shares > holding.shares) return setError(`Maksimal ${formatNumber(maxLots, Number.isInteger(maxLots) ? 0 : 2)} lot.`);
    if (!date || date > today()) return setError("Tanggal jual tidak valid.");
    // Hari ini → pakai jam sekarang; tanggal lampau → tengah hari WIB agar tidak bergeser hari
    const soldAt = date === today() ? new Date().toISOString() : new Date(`${date}T12:00:00+07:00`).toISOString();
    const err = sellHolding(holding.symbol, shares, p, soldAt);
    if (err) return setError(err);
    setError(null);
    onDone?.();
  };

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="sell-lots">Jumlah lot dijual</Label>
          <Input id="sell-lots" autoFocus inputMode="decimal" value={lots} onChange={(e) => setLots(e.target.value.replace(/[^\d,]/g, ""))} />
          <p className="text-xs text-muted-foreground">
            Dimiliki {formatNumber(maxLots, Number.isInteger(maxLots) ? 0 : 2)} lot ·{" "}
            <button type="button" className="font-medium text-primary hover:underline" onClick={() => setLots(String(maxLots).replace(".", ","))}>
              Jual semua
            </button>
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sell-price">Harga jual / lembar</Label>
          <Input id="sell-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="mis. 1500" />
          <p className="text-xs text-muted-foreground">Avg beli {formatRupiah(holding.avgPrice)}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sell-date">Tanggal jual</Label>
          <Input id="sell-date" type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      {preview && fees && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg bg-muted/50 p-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-muted-foreground">Modal + fee beli ({formatNumber(BUY_FEE_RATE * 100)}%)</dt>
            <dd className="tabular-nums">{formatRupiah(preview.cost)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Fee jual ({formatNumber(SELL_FEE_RATE * 100)}%)</dt>
            <dd className="tabular-nums">{formatRupiah(fees.sellFee)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Hasil bersih</dt>
            <dd className="tabular-nums">{formatRupiah(preview.proceeds)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Untung/Rugi</dt>
            <dd className={cn("font-semibold tabular-nums", changeColor(preview.pl))}>
              {preview.pl > 0 ? "+" : ""}
              {formatRupiah(preview.pl)} <span className="text-xs font-medium">({formatPercent(preview.plPct)})</span>
            </dd>
          </div>
        </dl>
      )}

      {error && <p className="text-sm text-down" role="alert">{error}</p>}
      <div className="flex justify-end">
        <Button type="submit" disabled={!valid}>
          <HandCoins /> Jual {holding.symbol}
        </Button>
      </div>
    </form>
  );
}
