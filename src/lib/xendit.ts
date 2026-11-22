import "server-only";
import { timingSafeEqual } from "node:crypto";

/**
 * Xendit Invoice API (v2). Dokumentasi: https://docs.xendit.co/apidocs/create-invoice
 * Autentikasi: Basic auth dengan secret key sebagai username dan password kosong.
 */
const API = "https://api.xendit.co";
const SECRET_KEY = process.env.XENDIT_SECRET_KEY || "";
const CALLBACK_TOKEN = process.env.XENDIT_CALLBACK_TOKEN || "";

/** Prefix external_id agar webhook mengabaikan invoice milik aplikasi lain di akun Xendit yang sama. */
export const EXTERNAL_ID_PREFIX = "ezysaham-";

export const isXenditConfigured = Boolean(SECRET_KEY && CALLBACK_TOKEN);

export interface XenditInvoice {
  id: string;
  external_id: string;
  status: "PENDING" | "PAID" | "SETTLED" | "EXPIRED";
  amount: number;
  paid_amount?: number;
  invoice_url: string;
  expiry_date: string;
  paid_at?: string;
  payment_method?: string;
  payment_channel?: string;
  payer_email?: string;
}

function authHeader() {
  return `Basic ${Buffer.from(`${SECRET_KEY}:`).toString("base64")}`;
}

export async function createInvoice(input: {
  externalId: string;
  amount: number;
  description: string;
  payerEmail?: string;
  successUrl: string;
  failureUrl: string;
  /** Detik sebelum invoice kedaluwarsa */
  durationSeconds?: number;
}): Promise<XenditInvoice> {
  const res = await fetch(`${API}/v2/invoices`, {
    method: "POST",
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      external_id: input.externalId,
      amount: input.amount,
      currency: "IDR",
      description: input.description,
      invoice_duration: input.durationSeconds ?? 86_400,
      payer_email: input.payerEmail,
      success_redirect_url: input.successUrl,
      failure_redirect_url: input.failureUrl,
      items: [{ name: input.description, quantity: 1, price: input.amount }],
    }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.invoice_url) {
    throw new Error(`Xendit: ${data?.message ?? `HTTP ${res.status}`}`);
  }
  return data as XenditInvoice;
}

export async function getInvoice(id: string): Promise<XenditInvoice | null> {
  const res = await fetch(`${API}/v2/invoices/${encodeURIComponent(id)}`, {
    headers: { Authorization: authHeader() },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as XenditInvoice;
}

/** Cocokkan header x-callback-token dengan token verifikasi dari dashboard Xendit (timing-safe). */
export function verifyCallbackToken(token: string | null): boolean {
  if (!CALLBACK_TOKEN || !token) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(CALLBACK_TOKEN);
  return a.length === b.length && timingSafeEqual(a, b);
}
