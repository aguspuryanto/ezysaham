"use client";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/misc";
import { LOT_SIZE, usePortfolio } from "@/hooks/usePortfolio";
import { useStockList } from "@/hooks/useStockList";
import { formatRupiah } from "@/lib/format";

export function PortfolioForm({
  defaultSymbol = "",
  defaultPrice,
  lockSymbol = false,
  onDone,
}: {
  defaultSymbol?: string;
  defaultPrice?: number;
  lockSymbol?: boolean;
  onDone?: (symbol: string) => void;
}) {
  const { addHolding } = usePortfolio();
  const { data } = useStockList({ enabled: !lockSymbol });
  const [symbol, setSymbol] = useState(defaultSymbol);
  const [price, setPrice] = useState(defaultPrice ? String(defaultPrice) : "");
  const [lots, setLots] = useState("1");
  const [error, setError] = useState<string | null>(null);

  const known = useMemo(() => new Map((data ?? []).map((s) => [s.symbol, s])), [data]);
  const sym = symbol.trim().toUpperCase();
  const match = known.get(sym);
  const p = Number(price.replace(/\./g, "").replace(",", "."));
  const l = Number(lots);
  const total = p > 0 && l > 0 ? p * l * LOT_SIZE : 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[A-Z0-9]{2,8}$/.test(sym)) return setError("Kode saham tidak valid.");
    if (!lockSymbol && data && !match) return setError(`Saham ${sym} tidak ditemukan.`);
    if (!(p > 0)) return setError("Harga beli harus lebih dari 0.");
    if (!(l > 0) || !Number.isInteger(l)) return setError("Jumlah lot harus bilangan bulat > 0.");
    addHolding({ symbol: sym, avgPrice: p, shares: l * LOT_SIZE });
    setError(null);
    if (!lockSymbol) setSymbol("");
    setPrice("");
    setLots("1");
    onDone?.(sym);
  };

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="pf-symbol">Kode saham</Label>
          <Input
            id="pf-symbol"
            list={lockSymbol ? undefined : "pf-symbols"}
            value={symbol}
            disabled={lockSymbol}
            onChange={(e) => {
              const v = e.target.value.toUpperCase();
              setSymbol(v);
              const s = known.get(v.trim());
              if (s && !price) setPrice(String(s.price));
            }}
            placeholder="mis. BBCA"
            autoCapitalize="characters"
            autoComplete="off"
            maxLength={8}
          />
          {!lockSymbol && (
            <datalist id="pf-symbols">
              {(data ?? []).slice(0, 1000).map((s) => (
                <option key={s.symbol} value={s.symbol}>{s.name}</option>
              ))}
            </datalist>
          )}
          {match && <p className="truncate text-xs text-muted-foreground">{match.name}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pf-price">Harga beli / lembar</Label>
          <Input id="pf-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="mis. 9500" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pf-lots">Jumlah lot</Label>
          <Input id="pf-lots" inputMode="numeric" value={lots} onChange={(e) => setLots(e.target.value.replace(/\D/g, ""))} placeholder="1" />
          <p className="text-xs text-muted-foreground">1 lot = {LOT_SIZE} lembar</p>
        </div>
      </div>
      {error && <p className="text-sm text-down" role="alert">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Total modal: <span className="font-semibold text-foreground tabular-nums">{formatRupiah(total)}</span>
        </p>
        <Button type="submit">
          <Plus /> Tambah ke portofolio
        </Button>
      </div>
    </form>
  );
}
