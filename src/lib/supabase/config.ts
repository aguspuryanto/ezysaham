// NEXT_PUBLIC_* harus dirujuk secara literal agar di-inline oleh Next.js ke bundle browser.
// Pakai || (bukan ??) karena variabel yang dikosongkan di .env bernilai "".
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
/** Mendukung "publishable key" (format baru) maupun "anon key" (format lama). */
export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

/** false bila env belum diisi — aplikasi tetap jalan dalam mode tamu (localStorage). */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);

/** Schema Postgres untuk semua tabel & fungsi ezysaham (bukan `public`). Harus terdaftar di
 *  Supabase → Settings → Data API → Exposed schemas. */
// export const DB_SCHEMA = "public" as const;
export const DB_SCHEMA = "ezysaham" as const;

/** Client Supabase untuk schema ezysaham (tanpa tipe database yang di-generate). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EzyClient = import("@supabase/supabase-js").SupabaseClient<any, typeof DB_SCHEMA, typeof DB_SCHEMA>;
