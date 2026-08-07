import { OHLCVBar } from '@/domain/models/History';

export type DataFreshnessTier = 'fresh' | 'aging' | 'stale';

export interface DataFreshness {
  /** Date string (YYYY-MM-DD) of the last available bar. */
  lastBarDate: string;
  /** Weekdays strictly between lastBarDate and `today` — an approximation that
   * ignores IDX public holidays (known limitation, not worth a holiday
   * calendar for this pass). */
  ageInTradingDays: number;
  /** 0-100, 100 = same trading day, 0 = 3+ trading days old. */
  score: number;
  tier: DataFreshnessTier;
}

function countWeekdaysBetween(from: Date, to: Date): number {
  let count = 0;
  const cursor = new Date(from);
  cursor.setUTCDate(cursor.getUTCDate() + 1);
  while (cursor.getTime() < to.getTime()) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) count++;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

export function computeDataFreshness(bars: OHLCVBar[], today: Date): DataFreshness | null {
  if (bars.length === 0) return null;
  const lastBarDate = bars[bars.length - 1].date;
  const lastBar = new Date(`${lastBarDate}T00:00:00Z`);
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  const ageInTradingDays = Math.max(0, countWeekdaysBetween(lastBar, todayUtc));

  let score: number;
  let tier: DataFreshnessTier;
  if (ageInTradingDays === 0) {
    score = 100;
    tier = 'fresh';
  } else if (ageInTradingDays === 1) {
    score = 70;
    tier = 'aging';
  } else if (ageInTradingDays === 2) {
    score = 40;
    tier = 'aging';
  } else {
    score = 0;
    tier = 'stale';
  }

  return { lastBarDate, ageInTradingDays, score, tier };
}
