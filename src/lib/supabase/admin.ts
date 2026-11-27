import "server-only";
import { createClient } from "@supabase/supabase-js";
import { DB_SCHEMA, type EzyClient, SUPABASE_URL } from "./config";

/**
 * Client Supabase dengan service role / secret key — melewati RLS.
 * HANYA untuk server (webhook & checkout). Jangan pernah diberi prefix NEXT_PUBLIC_.
 */
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export const isSupabaseAdminConfigured = Boolean(SUPABASE_URL && SERVICE_KEY);

let admin: EzyClient | null = null;

export function getSupabaseAdmin(): EzyClient | null {
  if (!isSupabaseAdminConfigured) return null;
  admin ??= createClient(SUPABASE_URL, SERVICE_KEY, {
    db: { schema: DB_SCHEMA },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}
