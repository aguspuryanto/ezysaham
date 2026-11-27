import type { Candle, Stock } from "./types";

/**
 * Deteksi saham yang kemungkinan disuspensi BEI. Sumber data (Pasardana/Yahoo) tidak
 * punya field status suspensi, jadi dideteksi dari pola transaksi: hari ini tanpa
 * transaksi DAN ≥ MIN_IDLE_DAYS hari bursa berturut-turut sebelumnya volume 0.
 * Saham tidak likuid biasa hampir selalu tetap punya transaksi dalam seminggu.
 */
const MIN_IDLE_DAYS = 5;

export interface Suspension {
  /** Jumlah hari bursa berturut-turut tanpa transaksi (tidak termasuk hari ini); null bila riwayat tidak tersedia */
  idleDays: number | null;
  /** Tanggal transaksi terakhir (YYYY-MM-DD), null bila tidak ada dalam riwayat */
  lastTraded: string | null;
}

/**
 * Versi cepat tanpa riwayat harga (untuk tabel screener): hari ini tanpa transaksi dan harga
 * tidak berubah sama sekali selama 1 minggu & 1 bulan. Lebih ketat dari detectSuspension —
 * suspensi yang baru berjalan < 1 bulan bisa belum terdeteksi, tapi minim salah tandai.
 */
export function isLikelySuspended(stock: Stock): boolean {
  return stock.volume === 0 && stock.frequency === 0 && stock.returns.week === 0 && stock.returns.month === 0;
}

export function detectSuspension(stock: Stock, candles: Candle[]): Suspension | null {
  if (stock.volume > 0 || stock.frequency > 0) return null;
  // Candle terakhir bisa berupa hari ini yang belum lengkap — abaikan.
  const past = candles.slice(0, -1);
  let idleDays = 0;
  for (let i = past.length - 1; i >= 0 && past[i].volume === 0; i--) idleDays++;
  if (idleDays < MIN_IDLE_DAYS) {
    // Riwayat kosong/kurang: tetap konsisten dengan badge di tabel screener.
    return isLikelySuspended(stock) ? { idleDays: null, lastTraded: null } : null;
  }
  const last = past[past.length - 1 - idleDays];
  return { idleDays, lastTraded: last?.time ?? null };
}
