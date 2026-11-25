/** Fee broker transaksi saham (persen dari nilai transaksi). */
export const BUY_FEE_RATE = 0.0015; // 0,15%
export const SELL_FEE_RATE = 0.0025; // 0,25%

export interface SaleAmounts {
  shares: number;
  buyPrice: number;
  sellPrice: number;
  buyFee: number;
  sellFee: number;
}

/** Rincian satu transaksi jual: modal (avg × lembar + fee beli lama bila ada), hasil bersih (setelah fee jual), untung/rugi. */
export function saleResult(s: SaleAmounts) {
  const cost = s.buyPrice * s.shares + s.buyFee;
  const proceeds = s.sellPrice * s.shares - s.sellFee;
  const pl = proceeds - cost;
  return { cost, proceeds, pl, plPct: cost ? (pl / cost) * 100 : 0 };
}

/**
 * Harga rata-rata (avg) mengikuti konvensi broker: SUDAH termasuk fee beli,
 * sehingga modal = avg × lembar (sama dengan "Invested" di aplikasi broker).
 * Dipakai saat pengguna menginput harga eksekusi, bukan avg dari broker.
 */
export function avgWithBuyFee(price: number) {
  return price * (1 + BUY_FEE_RATE);
}

/**
 * Fee untuk penjualan `shares` lembar. Fee beli = 0 karena sudah terkandung di avg
 * (catatan penjualan lama sebelum konvensi ini tetap menyimpan fee belinya sendiri).
 */
export function saleFees(shares: number, sellPrice: number) {
  return {
    buyFee: 0,
    sellFee: Math.round(sellPrice * shares * SELL_FEE_RATE * 100) / 100,
  };
}
