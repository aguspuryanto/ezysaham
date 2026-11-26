import "server-only";
import { unstable_cache } from "next/cache";
import type { BedahPoint, PointTone } from "./bedahData";
import { bedahAiInput } from "./bedahAi";
import {
  ANOMALY_KEYS,
  ANOMALY_TITLES,
  missingData,
  type ActionVerdict,
  type AnomalyContext,
  type AnomalyReport,
  type RiskLevel,
} from "./anomaly";
import { isHsc } from "./hsc";
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
 * "Fundamental Anomaly Detector" oleh AI (prompt: docs/ANOMALY_FUNDAMENTAL.md), dengan fallback ke versi aturan.
 * Pola sama dengan bedahAi.ts: cache per saham per tanggal data, cek kredit, circuit breaker, validasi output.
 * "Missing data" dan tingkat keyakinan dihitung sendiri (deterministik), bukan dari AI.
 */

const PROMPT_VERSION = "v1";
const MIN_CREDITS = 25;
const TONES: PointTone[] = ["danger", "warn", "info", "good"];
const RISKS: RiskLevel[] = ["LOW", "MEDIUM", "HIGH", "EXTREME"];
const VERDICTS: ActionVerdict[] = ["BUY", "WATCH", "AVOID"];

const SYSTEM_PROMPT = `Anda adalah EzySaham Fundamental Anomaly Detector. Analisis data saham berdasarkan konsistensi matematis, kualitas fundamental, valuasi, kinerja harga, likuiditas perdagangan, dan risiko pasar. Periksa terlebih dahulu periode laporan, tanggal harga, satuan, dan sumber data. Identifikasi anomali antar-metrik menggunakan rumus yang relevan, termasuk PBV ≈ PER × ROE dengan asumsi basis perhitungan konsisten. Bandingkan pertumbuhan pendapatan dan laba serta perubahan margin. Evaluasi kualitas laba melalui operating cash flow, net income, dan arus kas. Evaluasi valuasi menggunakan PER, PBV, ROE, dan metrik sektoral. Evaluasi likuiditas menggunakan free float, average traded value, volume, frequency, bid-ask spread, dan konsentrasi transaksi. Evaluasi volatilitas menggunakan beta dan rentang harga historis. Jangan menyimpulkan manipulasi pasar hanya dari lonjakan volume atau free float rendah. Jangan mengarang data atau menyamakan risiko tinggi dengan rekomendasi jual otomatis.

Pembaca adalah investor ritel pemula. Tulis dalam Bahasa Indonesia yang lugas, angka gaya Indonesia (koma desimal), dan hanya pakai angka yang ada di data. Nilai null = data tidak tersedia; field "data_tidak_tersedia" berisi daftar data yang tidak ada (termasuk arus kas operasi, bid-ask spread, konsentrasi transaksi) — sebutkan keterbatasannya, jangan diisi sendiri. Untuk sektor_keuangan: true, DER dan current ratio tidak relevan. Satuan: *_pct dalam persen, *_rp dalam Rupiah. Jangan menyebut target harga.

OUTPUT: HANYA JSON valid tanpa teks lain, bentuk:
{"sections":[{"key":"data","points":[{"tone":"danger|warn|info|good","lead":"string|null","text":"..."}]},{"key":"fundamental",...},{"key":"valuasi",...},{"key":"harga",...},{"key":"pasar",...}],
 "risk":{"level":"LOW|MEDIUM|HIGH|EXTREME","reasons":["..."]},
 "action":{"verdict":"BUY|WATCH|AVOID","reason":"...","invalidation":["..."]}}
Kunci bagian: data = 1. Data Anomaly Check, fundamental = 2. Fundamental Reality, valuasi = 3. Valuation Assessment, harga = 4. Price vs Performance, pasar = 5. Market Risk Signals.
Aturan: tiap bagian 1–4 poin, tiap "text" 1–3 kalimat (maks 400 karakter), "lead" maks 3 kata. tone: danger = risiko serius, warn = perlu diperhatikan, info = netral, good = tidak ada masalah. risk.reasons 1–4 frasa pendek. action.reason 1–2 kalimat. action.invalidation 2–4 kondisi pembatalan yang terukur.`;

const round = (v: number | null | undefined, d = 1) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d);

function anomalyAiInput(stock: Stock, f: Fundamentals | null, ctx: AnomalyContext, missing: string[]) {
  return {
    ...bedahAiInput(stock, f, ctx),
    frekuensi_transaksi: stock.frequency,
    volume_lembar: stock.volume,
    rata2_nilai_transaksi_20hari_rp: round(ctx.avgValue20, 0),
    pbv_tersirat_per_x_roe: stock.peRatio && stock.roe ? round((stock.peRatio * stock.roe) / 100, 2) : null,
    pembanding_sektor: ctx.peers
      ? { level: ctx.peers.level, grup: ctx.peers.group, jumlah_emiten: ctx.peers.count, median_per: round(ctx.peers.per), median_pbv: round(ctx.peers.pbv, 2) }
      : null,
    median_estimasi_harga_wajar: round(ctx.fairMedian, 0),
    hsc_bei: isHsc(stock.symbol),
    sumber_data: { harga_dan_rasio: "Pasardana (penutupan harian)", rasio_lain: f?.source ?? null },
    data_tidak_tersedia: missing,
  };
}

/** Bahasa yang melampaui batas (janji untung, target harga). BUY/WATCH/AVOID hanya boleh di action.verdict. */
const FORBIDDEN = /target\s+harga|cuan\s+pasti|pasti\s+(naik|untung)|dijamin|wajib\s+(beli|punya)|strong\s+buy|segera\s+(beli|jual)|(beli|borong|serok)\s+sekarang/i;

class InvalidAiOutput extends Error {}
class AiSkipped extends Error {}

type AiPart = Pick<AnomalyReport, "sections" | "risk" | "action">;

const str = (v: unknown, max: number) => {
  if (typeof v !== "string" || !v.trim() || v.length > max) throw new InvalidAiOutput("teks tidak valid");
  if (FORBIDDEN.test(v)) throw new InvalidAiOutput("bahasa terlarang");
  return v.trim();
};
const strList = (v: unknown, min: number, max: number, len: number) => {
  if (!Array.isArray(v) || v.length < min) throw new InvalidAiOutput("daftar tidak valid");
  return v.slice(0, max).map((x) => str(x, len));
};

function parse(raw: string): AiPart {
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
  } catch {
    throw new InvalidAiOutput("bukan JSON");
  }
  const list = json.sections;
  if (!Array.isArray(list)) throw new InvalidAiOutput("tidak ada sections");

  const sections = ANOMALY_KEYS.map((key) => {
    const sec = list.find((s) => (s as { key?: unknown })?.key === key) as { points?: unknown } | undefined;
    if (!sec || !Array.isArray(sec.points) || sec.points.length < 1 || sec.points.length > 6) throw new InvalidAiOutput(`bagian ${key} tidak valid`);
    const points: BedahPoint[] = sec.points.map((p) => {
      const { tone, lead, text } = (p ?? {}) as Record<string, unknown>;
      const t = str(text, 700);
      if (t.length < 15) throw new InvalidAiOutput(`teks ${key} terlalu pendek`);
      const l = typeof lead === "string" && lead.trim() && lead.trim().toLowerCase() !== "null" && lead.length <= 30 ? str(lead, 30) : undefined;
      return { tone: TONES.includes(tone as PointTone) ? (tone as PointTone) : "info", ...(l ? { lead: l } : {}), text: t };
    });
    return { key, title: ANOMALY_TITLES[key], points };
  });

  const risk = json.risk as Record<string, unknown> | undefined;
  const action = json.action as Record<string, unknown> | undefined;
  if (!risk || !RISKS.includes(risk.level as RiskLevel)) throw new InvalidAiOutput("risk tidak valid");
  if (!action || !VERDICTS.includes(action.verdict as ActionVerdict)) throw new InvalidAiOutput("action tidak valid");
  return {
    sections,
    risk: { level: risk.level as RiskLevel, reasons: strList(risk.reasons, 1, 4, 200) },
    action: { verdict: action.verdict as ActionVerdict, reason: str(action.reason, 500), invalidation: strList(action.invalidation, 1, 4, 250) },
  };
}

async function generate(inputJson: string): Promise<AiPart> {
  if (isTokenKodingBlocked()) throw new AiSkipped("AI sementara tidak tersedia");
  const credits = await getTokenKodingCredits();
  if (credits != null && credits < MIN_CREDITS) {
    blockTokenKoding("credits");
    throw new AiSkipped("kredit AI habis");
  }
  const { content } = await chatJson(SYSTEM_PROMPT, inputJson, { maxTokens: 2400 });
  return parse(content);
}

/** Cache per saham per tanggal data (lihat catatan di bedahAi.ts tentang kunci cache). */
function generateCached(symbol: string, date: string, inputJson: string) {
  return unstable_cache(() => generate(inputJson), ["anomaly-ai", PROMPT_VERSION, TOKENKODING_MODEL, symbol, date], {
    revalidate: 60 * 60 * 36,
    tags: ["anomaly-ai", `anomaly-ai:${symbol}`],
  })();
}

const inflight = new Map<string, Promise<AiPart>>();
const rejectedUntil = new Map<string, number>();
const REJECT_MS = 30 * 60_000;

export type AnomalyResult =
  | { source: "ai"; model: string; report: AnomalyReport }
  | { source: "rules"; report: AnomalyReport; reason: string };

export async function getAnomalyReport(stock: Stock, f: Fundamentals | null, ctx: AnomalyContext, rules: AnomalyReport): Promise<AnomalyResult> {
  const fallback = (reason: string): AnomalyResult => ({ source: "rules", report: rules, reason });
  if (!isTokenKodingConfigured) return fallback("AI belum dikonfigurasi");

  const { missing, confidence } = missingData(stock, f, ctx);
  const input = anomalyAiInput(stock, f, ctx, missing);
  const key = `${stock.symbol}:${input.tanggal_data}`;
  if ((rejectedUntil.get(key) ?? 0) > Date.now()) return fallback("output AI tidak lolos pemeriksaan");

  try {
    let job = inflight.get(key);
    if (!job) {
      job = generateCached(stock.symbol, input.tanggal_data ?? "-", JSON.stringify(input)).finally(() => inflight.delete(key));
      inflight.set(key, job);
    }
    const ai = await job;
    return { source: "ai", model: TOKENKODING_MODEL, report: { ...ai, missing, confidence } };
  } catch (e) {
    if (e instanceof AiSkipped) return fallback(e.message);
    if (e instanceof TokenKodingError) {
      blockTokenKoding(e.kind);
      console.warn(`[anomaly-ai] ${stock.symbol}: ${e.message} → pakai versi aturan`);
      return fallback(e.kind === "credits" ? "kredit AI habis" : "AI sementara tidak tersedia");
    }
    rejectedUntil.set(key, Date.now() + REJECT_MS);
    console.warn(`[anomaly-ai] ${stock.symbol}: output AI ditolak (${(e as Error).message}) → pakai versi aturan`);
    return fallback("output AI tidak lolos pemeriksaan");
  }
}
