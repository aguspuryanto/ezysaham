/**
 * Indonesian-locale number formatting for the Screener detail page
 * (features_redesign_detail.md §8): Rp 3.860 · +2,12% · 11,2x · 52,3M.
 * Every helper returns "—" for null/NaN so missing data never renders as 0.
 */

const isNum = (n: number | null | undefined): n is number => n != null && Number.isFinite(n);

export const DASH = '—';

export function fmtNum(n: number | null | undefined, dec = 0): string {
  if (!isNum(n)) return DASH;
  return n.toLocaleString('id-ID', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

/** "Rp 3.860" — IDX prices are whole rupiah. */
export function fmtRp(n: number | null | undefined): string {
  return isNum(n) ? `Rp ${fmtNum(Math.round(n))}` : DASH;
}

/** "+2,12%" (sign always shown). */
export function fmtPct(n: number | null | undefined, dec = 2): string {
  if (!isNum(n)) return DASH;
  return `${n > 0 ? '+' : ''}${fmtNum(n, dec)}%`;
}

/** "18,4%" (no forced sign). */
export function fmtPctPlain(n: number | null | undefined, dec = 1): string {
  return isNum(n) ? `${fmtNum(n, dec)}%` : DASH;
}

/** "11,2x". */
export function fmtMultiple(n: number | null | undefined, dec = 1): string {
  return isNum(n) ? `${fmtNum(n, dec)}x` : DASH;
}

/** "52,3M" — K/M/B/T suffixes with an Indonesian decimal comma. */
export function fmtCompact(n: number | null | undefined): string {
  if (!isNum(n)) return DASH;
  const abs = Math.abs(n);
  const units: Array<[number, string]> = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']];
  for (const [size, suffix] of units) {
    if (abs >= size) return `${fmtNum(n / size, 1)}${suffix}`;
  }
  return fmtNum(n);
}

/** "+Rp 125B" for signed flows. */
export function fmtRpCompactSigned(n: number | null | undefined): string {
  if (!isNum(n)) return DASH;
  return `${n > 0 ? '+' : n < 0 ? '-' : ''}Rp ${fmtCompact(Math.abs(n))}`;
}

export type Tone = 'positive' | 'negative' | 'warning' | 'info' | 'neutral';

export function toneOf(n: number | null | undefined): Tone {
  if (!isNum(n) || n === 0) return 'neutral';
  return n > 0 ? 'positive' : 'negative';
}
