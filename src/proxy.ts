import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * Me-refresh token session Supabase di setiap request halaman agar cookie
 * tidak kedaluwarsa. Tidak melakukan proteksi halaman (portofolio tetap bisa
 * dipakai tamu dengan localStorage).
 */
export async function proxy(request: NextRequest) {
  if (!isSupabaseConfigured) return NextResponse.next();

  // Bila Redirect URL belum di-whitelist, Supabase mengarahkan link ke Site URL (/?code=...).
  // Teruskan ke handler callback agar login tetap berhasil.
  const { pathname, searchParams } = request.nextUrl;
  if (pathname === "/" && (searchParams.has("code") || searchParams.has("token_hash") || searchParams.has("error_code"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    return NextResponse.redirect(url);
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Jangan taruh logika lain di antara createServerClient dan getUser.
  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: [
    // Lewati aset statis, gambar, dan proxy data saham (tidak butuh session).
    "/((?!_next/static|_next/image|api/stocks|api/webhooks|icon.svg|manifest.webmanifest|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
