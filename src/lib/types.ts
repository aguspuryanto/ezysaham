/** Bentuk mentah respons GET /api/stocks dari ezysaham (dipangkas ke field yang dipakai). */
export interface RawStock {
  Code: string;
  Name: string;
  NewSectorName: string | null;
  NewSubSectorName: string | null;
  NewIndustryName: string | null;
  Last: number | null;
  PrevClosingPrice: number | null;
  AdjustedOpenPrice: number | null;
  AdjustedHighPrice: number | null;
  AdjustedLowPrice: number | null;
  Volume: number | null;
  Frequency: number | null;
  Value: number | null;
  OneDay: number | null;
  OneWeek: number | null;
  OneMonth: number | null;
  ThreeMonth: number | null;
  SixMonth: number | null;
  OneYear: number | null;
  Ytd: number | null;
  Per: number | null;
  Pbr: number | null;
  Capitalization: number | null;
  BetaOneYear: number | null;
  AdjustedAnnualHighPrice: number | null;
  AdjustedAnnualLowPrice: number | null;
  LastDate: string | null;
  Roe: number | null;
  FreeFloatPct: number | null;
}

/** Model saham yang sudah dinormalisasi untuk UI. Persentase dalam satuan % (1.5 = 1,5%). */
export interface Stock {
  symbol: string;
  name: string;
  sector: string;
  subSector: string;
  industry: string;
  price: number;
  prevClose: number;
  open: number;
  high: number;
  low: number;
  /** Perubahan harian dalam persen */
  change: number;
  changeValue: number;
  volume: number;
  /** Nilai transaksi (Rp) */
  value: number;
  frequency: number;
  marketCap: number;
  peRatio: number | null;
  pbv: number | null;
  /** ROE dalam persen */
  roe: number | null;
  beta: number | null;
  freeFloat: number | null;
  high52: number | null;
  low52: number | null;
  returns: {
    week: number | null;
    month: number | null;
    threeMonth: number | null;
    sixMonth: number | null;
    year: number | null;
    ytd: number | null;
  };
  lastDate: string | null;
}

export interface Candle {
  /** YYYY-MM-DD */
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Fundamentals {
  symbol: string;
  /** Persen */
  dividendYield: number | null;
  /** Persen */
  payoutRatio: number | null;
  dividendPerShare: number | null;
  dividendHistory: { date: string; amount: number }[];
  der: number | null;
  currentRatio: number | null;
  /** Persen */
  netMargin: number | null;
  /** Persen */
  revenueGrowth: number | null;
  /** Persen */
  earningsGrowth: number | null;
  source: string | null;
  fetchedAt: string | null;
}

export type HistoryRange = "3mo" | "6mo" | "1y" | "2y" | "5y";

export const HISTORY_RANGES: { value: HistoryRange; label: string }[] = [
  { value: "3mo", label: "3B" },
  { value: "6mo", label: "6B" },
  { value: "1y", label: "1T" },
  { value: "2y", label: "2T" },
  { value: "5y", label: "5T" },
];

export function isHistoryRange(v: string | null | undefined): v is HistoryRange {
  return HISTORY_RANGES.some((r) => r.value === v);
}

export interface DividendPick {
  stock: Stock;
  dividendYield: number;
  payoutRatio: number | null;
}
