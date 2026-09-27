/** Tooltip copy for the Screener's column terms — explains what each read means and where it comes from. */
export const SCREENER_GLOSSARY = {
  marketPhase: 'Kondisi harga saat ini dari EMA9/EMA21, RSI 14, volume vs rata-rata 20 hari, dan high 20 hari: Bullish Awal, Breakout, Pullback, Extended, Distribution, Bearish, atau Netral.',
  trend: 'Arah tren dari posisi harga terhadap EMA20 & EMA50: Bullish (di atas), Sideways (konsolidasi), Bearish (di bawah).',
  fundamental: 'Skor komposit 0–100 dari profitabilitas (ROE), valuasi (PER/PBV), kesehatan keuangan (DER, current ratio), dividen, dan likuiditas.',
  momentum: 'Kekuatan dorongan harga dari MACD dan RSI 14. Strong = MACD bullish; Weak = momentum masih melemah.',
  volume: 'Volume hari ini dibanding rata-rata 20 hari (RVOL). High ≥ 1,2×, Medium 0,8–1,2×, Low < 0,8×. Volume tinggi bukan otomatis sinyal beli.',
  fairValue: 'Rentang nilai wajar dari tiga metode: PER 15× (rata-rata IHSG), PBV justified (ROE ÷ cost of equity 12%), dan Graham Number. Angka dalam kurung = median.',
  upside: 'Jarak harga sekarang ke median fair value. Positif = harga di bawah nilai wajar.',
  valuation: 'Undervalued = upside ≥ 20%, Fair Value = −10% s/d +20%, Premium = −35% s/d −10%, Overvalued = di bawah −35%. Valuasi murah saja bukan alasan membeli.',
  risk: 'Risk Gate teknikal: Low = tidak ada sinyal bahaya, Medium = ada catatan, High = beberapa konfirmasi bearish (mis. di bawah EMA50/EMA200, distribusi).',
  aiInsight: 'Ringkasan otomatis yang memisahkan pembacaan TEKNIKAL, VALUASI, dan RISIKO. Bukan rekomendasi beli/jual.',
} as const;
