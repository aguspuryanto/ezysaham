import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { EXTERNAL_ID_PREFIX, getInvoice, verifyCallbackToken } from "@/lib/xendit";

/**
 * Webhook Xendit untuk event Invoice (PAID / EXPIRED).
 * Daftarkan URL ini di Xendit Dashboard → Settings → Webhooks → Invoices:
 *   https://<domain>/api/webhooks/xendit
 *
 * Keamanan berlapis:
 *  1. Header x-callback-token harus sama dengan token verifikasi akun.
 *  2. Status invoice dicek ulang langsung ke API Xendit (payload tidak dipercaya mentah-mentah).
 *  3. Aktivasi lewat fungsi SQL atomik & idempoten (aman bila Xendit mengirim ulang).
 */
export async function POST(request: NextRequest) {
  if (!verifyCallbackToken(request.headers.get("x-callback-token"))) {
    return NextResponse.json({ error: "Invalid callback token" }, { status: 401 });
  }
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  const payload = (await request.json().catch(() => null)) as { id?: string; external_id?: string } | null;
  if (!payload?.id || !payload.external_id) {
    return NextResponse.json({ error: "Bad payload" }, { status: 400 });
  }
  // Invoice milik aplikasi lain di akun Xendit yang sama → abaikan (tetap 200 agar tidak dikirim ulang)
  if (!payload.external_id.startsWith(EXTERNAL_ID_PREFIX)) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const invoice = await getInvoice(payload.id);
  if (!invoice || invoice.external_id !== payload.external_id) {
    // Gagal verifikasi sementara → 500 supaya Xendit mencoba lagi
    return NextResponse.json({ error: "Invoice verification failed" }, { status: 500 });
  }

  if (invoice.status === "PAID" || invoice.status === "SETTLED") {
    const { data: expiresAt, error } = await admin.rpc("activate_membership", {
      p_external_id: invoice.external_id,
      p_invoice_id: invoice.id,
      p_paid_amount: Math.round(invoice.paid_amount ?? invoice.amount),
      p_paid_at: invoice.paid_at ?? null,
      p_method: invoice.payment_method ?? null,
      p_channel: invoice.payment_channel ?? null,
    });
    if (error) {
      console.error("[xendit webhook] activate_membership", error);
      return NextResponse.json({ error: "Activation failed" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, activated: expiresAt != null, expiresAt });
  }

  if (invoice.status === "EXPIRED") {
    await admin.from("payments").update({ status: "expired" }).eq("external_id", invoice.external_id).eq("status", "pending");
  }
  return NextResponse.json({ ok: true, status: invoice.status });
}
