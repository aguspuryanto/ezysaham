/**
 * Paket membership. Ubah harga/fitur di sini saja.
 * Prinsip: semua fitur inti tetap gratis; Pro bersifat sukarela (dukungan + fitur tambahan).
 */
export interface PlanFeature {
  text: string;
  /** true = fitur belum tersedia, tampil sebagai "Segera" */
  soon?: boolean;
}

export const PRO_PRICE = {
  monthly: 19_000,
  /** Total per tahun (setara ±Rp15.800/bulan, gratis 2 bulan) */
  yearly: 190_000,
};

export const STARTER_FEATURES: PlanFeature[] = [
  { text: "Screener lengkap: gainer, momentum, dividen, fundamental, akumulasi" },
  { text: "Chart candlestick + SMA, RSI, MACD hingga 5 tahun" },
  { text: "Analisa teknikal & fundamental untuk pemula" },
  { text: "Portofolio & watchlist tersimpan di akun, bisa dibuka di semua perangkat" },
  { text: "Statistik pasar: IHSG, LQ45, USD/IDR, market breadth" },
  { text: "Tips & insight pasar harian" },
];

export const PRO_FEATURES: PlanFeature[] = [
  { text: "Badge Pendukung di akunmu" },
  { text: "Ikut menentukan fitur berikutnya (akses awal & voting)" },
  { text: "Alert email saat harga / sinyal saham berubah", soon: true },
  { text: "Watchlist dengan catatan & target harga" },
  { text: "Export CSV hasil screener & portofolio", soon: true },
];

export const yearlySavingPct = Math.round((1 - PRO_PRICE.yearly / (PRO_PRICE.monthly * 12)) * 100);
