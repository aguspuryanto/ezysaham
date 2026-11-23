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

/** Rincian satu transaksi jual: modal (termasuk fee beli), hasil bersih (setelah fee jual), untung/rugi. */
export function saleResult(s: SaleAmounts) {
  const cost = s.buyPrice * s.shares + s.buyFee;
  const proceeds = s.sellPrice * s.shares - s.sellFee;
  const pl = proceeds - cost;
  return { cost, proceeds, pl, plPct: cost ? (pl / cost) * 100 : 0 };
}

/** Hitung fee beli & jual untuk penjualan `shares` lembar. */
export function saleFees(shares: number, buyPrice: number, sellPrice: number) {
  return {
    buyFee: Math.round(buyPrice * shares * BUY_FEE_RATE * 100) / 100,
    sellFee: Math.round(sellPrice * shares * SELL_FEE_RATE * 100) / 100,
  };
}
