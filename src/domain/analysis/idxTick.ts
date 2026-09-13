/**
 * idxTick.ts
 *
 * IDX (Bursa Efek Indonesia) price fraction / tick size rules. Any price level
 * shown to users as an actionable order price (entry, target, stop loss) must
 * snap to a valid tick — exchanges reject orders on invalid fractions.
 */

export function idxTickSize(price: number): number {
  if (price < 200) return 1;
  if (price < 500) return 2;
  if (price < 2000) return 5;
  if (price < 5000) return 10;
  return 25;
}

/** Rounds a price to the nearest valid IDX tick for its own price bracket. */
export function roundToTick(price: number): number {
  if (!Number.isFinite(price) || price <= 0) return 0;
  const tick = idxTickSize(price);
  return Math.round(price / tick) * tick;
}
