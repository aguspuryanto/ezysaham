/**
 * Jam bursa BEI (WIB, UTC+7), disederhanakan: Senin–Jumat 08:45–16:15
 * (mencakup pra-pembukaan hingga pasca-penutupan). Libur bursa tidak dihitung.
 */
export function isMarketOpen(now = new Date()) {
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const day = wib.getUTCDay();
  if (day === 0 || day === 6) return false;
  const minutes = wib.getUTCHours() * 60 + wib.getUTCMinutes();
  return minutes >= 8 * 60 + 45 && minutes <= 16 * 60 + 15;
}
