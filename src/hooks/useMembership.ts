"use client";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { getSupabaseBrowser } from "@/lib/supabase/client";

export interface MembershipState {
  loading: boolean;
  isPro: boolean;
  expiresAt: string | null;
  refresh: () => Promise<boolean>;
}

/** Status Pro user yang sedang login (dibaca dari tabel memberships, dilindungi RLS). */
export function useMembership(): MembershipState {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<{ loading: boolean; expiresAt: string | null }>({ loading: true, expiresAt: null });

  const refresh = useCallback(async () => {
    const supabase = getSupabaseBrowser();
    if (!supabase || !user) {
      setState({ loading: false, expiresAt: null });
      return false;
    }
    const { data } = await supabase.from("memberships").select("expires_at").eq("user_id", user.id).maybeSingle();
    const expiresAt = (data?.expires_at as string | undefined) ?? null;
    setState({ loading: false, expiresAt });
    return expiresAt != null && new Date(expiresAt) > new Date();
  }, [user]);

  useEffect(() => {
    if (!authLoading) void refresh();
  }, [authLoading, refresh]);

  const isPro = state.expiresAt != null && new Date(state.expiresAt) > new Date();
  return { loading: authLoading || state.loading, isPro, expiresAt: state.expiresAt, refresh };
}
