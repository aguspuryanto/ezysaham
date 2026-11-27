import type { Candle, Stock } from "./types";
import type { EntrySignal } from "./entrySignal";
import { calcRSI, emaSeries, smaSeries } from "./indicators";
import { formatPrice } from "./format";

/**
 * FOMO Detector (docs/VERDICT_LABEL.md §4): peringatan saat harga sudah terlalu tinggi
 * atau bergerak terlalu cepat — membantu pemula mengenali risiko mengejar harga.
 * Bahasa informatif, bukan instruksi transaksi.
 */
export interface FomoWarning {
  key: "fast" | "ema" | "rsi" | "volume" | "resistance" | "divergence";
  title: string;
  text: string;
  /** bad = risiko FOMO, warn = perlu diperhatikan */
  tone: "bad" | "warn";
}

export interface FomoResult {
  warnings: FomoWarning[];
  /** Jumlah pemeriksaan yang datanya tersedia */
  checked: number;
}

const FAST_WEEK = 15; // % kenaikan 5 hari bursa
const FAST_MONTH = 30; // % kenaikan 21 hari bursa
const EMA_GAP = 10; // % di atas EMA20
const RSI_HOT = 75;
const VOL_SPIKE = 3; // × rata-rata volume 20 hari
const NEAR_RES = 3; // % di bawah resistance
const RES_LOOKBACK = 120; // hari bursa
const QUALITY_GOOD = 60;

const pct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1).replace(".", ",")}%`;
const num = (v: number, d = 1) => v.toFixed(d).replace(".", ",");

export function fomoDetector(stock: Stock, candles: Candle[], signal: EntrySignal): FomoResult | null {
  if (candles.length < 30) return null;
  const closes = candles.map((c) => c.close);
  const n = closes.length - 1;
  const price = stock.price || closes[n];
  const from = (base: number) => ((price - base) / base) * 100;
  const warnings: FomoWarning[] = [];
  let checked = 0;

  // 1. Harga naik terlalu cepat
  const week = closes[n - 5] ? from(closes[n - 5]) : null;
  const month = closes[n - 21] ? from(closes[n - 21]) : null;
  if (week != null || month != null) {
    checked++;
    if ((week ?? -Infinity) >= FAST_WEEK || (month ?? -Infinity) >= FAST_MONTH) {
      const parts = [week != null && `${pct(week)} dalam 5 hari`, month != null && `${pct(month)} dalam sebulan`].filter(Boolean);
      warnings.push({ key: "fast", tone: "bad", title: "Waspada kenaikan harga ekstrem", text: `Harga naik ${parts.join(" dan ")}.` });
    }
  }

  // 2. Harga jauh di atas EMA20
  const ema20 = emaSeries(closes, 20)[n];
  if (ema20 != null && ema20 > 0) {
    checked++;
    const gap = from(ema20);
    if (gap >= EMA_GAP) {
      warnings.push({
        key: "ema",
        tone: "bad",
        title: "Harga menjauh dari rata-rata",
        text: `Harga ${pct(gap)} di atas EMA20 (≈ ${formatPrice(ema20)}). Harga yang terlalu jauh dari rata-rata rawan terkoreksi.`,
      });
    }
  }

  // 3. RSI di atas 75
  const rsi = calcRSI(closes);
  if (rsi != null) {
    checked++;
    if (rsi > RSI_HOT) {
      warnings.push({ key: "rsi", tone: "bad", title: "Momentum mulai jenuh", text: `RSI(14) ${rsi.toFixed(0)}, di atas ${RSI_HOT}.` });
    }
  }

  // 4. Volume melonjak ekstrem (hari terakhir vs rata-rata 20 hari sebelumnya)
  const prevVols = candles.slice(Math.max(0, n - 20), n).map((c) => c.volume);
  const avgVol = prevVols.length ? prevVols.reduce((a, v) => a + v, 0) / prevVols.length : 0;
  if (avgVol > 0) {
    checked++;
    const ratio = candles[n].volume / avgVol;
    if (ratio >= VOL_SPIKE) {
      warnings.push({
        key: "volume",
        tone: "bad",
        title: "Aktivitas transaksi tidak biasa",
        text: `Volume hari bursa terakhir ${num(ratio)}x rata-rata 20 hari.`,
      });
    }
  }

  // 5. Harga dekat resistance (tertinggi beberapa bulan terakhir, belum ditembus)
  const past = candles.slice(Math.max(0, n - RES_LOOKBACK), n);
  if (past.length >= 20) {
    checked++;
    const res = Math.max(...past.map((c) => c.high));
    const below = ((res - price) / res) * 100;
    if (below >= 0 && below <= NEAR_RES) {
      warnings.push({
        key: "resistance",
        tone: "warn",
        title: "Perhatikan risiko penolakan harga",
        text: `Harga ${num(below)}% di bawah level tertinggi ${past.length} hari bursa (≈ ${formatPrice(res)}).`,
      });
    }
  }

  // 6. Fundamental bagus, teknikal lemah (harga di bawah MA50)
  const sma50 = smaSeries(closes, 50)[n];
  if (signal.checks.length && signal.quality >= QUALITY_GOOD && sma50 != null) {
    checked++;
    if (price < sma50) {
      warnings.push({
        key: "divergence",
        tone: "warn",
        title: "Fundamental positif, momentum belum mendukung",
        text: `Skor kualitas ${signal.quality}, tetapi harga masih di bawah MA50 (≈ ${formatPrice(sma50)}).`,
      });
    }
  }

  return { warnings, checked };
}
