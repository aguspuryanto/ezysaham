"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export interface LiveQuote {
  symbol: string;
  price: number;
  change: number | null;
}

const POLL_MS = 60 * 1000;

/**
 * Jam bursa BEI (WIB, UTC+7), disederhanakan: Senin–Jumat 08:45–16:15
 * (mencakup pra-pembukaan hingga pasca-penutupan). Libur bursa tidak dihitung.
 */
export function isMarketOpen(now = new Date()) {
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const day = wib.getUTCDay();
  if (day === 0 || day === 6) return false;
  const minutes = wib.getUTCHours() * 60 + wib.getUTCMinutes();
  return minutes >= 8 * 60 + 45 && minutes <= 16 * 60 + 15;
}

/**
 * Harga intraday untuk daftar saham tertentu (via /api/stocks/quotes).
 * Saat jam bursa buka, otomatis diperbarui tiap 60 detik selama tab terlihat.
 */
export function useLiveQuotes(symbols: string[]) {
  const key = [...new Set(symbols)].sort().join(",");
  const [quotes, setQuotes] = useState<Map<string, LiveQuote>>(new Map());
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [marketOpen, setMarketOpen] = useState(() => isMarketOpen());
  const keyRef = useRef(key);

  const run = useCallback(async (k: string, force = false) => {
    if (!k) return;
    setLoading(true);
    try {
      const url = `/api/stocks/quotes?symbols=${encodeURIComponent(k)}${force ? `&t=${Date.now()}` : ""}`;
      const res = await fetch(url, force ? { cache: "no-store" } : undefined);
      if (!res.ok) return;
      const data = (await res.json()) as LiveQuote[];
      if (keyRef.current !== k) return; // daftar saham berubah selagi menunggu
      setQuotes(new Map(data.map((q) => [q.symbol, q])));
      setUpdatedAt(Date.now());
    } catch {
      // Diamkan — tampilan jatuh ke harga Pasardana.
    } finally {
      setLoading(false);
    }
  }, []);

  // Muat saat daftar saham berubah.
  useEffect(() => {
    keyRef.current = key;
    void run(key, false);
  }, [key, run]);

  // Polling selama jam bursa & tab terlihat.
  useEffect(() => {
    if (!key) return;
    const tick = () => {
      const open = isMarketOpen();
      setMarketOpen(open);
      if (open && document.visibilityState === "visible") void run(key, false);
    };
    const id = window.setInterval(tick, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [key, run]);

  return { quotes, updatedAt, loading, marketOpen, refresh: () => run(key, true) };
}
