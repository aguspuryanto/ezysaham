"use client";
import { useEffect, useState } from "react";
import { isMarketOpen } from "@/lib/market";
import { Badge } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

/**
 * Status bursa (Buka/Tutup) dihitung di browser agar tetap akurat walau halaman
 * di-cache, plus penanda "Tertunda ±10 mnt" bila harga berasal dari kutipan intraday.
 */
export function MarketStatus({ delayed }: { delayed: boolean }) {
  // null sampai mount: hindari hydration mismatch karena waktu server ≠ waktu klien.
  const [open, setOpen] = useState<boolean | null>(null);

  useEffect(() => {
    const update = () => setOpen(isMarketOpen());
    update();
    const id = window.setInterval(update, 30_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <>
      <Badge
        variant={open == null ? "outline" : open ? "up" : "down"}
        title="Jam bursa BEI: Senin–Jumat 08:45–16:15 WIB (libur bursa tidak dihitung)"
        className="gap-1.5"
      >
        <span
          className={cn(
            "size-1.5 rounded-full",
            open == null ? "bg-muted-foreground" : open ? "animate-pulse bg-up" : "bg-down",
          )}
          aria-hidden
        />
        Bursa: {open == null ? "…" : open ? "Buka" : "Tutup"}
      </Badge>
      {delayed && open && (
        <Badge variant="warn" title="Harga intraday tertunda ±10 menit sesuai persyaratan bursa">
          Data tertunda ±10 mnt
        </Badge>
      )}
    </>
  );
}
