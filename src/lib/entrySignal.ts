import type { Fundamentals, Stock } from "./types";
import type { TechnicalSummary } from "./indicators";

export type CheckStatus = "pass" | "warn" | "fail";

export interface QualityCheck {
  label: string;
  status: CheckStatus;
  text: string;
}

export type Verdict = "buy" | "accumulate" | "hold" | "expensive" | "avoid";

export interface EntrySignal {
  verdict: Verdict;
  title: string;
  summary: string;
  /** 0–100, dari rasio fundamental yang datanya tersedia */
  quality: number;
  checks: QualityCheck[];
  /** (harga wajar − harga) / harga wajar × 100. Positif = diskon. */
  marginOfSafety: number | null;
  plan: {
    /** Batas atas area beli (diskon 10% dari harga wajar) */
    zoneHigh: number;
    /** Harga beli ideal (diskon 25% dari harga wajar) */
    idealPrice: number;
    /** Target = harga wajar rata-rata */
    target: number;
    upside: number;
    /** Batas tinjau ulang: −15% dari harga masuk */
    reviewPrice: number;
    /** Rencana cicil 3 tahap */
    tranches: { price: number; portion: number }[];
  } | null;
  timing: { tone: "good" | "neutral" | "bad"; text: string }[];
}

/** Margin of safety minimum untuk tiap level. */
const MOS_BUY = 25;
const MOS_ACCUMULATE = 10;

/** Fraksi harga (tick size) BEI. */
export function tickSize(price: number) {
  if (price < 200) return 1;
  if (price < 500) return 2;
  if (price < 2000) return 5;
  if (price < 5000) return 10;
  return 25;
}

/** Bulatkan ke bawah sesuai fraksi harga agar bisa dipasang sebagai order beli. */
export function roundToTick(price: number) {
  const t = tickSize(price);
  return Math.max(t, Math.floor(price / t) * t);
}

/** Bank/keuangan: DER & current ratio tidak relevan (bisnisnya memang mengelola dana pihak lain). */
export const isFinancial = (s: Pick<Stock, "sector" | "subSector" | "industry">) => /keuangan|financ|bank/i.test(`${s.sector} ${s.subSector} ${s.industry}`);

function rate(v: number | null | undefined, good: number, ok: number): CheckStatus | null {
  if (v == null || !Number.isFinite(v)) return null;
  return v >= good ? "pass" : v >= ok ? "warn" : "fail";
}

function rateLow(v: number | null | undefined, good: number, ok: number): CheckStatus | null {
  if (v == null || !Number.isFinite(v)) return null;
  return v < good ? "pass" : v < ok ? "warn" : "fail";
}

const pct = (v: number) => `${v.toFixed(1).replace(".", ",")}%`;

function qualityChecks(stock: Stock, f: Fundamentals | null): QualityCheck[] {
  const out: QualityCheck[] = [];
  const add = (label: string, status: CheckStatus | null, text: string) => status && out.push({ label, status, text });

  add("Laba positif", stock.peRatio == null ? null : stock.peRatio > 0 ? "pass" : "fail",
    stock.peRatio != null && stock.peRatio > 0 ? "Perusahaan mencetak laba." : "Perusahaan sedang rugi — valuasi berbasis laba tidak berlaku.");
  add("ROE", rate(stock.roe, 15, 8), stock.roe == null ? "" : `ROE ${pct(stock.roe)} (bagus ≥ 15%).`);
  add("Net margin", rate(f?.netMargin, 15, 5), f?.netMargin == null ? "" : `Margin bersih ${pct(f.netMargin)}.`);
  add("Pertumbuhan laba", rate(f?.earningsGrowth, 10, 0), f?.earningsGrowth == null ? "" : `Laba ${f.earningsGrowth >= 0 ? "naik" : "turun"} ${pct(Math.abs(f.earningsGrowth))} YoY.`);
  add("Pertumbuhan pendapatan", rate(f?.revenueGrowth, 5, 0), f?.revenueGrowth == null ? "" : `Pendapatan ${f.revenueGrowth >= 0 ? "naik" : "turun"} ${pct(Math.abs(f.revenueGrowth))} YoY.`);
  // Bank & lembaga keuangan wajar ber-DER tinggi & tidak memakai current ratio
  if (!isFinancial(stock)) {
    add("Utang (DER)", rateLow(f?.der, 50, 100), f?.der == null ? "" : `DER ${pct(f.der)} (aman < 50%).`);
    add("Likuiditas", rate(f?.currentRatio, 1.5, 1), f?.currentRatio == null ? "" : `Current ratio ${f.currentRatio.toFixed(2).replace(".", ",")}x.`);
  }
  return out;
}

function timingNotes(tech: TechnicalSummary | null): EntrySignal["timing"] {
  if (!tech) return [];
  const notes: EntrySignal["timing"] = [];
  if (tech.trend === "bearish") notes.push({ tone: "bad", text: "Tren harga masih turun — cicil bertahap, jangan beli sekaligus." });
  else if (tech.trend === "bullish") notes.push({ tone: "good", text: "Tren harga sedang naik — momentum mendukung entry." });
  else notes.push({ tone: "neutral", text: "Harga bergerak sideways — cocok untuk antre beli di area bawah." });
  if (tech.rsi != null && tech.rsi >= 70) notes.push({ tone: "bad", text: `RSI ${tech.rsi.toFixed(0)} (jenuh beli) — tunggu pullback sebelum menambah.` });
  else if (tech.rsi != null && tech.rsi <= 30) notes.push({ tone: "good", text: `RSI ${tech.rsi.toFixed(0)} (jenuh jual) — berpeluang memantul.` });
  if (tech.macdCross === "golden") notes.push({ tone: "good", text: "MACD baru golden cross — tanda awal pembalikan naik." });
  else if (tech.macdCross === "death") notes.push({ tone: "bad", text: "MACD baru death cross — momentum melemah." });
  return notes;
}

/**
 * Sinyal entry berbasis fundamental: gabungan kualitas bisnis (rasio keuangan) dan
 * margin of safety terhadap harga wajar rata-rata. Teknikal hanya dipakai untuk catatan timing.
 */
export function entrySignal(
  stock: Stock,
  fundamentals: Fundamentals | null,
  fairValue: number | null,
  tech: TechnicalSummary | null,
): EntrySignal {
  const checks = qualityChecks(stock, fundamentals);
  const points = { pass: 1, warn: 0.5, fail: 0 } as const;
  // Tanpa data rasio sama sekali → netral (50), bukan otomatis "lemah"
  const quality = checks.length ? Math.round((checks.reduce((a, c) => a + points[c.status], 0) / checks.length) * 100) : 50;
  const timing = timingNotes(tech);
  const price = stock.price;

  if (!fairValue || !price) {
    return {
      verdict: "avoid",
      title: "Tidak dapat dinilai",
      summary: "Harga wajar tidak bisa dihitung karena laba atau ekuitas negatif. Saham seperti ini spekulatif untuk investor fundamental.",
      quality, checks, marginOfSafety: null, plan: null, timing,
    };
  }

  const mos = ((fairValue - price) / fairValue) * 100;
  const zoneHigh = roundToTick(fairValue * (1 - MOS_ACCUMULATE / 100));
  const idealPrice = roundToTick(fairValue * (1 - MOS_BUY / 100));
  // Tahap 1 di harga sekarang bila sudah di area beli, sisanya makin murah
  const start = Math.min(price, zoneHigh);
  const tranches = [
    { price: roundToTick(start), portion: 30 },
    { price: roundToTick(Math.min(start * 0.95, (start + idealPrice) / 2)), portion: 30 },
    { price: roundToTick(Math.min(start * 0.9, idealPrice)), portion: 40 },
  ];
  const plan = {
    zoneHigh,
    idealPrice,
    target: roundToTick(fairValue),
    upside: (fairValue / price - 1) * 100,
    reviewPrice: roundToTick(tranches[2].price * 0.85),
    tranches,
  };
  const base = { quality, checks, marginOfSafety: mos, plan, timing };

  if (quality < 40) {
    return {
      ...base,
      verdict: "avoid",
      title: mos > 0 ? "Murah, tapi fundamental lemah" : "Hindari",
      summary:
        mos > 0
          ? `Harga ${pct(mos)} di bawah harga wajar, namun kualitas bisnisnya rendah (skor ${quality}). Waspadai value trap — murah karena memang ada masalah.`
          : `Kualitas bisnis rendah (skor ${quality}) dan harga tidak murah. Belum layak dibeli.`,
    };
  }
  if (mos >= MOS_BUY && quality >= 60) {
    return {
      ...base,
      verdict: "buy",
      title: "Layak beli",
      summary: `Fundamental bagus (skor ${quality}) dan harga ${pct(mos)} di bawah harga wajar — margin of safety lebar.`,
    };
  }
  if (mos >= MOS_ACCUMULATE) {
    return {
      ...base,
      verdict: "accumulate",
      title: "Akumulasi bertahap",
      summary: `Harga ${pct(mos)} di bawah harga wajar dengan fundamental ${quality >= 60 ? "bagus" : "cukup"} (skor ${quality}). Beli dicicil; tambah lebih banyak bila turun ke harga ideal.`,
    };
  }
  if (mos >= -MOS_ACCUMULATE) {
    return {
      ...base,
      verdict: "hold",
      title: "Harga wajar — tunggu",
      summary: `Harga sudah dekat harga wajar (selisih ${pct(Math.abs(mos))}). Ruang naik terbatas; pasang antrean di area beli ${zoneHigh.toLocaleString("id-ID")} ke bawah.`,
    };
  }
  return {
    ...base,
    verdict: "expensive",
    title: "Mahal — tunggu koreksi",
    summary: `Harga ${pct(-mos)} di atas harga wajar. Tunggu koreksi ke area beli ${zoneHigh.toLocaleString("id-ID")} ke bawah.`,
  };
}
