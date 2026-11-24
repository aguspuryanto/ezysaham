import type { Stock } from "./types";

export type ScreenerKey = "gainer" | "loser" | "momentum" | "fundamental" | "accumulation" | "active";

export interface ScreenerDef {
  key: ScreenerKey;
  title: string;
  short: string;
  description: string;
  run: (stocks: Stock[]) => Stock[];
}

/** Batas likuiditas minimum agar saham "tidur" tidak masuk screener. */
const MIN_VALUE = 1_000_000_000; // Rp1 M nilai transaksi harian
const MIN_PRICE = 50;

const liquid = (s: Stock, minValue = MIN_VALUE) => s.value >= minValue && s.price >= MIN_PRICE;

/** Posisi harga penutupan dalam rentang harian (0 = di low, 1 = di high). */
export function closePosition(s: Stock) {
  const range = s.high - s.low;
  if (range <= 0) return 0.5;
  return (s.price - s.low) / range;
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/** Skor fundamental sederhana 0–100: ROE tinggi, PER & PBV wajar. */
export function fundamentalScore(s: Stock): number | null {
  if (s.roe == null || s.peRatio == null || s.peRatio <= 0) return null;
  const roe = Math.min(Math.max(s.roe, 0), 40) / 40; // 0..1
  const per = 1 - Math.min(s.peRatio, 30) / 30; // makin kecil makin bagus
  const pbv = s.pbv != null && s.pbv > 0 ? 1 - Math.min(s.pbv, 5) / 5 : 0.3;
  return Math.round((roe * 0.5 + per * 0.3 + pbv * 0.2) * 100);
}

export const SCREENERS: ScreenerDef[] = [
  {
    key: "gainer",
    title: "Top Gainer",
    short: "Gainer",
    description: "Saham dengan kenaikan harga harian tertinggi (nilai transaksi min. Rp1 M).",
    run: (stocks) => stocks.filter((s) => liquid(s)).sort((a, b) => b.change - a.change),
  },
  {
    key: "momentum",
    title: "Top Momentum",
    short: "Momentum",
    description:
      "Naik ≥3% hari ini dengan nilai transaksi di atas median pasar, dan performa sepekan positif. Diurutkan dari momentum terkuat.",
    run: (stocks) => {
      const pool = stocks.filter((s) => liquid(s, 0) && s.value > 0);
      const med = median(pool.map((s) => s.value));
      return pool
        .filter((s) => s.change >= 3 && s.value > med && (s.returns.week ?? 0) > 0)
        .map((s) => ({ s, score: s.change + (s.returns.week ?? 0) / 2 + Math.log10(s.value / med) * 2 }))
        .sort((a, b) => b.score - a.score)
        .map((x) => x.s);
    },
  },
  {
    key: "fundamental",
    title: "Top Fundamental",
    short: "Fundamental",
    description:
      "PER 0–20, ROE ≥ 15%, kapitalisasi ≥ Rp1 T. Diurutkan berdasarkan skor gabungan ROE, PER, dan PBV.",
    run: (stocks) =>
      stocks
        .filter(
          (s) =>
            s.peRatio != null && s.peRatio > 0 && s.peRatio < 20 &&
            s.roe != null && s.roe >= 15 && s.marketCap >= 1e12 && liquid(s, 100_000_000),
        )
        .sort((a, b) => (fundamentalScore(b) ?? 0) - (fundamentalScore(a) ?? 0)),
  },
  {
    key: "accumulation",
    title: "Top Akumulasi",
    short: "Akumulasi",
    description:
      "Harga cenderung sideways (±5% sebulan, ±3% sepekan) namun ditransaksikan ramai dan ditutup dekat harga tertinggi hari ini — indikasi ada pihak yang mengumpulkan barang.",
    run: (stocks) =>
      stocks
        .filter(
          (s) =>
            liquid(s, 5_000_000_000) &&
            Math.abs(s.returns.month ?? 99) <= 5 &&
            Math.abs(s.returns.week ?? 99) <= 3 &&
            s.change >= 0 &&
            closePosition(s) >= 0.7,
        )
        .map((s) => ({ s, score: closePosition(s) * Math.log10(s.value) }))
        .sort((a, b) => b.score - a.score)
        .map((x) => x.s),
  },
  {
    key: "active",
    title: "Paling Aktif",
    short: "Teraktif",
    description: "Saham dengan nilai transaksi harian terbesar.",
    run: (stocks) => [...stocks].sort((a, b) => b.value - a.value),
  },
  {
    key: "loser",
    title: "Top Loser",
    short: "Loser",
    description: "Saham dengan penurunan harga harian terdalam (nilai transaksi min. Rp1 M).",
    run: (stocks) => stocks.filter((s) => liquid(s)).sort((a, b) => a.change - b.change),
  },
];

export function getScreener(key: string | undefined | null) {
  return SCREENERS.find((s) => s.key === key);
}

export interface MarketBreadth {
  total: number;
  up: number;
  down: number;
  flat: number;
  totalValue: number;
  totalVolume: number;
  totalFrequency: number;
  lastDate: string | null;
}

export function marketBreadth(stocks: Stock[]): MarketBreadth {
  let up = 0, down = 0, flat = 0, totalValue = 0, totalVolume = 0, totalFrequency = 0;
  let lastDate: string | null = null;
  for (const s of stocks) {
    if (s.volume <= 0) continue;
    if (s.change > 0) up++;
    else if (s.change < 0) down++;
    else flat++;
    totalValue += s.value;
    totalVolume += s.volume;
    totalFrequency += s.frequency;
    if (s.lastDate && (!lastDate || s.lastDate > lastDate)) lastDate = s.lastDate;
  }
  return { total: up + down + flat, up, down, flat, totalValue, totalVolume, totalFrequency, lastDate };
}

export interface SectorPerf {
  sector: string;
  count: number;
  /** Rata-rata perubahan tertimbang kapitalisasi (%) */
  change: number;
  marketCap: number;
}

/** URL halaman daftar saham per sektor (sama dengan format versi lama: /sektor?sector=...). */
export function sectorHref(sector: string) {
  return `/sektor?sector=${encodeURIComponent(sector)}`;
}

export function sectorPerformance(stocks: Stock[]): SectorPerf[] {
  const map = new Map<string, { w: number; cap: number; count: number }>();
  for (const s of stocks) {
    if (s.marketCap <= 0 || s.volume <= 0) continue;
    const m = map.get(s.sector) ?? { w: 0, cap: 0, count: 0 };
    m.w += s.change * s.marketCap;
    m.cap += s.marketCap;
    m.count++;
    map.set(s.sector, m);
  }
  return [...map.entries()]
    .map(([sector, m]) => ({ sector, count: m.count, change: m.cap ? m.w / m.cap : 0, marketCap: m.cap }))
    .sort((a, b) => b.change - a.change);
}
