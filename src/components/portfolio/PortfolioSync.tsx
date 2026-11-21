"use client";
import { useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { attachPortfolioUser } from "@/hooks/usePortfolio";

/** Menghubungkan status login ke store portofolio (localStorage ↔ Supabase). */
export function PortfolioSync() {
  const { user, loading, configured } = useAuth();
  const uid = user?.id ?? null;
  useEffect(() => {
    if (!configured || loading) return;
    attachPortfolioUser(uid);
  }, [uid, loading, configured]);
  return null;
}
