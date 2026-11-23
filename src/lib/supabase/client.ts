"use client";
import { createBrowserClient } from "@supabase/ssr";
import { DB_SCHEMA, type EzyClient, SUPABASE_KEY, SUPABASE_URL, isSupabaseConfigured } from "./config";

let client: EzyClient | null = null;

/** Client Supabase untuk browser (singleton). null bila env belum diisi. */
export function getSupabaseBrowser(): EzyClient | null {
  if (!isSupabaseConfigured) return null;
  client ??= createBrowserClient(SUPABASE_URL, SUPABASE_KEY, { db: { schema: DB_SCHEMA } });
  return client;
}
