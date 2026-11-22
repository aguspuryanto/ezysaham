import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getTransactionStatus, isDokuConfigured } from "@/lib/doku";
import { applyTransaction } from "@/lib/payments";

/**
 * Dipanggil halaman /harga saat user kembali dari DOKU. Mengecek status pembayaran pending
 * terbaru milik user langsung ke API DOKU — cadangan bila HTTP Notification terlambat/gagal.
 */
export async function POST() {
  const admin = getSupabaseAdmin();
  if (!isDokuConfigured || !admin) return NextResponse.json({ status: "unavailable" }, { status: 503 });

  const supabase = await getSupabaseServer();
  const { data } = (await supabase?.auth.getUser()) ?? { data: { user: null } };
  if (!data.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: pending } = await admin
    .from("payments")
    .select("external_id")
    .eq("user_id", data.user.id)
    .eq("status", "pending")
    .gt("created_at", new Date(Date.now() - 3 * 86_400_000).toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!pending) return NextResponse.json({ status: "none" });

  const tx = await getTransactionStatus(pending.external_id);
  if (!tx || tx.invoiceNumber !== pending.external_id) return NextResponse.json({ status: "pending" });

  try {
    const result = await applyTransaction(admin, tx);
    return NextResponse.json({ status: tx.status, result });
  } catch (e) {
    console.error("[payments sync]", e);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}
