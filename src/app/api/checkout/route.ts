import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createCheckout, isDokuConfigured, newInvoiceNumber } from "@/lib/doku";
import { PRO_PRICE } from "@/lib/plans";

type Period = keyof typeof PRO_PRICE;

/**
 * Buat sesi DOKU Checkout untuk paket Pro. Harga SELALU diambil dari server (plans.ts),
 * tidak pernah dari body request.
 */
export async function POST(request: NextRequest) {
  const admin = getSupabaseAdmin();
  if (!isDokuConfigured || !admin) {
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

  // Pakai ulang link pembayaran yang masih berlaku (hindari tagihan dobel bila tombol diklik berulang)
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

  const invoiceNumber = newInvoiceNumber(period);
  const { error: insertError } = await admin
    .from("payments")
    .insert({ user_id: user.id, external_id: invoiceNumber, gateway: "doku", period, amount });
  if (insertError) {
    console.error("[checkout] insert", insertError);
    return NextResponse.json({ error: "Gagal membuat tagihan." }, { status: 500 });
  }

  try {
    const checkout = await createCheckout({
      invoiceNumber,
      amount,
      itemName: `EzySaham Pro ${period === "yearly" ? "1 Tahun" : "1 Bulan"}`,
      // DOKU tidak memberi tahu hasil lewat redirect; halaman /harga mengecek statusnya sendiri.
      callbackUrl: `${request.nextUrl.origin}/harga?status=return`,
      customer: { id: user.id, email: user.email },
    });
    await admin
      .from("payments")
      .update({ gateway_ref: checkout.tokenId, invoice_url: checkout.url, invoice_expires_at: checkout.expiresAt })
      .eq("external_id", invoiceNumber);
    return NextResponse.json({ url: checkout.url });
  } catch (e) {
    await admin.from("payments").update({ status: "failed" }).eq("external_id", invoiceNumber);
    console.error("[checkout]", e);
    return NextResponse.json({ error: "Gagal terhubung ke DOKU. Coba lagi sebentar." }, { status: 502 });
  }
}
