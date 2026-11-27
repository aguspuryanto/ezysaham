"use client";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWatchlist } from "@/hooks/useWatchlist";
import { cn } from "@/lib/utils";

/** Tombol bintang untuk menambah/menghapus saham dari watchlist. */
export function WatchlistButton({ symbol, compact = false }: { symbol: string; compact?: boolean }) {
  const { items, ready, toggle } = useWatchlist();
  const on = ready && items.some((w) => w.symbol === symbol);
  const label = on ? `Hapus ${symbol} dari watchlist` : `Tambah ${symbol} ke watchlist`;

  return (
    <Button
      size={compact ? "icon-sm" : "sm"}
      variant={compact ? "ghost" : "outline"}
      disabled={!ready}
      onClick={() => toggle(symbol)}
      aria-pressed={on}
      aria-label={label}
      title={label}
    >
      <Star className={cn(on && "fill-warn text-warn")} />
      {!compact && (on ? "Di watchlist" : "Watchlist")}
    </Button>
  );
}
