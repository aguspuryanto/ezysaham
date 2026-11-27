import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { INVOICE_PREFIX, verifyNotification } from "@/lib/doku";
import { applyTransaction } from "@/lib/payments";

/**
 * HTTP Notification DOKU Checkout.
 * Daftarkan di DOKU Back Office → Settings → Notification URL:
 *   https://<domain>/api/webhooks/doku   (path harus sama dengan NOTIFICATION_PATH)
 *
 * - Signature HMAC-SHA256 diverifikasi dengan Secret Key (Request-Target = path notifikasi,
 *   Digest = SHA-256 body mentah) → isi notifikasi dapat dipercaya.
 * - DOKU menganggap respons non-2xx sebagai gagal dan mencoba ulang (30 mnt, 6 jam, 12 jam).
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const tx = verifyNotification(request.headers, rawBody);
  if (!tx) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });

  // Transaksi aplikasi lain di akun DOKU yang sama → abaikan (tetap 2xx agar tidak dikirim ulang)
  if (!tx.invoiceNumber.startsWith(INVOICE_PREFIX)) return NextResponse.json({ ok: true, ignored: true });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  try {
    const result = await applyTransaction(admin, tx);
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    console.error("[doku webhook]", e);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
