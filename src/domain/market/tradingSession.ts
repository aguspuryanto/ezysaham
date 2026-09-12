/**
 * tradingSession.ts
 *
 * Real IDX (Bursa Efek Indonesia) trading-hour facts, WIB (UTC+7):
 *   Pre-opening : 08:45 – 09:00 (counted as "open" for UX purposes)
 *   Sesi I      : Mon–Fri 09:00 – 11:30
 *   Sesi II     : Mon–Fri 13:30 – 15:50
 * Same facts already used (file-locally) by IhsgChart.tsx's isIdxOpen — this
 * exports the same logic plus which session is live and when it ends, so
 * other pages (like the /terminal screener) can show a real session badge
 * instead of a static/fabricated one.
 */

export interface IdxSessionStatus {
  isOpen: boolean;
  session: 1 | 2 | null;
  label: string;
  sessionEndsAt: string | null;
}

export function getIdxSessionStatus(now: Date): IdxSessionStatus {
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const day = wib.getUTCDay(); // 0 = Sun, 6 = Sat
  const h = wib.getUTCHours();
  const m = wib.getUTCMinutes();
  const totalMin = h * 60 + m;

  const PRE_OPEN = 8 * 60 + 45; // 08:45
  const S1_CLOSE = 11 * 60 + 30; // 11:30
  const S2_OPEN = 13 * 60 + 30; // 13:30
  const S2_CLOSE = 15 * 60 + 50; // 15:50

  if (day === 0 || day === 6) {
    return { isOpen: false, session: null, label: 'MARKET CLOSED', sessionEndsAt: null };
  }

  if (totalMin >= PRE_OPEN && totalMin < S1_CLOSE) {
    return { isOpen: true, session: 1, label: 'SESI 1 LIVE', sessionEndsAt: '11:30 WIB' };
  }
  if (totalMin >= S2_OPEN && totalMin < S2_CLOSE) {
    return { isOpen: true, session: 2, label: 'SESI 2 LIVE', sessionEndsAt: '15:50 WIB' };
  }

  return { isOpen: false, session: null, label: 'MARKET CLOSED', sessionEndsAt: null };
}
