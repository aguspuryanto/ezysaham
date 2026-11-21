import type { Candle } from "./types";

export interface LinePoint {
  time: string;
  value: number;
}

/** Simple Moving Average — nilai terakhir. */
export function calcSMA(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  return closes.slice(-period).reduce((a, b) => a + b, 0) / period;
}

/** Deret SMA (null untuk indeks yang belum cukup data). */
export function smaSeries(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

/** Deret EMA, diinisialisasi dengan SMA periode pertama. */
export function emaSeries(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < period) return out;
  const k = 2 / (period + 1);
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/** Deret RSI dengan smoothing Wilder (standar di platform trading). */
export function rsiSeries(closes: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(closes.length).fill(null);
  if (closes.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  const rsi = () => (avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
  out[period] = rsi();
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
    out[i] = rsi();
  }
  return out;
}

/** RSI terakhir (14 periode). */
export function calcRSI(closes: number[], period = 14): number | null {
  const s = rsiSeries(closes, period);
  return s.at(-1) ?? null;
}

export interface MACDResult {
  macd: (number | null)[];
  signal: (number | null)[];
  histogram: (number | null)[];
}

/** MACD (12, 26, 9) lengkap dengan signal line & histogram. */
export function macdSeries(closes: number[], fast = 12, slow = 26, signalPeriod = 9): MACDResult {
  const ef = emaSeries(closes, fast);
  const es = emaSeries(closes, slow);
  const macd = closes.map((_, i) => (ef[i] != null && es[i] != null ? ef[i]! - es[i]! : null));
  const firstIdx = macd.findIndex((v) => v != null);
  const signal: (number | null)[] = new Array(closes.length).fill(null);
  if (firstIdx >= 0) {
    const sig = emaSeries(macd.slice(firstIdx) as number[], signalPeriod);
    sig.forEach((v, j) => (signal[firstIdx + j] = v));
  }
  const histogram = macd.map((m, i) => (m != null && signal[i] != null ? m - signal[i]! : null));
  return { macd, signal, histogram };
}

export function calcMACD(closes: number[]) {
  const r = macdSeries(closes);
  const last = closes.length - 1;
  if (last < 0 || r.macd[last] == null) return null;
  return { macd: r.macd[last]!, signal: r.signal[last], histogram: r.histogram[last] };
}

/** Ubah deret angka menjadi titik chart (membuang null). */
export function toLine(candles: Candle[], series: (number | null)[]): LinePoint[] {
  const out: LinePoint[] = [];
  series.forEach((v, i) => {
    if (v != null && Number.isFinite(v)) out.push({ time: candles[i].time, value: v });
  });
  return out;
}

export type Signal = "bullish" | "bearish" | "neutral";

export interface TechnicalSummary {
  price: number;
  sma20: number | null;
  sma50: number | null;
  rsi: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHist: number | null;
  /** Rata-rata volume 20 hari */
  avgVolume20: number | null;
  trend: Signal;
  rsiSignal: Signal;
  macdCross: "golden" | "death" | null;
  tips: { tone: Signal; title: string; text: string }[];
}

/** Ringkasan teknikal + tips kontekstual berbahasa sederhana untuk pemula. */
export function summarizeTechnicals(candles: Candle[]): TechnicalSummary | null {
  if (candles.length < 30) return null;
  const closes = candles.map((c) => c.close);
  const price = closes.at(-1)!;
  const sma20 = calcSMA(closes, 20);
  const sma50 = calcSMA(closes, 50);
  const rsi = calcRSI(closes);
  const m = macdSeries(closes);
  const n = closes.length - 1;
  const macd = m.macd[n];
  const macdSignal = m.signal[n];
  const macdHist = m.histogram[n];
  const avgVolume20 = calcSMA(candles.map((c) => c.volume), 20);

  // Persilangan MACD dalam 5 bar terakhir
  let macdCross: TechnicalSummary["macdCross"] = null;
  for (let i = n; i > n - 5 && i > 0; i--) {
    const a = m.histogram[i - 1];
    const b = m.histogram[i];
    if (a == null || b == null) continue;
    if (a < 0 && b >= 0) { macdCross = "golden"; break; }
    if (a > 0 && b <= 0) { macdCross = "death"; break; }
  }

  let trend: Signal = "neutral";
  if (sma20 != null && sma50 != null) {
    if (price > sma20 && sma20 > sma50) trend = "bullish";
    else if (price < sma20 && sma20 < sma50) trend = "bearish";
  }
  const rsiSignal: Signal = rsi == null ? "neutral" : rsi >= 70 ? "bearish" : rsi <= 30 ? "bullish" : "neutral";

  const tips: TechnicalSummary["tips"] = [];
  if (trend === "bullish")
    tips.push({ tone: "bullish", title: "Tren naik", text: "Harga di atas SMA 20 dan SMA 20 di atas SMA 50. Secara umum tren jangka pendek sedang menguat." });
  else if (trend === "bearish")
    tips.push({ tone: "bearish", title: "Tren turun", text: "Harga di bawah SMA 20 dan SMA 20 di bawah SMA 50. Hati-hati, tren sedang melemah — tunggu tanda pembalikan sebelum masuk." });
  else
    tips.push({ tone: "neutral", title: "Tren sideways", text: "Harga dan rata-rata bergerak belum menunjukkan arah yang jelas. Cocok untuk wait and see." });

  if (rsi != null) {
    if (rsi >= 70)
      tips.push({ tone: "bearish", title: `RSI ${rsi.toFixed(0)} — overbought`, text: "RSI di atas 70 berarti harga sudah naik cukup kencang dan berpotensi koreksi. Hindari membeli di pucuk." });
    else if (rsi <= 30)
      tips.push({ tone: "bullish", title: `RSI ${rsi.toFixed(0)} — oversold`, text: "RSI di bawah 30 berarti harga sudah turun dalam. Bisa jadi peluang pantulan, tapi pastikan fundamentalnya sehat." });
    else
      tips.push({ tone: "neutral", title: `RSI ${rsi.toFixed(0)} — normal`, text: "RSI berada di area 30–70, belum jenuh beli maupun jenuh jual." });
  }

  if (macdCross === "golden")
    tips.push({ tone: "bullish", title: "MACD golden cross", text: "Garis MACD baru saja memotong signal ke atas — sinyal awal momentum naik." });
  else if (macdCross === "death")
    tips.push({ tone: "bearish", title: "MACD death cross", text: "Garis MACD baru saja memotong signal ke bawah — momentum mulai melemah." });

  const lastVol = candles.at(-1)!.volume;
  if (avgVolume20 && lastVol > avgVolume20 * 2)
    tips.push({ tone: "neutral", title: "Lonjakan volume", text: `Volume hari terakhir ${(lastVol / avgVolume20).toFixed(1)}x rata-rata 20 hari. Ada minat besar — perhatikan arah harganya.` });

  return { price, sma20, sma50, rsi, macd, macdSignal, macdHist, avgVolume20, trend, rsiSignal, macdCross, tips };
}
