"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpDown, ChevronDown, ChevronUp, Search } from "lucide-react";
import { Input, Select } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { formatCompact, formatNumber, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ChangePill, ChangeText } from "./ChangeText";

/** Baris ringkas agar payload ke browser kecil. */
export interface StockRow {
  symbol: string;
  name: string;
  sector: string;
  price: number;
  change: number;
  value: number;
  volume: number;
  marketCap: number;
  peRatio: number | null;
  pbv: number | null;
  roe: number | null;
  week: number | null;
  month: number | null;
  /** Metrik tambahan khusus screener (mis. dividend yield / skor) */
  extra?: number | null;
}

type SortKey = "rank" | "symbol" | "price" | "change" | "value" | "marketCap" | "peRatio" | "roe" | "month" | "extra";

const PAGE = 25;

export function StockTable({
  rows,
  ranked = false,
  extraLabel,
  extraFormat = (v) => formatNumber(v),
}: {
  rows: StockRow[];
  /** true bila urutan bawaan rows adalah peringkat screener */
  ranked?: boolean;
  extraLabel?: string;
  extraFormat?: (v: number | null | undefined) => string;
}) {
  const [q, setQ] = useState("");
  const [sector, setSector] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>(
    ranked ? { key: "rank", dir: 1 } : { key: "value", dir: -1 },
  );
  const [limit, setLimit] = useState(PAGE);

  const sectors = useMemo(() => [...new Set(rows.map((r) => r.sector))].sort(), [rows]);

  const filtered = useMemo(() => {
    const query = q.trim().toUpperCase();
    let list = rows.map((r, i) => ({ r, rank: i + 1 }));
    if (query) list = list.filter(({ r }) => r.symbol.includes(query) || r.name.toUpperCase().includes(query));
    if (sector) list = list.filter(({ r }) => r.sector === sector);
    if (sort.key !== "rank") {
      const k = sort.key;
      list = [...list].sort((a, b) => {
        if (k === "symbol") return a.r.symbol.localeCompare(b.r.symbol) * sort.dir;
        const av = a.r[k] as number | null | undefined;
        const bv = b.r[k] as number | null | undefined;
        if (av == null && bv == null) return 0;
        if (av == null) return 1; // null selalu di bawah
        if (bv == null) return -1;
        return (av - bv) * sort.dir;
      });
    } else if (sort.dir === -1) {
      list = [...list].reverse();
    }
    return list;
  }, [rows, q, sector, sort]);

  const toggleSort = (key: SortKey) => {
    setLimit(PAGE);
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === "symbol" || key === "rank" ? 1 : -1 }));
  };

  const SortHead = ({ k, children, className }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <th scope="col" className={cn("px-3 py-2.5 font-medium", className)} aria-sort={sort.key === k ? (sort.dir === 1 ? "ascending" : "descending") : undefined}>
      <button type="button" onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 hover:text-foreground">
        {children}
        {sort.key === k ? (
          sort.dir === 1 ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />
        ) : (
          <ArrowUpDown className="size-3 opacity-40" />
        )}
      </button>
    </th>
  );

  const visible = filtered.slice(0, limit);
  const sortOptions: { key: SortKey; label: string }[] = [
    ...(ranked ? [{ key: "rank" as SortKey, label: "Peringkat" }] : []),
    ...(extraLabel ? [{ key: "extra" as SortKey, label: extraLabel }] : []),
    { key: "change", label: "Perubahan %" },
    { key: "value", label: "Nilai transaksi" },
    { key: "marketCap", label: "Kapitalisasi" },
    { key: "peRatio", label: "PER" },
    { key: "roe", label: "ROE" },
    { key: "month", label: "Return 1 bulan" },
    { key: "symbol", label: "Kode A–Z" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setLimit(PAGE);
            }}
            placeholder="Filter kode atau nama…"
            className="pl-9"
            aria-label="Filter saham"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Select value={sector} onChange={(e) => { setSector(e.target.value); setLimit(PAGE); }} aria-label="Filter sektor" className="sm:w-52">
            <option value="">Semua sektor</option>
            {sectors.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
          {/* Pengurutan untuk mobile (desktop memakai header tabel) */}
          <Select
            className="md:hidden"
            aria-label="Urutkan"
            value={`${sort.key}:${sort.dir}`}
            onChange={(e) => {
              const [key, dir] = e.target.value.split(":");
              setSort({ key: key as SortKey, dir: Number(dir) as 1 | -1 });
              setLimit(PAGE);
            }}
          >
            {sortOptions.flatMap((o) => {
              const asc = o.key === "symbol" || o.key === "rank";
              return [<option key={o.key} value={`${o.key}:${asc ? 1 : -1}`}>{o.label}{asc ? "" : " ↓"}</option>];
            })}
          </Select>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{filtered.length} saham</p>

      {/* Desktop: tabel */}
      <div className="hidden overflow-x-auto rounded-xl border bg-card md:block">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              {ranked && <SortHead k="rank" className="w-12">#</SortHead>}
              <SortHead k="symbol">Saham</SortHead>
              <SortHead k="price" className="text-right">Harga</SortHead>
              <SortHead k="change" className="text-right">Ubah</SortHead>
              {extraLabel && <SortHead k="extra" className="text-right">{extraLabel}</SortHead>}
              <SortHead k="value" className="text-right">Nilai</SortHead>
              <SortHead k="marketCap" className="text-right">Kap. Pasar</SortHead>
              <SortHead k="peRatio" className="text-right">PER</SortHead>
              <SortHead k="roe" className="text-right">ROE</SortHead>
              <SortHead k="month" className="text-right">1 Bln</SortHead>
            </tr>
          </thead>
          <tbody>
            {visible.map(({ r, rank }) => (
              <tr key={r.symbol} className="border-b last:border-0 hover:bg-accent/60">
                {ranked && <td className="px-3 py-2.5 text-muted-foreground tabular-nums">{rank}</td>}
                <td className="px-3 py-2.5">
                  <Link href={`/stock/${r.symbol}`} className="group block">
                    <span className="font-semibold group-hover:text-primary">{r.symbol}</span>
                    <span className="block max-w-56 truncate text-xs text-muted-foreground">{r.name}</span>
                  </Link>
                </td>
                <td className="px-3 py-2.5 text-right font-medium tabular-nums">{formatPrice(r.price)}</td>
                <td className="px-3 py-2.5 text-right"><ChangePill value={r.change} /></td>
                {extraLabel && <td className="px-3 py-2.5 text-right font-medium tabular-nums">{extraFormat(r.extra)}</td>}
                <td className="px-3 py-2.5 text-right tabular-nums">{formatCompact(r.value)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{formatCompact(r.marketCap)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{formatNumber(r.peRatio, 1)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{r.roe == null ? "-" : `${formatNumber(r.roe, 1)}%`}</td>
                <td className="px-3 py-2.5 text-right"><ChangeText value={r.month} digits={1} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: card view */}
      <ul className="space-y-2 md:hidden">
        {visible.map(({ r, rank }) => (
          <li key={r.symbol}>
            <Link href={`/stock/${r.symbol}`} className="block rounded-xl border bg-card p-3 active:bg-accent">
              <div className="flex items-center gap-3">
                {ranked && <span className="w-5 text-xs text-muted-foreground tabular-nums">{rank}</span>}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{r.symbol}</p>
                  <p className="truncate text-xs text-muted-foreground">{r.name}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium tabular-nums">{formatPrice(r.price)}</p>
                  <ChangePill value={r.change} />
                </div>
              </div>
              <dl className="mt-2.5 grid grid-cols-4 gap-2 border-t pt-2.5 text-xs">
                {extraLabel ? (
                  <Stat label={extraLabel} value={extraFormat(r.extra)} />
                ) : (
                  <Stat label="Nilai" value={formatCompact(r.value)} />
                )}
                <Stat label="Kap." value={formatCompact(r.marketCap)} />
                <Stat label="PER" value={formatNumber(r.peRatio, 1)} />
                <Stat label="ROE" value={r.roe == null ? "-" : `${formatNumber(r.roe, 0)}%`} />
              </dl>
            </Link>
          </li>
        ))}
      </ul>

      {filtered.length === 0 && (
        <p className="rounded-xl border bg-card py-10 text-center text-sm text-muted-foreground">
          Tidak ada saham yang cocok dengan filter.
        </p>
      )}

      {limit < filtered.length && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => setLimit((l) => l + PAGE * 2)}>
            Tampilkan lebih banyak ({filtered.length - limit} lagi)
          </Button>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium tabular-nums">{value}</dd>
    </div>
  );
}
