import "server-only";
import type { EzyClient } from "@/lib/supabase/config";
import type { DokuTransaction } from "./doku";

export type ApplyResult = "activated" | "already_processed" | "marked" | "ignored";

/**
 * Terapkan status transaksi DOKU ke database.
 * SUCCESS → activate_membership (atomik & idempoten, memvalidasi jumlah bayar).
 * FAILED / EXPIRED / TIMEOUT → tandai pembayaran pending.
 */
export async function applyTransaction(admin: EzyClient, tx: DokuTransaction): Promise<ApplyResult> {
  if (tx.status === "SUCCESS") {
    const { data, error } = await admin.rpc("activate_membership", {
      p_external_id: tx.invoiceNumber,
      p_gateway_ref: tx.invoiceNumber,
      p_paid_amount: tx.amount == null ? null : Math.round(tx.amount),
      p_paid_at: tx.date,
      p_method: tx.channel,
      p_channel: tx.channel,
    });
    if (error) throw new Error(`activate_membership: ${error.message}`);
    return data ? "activated" : "already_processed";
  }

  const next = tx.status === "FAILED" ? "failed" : tx.status === "EXPIRED" || tx.status === "TIMEOUT" ? "expired" : null;
  if (!next) return "ignored"; // PENDING / REDIRECT: belum final
  await admin.from("membership_payments").update({ status: next }).eq("external_id", tx.invoiceNumber).eq("status", "pending");
  return "marked";
}
