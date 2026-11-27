"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Cloud, CloudOff, Crosshair, HardDrive, Lock, Pencil, Plus, RefreshCw, Star, Trash2, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Skeleton } from "@/components/ui/misc";
import { ChangePill } from "@/components/dashboard/ChangeText";
import { useAuth } from "@/components/auth/AuthProvider";
import { useWatchlist, type WatchItem } from "@/hooks/useWatchlist";
import { useStockList, type LiteStock } from "@/hooks/useStockList";
import { useMembership } from "@/hooks/useMembership";
import { formatPercent, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

type Row = WatchItem & { stock: LiteStock | undefined; gapPct: number | null; hit: boolean };

export function WatchlistView() {
  const { items, ready, mode, syncing, error, add, remove, update, clear, retry } = useWatchlist();
  const { data: market, loading, error: marketError, updatedAt, refresh } = useStockList();
  const { configured, user } = useAuth();
  const { isPro } = useMembership();
  const canAnnotate = mode === "remote" && isPro;
  const [editing, setEditing] = useState<string | null>(null);

  const known = useMemo(() => new Map((market ?? []).map((s) => [s.symbol, s])), [market]);

  const rows: Row[] = useMemo(
    () =>
      items.map((w) => {
        const stock = known.get(w.symbol);
        const gapPct = stock && w.targetPrice ? ((w.targetPrice - stock.price) / stock.price) * 100 : null;
        return { ...w, stock, gapPct, hit: gapPct != null && Math.abs(gapPct) < 1 };
      }),
    [items, known],
  );

  if (!ready) {
    return (
      <div className="space-y-5">
        <Header />
        <Skeleton className="h-12" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Header />

      <AddForm market={market} onAdd={add} existing={items} />

      {error && (
        <div role="alert" className="flex items-center gap-3 rounded-xl bg-down-soft p-3 text-sm text-down">
          <CloudOff className="size-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <Button size="sm" variant="outline" onClick={retry}>Coba lagi</Button>
        </div>
      )}

      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        {mode === "remote" ? (
          <>
            {syncing ? <RefreshCw className="size-3.5 animate-spin" /> : <Cloud className="size-3.5 text-up" />}
            {syncing ? "Menyinkronkan…" : <>Tersimpan di akun <span className="font-medium text-foreground">{user?.email}</span>.</>}
          </>
        ) : (
          <>
            <HardDrive className="size-3.5" />
            Tersimpan di browser ini saja.
            {configured && (
              <Link href="/login" className="font-medium text-primary hover:underline">
                Masuk agar watchlist tersinkron di semua perangkat.
              </Link>
            )}
          </>
        )}
      </p>

      {items.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-warn-soft text-warn">
            <Star className="size-6" />
          </span>
          <p className="font-semibold">Watchlist masih kosong</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Tambahkan kode saham di atas, atau tekan tombol <Star className="inline size-3.5" /> di halaman detail saham. Cari ide dari{" "}
            <Link href="/screener" className="font-medium text-primary hover:underline">screener</Link>.
          </p>
        </Card>
      ) : (
        <Card className="min-w-0">
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">Dipantau ({rows.length})</CardTitle>
            <div className="flex items-center gap-1">
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {marketError ? (
                  <span className="text-down">{marketError}</span>
                ) : updatedAt ? (
                  `Harga ${new Date(updatedAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`
                ) : (
                  "Memuat harga…"
                )}
              </span>
              <Button variant="ghost" size="icon-sm" aria-label="Refresh harga" onClick={refresh} disabled={loading}>
                <RefreshCw className={cn(loading && "animate-spin")} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => confirm("Hapus semua saham dari watchlist?") && clear()}
              >
                Hapus semua
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-0 sm:px-0">
            <ul className="divide-y border-t">
              {rows.map((r) => (
                <li key={r.symbol} className="px-4 py-3 sm:px-5">
                  <div className="flex items-center gap-3">
                    <Link href={`/stock/${r.symbol}`} className="min-w-0 flex-1">
                      <p className="font-semibold hover:text-primary">{r.symbol}</p>
                      <p className="truncate text-xs text-muted-foreground">{r.stock?.name || r.stock?.sector || "—"}</p>
                    </Link>
                    <div className="text-right">
                      <p className="font-semibold tabular-nums">{formatPrice(r.stock?.price)}</p>
                      <ChangePill value={r.stock?.change} className="min-w-0" />
                    </div>
                    <div className="flex shrink-0">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Catatan & target ${r.symbol}`}
                        aria-expanded={editing === r.symbol}
                        onClick={() => setEditing((e) => (e === r.symbol ? null : r.symbol))}
                      >
                        <Pencil />
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label={`Hapus ${r.symbol}`} onClick={() => remove(r.symbol)}>
                        <Trash2 />
                      </Button>
                    </div>
                  </div>

                  {(r.targetPrice || r.note) && editing !== r.symbol && (
                    <div className="mt-2 space-y-1 text-xs">
                      {r.targetPrice ? (
                        <p className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
                          <Crosshair className="size-3.5" />
                          Target <span className="font-medium text-foreground tabular-nums">{formatPrice(r.targetPrice)}</span>
                          {r.gapPct != null &&
                            (r.hit ? (
                              <span className="rounded-md bg-warn-soft px-1.5 py-0.5 font-semibold text-warn">Di sekitar target</span>
                            ) : (
                              <span className="tabular-nums">({formatPercent(r.gapPct, 1)} dari harga sekarang)</span>
                            ))}
                        </p>
                      ) : null}
                      {r.note && <p className="whitespace-pre-line text-muted-foreground">{r.note}</p>}
                    </div>
                  )}

                  {editing === r.symbol &&
                    (canAnnotate ? (
                      <NoteForm
                        item={r}
                        onCancel={() => setEditing(null)}
                        onSave={(patch) => {
                          update(r.symbol, patch);
                          setEditing(null);
                        }}
                      />
                    ) : (
                      <ProLock loggedIn={mode === "remote"} />
                    ))}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Header() {
  return (
    <div className="min-w-0">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Watchlist</h1>
      <p className="text-sm text-muted-foreground">
        Pantau saham incaranmu tanpa harus membelinya dulu. Member Pro bisa menambah catatan & target harga.
      </p>
    </div>
  );
}

function AddForm({ market, existing, onAdd }: { market: LiteStock[] | null; existing: WatchItem[]; onAdd: (s: string) => void }) {
  const [symbol, setSymbol] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const sym = symbol.trim().toUpperCase();
    if (!/^[A-Z0-9]{2,8}$/.test(sym)) return setErr("Kode saham tidak valid.");
    if (market && !market.some((s) => s.symbol === sym)) return setErr(`Saham ${sym} tidak ditemukan.`);
    if (existing.some((w) => w.symbol === sym)) return setErr(`${sym} sudah ada di watchlist.`);
    onAdd(sym);
    setSymbol("");
    setErr(null);
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-1.5">
      <Label htmlFor="wl-symbol" className="sr-only">Kode saham</Label>
      <div className="flex gap-2">
        <Input
          id="wl-symbol"
          list="wl-symbols"
          value={symbol}
          onChange={(e) => {
            setSymbol(e.target.value.toUpperCase());
            setErr(null);
          }}
          placeholder="Tambah kode saham, mis. BBCA"
          autoCapitalize="characters"
          autoComplete="off"
          maxLength={8}
          aria-invalid={!!err}
          aria-describedby={err ? "wl-error" : undefined}
          className="max-w-xs"
        />
        <datalist id="wl-symbols">
          {(market ?? []).slice(0, 1000).map((s) => (
            <option key={s.symbol} value={s.symbol}>{s.name}</option>
          ))}
        </datalist>
        <Button type="submit">
          <Plus /> Tambah
        </Button>
      </div>
      {err && <p id="wl-error" className="text-xs text-down">{err}</p>}
    </form>
  );
}

function NoteForm({
  item,
  onSave,
  onCancel,
}: {
  item: WatchItem;
  onSave: (patch: Pick<WatchItem, "note" | "targetPrice">) => void;
  onCancel: () => void;
}) {
  const [target, setTarget] = useState(item.targetPrice ? String(item.targetPrice) : "");
  const [note, setNote] = useState(item.note ?? "");
  const [err, setErr] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = target.trim() ? Number(target.replace(/\./g, "").replace(",", ".")) : null;
    if (t != null && !(t > 0)) return setErr("Target harga harus lebih dari 0.");
    onSave({ targetPrice: t, note: note.trim() || null });
  };

  const id = `wl-${item.symbol}`;
  return (
    <form onSubmit={submit} noValidate className="mt-3 space-y-3 rounded-lg bg-muted/50 p-3">
      <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-target`} className="text-xs">Target harga</Label>
          <Input id={`${id}-target`} inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="mis. 9500" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-note`} className="text-xs">Catatan</Label>
          <textarea
            id={`${id}-note`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder="Alasan memantau, rencana entry, dsb."
            className="flex w-full min-w-0 rounded-lg border border-input bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-2"
          />
        </div>
      </div>
      {err && <p className="text-xs text-down">{err}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          <X /> Batal
        </Button>
        <Button type="submit" size="sm">Simpan</Button>
      </div>
    </form>
  );
}

function ProLock({ loggedIn }: { loggedIn: boolean }) {
  return (
    <div className="mt-3 flex flex-col gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm sm:flex-row sm:items-center">
      <Lock className="size-4 shrink-0 text-primary" />
      <p className="flex-1 text-muted-foreground">
        Catatan & target harga tersedia untuk member <span className="font-medium text-foreground">Pro</span>.
      </p>
      <Link href={loggedIn ? "/harga" : "/login"} className="text-sm font-medium text-primary hover:underline">
        {loggedIn ? "Lihat paket Pro →" : "Masuk dulu →"}
      </Link>
    </div>
  );
}
