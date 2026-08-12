/** True when series `a` crosses from ≤ `b` to > `b` between index i-1 and i (both series aligned, NaN-safe). */
export function crossesAbove(a: number[], b: number[], i: number): boolean {
  if (i < 1) return false;
  const prevA = a[i - 1], prevB = b[i - 1], curA = a[i], curB = b[i];
  if ([prevA, prevB, curA, curB].some((v) => Number.isNaN(v))) return false;
  return prevA <= prevB && curA > curB;
}

/** True when series `a` crosses from ≥ `b` to < `b` between index i-1 and i (both series aligned, NaN-safe). */
export function crossesBelow(a: number[], b: number[], i: number): boolean {
  if (i < 1) return false;
  const prevA = a[i - 1], prevB = b[i - 1], curA = a[i], curB = b[i];
  if ([prevA, prevB, curA, curB].some((v) => Number.isNaN(v))) return false;
  return prevA >= prevB && curA < curB;
}
