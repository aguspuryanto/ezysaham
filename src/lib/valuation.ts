import type { Stock } from "./types";

export interface GrahamValuation {
  eps: number;
  bvps: number;
  /** Harga wajar = √(22,5 × EPS × BVPS) */
  fairValue: number;
  /** (harga wajar − harga) / harga wajar × 100. Positif = di bawah harga wajar (diskon). */
  marginOfSafety: number;
}

/**
 * Graham Number: estimasi harga wajar konservatif dari Benjamin Graham.
 * 22,5 = batas PER 15x × PBV 1,5x. EPS & BVPS diturunkan dari harga, PER, dan PBV.
 * null bila laba atau ekuitas negatif (rumus tidak berlaku).
 */
export function grahamNumber(stock: Pick<Stock, "price" | "peRatio" | "pbv">): GrahamValuation | null {
  const { price, peRatio, pbv } = stock;
  if (!price || !peRatio || !pbv || peRatio <= 0 || pbv <= 0) return null;
  const eps = price / peRatio;
  const bvps = price / pbv;
  const fairValue = Math.sqrt(22.5 * eps * bvps);
  return { eps, bvps, fairValue, marginOfSafety: ((fairValue - price) / fairValue) * 100 };
}

export interface PeerMultiples {
  /** Nama kelompok pembanding (industri / subsektor / sektor). */
  group: string;
  level: "industri" | "subsektor" | "sektor";
  count: number;
  per: number | null;
  pbv: number | null;
}

const MIN_PEERS = 8;

function median(values: number[]): number | null {
  if (!values.length) return null;
  const v = [...values].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/**
 * Median PER & PBV emiten sejenis. Memakai kelompok tersempit yang punya cukup
 * pembanding (industri → subsektor → sektor). Median dipakai agar tidak terseret outlier;
 * PER/PBV negatif atau ekstrem dan saham tanpa data terbaru diabaikan.
 */
export function peerMultiples(stock: Stock, all: Stock[]): PeerMultiples | null {
  const active = all.filter((s) => s.lastDate === stock.lastDate);
  const levels = [
    { level: "industri", key: "industry" },
    { level: "subsektor", key: "subSector" },
    { level: "sektor", key: "sector" },
  ] as const;
  for (const { level, key } of levels) {
    const group = stock[key];
    if (!group || group === "-") continue;
    const peers = active.filter((s) => s[key] === group);
    const pers = peers.map((s) => s.peRatio).filter((v): v is number => v != null && v > 0 && v < 200);
    const pbvs = peers.map((s) => s.pbv).filter((v): v is number => v != null && v > 0 && v < 50);
    if (pers.length >= MIN_PEERS || level === "sektor") {
      return { group, level, count: peers.length, per: median(pers), pbv: median(pbvs) };
    }
  }
  return null;
}

export interface FairValue {
  method: string;
  detail: string;
  value: number;
}

/** Harga wajar dari Graham Number, PER sektor × EPS, dan PBV sektor × BVPS. */
export function fairValues(stock: Stock, all: Stock[]) {
  const graham = grahamNumber(stock);
  const peers = peerMultiples(stock, all);
  const list: FairValue[] = [];
  if (graham) {
    list.push({ method: "Graham Number", detail: "√(22,5 × EPS × BVPS)", value: graham.fairValue });
  }
  if (graham && peers?.per) {
    list.push({ method: "PER sektor", detail: `${peers.per.toFixed(1).replace(".", ",")}x × EPS`, value: peers.per * graham.eps });
  }
  if (graham && peers?.pbv) {
    list.push({ method: "PBV sektor", detail: `${peers.pbv.toFixed(2).replace(".", ",")}x × BVPS`, value: peers.pbv * graham.bvps });
  }
  const average = list.length ? list.reduce((a, f) => a + f.value, 0) / list.length : null;
  /** Median metode — tahan terhadap satu metode yang meleset jauh (mis. PBV sektor bank). */
  const middle = median(list.map((f) => f.value));
  return { graham, peers, list, average, median: middle };
}
