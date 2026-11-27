"use client";
import { useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { attachPortfolioUser } from "@/hooks/usePortfolio";
import { attachWatchlistUser } from "@/hooks/useWatchlist";

/** Menghubungkan status login ke store portofolio & watchlist (localStorage ↔ Supabase). */
export function PortfolioSync() {
  const { user, loading, configured } = useAuth();
  const uid = user?.id ?? null;
  useEffect(() => {
    if (!configured || loading) return;
    attachPortfolioUser(uid);
    attachWatchlistUser(uid);
  }, [uid, loading, configured]);
  return null;
}
