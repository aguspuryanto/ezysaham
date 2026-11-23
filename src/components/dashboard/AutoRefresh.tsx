"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isMarketOpen } from "@/lib/market";

/**
 * Memuat ulang Server Component halaman ini secara berkala (default 60 detik)
 * selama jam bursa & tab terlihat. State klien dan posisi scroll tetap terjaga.
 */
export function AutoRefresh({ intervalMs = 60_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    let last = Date.now();
    const tick = () => {
      if (document.visibilityState !== "visible" || !isMarketOpen()) return;
      last = Date.now();
      router.refresh();
    };
    const id = window.setInterval(tick, intervalMs);
    // Kembali ke tab setelah lama ditinggal → langsung segarkan.
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - last >= intervalMs) tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router, intervalMs]);

  return null;
}
