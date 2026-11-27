import "server-only";
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";

/**
 * DOKU Checkout (non-SNAP).
 * Docs: https://developers.doku.com/accept-payments/doku-checkout/integration-guide/backend-integration
 *       https://developers.doku.com/get-started-with-doku-api/signature-component/non-snap
 *
 * Signature = "HMACSHA256=" + base64(HMAC-SHA256(secretKey, komponen)), dengan komponen:
 *   Client-Id:<id>\nRequest-Id:<id>\nRequest-Timestamp:<UTC Z>\nRequest-Target:<path>[\nDigest:<base64(sha256(body))>]
 * Digest hanya untuk request ber-body (POST).
 */
const CLIENT_ID = process.env.DOKU_CLIENT_ID || "";
const SECRET_KEY = process.env.DOKU_SECRET_KEY || "";
const IS_PRODUCTION = process.env.DOKU_ENV === "production";
const API = IS_PRODUCTION ? "https://api.doku.com" : "https://api-sandbox.doku.com";

/** Path URL notifikasi — harus sama persis dengan yang didaftarkan di DOKU Back Office. */
export const NOTIFICATION_PATH = "/api/webhooks/doku";
/** Prefix invoice_number agar notifikasi milik aplikasi lain di akun yang sama diabaikan. */
export const INVOICE_PREFIX = "EZS";

export const isDokuConfigured = Boolean(CLIENT_ID && SECRET_KEY);

// ---------- Signature ----------
const sha256Base64 = (body: string) => createHash("sha256").update(body, "utf8").digest("base64");

function signature(parts: { requestId: string; timestamp: string; target: string; body?: string; clientId?: string }) {
  const lines = [
    `Client-Id:${parts.clientId ?? CLIENT_ID}`,
    `Request-Id:${parts.requestId}`,
    `Request-Timestamp:${parts.timestamp}`,
    `Request-Target:${parts.target}`,
  ];
  if (parts.body !== undefined) lines.push(`Digest:${sha256Base64(parts.body)}`);
  return `HMACSHA256=${createHmac("sha256", SECRET_KEY).update(lines.join("\n")).digest("base64")}`;
}

/** Timestamp UTC ISO-8601 tanpa milidetik, mis. 2026-11-22T08:45:42Z */
const utcTimestamp = () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

function signedHeaders(target: string, body?: string) {
  const requestId = randomUUID();
  const timestamp = utcTimestamp();
  return {
    "Client-Id": CLIENT_ID,
    "Request-Id": requestId,
    "Request-Timestamp": timestamp,
    Signature: signature({ requestId, timestamp, target, body }),
  };
}

/** Invoice number pendek & alfanumerik (batas 30 karakter bila kartu kredit aktif, tanpa simbol untuk KKI). */
export function newInvoiceNumber(period: "monthly" | "yearly") {
  const rand = randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  return `${INVOICE_PREFIX}${period === "yearly" ? "Y" : "M"}${Date.now().toString(36).toUpperCase()}${rand}`;
}

/** "20240712104711" (UTC+7) → ISO string */
function parseDokuDate(v: string | undefined): string | null {
  const m = v?.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/);
  if (!m) return null;
  return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}+07:00`).toISOString();
}

// ---------- API ----------
export async function createCheckout(input: {
  invoiceNumber: string;
  amount: number;
  itemName: string;
  callbackUrl: string;
  customer: { id: string; email?: string };
  /** Menit sebelum link pembayaran kedaluwarsa */
  dueMinutes?: number;
}): Promise<{ url: string; tokenId: string | null; expiresAt: string | null }> {
  const target = "/checkout/v1/payment";
  // Body di-stringify SEKALI: string yang sama dipakai untuk Digest dan dikirim.
  const body = JSON.stringify({
    order: {
      amount: input.amount,
      invoice_number: input.invoiceNumber,
      currency: "IDR",
      callback_url: input.callbackUrl,
      callback_url_result: input.callbackUrl,
      auto_redirect: true,
      language: "ID",
      line_items: [{ name: input.itemName, price: input.amount, quantity: 1 }],
    },
    payment: { payment_due_date: input.dueMinutes ?? 1440 },
    customer: { id: input.customer.id, email: input.customer.email },
  });

  const res = await fetch(`${API}${target}`, {
    method: "POST",
    headers: { ...signedHeaders(target, body), "Content-Type": "application/json" },
    body,
    cache: "no-store",
  });
  const data = (await res.json().catch(() => null)) as {
    response?: { payment?: { url?: string; token_id?: string; expired_date?: string } };
    error_messages?: string[];
    message?: string[];
  } | null;
  const url = data?.response?.payment?.url;
  if (!res.ok || !url) {
    throw new Error(`DOKU: ${data?.error_messages?.join(", ") ?? data?.message?.join(", ") ?? `HTTP ${res.status}`}`);
  }
  return {
    url,
    tokenId: data?.response?.payment?.token_id ?? null,
    expiresAt: parseDokuDate(data?.response?.payment?.expired_date),
  };
}

export interface DokuTransaction {
  invoiceNumber: string;
  amount: number | null;
  /** PENDING | SUCCESS | FAILED | EXPIRED | REFUNDED | TIMEOUT | REDIRECT */
  status: string;
  channel: string | null;
  date: string | null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function toTransaction(data: any): DokuTransaction | null {
  const invoiceNumber = data?.order?.invoice_number;
  const status = data?.transaction?.status;
  if (!invoiceNumber || !status) return null;
  const amount = Number(data?.order?.amount);
  return {
    invoiceNumber,
    amount: Number.isFinite(amount) ? amount : null,
    status: String(status).toUpperCase(),
    channel: data?.channel?.id ?? null,
    date: data?.transaction?.date ?? null,
  };
}

/** Cek status transaksi ke DOKU (GET, tanpa Digest). null bila belum ada / gagal. */
export async function getTransactionStatus(invoiceNumber: string): Promise<DokuTransaction | null> {
  const target = `/orders/v1/status/${encodeURIComponent(invoiceNumber)}`;
  try {
    const res = await fetch(`${API}${target}`, { headers: signedHeaders(target), cache: "no-store" });
    if (!res.ok) return null;
    return toTransaction(await res.json());
  } catch {
    return null;
  }
}

/**
 * Verifikasi HTTP Notification dari DOKU. rawBody harus teks mentah (sebelum JSON.parse)
 * agar Digest cocok. Mengembalikan transaksi bila signature valid, selain itu null.
 */
export function verifyNotification(headers: Headers, rawBody: string): DokuTransaction | null {
  const clientId = headers.get("client-id");
  const requestId = headers.get("request-id");
  const timestamp = headers.get("request-timestamp");
  const received = headers.get("signature");
  if (!SECRET_KEY || !clientId || clientId !== CLIENT_ID || !requestId || !timestamp || !received) return null;

  const expected = signature({ clientId, requestId, timestamp, target: NOTIFICATION_PATH, body: rawBody });
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    return toTransaction(JSON.parse(rawBody));
  } catch {
    return null;
  }
}
