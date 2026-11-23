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
