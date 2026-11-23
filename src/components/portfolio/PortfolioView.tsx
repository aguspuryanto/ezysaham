"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, RefreshCw, Trash2, TriangleAlert, Wallet, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { LOT_SIZE, usePortfolio } from "@/hooks/usePortfolio";
import { useStockList } from "@/hooks/useStockList";
import { useLiveQuotes } from "@/hooks/useLiveQuotes";
import { changeColor, formatNumber, formatPercent, formatPrice, formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PortfolioDonut } from "@/components/charts/PortfolioDonut";
import { ChangePill } from "@/components/dashboard/ChangeText";
import { PortfolioForm } from "./PortfolioForm";
import { StorageBanner } from "./StorageBanner";
import { SellForm } from "./SellForm";
import { SalesHistory } from "./SalesHistory";

const SECTOR_LIMIT = 40;

export function PortfolioView() {
  const { holdings, sales, ready, removeHolding, clear } = usePortfolio();
  const { data: market, loading: marketLoading, error, updatedAt: marketUpdatedAt, refresh: refreshMarket } = useStockList();
  const live = useLiveQuotes(holdings.map((h) => h.symbol));
  const loading = marketLoading || live.loading;
  const updatedAt = Math.max(marketUpdatedAt ?? 0, live.updatedAt ?? 0) || null;
  const refresh = () => {
    void refreshMarket();
    void live.refresh();
  };
  const [view, setView] = useState<"sector" | "stock">("stock");
  const [showForm, setShowForm] = useState(false);
  const [selling, setSelling] = useState<string | null>(null);
  const openSell = (symbol: string) => {
    setShowForm(false);
    setSelling(symbol);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const rows = useMemo(() => {
    const bySymbol = new Map((market ?? []).map((s) => [s.symbol, s]));
    return holdings.map((h) => {
      const m = bySymbol.get(h.symbol);
      const q = live.quotes.get(h.symbol);
      // Harga intraday Yahoo (60 dtk) lebih segar daripada daftar Pasardana (5 mnt).
      const price = q?.price ?? m?.price ?? null;
      const cost = h.avgPrice * h.shares;
      const value = price != null ? price * h.shares : null;
      const pl = value != null ? value - cost : null;
      return {
        ...h,
        name: m?.name ?? "",
        sector: m?.sector ?? "Lainnya",
        price,
        dayChange: q?.change ?? m?.change ?? null,
        cost,
        value,
        pl,
        plPct: pl != null && cost ? (pl / cost) * 100 : null,
      };
    });
  }, [holdings, market, live.quotes]);

  const totals = useMemo(() => {
    const cost = rows.reduce((a, r) => a + r.cost, 0);
    const value = rows.reduce((a, r) => a + (r.value ?? r.cost), 0);
    const day = rows.reduce((a, r) => {
      if (r.value == null || r.dayChange == null) return a;
      return a + r.value - r.value / (1 + r.dayChange / 100);
    }, 0);
    return { cost, value, pl: value - cost, plPct: cost ? ((value - cost) / cost) * 100 : 0, day };
  }, [rows]);

  const allocation = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const key = view === "sector" ? r.sector : r.symbol;
      map.set(key, (map.get(key) ?? 0) + (r.value ?? r.cost));
    }
    return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [rows, view]);

  const overweight = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) map.set(r.sector, (map.get(r.sector) ?? 0) + (r.value ?? r.cost));
    return [...map.entries()]
      .map(([sector, v]) => ({ sector, pct: totals.value ? (v / totals.value) * 100 : 0 }))
      .filter((s) => s.pct > SECTOR_LIMIT);
  }, [rows, totals.value]);

  const sellingRow = selling ? rows.find((r) => r.symbol === selling) : undefined;

  const header = (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Portofolio Saya</h1>
        <p className="text-sm text-muted-foreground">
          Catat saham yang kamu miliki untuk memantau nilai pasar, untung/rugi, dan diversifikasi.
        </p>
      </div>
      {/* Saat kosong, tombol utama ada di kartu "Portofolio masih kosong" (hindari 2 CTA yang sama) */}
      {ready && (holdings.length > 0 || showForm) && (
        <Button
          variant={showForm ? "outline" : "default"}
          onClick={() => {
            setSelling(null);
            setShowForm((v) => !v);
          }}
          aria-expanded={showForm}
          aria-controls="add-holding"
        >
          {showForm ? <X /> : <Plus />} {showForm ? "Tutup" : "Tambah Portofolio"}
        </Button>
      )}
    </div>
  );

  if (!ready) {
    return (
      <div className="space-y-5">
        {header}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {header}

      {/* Form muncul tepat di bawah tombol yang membukanya */}
      {showForm && (
        <Card id="add-holding">
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Tambah Saham</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Membeli saham yang sama lagi? Tambahkan saja — harga rata-rata dihitung otomatis.
              </p>
            </div>
            <Button variant="ghost" size="icon-sm" aria-label="Tutup form" onClick={() => setShowForm(false)}>
              <X />
            </Button>
          </CardHeader>
          <CardContent>
            <PortfolioForm autoFocus onDone={() => setShowForm(false)} />
          </CardContent>
        </Card>
      )}

      {sellingRow && (
        <Card id="sell-holding">
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Jual {sellingRow.symbol}</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Penjualan tercatat di Riwayat Penjualan beserta untung/ruginya. Bila terjual semua, saham hilang dari kepemilikan.
              </p>
            </div>
            <Button variant="ghost" size="icon-sm" aria-label="Tutup form jual" onClick={() => setSelling(null)}>
              <X />
            </Button>
          </CardHeader>
          <CardContent>
            <SellForm key={sellingRow.symbol} holding={sellingRow} currentPrice={sellingRow.price} onDone={() => setSelling(null)} />
          </CardContent>
        </Card>
      )}

      <StorageBanner />

      {holdings.length === 0 ? (
        !showForm && (
          <Card className="flex flex-col items-center gap-3 p-10 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
              <Wallet className="size-6" />
            </span>
            <p className="font-semibold">{sales.length ? "Tidak ada saham yang sedang dimiliki" : "Portofolio masih kosong"}</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {sales.length ? "Semua saham sudah terjual — lihat hasilnya di Riwayat Penjualan. Catat pembelian baru, atau cari ide dari " : "Catat saham pertamamu, atau cari ide dari "}
              <Link href="/screener?tab=fundamental" className="font-medium text-primary hover:underline">screener fundamental</Link>.
            </p>
            <Button className="mt-1" onClick={() => setShowForm(true)}>
              <Plus /> {sales.length ? "Tambah saham" : "Tambah saham pertama"}
            </Button>
          </Card>
        )
      ) : (
        <>
          {/* Ringkasan */}
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Summary label="Nilai pasar" value={formatRupiah(totals.value)} />
            <Summary label="Modal" value={formatRupiah(totals.cost)} />
            <Summary
              label="Untung/Rugi (unrealized)"
              value={`${totals.pl > 0 ? "+" : ""}${formatRupiah(totals.pl)}`}
              sub={formatPercent(totals.plPct)}
              tone={totals.pl}
            />
            <Summary label="Perubahan hari ini" value={`${totals.day > 0 ? "+" : ""}${formatRupiah(totals.day)}`} tone={totals.day} />
          </section>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {error ? <span className="text-down">{error}</span> : updatedAt ? `Harga diperbarui ${new Date(updatedAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}${live.marketOpen ? " · otomatis tiap menit selama jam bursa" : " · bursa tutup"}` : "Memuat harga…"}
            </span>
            <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
              <RefreshCw className={cn(loading && "animate-spin")} /> Refresh harga
            </Button>
          </div>

          {overweight.length > 0 && (
            <div role="alert" className="flex gap-3 rounded-xl border border-warn/40 bg-warn-soft p-4">
              <TriangleAlert className="mt-0.5 size-5 shrink-0 text-warn" />
              <div className="text-sm">
                <p className="font-semibold">Portofolio kurang terdiversifikasi</p>
                <p className="text-muted-foreground">
                  {overweight.map((o) => `${o.sector} (${o.pct.toFixed(0)}%)`).join(", ")} melebihi {SECTOR_LIMIT}% dari total nilai.
                  Pertimbangkan menyebar ke sektor lain agar risiko tidak terpusat.
                </p>
              </div>
            </div>
          )}

          <div className="grid gap-5 xl:grid-cols-3">
            {/* Kepemilikan */}
            <Card className="min-w-0 xl:col-span-2">
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-base">Kepemilikan ({rows.length})</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => confirm("Hapus semua saham dari portofolio? (Riwayat penjualan tidak ikut terhapus.)") && clear()}
                >
                  Hapus semua
                </Button>
              </CardHeader>
              <CardContent className="px-0 sm:px-0">
                {/* Desktop */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-sm whitespace-nowrap">
                    <thead className="border-y bg-muted/50 text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="px-5 py-2.5 font-medium">Saham</th>
                        <th className="px-3 py-2.5 text-right font-medium">Lot</th>
                        <th className="px-3 py-2.5 text-right font-medium">Avg</th>
                        <th className="px-3 py-2.5 text-right font-medium">Harga</th>
                        <th className="px-3 py-2.5 text-right font-medium">Nilai</th>
                        <th className="px-3 py-2.5 text-right font-medium">U/R</th>
                        <th className="w-10 px-3 py-2.5"><span className="sr-only">Aksi</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.symbol} className="border-b last:border-0">
                          <td className="px-5 py-2.5">
                            <Link href={`/stock/${r.symbol}`} className="font-semibold hover:text-primary">{r.symbol}</Link>
                            <p className="max-w-44 truncate text-xs text-muted-foreground">{r.name || r.sector}</p>
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{formatNumber(r.shares / LOT_SIZE, r.shares % LOT_SIZE ? 2 : 0)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{formatPrice(r.avgPrice)}</td>
                          <td className="px-3 py-2.5 text-right">
                            <p className="tabular-nums">{formatPrice(r.price)}</p>
                            <ChangePill value={r.dayChange} className="min-w-0" />
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{formatRupiah(r.value, true)}</td>
                          <td className={cn("px-3 py-2.5 text-right tabular-nums", changeColor(r.pl))}>
                            <p className="font-medium">{r.pl == null ? "-" : `${r.pl > 0 ? "+" : ""}${formatRupiah(r.pl, true)}`}</p>
                            <p className="text-xs">{formatPercent(r.plPct)}</p>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="outline" size="sm" onClick={() => openSell(r.symbol)}>Jual</Button>
                              <Button variant="ghost" size="icon-sm" aria-label={`Hapus ${r.symbol}`} title="Hapus (salah input) — tidak tercatat sebagai penjualan" onClick={() => removeHolding(r.symbol)}>
                                <Trash2 />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile */}
                <ul className="divide-y border-t md:hidden">
                  {rows.map((r) => (
                    <li key={r.symbol} className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        <Link href={`/stock/${r.symbol}`} className="min-w-0 flex-1">
                          <p className="font-semibold">{r.symbol}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {formatNumber(r.shares / LOT_SIZE, r.shares % LOT_SIZE ? 2 : 0)} lot · avg {formatPrice(r.avgPrice)}
                          </p>
                        </Link>
                        <div className={cn("text-right tabular-nums", changeColor(r.pl))}>
                          <p className="font-semibold">{r.pl == null ? "-" : `${r.pl > 0 ? "+" : ""}${formatRupiah(r.pl, true)}`}</p>
                          <p className="text-xs">{formatPercent(r.plPct)}</p>
                        </div>
                        <Button variant="ghost" size="icon-sm" aria-label={`Hapus ${r.symbol}`} onClick={() => removeHolding(r.symbol)}>
                          <Trash2 />
                        </Button>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>Harga {formatPrice(r.price)} <ChangePill value={r.dayChange} className="ml-1 min-w-0" /></span>
                        <span className="tabular-nums">Nilai {formatRupiah(r.value, true)}</span>
                        <Button variant="outline" size="sm" onClick={() => openSell(r.symbol)}>Jual</Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Alokasi */}
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-base">Alokasi</CardTitle>
                <div className="inline-flex rounded-lg border bg-muted/50 p-0.5 text-xs">
                  {(["sector", "stock"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setView(v)}
                      aria-pressed={view === v}
                      className={cn("rounded-md px-2.5 py-1 font-medium", view === v ? "bg-card shadow-xs" : "text-muted-foreground")}
                    >
                      {v === "sector" ? "Sektor" : "Saham"}
                    </button>
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                <PortfolioDonut data={allocation} />
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <SalesHistory />
    </div>
  );
}

function Summary({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: number }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-1 truncate text-base font-bold tabular-nums sm:text-lg", tone != null && changeColor(tone))}>{value}</p>
      {sub && <p className={cn("text-xs font-medium tabular-nums", tone != null && changeColor(tone))}>{sub}</p>}
    </Card>
  );
}
