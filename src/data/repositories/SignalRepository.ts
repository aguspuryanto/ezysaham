/**
 * SignalRepository.ts
 *
 * API service for SARA AI signals. Currently backed by TEMPORARY mock data.
 * To go live, replace the body of `getSignalDashboard` with:
 *
 *   const res = await fetch(`/api/signals?date=${date}`, { cache: 'no-store' });
 *   if (!res.ok) throw new Error('Gagal memuat sinyal');
 *   return (await res.json()) as SignalDashboardData;
 *
 * The UI only depends on `SignalDashboardData`, so nothing else needs to change.
 */

import { MOCK_PERFORMANCE, buildMockSignals } from '@/data/mock/signalMock';
import { SignalDashboardData } from '@/domain/models/Signal';

const MOCK_LATENCY_MS = 600;

/** Today's date in WIB (Asia/Jakarta) as YYYY-MM-DD. */
export function todayWib(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
}

function isWeekend(date: string): boolean {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

export async function getSignalDashboard(date: string): Promise<SignalDashboardData> {
  await new Promise((r) => setTimeout(r, MOCK_LATENCY_MS));

  // No trading session on weekends → no signal batch (exercises the empty state).
  if (isWeekend(date)) {
    return { date, lastUpdated: null, signals: [], performance: MOCK_PERFORMANCE };
  }

  return {
    date,
    // Batches are generated after market close (16:15 WIB).
    lastUpdated: `${date}T16:15:00+07:00`,
    signals: buildMockSignals(date),
    performance: MOCK_PERFORMANCE,
  };
}
