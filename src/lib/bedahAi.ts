import "server-only";
import { unstable_cache } from "next/cache";
import type { BedahContext, BedahPoint, BedahSection, PointTone } from "./bedahData";
import { isFinancial } from "./entrySignal";
import { isTermId, type TermId } from "./glossary";
import type { Fundamentals, Stock } from "./types";
import {
  TOKENKODING_MODEL,
  TokenKodingError,
  blockTokenKoding,
  chatJson,
  getTokenKodingCredits,
  isTokenKodingBlocked,
  isTokenKodingConfigured,
} from "./sources/tokenkoding";

/**
 * Narasi "Bedah Data" oleh AI (TokenKoding), dengan fallback ke versi berbasis aturan bila:
 * key belum diisi, kredit habis/di bawah batas, API gagal/timeout, atau output tidak lolos validasi.
 * Hasil AI di-cache per saham per tanggal data, jadi tiap saham paling banyak 1 panggilan per hari bursa.
 */

/** Naikkan bila prompt/format berubah agar cache lama tidak dipakai. */
const PROMPT_VERSION = "v1";
/** Sisa kredit minimum untuk memanggil AI (1 narasi ≈ 4–5 kredit). */
const MIN_CREDITS = 25;

const SECTION_KEYS = ["paradoks", "realita", "bahaya"] as const;
const SECTION_TITLES: Record<BedahSection["key"], string> = {
  paradoks: "Paradoks Data & Jebakan Narasi",
  realita: "Realita Fundamental & Kinerja Harga",
  bahaya: "Sinyal Bahaya Lainnya",
};
const TONES: PointTone[] = ["danger", "warn", "info", "good"];
const ALLOWED_TERMS: TermId[] = [
  "per", "pbv", "roe", "der", "net-margin", "current-ratio", "yoy", "beta", "free-float", "kapitalisasi",
  "nilai-transaksi", "volume", "return", "fomo", "saham-gorengan", "value-trap", "dividend-trap",
  "dividend-yield", "payout-ratio", "ara-arb", "harga-wajar", "margin-of-safety",
];

const SYSTEM_PROMPT = `Anda adalah Analis Finansial dan Edukator Pasar Modal untuk aplikasi "Ezysaham". Pembaca Anda investor pemula yang rentan terhadap FOMO, saham gorengan, dividend trap, dan value trap.

TUGAS: Dari data yang diberikan, tulis narasi "Bedah Data" yang objektif, mendidik, dan memperingatkan potensi risiko. DILARANG memberi rekomendasi beli/jual, target harga, atau ajakan bertransaksi.

Bagi menjadi 3 bagian:
1. paradoks — Paradoks Data & Jebakan Narasi: cari keanehan/kontradiksi data (contoh: pertumbuhan pendapatan ribuan persen TAPI PER negatif). Jelaskan penyebabnya dengan bahasa awam (efek low-base, laba sedang negatif, valuasi tidak wajar) dan apakah narasi pertumbuhannya menyesatkan.
2. realita — Realita Fundamental & Kinerja Harga: hubungkan ROE, net margin, DER dengan pergerakan harga (1 bulan, 3 bulan, YTD, 1 tahun). Apakah ini koreksi sementara (sentimen) atau value trap (fundamental rusak)? Bandingkan dengan median sektor bila tersedia. Sebutkan angka spesifik.
3. bahaya — Sinyal Bahaya Lainnya: beta, free float, lonjakan volume, likuiditas, potensi FOMO (misal turun YTD tapi melonjak sepekan), ciri saham gorengan (sebut sebagai tanda risiko, bukan tuduhan manipulasi).

GAYA: tegas, waspada, mudah dimengerti, boleh memakai analogi. Gunakan kata pembuka "Waspada", "Jebakan", atau "Perhatikan" bila relevan. Nilai null berarti data tidak tersedia: jangan dikarang. Angka tidak wajar (misal PER -53,9x atau pertumbuhan +1387,9%) jelaskan mengapa tidak boleh ditelan mentah-mentah. Hanya gunakan angka yang ada di data. Tulis angka gaya Indonesia (koma desimal). Untuk bank/keuangan (sektor_keuangan: true), DER dan current ratio tidak relevan.

OUTPUT: HANYA JSON valid tanpa teks lain, dengan bentuk:
{"sections":[{"key":"paradoks","points":[{"tone":"danger|warn|info|good","lead":"Waspada|Jebakan|Perhatikan|null","text":"..."}],"terms":["..."]},{"key":"realita",...},{"key":"bahaya",...}]}
Aturan: tiap bagian 1–4 poin, tiap "text" 1–3 kalimat (maksimal 400 karakter). tone: danger = risiko serius, warn = perlu diperhatikan, info = netral, good = tidak ada masalah. "terms" hanya boleh berisi id dari daftar: ${ALLOWED_TERMS.join(", ")}.`;

const round = (v: number | null | undefined, d = 1) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d);

/** Data masukan untuk AI. Hanya data harian (bukan harga intraday) agar cache per hari stabil. */
export function bedahAiInput(stock: Stock, f: Fundamentals | null, ctx: BedahContext) {
  const r = stock.returns;
  return {
    kode: stock.symbol,
    nama: stock.name,
    sektor: stock.sector,
    sektor_keuangan: isFinancial(stock),
    tanggal_data: stock.lastDate?.slice(0, 10) ?? null,
    harga: stock.price,
    kapitalisasi_rp: stock.marketCap,
    nilai_transaksi_rp: stock.value,
    per: round(stock.peRatio),
    pbv: round(stock.pbv, 2),
    roe_pct: round(stock.roe),
    der_pct: round(f?.der, 0),
    net_margin_pct: round(f?.netMargin),
    current_ratio: round(f?.currentRatio, 2),
    revenue_growth_pct: round(f?.revenueGrowth),
    earnings_growth_pct: round(f?.earningsGrowth),
    beta: round(stock.beta, 2),
    free_float_pct: round(stock.freeFloat),
    dividend_yield_pct: round(f?.dividendYield, 2),
    payout_ratio_pct: round(f?.payoutRatio, 0),
    harga_tertinggi_52_minggu: stock.high52,
    harga_terendah_52_minggu: stock.low52,
    kinerja_pct: {
      "1_minggu": round(r.week),
      "1_bulan": round(r.month),
      "3_bulan": round(r.threeMonth),
      "6_bulan": round(r.sixMonth),
      ytd: round(r.ytd),
      "1_tahun": round(r.year),
    },
    median_sektor_3_bulan_pct: round(ctx.sectorMedian3m),
    median_sektor_ytd_pct: round(ctx.sectorMedianYtd),
    volume_vs_rata2_20hari: round(ctx.volumeRatio),
  };
}

/** Kalimat yang berbau ajakan/rekomendasi transaksi → tolak output AI (pakai versi aturan). */
const FORBIDDEN =
  /rekomendasi(nya)?\s+(beli|jual|buy|sell)|layak\s+(di)?beli|segera\s+(beli|jual|masuk|keluar)|(beli|jual|borong|serok)\s+(sekarang|saja)|target\s+harga|strong\s+buy|\bbuy\b|\bsell\b|wajib\s+(beli|punya|dikoleksi)|cuan\s+pasti|pasti\s+(naik|untung)/i;

class InvalidAiOutput extends Error {}
/** AI sengaja tidak dipanggil (kredit habis / circuit breaker aktif). */
class AiSkipped extends Error {}

function parseSections(raw: string): BedahSection[] {
  let json: unknown;
  try {
    json = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
  } catch {
    throw new InvalidAiOutput("bukan JSON");
  }
  const list = (json as { sections?: unknown })?.sections;
  if (!Array.isArray(list)) throw new InvalidAiOutput("tidak ada sections");

  return SECTION_KEYS.map((key) => {
    const sec = list.find((s) => (s as { key?: unknown })?.key === key) as { points?: unknown; terms?: unknown } | undefined;
    if (!sec || !Array.isArray(sec.points) || sec.points.length < 1 || sec.points.length > 6) {
      throw new InvalidAiOutput(`bagian ${key} tidak valid`);
    }
    const points: BedahPoint[] = sec.points.map((p) => {
      const { tone, lead, text } = (p ?? {}) as { tone?: unknown; lead?: unknown; text?: unknown };
      if (typeof text !== "string" || text.trim().length < 15 || text.length > 700) throw new InvalidAiOutput(`teks ${key} tidak valid`);
      if (FORBIDDEN.test(text) || (typeof lead === "string" && FORBIDDEN.test(lead))) throw new InvalidAiOutput(`bahasa rekomendasi di ${key}`);
      const cleanLead = typeof lead === "string" && lead.trim() && lead.trim().toLowerCase() !== "null" && lead.length <= 30 ? lead.trim() : undefined;
      return {
        tone: TONES.includes(tone as PointTone) ? (tone as PointTone) : "info",
        ...(cleanLead ? { lead: cleanLead } : {}),
        text: text.trim(),
      };
    });
    const terms = Array.isArray(sec.terms)
      ? [...new Set(sec.terms.filter((t): t is string => typeof t === "string").filter(isTermId))].slice(0, 8)
      : [];
    return { key, title: SECTION_TITLES[key], points, terms };
  });
}

/**
 * Hanya berjalan saat cache kosong. Cek kredit ada di sini (bukan sebelum membaca cache), sehingga narasi AI
 * yang sudah tersimpan tetap tampil walau kredit habis — membacanya tidak memakai kredit.
 */
async function generate(inputJson: string): Promise<BedahSection[]> {
  if (isTokenKodingBlocked()) throw new AiSkipped("AI sementara tidak tersedia");
  const credits = await getTokenKodingCredits();
  if (credits != null && credits < MIN_CREDITS) {
    blockTokenKoding("credits");
    throw new AiSkipped("kredit AI habis");
  }
  const { content } = await chatJson(SYSTEM_PROMPT, inputJson);
  return parseSections(content);
}

/**
 * Cache per saham per tanggal data. Kunci SENGAJA tidak memuat data input: sebagian input (mis. rasio volume
 * dari Yahoo) berubah sepanjang jam bursa, dan bila ikut jadi kunci AI akan dipanggil berulang kali per hari.
 * Input pertama hari itu yang dipakai. Error (API gagal/kredit habis/output tidak valid) tidak ikut di-cache.
 * Catatan: kunci unstable_cache juga memuat teks fungsi, yang berubah tiap build, jadi cache mulai kosong
 * lagi setelah deploy (tiap saham dibuat ulang sekali, ±4 kredit).
 */
function generateCached(symbol: string, date: string, inputJson: string) {
  return unstable_cache(() => generate(inputJson), ["bedah-ai", PROMPT_VERSION, TOKENKODING_MODEL, symbol, date], {
    revalidate: 60 * 60 * 36,
    tags: ["bedah-ai", `bedah-ai:${symbol}`],
  })();
}

/** Cegah beberapa request bersamaan untuk saham yang sama memanggil AI berkali-kali. */
const inflight = new Map<string, Promise<BedahSection[]>>();
/** Output AI yang ditolak tidak di-cache; tahan percobaan ulang per saham agar kredit tidak terbuang. */
const rejectedUntil = new Map<string, number>();
const REJECT_MS = 30 * 60_000;

export type BedahResult =
  | { source: "ai"; model: string; sections: BedahSection[] }
  | { source: "rules"; sections: BedahSection[]; reason: string };

export async function getBedahNarrative(
  stock: Stock,
  f: Fundamentals | null,
  ctx: BedahContext,
  rules: BedahSection[],
): Promise<BedahResult> {
  const fallback = (reason: string): BedahResult => ({ source: "rules", sections: rules, reason });

  if (!isTokenKodingConfigured) return fallback("AI belum dikonfigurasi");

  const input = bedahAiInput(stock, f, ctx);
  const inputJson = JSON.stringify(input);
  const key = `${stock.symbol}:${input.tanggal_data}`;
  if ((rejectedUntil.get(key) ?? 0) > Date.now()) return fallback("output AI tidak lolos pemeriksaan");

  try {
    let job = inflight.get(key);
    if (!job) {
      job = generateCached(stock.symbol, input.tanggal_data ?? "-", inputJson).finally(() => inflight.delete(key));
      inflight.set(key, job);
    }
    return { source: "ai", model: TOKENKODING_MODEL, sections: await job };
  } catch (e) {
    if (e instanceof AiSkipped) return fallback(e.message);
    if (e instanceof TokenKodingError) {
      blockTokenKoding(e.kind);
      console.warn(`[bedah-ai] ${stock.symbol}: ${e.message} → pakai versi aturan`);
      return fallback(e.kind === "credits" ? "kredit AI habis" : "AI sementara tidak tersedia");
    }
    rejectedUntil.set(key, Date.now() + REJECT_MS);
    console.warn(`[bedah-ai] ${stock.symbol}: output AI ditolak (${(e as Error).message}) → pakai versi aturan`);
    return fallback("output AI tidak lolos pemeriksaan");
  }
}
