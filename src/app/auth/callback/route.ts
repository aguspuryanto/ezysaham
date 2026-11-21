import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * Tujuan link login di email. Mendukung dua format:
 *  - ?code=...                     (PKCE, template email bawaan Supabase — harus dibuka di browser yang sama)
 *  - ?token_hash=...&type=email    (template kustom — bisa dibuka di perangkat mana pun)
 * Link valid → buat session lalu arahkan ke home. Tidak valid/kedaluwarsa → kembali ke /login.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const fail = (reason: string) => NextResponse.redirect(new URL(`/login?error=${reason}`, origin));

  // Supabase meneruskan error di query bila link sudah kedaluwarsa/dipakai
  if (searchParams.get("error")) {
    return fail(searchParams.get("error_code") === "otp_expired" ? "expired" : "invalid");
  }

  const supabase = await getSupabaseServer();
  if (!supabase) return fail("not_configured");

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return fail(error.code === "otp_expired" ? "expired" : "invalid");
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) return fail(error.code === "otp_expired" ? "expired" : "invalid");
  } else {
    return fail("invalid");
  }

  return NextResponse.redirect(new URL("/", origin));
}
