import "server-only";

/**
 * Client TokenKoding (API kompatibel OpenAI). Server-only: API key tidak boleh sampai ke browser.
 * - GET  /v1/me                 → { available_credits }
 * - POST /v1/chat/completions   → respons OpenAI + x_filo.credits_remaining
 */
const BASE_URL = "https://api.tokenkoding.id/v1";
export const TOKENKODING_MODEL = process.env.TOKENKODING_MODEL || "deepseek-v4.1-flash";
const API_KEY = process.env.TOKENKODING_API_KEY;

export const isTokenKodingConfigured = Boolean(API_KEY);

export class TokenKodingError extends Error {
  constructor(
    message: string,
    /** "credits" = token/kredit habis atau key ditolak; "rate" = dibatasi; "transient" = gangguan sementara */
    readonly kind: "credits" | "rate" | "transient",
    readonly status?: number,
  ) {
    super(message);
    this.name = "TokenKodingError";
  }
}

/**
 * Circuit breaker per instance server: setelah kredit habis / gangguan, jangan coba lagi untuk sementara
 * agar halaman tidak lambat menunggu API yang pasti gagal.
 */
let blockedUntil = 0;
const BLOCK_MS: Record<TokenKodingError["kind"], number> = {
  credits: 30 * 60_000,
  rate: 5 * 60_000,
  transient: 2 * 60_000,
};

export function isTokenKodingBlocked() {
  return Date.now() < blockedUntil;
}

export function blockTokenKoding(kind: TokenKodingError["kind"]) {
  blockedUntil = Date.now() + BLOCK_MS[kind];
}

/** Sisa kredit akun (di-cache 5 menit). null bila tidak bisa dicek — pemanggil boleh tetap mencoba. */
export async function getTokenKodingCredits(): Promise<number | null> {
  if (!API_KEY) return 0;
  try {
    const res = await fetch(`${BASE_URL}/me`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(5_000),
    });
    if (res.status === 401 || res.status === 403) return 0;
    if (!res.ok) return null;
    const body = (await res.json()) as { available_credits?: string | number };
    const credits = Number(body.available_credits);
    return Number.isFinite(credits) ? credits : null;
  } catch {
    return null;
  }
}

interface ChatResponse {
  choices?: { message?: { content?: string | null }; finish_reason?: string }[];
  x_filo?: { credits_remaining?: string };
  error?: { message?: string } | string;
  message?: string;
}

/** Satu panggilan chat yang mengharapkan JSON. Melempar TokenKodingError bila gagal. */
export async function chatJson(system: string, user: string, opts: { maxTokens?: number; timeoutMs?: number } = {}) {
  if (!API_KEY) throw new TokenKodingError("TOKENKODING_API_KEY belum diisi", "credits");
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: TOKENKODING_MODEL,
        temperature: 0.3,
        max_tokens: opts.maxTokens ?? 1800,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(opts.timeoutMs ?? 25_000),
    });
  } catch (e) {
    throw new TokenKodingError(`Gagal menghubungi TokenKoding: ${(e as Error).message}`, "transient");
  }

  const body = (await res.json().catch(() => ({}))) as ChatResponse;
  if (!res.ok) {
    const detail = typeof body.error === "string" ? body.error : (body.error?.message ?? body.message ?? "");
    const kind =
      res.status === 401 || res.status === 402 || res.status === 403 || /credit|kredit|saldo|balance|insufficient/i.test(detail)
        ? "credits"
        : res.status === 429
          ? "rate"
          : "transient";
    throw new TokenKodingError(`TokenKoding HTTP ${res.status}: ${detail.slice(0, 200)}`, kind, res.status);
  }

  const choice = body.choices?.[0];
  const content = choice?.message?.content;
  if (!content) throw new TokenKodingError("Respons TokenKoding kosong", "transient");
  if (choice?.finish_reason === "length") throw new TokenKodingError("Respons TokenKoding terpotong (max_tokens)", "transient");
  const remaining = Number(body.x_filo?.credits_remaining);
  return { content, creditsRemaining: Number.isFinite(remaining) ? remaining : null };
}
