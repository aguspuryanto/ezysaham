import type { Candle, Fundamentals, Stock } from "./types";
import { calcRSI, smaSeries } from "./indicators";
import { formatPrice } from "./format";

/**
 * Deteksi fase harga: "FASE AKUMULASI" (sinyal awal bandar masuk) vs "TERLAMBAT BELI / FOMO".
 * - Flag hijau bila ≥ 3 dari 5 kriteria akumulasi terpenuhi.
 * - Flag merah bila ≥ 2 dari 5 kriteria FOMO terpenuhi (didahulukan atas flag hijau).
 */
export type PhaseStatus = "accumulation" | "fomo" | "neutral" | "unknown";

export interface PhaseCriterion {
  label: string;
  /** null = data tidak tersedia */
  met: boolean | null;
  text: string;
}

export interface PhaseFlag {
  status: PhaseStatus;
  green: PhaseCriterion[];
  red: PhaseCriterion[];
  greenCount: number;
  redCount: number;
  action: string;
}

const GREEN_MIN = 3;
const RED_MIN = 2;

const pct = (v: number, d = 0) => `${v >= 0 ? "+" : ""}${v.toFixed(d)}%`;

/** Candle shooting star: ekor atas ≥ 2× badan & ≥ 50% rentang, penutupan di sepertiga bawah. */
function isShootingStar(c: Candle) {
  const range = c.high - c.low;
  if (range <= 0) return false;
  const body = Math.abs(c.close - c.open);
  const upper = c.high - Math.max(c.open, c.close);
  return upper >= 2 * body && upper >= range * 0.5 && Math.max(c.open, c.close) - c.low <= range * 0.4;
}

export function phaseFlag(stock: Stock, f: Fundamentals | null, candles: Candle[]): PhaseFlag {
  const empty = { green: [], red: [], greenCount: 0, redCount: 0 };
  if (candles.length < 60) {
    return { ...empty, status: "unknown", action: "Riwayat harga kurang (< 60 hari bursa) untuk menghasilkan penilaian yang dapat diandalkan." };
  }

  const closes = candles.map((c) => c.close);
  const vols = candles.map((c) => c.volume);
  const n = closes.length - 1;
  const price = stock.price || closes[n];
  const sma20s = smaSeries(closes, 20);
  const sma50s = smaSeries(closes, 50);
  const avgVol20s = smaSeries(vols, 20);
  const sma20 = sma20s[n]!;
  const sma50 = sma50s[n]!;
  const rsi = calcRSI(closes);

  const month = closes[n - 21] ? ((price - closes[n - 21]) / closes[n - 21]) * 100 : stock.returns.month;
  const week = closes[n - 5] ? ((price - closes[n - 5]) / closes[n - 5]) * 100 : null;

  // Area konsolidasi: 20 hari bursa sebelum hari ini
  const base = closes.slice(n - 20, n);
  const baseHi = Math.max(...base);
  const baseLo = Math.min(...base);
  const baseRange = ((baseHi - baseLo) / baseLo) * 100;

  // Golden cross SMA20 > SMA50 dalam 10 hari terakhir
  let goldenCross = false;
  for (let i = n; i > n - 10; i--) {
    const a20 = sma20s[i - 1], a50 = sma50s[i - 1], b20 = sma20s[i], b50 = sma50s[i];
    if (a20 != null && a50 != null && b20 != null && b50 != null && a20 <= a50 && b20 > b50) {
      goldenCross = true;
      break;
    }
  }

  // Lonjakan volume 5 hari terakhir, dibanding rata-rata 20 hari sebelumnya
  let spike = 0;
  for (let i = n; i > n - 5; i--) {
    const avg = avgVol20s[i - 1];
    if (avg) spike = Math.max(spike, vols[i] / avg);
  }

  // ---------- Kriteria FASE AKUMULASI ----------
  const green: PhaseCriterion[] = [];
  {
    const sideways = baseRange <= 15 && price >= baseLo;
    const breakout = price > baseHi ? ((price - baseHi) / baseHi) * 100 : 0;
    const met = sideways && breakout <= 5;
    green.push({
      label: "Sideways / breakout tipis",
      met,
      text: !sideways
        ? `Rentang 20 hari ${baseRange.toFixed(0)}% — harga tidak sedang konsolidasi.`
        : breakout > 5
          ? `Sudah breakout ${breakout.toFixed(0)}% dari area konsolidasi — bukan lagi tipis.`
          : breakout > 0
            ? `Baru breakout tipis ${breakout.toFixed(1)}% dari konsolidasi (rentang ${baseRange.toFixed(0)}%).`
            : `Konsolidasi ${formatPrice(baseLo)}–${formatPrice(baseHi)} (rentang ${baseRange.toFixed(0)}%).`,
    });
  }
  {
    const above = price > sma20 && price > sma50;
    green.push({
      label: "Di atas MA20 & MA50",
      met: above,
      text: `${above ? "Harga di atas" : "Harga belum di atas"} MA20 (${formatPrice(sma20)}) & MA50 (${formatPrice(sma50)})${
        goldenCross ? " — golden cross baru terjadi." : sma20 > sma50 ? ", MA20 > MA50." : ", MA20 masih < MA50."
      }`,
    });
  }
  {
    const quiet = (week == null || week < 10) && (month == null || month < 20);
    const met = spike >= 2 && quiet;
    green.push({
      label: "Volume spike, harga belum lari",
      met,
      text:
        spike < 2
          ? `Volume tertinggi 5 hari terakhir ${spike.toFixed(1)}x rata-rata — belum ada lonjakan.`
          : quiet
            ? `Volume melonjak ${spike.toFixed(1)}x, harga baru ${pct(week ?? 0, 1)} sepekan — masih fase awal.`
            : `Volume melonjak ${spike.toFixed(1)}x, tapi harga sudah naik ${pct(month ?? week ?? 0)} — bukan fase awal.`,
    });
  }
  green.push(
    stock.freeFloat == null
      ? { label: "Free float < 30%", met: null, text: "Data free float tidak tersedia." }
      : {
          label: "Free float < 30%",
          met: stock.freeFloat < 30,
          text: `Free float ${stock.freeFloat.toFixed(1)}%${stock.freeFloat < 30 ? " — likuiditas tipis, mudah digerakkan." : "."}`,
        },
  );
  green.push(
    rsi == null
      ? { label: "RSI netral (40–60)", met: null, text: "RSI tidak tersedia." }
      : { label: "RSI netral (40–60)", met: rsi >= 40 && rsi <= 60, text: `RSI(14) ${rsi.toFixed(0)}.` },
  );

  // ---------- Kriteria TERLAMBAT BELI ----------
  const red: PhaseCriterion[] = [];
  red.push(
    month == null
      ? { label: "Naik > 50% sebulan", met: null, text: "Kenaikan 1 bulan tidak tersedia." }
      : { label: "Naik > 50% sebulan", met: month > 50, text: `Kenaikan 1 bulan ${pct(month)}${month > 50 ? " — sudah parabolik." : "."}` },
  );
  {
    const dist = ((price - sma20) / sma20) * 100;
    red.push({
      label: "Overextended > 15% dari MA20",
      met: dist > 15,
      text: `Harga ${Math.abs(dist).toFixed(1)}% ${dist >= 0 ? "di atas" : "di bawah"} MA20.`,
    });
  }
  {
    // Volume rekor (tertinggi 60 hari) dengan harga stagnan, atau shooting star bervolume besar, dalam 3 hari terakhir
    let hit: string | null = null;
    for (let i = n; i > n - 3 && !hit; i--) {
      const c = candles[i];
      const avg = avgVol20s[i - 1] ?? 0;
      const record = c.volume >= Math.max(...vols.slice(Math.max(0, i - 60), i)) && c.volume > 0;
      const dayChg = closes[i - 1] ? ((c.close - closes[i - 1]) / closes[i - 1]) * 100 : 0;
      if (isShootingStar(c) && avg && c.volume >= avg * 1.5) hit = `Shooting star bervolume ${(c.volume / avg).toFixed(1)}x (${c.time}) — indikasi distribusi.`;
      else if (record && Math.abs(dayChg) < 2) hit = `Volume rekor 60 hari tapi harga stagnan ${pct(dayChg, 1)} (${c.time}) — indikasi distribusi.`;
    }
    red.push({ label: "Volume rekor, harga stagnan", met: !!hit, text: hit ?? "Tidak ada tanda distribusi di 3 hari terakhir." });
  }
  red.push(
    rsi == null
      ? { label: "RSI > 75", met: null, text: "RSI tidak tersedia." }
      : { label: "RSI > 75", met: rsi > 75, text: `RSI(14) ${rsi.toFixed(0)}${rsi > 75 ? " — overbought ekstrem." : "."}` },
  );
  {
    const loss = stock.peRatio != null && stock.peRatio <= 0;
    const debt = f?.der != null && f.der > 100;
    const pricey = stock.pbv != null && stock.pbv > 2;
    const known = stock.peRatio != null || f?.der != null;
    const bits = [
      stock.peRatio != null ? `PER ${stock.peRatio.toFixed(1)}x` : null,
      stock.pbv != null ? `PBV ${stock.pbv.toFixed(1)}x` : null,
      f?.der != null ? `DER ${f.der.toFixed(0)}%` : null,
    ].filter(Boolean);
    red.push({
      label: "Fundamental buruk tapi PBV > 2x",
      met: !known || stock.pbv == null ? null : (loss || debt) && pricey,
      text: bits.length ? `${bits.join(", ")}.` : "Data fundamental tidak tersedia.",
    });
  }

  const greenCount = green.filter((c) => c.met).length;
  const redCount = red.filter((c) => c.met).length;

  let status: PhaseStatus;
  let action: string;
  if (redCount >= RED_MIN) {
    status = "fomo";
    action = `Harga bergerak jauh dari area referensi. Risiko mengejar harga (FOMO) perlu diperhatikan — rata-rata 20 hari (MA20) di ≈ ${formatPrice(sma20)}.`;
  } else if (greenCount >= GREEN_MIN) {
    status = "accumulation";
    const support = Math.min(baseLo, sma50);
    action = `Harga di area konsolidasi dengan tanda akumulasi. Referensi MA20 ≈ ${formatPrice(sma20)}, area support ≈ ${formatPrice(support)}. Bukan sinyal transaksi — perhatikan konfirmasi harga dan risiko.`;
  } else {
    status = "neutral";
    action = "Belum memenuhi kriteria pola akumulasi maupun FOMO. Pergerakan harga dan volume belum menunjukkan konfirmasi yang memadai.";
  }

  return { status, green, red, greenCount, redCount, action };
}
