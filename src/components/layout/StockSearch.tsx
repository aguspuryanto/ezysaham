"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { useStockList } from "@/hooks/useStockList";
import { Button } from "@/components/ui/button";
import { changeColor, formatPercent, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

export function StockSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [touched, setTouched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { data, loading } = useStockList({ enabled: touched });

  const results = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!q || !data) return [];
    const starts = data.filter((s) => s.symbol.startsWith(q));
    const contains = data.filter(
      (s) => !s.symbol.startsWith(q) && (s.symbol.includes(q) || s.name.toUpperCase().includes(q)),
    );
    return [...starts, ...contains].slice(0, 8);
  }, [data, query]);

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    if (mobileOpen) inputRef.current?.focus();
  }, [mobileOpen]);

  const go = (symbol: string) => {
    setQuery("");
    setFocused(false);
    setMobileOpen(false);
    inputRef.current?.blur();
    router.push(`/stock/${symbol}`);
  };

  const open = focused && query.trim().length > 0;

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="sm:hidden"
        aria-label="Cari saham"
        onClick={() => {
          setTouched(true);
          setMobileOpen(true);
        }}
      >
        <Search />
      </Button>

      <div
        className={cn(
          "sm:relative sm:block sm:w-72 lg:w-80",
          mobileOpen ? "fixed inset-x-0 top-0 z-50 block bg-background p-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] shadow-lg" : "hidden",
        )}
      >
        <div className="relative flex items-center gap-2">
          <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            placeholder="Cari kode / nama saham…"
            aria-label="Cari saham"
            role="combobox"
            aria-expanded={open}
            aria-controls="stock-search-results"
            autoComplete="off"
            className="h-10 w-full rounded-lg border border-input bg-card pr-3 pl-9 text-sm placeholder:text-muted-foreground"
            onFocus={() => {
              setTouched(true);
              setFocused(true);
            }}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter") {
                const pick = results[active] ?? (query.trim() ? { symbol: query.trim().toUpperCase() } : null);
                if (pick) go(pick.symbol);
              } else if (e.key === "Escape") {
                setMobileOpen(false);
                inputRef.current?.blur();
              }
            }}
          />
          {mobileOpen && (
            <Button variant="ghost" size="icon" aria-label="Tutup pencarian" onClick={() => setMobileOpen(false)}>
              <X />
            </Button>
          )}
        </div>

        {open && (
          <ul
            id="stock-search-results"
            role="listbox"
            className="absolute inset-x-3 mt-2 max-h-96 overflow-auto rounded-xl border bg-card p-1 shadow-lg sm:inset-x-0"
          >
            {loading && !data && <li className="px-3 py-2 text-sm text-muted-foreground">Memuat…</li>}
            {data && results.length === 0 && (
              <li className="px-3 py-2 text-sm text-muted-foreground">Tidak ditemukan</li>
            )}
            {results.map((s, i) => (
              <li key={s.symbol} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => go(s.symbol)}
                  onMouseEnter={() => setActive(i)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left",
                    i === active && "bg-accent",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{s.symbol}</span>
                    <span className="block truncate text-xs text-muted-foreground">{s.name}</span>
                  </span>
                  <span className="text-right text-sm">
                    <span className="block font-medium">{formatPrice(s.price)}</span>
                    <span className={cn("block text-xs", changeColor(s.change))}>{formatPercent(s.change)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 sm:hidden" onClick={() => setMobileOpen(false)} aria-hidden />
      )}
    </>
  );
}
