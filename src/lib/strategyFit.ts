import type { Fundamentals, Stock } from "./types";
import type { TechnicalSummary } from "./indicators";
import { isFinancial, type EntrySignal } from "./entrySignal";
import { formatRupiah } from "./format";

/**
 * Kecocokan saham untuk tiap gaya (lihat docs/TRAP_INVESTING.md — "Rekomendasi saya"):
 * - Trading 1–5 hari : likuiditas, momentum, volume, dan batas risiko
 * - Swing 5–15 hari  : fundamental tidak bermasalah serius + teknikal
 * - Investasi 1–5 th : fundamental sehat, arus kas, utang, dan valuasi
 * Fundamental menentukan saham yang layak; teknikal menentukan kapan masuk.
 */
export type FitStatus = "fit" | "caution" | "avoid" | "unknown";
export type StrategyKey = "trading" | "swing" | "investasi";

export interface StrategyFit {
  key: StrategyKey;
  label: string;
  horizon: string;
  status: FitStatus;
  /** Alasan singkat, urut dari yang paling menentukan */
  reasons: string[];
}

export const FIT_LABEL: Record<FitStatus, string> = {
  fit: "Cocok",
  caution: "Waspada",
  avoid: "Hindari",
  unknown: "Data kurang",
};

/** Nilai transaksi harian rata-rata (Rp) minimum. */
const LIQ_MIN = 1e9;
const LIQ_GOOD = 5e9;

const rank: Record<FitStatus, number> = { unknown: 0, fit: 1, caution: 2, avoid: 3 };
const worst = (a: FitStatus, b: FitStatus) => (rank[b] > rank[a] ? b : a);

function avgValue(stock: Stock, tech: TechnicalSummary | null) {
  if (tech?.avgVolume20 && tech.price) return tech.avgVolume20 * tech.price;
  return stock.value || null;
}

function liquidity(stock: Stock, tech: TechnicalSummary | null): { status: FitStatus; text: string } {
  const v = avgValue(stock, tech);
  if (v == null) return { status: "unknown", text: "Data nilai transaksi tidak tersedia." };
  const txt = `Nilai transaksi rata-rata ${formatRupiah(v, true)}/hari`;
  if (v < LIQ_MIN) return { status: "avoid", text: `${txt} — saham tidak likuid, sulit keluar & spread lebar.` };
  if (v < LIQ_GOOD) return { status: "caution", text: `${txt} — likuiditas sedang.` };
  return { status: "fit", text: `${txt} — likuid.` };
}

/** Masalah fundamental serius (kategori DANGER): rugi, ROE negatif, utang berlebih, atau skor kualitas sangat rendah. */
function seriousProblems(stock: Stock, f: Fundamentals | null, signal: EntrySignal): string[] {
  const out: string[] = [];
  if (stock.peRatio != null && stock.peRatio <= 0) out.push("Perusahaan sedang rugi.");
  else if (stock.roe != null && stock.roe < 0) out.push("ROE negatif.");
  if (!isFinancial(stock) && f?.der != null && f.der > 200) out.push(`DER ${f.der.toFixed(0)}% — utang sangat tinggi.`);
  if (f?.earningsGrowth != null && f.earningsGrowth <= -50) out.push(`Laba turun ${Math.abs(f.earningsGrowth).toFixed(0)}% YoY.`);
  if (signal.checks.length >= 3 && signal.quality < 40) out.push(`Skor kualitas fundamental rendah (${signal.quality}).`);
  return out;
}

function trading(stock: Stock, tech: TechnicalSummary | null): StrategyFit {
  const base = { key: "trading" as const, label: "Trading", horizon: "1–5 hari" };
  if (!tech) return { ...base, status: "unknown", reasons: ["Riwayat harga kurang untuk analisis teknikal."] };

  const liq = liquidity(stock, tech);
  let status: FitStatus = liq.status === "unknown" ? "caution" : liq.status;
  const reasons = [liq.text];

  // Momentum
  if (tech.trend === "bullish") reasons.push("Tren naik (harga > SMA20 > SMA50).");
  else if (tech.trend === "bearish") {
    status = worst(status, "avoid");
    reasons.push("Tren turun — momentum tidak mendukung.");
  } else {
    status = worst(status, tech.macdCross === "golden" ? "fit" : "caution");
    reasons.push(tech.macdCross === "golden" ? "Sideways, tapi MACD baru golden cross." : "Tren sideways — belum ada momentum.");
  }

  // Volume
  const volRatio = tech.avgVolume20 ? stock.volume / tech.avgVolume20 : null;
  if (volRatio != null) {
    if (volRatio >= 1.5) reasons.push(`Volume ${volRatio.toFixed(1)}x rata-rata 20 hari — ada minat beli.`);
    else if (volRatio < 0.5) {
      status = worst(status, "caution");
      reasons.push(`Volume hanya ${volRatio.toFixed(1)}x rata-rata — kenaikan kurang terkonfirmasi.`);
    }
  }

  // Batas risiko
  if (tech.rsi != null && tech.rsi >= 75) {
    status = worst(status, "caution");
    reasons.push(`RSI ${tech.rsi.toFixed(0)} — jenuh beli, risiko koreksi tinggi.`);
  }
  if (tech.macdCross === "death") {
    status = worst(status, "caution");
    reasons.push("MACD baru death cross.");
  }
  return { ...base, status, reasons };
}

function swing(stock: Stock, f: Fundamentals | null, tech: TechnicalSummary | null, signal: EntrySignal): StrategyFit {
  const base = { key: "swing" as const, label: "Swing", horizon: "5–15 hari" };
  const problems = seriousProblems(stock, f, signal);
  if (problems.length) return { ...base, status: "avoid", reasons: [...problems, "Fundamental bermasalah serius — jangan swing walau teknikal bagus."] };
  if (!tech) return { ...base, status: "unknown", reasons: ["Fundamental aman, tapi riwayat harga kurang untuk analisis teknikal."] };

  const reasons = ["Tidak ada masalah fundamental serius."];
  let status: FitStatus = "fit";

  const liq = liquidity(stock, tech);
  if (liq.status === "avoid") status = "avoid";
  if (liq.status !== "fit") reasons.push(liq.text);

  if (tech.trend === "bullish") reasons.push("Tren naik mendukung.");
  else if (tech.trend === "bearish") {
    const rebound = tech.rsi != null && tech.rsi <= 30;
    status = worst(status, "caution");
    reasons.push(rebound ? "Tren turun, tapi RSI jenuh jual — tunggu konfirmasi pantulan." : "Tren turun — tunggu pembalikan.");
  } else {
    status = worst(status, tech.macdCross === "golden" ? "fit" : "caution");
    reasons.push(tech.macdCross === "golden" ? "Sideways dengan MACD golden cross." : "Tren sideways — tunggu breakout.");
  }
  if (tech.rsi != null && tech.rsi >= 70) {
    status = worst(status, "caution");
    reasons.push(`RSI ${tech.rsi.toFixed(0)} — jenuh beli, tunggu pullback.`);
  }
  if (signal.quality < 60) {
    status = worst(status, "caution");
    reasons.push(`Kualitas fundamental sedang (skor ${signal.quality}).`);
  }
  return { ...base, status, reasons };
}

function investasi(stock: Stock, f: Fundamentals | null, signal: EntrySignal): StrategyFit {
  const base = { key: "investasi" as const, label: "Investasi", horizon: "1–5 tahun" };
  if (signal.checks.length < 2) return { ...base, status: "unknown", reasons: ["Data fundamental belum cukup untuk menilai kelayakan investasi."] };

  const problems = seriousProblems(stock, f, signal);
  if (problems.length) return { ...base, status: "avoid", reasons: [...problems, "Hindari untuk jangka panjang sampai ada bukti pemulihan fundamental."] };

  const reasons: string[] = [];
  let status: FitStatus;
  if (signal.quality >= 60) {
    reasons.push(`Fundamental sehat (skor ${signal.quality}).`);
    status = "fit";
  } else {
    reasons.push(`Fundamental cukup (skor ${signal.quality}) — ada beberapa risiko.`);
    status = "caution";
  }

  // Utang
  if (!isFinancial(stock) && f?.der != null && f.der >= 100) {
    status = worst(status, "caution");
    reasons.push(`DER ${f.der.toFixed(0)}% — utang perlu diperiksa.`);
  }
  if (!isFinancial(stock) && f?.currentRatio != null && f.currentRatio < 1) {
    status = worst(status, "caution");
    reasons.push(`Current ratio ${f.currentRatio.toFixed(2)}x — potensi tekanan likuiditas.`);
  }
  // Dividen tidak berkelanjutan
  if (f?.payoutRatio != null && f.payoutRatio > 100) {
    status = worst(status, "caution");
    reasons.push(`Payout ratio ${f.payoutRatio.toFixed(0)}% — dividen melebihi laba.`);
  }
  // Valuasi
  const mos = signal.marginOfSafety;
  if (mos == null) {
    status = worst(status, "caution");
    reasons.push("Harga wajar tidak dapat dihitung.");
  } else if (mos >= 10) reasons.push(`Harga ${mos.toFixed(0)}% di bawah harga wajar.`);
  else if (mos >= -10) reasons.push("Harga mendekati harga wajar — ruang naik terbatas.");
  else {
    status = worst(status, "caution");
    reasons.push(`Harga ${Math.abs(mos).toFixed(0)}% di atas harga wajar — tunggu koreksi.`);
  }
  reasons.push("Arus kas operasi belum tersedia di data — periksa laporan keuangan.");
  return { ...base, status, reasons };
}

export function strategyFit(
  stock: Stock,
  fundamentals: Fundamentals | null,
  tech: TechnicalSummary | null,
  signal: EntrySignal,
): StrategyFit[] {
  return [trading(stock, tech), swing(stock, fundamentals, tech, signal), investasi(stock, fundamentals, signal)];
}
