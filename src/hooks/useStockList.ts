"use client";
import { useCallback, useEffect, useState } from "react";

/** Versi ringan data saham untuk pencarian & portofolio (dari BFF /api/stocks?lite=1). */
export interface LiteStock {
  symbol: string;
  name: string;
  sector: string;
  price: number;
  change: number;
}

let cache: { at: number; data: LiteStock[] } | null = null;
let inflight: Promise<LiteStock[]> | null = null;
const TTL = 5 * 60 * 1000;

async function load(force = false): Promise<LiteStock[]> {
  if (!force && cache && Date.now() - cache.at < TTL) return cache.data;
  if (!force && inflight) return inflight;
  inflight = fetch(`/api/stocks?lite=1${force ? `&t=${Date.now()}` : ""}`, force ? { cache: "no-store" } : undefined)
    .then((r) => {
      if (!r.ok) throw new Error("Gagal memuat data saham");
      return r.json() as Promise<LiteStock[]>;
    })
    .then((data) => {
      cache = { at: Date.now(), data };
      return data;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function useStockList({ enabled = true }: { enabled?: boolean } = {}) {
  const [data, setData] = useState<LiteStock[] | null>(cache?.data ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(cache?.at ?? null);

  const run = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const d = await load(force);
      setData(d);
      setUpdatedAt(cache?.at ?? Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) void run(false);
  }, [enabled, run]);

  return { data, loading, error, updatedAt, refresh: () => run(true) };
}
