import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { DB_SCHEMA, SUPABASE_KEY, SUPABASE_URL, isSupabaseConfigured } from "./config";

/** Client Supabase untuk Route Handler / Server Component. null bila env belum diisi. */
export async function getSupabaseServer() {
  if (!isSupabaseConfigured) return null;
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    db: { schema: DB_SCHEMA },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Dipanggil dari Server Component (read-only) — aman diabaikan, proxy yang me-refresh session.
        }
      },
    },
  });
}
