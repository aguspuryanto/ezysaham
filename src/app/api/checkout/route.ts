import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { EXTERNAL_ID_PREFIX, createInvoice, isXenditConfigured } from "@/lib/xendit";
import { PRO_PRICE } from "@/lib/plans";

type Period = keyof typeof PRO_PRICE;

/**
 * Buat invoice Xendit untuk paket Pro. Harga SELALU diambil dari server (plans.ts),
 * tidak pernah dari body request.
 */
export async function POST(request: NextRequest) {
  const admin = getSupabaseAdmin();
  if (!isXenditConfigured || !admin) {
    return NextResponse.json({ error: "Pembayaran belum tersedia." }, { status: 503 });
  }

  const supabase = await getSupabaseServer();
  const { data } = (await supabase?.auth.getUser()) ?? { data: { user: null } };
  const user = data.user;
  if (!user) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { period?: string };
  const period = body.period as Period;
  if (period !== "monthly" && period !== "yearly") {
    return NextResponse.json({ error: "Periode tidak valid." }, { status: 400 });
  }
  const amount = PRO_PRICE[period];

  // Pakai ulang invoice yang masih menunggu pembayaran (hindari tagihan dobel bila tombol diklik berulang)
  const { data: pending } = await admin
    .from("payments")
    .select("invoice_url")
    .eq("user_id", user.id)
    .eq("period", period)
    .eq("status", "pending")
    .gt("invoice_expires_at", new Date(Date.now() + 10 * 60_000).toISOString())
    .not("invoice_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (pending?.invoice_url) return NextResponse.json({ url: pending.invoice_url });

  const externalId = `${EXTERNAL_ID_PREFIX}pro-${period}-${randomUUID()}`;
  const { error: insertError } = await admin
    .from("payments")
    .insert({ user_id: user.id, external_id: externalId, period, amount });
  if (insertError) {
    return NextResponse.json({ error: "Gagal membuat tagihan." }, { status: 500 });
  }

  const origin = request.nextUrl.origin;
  try {
    const invoice = await createInvoice({
      externalId,
      amount,
      description: `EzySaham Pro — ${period === "yearly" ? "1 tahun" : "1 bulan"}`,
      payerEmail: user.email,
      successUrl: `${origin}/harga?status=success`,
      failureUrl: `${origin}/harga?status=failed`,
    });
    await admin
      .from("payments")
      .update({ xendit_invoice_id: invoice.id, invoice_url: invoice.invoice_url, invoice_expires_at: invoice.expiry_date })
      .eq("external_id", externalId);
    return NextResponse.json({ url: invoice.invoice_url });
  } catch (e) {
    await admin.from("payments").update({ status: "failed" }).eq("external_id", externalId);
    console.error("[checkout]", e);
    return NextResponse.json({ error: "Gagal terhubung ke Xendit. Coba lagi sebentar." }, { status: 502 });
  }
}
